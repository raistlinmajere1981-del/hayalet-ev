/**
 * Development Tools - Test Runner
 * 
 * Test çalıştırma (vitest/jest otomatik algılanır)
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { createProgress } from "../../utils/progress.js";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "../../utils/timeouts.js";

export function testRun(projectRoot: string, options: { file?: string; grep?: string; timeout?: number } = {}): { success: boolean; output: string; passed: number; failed: number } {
  const progress = createProgress({ operation: "Test çalıştırma", interval: 3000 });
  
  try {
    let cmd = "npm test";
    
    // Check if project uses vitest, jest, or mocha
    const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
    const hasVitest = pkg.devDependencies?.vitest || pkg.dependencies?.vitest;
    const hasJest = pkg.devDependencies?.jest || pkg.dependencies?.jest;
    
    if (hasVitest) {
      cmd = "npx vitest run";
      if (options.file) cmd += ` ${options.file}`;
      if (options.grep) cmd += ` --grep "${options.grep}"`;
    } else if (hasJest) {
      cmd = "npx jest";
      if (options.file) cmd += ` ${options.file}`;
      if (options.grep) cmd += ` -t "${options.grep}"`;
    }
    
    const timeout = options.timeout || DEV_TIMEOUTS.TEST;
    progress.update(0, `${cmd} çalıştırılıyor...`);
    
    try {
      const output = execSync(cmd, { cwd: projectRoot, encoding: "utf-8", timeout, maxBuffer: 10 * 1024 * 1024 });
      
      // Parse test results
      const passMatch = output.match(/(\d+)\s+pass/i);
      const failMatch = output.match(/(\d+)\s+fail/i);
      const passed = passMatch ? parseInt(passMatch[1] || '0') : 0;
      const failed = failMatch ? parseInt(failMatch[1] || '0') : 0;
      
      progress.done(`${passed} passed, ${failed} failed`);
      return {
        success: true,
        output,
        passed,
        failed,
      };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string };
      const output = error.stdout || error.stderr || "";
      
      const passMatch = output.match(/(\d+)\s+pass/i);
      const failMatch = output.match(/(\d+)\s+fail/i);
      const passed = passMatch ? parseInt(passMatch[1] || '0') : 0;
      const failed = failMatch ? parseInt(failMatch[1] || '0') : 0;
      
      progress.fail(`${passed} passed, ${failed} failed`);
      return {
        success: false,
        output,
        passed,
        failed,
      };
    }
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_dev_test_run", error as Error, { file: options.file, grep: options.grep, timeout: options.timeout });
    return { success: false, output: (error as Error).message, passed: 0, failed: 0 };
  }
}

export const TEST_RUNNER_TOOL = {
  name: "hev_dev_test_run",
  description: "Test çalıştır (vitest/jest otomatik algılanır)",
  inputSchema: {
    type: "object" as const,
    properties: {
      file: {
        type: "string" as const,
        description: "Sadece belirli test dosyası",
      },
      grep: {
        type: "string" as const,
        description: "Test ismi filtresi",
      },
      timeout: {
        type: "integer" as const,
        description: "Timeout (ms)",
        default: 30000,
      },
    },
  },
};
