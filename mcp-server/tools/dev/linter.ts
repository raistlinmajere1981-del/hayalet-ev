/**
 * Development Tools - Linter
 * 
 * ESLint çalıştırma (tek dosya)
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { createProgress } from "../../utils/progress.js";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "../../utils/timeouts.js";

export function lintFile(projectRoot: string, filePath: string, fix: boolean = false): { success: boolean; output: string; errorCount: number; warningCount: number } {
  const progress = createProgress({ operation: "ESLint", interval: 5000 });
  
  try {
    const fixArg = fix ? " --fix" : "";
    // Enable cache for faster subsequent runs
    const cmd = `npx eslint "${filePath}" --format stylish --cache${fixArg}`;
    progress.update(0, `${filePath} lint ediliyor...`);
    
    try {
      const output = execSync(cmd, { cwd: projectRoot, encoding: "utf-8", timeout: DEV_TIMEOUTS.LINT });
      progress.done("Hata bulunamadı");
      return { success: true, output: output || "✓ Hata bulunamadı", errorCount: 0, warningCount: 0 };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; status?: number };
      const output = error.stdout || error.stderr || "";
      
      // Parse error/warning counts
      const errorMatch = output.match(/(\d+) errors?/);
      const warningMatch = output.match(/(\d+) warnings?/);
      const errorCount = errorMatch ? parseInt(errorMatch[1]!) : 0;
      const warningCount = warningMatch ? parseInt(warningMatch[1]!) : 0;
      
      progress.fail(`${errorCount} hata, ${warningCount} uyarı`);
      return {
        success: false,
        output,
        errorCount,
        warningCount,
      };
    }
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_dev_lint_file", error as Error, { filePath, fix });
    return { success: false, output: (error as Error).message, errorCount: 0, warningCount: 0 };
  }
}

export const LINTER_TOOL = {
  name: "hev_dev_lint_file",
  description: "Tek dosyada ESLint çalıştır",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu",
      },
      fix: {
        type: "boolean" as const,
        description: "Otomatik düzeltme yap",
        default: false,
      },
    },
    required: ["file_path"],
  },
};
