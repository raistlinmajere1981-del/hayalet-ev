/**
 * Development Tools - TypeScript Batch Fixer
 * 
 * Toplu TypeScript hatalarını otomatik düzeltir
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "../../utils/timeouts.js";

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

export async function fixTypescriptErrors(
  options: BatchFixOptions,
  projectRoot?: string
): Promise<FixResult> {
  const {
    file_path,
    error_codes = ["TS2532", "TS18048", "TS2722"],
    fix_strategy = "add_guards",
    dry_run = true,
    auto_apply = false,
  } = options;

  const fullPath = projectRoot ? join(projectRoot, file_path) : file_path;
  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  // Step 1: Get TypeScript errors for this file
  const errors = await getTypescriptErrors(file_path, projectRoot); // Use relative path for grep
  const targetErrors = errors.filter((err) =>
    error_codes.includes(err.code)
  );

  if (targetErrors.length === 0) {
    return {
      success: true,
      output: `✅ No errors found matching codes: ${error_codes.join(", ")}`,
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
    const fix = generateFix(error, lines, fix_strategy);
    if (fix) {
      changes.push({
        line: error.line,
        before: lines[error.line - 1] || '',
        after: fix.newLine,
        error_code: error.code,
      });
    }
  }

  // Step 3: Generate preview
  const preview = generatePreview(changes, file_path);

  // Step 4: Apply changes if not dry_run
  if (!dry_run && (auto_apply || changes.length > 0)) {
    applyChanges(fullPath, lines, changes);
  }

  return {
    success: true,
    output: formatOutput(changes, dry_run, file_path),
    fixed_count: changes.length,
    preview,
    changes,
  };
}

// ============================================
// Helper Functions
// ============================================

async function getTypescriptErrors(
  filePath: string,
  projectRoot?: string
): Promise<Array<{ line: number; column: number; code: string; message: string }>> {
  try {
    const cwd = projectRoot || process.cwd();
    let result = '';
    
    try {
      result = execSync(
        `npx tsc --noEmit 2>&1 | grep '${filePath}' | grep 'error TS'`,
        { cwd, encoding: "utf-8", timeout: DEV_TIMEOUTS.TYPESCRIPT_CHECK, shell: '/bin/bash' }
      );
    } catch (execError: any) {
      // tsc returns non-zero on errors, but we still want the output
      result = execError.stdout || execError.stderr || '';
      console.log('[DEBUG] execError caught, stdout length:', execError.stdout?.length, 'stderr length:', execError.stderr?.length);
    }
    
    console.log('[DEBUG] getTypescriptErrors result length:', result.length);

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
          line: parseInt(match[1] || '0', 10),
          column: parseInt(match[2] || '0', 10),
          code: match[3] || '',
          message: match[4] || '',
        });
      }
    });

    return errors;
  } catch (error) {
    // Fallback: other errors (timeout, etc.)
    logToolError('typescript-batch-fixer', error as Error, {});
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

  if (!line) return null;

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

  const varName = varMatch[1];
  const indent = line.match(/^\s*/)?.[0] || "";

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
  error: { line: number; column: number; code: string; message: string },
  strategy: string
): { newLine: string; insertBefore?: string } | null {
  // MessageStore?.method?.() → if (MessageStore && MessageStore.method) { MessageStore.method() }
  const optionalChainMatch = line.match(/(\w+)\?\.([\w]+)\?\.(\(.*?\))/);
  if (!optionalChainMatch) return null;

  const [, objName, methodName, args] = optionalChainMatch;
  const indent = line.match(/^\s*/)?.[0] || "";

  if (strategy === "add_guards") {
    const guardLine = `${indent}if (${objName} && ${objName}.${methodName}) {\n`;
    const callLine = line.replace(
      `${objName}?.${methodName}?.`,
      `  ${objName}.${methodName}`
    );
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
};
