/**
 * Development Tools - ESLint Dashboard
 *
 * ESLint rule analytics, clustering, and insights
 */

import { execSync } from "child_process";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { logToolError, logToolCall } from "../../utils/mcp-logger.js";
import { createProgress } from "../../utils/progress.js";

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
  top_rules: Array<{
    rule: string;
    count: number;
    severity: string;
    fixable: number;
    description: string;
  }>;
  top_files: Array<{ file: string; errors: number; warnings: number; total: number }>;
  fixable_count: number;
}

interface EslintMessage {
  ruleId: string | null;
  severity: number; // 1=warning, 2=error
  message: string;
  line: number;
  column: number;
  fix?: { range: [number, number]; text: string };
}

interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

function toEslintResults(value: unknown): EslintFileResult[] {
  return Array.isArray(value) ? (value as EslintFileResult[]) : [];
}

function eslintDashT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.eslintDashboard.${key}`, params);
}

function eslintDashDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.eslintDashboard.definition.${key}`, params);
}

// ESLint rule categories
const RULE_CATEGORIES: Record<string, string> = {
  // Code Quality
  "no-unused-vars": "codeQuality",
  "no-console": "codeQuality",
  "no-debugger": "codeQuality",
  "no-unreachable": "codeQuality",
  "no-constant-condition": "codeQuality",

  // Best Practices
  eqeqeq: "bestPractices",
  "no-eval": "bestPractices",
  "no-implied-eval": "bestPractices",
  "no-with": "bestPractices",
  curly: "bestPractices",

  // TypeScript
  "@typescript-eslint/no-explicit-any": "typescript",
  "@typescript-eslint/no-unused-vars": "typescript",
  "@typescript-eslint/explicit-module-boundary-types": "typescript",
  "@typescript-eslint/no-non-null-assertion": "typescript",
  "@typescript-eslint/ban-ts-comment": "typescript",

  // Formatting
  indent: "formatting",
  quotes: "formatting",
  semi: "formatting",
  "comma-dangle": "formatting",
  "no-trailing-spaces": "formatting",

  // Imports
  "import/no-unresolved": "imports",
  "import/named": "imports",
  "import/default": "imports",
  "import/no-duplicates": "imports",
};

const RULE_DESCRIPTIONS: Record<string, string> = {
  "no-unused-vars": "noUnusedVars",
  "no-console": "noConsole",
  "@typescript-eslint/no-explicit-any": "noExplicitAny",
  "@typescript-eslint/no-unused-vars": "noUnusedVarsTs",
  eqeqeq: "eqeqeq",
  "no-debugger": "noDebugger",
  quotes: "quotes",
  semi: "semi",
};

export function generateEslintDashboard(
  options: DashboardOptions = {},
  projectRoot: string
): DashboardResult {
  const {
    pattern = "src/**/*.{js,ts} electron/**/*.{ts,cjs}",
    sort_by: sortBy = "count",
    group_by: _groupBy = "rule",
    limit = 10,
    show_fixable: showFixable = true,
  } = options;

  const progress = createProgress({
    operation: eslintDashT("progress.operation"),
    interval: 3000,
  });

  try {
    const cwd = projectRoot;
    const startTime = Date.now();
    progress.update(0, eslintDashT("progress.running"));

    // Run ESLint with JSON output
    // Split pattern by spaces to handle multiple patterns
    const patterns = pattern.split(/\s+/).filter((p) => p.length > 0);

    // Use shell-safe command construction with NODE_OPTIONS for memory
    // Note: --cache disabled to always show fresh results
    const cmd = `NODE_OPTIONS="--max-old-space-size=4096" npx eslint ${patterns.map((p) => `"${p}"`).join(" ")} --format json`;

    // Debug logging
    logToolCall("hev_dev_eslint_dashboard", { patterns, cmd, cwd });

    let rawOutput: string;
    try {
      rawOutput = execSync(cmd, {
        cwd,
        encoding: "utf-8",
        timeout: 300_000, // 5 minutes for type-aware linting
        maxBuffer: 20 * 1024 * 1024, // 20MB buffer
        shell: "/bin/bash", // Explicitly use bash for glob expansion
      });
      logToolCall("hev_dev_eslint_dashboard", { outputLength: rawOutput.length });
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; code?: string };

      // If timeout or no output, return empty result with message
      if (error.code === "ETIMEDOUT" || error.stdout === undefined || error.stdout.length === 0) {
        progress.stop();
        return {
          success: false,
          output: eslintDashT("runtime.timeoutOrNoOutput"),
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

      logToolError("hev_dev_eslint_dashboard", err as Error, {
        stdoutLength: error.stdout.length,
        hasStdout: error.stdout.length > 0,
        code: error.code,
      });
      rawOutput = error.stdout.length > 0 ? error.stdout : "[]";
    }

    progress.update(50, eslintDashT("progress.analyzing"));

    // Parse JSON output with error handling
    let results: EslintFileResult[] = [];
    try {
      const parsed: unknown = JSON.parse(rawOutput.length > 0 ? rawOutput : "[]");
      results = toEslintResults(parsed);
    } catch (parseErr) {
      logToolError("hev_dev_eslint_dashboard", parseErr as Error, {
        message: "Failed to parse ESLint JSON output",
        outputPreview: rawOutput.substring(0, 200),
      });
      progress.stop();
      return {
        success: false,
        output: eslintDashT("runtime.parseFailed", {
          preview: `${rawOutput.substring(0, 300)}...`,
        }),
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

    // Aggregate statistics
    const byRule: Record<
      string,
      {
        count: number;
        severity: string;
        fixable: number;
        locations: Array<{ file: string; lines: number[] }>;
      }
    > = {};
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
        const ruleId = msg.ruleId ?? "(no-rule)";
        const severity = msg.severity === 2 ? "error" : "warning";
        const hasFixable = msg.fix ? 1 : 0;

        byRule[ruleId] ??= { count: 0, severity, fixable: 0, locations: [] };
        const ruleData = byRule[ruleId];
        ruleData.count++;
        ruleData.fixable += hasFixable;

        const existingLocation = ruleData.locations.find((loc) => loc.file === filePath);
        if (existingLocation) {
          existingLocation.lines.push(msg.line);
        } else {
          ruleData.locations.push({ file: filePath, lines: [msg.line] });
        }

        if (hasFixable !== 0) fixableCount++;

        const category = RULE_CATEGORIES[ruleId] ?? "other";
        byCategory[category] = (byCategory[category] ?? 0) + 1;
      });
    });

    progress.update(75, eslintDashT("progress.building"));

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    const allFiles = results.length;
    const filesWithErrors = results.filter((r) => r.messages.length > 0).length;

    const allFolders = new Set(results.map((r) => r.filePath.split("/").slice(0, -1).join("/")))
      .size;
    const foldersWithErrors = new Set(
      results
        .filter((r) => r.messages.length > 0)
        .map((r) => r.filePath.split("/").slice(0, -1).join("/"))
    ).size;

    const topRules = Object.entries(byRule)
      .map(([rule, stats]) => ({
        rule,
        count: stats.count,
        severity: stats.severity,
        fixable: stats.fixable,
        description: eslintDashT(
          `ruleDescriptions.${RULE_DESCRIPTIONS[rule] ?? "fallback"}`,
          RULE_DESCRIPTIONS[rule] !== undefined ? undefined : { rule }
        ),
        locations: stats.locations,
      }))
      .sort((a, b) => {
        if (sortBy === "count") return b.count - a.count;
        if (sortBy === "severity") return a.severity === "error" ? -1 : 1;
        return 0;
      })
      .slice(0, limit);

    const topFiles = Object.entries(byFile)
      .map(([file, stats]) => ({
        file,
        errors: stats.errors,
        warnings: stats.warnings,
        total: stats.errors + stats.warnings,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    const output = formatDashboard({
      totalProblems,
      totalErrors,
      totalWarnings,
      topRules,
      topFiles,
      byCategory,
      fixableCount,
      showFixable,
      executionTime,
      allFiles,
      filesWithErrors,
      allFolders,
      foldersWithErrors,
    });

    progress.done(eslintDashT("progress.completed", { totalProblems }));

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
      output: eslintDashT("runtime.error", { message: (error as Error).message }),
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
  topRules: Array<{
    rule: string;
    count: number;
    severity: string;
    fixable: number;
    description: string;
    locations: Array<{ file: string; lines: number[] }>;
  }>;
  topFiles: Array<{ file: string; errors: number; warnings: number; total: number }>;
  byCategory: Record<string, number>;
  fixableCount: number;
  showFixable: boolean;
  executionTime?: string;
  allFiles?: number;
  filesWithErrors?: number;
  allFolders?: number;
  foldersWithErrors?: number;
}): string {
  const {
    totalProblems,
    totalErrors,
    totalWarnings,
    topRules,
    topFiles,
    byCategory,
    fixableCount,
    showFixable,
  } = data;

  // Always show stats if provided (use !== undefined to allow 0 values)
  const statsLine =
    data.executionTime !== undefined && data.allFiles !== undefined && data.allFolders !== undefined
      ? eslintDashT("runtime.statsLine", {
          executionTime: data.executionTime,
          allFolders: data.allFolders,
          foldersWithErrors: data.foldersWithErrors ?? 0,
          allFiles: data.allFiles,
          filesWithErrors: data.filesWithErrors ?? 0,
        }) + "\n"
      : "";

  // Debug line for testing
  // const debugLine = `[DEBUG] executionTime=${data.executionTime}, allFiles=${data.allFiles}, allFolders=${data.allFolders}\n`;

  let output = `\n${eslintDashT("runtime.title")}\n`;
  output += "━".repeat(60) + "\n";
  output += eslintDashT("runtime.summary", { totalProblems, totalErrors, totalWarnings }) + "\n";
  if (statsLine !== "") output += statsLine;

  if (showFixable && fixableCount > 0) {
    output += eslintDashT("runtime.fixableSummary", { fixableCount }) + "\n";
  }

  output += "━".repeat(60) + "\n\n";

  // Top rules
  output += `${eslintDashT("runtime.topRulesTitle")}\n`;
  topRules.forEach((rule, i) => {
    const icon = rule.severity === "error" ? "🔴" : "🟡";
    const fixableIcon = rule.fixable > 0 ? " ⚡" : "";
    const percentage = totalProblems > 0 ? ((rule.count / totalProblems) * 100).toFixed(1) : "0.0";
    const topRuleCount = Math.max(topRules[0]?.count ?? 1, 1);
    const barLen = Math.min(10, Math.max(0, Math.ceil((rule.count / topRuleCount) * 10)));
    const bar = "█".repeat(barLen);
    const barPad = "░".repeat(10 - barLen);

    output +=
      eslintDashT("runtime.ruleLine", {
        index: i + 1,
        icon,
        rule: rule.rule,
        fixableIcon,
        count: rule.count,
        bar: `${bar}${barPad}`,
        percentage,
      }) + "\n";
    output += eslintDashT("runtime.ruleDescriptionLine", { description: rule.description }) + "\n";

    // Show top 3 files with this rule
    const topLocations = rule.locations.sort((a, b) => b.lines.length - a.lines.length).slice(0, 3);

    if (topLocations.length > 0) {
      output += `${eslintDashT("runtime.topFilesInlineTitle")}\n`;
      topLocations.forEach((loc) => {
        const shortPath = loc.file.length > 50 ? "..." + loc.file.slice(-47) : loc.file;
        const linePreview =
          loc.lines.length > 5
            ? eslintDashT("runtime.linePreviewMore", {
                lines: loc.lines.slice(0, 5).join(","),
                total: loc.lines.length,
              })
            : eslintDashT("runtime.linePreview", {
                lines: loc.lines.join(","),
              });
        output += eslintDashT("runtime.topLocationLine", { shortPath, linePreview }) + "\n";
      });
    }
  });

  // Top files
  output += `\n${eslintDashT("runtime.topFilesTitle")}\n`;
  topFiles.forEach((file, i) => {
    const shortPath = file.file.length > 60 ? "..." + file.file.slice(-57) : file.file;
    output += eslintDashT("runtime.topFileLine", { index: i + 1, shortPath }) + "\n";
    output +=
      eslintDashT("runtime.topFileSummary", {
        errors: file.errors,
        warnings: file.warnings,
      }) + "\n";
  });

  // By category
  output += `\n${eslintDashT("runtime.byCategoryTitle")}\n`;
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const percentage = totalProblems > 0 ? ((count / totalProblems) * 100).toFixed(1) : "0.0";
      output +=
        eslintDashT("runtime.categoryLine", {
          category: eslintDashT(`categories.${category}`),
          count,
          percentage,
        }) + "\n";
    });

  // Recommendations
  output += `\n${eslintDashT("runtime.recommendedActionsTitle")}\n`;
  if (topRules.length > 0) {
    const topRule = topRules[0];
    if (topRule) {
      output += eslintDashT("runtime.focusRule", { rule: topRule.rule }) + "\n";
      output += eslintDashT("runtime.occurrences", { count: topRule.count }) + "\n";

      if (topRule.fixable > 0) {
        output += eslintDashT("runtime.fixableHint", { fixable: topRule.fixable }) + "\n";
      }
    }
  }

  return output;
}

export const ESLINT_DASHBOARD_TOOL = {
  name: "hev_dev_eslint_dashboard",
  description: eslintDashDefT("description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string" as const,
        description: eslintDashDefT("pattern"),
        default: "src/**/*.{js,ts} electron/**/*.{ts,cjs}",
      },
      sort_by: {
        type: "string" as const,
        enum: ["count", "severity", "file"],
        description: eslintDashDefT("sortBy"),
        default: "count",
      },
      group_by: {
        type: "string" as const,
        enum: ["rule", "file", "category"],
        description: eslintDashDefT("groupBy"),
        default: "rule",
      },
      limit: {
        type: "number" as const,
        description: eslintDashDefT("limit"),
        default: 10,
      },
      show_fixable: {
        type: "boolean" as const,
        description: eslintDashDefT("showFixable"),
        default: true,
      },
    },
  },
  metadata: {
    category: "development",
    subcategory: "eslint",
    priority: "high",
    complexity: "medium",
    useCases: [
      eslintDashDefT("useCases.byRule"),
      eslintDashDefT("useCases.commonViolations"),
      eslintDashDefT("useCases.prioritize"),
    ],
    relatedTools: ["hev_dev_lint_project"],
    agentGuidance: eslintDashDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["eslint", "analytics", "dashboard", "rule-analysis"],
  },
};
