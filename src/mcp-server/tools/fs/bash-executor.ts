import { spawn } from "child_process";
import { logToolError as _logToolError } from "../../utils/mcp-logger.js";
import { FS_TIMEOUTS } from "@timeouts";
import { checkGitLock, removeStaleLock } from "../../utils/git-utils.js";
import { createMcpTranslator, createMcpTranslatorSync } from "../../utils/i18n/index.js";
import type { TranslationParams } from "../../../types/i18n.js";

interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  pid?: number;
  timedOut?: boolean;
  success?: boolean;
}

type McpTranslator = (key: string, params?: TranslationParams) => string;

const bashToolDefinitionTranslator = createMcpTranslatorSync();

function bashT(t: McpTranslator, key: string, params?: TranslationParams): string {
  return t(`mcpServer.fs.bash.${key}`, params);
}

function bashToolDefinitionT(key: string): string {
  return bashToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.${key}`);
}

function chunkToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  return String(data);
}

export async function executeBash(
  command: string | number,
  workspacePath: string,
  timeout: number = FS_TIMEOUTS.BASH_DEFAULT
): Promise<BashResult> {
  const t = await createMcpTranslator();
  return await new Promise((resolve) => {
    if (typeof command === "number") {
      resolve({
        stdout: "",
        stderr: bashT(t, "pidLogsUnsupported"),
        exitCode: 1,
      });
      return;
    }

    const isBackground = command.trim().endsWith("&");
    const actualCommand = isBackground ? command.slice(0, -1).trim() : command;

    const isGitCommand = actualCommand.trim().startsWith("git ");
    if (isGitCommand) {
      try {
        const lockCheck = checkGitLock(workspacePath);
        if (lockCheck.hasLock && lockCheck.isStale) {
          process.stderr.write(
            `[BASH] ${bashT(t, "staleGitLockDetected", { ageMinutes: lockCheck.ageMinutes ?? 0 })}\n`
          );
          removeStaleLock(workspacePath);
        }
      } catch (lockError: unknown) {
        interface ErrorWithMessage {
          message?: string;
        }
        process.stderr.write(
          `[BASH] ${bashT(t, "gitLockCheckFailed", {
            message: (lockError as ErrorWithMessage).message ?? bashT(t, "unknown"),
          })}\n`
        );
      }
    }

    const child = spawn("bash", ["-c", actualCommand], {
      cwd: workspacePath,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);

    child.stdout.on("data", (data: unknown) => {
      stdout += chunkToString(data);
    });

    child.stderr.on("data", (data: unknown) => {
      stderr += chunkToString(data);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);

      const maxOutput = 50000;
      if (stdout.length > maxOutput) {
        stdout =
          stdout.slice(0, maxOutput) +
          `\n... ${bashT(t, "truncated", {
            count: stdout.length - maxOutput,
          })}`;
      }
      if (stderr.length > maxOutput) {
        stderr =
          stderr.slice(0, maxOutput) +
          `\n... ${bashT(t, "truncated", {
            count: stderr.length - maxOutput,
          })}`;
      }

      resolve({
        stdout,
        stderr,
        exitCode: code ?? (timedOut ? 124 : 1),
        ...(typeof child.pid === "number" ? { pid: child.pid } : {}),
        timedOut,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
      });
    });

    if (isBackground) {
      clearTimeout(timeoutId);
      setTimeout(() => {
        resolve({
          stdout: bashT(t, "backgroundStarted"),
          stderr: "",
          exitCode: 0,
          ...(typeof child.pid === "number" ? { pid: child.pid } : {}),
        });
      }, 100);
    }
  });
}

export const BASH_EXECUTOR_TOOL = {
  name: "hev_fs_bash",
  description: bashToolDefinitionT("bash.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      command: { type: "string", description: bashToolDefinitionT("bash.command") },
      timeout: { type: "integer", description: bashToolDefinitionT("bash.timeout") },
    },
    required: ["command"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "bash",
  },
};
