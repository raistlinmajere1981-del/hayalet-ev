// NOTE: Stream logs in real time using fs.watch.

import { existsSync, readFileSync, statSync, watch } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import type { LogEntry } from "@shared/index.js";
import type { TranslationParams } from "../../../types/i18n.js";
import { createMcpTranslator, createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { PROJECT_ROOT } from "../../utils/project-root.js";

type McpTranslator = (key: string, params?: TranslationParams) => string;

const streamingToolDefinitionTranslator = createMcpTranslatorSync();

function streamingToolT(key: string, params?: TranslationParams): string {
  return streamingToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.streaming.${key}`, params);
}

function streamingT(t: McpTranslator, key: string, params?: TranslationParams): string {
  return t(`mcpServer.streaming.${key}`, params);
}

export interface StreamLogsRealtimeArgs {
  sessionId?: string;
  tail?: number;
  follow?: boolean;
  filter?: {
    level?: string[];
    category?: string[];
    contains?: string;
    regex?: string;
    correlationId?: string;
    source?: string;
  };
}

export interface StreamLogsRealtimeResult {
  sessionId: string;
  logPath: string;
  initialLogs: LogEntry[];
  streaming: boolean;
  message: string;
}

export async function streamLogsRealtime(
  args: StreamLogsRealtimeArgs
): Promise<StreamLogsRealtimeResult> {
  const t = await createMcpTranslator();
  const logDir = join(PROJECT_ROOT, "logs", "app");
  const sessionId = args.sessionId ?? (await getLatestSessionId(logDir, t));
  const sessionDir = join(logDir, sessionId);
  const structuredPath = join(sessionDir, "structured.jsonl");
  const divider = "─".repeat(57);

  if (!existsSync(structuredPath)) {
    throw new Error(streamingT(t, "sessionNotFound", { sessionId }));
  }

  const initialLogs = readInitialLogs(structuredPath, args);

  process.stderr.write(`\n${streamingT(t, "bannerTitle")}\n`);
  process.stderr.write(`${divider}\n`);
  process.stderr.write(`${streamingT(t, "sessionLine", { sessionId })}\n`);
  process.stderr.write(`${streamingT(t, "logFileLine", { path: structuredPath })}\n`);
  process.stderr.write(
    `${streamingT(t, "filterLine", { filters: JSON.stringify(args.filter ?? {}) })}\n`
  );
  process.stderr.write(`${divider}\n`);
  process.stderr.write(`${streamingT(t, "showingLastEntries", { count: initialLogs.length })}\n\n`);

  initialLogs.forEach((entry) => {
    printLogEntry(entry, t);
  });

  if (args.follow === false) {
    return {
      sessionId,
      logPath: structuredPath,
      initialLogs,
      streaming: false,
      message: streamingT(t, "followDisabledResult", { count: initialLogs.length }),
    };
  }

  process.stderr.write(`\n${divider}\n`);
  process.stderr.write(`${streamingT(t, "liveStreamingTitle")}\n`);
  process.stderr.write(`${streamingT(t, "pressCtrlC")}\n`);
  process.stderr.write(`${divider}\n\n`);

  await startFileWatcher(structuredPath, args.filter ?? {}, t);

  return {
    sessionId,
    logPath: structuredPath,
    initialLogs,
    streaming: true,
    message: streamingT(t, "streamingStarted"),
  };
}

function readInitialLogs(filePath: string, args: StreamLogsRealtimeArgs): LogEntry[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  let entries: LogEntry[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LogEntry;
      if (matchesFilter(entry, args.filter ?? {})) {
        entries.push(entry);
      }
    } catch {
      // NOTE: Skip invalid lines.
    }
  }

  const tail = args.tail ?? 50;
  if (tail > 0) {
    entries = entries.slice(-tail);
  }

  return entries;
}

async function startFileWatcher(
  filePath: string,
  filter: StreamLogsRealtimeArgs["filter"],
  t: McpTranslator
): Promise<void> {
  await new Promise((resolve, reject) => {
    let filePosition = 0;
    const divider = "─".repeat(57);

    try {
      const stats = statSync(filePath);
      filePosition = stats.size;
    } catch (err) {
      reject(new Error(streamingT(t, "statFailed", { message: String(err) })));
      return;
    }

    const watcher = watch(filePath, { persistent: true }, (eventType) => {
      if (eventType === "change") {
        try {
          const content = readFileSync(filePath, "utf-8");
          const newContent = content.substring(filePosition);
          filePosition = content.length;

          if (newContent.trim() === "") {
            return;
          }

          const newLines = newContent.split("\n").filter((line) => line.trim() !== "");

          for (const line of newLines) {
            try {
              const entry = JSON.parse(line) as LogEntry;
              if (matchesFilter(entry, filter ?? {})) {
                printLogEntry(entry, t);
              }
            } catch {
              // NOTE: Skip incomplete or invalid lines.
            }
          }
        } catch (err) {
          process.stderr.write(`\n${streamingT(t, "readError", { message: String(err) })}\n`);
        }
      }
    });

    process.on("SIGINT", () => {
      process.stderr.write(`\n\n${divider}\n`);
      process.stderr.write(`${streamingT(t, "stoppedByUser")}\n`);
      process.stderr.write(`${divider}\n\n`);

      watcher.close();
      resolve(undefined);
    });

    watcher.on("error", (err) => {
      process.stderr.write(`\n${streamingT(t, "watcherError", { message: String(err) })}\n`);
      watcher.close();
      reject(err);
    });
  });
}

function matchesFilter(entry: LogEntry, filter: StreamLogsRealtimeArgs["filter"]): boolean {
  if (!filter) return true;

  if (filter.level && filter.level.length > 0 && !filter.level.includes(entry.level)) {
    return false;
  }

  if (
    filter.category &&
    filter.category.length > 0 &&
    !filter.category.includes(String(entry.category))
  ) {
    return false;
  }

  if (filter.contains != null && filter.contains !== "") {
    const search = filter.contains.toLowerCase();
    if (!entry.message.toLowerCase().includes(search)) {
      return false;
    }
  }

  if (filter.regex != null && filter.regex !== "") {
    try {
      const regex = new RegExp(filter.regex, "i");
      if (!regex.test(entry.message)) {
        return false;
      }
    } catch {
      // NOTE: Ignore invalid regex values.
    }
  }

  if (filter.correlationId != null && filter.correlationId !== "") {
    if (entry.correlationId !== filter.correlationId) {
      return false;
    }
  }

  if (filter.source != null && filter.source !== "") {
    const source =
      entry.context && typeof entry.context === "object" && "source" in entry.context
        ? (entry.context as Record<string, unknown>)["source"]
        : undefined;
    if (source !== filter.source) {
      return false;
    }
  }

  return true;
}

function printLogEntry(entry: LogEntry, t: McpTranslator): void {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false });
  const level = entry.level.toUpperCase().padEnd(7);
  const category = String(entry.category).padEnd(15).substring(0, 15);

  const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
    cyan: "\x1b[36m",
  };

  let levelColor: string;
  if (entry.level === "error") levelColor = colors.red;
  else if (entry.level === "warning") levelColor = colors.yellow;
  else if (entry.level === "success") levelColor = colors.green;
  else if (entry.level === "info") levelColor = colors.blue;
  else levelColor = colors.gray;

  process.stderr.write(
    `${colors.gray}[${timestamp}]${colors.reset} ` +
      `${levelColor}[${level}]${colors.reset} ` +
      `${colors.cyan}[${category}]${colors.reset} ` +
      `${entry.message}\n`
  );

  if (entry.context && Object.keys(entry.context).length > 0) {
    const contextStr = JSON.stringify(entry.context, null, 2)
      .split("\n")
      .map((line) => `  ${colors.gray}${line}${colors.reset}`)
      .join("\n");
    process.stderr.write(contextStr + "\n");
  }

  if (entry.error) {
    process.stderr.write(
      `  ${colors.red}${streamingT(t, "errorLabel")}: ${entry.error.message}${colors.reset}\n`
    );
    if (entry.error.stack != null && entry.error.stack !== "") {
      const stackLines = entry.error.stack.split("\n").slice(0, 3);
      stackLines.forEach((line) => {
        process.stderr.write(`  ${colors.gray}${line}${colors.reset}\n`);
      });
    }
  }
}

async function getLatestSessionId(logDir: string, t: McpTranslator): Promise<string> {
  const sessions = await readdir(logDir);
  const sorted = sessions
    .filter((name) => !name.startsWith("."))
    .sort()
    .reverse();

  if (sorted.length === 0) {
    throw new Error(streamingT(t, "noSessionsFound"));
  }

  const latest = sorted[0];
  if (latest == null || latest === "") {
    throw new Error(streamingT(t, "failedToGetLatestSession"));
  }

  return latest;
}

export const STREAM_LOGS_REALTIME_TOOL = {
  name: "hev_stream_logs_realtime",
  description: streamingToolT("description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string",
        description: streamingToolT("sessionId"),
      },
      tail: {
        type: "integer",
        description: streamingToolT("tail"),
        default: 50,
      },
      follow: {
        type: "boolean",
        description: streamingToolT("follow"),
        default: true,
      },
      filter: {
        type: "object",
        properties: {
          level: {
            type: "array",
            items: { type: "string" },
            description: streamingToolT("filterLevel"),
          },
          category: {
            type: "array",
            items: { type: "string" },
            description: streamingToolT("filterCategory"),
          },
          contains: {
            type: "string",
            description: streamingToolT("filterContains"),
          },
          regex: {
            type: "string",
            description: streamingToolT("filterRegex"),
          },
          correlationId: {
            type: "string",
            description: streamingToolT("filterCorrelationId"),
          },
          source: {
            type: "string",
            description: streamingToolT("filterSource"),
          },
        },
      },
    },
  },
  metadata: {
    category: "logging",
    subcategory: "streaming",
    priority: "high",
    complexity: "medium",
    useCases: [
      streamingToolT("useCases.realtimeDebugging"),
      streamingToolT("useCases.monitorBehavior"),
      streamingToolT("useCases.trackFilteredOperations"),
      streamingToolT("useCases.watchErrors"),
    ],
    relatedTools: ["hev_read_electron_logs", "hev_analyze_errors"],
    agentGuidance: streamingToolT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["logging", "streaming", "real-time", "tail", "debug"],
  },
};
