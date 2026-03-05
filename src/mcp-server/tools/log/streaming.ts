/**
 * Real-time Log Streaming Tool
 *
 * Provides tail -f like functionality for log files
 * with live updates using fs.watch
 *
 * @module mcp-server/tools/log/streaming
 */

import { watch, readFileSync, statSync, existsSync } from "fs";
import { join } from "path";
import { readdir } from "fs/promises";
import { PROJECT_ROOT } from "../../utils/project-root.js";
import type { LogEntry } from "@shared/index.js";

// ============================================================================
// Types
// ============================================================================

export interface StreamLogsRealtimeArgs {
  sessionId?: string; // Specific session or latest
  tail?: number; // Start from last N lines (default: 50)
  follow?: boolean; // Follow mode (default: true)
  filter?: {
    level?: string[]; // Filter by level: error, warn, info, debug
    category?: string[]; // Filter by category
    contains?: string; // Filter by message content
    regex?: string; // Filter by regex pattern
    correlationId?: string; // Filter by correlation ID
    source?: string; // Filter by source (e.g., 'ai1-webview')
  };
}

export interface StreamLogsRealtimeResult {
  sessionId: string;
  logPath: string;
  initialLogs: LogEntry[];
  streaming: boolean;
  message: string;
}

// ============================================================================
// Real-time Streaming Implementation
// ============================================================================

/**
 * Stream logs in real-time (tail -f like)
 *
 * This function:
 * 1. Reads initial logs (with tail option)
 * 2. Sets up file watcher for new entries
 * 3. Streams new logs to stderr as they arrive
 * 4. Runs until interrupted (Ctrl+C)
 */
export async function streamLogsRealtime(
  args: StreamLogsRealtimeArgs
): Promise<StreamLogsRealtimeResult> {
  const logDir = join(PROJECT_ROOT, "logs", "hayalet-ev");
  const sessionId = args.sessionId ?? (await getLatestSessionId(logDir));
  const sessionDir = join(logDir, sessionId);
  const structuredPath = join(sessionDir, "structured.jsonl");

  if (!existsSync(structuredPath)) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Read initial logs
  const initialLogs = readInitialLogs(structuredPath, args);

  // Print initial logs to stderr
  process.stderr.write("\n╔═══════════════════════════════════════════════════════════╗\n");
  process.stderr.write("║       🔴 REAL-TIME LOG STREAMING (tail -f)              ║\n");
  process.stderr.write("╚═══════════════════════════════════════════════════════════╝\n\n");
  process.stderr.write(`Session: ${sessionId}\n`);
  process.stderr.write(`Log file: ${structuredPath}\n`);
  process.stderr.write(`Filter: ${JSON.stringify(args.filter ?? {})}\n`);
  process.stderr.write(`\n─────────────────────────────────────────────────────────\n`);
  process.stderr.write(`Showing last ${initialLogs.length} entries...\n`);
  process.stderr.write(`─────────────────────────────────────────────────────────\n\n`);

  // Print initial logs
  initialLogs.forEach((entry) => {
    printLogEntry(entry);
  });

  // If follow mode is disabled, return here
  if (args.follow === false) {
    return {
      sessionId,
      logPath: structuredPath,
      initialLogs,
      streaming: false,
      message: `Returned ${initialLogs.length} log entries (follow mode disabled)`,
    };
  }

  // Start real-time streaming
  process.stderr.write(`\n─────────────────────────────────────────────────────────\n`);
  process.stderr.write("🔴 STREAMING LIVE... (Press Ctrl+C to stop)\n");
  process.stderr.write(`─────────────────────────────────────────────────────────\n\n`);

  await startFileWatcher(structuredPath, args.filter ?? {});

  return {
    sessionId,
    logPath: structuredPath,
    initialLogs,
    streaming: true,
    message: "Real-time streaming started",
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Read initial logs from file (with tail support)
 */
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
      // Skip invalid lines
    }
  }

  // Apply tail
  const tail = args.tail ?? 50;
  if (tail > 0) {
    entries = entries.slice(-tail);
  }

  return entries;
}

/**
 * Start file watcher for real-time updates
 */
async function startFileWatcher(
  filePath: string,
  filter: StreamLogsRealtimeArgs["filter"]
): Promise<void> {
  await new Promise((resolve, reject) => {
    let filePosition = 0;

    // Get initial file size
    try {
      const stats = statSync(filePath);
      filePosition = stats.size;
    } catch (err) {
      reject(new Error(`Failed to stat file: ${String(err)}`));
      return;
    }

    // Watch file for changes
    const watcher = watch(filePath, { persistent: true }, (eventType) => {
      if (eventType === "change") {
        try {
          // Read new content
          const content = readFileSync(filePath, "utf-8");
          const newContent = content.substring(filePosition);
          filePosition = content.length;

          if (newContent.trim() === "") return;

          // Parse and print new lines
          const newLines = newContent.split("\n").filter((line) => line.trim() !== "");

          for (const line of newLines) {
            try {
              const entry = JSON.parse(line) as LogEntry;
              if (matchesFilter(entry, filter ?? {})) {
                printLogEntry(entry);
              }
            } catch {
              // Skip incomplete or invalid lines
            }
          }
        } catch (err) {
          process.stderr.write(`\n⚠️  Error reading file: ${String(err)}\n`);
        }
      }
    });

    // Handle Ctrl+C
    process.on("SIGINT", () => {
      process.stderr.write("\n\n─────────────────────────────────────────────────────────\n");
      process.stderr.write("🛑 Streaming stopped by user\n");
      process.stderr.write("─────────────────────────────────────────────────────────\n\n");

      watcher.close();
      resolve(undefined);
    });

    // Handle errors
    watcher.on("error", (err) => {
      process.stderr.write(`\n❌ Watcher error: ${err}\n`);
      watcher.close();
      reject(err);
    });
  });
}

/**
 * Check if log entry matches filter criteria
 */
function matchesFilter(entry: LogEntry, filter: StreamLogsRealtimeArgs["filter"]): boolean {
  if (!filter) return true;

  // Level filter
  if (filter.level && filter.level.length > 0) {
    if (!filter.level.includes(entry.level)) {
      return false;
    }
  }

  // Category filter
  if (filter.category && filter.category.length > 0) {
    if (!filter.category.includes(String(entry.category))) {
      return false;
    }
  }

  // Contains filter
  if (filter.contains != null && filter.contains !== "") {
    const search = filter.contains.toLowerCase();
    if (!entry.message.toLowerCase().includes(search)) {
      return false;
    }
  }

  // Regex filter
  if (filter.regex != null && filter.regex !== "") {
    try {
      const regex = new RegExp(filter.regex, "i");
      if (!regex.test(entry.message)) {
        return false;
      }
    } catch {
      // Invalid regex, skip filter
    }
  }

  // Correlation ID filter
  if (filter.correlationId != null && filter.correlationId !== "") {
    if (entry.correlationId !== filter.correlationId) {
      return false;
    }
  }

  // Source filter (from context)
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

/**
 * Print log entry to stderr with colors
 */
function printLogEntry(entry: LogEntry): void {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false });
  const level = entry.level.toUpperCase().padEnd(7);
  const category = String(entry.category).padEnd(15).substring(0, 15);

  // Color codes
  const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
    cyan: "\x1b[36m",
  };

  // Level color
  let levelColor: string;
  if (entry.level === "error") levelColor = colors.red;
  else if (entry.level === "warning") levelColor = colors.yellow;
  else if (entry.level === "success") levelColor = colors.green;
  else if (entry.level === "info") levelColor = colors.blue;
  else levelColor = colors.gray; // debug

  // Format: [HH:MM:SS] [ERROR  ] [category      ] Message
  process.stderr.write(
    `${colors.gray}[${timestamp}]${colors.reset} ` +
      `${levelColor}[${level}]${colors.reset} ` +
      `${colors.cyan}[${category}]${colors.reset} ` +
      `${entry.message}\n`
  );

  // Print context if exists (indented)
  if (entry.context && Object.keys(entry.context).length > 0) {
    const contextStr = JSON.stringify(entry.context, null, 2)
      .split("\n")
      .map((line) => `  ${colors.gray}${line}${colors.reset}`)
      .join("\n");
    process.stderr.write(contextStr + "\n");
  }

  // Print error details if exists
  if (entry.error) {
    process.stderr.write(`  ${colors.red}Error: ${entry.error.message}${colors.reset}\n`);
    if (entry.error.stack != null && entry.error.stack !== "") {
      const stackLines = entry.error.stack.split("\n").slice(0, 3);
      stackLines.forEach((line) => {
        process.stderr.write(`  ${colors.gray}${line}${colors.reset}\n`);
      });
    }
  }
}

/**
 * Get latest session ID from logs directory
 */
async function getLatestSessionId(logDir: string): Promise<string> {
  const sessions = await readdir(logDir);
  const sorted = sessions
    .filter((name) => !name.startsWith("."))
    .sort()
    .reverse();

  if (sorted.length === 0) {
    throw new Error("No sessions found in logs directory");
  }

  const latest = sorted[0];
  if (latest == null || latest === "") {
    throw new Error("Failed to get latest session");
  }

  return latest;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const STREAM_LOGS_REALTIME_TOOL = {
  name: "hev_stream_logs_realtime",
  description:
    "Real-time log streaming (tail -f like). Streams log entries as they arrive. Press Ctrl+C to stop.",
  inputSchema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string",
        description: "Session ID to stream (omit for latest session)",
      },
      tail: {
        type: "integer",
        description: "Show last N entries before streaming (default: 50)",
        default: 50,
      },
      follow: {
        type: "boolean",
        description: "Follow mode - stream new entries (default: true)",
        default: true,
      },
      filter: {
        type: "object",
        properties: {
          level: {
            type: "array",
            items: { type: "string" },
            description: "Filter by level: error, warn, info, debug",
          },
          category: {
            type: "array",
            items: { type: "string" },
            description: "Filter by category",
          },
          contains: {
            type: "string",
            description: "Filter by message content (case-insensitive)",
          },
          regex: {
            type: "string",
            description: "Filter by regex pattern",
          },
          correlationId: {
            type: "string",
            description: "Filter by correlation ID",
          },
          source: {
            type: "string",
            description: "Filter by source (e.g., 'ai1-webview', 'mcp-server')",
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
      "Real-time debugging during development",
      "Monitor application behavior live",
      "Track specific operations with filters",
      "Watch for errors as they occur",
    ],
    relatedTools: ["hev_read_electron_logs", "hev_analyze_errors"],
    agentGuidance:
      "Use for real-time log monitoring. Streams continuously until interrupted. Perfect for debugging live issues.",
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["logging", "streaming", "real-time", "tail", "debug"],
  },
};
