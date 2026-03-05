/**
 * SessionManager - Log session yönetimi
 *
 * Bu modül log session'larını yönetir:
 * - Session ID oluşturma
 * - Session dizini oluşturma
 * - Session meta ve summary yazma
 * - Session listeleme
 */

import { mkdir, writeFile, readFile, readdir, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { Paths } from "../paths.ts";
import type { AppState, SessionMeta, SessionSummary, SessionListItem } from "@electron/types";

let LOG_DIR: string | null = null;
let SESSION_ID: string | null = null;
let SESSION_DIR: string | null = null;

let appStateSnapshot: AppState = {};

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

export function generateSessionId(): string {
  const now = new Date();
  const pad = (n: number): string => n.toString().padStart(2, "0");
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;
}

export function initLogSystem(sessionId: string | null = null): {
  sessionId: string;
  logDir: string;
  sessionDir: string;
} {
  LOG_DIR = join(Paths.getLogsDir(), "hayalet-ev");
  SESSION_ID = sessionId ?? generateSessionId();
  SESSION_DIR = join(LOG_DIR, SESSION_ID);

  return { sessionId: SESSION_ID, logDir: LOG_DIR, sessionDir: SESSION_DIR };
}

export async function ensureSessionDir(): Promise<void> {
  if (SESSION_DIR === null || SESSION_DIR.length === 0) initLogSystem();

  if (SESSION_DIR === null || SESSION_DIR.length === 0) {
    throw new Error("SESSION_DIR not initialized");
  }

  if (!existsSync(SESSION_DIR)) {
    await mkdir(SESSION_DIR, { recursive: true });

    if (SESSION_ID === null || SESSION_ID.length === 0) {
      throw new Error("SESSION_ID not initialized");
    }

    const meta: SessionMeta = {
      sessionId: SESSION_ID,
      startTime: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      appVersion: process.env["npm_package_version"] ?? "unknown",
    };

    await writeFile(join(SESSION_DIR, "meta.json"), JSON.stringify(meta, null, 2));
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
      throw new Error("SESSION_ID not initialized");
    }

    const snapshotStartTime =
      typeof appStateSnapshot.startTime === "string" && appStateSnapshot.startTime.length > 0
        ? appStateSnapshot.startTime
        : new Date().toISOString();

    const summary: SessionSummary = {
      sessionId: SESSION_ID,
      startTime: snapshotStartTime,
      endTime: new Date().toISOString(),
      endReason: endReason as SessionSummary["endReason"],
      stats: {
        totalLogs,
        errors: errorCount,
        warnings: warnCount,
        chunks: chunkIndex,
      },
      lastState: appStateSnapshot,
    };

    if (SESSION_DIR === null || SESSION_DIR.length === 0) {
      throw new Error("SESSION_DIR not initialized");
    }

    await writeFile(join(SESSION_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  } catch (_err) {}
}

export async function listSessions(): Promise<SessionListItem[]> {
  try {
    if (LOG_DIR === null || LOG_DIR.length === 0) initLogSystem();
    if (LOG_DIR === null || LOG_DIR.length === 0 || !existsSync(LOG_DIR)) return [];
    const logDir = LOG_DIR;

    const entries = await readdir(logDir, { withFileTypes: true });
    const sessions = (
      await Promise.all(
        entries.map(async (entry): Promise<SessionListItem | null> => {
          if (!entry.isDirectory()) return null;

          const metaPath = join(logDir, entry.name, "meta.json");
          const summaryPath = join(logDir, entry.name, "summary.json");

          let meta = null;
          let summary = null;

          try {
            const [metaContent, summaryContent] = await Promise.all([
              existsSync(metaPath) ? readFile(metaPath, "utf-8") : Promise.resolve(null),
              existsSync(summaryPath) ? readFile(summaryPath, "utf-8") : Promise.resolve(null),
            ]);
            meta =
              metaContent !== null ? (parseJsonObject(metaContent) as SessionMeta | null) : null;
            summary =
              summaryContent !== null
                ? (parseJsonObject(summaryContent) as SessionSummary | null)
                : null;
          } catch {}

          return {
            sessionId: entry.name,
            startTime: meta?.startTime ?? null,
            endTime: summary?.endTime ?? null,
            endReason: summary?.endReason ?? (entry.name === SESSION_ID ? "active" : "unknown"),
            stats: summary?.stats ?? null,
          };
        })
      )
    ).filter((session): session is SessionListItem => session !== null);

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
    console.error("Failed to clear logs:", err);
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
