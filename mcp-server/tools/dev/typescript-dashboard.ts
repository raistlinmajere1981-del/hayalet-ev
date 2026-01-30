/**
 * Development Tools - TypeScript Error Dashboard
 * 
 * TypeScript hatalarını analiz edip dashboard formatında gösterir
 */

import { execSync } from "child_process";
import fs from "fs";
import { logToolError } from "../../utils/mcp-logger.js";

interface DashboardOptions {
  sort_by?: "count" | "severity" | "file";
  group_by?: "error_code" | "file" | "category";
  show_trend?: boolean;
  limit?: number;
}

interface DashboardResult {
  success: boolean;
  output: string;
  total_errors: number;
  by_error_code: Record<string, number>;
  by_file: Record<string, number>;
  top_files: Array<{ file: string; count: number }>;
  top_errors: Array<{ code: string; count: number; description: string }>;
}

const ERROR_DESCRIPTIONS: Record<string, string> = {
  TS2722: "Cannot invoke possibly undefined",
  TS2532: "Object is possibly undefined",
  TS18048: "Possibly undefined",
  TS2345: "Type mismatch",
  TS2339: "Property does not exist",
  TS2749: "Value used as type",
  TS2304: "Cannot find name",
  TS2322: "Type not assignable",
  TS2305: "Module has no exported member",
  TS2306: "File is not a module",
};

const ERROR_CATEGORIES: Record<string, string> = {
  TS2722: "Undefined Safety",
  TS2532: "Undefined Safety",
  TS18048: "Undefined Safety",
  TS2345: "Type Safety",
  TS2322: "Type Safety",
  TS2339: "Type Safety",
  TS2749: "Type Usage",
  TS2304: "Module/Import",
  TS2305: "Module/Import",
  TS2306: "Module/Import",
};

export async function generateTypescriptDashboard(
  options: DashboardOptions = {},
  projectRoot?: string
): Promise<DashboardResult> {
  const {
    sort_by = "count",
    group_by = "error_code",
    show_trend = false,
    limit = 10,
  } = options;

  try {
    const cwd = projectRoot || process.cwd();

    // Run TypeScript compiler
    const result = execSync("npm run check-types 2>&1 || true", {
      cwd,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Parse errors
    const errors = parseTypescriptErrors(result);

    // Group by error code
    const byErrorCode: Record<string, number> = {};
    const byFile: Record<string, number> = {};

    errors.forEach((err) => {
      byErrorCode[err.code] = (byErrorCode[err.code] || 0) + 1;
      byFile[err.file] = (byFile[err.file] || 0) + 1;
    });

    // Sort and limit
    const topErrors = Object.entries(byErrorCode)
      .map(([code, count]) => ({
        code,
        count,
        description: ERROR_DESCRIPTIONS[code] || "Unknown error",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const topFiles = Object.entries(byFile)
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // Generate output
    const output = formatDashboard({
      total: errors.length,
      topErrors,
      topFiles,
      byErrorCode,
      byFile,
      showTrend: show_trend,
    });

    return {
      success: true,
      output,
      total_errors: errors.length,
      by_error_code: byErrorCode,
      by_file: byFile,
      top_files: topFiles,
      top_errors: topErrors,
    };
  } catch (error) {
    logToolError("typescript-dashboard", error as Error, {});
    return {
      success: false,
      output: `❌ Error: ${error}`,
      total_errors: 0,
      by_error_code: {},
      by_file: {},
      top_files: [],
      top_errors: [],
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function parseTypescriptErrors(
  output: string
): Array<{ file: string; line: number; column: number; code: string; message: string }> {
  const errors: Array<{
    file: string;
    line: number;
    column: number;
    code: string;
    message: string;
  }> = [];

  output.split("\n").forEach((line) => {
    // Parse: src/file.ts(123,45): error TS2532: Object is possibly 'undefined'.
    const match = line.match(
      /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/
    );
    if (match) {
      errors.push({
        file: match[1] || '',
        line: parseInt(match[2] || '0', 10),
        column: parseInt(match[3] || '0', 10),
        code: match[4] || '',
        message: match[5] || '',
      });
    }
  });

  return errors;
}

function formatDashboard(data: {
  total: number;
  topErrors: Array<{ code: string; count: number; description: string }>;
  topFiles: Array<{ file: string; count: number }>;
  byErrorCode: Record<string, number>;
  byFile: Record<string, number>;
  showTrend: boolean;
}): string {
  let output = "";

  // Header
  output += "📊 TypeScript Error Dashboard\n";
  output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  output += `Total: ${data.total} errors\n`;
  output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  // Top Error Codes
  output += "🔴 Top Error Codes:\n";
  data.topErrors.forEach((err, idx) => {
    const percentage = ((err.count / data.total) * 100).toFixed(1);
    const bar = generateBar(err.count, data.total);
    output += `  ${idx + 1}. ${err.code} (${err.description}): ${err.count} errors ${bar} ${percentage}%\n`;
  });
  output += "\n";

  // Top Files
  output += "📁 Top Files:\n";
  data.topFiles.forEach((file, idx) => {
    const shortPath = file.file.replace(process.cwd(), ".");
    output += `  ${idx + 1}. ${shortPath}: ${file.count} errors\n`;
  });
  output += "\n";

  // Category Breakdown
  output += "📋 By Category:\n";
  const byCategory: Record<string, number> = {};
  Object.entries(data.byErrorCode).forEach(([code, count]) => {
    const category = ERROR_CATEGORIES[code] || "Other";
    byCategory[category] = (byCategory[category] || 0) + count;
  });
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      output += `  ${category}: ${count} errors\n`;
    });
  output += "\n";

  // Recommendations
  output += "💡 Recommended Actions:\n";
  if (data.topErrors[0]) {
    const topError = data.topErrors[0];
    output += `  → Focus on ${topError.code} (${topError.description})\n`;
    output += `    ${topError.count} errors in this category\n`;

    // Suggest fix strategy
    if (["TS2722", "TS2532", "TS18048"].includes(topError.code)) {
      output += `\n  🔧 Use: hev_dev_fix_typescript_batch\n`;
      output += `     error_codes: ["${topError.code}"]\n`;
      output += `     fix_strategy: "add_guards"\n`;
    }
  }

  return output;
}

function generateBar(count: number, total: number, width: number = 10): string {
  const percentage = count / total;
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

// ============================================
// MCP Tool Definition
// ============================================

export const TYPESCRIPT_DASHBOARD_TOOL = {
  name: "hev_dev_typescript_dashboard",
  description:
    "TypeScript hatalarını analiz edip dashboard formatında gösterir (error count, top files, categories)",
  inputSchema: {
    type: "object",
    properties: {
      sort_by: {
        type: "string",
        enum: ["count", "severity", "file"],
        description: "Sıralama kriteri",
        default: "count",
      },
      group_by: {
        type: "string",
        enum: ["error_code", "file", "category"],
        description: "Gruplama kriteri",
        default: "error_code",
      },
      show_trend: {
        type: "boolean",
        description: "Trend göster (önceki run'larla karşılaştır)",
        default: false,
      },
      limit: {
        type: "number",
        description: "Gösterilecek maksimum item sayısı",
        default: 10,
      },
    },
  },
};
