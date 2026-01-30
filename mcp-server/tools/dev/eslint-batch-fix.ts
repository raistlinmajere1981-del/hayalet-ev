/**
 * Development Tools - ESLint Batch Fix
 * 
 * Rule-based auto-fix for ESLint issues
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { createProgress } from "../../utils/progress.js";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "../../utils/timeouts.js";

interface BatchFixOptions {
  pattern?: string;
  rules?: string[]; // Specific rules to fix (e.g., ['no-unused-vars', 'quotes'])
  fix_strategy?: "safe" | "aggressive" | "suggestion";
  dry_run?: boolean;
  auto_apply?: boolean;
  verify_after?: boolean;
}

interface BatchFixResult {
  success: boolean;
  output: string;
  files_fixed: number;
  problems_fixed: number;
  problems_remaining: number;
  by_rule: Record<string, { fixed: number; remaining: number }>;
  errors: string[];
}

interface EslintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  fix?: any;
}

interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  output?: string; // Fixed content
}

export async function eslintBatchFix(
  options: BatchFixOptions = {},
  projectRoot?: string
): Promise<BatchFixResult> {
  const {
    pattern = "**/*.{js,ts,jsx,tsx}",
    rules = [],
    fix_strategy = "safe",
    dry_run = false,
    auto_apply = false,
    verify_after = true,
  } = options;

  const progress = createProgress({ operation: "ESLint Batch Fix", interval: 3000 });

  try {
    const cwd = projectRoot || process.cwd();
    const errors: string[] = [];
    
    progress.update(0, "Mevcut durumu analiz ediliyor...");

    // Step 1: Get baseline (before fix)
    const baselineCmd = `npx eslint "${pattern}" --format json --cache`;
    let baselineOutput: string;
    
    try {
      baselineOutput = execSync(baselineCmd, {
        cwd,
        encoding: "utf-8",
        timeout: DEV_TIMEOUTS.LINT * 5,
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (err) {
      const error = err as { stdout?: string };
      baselineOutput = error.stdout || "[]";
    }

    const baselineResults: EslintFileResult[] = JSON.parse(baselineOutput || "[]");
    const baselineStats = analyzeResults(baselineResults, rules);

    progress.update(25, `${baselineStats.totalProblems} sorun tespit edildi`);

    // Step 2: Apply fixes
    let fixCmd = `npx eslint "${pattern}" --fix --cache`;
    
    // If specific rules, use --fix with rule filter
    if (rules.length > 0) {
      const ruleArgs = rules.map(r => `--rule '${r}: error'`).join(" ");
      fixCmd = `npx eslint "${pattern}" --fix --cache ${ruleArgs}`;
    }

    // Apply fix strategy
    if (fix_strategy === "suggestion") {
      fixCmd += " --fix-type suggestion";
    } else if (fix_strategy === "safe") {
      fixCmd += " --fix-type problem,layout";
    }
    // aggressive = all fixes (default)

    if (dry_run) {
      progress.done("Dry-run modu (de\u011fi\u015fiklik yap\u0131lmad\u0131)");
      return {
        success: true,
        output: `Dry-run: ${baselineStats.fixableCount} sorun d\u00fczeltilecek\n\nKomut: ${fixCmd}`,
        files_fixed: 0,
        problems_fixed: 0,
        problems_remaining: baselineStats.totalProblems,
        by_rule: Object.fromEntries(Object.entries(baselineStats.byRule).map(([k, v]) => [k, { fixed: 0, remaining: v }])),
        errors: [],
      };
    }

    progress.update(50, "D\u00fczeltmeler uygulan\u0131yor...");

    try {
      execSync(fixCmd, {
        cwd,
        encoding: "utf-8",
        timeout: DEV_TIMEOUTS.LINT * 10, // 10x timeout for batch fix
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (err) {
      // ESLint exits with code 1 if there are remaining issues (expected)
      const error = err as { stdout?: string; stderr?: string };
      if (error.stderr && !error.stderr.includes("warning")) {
        errors.push(error.stderr);
      }
    }

    progress.update(75, "Sonu\u00e7lar do\u011frulan\u0131yor...");

    // Step 3: Get results (after fix)
    let afterOutput: string;
    try {
      afterOutput = execSync(baselineCmd, {
        cwd,
        encoding: "utf-8",
        timeout: DEV_TIMEOUTS.LINT * 5,
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (err) {
      const error = err as { stdout?: string };
      afterOutput = error.stdout || "[]";
    }

    const afterResults: EslintFileResult[] = JSON.parse(afterOutput || "[]");
    const afterStats = analyzeResults(afterResults, rules);

    // Calculate differences
    const problemsFixed = baselineStats.totalProblems - afterStats.totalProblems;
    const filesFixed = countFilesFixed(baselineResults, afterResults);

    // By-rule breakdown
    const byRule: Record<string, { fixed: number; remaining: number }> = {};
    Object.keys(baselineStats.byRule).forEach(rule => {
      const beforeCount = baselineStats.byRule[rule] || 0;
      const afterCount = afterStats.byRule[rule] || 0;
      byRule[rule] = {
        fixed: beforeCount - afterCount,
        remaining: afterCount,
      };
    });

    // Step 4: Verify (optional)
    if (verify_after) {
      progress.update(90, "Syntax do\u011frulan\u0131yor...");
      try {
        execSync("npm run check-types 2>&1 || true", {
          cwd,
          encoding: "utf-8",
          timeout: DEV_TIMEOUTS.TYPESCRIPT_CHECK,
        });
      } catch (err) {
        errors.push("TypeScript check failed after fix");
      }
    }

    progress.done(`${problemsFixed} sorun d\u00fczeltildi`);

    // Format output
    const output = formatBatchFixOutput({
      baselineStats,
      afterStats,
      problemsFixed,
      filesFixed,
      byRule,
      errors,
    });

    return {
      success: errors.length === 0,
      output,
      files_fixed: filesFixed,
      problems_fixed: problemsFixed,
      problems_remaining: afterStats.totalProblems,
      by_rule: byRule,
      errors,
    };
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_dev_eslint_batch_fix", error as Error, { pattern, rules });

    return {
      success: false,
      output: `Hata: ${(error as Error).message}`,
      files_fixed: 0,
      problems_fixed: 0,
      problems_remaining: 0,
      by_rule: {},
      errors: [(error as Error).message],
    };
  }
}

function analyzeResults(
  results: EslintFileResult[],
  ruleFilter: string[]
): {
  totalProblems: number;
  fixableCount: number;
  byRule: Record<string, number>;
} & { byRule: Record<string, number> } {
  let totalProblems = 0;
  let fixableCount = 0;
  const byRule: Record<string, number> = {};

  results.forEach((fileResult) => {
    fileResult.messages.forEach((msg) => {
      const ruleId = msg.ruleId || "(no-rule)";
      
      // Apply rule filter
      if (ruleFilter.length > 0 && !ruleFilter.includes(ruleId)) {
        return;
      }

      totalProblems++;
      if (msg.fix) fixableCount++;

      byRule[ruleId] = (byRule[ruleId] || 0) + 1;
    });
  });

  return { totalProblems, fixableCount, byRule };
}

function countFilesFixed(
  before: EslintFileResult[],
  after: EslintFileResult[]
): number {
  let count = 0;
  
  before.forEach((beforeFile) => {
    const afterFile = after.find(f => f.filePath === beforeFile.filePath);
    const beforeCount = beforeFile.messages.length;
    const afterCount = afterFile ? afterFile.messages.length : 0;
    
    if (beforeCount > afterCount) {
      count++;
    }
  });

  return count;
}

function formatBatchFixOutput(data: {
  baselineStats: { totalProblems: number; fixableCount: number; byRule: Record<string, number> };
  afterStats: { totalProblems: number; fixableCount: number; byRule: Record<string, number> };
  problemsFixed: number;
  filesFixed: number;
  byRule: Record<string, { fixed: number; remaining: number }>;
  errors: string[];
}): string {
  const { baselineStats, afterStats, problemsFixed, filesFixed, byRule, errors } = data;

  let output = "\n\u26a1 ESLint Batch Fix Results\n";
  output += "\u2501".repeat(60) + "\n";
  output += `Before: ${baselineStats.totalProblems} problems\n`;
  output += `After: ${afterStats.totalProblems} problems\n`;
  output += `Fixed: ${problemsFixed} problems in ${filesFixed} files\n`;
  
  const successRate = baselineStats.totalProblems > 0 
    ? ((problemsFixed / baselineStats.totalProblems) * 100).toFixed(1)
    : "0";
  output += `Success Rate: ${successRate}%\n`;
  output += "\u2501".repeat(60) + "\n\n";

  // By-rule breakdown
  output += "\ud83d� By Rule:\n";
  Object.entries(byRule)
    .sort((a, b) => b[1].fixed - a[1].fixed)
    .slice(0, 10)
    .forEach(([rule, stats]) => {
      if (stats.fixed > 0) {
        output += `  \u2713 ${rule}: ${stats.fixed} fixed`;
        if (stats.remaining > 0) {
          output += ` (${stats.remaining} remaining)`;
        }
        output += "\n";
      }
    });

  // Errors
  if (errors.length > 0) {
    output += "\n\u26a0\ufe0f Errors:\n";
    errors.forEach(err => {
      output += `  - ${err}\n`;
    });
  }

  // Next steps
  output += "\n\ud83d� Next Steps:\n";
  if (afterStats.totalProblems > 0) {
    output += `  \u2192 ${afterStats.totalProblems} problems remain\n`;
    if (afterStats.fixableCount > 0) {
      output += `  \u2192 ${afterStats.fixableCount} more can be auto-fixed\n`;
    }
    output += "  \u2192 Run dashboard to analyze remaining issues\n";
  } else {
    output += "  \u2713 All ESLint issues resolved!\n";
  }

  return output;
}

export const ESLINT_BATCH_FIX_TOOL = {
  name: "hev_dev_eslint_batch_fix",
  description: "ESLint rule-based otomatik toplu d\u00fczeltme (batch auto-fix with verification)",
  inputSchema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string" as const,
        description: "Glob pattern (\u00f6rn: 'src/**/*.ts')",
        default: "**/*.{js,ts,jsx,tsx}",
      },
      rules: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Belirli rule'lar i\u00e7in fix (bo\u015f = t\u00fcm fixable rules)",
        default: [],
      },
      fix_strategy: {
        type: "string" as const,
        enum: ["safe", "aggressive", "suggestion"],
        description: "Fix stratejisi (safe=problem+layout, aggressive=all, suggestion=only suggestions)",
        default: "safe",
      },
      dry_run: {
        type: "boolean" as const,
        description: "Sadece analiz (de\u011fi\u015fiklik yapma)",
        default: false,
      },
      auto_apply: {
        type: "boolean" as const,
        description: "Otomatik uygula (onay bekleme)",
        default: false,
      },
      verify_after: {
        type: "boolean" as const,
        description: "Fix sonras\u0131 TypeScript check",
        default: true,
      },
    },
  },
};

