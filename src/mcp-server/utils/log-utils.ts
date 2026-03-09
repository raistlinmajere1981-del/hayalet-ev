/**
 * LogUtils - MCP Server log helpers
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { createMcpTranslatorSync } from "./i18n/index.js";

const logUtilsT = createMcpTranslatorSync();

/** Log filter options */
interface LogFilters {
  source?: string;
  level?: string;
  contains?: string;
  correlationId?: string;
  tail?: number;
}

/** Session info result */
interface SessionInfo {
  meta: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
}

/**
 * Find the latest session
 */
export async function findLatestSession(logDir: string): Promise<string | null> {
  try {
    if (!existsSync(logDir)) return null;

    const entries = await readdir(logDir, { withFileTypes: true });
    const sessions = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse();

    return sessions[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Read session logs
 */
export async function readSessionLogs(
  logDir: string,
  sessionId: string,
  type: "console" | "error" | "structured" = "console"
): Promise<string> {
  const sessionDir = join(logDir, sessionId);

  if (!existsSync(sessionDir)) {
    return logUtilsT("mcpServer.logUtils.sessionNotFound", { sessionId });
  }

  try {
    if (type === "error") {
      const errorPath = join(sessionDir, "error.log");
      if (existsSync(errorPath)) {
        return await readFile(errorPath, "utf-8");
      }
      return logUtilsT("mcpServer.logUtils.errorLogMissing");
    }

    if (type === "structured") {
      const structuredPath = join(sessionDir, "structured.jsonl");
      if (existsSync(structuredPath)) {
        return await readFile(structuredPath, "utf-8");
      }
      return logUtilsT("mcpServer.logUtils.structuredLogMissing");
    }

    // Check the single console.log file first.
    const singleConsolePath = join(sessionDir, "console.log");
    if (existsSync(singleConsolePath)) {
      return await readFile(singleConsolePath, "utf-8");
    }

    // Fallback: console-*.log pattern (chunked logs).
    const files = await readdir(sessionDir);
    const consoleFiles = files.filter((f) => f.startsWith("console-") && f.endsWith(".log")).sort();

    if (consoleFiles.length === 0) {
      return logUtilsT("mcpServer.logUtils.consoleLogMissing");
    }

    let content = "";
    for (const file of consoleFiles) {
      // eslint-disable-next-line no-await-in-loop
      content += await readFile(join(sessionDir, file), "utf-8");
    }

    return content;
  } catch (err) {
    const error = err as Error;
    return logUtilsT("mcpServer.logUtils.readError", { message: error.message });
  }
}

/**
 * Filter logs
 */
export function filterLogs(content: string, filters: LogFilters = {}): string[] {
  const { source, level, contains, correlationId, tail = 50 } = filters;

  let lines = content.split("\n").filter((l) => l.trim() !== "");

  if (source != null && source !== "") {
    const sourcePattern = source.replace(/\*/g, ".*");
    const sourceRegex = new RegExp(`\\[${sourcePattern}\\]`, "i");
    lines = lines.filter((l) => sourceRegex.test(l));
  }

  if (level != null && level !== "") {
    lines = lines.filter((l) => l.includes(`[${level}]`));
  }

  if (contains != null && contains !== "") {
    const containsLower = contains.toLowerCase();
    lines = lines.filter((l) => l.toLowerCase().includes(containsLower));
  }

  if (correlationId != null && correlationId !== "") {
    lines = lines.filter((l) => l.includes(correlationId));
  }

  return lines.slice(-tail);
}

/**
 * Read session metadata and summary info
 */
export async function readSessionInfo(logDir: string, sessionId: string): Promise<SessionInfo> {
  const sessionDir = join(logDir, sessionId);
  const metaPath = join(sessionDir, "session-metadata.json");
  const legacyMetaPath = join(sessionDir, "meta.json");
  const summaryPath = join(sessionDir, "summary.json");

  let meta: Record<string, unknown> | null = null;
  let summary: Record<string, unknown> | null = null;

  try {
    if (existsSync(metaPath)) {
      meta = JSON.parse(await readFile(metaPath, "utf-8")) as Record<string, unknown>;
    } else if (existsSync(legacyMetaPath)) {
      meta = JSON.parse(await readFile(legacyMetaPath, "utf-8")) as Record<string, unknown>;
    }
    if (existsSync(summaryPath)) {
      summary = JSON.parse(await readFile(summaryPath, "utf-8")) as Record<string, unknown>;
    }
  } catch {
    // Ignore parse errors.
  }

  return { meta, summary };
}
