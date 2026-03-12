import { mkdir, writeFile, readFile, readdir, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { Paths } from "../paths.ts";
import type { AppState, SessionListItem } from "@electron/types";
import { translateElectronMessage } from "../i18n/language-service.ts";
import {
  buildSessionMeta,
  buildSessionSummary,
  createSessionId,
  LEGACY_SESSION_META_FILENAME,
  normalizeSessionMeta,
  normalizeSessionSummary,
  SESSION_META_FILENAME,
  SESSION_SUMMARY_FILENAME,
} from "./session-context.ts";

let LOG_DIR: string | null = null;
let SESSION_ID: string | null = null;
let SESSION_DIR: string | null = null;
let SESSION_START_TIME: string | null = null;

let appStateSnapshot: AppState = {};

async function loggerT(key: string, params?: Record<string, string | number>): Promise<string> {
  return await translateElectronMessage(`electron.logger.${key}`, params);
}

function getAppLogDirCandidates(): string[] {
  try {
    return Array.from(new Set([Paths.getMainAppLogsDir(), Paths.getLegacyMainAppLogsDir()]));
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getSessionStartTime(): string {
  if (SESSION_START_TIME != null && SESSION_START_TIME.length > 0) {
    return SESSION_START_TIME;
  }

  const fallback =
    typeof appStateSnapshot.startTime === "string" && appStateSnapshot.startTime.length > 0
      ? appStateSnapshot.startTime
      : new Date().toISOString();

  SESSION_START_TIME = fallback;
  return fallback;
}

export function generateSessionId(): string {
  return createSessionId();
}

export function initLogSystem(sessionId: string | null = null): {
  sessionId: string;
  logDir: string;
  sessionDir: string;
} {
  LOG_DIR = Paths.getMainAppLogsDir();
  SESSION_ID = sessionId ?? generateSessionId();
  SESSION_START_TIME = getSessionStartTime();
  SESSION_DIR = join(LOG_DIR, SESSION_ID);

  return { sessionId: SESSION_ID, logDir: LOG_DIR, sessionDir: SESSION_DIR };
}

export async function ensureSessionDir(): Promise<void> {
  if (SESSION_DIR === null || SESSION_DIR.length === 0) initLogSystem();

  if (SESSION_DIR === null || SESSION_DIR.length === 0) {
    throw new Error(await loggerT("sessionDirNotInitialized"));
  }

  if (!existsSync(SESSION_DIR)) {
    await mkdir(SESSION_DIR, { recursive: true });

    if (SESSION_ID === null || SESSION_ID.length === 0) {
      throw new Error(await loggerT("sessionIdNotInitialized"));
    }

    const meta: SessionMeta = buildSessionMeta({
      sessionId: SESSION_ID,
      startTime: getSessionStartTime(),
      appVersion: process.env["npm_package_version"] ?? "unknown",
      pid: process.pid,
    });

    await writeFile(join(SESSION_DIR, SESSION_META_FILENAME), JSON.stringify(meta, null, 2));
  }
}

export async function writeSessionSummary(
  totalLogs: number,
  errorCount: number,
  warnCount: number,
  chunkIndex: number,
  endReason: string = "normal"
): Promise<void> {
  try {
    await ensureSessionDir();

    if (SESSION_ID === null || SESSION_ID.length === 0) {
      throw new Error(await loggerT("sessionIdNotInitialized"));
    }

    const summary: SessionSummary = buildSessionSummary({
      sessionId: SESSION_ID,
      startTime: getSessionStartTime(),
      endTime: new Date().toISOString(),
      endReason: endReason as SessionSummary["endReason"],
      stats: {
        totalLogs,
        byLevel: {},
        byCategory: {},
        errorCount,
        warningCount: warnCount,
        chunks: chunkIndex,
      },
      lastState: appStateSnapshot,
    });

    if (SESSION_DIR === null || SESSION_DIR.length === 0) {
      throw new Error(await loggerT("sessionDirNotInitialized"));
    }

    await writeFile(join(SESSION_DIR, SESSION_SUMMARY_FILENAME), JSON.stringify(summary, null, 2));
  } catch (_err) {}
}

export async function listSessions(): Promise<SessionListItem[]> {
  try {
    if (LOG_DIR === null || LOG_DIR.length === 0) initLogSystem();
    const logDirs = getAppLogDirCandidates().filter((dir) => existsSync(dir));
    if (logDirs.length === 0) return [];

    const sessionMap = new Map<string, SessionListItem>();

    for (const logDir of logDirs) {
      // eslint-disable-next-line no-await-in-loop
      const entries = await readdir(logDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || sessionMap.has(entry.name)) continue;

        const sessionMetaPath = join(logDir, entry.name, SESSION_META_FILENAME);
        const legacyMetaPath = join(logDir, entry.name, LEGACY_SESSION_META_FILENAME);
        const metaPath = existsSync(sessionMetaPath) ? sessionMetaPath : legacyMetaPath;
        const summaryPath = join(logDir, entry.name, SESSION_SUMMARY_FILENAME);

        let meta = null;
        let summary = null;

        try {
          const [metaContent, summaryContent] = await Promise.all([
            existsSync(metaPath) ? readFile(metaPath, "utf-8") : Promise.resolve(null),
            existsSync(summaryPath) ? readFile(summaryPath, "utf-8") : Promise.resolve(null),
          ]);
          meta =
            metaContent !== null ? normalizeSessionMeta(parseJsonObject(metaContent)) : null;
          summary =
            summaryContent !== null
              ? normalizeSessionSummary(parseJsonObject(summaryContent))
              : null;
        } catch {}

        sessionMap.set(entry.name, {
          sessionId: entry.name,
          startTime: meta?.startTime ?? null,
          endTime: summary?.endTime ?? null,
          endReason: summary?.endReason ?? (entry.name === SESSION_ID ? "active" : "unknown"),
          stats: summary?.stats ?? null,
        });
      }
    }

    const sessions = Array.from(sessionMap.values());

    sessions.sort((a, b) => {
      if (a.startTime === null || a.startTime.length === 0) return 1;
      if (b.startTime === null || b.startTime.length === 0) return -1;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    return sessions;
  } catch (_err) {
    return [];
  }
}

export async function clearLogs(targetSessionId: string | null = null): Promise<void> {
  try {
    const hasTargetSessionId = targetSessionId !== null && targetSessionId.length > 0;
    const sessionDir = hasTargetSessionId
      ? LOG_DIR !== null && LOG_DIR.length > 0
        ? join(LOG_DIR, targetSessionId)
        : null
      : SESSION_DIR;

    if (sessionDir !== null && sessionDir.length > 0 && existsSync(sessionDir)) {
      await rm(sessionDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(
      await loggerT("clearLogsFailed", {
        message: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

export function updateAppState(state: Partial<AppState>): void {
  appStateSnapshot = {
    ...appStateSnapshot,
    ...state,
    lastUpdate: new Date().toISOString(),
  };
}

export function getAppState(): AppState {
  return { ...appStateSnapshot };
}

export function getSessionId(): string | null {
  return SESSION_ID;
}

export function getSessionDir(): string | null {
  return SESSION_DIR;
}

export function getLogDir(): string | null {
  return LOG_DIR;
}

export { SESSION_ID, SESSION_DIR, LOG_DIR };
