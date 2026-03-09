/**
 * Tool Call Handlers - Unified Registry Pattern
 *
 * Routes tool calls to handlers via the central registry.
 * All handlers are registered during bootstrap in handlers/index.ts.
 */

import { getHandler, getToolCount, getRegisteredToolNames, getRegistryStats } from "./registry.js";
import { logToolCall, logToolSuccess, logToolError } from "../utils/mcp-logger.js";
import { createMcpTranslatorSync } from "../utils/i18n/index.js";

interface LoggingAdapter {
  logToolCall: (name: string, args: unknown) => { startTime: number };
  logToolSuccess: (name: string, result: unknown, duration: number) => void;
  logToolError: (name: string, error: Error, args: unknown, startTime?: number) => void;
  now: () => number;
}

const defaultLoggingAdapter: LoggingAdapter = {
  logToolCall,
  logToolSuccess,
  logToolError,
  now: () => Date.now(),
};

const handlerT = createMcpTranslatorSync();

export async function executeHandlerWithLogging(
  name: string,
  args: Record<string, unknown> | undefined,
  handler: (args?: Record<string, unknown>) => unknown,
  logging: LoggingAdapter = defaultLoggingAdapter
): Promise<unknown> {
  const { startTime } = logging.logToolCall(name, args ?? {});

  try {
    const result = await handler(args);
    logging.logToolSuccess(name, result, logging.now() - startTime);
    return result;
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    logging.logToolError(name, normalizedError, args ?? {}, startTime);
    throw normalizedError;
  }
}

/**
 * Main handler dispatcher.
 * Routes tool calls to appropriate handler from registry.
 */
export async function handleToolCall(
  name: string,
  args?: Record<string, unknown>
): Promise<unknown> {
  const handler = getHandler(name);

  if (!handler) {
    return {
      content: [
        {
          type: "text",
          text: handlerT("mcpServer.handlers.unknownTool", {
            name,
            count: getToolCount(),
          }),
        },
      ],
      isError: true,
    };
  }

  // Guard: some LLMs occasionally send tool_input as a raw string.
  // Try to parse it automatically before failing.
  let safeArgs = args;
  if (typeof args === "string") {
    try {
      safeArgs = JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {
        content: [
          {
            type: "text",
            text: handlerT("mcpServer.handlers.toolInputParseError", {
              value: String(args).slice(0, 200),
            }),
          },
        ],
        isError: true,
      };
    }
  }

  try {
    return await executeHandlerWithLogging(name, safeArgs, handler);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: handlerT("mcpServer.handlers.executionError", {
            name,
            message: errorMessage,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Get handler information (for diagnostics).
 */
export function getHandlerInfo(): {
  totalHandlers: number;
  categories: Record<string, number>;
  handlerNames: string[];
} {
  const stats = getRegistryStats();
  return {
    totalHandlers: getToolCount(),
    categories: stats,
    handlerNames: getRegisteredToolNames(),
  };
}
