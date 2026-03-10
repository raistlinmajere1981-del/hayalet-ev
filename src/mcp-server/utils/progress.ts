/**
 * Progress Indicator Utility
 *
 * Progress reporting for long-running operations.
 * Sends updates through MCP notifications and stderr.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createMcpTranslatorSync } from "./i18n/index.js";

const progressTranslator = createMcpTranslatorSync();

function progressT(key: string, params?: Record<string, string | number | boolean>): string {
  return progressTranslator(`mcpServer.progress.${key}`, params);
}

// Global server reference (set from index.ts)
let mcpServer: Server | null = null;
let currentProgressToken: string | number | null = null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Set the MCP server reference from index.ts.
 */
export function setMcpServer(server: Server): void {
  mcpServer = server;
}

/**
 * Set the active progress token from the request metadata.
 */
export function setProgressToken(token: string | number | null): void {
  currentProgressToken = token;
}

export interface ProgressOptions {
  /** Human-readable operation name */
  operation: string;
  /** Total step count when known */
  total?: number;
  /** Heartbeat interval (ms) */
  interval?: number;
  /** Quiet mode prints only important updates */
  quiet?: boolean;
  /** Progress token for MCP notifications */
  progressToken?: string | number;
}

export interface ProgressTracker {
  /** Update the current progress step */
  update: (current: number, message?: string) => void;
  /** Emit an informational message */
  log: (message: string) => void;
  /** Mark the operation as completed */
  done: (message?: string) => void;
  /** Mark the operation as failed */
  fail: (error: string) => void;
  /** Stop the heartbeat without marking completion */
  stop: () => void;
}

/**
 * Send an MCP progress notification when available.
 */
async function sendProgressNotification(
  progress: number,
  total: number | undefined,
  message: string
): Promise<void> {
  const token = currentProgressToken;
  if (mcpServer === null || token === null) return;

  try {
    await mcpServer.notification({
      method: "notifications/progress",
      params: {
        progressToken: token,
        progress,
        total,
        message,
      } as Record<string, unknown>,
    });
  } catch {
    // Ignore notification failures.
  }
}

/**
 * Create a progress tracker for a long-running operation.
 */
export function createProgress(options: ProgressOptions): ProgressTracker {
  const { operation, total, interval = 2000, quiet = false, progressToken } = options;
  const startTime = Date.now();
  let currentStep = 0;
  let lastMessage = "";
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let isRunning = true;

  if (progressToken !== undefined) {
    setProgressToken(progressToken);
  }

  const startedMessage = progressT("started", { operation });
  if (!quiet) {
    console.error(`[PROGRESS] ⏳ ${startedMessage}`);
  }

  void sendProgressNotification(0, total, startedMessage);

  heartbeatTimer = setInterval(() => {
    if (!isRunning) return;

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const progressStr =
      total !== undefined
        ? progressT("ratio", {
            current: currentStep,
            total,
            percentage: Math.round((currentStep / total) * 100),
          })
        : progressT("steps", { current: currentStep });
    const heartbeatMessage = progressT("ongoing", { operation });
    const messageSuffix = lastMessage !== "" ? ` - ${lastMessage}` : "";

    console.error(`[PROGRESS] ⏳ ${heartbeatMessage} [${elapsed}s] ${progressStr}${messageSuffix}`);

    void sendProgressNotification(
      currentStep,
      total,
      `${heartbeatMessage}${lastMessage !== "" ? ` ${lastMessage}` : ""}`.trim()
    );
  }, interval);

  return {
    update(current: number, message?: string): void {
      currentStep = current;
      if (message !== undefined && message !== "") {
        lastMessage = message;
        if (!quiet) {
          const progressStr =
            total !== undefined ? `[${Math.round((current / total) * 100)}%]` : `[${current}]`;
          console.error(`[PROGRESS] ${progressStr} ${message}`);
        }
        void sendProgressNotification(current, total, message);
      }
    },

    log(message: string): void {
      console.error(`[PROGRESS] ℹ️ ${message}`);
      void sendProgressNotification(currentStep, total, message);
    },

    done(message?: string): void {
      isRunning = false;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const finalMessage = message ?? progressT("completedDefault");
      const completedMessage = progressT("completed", {
        operation,
        message: finalMessage,
        elapsed,
      });
      console.error(`[PROGRESS] ✅ ${completedMessage}`);

      void sendProgressNotification(total ?? currentStep, total, `✅ ${completedMessage}`);
      setProgressToken(null);
    },

    fail(error: string): void {
      isRunning = false;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const failedMessage = progressT("failed", {
        operation,
        error,
        elapsed,
      });
      console.error(`[PROGRESS] ❌ ${failedMessage}`);

      void sendProgressNotification(currentStep, total, `❌ ${failedMessage}`);
      setProgressToken(null);
    },

    stop(): void {
      isRunning = false;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      setProgressToken(null);
    },
  };
}

/**
 * Wrap an async operation and surface progress when it exceeds a timeout.
 */
export async function withTimeout<T>(
  operation: string,
  fn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  let progress: ProgressTracker | null = null;

  const timeoutId = setTimeout(() => {
    progress = createProgress({ operation, quiet: true });
  }, timeoutMs);

  return await fn()
    .then((result) => {
      clearTimeout(timeoutId);
      if (progress) {
        progress.done();
      }
      return result;
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      if (progress) {
        progress.fail(getErrorMessage(error));
      }
      throw error;
    });
}
