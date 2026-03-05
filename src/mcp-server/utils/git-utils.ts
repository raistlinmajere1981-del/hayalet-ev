/**
 * Git Utilities - Safe Git Operations with Auto-Recovery
 *
 * Handles common git issues like stale lock files.
 */

import { existsSync, statSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

interface GitLockCheckResult {
  hasLock: boolean;
  isStale: boolean;
  ageMinutes?: number;
  path?: string;
}

const STALE_LOCK_THRESHOLD_MINUTES = 5;

/**
 * Check if git index.lock exists and is stale
 */
export function checkGitLock(workspacePath: string): GitLockCheckResult {
  const lockFile = join(workspacePath, ".git", "index.lock");

  if (!existsSync(lockFile)) {
    return { hasLock: false, isStale: false };
  }

  try {
    const stats = statSync(lockFile);
    const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;

    return {
      hasLock: true,
      isStale: ageMinutes > STALE_LOCK_THRESHOLD_MINUTES,
      ageMinutes: Math.round(ageMinutes * 10) / 10, // Round to 1 decimal
      path: lockFile,
    };
  } catch (error) {
    // If we can't stat the file, assume it's not a problem
    return { hasLock: false, isStale: false };
  }
}

/**
 * Remove stale git lock file
 */
export function removeStaleLock(workspacePath: string): boolean {
  const lockCheck = checkGitLock(workspacePath);

  if (!lockCheck.hasLock) {
    return false; // No lock to remove
  }

  if (!lockCheck.isStale) {
    throw new Error(
      `Git lock file is active (${lockCheck.ageMinutes ?? 0} minutes old). ` +
        `Another git operation may be in progress. Please wait or manually check.`
    );
  }

  try {
    unlinkSync(lockCheck.path ?? "");
    // Write to stderr (informational message for git lock recovery)
    process.stderr.write(
      `[GIT] Removed stale lock file (${lockCheck.ageMinutes ?? 0} minutes old)\n`
    );
    return true;
  } catch (error) {
    throw new Error(`Failed to remove stale lock: ${String(error)}`, { cause: error });
  }
}

/**
 * Execute git command with auto-recovery
 */
export function safeGitCommand(
  command: string,
  workspacePath: string,
  options?: { encoding?: BufferEncoding; maxRetries?: number }
): string {
  const encoding = options?.encoding ?? "utf-8";
  const maxRetries = options?.maxRetries ?? 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check for stale lock before executing
      const lockCheck = checkGitLock(workspacePath);

      if (lockCheck.hasLock && lockCheck.isStale) {
        // Write to stderr (informational message for git lock detection)
        process.stderr.write(`[GIT] Stale lock detected on attempt ${attempt + 1}, removing...\n`);
        removeStaleLock(workspacePath);
      } else if (lockCheck.hasLock && !lockCheck.isStale) {
        throw new Error(
          `Git operation in progress (lock age: ${lockCheck.ageMinutes ?? 0} min). Please wait.`
        );
      }

      // Execute command
      return execSync(command, {
        cwd: workspacePath,
        encoding,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error: unknown) {
      lastError = error as Error;

      // Check if error is lock-related
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isLockError =
        errorMessage.includes("index.lock") || errorMessage.includes("Unable to create");

      if (isLockError && attempt < maxRetries) {
        // Write to stderr (git lock recovery attempt)
        process.stderr.write(
          `[GIT] Lock error detected, attempting recovery (attempt ${attempt + 1}/${maxRetries})...\n`
        );
        try {
          removeStaleLock(workspacePath);
        } catch (_removeError) {
          // If we can't remove lock, throw original error
          throw error;
        }
        // Retry
        continue;
      }

      // Not a lock error or no retries left
      throw error;
    }
  }

  throw lastError ?? new Error("Git command failed");
}

/**
 * Safe git add with auto-recovery
 */
export function safeGitAdd(files: string | string[], workspacePath: string): string {
  const fileList = Array.isArray(files) ? files.join(" ") : files;
  return safeGitCommand(`git add ${fileList}`, workspacePath);
}

/**
 * Safe git commit with auto-recovery
 */
export function safeGitCommit(
  message: string,
  workspacePath: string,
  options?: { allowEmpty?: boolean }
): string {
  const allowEmptyFlag = options?.allowEmpty === true ? "--allow-empty " : "";
  const escapedMessage = message.replace(/"/g, '\\"');
  return safeGitCommand(`git commit ${allowEmptyFlag}-m "${escapedMessage}"`, workspacePath);
}

/**
 * Check git status (read-only, no lock issues)
 */
export function getGitStatus(workspacePath: string): string {
  return execSync("git status --porcelain", {
    cwd: workspacePath,
    encoding: "utf-8",
  });
}
