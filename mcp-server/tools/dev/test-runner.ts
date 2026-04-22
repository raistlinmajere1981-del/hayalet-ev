import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { createProgress } from "../../utils/progress.js";
import { logToolError } from "../../utils/mcp-logger.js";
import { DEV_TIMEOUTS } from "@timeouts";

interface PackageJsonLike {
  devDependencies?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
}

function testRunnerT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.testRunner.${key}`, params);
}

function testRunnerDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.testRunner.definition.${key}`, params);
}

export function testRun(
  projectRoot: string,
  options: { file?: string; grep?: string; timeout?: number } = {}
): { success: boolean; output: string; passed: number; failed: number } {
  const progress = createProgress({ operation: testRunnerT("progress.operation"), interval: 3000 });

  try {
    let cmd = "npm test";

    const pkgRaw: unknown = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
    const pkg: PackageJsonLike =
      typeof pkgRaw === "object" && pkgRaw !== null ? (pkgRaw) : {};
    const hasVitest = Boolean(pkg.devDependencies?.["vitest"] ?? pkg.dependencies?.["vitest"]);
    const hasJest = Boolean(pkg.devDependencies?.["jest"] ?? pkg.dependencies?.["jest"]);

    if (hasVitest) {
      cmd = "npx vitest run";
      if (options.file !== undefined && options.file.length > 0) cmd += ` ${options.file}`;
      if (options.grep !== undefined && options.grep.length > 0) cmd += ` --grep "${options.grep}"`;
    } else if (hasJest) {
      cmd = "npx jest";
      if (options.file !== undefined && options.file.length > 0) cmd += ` ${options.file}`;
      if (options.grep !== undefined && options.grep.length > 0) cmd += ` -t "${options.grep}"`;
    }

    const timeout = options.timeout ?? DEV_TIMEOUTS.TEST;
    progress.update(0, testRunnerT("progress.running", { command: cmd }));

    try {
      const output = execSync(cmd, {
        cwd: projectRoot,
        encoding: "utf-8",
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      const passMatch = output.match(/(\d+)\s+pass/i);
      const failMatch = output.match(/(\d+)\s+fail/i);
      const passed = passMatch ? parseInt(passMatch[1] ?? "0") : 0;
      const failed = failMatch ? parseInt(failMatch[1] ?? "0") : 0;

      progress.done(testRunnerT("progress.completed", { passed, failed }));
      return {
        success: true,
        output,
        passed,
        failed,
      };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string };
      const output = error.stdout ?? error.stderr ?? "";

      const passMatch = output.match(/(\d+)\s+pass/i);
      const failMatch = output.match(/(\d+)\s+fail/i);
      const passed = passMatch ? parseInt(passMatch[1] ?? "0") : 0;
      const failed = failMatch ? parseInt(failMatch[1] ?? "0") : 0;

      progress.fail(testRunnerT("progress.failed", { passed, failed }));
      return {
        success: false,
        output,
        passed,
        failed,
      };
    }
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_dev_test_run", error as Error, {
      file: options.file,
      grep: options.grep,
      timeout: options.timeout,
    });
    return { success: false, output: (error as Error).message, passed: 0, failed: 0 };
  }
}

export const TEST_RUNNER_TOOL = {
  name: "hev_dev_test_run",
  description: testRunnerDefT("description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file: {
        type: "string" as const,
        description: testRunnerDefT("file"),
      },
      grep: {
        type: "string" as const,
        description: testRunnerDefT("grep"),
      },
      timeout: {
        type: "integer" as const,
        description: testRunnerDefT("timeout"),
        default: 30000,
      },
    },
  },
  metadata: {
    category: "development",
    subcategory: "testing",
    priority: "high",
    complexity: "medium",
    useCases: [
      testRunnerDefT("useCases.beforeCommit"),
      testRunnerDefT("useCases.specificFiles"),
      testRunnerDefT("useCases.verifyChanges"),
    ],
    relatedTools: ["hev_fs_bash", "hev_dev_check_syntax"],
    agentGuidance: testRunnerDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["testing", "vitest", "jest", "auto-detect", "verification"],
  },
};
