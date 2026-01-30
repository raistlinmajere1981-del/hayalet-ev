/**
 * Development Tools - ESLint Project
 * 
 * Batch ESLint runner with glob pattern support
 */

import { execSync } from "child_process";
// import { globSync } from "glob";
import { createProgress } from "../../utils/progress.js";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "../../utils/timeouts.js";

interface LintProjectOptions {
  pattern?: string;
  fix?: boolean;
  max_warnings?: number;
  cache?: boolean;
  format?: "stylish" | "compact" | "json" | "codeframe";
}

interface LintProjectResult {
  success: boolean;
  output: string;
  error_count: number;
  warning_count: number;
  fixable_error_count: number;
  fixable_warning_count: number;
  files_checked: number;
  files_with_issues: number;
}

export async function lintProject(
  options: LintProjectOptions = {},
  projectRoot?: string
): Promise<LintProjectResult> {
  const {
    pattern = "**/*.{js,ts,jsx,tsx}",
    fix = false,
    max_warnings = -1,
    cache = true,
    format = "stylish",
  } = options;

  const progress = createProgress({ operation: "ESLint Project", interval: 5000 });

  try {
    const cwd = projectRoot || process.cwd();
    progress.update(0, "Dosyalar taranıyor...");

    // Build ESLint command
    const fixArg = fix ? " --fix" : "";
    const cacheArg = cache ? " --cache" : "";
    const maxWarningsArg = max_warnings >= 0 ? ` --max-warnings ${max_warnings}` : "";
    const formatArg = ` --format ${format}`;
    
    const cmd = `npx eslint "${pattern}"${formatArg}${cacheArg}${fixArg}${maxWarningsArg}`;
    
    progress.update(25, "ESLint çalıştırılıyor...");

    try {
      const output = execSync(cmd, { 
        cwd, 
        encoding: "utf-8", 
        timeout: DEV_TIMEOUTS.LINT * 5, // 5x timeout for project-wide
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      
      progress.done("✓ Hata bulunamadı");
      
      return {
        success: true,
        output: output || "✓ Tüm dosyalar temiz",
        error_count: 0,
        warning_count: 0,
        fixable_error_count: 0,
        fixable_warning_count: 0,
        files_checked: countFilesFromOutput(output),
        files_with_issues: 0,
      };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; status?: number };
      const output = error.stdout || error.stderr || "";
      
      progress.update(75, "Sonuçlar parse ediliyor...");
      
      // Parse ESLint output
      const stats = parseEslintOutput(output);
      
      progress.fail(
        `${stats.error_count} hata, ${stats.warning_count} uyarı (${stats.files_with_issues} dosya)`
      );
      
      return {
        success: false,
        output,
        ...stats,
      };
    }
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_dev_lint_project", error as Error, { pattern, fix });
    
    return {
      success: false,
      output: (error as Error).message,
      error_count: 0,
      warning_count: 0,
      fixable_error_count: 0,
      fixable_warning_count: 0,
      files_checked: 0,
      files_with_issues: 0,
    };
  }
}

function parseEslintOutput(output: string): {
  error_count: number;
  warning_count: number;
  fixable_error_count: number;
  fixable_warning_count: number;
  files_checked: number;
  files_with_issues: number;
} {
  // Parse summary line: "✖ 23 problems (15 errors, 8 warnings)"
  const problemMatch = output.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
  const errorMatch = output.match(/(\d+)\s+errors?/);
  const warningMatch = output.match(/(\d+)\s+warnings?/);
  const fixableMatch = output.match(/(\d+)\s+errors?\s+and\s+(\d+)\s+warnings?\s+potentially\s+fixable/);
  
  // Count files with issues (lines starting with file path)
  const fileMatches = output.match(/^\/.+\.(js|ts|jsx|tsx)$/gm);
  const filesWithIssues = fileMatches ? fileMatches.length : 0;
  
  // Try to count total files checked
  const filesCheckedMatch = output.match(/(\d+)\s+files?\s+linted/);
  const filesChecked = filesCheckedMatch ? parseInt(filesCheckedMatch[1]!) : filesWithIssues;
  
  return {
    error_count: problemMatch ? parseInt(problemMatch[2]!) : (errorMatch ? parseInt(errorMatch[1]!) : 0),
    warning_count: problemMatch ? parseInt(problemMatch[3]!) : (warningMatch ? parseInt(warningMatch[1]!) : 0),
    fixable_error_count: fixableMatch ? parseInt(fixableMatch[1]!) : 0,
    fixable_warning_count: fixableMatch ? parseInt(fixableMatch[2]!) : 0,
    files_checked: filesChecked,
    files_with_issues: filesWithIssues,
  };
}

function countFilesFromOutput(output: string): number {
  const match = output.match(/(\d+)\s+files?\s+linted/);
  return match ? parseInt(match[1]!) : 0;
}

export const LINT_PROJECT_TOOL = {
  name: "hev_dev_lint_project",
  description: "Proje genelinde ESLint çalıştır (glob pattern ile batch linting)",
  inputSchema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string" as const,
        description: "Glob pattern (örn: 'src/**/*.ts', 'mcp-server/**/*.ts')",
        default: "**/*.{js,ts,jsx,tsx}",
      },
      fix: {
        type: "boolean" as const,
        description: "Otomatik düzeltme yap",
        default: false,
      },
      max_warnings: {
        type: "number" as const,
        description: "Maksimum uyarı sayısı (-1 = sınırsız)",
        default: -1,
      },
      cache: {
        type: "boolean" as const,
        description: "Cache kullan (daha hızlı)",
        default: true,
      },
      format: {
        type: "string" as const,
        enum: ["stylish", "compact", "json", "codeframe"],
        description: "Çıktı formatı",
        default: "stylish",
      },
    },
  },
};
