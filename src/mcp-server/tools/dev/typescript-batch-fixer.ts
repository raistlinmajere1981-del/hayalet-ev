/**
 * Development Tools - TypeScript Batch Fixer
 *
 * Automatically fixes TypeScript errors in batch
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
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

function tsBatchFixerT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.typescriptBatchFixer.${key}`, params);
}

function tsBatchFixerDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(
    `mcpServer.devTools.typescriptBatchFixer.definition.${key}`,
    params
  );
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
      output: tsBatchFixerT("runtime.noMatchingErrors", { codes: errorCodes.join(", ") }),
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
  if (changes.length === 0) return tsBatchFixerT("runtime.noChanges");

  let preview = `${tsBatchFixerT("runtime.previewTitle")}\n`;
  preview += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  preview += `${tsBatchFixerT("runtime.fileLine", { filePath })}\n`;
  preview += `${tsBatchFixerT("runtime.changeCountLine", { count: changes.length })}\n\n`;

  changes.slice(0, 5).forEach((change, idx) => {
    preview +=
      tsBatchFixerT("runtime.previewChangeHeader", {
        index: idx + 1,
        total: changes.length,
        line: change.line,
        errorCode: change.error_code,
      }) + "\n";
    preview += `${tsBatchFixerT("runtime.beforeLine", { before: change.before.trim() })}\n`;
    preview += `${tsBatchFixerT("runtime.afterLine", { after: change.after.trim() })}\n\n`;
  });

  if (changes.length > 5) {
    preview += `${tsBatchFixerT("runtime.moreChanges", { count: changes.length - 5 })}\n`;
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
  let output = `${tsBatchFixerT("runtime.title")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `${tsBatchFixerT("runtime.fileLine", { filePath })}\n`;
  output += `${tsBatchFixerT("runtime.foundFixableErrors", { count: changes.length })}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (dryRun) {
    output += `${tsBatchFixerT("runtime.dryRun")}\n`;
    output += `\n${tsBatchFixerT("runtime.applyHint")}\n`;
  } else {
    output += `${tsBatchFixerT("runtime.applied", { count: changes.length })}\n`;
  }

  return output;
}

// ============================================
// MCP Tool Definition
// ============================================

export const TYPESCRIPT_BATCH_FIXER_TOOL = {
  name: "hev_dev_fix_typescript_batch",
  description: tsBatchFixerDefT("description"),
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: tsBatchFixerDefT("filePath"),
      },
      error_codes: {
        type: "array",
        items: { type: "string" },
        description: tsBatchFixerDefT("errorCodes"),
        default: ["TS2532", "TS18048", "TS2722"],
      },
      fix_strategy: {
        type: "string",
        enum: ["add_guards", "add_assertions", "strict_null_check"],
        description: tsBatchFixerDefT("fixStrategy"),
        default: "add_guards",
      },
      dry_run: {
        type: "boolean",
        description: tsBatchFixerDefT("dryRun"),
        default: true,
      },
      auto_apply: {
        type: "boolean",
        description: tsBatchFixerDefT("autoApply"),
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
      tsBatchFixerDefT("useCases.nullUndefined"),
      tsBatchFixerDefT("useCases.batchCodes"),
      tsBatchFixerDefT("useCases.addGuards"),
    ],
    relatedTools: [
      "hev_dev_typescript_dashboard",
      "hev_dev_typescript_type_helper",
      "hev_fs_backup",
    ],
    agentGuidance: tsBatchFixerDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["typescript", "auto-fix", "batch", "type-safety"],
  },
};
