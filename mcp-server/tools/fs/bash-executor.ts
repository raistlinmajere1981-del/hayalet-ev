/**
 * Filesystem Tools - Bash Executor
 */

import { spawn, ChildProcess } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";
import { FS_TIMEOUTS } from "../../utils/timeouts.js";
import { safeGitCommand, checkGitLock, removeStaleLock } from "../../utils/git-utils.js";

interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  pid?: number;
  timedOut?: boolean;
  success?: boolean;
}

export async function executeBash(
  command: string | number,
  workspacePath: string,
  timeout: number = FS_TIMEOUTS.BASH_DEFAULT
): Promise<BashResult> {
  return new Promise((resolve) => {
    // PID ile log alma (şimdilik desteklenmiyor)
    if (typeof command === "number") {
      resolve({
        stdout: "",
        stderr: "PID ile log alma henüz desteklenmiyor",
        exitCode: 1,
      });
      return;
    }
    
    const isBackground = command.trim().endsWith("&");
    const actualCommand = isBackground ? command.slice(0, -1).trim() : command;
    
    // Git command detection and auto-recovery
    const isGitCommand = actualCommand.trim().startsWith("git ");
    if (isGitCommand) {
      try {
        const lockCheck = checkGitLock(workspacePath);
        if (lockCheck.hasLock && lockCheck.isStale) {
          console.log(`[BASH] Stale git lock detected (${lockCheck.ageMinutes} min), auto-removing...`);
          removeStaleLock(workspacePath);
        }
      } catch (lockError: any) {
        // If lock check fails, continue with normal execution
        console.warn('[BASH] Git lock check failed:', lockError.message);
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
    
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    child.on("close", (code) => {
      clearTimeout(timeoutId);
      
      // Output limitlenmesi (çok büyük çıktılar için)
      const maxOutput = 50000;
      if (stdout.length > maxOutput) {
        stdout = stdout.slice(0, maxOutput) + `\n... (${stdout.length - maxOutput} karakter kesildi)`;
      }
      if (stderr.length > maxOutput) {
        stderr = stderr.slice(0, maxOutput) + `\n... (${stderr.length - maxOutput} karakter kesildi)`;
      }
      
      resolve({
        stdout,
        stderr,
        exitCode: code ?? (timedOut ? 124 : 1),
        pid: child.pid,
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
    
    // Background process için hemen dön
    if (isBackground) {
      clearTimeout(timeoutId);
      setTimeout(() => {
        resolve({
          stdout: `Background process başlatıldı`,
          stderr: "",
          exitCode: 0,
          pid: child.pid,
        });
      }, 100);
    }
  });
}

// Tool Definition
export const BASH_EXECUTOR_TOOL = {
  name: "hev_fs_bash",
  description: "Shell komutu çalıştır",
  inputSchema: {
    type: "object" as const,
    properties: {
      command: { type: "string" },
      timeout: { type: "integer" }
    },
    required: ["command"]
  }
};
