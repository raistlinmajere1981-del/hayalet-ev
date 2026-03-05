/**
 * Integration layer for existing MCP log tools
 *
 * Wraps existing tools with new architecture
 */

import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { PROJECT_ROOT } from "../../utils/project-root.js";

interface SessionInfo {
  sessionId: string;
  created: string;
  modified: string;
  path: string;
  stats?: Record<string, unknown>;
  logCount?: number;
}

interface StructuredLogEntry {
  source?: string;
  level?: string;
  message?: string;
  correlationId?: string;
  category?: string;
  stats?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStructuredLine(line: string): StructuredLogEntry | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return isRecord(parsed) ? (parsed as StructuredLogEntry) : null;
  } catch {
    return null;
  }
}

/**
 * Read electron logs (enhanced version of existing tool)
 */
export async function readElectronLogs(args: {
  sessionId?: string;
  type?: "console" | "error" | "structured";
  tail?: number;
  source?: "renderer" | "main";
  level?: string;
  contains?: string;
  correlationId?: string;
}): Promise<unknown> {
  const logDir = join(PROJECT_ROOT, "logs", "hayalet-ev");

  // Get session ID
  let sessionId = args.sessionId;
  if (sessionId == null || sessionId === "") {
    const sessions = await readdir(logDir);
    const sorted = sessions.sort().reverse();
    sessionId = sorted[0];
  }

  if (sessionId == null || sessionId === "") {
    return {
      success: false,
      message: "No log sessions found",
      logs: [],
    };
  }

  const sessionDir = join(logDir, sessionId);

  // Determine file to read
  const typeMap = {
    console: "console.log",
    error: "error.log",
    structured: "structured.jsonl",
  };

  const fileName = typeMap[args.type ?? "structured"];
  const filePath = join(sessionDir, fileName);

  if (!existsSync(filePath)) {
    return {
      success: false,
      message: `Log file not found: ${fileName}`,
      logs: [],
    };
  }

  const content = await readFile(filePath, "utf-8");
  let lines = content.split("\n").filter((line) => line.trim() !== "");

  // Apply tail
  if (args.tail != null && args.tail > 0) {
    lines = lines.slice(-args.tail);
  }

  // Parse structured logs for filtering
  if (args.type === "structured" || args.type === undefined) {
    const entries: StructuredLogEntry[] = [];

    for (const line of lines) {
      const entry = parseStructuredLine(line);
      if (entry == null) continue;

      // Apply filters
      if (args.source != null && entry.source !== args.source) continue;
      if (args.level != null && entry.level !== args.level) continue;
      if (args.contains != null && !(entry.message ?? "").includes(args.contains)) continue;
      if (args.correlationId != null && entry.correlationId !== args.correlationId) continue;

      entries.push(entry);
    }

    return {
      success: true,
      sessionId,
      type: args.type ?? "structured",
      count: entries.length,
      logs: entries,
    };
  }

  // Return raw lines for console/error logs
  return {
    success: true,
    sessionId,
    type: args.type,
    count: lines.length,
    logs: lines,
  };
}

/**
 * List log sessions (enhanced)
 */
export async function listLogSessions(args?: {
  limit?: number;
  includeStats?: boolean;
}): Promise<unknown> {
  const logDir = join(PROJECT_ROOT, "logs", "hayalet-ev");

  if (!existsSync(logDir)) {
    return {
      success: false,
      message: "Logs directory not found",
      sessions: [],
    };
  }

  const entries = await readdir(logDir);
  const sessions = [];

  for (const entry of entries) {
    const sessionPath = join(logDir, entry);
    // eslint-disable-next-line no-await-in-loop
    const stats = await stat(sessionPath);

    if (!stats.isDirectory()) continue;

    const session: SessionInfo = {
      sessionId: entry,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      path: sessionPath,
    };

    // Include stats if requested
    if (args?.includeStats === true) {
      const summaryPath = join(sessionPath, "summary.json");
      if (existsSync(summaryPath)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const summaryRaw: unknown = JSON.parse(await readFile(summaryPath, "utf-8"));
          if (isRecord(summaryRaw) && isRecord(summaryRaw["stats"])) {
            session.stats = summaryRaw["stats"];
          }
        } catch {
          // Ignore
        }
      }

      // Count logs
      const structuredPath = join(sessionPath, "structured.jsonl");
      if (existsSync(structuredPath)) {
        // eslint-disable-next-line no-await-in-loop
        const content = await readFile(structuredPath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim() !== "");
        session.logCount = lines.length;
      }
    }

    sessions.push(session);
  }

  // Sort by modified time (newest first)
  sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

  // Apply limit
  const limit = args?.limit ?? 10;
  const limited = sessions.slice(0, limit);

  return {
    success: true,
    total: sessions.length,
    showing: limited.length,
    sessions: limited,
  };
}

/**
 * Get session summary (enhanced)
 */
export async function getSessionSummary(args: { sessionId?: string }): Promise<unknown> {
  const logDir = join(PROJECT_ROOT, "logs", "hayalet-ev");

  // Get session ID
  let sessionId = args.sessionId;
  if (sessionId == null || sessionId === "") {
    const sessions = await readdir(logDir);
    const sorted = sessions.sort().reverse();
    sessionId = sorted[0];
  }

  if (sessionId == null || sessionId === "") {
    return {
      success: false,
      message: "No sessions found",
    };
  }

  const sessionDir = join(logDir, sessionId);
  const summaryPath = join(sessionDir, "summary.json");

  // Try to read existing summary
  if (existsSync(summaryPath)) {
    const summaryRaw: unknown = JSON.parse(await readFile(summaryPath, "utf-8"));
    const summary = isRecord(summaryRaw) ? summaryRaw : {};
    return {
      success: true,
      sessionId,
      summary,
    };
  }

  // Generate summary on-the-fly
  const structuredPath = join(sessionDir, "structured.jsonl");

  if (!existsSync(structuredPath)) {
    return {
      success: false,
      message: "No logs found in session",
    };
  }

  const content = await readFile(structuredPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  const stats = {
    totalLogs: lines.length,
    byLevel: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    errorCount: 0,
    warningCount: 0,
  };

  for (const line of lines) {
    const entry = parseStructuredLine(line);
    if (!entry) continue;

    const level = typeof entry.level === "string" ? entry.level : "unknown";
    stats.byLevel[level] = (stats.byLevel[level] ?? 0) + 1;

    const cat = typeof entry.category === "string" ? entry.category : "unknown";
    stats.byCategory[cat] = (stats.byCategory[cat] ?? 0) + 1;

    if (level === "error") stats.errorCount++;
    if (level === "warning") stats.warningCount++;
  }

  return {
    success: true,
    sessionId,
    summary: {
      sessionId,
      stats,
    },
  };
}
