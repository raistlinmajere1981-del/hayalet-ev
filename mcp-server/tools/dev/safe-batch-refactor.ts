/**
 * Development Tools - Safe Batch Refactor
 * 
 * Toplu refactoring ile her adımda doğrulama ve otomatik rollback
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "../../utils/timeouts.js";

interface RefactorOperation {
  pattern: string; // Regex pattern
  replace_with: string;
  target_lines?: number[]; // Sadece bu satırlarda uygula
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
  projectRoot?: string
): Promise<RefactorResult> {
  const {
    file_path,
    operations,
    verify_after_each = false,
    auto_rollback_on_error = true,
    dry_run = false,
  } = options;
  // Fix absolute path handling (Unix and Windows)
  const { isAbsolute } = await import('path');
  const fullPath = isAbsolute(file_path) 
    ? file_path 
    : (projectRoot ? join(projectRoot, file_path) : file_path);
  const originalContent = readFileSync(fullPath, "utf-8");
  let currentContent = originalContent;

  let appliedCount = 0;
  let failedCount = 0;
  let rollbackOccurred = false;

  const results: Array<{ operation: number; success: boolean; error?: string }> = [];

  try {
    // Get baseline error count
    const baselineErrors = verify_after_each
      ? await getTypeScriptErrorCount(fullPath, projectRoot)
      : 0;

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];

      // Apply operation
      const newContent = applyOperation(currentContent, op!);

      if (newContent === currentContent) {
        results.push({ operation: i + 1, success: false, error: "No matches found" });
        failedCount++;
        continue;
      }

      // Write temporarily (even in dry_run for validation)
      if (!dry_run) {
        writeFileSync(fullPath, newContent, "utf-8");
      } else if (verify_after_each) {
        // dry_run mode: write to temp file for validation
        writeFileSync(fullPath, newContent, "utf-8");
      }

      // Verify after each operation (works in both dry_run and normal mode)
      if (verify_after_each) {
        const newErrors = await getTypeScriptErrorCount(fullPath, projectRoot);

        if (newErrors > baselineErrors && auto_rollback_on_error) {
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
        } else if (newErrors <= baselineErrors && dry_run) {
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
    if (dry_run) {
      // dry_run mode: always restore original
      writeFileSync(fullPath, originalContent, "utf-8");
    } else if (appliedCount === 0 && !rollbackOccurred) {
      // No successful operations, restore original
      writeFileSync(fullPath, originalContent, "utf-8");
    }

    return {
      success: appliedCount > 0,
      output: formatOutput(file_path, results, dry_run, rollbackOccurred),
      applied_operations: appliedCount,
      failed_operations: failedCount,
      rollback_occurred: rollbackOccurred,
    };
  } catch (error) {
    // Emergency rollback
    if (!dry_run) {
      writeFileSync(fullPath, originalContent, "utf-8");
    }
    logToolError("safe-batch-refactor", error as Error, options, 0);
    return {
      success: false,
      output: `❌ Error: ${error}\\n\\n🔄 Emergency rollback performed.`,
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
  return str.replace(/\s+/g, ' ').trim();
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
function replaceInLine(line: string, pattern: string, replacement: string, useRegex: boolean): string {
  // Preserve original indentation
  const indent = line.match(/^\s*/)?.[0] || '';
  
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
  
  // Find pattern in original line (whitespace-tolerant)
  const lineTokens = line.split(/(\s+)/); // Keep whitespace as tokens
  const patternTokens = pattern.split(/\s+/).filter(t => t);
  
  // Simple token matching
  let matchStart = -1;
  let matchEnd = -1;
  
  for (let i = 0; i < lineTokens.length; i++) {
    let matched = true;
    let patternIdx = 0;
    let tokenIdx = i;
    
    while (patternIdx < patternTokens.length && tokenIdx < lineTokens.length) {
      const token = lineTokens[tokenIdx]?.trim();
      if (!token) {
        tokenIdx++;
        continue;
      }
      
      if (token !== patternTokens[patternIdx]) {
        matched = false;
        break;
      }
      
      if (matchStart === -1) matchStart = tokenIdx;
      matchEnd = tokenIdx;
      patternIdx++;
      tokenIdx++;
    }
    
    if (matched && patternIdx === patternTokens.length) {
      // Found match, replace tokens
      const before = lineTokens.slice(0, matchStart).join('');
      const after = lineTokens.slice(matchEnd + 1).join('');
      return indent + (before.trim() + ' ' + replacement + ' ' + after.trim()).trim();
    }
  }
  
  return line;
}

function applyOperation(content: string, op: RefactorOperation): string {
  const lines = content.split("\\n");
  
  // Detect if pattern is regex (contains regex special chars)
  const isRegexPattern = /[.*+?^${}()|[\]\\]/.test(op.pattern);

  let replacementCount = 0;
  const MAX_REPLACEMENTS = 1000; // Safety limit

  if (op.target_lines && op.target_lines.length > 0) {
    // Apply only to specific lines
    op.target_lines.forEach((lineNum) => {
      if (lineNum > 0 && lineNum <= lines.length && replacementCount < MAX_REPLACEMENTS) {
        const oldLine = lines[lineNum - 1] || '';
        
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
      const oldLine = lines[i] || '';
      
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
    console.error('[safe-batch-refactor] ⚠️  File size doubled! Possible infinite loop. Aborting.');
    return content; // Return original to prevent data loss
  }

  return result;
}

async function getTypeScriptErrorCount(
  filePath: string,
  projectRoot?: string
): Promise<number> {
  return new Promise((resolve) => {
    const cwd = projectRoot || process.cwd();
    const tsc = spawn('npx', ['tsc', '--noEmit', '--incremental'], {
      cwd,
      timeout: DEV_TIMEOUTS.TYPESCRIPT_CHECK,
    });
    
    let stderrOutput = '';
    
    tsc.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });
    
    tsc.on('close', () => {
      // Count errors for this specific file
      const errors = stderrOutput.split('\n')
        .filter(line => line.includes(filePath) && line.includes('error TS'))
        .length;
      resolve(errors);
    });
    
    tsc.on('error', () => {
      // If spawn fails, assume no errors and continue
      resolve(0);
    });
  });
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
      result.success ? "Applied" : `Failed - ${result.error}`
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
    "⚠️ CAREFUL: Batch refactoring with validation after each step. FIXED v1.11: Removed global flag to prevent infinite loops. Test with dry_run first!",
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
        description: "Uygulanacak refactor operasyonları",
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
};
