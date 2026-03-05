/**
 * Development Tools - TypeScript Batch Fixer
 *
 * Toplu TypeScript hatalarını otomatik düzeltir
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "@timeouts";

interface BatchFixOptions {
  file_path: string;
  error_codes?: string[]; // e.g., ["TS2532", "TS18048"]
  fix_strategy?: "add_guards" | "add_assertions" | "strict_null_check";
  dry_run?: boolean;
  auto_apply?: boolean;
}

interface FixResult {
  success: boolean;
  output: string;
  fixed_count: number;
  preview?: string;
  changes?: Array<{
    line: number;
    before: string;
    after: string;
    error_code: string;
  }>;
}

export function fixTypescriptErrors(options: BatchFixOptions, projectRoot: string): FixResult {
  const {
    file_path: filePath,
    error_codes: errorCodes = ["TS2532", "TS18048", "TS2722"],
    fix_strategy: fixStrategy = "add_guards",
    dry_run: dryRun = true,
    auto_apply: autoApply = false,
  } = options;

  const fullPath = projectRoot !== "" ? join(projectRoot, filePath) : filePath;
  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  // Step 1: Get TypeScript errors for this file
  const errors = getTypescriptErrors(filePath, projectRoot); // Use relative path for grep
  const targetErrors = errors.filter((err) => errorCodes.includes(err.code));

  if (targetErrors.length === 0) {
    return {
      success: true,
      output: `✅ No errors found matching codes: ${errorCodes.join(", ")}`,
      fixed_count: 0,
    };
  }

  // Step 2: Apply fixes based on strategy
  const changes: Array<{
    line: number;
    before: string;
    after: string;
    error_code: string;
  }> = [];

  for (const error of targetErrors) {
    const fix = generateFix(error, lines, fixStrategy);
    if (fix) {
      changes.push({
        line: error.line,
        before: lines[error.line - 1] ?? "",
        after: fix.newLine,
        error_code: error.code,
      });
    }
  }

  // Step 3: Generate preview
  const preview = generatePreview(changes, filePath);

  // Step 4: Apply changes if not dry_run
  if (!dryRun && (autoApply || changes.length > 0)) {
    applyChanges(fullPath, lines, changes);
  }

  return {
    success: true,
    output: formatOutput(changes, dryRun, filePath),
    fixed_count: changes.length,
    preview,
    changes,
  };
}

// ============================================
// Helper Functions
// ============================================

function getTypescriptErrors(
  filePath: string,
  projectRoot: string
): Array<{ line: number; column: number; code: string; message: string }> {
  try {
    const cwd = projectRoot;
    let result = "";

    try {
      result = execSync(`npx tsc --noEmit 2>&1 | grep '${filePath}' | grep 'error TS'`, {
        cwd,
        encoding: "utf-8",
        timeout: DEV_TIMEOUTS.TYPESCRIPT_CHECK,
        shell: "/bin/bash",
      });
    } catch (execError: unknown) {
      // tsc returns non-zero on errors, but we still want the output
      interface ExecError {
        stdout?: string;
        stderr?: string;
      }
      const err = execError as ExecError;
      result = err.stdout ?? err.stderr ?? "";
      // Debug log to stderr
      process.stderr.write(
        `[DEBUG] execError caught, stdout length: ${err.stdout?.length ?? 0}, stderr length: ${err.stderr?.length ?? 0}\n`
      );
    }

    // Debug log to stderr
    process.stderr.write(`[DEBUG] getTypescriptErrors result length: ${result.length}\n`);

    const errors: Array<{
      line: number;
      column: number;
      code: string;
      message: string;
    }> = [];

    result.split("\n").forEach((line) => {
      // Parse: src/file.ts(123,45): error TS2532: Object is possibly 'undefined'.
      const match = line.match(/\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/);
      if (match) {
        errors.push({
          line: parseInt(match[1] ?? "0", 10),
          column: parseInt(match[2] ?? "0", 10),
          code: match[3] ?? "",
          message: match[4] ?? "",
        });
      }
    });

    return errors;
  } catch (error) {
    // Fallback: other errors (timeout, etc.)
    logToolError("typescript-batch-fixer", error as Error, {});
    return [];
  }
}

function generateFix(
  error: { line: number; column: number; code: string; message: string },
  lines: string[],
  strategy: string
): { newLine: string; insertBefore?: string } | null {
  const lineIndex = error.line - 1;
  const line = lines[lineIndex];

  if (line === undefined) return null;

  switch (error.code) {
    case "TS2532": // Object is possibly 'undefined'
    case "TS18048": // possibly 'undefined'
      return fixUndefinedError(line, error, strategy);

    case "TS2722": // Cannot invoke an object which is possibly 'undefined'
      return fixOptionalChainingError(line, error, strategy);

    default:
      return null;
  }
}

function fixUndefinedError(
  line: string,
  error: { line: number; column: number; code: string; message: string },
  strategy: string
): { newLine: string; insertBefore?: string } | null {
  // Extract variable name from error message
  // "Object is possibly 'undefined'" or "'slotState' is possibly 'undefined'"
  const varMatch = error.message.match(/'([^']+)' is possibly/);
  if (!varMatch) return null;

  const varName = varMatch[1] ?? "";
  const indent = line.match(/^\s*/)?.[0] ?? "";

  if (strategy === "add_guards") {
    // Add guard before the line
    return {
      newLine: line,
      insertBefore: `${indent}if (!${varName}) return;\n`,
    };
  }

  if (strategy === "add_assertions") {
    // Add non-null assertion
    return {
      newLine: line.replace(new RegExp(`\\b${varName}\\b`), `${varName}!`),
    };
  }

  return null;
}

function fixOptionalChainingError(
  line: string,
  _error: { line: number; column: number; code: string; message: string },
  strategy: string
): { newLine: string; insertBefore?: string } | null {
  // MessageStore?.method?.() → if (MessageStore && MessageStore.method) { MessageStore.method() }
  const optionalChainMatch = line.match(/(\w+)\?\.([\w]+)\?\.(\(.*?\))/);
  if (!optionalChainMatch) return null;

  const [, rawObjName, rawMethodName, _args] = optionalChainMatch;
  const objName = rawObjName ?? "obj";
  const methodName = rawMethodName ?? "method";
  const indent = line.match(/^\s*/)?.[0] ?? "";

  if (strategy === "add_guards") {
    const guardLine = `${indent}if (${objName} && ${objName}.${methodName}) {\n`;
    const callLine = line.replace(`${objName}?.${methodName}?.`, `  ${objName}.${methodName}`);
    const closeLine = `${indent}}\n`;

    return {
      newLine: guardLine + callLine + closeLine,
    };
  }

  return null;
}

function applyChanges(
  filePath: string,
  lines: string[],
  changes: Array<{
    line: number;
    before: string;
    after: string;
    error_code: string;
  }>
): void {
  const newLines = [...lines];

  // Sort by line number (descending) to avoid index shifting
  changes.sort((a, b) => b.line - a.line);

  for (const change of changes) {
    newLines[change.line - 1] = change.after;
  }

  writeFileSync(filePath, newLines.join("\n"), "utf-8");
}

function generatePreview(
  changes: Array<{
    line: number;
    before: string;
    after: string;
    error_code: string;
  }>,
  filePath: string
): string {
  if (changes.length === 0) return "No changes";

  let preview = `🔧 TypeScript Batch Fixer - Preview\n`;
  preview += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  preview += `📁 File: ${filePath}\n`;
  preview += `📊 Changes: ${changes.length}\n\n`;

  changes.slice(0, 5).forEach((change, idx) => {
    preview += `Change ${idx + 1}/${changes.length} (Line ${change.line}, ${change.error_code}):\n`;
    preview += `  - ${change.before.trim()}\n`;
    preview += `  + ${change.after.trim()}\n\n`;
  });

  if (changes.length > 5) {
    preview += `... and ${changes.length - 5} more changes\n`;
  }

  return preview;
}

function formatOutput(
  changes: Array<{
    line: number;
    before: string;
    after: string;
    error_code: string;
  }>,
  dryRun: boolean,
  filePath: string
): string {
  let output = `🔧 TypeScript Batch Fixer\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📁 File: ${filePath}\n`;
  output += `📊 Found: ${changes.length} fixable errors\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (dryRun) {
    output += `⚠️  DRY RUN MODE - No changes applied\n`;
    output += `\nTo apply changes, set dry_run: false\n`;
  } else {
    output += `✅ ${changes.length} changes applied successfully\n`;
  }

  return output;
}

// ============================================
// MCP Tool Definition
// ============================================

export const TYPESCRIPT_BATCH_FIXER_TOOL = {
  name: "hev_dev_fix_typescript_batch",
  description:
    "Toplu TypeScript hatalarını otomatik düzeltir (undefined checks, optional chaining)",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Düzeltilecek dosya yolu",
      },
      error_codes: {
        type: "array",
        items: { type: "string" },
        description: "Düzeltilecek hata kodları (örn: ['TS2532', 'TS18048'])",
        default: ["TS2532", "TS18048", "TS2722"],
      },
      fix_strategy: {
        type: "string",
        enum: ["add_guards", "add_assertions", "strict_null_check"],
        description: "Düzeltme stratejisi",
        default: "add_guards",
      },
      dry_run: {
        type: "boolean",
        description: "Sadece önizleme göster, değişiklik yapma",
        default: true,
      },
      auto_apply: {
        type: "boolean",
        description: "Otomatik olarak değişiklikleri uygula",
        default: false,
      },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "development",
    subcategory: "typescript",
    priority: "high",
    complexity: "complex",
    useCases: [
      "Auto-fix TypeScript null/undefined errors",
      "Batch fix TS2532, TS18048 errors",
      "Add type guards and optional chaining",
    ],
    relatedTools: [
      "hev_dev_typescript_dashboard",
      "hev_dev_typescript_type_helper",
      "hev_fs_backup",
    ],
    agentGuidance:
      "ALWAYS use dry_run=true first. Use hev_dev_typescript_dashboard to identify error codes. Supports multiple fix strategies.",
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["typescript", "auto-fix", "batch", "type-safety"],
  },
};
