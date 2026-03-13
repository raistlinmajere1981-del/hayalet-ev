// NOTE: Integration layer for legacy log tooling.

import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { createMcpTranslator } from "../../utils/i18n/index.js";
import { findLatestSession, resolveExistingLogDir, type LogAppId } from "../../utils/log-utils.js";
import { PROJECT_ROOT } from "../../utils/project-root.js";

interface SessionInfo {
  sessionId: string;
  created: string;
  modified: string;
  path: string;
  stats?: Record<string, unknown>;
  logCount?: number;
  degraded?: DegradedInfo;
}

interface DegradedInfo {
  malformedLines?: number;
  summaryReadError?: string;
  structuredReadError?: string;
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

function normalizeStructuredLevel(level: string | undefined): string | undefined {
  if (level === "warn") return "warning";
  return level;
}

function logIntegrationT(
  t: (key: string, params?: Record<string, string | number | boolean>) => string,
  key: string,
  params?: Record<string, string | number | boolean>
): string {
  return t(`mcpServer.logIntegration.${key}`, params);
}

export async function readElectronLogs(args: {
  app?: LogAppId;
  sessionId?: string;
  type?: "console" | "error" | "structured";
  tail?: number;
  source?: "renderer" | "main";
  level?: string;
  contains?: string;
  correlationId?: string;
}): Promise<unknown> {
  const t = await createMcpTranslator();
  const logDir = resolveExistingLogDir(join(PROJECT_ROOT, "logs"), args.app ?? "hayalet-ev");

  let sessionId: string | undefined = args.sessionId;
  if (sessionId == null || sessionId === "") {
    sessionId = (await findLatestSession(logDir)) ?? undefined;
  }

  if (sessionId == null || sessionId === "") {
    return {
      success: false,
      message: logIntegrationT(t, "read.noLogSessionsFound"),
      logs: [],
    };
  }

  const sessionDir = join(logDir, sessionId);
  const type = args.type ?? "structured";
  let lines: string[];

  if (type === "console") {
    const files = await readdir(sessionDir);
    const consoleFiles = files
      .filter(
        (file) => file === "console.log" || (file.startsWith("console-") && file.endsWith(".log"))
      )
      .sort();

    if (consoleFiles.length === 0) {
      return {
        success: false,
        message: logIntegrationT(t, "read.logFileNotFound", { fileName: "console.log" }),
        logs: [],
      };
    }

    const contents = await Promise.all(
      consoleFiles.map(async (file) => await readFile(join(sessionDir, file), "utf-8"))
    );
    lines = contents.flatMap((content) => content.split("\n").filter((line) => line.trim() !== ""));
  } else {
    const fileName = type === "error" ? "error.log" : "structured.jsonl";
    const filePath = join(sessionDir, fileName);

    if (!existsSync(filePath)) {
      return {
        success: false,
        message: logIntegrationT(t, "read.logFileNotFound", { fileName }),
        logs: [],
      };
    }

    const content = await readFile(filePath, "utf-8");
    lines = content.split("\n").filter((line) => line.trim() !== "");
  }

  if (args.tail != null && args.tail > 0) {
    lines = lines.slice(-args.tail);
  }

  if (type === "structured") {
    const entries: StructuredLogEntry[] = [];
    let malformedLines = 0;

    for (const line of lines) {
      const entry = parseStructuredLine(line);
      if (entry == null) {
        malformedLines++;
        continue;
      }

      const normalizedLevel = normalizeStructuredLevel(entry.level);
      const normalizedEntry: StructuredLogEntry = { ...entry };
      if (normalizedLevel !== undefined) {
        normalizedEntry.level = normalizedLevel;
      }

      if (args.source != null && normalizedEntry.source !== args.source) continue;
      if (
        args.level != null &&
        normalizeStructuredLevel(normalizedEntry.level) !== normalizeStructuredLevel(args.level)
      ) {
        continue;
      }
      if (args.contains != null && !(normalizedEntry.message ?? "").includes(args.contains))
        continue;
      if (args.correlationId != null && normalizedEntry.correlationId !== args.correlationId)
        continue;

      entries.push(normalizedEntry);
    }

    return {
      success: true,
      sessionId,
      type,
      count: entries.length,
      logs: entries,
      ...(malformedLines > 0 ? { degraded: { malformedLines } } : {}),
    };
  }

  return {
    success: true,
    sessionId,
    type,
    count: lines.length,
    logs: lines,
  };
}

export async function listLogSessions(args?: {
  app?: LogAppId;
  limit?: number;
  includeStats?: boolean;
}): Promise<unknown> {
  const t = await createMcpTranslator();
  const logDir = resolveExistingLogDir(join(PROJECT_ROOT, "logs"), args?.app ?? "hayalet-ev");

  if (!existsSync(logDir)) {
    return {
      success: false,
      message: logIntegrationT(t, "list.logsDirectoryNotFound"),
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

    if (args?.includeStats === true) {
      const summaryPath = join(sessionPath, "summary.json");
      if (existsSync(summaryPath)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const summaryRaw: unknown = JSON.parse(await readFile(summaryPath, "utf-8"));
          if (isRecord(summaryRaw) && isRecord(summaryRaw["stats"])) {
            session.stats = summaryRaw["stats"];
          }
        } catch (error) {
          session.degraded = {
            ...(session.degraded ?? {}),
            summaryReadError: error instanceof Error ? error.message : String(error),
          };
        }
      }

      const structuredPath = join(sessionPath, "structured.jsonl");
      if (existsSync(structuredPath)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const content = await readFile(structuredPath, "utf-8");
          const lines = content.split("\n").filter((l) => l.trim() !== "");
          session.logCount = lines.length;
        } catch (error) {
          session.degraded = {
            ...(session.degraded ?? {}),
            structuredReadError: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    sessions.push(session);
  }

  sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

  const limit = args?.limit ?? 10;
  const limited = sessions.slice(0, limit);

  return {
    success: true,
    total: sessions.length,
    showing: limited.length,
    sessions: limited,
  };
}

export async function getSessionSummary(args: {
  app?: LogAppId;
  sessionId?: string;
}): Promise<unknown> {
  const t = await createMcpTranslator();
  const logDir = resolveExistingLogDir(join(PROJECT_ROOT, "logs"), args.app ?? "hayalet-ev");

  let sessionId: string | undefined = args.sessionId;
  if (sessionId == null || sessionId === "") {
    sessionId = (await findLatestSession(logDir)) ?? undefined;
  }

  if (sessionId == null || sessionId === "") {
    return {
      success: false,
      message: logIntegrationT(t, "summary.noSessionsFound"),
    };
  }

  const sessionDir = join(logDir, sessionId);
  const summaryPath = join(sessionDir, "summary.json");
  const degraded: DegradedInfo = {};

  if (existsSync(summaryPath)) {
    try {
      const summaryRaw: unknown = JSON.parse(await readFile(summaryPath, "utf-8"));
      const summary = isRecord(summaryRaw) ? summaryRaw : {};
      return {
        success: true,
        sessionId,
        summary,
      };
    } catch (error) {
      degraded.summaryReadError = error instanceof Error ? error.message : String(error);
    }
  }

  const structuredPath = join(sessionDir, "structured.jsonl");

  if (!existsSync(structuredPath)) {
    return {
      success: false,
      message: logIntegrationT(t, "summary.noLogsFoundInSession"),
    };
  }

  const content = await readFile(structuredPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  let malformedLines = 0;

  const stats = {
    totalLogs: lines.length,
    byLevel: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    errorCount: 0,
    warningCount: 0,
  };

  for (const line of lines) {
    const entry = parseStructuredLine(line);
    if (!entry) {
      malformedLines++;
      continue;
    }

    const level =
      typeof entry.level === "string"
        ? (normalizeStructuredLevel(entry.level) ?? logIntegrationT(t, "common.unknown"))
        : logIntegrationT(t, "common.unknown");
    stats.byLevel[level] = (stats.byLevel[level] ?? 0) + 1;

    const cat =
      typeof entry.category === "string" ? entry.category : logIntegrationT(t, "common.unknown");
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
    ...(Object.keys(degraded).length > 0 || malformedLines > 0
      ? {
          degraded: {
            ...degraded,
            ...(malformedLines > 0 ? { malformedLines } : {}),
          },
        }
      : {}),
  };
}
