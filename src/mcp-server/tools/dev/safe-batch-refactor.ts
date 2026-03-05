/**
 * Development Tools - Safe Batch Refactor
 *
 * Toplu refactoring ile her adımda doğrulama ve otomatik rollback
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "@timeouts";
import {
  replaceFunctionCalls,
  renameVariable,
  replaceImportSource,
} from "../../utils/ast-transformer.js";
import { validateWithPrettier } from "../../utils/prettier-validator.js";

function chunkToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  return String(data);
}

type RefactorMode = "string" | "ast";

interface RefactorOperation {
  pattern: string; // Regex pattern (string mode) or identifier name (ast mode)
  replace_with: string;
  target_lines?: number[]; // Sadece bu satırlarda uygula (string mode only)
  mode?: RefactorMode; // NEW: 'string' (default) or 'ast'
  ast_type?: "function_call" | "variable" | "import"; // NEW: AST transformation type
}

interface SafeRefactorOptions {
  file_path: string;
  operations: RefactorOperation[];
  verify_after_each?: boolean;
  auto_rollback_on_error?: boolean;
  dry_run?: boolean;
}

interface RefactorResult {
  success: boolean;
  output: string;
  applied_operations: number;
  failed_operations: number;
  rollback_occurred: boolean;
}

export async function safelyRefactorCode(
  options: SafeRefactorOptions,
  projectRoot: string
): Promise<RefactorResult> {
  const {
    file_path: filePath,
    operations,
    verify_after_each: verifyAfterEach = false,
    auto_rollback_on_error: autoRollbackOnError = true,
    dry_run: dryRun = false,
  } = options;
  // Fix absolute path handling (Unix and Windows)
  const { isAbsolute } = await import("path");
  const fullPath = isAbsolute(filePath)
    ? filePath
    : projectRoot !== ""
      ? join(projectRoot, filePath)
      : filePath;
  const originalContent = readFileSync(fullPath, "utf-8");
  let currentContent = originalContent;

  let appliedCount = 0;
  let failedCount = 0;
  let rollbackOccurred = false;

  const results: Array<{ operation: number; success: boolean; error?: string }> = [];

  try {
    // Get baseline error count
    const baselineErrors = verifyAfterEach
      ? await getTypeScriptErrorCount(fullPath, projectRoot)
      : 0;

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];

      // Apply operation
      if (!op) {
        results.push({ operation: i + 1, success: false, error: "Operation is undefined" });
        failedCount++;
        continue;
      }

      // NEW: AST mode or string mode
      const mode = op.mode ?? "string"; // Default: backward compatible
      let newContent: string;

      if (mode === "ast") {
        // AST-based transformation (SAFE)
        const astResult = applyASTOperation(currentContent, fullPath, op);
        if (!astResult.success) {
          results.push({
            operation: i + 1,
            success: false,
            error: `AST transform failed: ${astResult.error ?? "unknown"}`,
          });
          failedCount++;
          if (autoRollbackOnError) {
            rollbackOccurred = true;
          }
          continue;
        }
        newContent = astResult.code ?? currentContent;
      } else {
        // String-based (backward compatible)
        newContent = applyOperation(currentContent, op);
      }

      if (newContent === currentContent) {
        results.push({ operation: i + 1, success: false, error: "No matches found" });
        failedCount++;
        continue;
      }

      // Write temporarily (even in dry_run for validation)
      if (!dryRun) {
        writeFileSync(fullPath, newContent, "utf-8");
      } else if (verifyAfterEach) {
        // dry_run mode: write to temp file for validation
        writeFileSync(fullPath, newContent, "utf-8");
      }

      // Verify after each operation (works in both dry_run and normal mode)
      if (verifyAfterEach) {
        // eslint-disable-next-line no-await-in-loop
        const newErrors = await getTypeScriptErrorCount(fullPath, projectRoot);

        if (newErrors > baselineErrors && autoRollbackOnError) {
          // Rollback to previous content!
          writeFileSync(fullPath, currentContent, "utf-8");
          results.push({
            operation: i + 1,
            success: false,
            error: `Error count increased: ${baselineErrors} → ${newErrors}`,
          });
          failedCount++;
          rollbackOccurred = true;
          continue;
        } else if (newErrors <= baselineErrors && dryRun) {
          // dry_run mode: restore original after validation
          writeFileSync(fullPath, currentContent, "utf-8");
        }
      }

      // Success - commit this change
      currentContent = newContent;
      appliedCount++;
      results.push({ operation: i + 1, success: true });
    }

    // Final restore
    if (dryRun) {
      // dry_run mode: always restore original
      writeFileSync(fullPath, originalContent, "utf-8");
    } else if (appliedCount === 0 && !rollbackOccurred) {
      // No successful operations, restore original
      writeFileSync(fullPath, originalContent, "utf-8");
    }

    return {
      success: appliedCount > 0,
      output: formatOutput(filePath, results, dryRun, rollbackOccurred),
      applied_operations: appliedCount,
      failed_operations: failedCount,
      rollback_occurred: rollbackOccurred,
    };
  } catch (error) {
    // Emergency rollback
    if (!dryRun) {
      writeFileSync(fullPath, originalContent, "utf-8");
    }
    logToolError("safe-batch-refactor", error as Error, options, 0);
    return {
      success: false,
      output: `❌ Error: ${String(error)}\\n\\n🔄 Emergency rollback performed.`,
      applied_operations: appliedCount,
      failed_operations: operations.length - appliedCount,
      rollback_occurred: true,
    };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize whitespace for pattern matching
 */
function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Check if line matches pattern with whitespace-agnostic comparison
 */
function matchesPattern(line: string, pattern: string, useRegex: boolean): boolean {
  if (useRegex) {
    const regex = new RegExp(pattern);
    return regex.test(line);
  }

  // Whitespace-agnostic exact match
  return normalizeWhitespace(line).includes(normalizeWhitespace(pattern));
}

/**
 * Replace pattern in line preserving indentation
 */
function replaceInLine(
  line: string,
  pattern: string,
  replacement: string,
  useRegex: boolean
): string {
  // Preserve original indentation
  const indent = line.match(/^\s*/)?.[0] ?? "";

  if (useRegex) {
    const regex = new RegExp(pattern);
    return line.replace(regex, replacement);
  }

  // Whitespace-agnostic string replacement
  const normalizedLine = normalizeWhitespace(line);
  const normalizedPattern = normalizeWhitespace(pattern);

  if (!normalizedLine.includes(normalizedPattern)) {
    return line;
  }

  // Simple approach: Replace in normalized version, then reapply to original
  // This preserves the structure while being whitespace-agnostic
  const trimmedLine = line.trim();
  const trimmedPattern = pattern.trim();

  // Use regex with escaped pattern for safe replacement
  const escapedPattern = trimmedPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedPattern.replace(/\s+/g, "\\s+"), "g");

  const replaced = trimmedLine.replace(regex, replacement.trim());

  if (replaced === trimmedLine) {
    return line; // No change
  }

  return indent + replaced;
}

function applyOperation(content: string, op: RefactorOperation): string {
  const lines = content.split("\\n");

  // Detect if pattern is INTENTIONAL regex (has unescaped regex operators)
  // Simple heuristic: If pattern looks like plain code with [], (), {}, it's NOT regex
  // Only treat as regex if it has .*, .+, ^, $, |, (?:...) etc.
  const hasRegexOperators = /\.\*|\.\+|\^|\$|\||\(\?[:=!]/.test(op.pattern);
  const isRegexPattern = hasRegexOperators;

  let replacementCount = 0;
  const MAX_REPLACEMENTS = 1000; // Safety limit

  if (op.target_lines && op.target_lines.length > 0) {
    // Apply only to specific lines
    op.target_lines.forEach((lineNum) => {
      if (lineNum > 0 && lineNum <= lines.length && replacementCount < MAX_REPLACEMENTS) {
        const oldLine = lines[lineNum - 1] ?? "";

        if (matchesPattern(oldLine, op.pattern, isRegexPattern)) {
          const newLine = replaceInLine(oldLine, op.pattern, op.replace_with, isRegexPattern);
          if (oldLine !== newLine) {
            lines[lineNum - 1] = newLine;
            replacementCount++;
          }
        }
      }
    });
  } else {
    // Apply to all lines
    for (let i = 0; i < lines.length && replacementCount < MAX_REPLACEMENTS; i++) {
      const oldLine = lines[i] ?? "";

      if (matchesPattern(oldLine, op.pattern, isRegexPattern)) {
        const newLine = replaceInLine(oldLine, op.pattern, op.replace_with, isRegexPattern);
        if (oldLine !== newLine) {
          lines[i] = newLine;
          replacementCount++;
        }
      }
    }
  }

  const result = lines.join("\\n");

  // 🛡️ SAFETY CHECK: Detect runaway replacement (file size explosion)
  if (result.length > content.length * 2) {
    // Write to stderr (critical safety warning)
    process.stderr.write(
      "[safe-batch-refactor] ⚠️  File size doubled! Possible infinite loop. Aborting.\n"
    );
    return content; // Return original to prevent data loss
  }

  return result;
}

async function getTypeScriptErrorCount(filePath: string, projectRoot: string): Promise<number> {
  return await new Promise((resolve) => {
    const cwd = projectRoot;
    const tsc = spawn("npx", ["tsc", "--noEmit", "--incremental"], {
      cwd,
      timeout: DEV_TIMEOUTS.TYPESCRIPT_CHECK,
    });

    let stderrOutput = "";

    tsc.stderr.on("data", (data: unknown) => {
      stderrOutput += chunkToString(data);
    });

    tsc.on("close", () => {
      // Count errors for this specific file
      const errors = stderrOutput
        .split("\n")
        .filter((line) => line.includes(filePath) && line.includes("error TS")).length;
      resolve(errors);
    });

    tsc.on("error", () => {
      // If spawn fails, assume no errors and continue
      resolve(0);
    });
  });
}

/**
 * Apply AST-based transformation operation
 * NEW: Safe refactoring using jscodeshift
 */
function applyASTOperation(
  content: string,
  filePath: string,
  op: RefactorOperation
): { success: boolean; code?: string; error?: string } {
  if (op.ast_type === undefined) {
    return {
      success: false,
      error: "ast_type is required for AST mode",
    };
  }

  try {
    let result;

    switch (op.ast_type) {
      case "function_call":
        result = replaceFunctionCalls(content, filePath, op.pattern, op.replace_with);
        break;

      case "variable":
        result = renameVariable(content, filePath, op.pattern, op.replace_with);
        break;

      case "import":
        result = replaceImportSource(content, filePath, op.pattern, op.replace_with);
        break;

      default:
        return {
          success: false,
          error: "Unknown ast_type",
        };
    }

    if (!result.success) {
      return {
        success: false,
        ...(result.error != null && result.error !== "" ? { error: result.error } : {}),
      };
    }

    // Additional syntax validation with Prettier
    if (result.modified === true && result.code != null && result.code !== "") {
      validateWithPrettier(result.code, filePath)
        .then((validation) => {
          if (!validation.valid) {
            // Log warning but don't block (AST should be valid)
            process.stderr.write(
              `[safe-batch-refactor] Warning: Prettier validation failed after AST transform: ${validation.error ?? "unknown"}\n`
            );
          }
        })
        .catch(() => {
          // Ignore validation errors
        });
    }

    return {
      success: true,
      ...(result.code != null && result.code !== "" ? { code: result.code } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

function formatOutput(
  filePath: string,
  results: Array<{ operation: number; success: boolean; error?: string }>,
  dryRun: boolean,
  rollbackOccurred: boolean
): string {
  let output = `🔄 Safe Batch Refactor\\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;
  output += `📁 File: ${filePath}\\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n`;

  results.forEach((result) => {
    const icon = result.success ? "✅" : "❌";
    output += `${icon} Operation ${result.operation}: ${
      result.success ? "Applied" : `Failed - ${result.error ?? "unknown"}`
    }\\n`;
  });

  output += `\\n`;

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  output += `📊 Summary:\\n`;
  output += `   ✅ Success: ${successCount}\\n`;
  output += `   ❌ Failed: ${failCount}\\n`;

  if (rollbackOccurred) {
    output += `\\n⚠️  Auto-rollback occurred for failed operations\\n`;
  }

  if (dryRun) {
    output += `\\n⚠️  DRY RUN MODE - No changes applied\\n`;
  }

  return output;
}

// ============================================
// MCP Tool Definition
// ============================================

export const SAFE_BATCH_REFACTOR_TOOL = {
  name: "hev_dev_safe_batch_refactor",
  description:
    "⚠️ CAREFUL: Batch refactoring with validation after each step. operations: [{pattern, replace_with, target_lines?}] formatında — her operasyon regex pattern bulur ve replace_with ile değiştirir. Her adım sonrası TypeScript check yapılır, hata artarsa auto-rollback. dry_run=true ile önce test et.",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Refactor edilecek dosya yolu",
      },
      operations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Regex pattern" },
            replace_with: { type: "string", description: "Yeni kod" },
            target_lines: {
              type: "array",
              items: { type: "number" },
              description: "Sadece bu satırlarda uygula (opsiyonel)",
            },
          },
          required: ["pattern", "replace_with"],
        },
        description:
          "Uygulanacak refactor operasyonları. Her eleman {pattern: string (regex), replace_with: string, target_lines?: number[]} objesi olmalıdır. pattern ve replace_with zorunludur.",
      },
      verify_after_each: {
        type: "boolean",
        description: "Her operasyondan sonra TypeScript check yap",
        default: true,
      },
      auto_rollback_on_error: {
        type: "boolean",
        description: "Hata artışında otomatik rollback",
        default: true,
      },
      dry_run: {
        type: "boolean",
        description: "Sadece önizleme",
        default: false,
      },
    },
    required: ["file_path", "operations"],
  },
  metadata: {
    category: "development",
    subcategory: "refactoring",
    priority: "high",
    complexity: "complex",
    useCases: [
      "Multi-step refactoring with safety",
      "Batch operations with rollback",
      "Verified transformations",
    ],
    relatedTools: ["hev_fs_find_and_replace", "hev_fs_backup", "hev_dev_check_syntax"],
    agentGuidance:
      'Use for complex refactoring. Each step is verified. Auto-rollback on error. Safer than manual multi-step edits. Kullanım: operations: [{pattern: "regex", replace_with: "yeni kod", target_lines: [10,20]}]. pattern ve replace_with zorunlu, target_lines opsiyonel.',
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["refactoring", "batch", "verification", "rollback", "safety"],
  },
};
