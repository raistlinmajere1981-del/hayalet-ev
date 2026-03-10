/**
 * MCP Server Logger - Integrated with Main App Logging System
 *
 * SESSION 5.5: MCP Logging Integration
 * - Writes to main app logs (logs/YYYYMMDD-HHMMSS-xxxx/)
 * - Creates mcp-tools.jsonl for detailed MCP logs
 * - Writes to structured.jsonl for unified log analysis
 * - Performance tracking and error correlation
 */

import { appendFile, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { createMcpTranslatorSync, readMcpAppLanguageSync } from "./i18n/index.js";
import { PROJECT_ROOT } from "./project-root.js";

const LOG_BASE_DIR = join(PROJECT_ROOT, "logs", "mcp-server");

export type LogLevel = "debug" | "info" | "warn" | "error";

interface MCPLogEntry {
  timestamp: string;
  level: LogLevel;
  category: "mcp-tool" | "mcp-server";
  message: string;
  locale?: string;
  toolName?: string;
  operation: "start" | "success" | "error";
  duration?: number;
  args?: unknown;
  result?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  agentContext?:
    | {
        conversationId?: string;
        requestId?: string;
      }
    | undefined;
}

interface UnifiedLogEntry {
  timestamp: string;
  level: LogLevel;
  category: "mcp";
  source: "mcp-server";
  message: string;
  locale?: string;
  context?: {
    toolName?: string;
    operation?: string;
    duration?: number;
    agentContext?: unknown;
  };
  error?:
    | {
        name: string;
        message: string;
        stack?: string;
      }
    | undefined;
}

/**
 * MCPLogger Class - Integrated logging for MCP tools
 */
class MCPLogger {
  private logDir: string;
  private currentSessionId: string | null = null;

  constructor() {
    this.logDir = LOG_BASE_DIR;
  }

  /**
   * Get current session ID from latest session directory
   */
  private getCurrentSessionId(): string {
    try {
      if (this.currentSessionId != null && this.currentSessionId !== "") {
        return this.currentSessionId;
      }

      const sessions = readdirSync(this.logDir)
        .filter((f) => {
          try {
            return statSync(join(this.logDir, f)).isDirectory();
          } catch {
            return false;
          }
        })
        .sort()
        .reverse();

      this.currentSessionId = sessions[0] ?? "default";
      return this.currentSessionId;
    } catch {
      return "default";
    }
  }

  private getTranslator(): {
    locale: string;
    t: ReturnType<typeof createMcpTranslatorSync>;
  } {
    const locale = readMcpAppLanguageSync();
    return {
      locale,
      t: createMcpTranslatorSync(locale),
    };
  }

  private buildLifecycleMessage(
    operation: MCPLogEntry["operation"],
    toolName?: string,
    duration?: number,
    errorMessage?: string
  ): { locale: string; message: string } {
    const { locale, t } = this.getTranslator();
    const resolvedToolName = toolName?.trim() !== "" ? toolName : t("mcpServer.logs.unknownTool");

    if (operation === "start") {
      return {
        locale,
        message: t("mcpServer.logs.toolStart", { toolName: resolvedToolName }),
      };
    }

    if (operation === "success") {
      return {
        locale,
        message: t("mcpServer.logs.toolSuccess", {
          toolName: resolvedToolName,
          ...(duration !== undefined ? { duration } : {}),
        }),
      };
    }

    if (resolvedToolName === "general") {
      return {
        locale,
        message: t("mcpServer.logs.generalError", {
          message: errorMessage ?? "",
        }),
      };
    }

    return {
      locale,
      message: t("mcpServer.logs.toolError", {
        toolName: resolvedToolName,
        message: errorMessage ?? "",
      }),
    };
  }

  /**
   * Log MCP tool start
   */
  async logToolStart(toolName: string, args: unknown, agentContext?: unknown): Promise<void> {
    const lifecycle = this.buildLifecycleMessage("start", toolName);
    const entry: MCPLogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      category: "mcp-tool",
      message: lifecycle.message,
      locale: lifecycle.locale,
      toolName,
      operation: "start",
      args: this.sanitizeArgs(args),
      ...(agentContext !== undefined
        ? { agentContext: agentContext as MCPLogEntry["agentContext"] }
        : {}),
    };

    await this.writeToLog(entry);
    // Removed console.log - stdout must be clean for JSON-RPC
  }

  /**
   * Log MCP tool success
   */
  async logToolSuccess(
    toolName: string,
    result: unknown,
    duration: number,
    agentContext?: unknown
  ): Promise<void> {
    const lifecycle = this.buildLifecycleMessage("success", toolName, duration);
    const entry: MCPLogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      category: "mcp-tool",
      message: lifecycle.message,
      locale: lifecycle.locale,
      toolName,
      operation: "success",
      duration,
      result: this.sanitizeResult(result),
      ...(agentContext !== undefined
        ? { agentContext: agentContext as MCPLogEntry["agentContext"] }
        : {}),
    };

    await this.writeToLog(entry);
    // Removed console.log - stdout must be clean for JSON-RPC
  }

  /**
   * Log MCP tool error
   */
  async logToolError(
    toolName: string,
    error: Error,
    duration?: number,
    agentContext?: unknown
  ): Promise<void> {
    const lifecycle = this.buildLifecycleMessage("error", toolName, duration, error.message);
    const entry: MCPLogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      category: "mcp-tool",
      message: lifecycle.message,
      locale: lifecycle.locale,
      toolName,
      operation: "error",
      ...(duration !== undefined ? { duration } : {}),
      error: {
        name: error.name,
        message: error.message,
        ...(error.stack !== undefined ? { stack: error.stack } : {}),
      },
      ...(agentContext !== undefined
        ? { agentContext: agentContext as MCPLogEntry["agentContext"] }
        : {}),
    };

    await this.writeToLog(entry);
    // Write to stderr (avoid circular dependency with Logger)
    process.stderr.write(`${entry.message}\n`);
  }

  /**
   * Write log entry to both mcp-tools.jsonl and structured.jsonl
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async writeToLog(entry: MCPLogEntry): Promise<void> {
    try {
      const sessionId = this.getCurrentSessionId();
      const sessionDir = join(this.logDir, sessionId);

      if (!existsSync(sessionDir)) {
        mkdirSync(sessionDir, { recursive: true });
      }

      // 1. Write to mcp-tools.jsonl (detailed MCP logs)
      const mcpLogPath = join(sessionDir, "mcp-tools.jsonl");
      appendFile(mcpLogPath, JSON.stringify(entry) + "\n", "utf-8", (err) => {
        if (err) {
          const { t } = this.getTranslator();
          process.stderr.write(
            `${t("mcpServer.logs.writeMcpToolsFailed", { message: String(err) })}\n`
          );
        }
      });

      // 2. Write to structured.jsonl (unified logs)
      const structuredPath = join(sessionDir, "structured.jsonl");
      const unifiedEntry: UnifiedLogEntry = {
        timestamp: entry.timestamp,
        level: entry.level,
        category: "mcp",
        source: "mcp-server",
        message: entry.message,
        context: {
          ...(entry.toolName != null ? { toolName: entry.toolName } : {}),
          operation: entry.operation,
          ...(entry.duration !== undefined ? { duration: entry.duration } : {}),
          ...(entry.agentContext !== undefined ? { agentContext: entry.agentContext } : {}),
        },
      };

      if (entry.locale !== undefined) {
        unifiedEntry.locale = entry.locale;
      }

      if (entry.error !== undefined) {
        unifiedEntry.error = entry.error;
      }

      appendFile(structuredPath, JSON.stringify(unifiedEntry) + "\n", "utf-8", (err) => {
        if (err) {
          const { t } = this.getTranslator();
          process.stderr.write(
            `${t("mcpServer.logs.writeStructuredFailed", { message: String(err) })}\n`
          );
        }
      });

      return;
    } catch (error) {
      const { t } = this.getTranslator();
      process.stderr.write(`${t("mcpServer.logs.writeFailed", { message: String(error) })}\n`);
      return;
    }
  }

  /**
   * Sanitize arguments (remove sensitive data, truncate large args)
   */
  private sanitizeArgs(args: unknown): unknown {
    if (args === null || args === undefined) return args;

    const str = JSON.stringify(args);
    if (str.length > 5000) {
      return { truncated: true, preview: str.substring(0, 500) + "..." };
    }
    return args;
  }

  /**
   * Sanitize result (truncate large results)
   */
  private sanitizeResult(result: unknown): unknown {
    if (result === null || result === undefined) return result;

    const str = JSON.stringify(result);
    if (str.length > 10000) {
      return { truncated: true, preview: str.substring(0, 1000) + "..." };
    }
    return result;
  }
}

// Singleton instance
const logger = new MCPLogger();

function writeLoggerInternalError(key: string, params?: Record<string, string | number>): void {
  const t = createMcpTranslatorSync();
  process.stderr.write(`${t(`mcpServer.logs.${key}`, params)}\n`);
}

// ============================================================================
// Export Functions (backward compatible + new API)
// ============================================================================

/**
 * Log tool call start (backward compatible)
 * Returns startTime for duration calculation
 */
export function logToolCall(toolName: string, args: unknown): { startTime: number } {
  const startTime = Date.now();
  logger.logToolStart(toolName, args).catch((err) => {
    writeLoggerInternalError("startLogFailed", { message: String(err) });
  });
  return { startTime };
}

/**
 * Log tool call success (NEW - Session 5.5)
 */
export function logToolSuccess(
  toolName: string,
  result: unknown,
  duration: number,
  agentContext?: unknown
): void {
  logger.logToolSuccess(toolName, result, duration, agentContext).catch((err) => {
    writeLoggerInternalError("successLogFailed", { message: String(err) });
  });
}

/**
 * Log tool call error (backward compatible + enhanced)
 */
export function logToolError(
  toolName: string,
  error: Error,
  _args: unknown,
  startTime?: number
): void {
  const duration = startTime != null && startTime > 0 ? Date.now() - startTime : undefined;
  logger.logToolError(toolName, error, duration).catch((err) => {
    writeLoggerInternalError("errorLogFailed", { message: String(err) });
  });

  // Keep stderr output for MCP client (required by MCP protocol)
  console.error(
    createMcpTranslatorSync()("mcpServer.logs.toolError", { toolName, message: error.message })
  );
}

/**
 * General error logging
 */
export function logError(message: string, error?: Error): void {
  const err = error ?? new Error(message);
  logger.logToolError("general", err).catch((e) => {
    writeLoggerInternalError("generalLogFailed", { message: String(e) });
  });
}

// ============================================================================
// Startup Log
// ============================================================================
// Note: console.log removed - stdout must be clean for JSON-RPC
// Initialization logged to mcp-tools.jsonl instead
