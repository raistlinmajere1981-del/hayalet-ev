/**
 * Development Tools - ESLint Dashboard
 * 
 * ESLint rule analytics, clustering, and insights
 */

import { execSync } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";
import { createProgress } from "../../utils/progress.js";
import { DEV_TIMEOUTS } from "../../utils/timeouts.js";

interface DashboardOptions {
  pattern?: string;
  sort_by?: "count" | "severity" | "file";
  group_by?: "rule" | "file" | "category";
  limit?: number;
  show_fixable?: boolean;
}

interface DashboardResult {
  success: boolean;
  output: string;
  total_problems: number;
  total_errors: number;
  total_warnings: number;
  by_rule: Record<string, { count: number; severity: string; fixable: number }>;
  by_file: Record<string, { errors: number; warnings: number }>;
  by_category: Record<string, number>;
  top_rules: Array<{ rule: string; count: number; severity: string; fixable: number; description: string }>;
  top_files: Array<{ file: string; errors: number; warnings: number; total: number }>;
  fixable_count: number;
}

interface EslintMessage {
  ruleId: string | null;
  severity: number; // 1=warning, 2=error
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
}

// ESLint rule categories
const RULE_CATEGORIES: Record<string, string> = {
  // Code Quality
  "no-unused-vars": "Code Quality",
  "no-console": "Code Quality",
  "no-debugger": "Code Quality",
  "no-unreachable": "Code Quality",
  "no-constant-condition": "Code Quality",
  
  // Best Practices
  "eqeqeq": "Best Practices",
  "no-eval": "Best Practices",
  "no-implied-eval": "Best Practices",
  "no-with": "Best Practices",
  "curly": "Best Practices",
  
  // TypeScript
  "@typescript-eslint/no-explicit-any": "TypeScript",
  "@typescript-eslint/no-unused-vars": "TypeScript",
  "@typescript-eslint/explicit-module-boundary-types": "TypeScript",
  "@typescript-eslint/no-non-null-assertion": "TypeScript",
  "@typescript-eslint/ban-ts-comment": "TypeScript",
  
  // Formatting
  "indent": "Formatting",
  "quotes": "Formatting",
  "semi": "Formatting",
  "comma-dangle": "Formatting",
  "no-trailing-spaces": "Formatting",
  
  // Imports
  "import/no-unresolved": "Imports",
  "import/named": "Imports",
  "import/default": "Imports",
  "import/no-duplicates": "Imports",
};

const RULE_DESCRIPTIONS: Record<string, string> = {
  "no-unused-vars": "Unused variables",
  "no-console": "Console statements",
  "@typescript-eslint/no-explicit-any": "Explicit any type",
  "@typescript-eslint/no-unused-vars": "Unused variables (TS)",
  "eqeqeq": "Use === instead of ==",
  "no-debugger": "Debugger statements",
  "quotes": "Quote style",
  "semi": "Semicolon usage",
};

export async function generateEslintDashboard(
  options: DashboardOptions = {},
  projectRoot?: string
): Promise<DashboardResult> {
  const {
    pattern = "**/*.{js,ts,jsx,tsx}",
    sort_by = "count",
    group_by = "rule",
    limit = 10,
    show_fixable = true,
  } = options;

  const progress = createProgress({ operation: "ESLint Dashboard", interval: 3000 });

  try {
    const cwd = projectRoot || process.cwd();
    progress.update(0, "ESLint çalıştırılıyor...");

    // Run ESLint with JSON output
    const cmd = `npx eslint "${pattern}" --format json --cache`;
    
    let rawOutput: string;
    try {
      rawOutput = execSync(cmd, {
        cwd,
        encoding: "utf-8",
        timeout: DEV_TIMEOUTS.LINT * 5,
        maxBuffer: 20 * 1024 * 1024, // 20MB buffer
      });
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string };
      rawOutput = error.stdout || "[]";
    }

    progress.update(50, "Sonuçlar analiz ediliyor...");

    // Parse JSON output
    const results: EslintFileResult[] = JSON.parse(rawOutput || "[]");

    // Aggregate statistics
    const byRule: Record<string, { count: number; severity: string; fixable: number }> = {};
    const byFile: Record<string, { errors: number; warnings: number }> = {};
    const byCategory: Record<string, number> = {};

    let totalProblems = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    let fixableCount = 0;

    results.forEach((fileResult) => {
      const { filePath, messages, errorCount, warningCount } = fileResult;

      // Skip files with no issues
      if (messages.length === 0) return;

      // Track by file
      byFile[filePath] = {
        errors: errorCount,
        warnings: warningCount,
      };

      totalErrors += errorCount;
      totalWarnings += warningCount;
      totalProblems += messages.length;

      // Track by rule
      messages.forEach((msg) => {
        const ruleId = msg.ruleId || "(no-rule)";
        const severity = msg.severity === 2 ? "error" : "warning";
        const hasFixable = msg.fix ? 1 : 0;

        if (!byRule[ruleId]) {
          byRule[ruleId] = { count: 0, severity, fixable: 0 };
        }
        byRule[ruleId]!.count++;
        byRule[ruleId]!.fixable += hasFixable;

        if (hasFixable) fixableCount++;

        // Track by category
        const category = RULE_CATEGORIES[ruleId] || "Other";
        byCategory[category] = (byCategory[category] || 0) + 1;
      });
    });

    progress.update(75, "Dashboard oluşturuluyor...");

    // Sort and limit top rules
    const topRules = Object.entries(byRule)
      .map(([rule, stats]) => ({
        rule,
        count: stats.count,
        severity: stats.severity,
        fixable: stats.fixable,
        description: RULE_DESCRIPTIONS[rule] || rule,
      }))
      .sort((a, b) => {
        if (sort_by === "count") return b.count - a.count;
        if (sort_by === "severity") return a.severity === "error" ? -1 : 1;
        return 0;
      })
      .slice(0, limit);

    // Sort and limit top files
    const topFiles = Object.entries(byFile)
      .map(([file, stats]) => ({
        file,
        errors: stats.errors,
        warnings: stats.warnings,
        total: stats.errors + stats.warnings,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    // Generate formatted output
    const output = formatDashboard({
      totalProblems,
      totalErrors,
      totalWarnings,
      topRules,
      topFiles,
      byCategory,
      fixableCount,
      show_fixable,
    });

    progress.done(`${totalProblems} sorun analiz edildi`);

    return {
      success: true,
      output,
      total_problems: totalProblems,
      total_errors: totalErrors,
      total_warnings: totalWarnings,
      by_rule: byRule,
      by_file: byFile,
      by_category: byCategory,
      top_rules: topRules,
      top_files: topFiles,
      fixable_count: fixableCount,
    };
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_dev_eslint_dashboard", error as Error, { pattern });

    return {
      success: false,
      output: `Hata: ${(error as Error).message}`,
      total_problems: 0,
      total_errors: 0,
      total_warnings: 0,
      by_rule: {},
      by_file: {},
      by_category: {},
      top_rules: [],
      top_files: [],
      fixable_count: 0,
    };
  }
}

function formatDashboard(data: {
  totalProblems: number;
  totalErrors: number;
  totalWarnings: number;
  topRules: Array<{ rule: string; count: number; severity: string; fixable: number; description: string }>;
  topFiles: Array<{ file: string; errors: number; warnings: number; total: number }>;
  byCategory: Record<string, number>;
  fixableCount: number;
  show_fixable: boolean;
}): string {
  const {
    totalProblems,
    totalErrors,
    totalWarnings,
    topRules,
    topFiles,
    byCategory,
    fixableCount,
    show_fixable,
  } = data;

  let output = "\n📊 ESLint Dashboard\n";
  output += "━".repeat(60) + "\n";
  output += `Total: ${totalProblems} problems (${totalErrors} errors, ${totalWarnings} warnings)\n`;
  
  if (show_fixable && fixableCount > 0) {
    output += `⚡ ${fixableCount} problems can be auto-fixed\n`;
  }
  
  output += "━".repeat(60) + "\n\n";

  // Top rules
  output += "🔴 Top ESLint Rules:\n";
  topRules.forEach((rule, i) => {
    const icon = rule.severity === "error" ? "🔴" : "🟡";
    const fixableIcon = rule.fixable > 0 ? " ⚡" : "";
    const percentage = ((rule.count / totalProblems) * 100).toFixed(1);
    const bar = "█".repeat(Math.ceil((rule.count / topRules[0]!.count) * 10));
    const barPad = "░".repeat(10 - Math.ceil((rule.count / topRules[0]!.count) * 10));
    
    output += `  ${i + 1}. ${icon} ${rule.rule}${fixableIcon}: ${rule.count} ${bar}${barPad} ${percentage}%\n`;
    output += `     ${rule.description}\n`;
  });

  // Top files
  output += "\n📁 Top Files:\n";
  topFiles.forEach((file, i) => {
    const shortPath = file.file.length > 60 ? "..." + file.file.slice(-57) : file.file;
    output += `  ${i + 1}. ${shortPath}\n`;
    output += `     🔴 ${file.errors} errors, 🟡 ${file.warnings} warnings\n`;
  });

  // By category
  output += "\n📋 By Category:\n";
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const percentage = ((count / totalProblems) * 100).toFixed(1);
      output += `  ${category}: ${count} (${percentage}%)\n`;
    });

  // Recommendations
  output += "\n💡 Recommended Actions:\n";
  if (topRules.length > 0) {
    const topRule = topRules[0]!;
    output += `  → Focus on '${topRule.rule}'\n`;
    output += `    ${topRule.count} occurrences in codebase\n`;
    
    if (topRule.fixable > 0) {
      output += `    ⚡ ${topRule.fixable} can be auto-fixed with --fix\n`;
    }
  }

  return output;
}

export const ESLINT_DASHBOARD_TOOL = {
  name: "hev_dev_eslint_dashboard",
  description: "ESLint hatalarını analiz edip dashboard formatında gösterir (rule analytics, clustering)",
  inputSchema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string" as const,
        description: "Glob pattern (örn: 'src/**/*.ts')",
        default: "**/*.{js,ts,jsx,tsx}",
      },
      sort_by: {
        type: "string" as const,
        enum: ["count", "severity", "file"],
        description: "Sıralama kriteri",
        default: "count",
      },
      group_by: {
        type: "string" as const,
        enum: ["rule", "file", "category"],
        description: "Gruplama kriteri",
        default: "rule",
      },
      limit: {
        type: "number" as const,
        description: "Gösterilecek maksimum item sayısı",
        default: 10,
      },
      show_fixable: {
        type: "boolean" as const,
        description: "Otomatik düzeltilecekleri göster",
        default: true,
      },
    },
  },
};

