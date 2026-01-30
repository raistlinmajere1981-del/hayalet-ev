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
import type { AppState, SessionMeta, SessionSummary, SessionListItem } from "../types/index.ts";

let LOG_DIR: string | null = null;
let SESSION_ID: string | null = null;
let SESSION_DIR: string | null = null;

let appStateSnapshot: AppState = {};

/**
 * Session ID oluştur (LogManager ile aynı format)
 */
export function generateSessionId(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;
}

/**
 * Log sistemini başlat
 */
export function initLogSystem(
  sessionId: string | null = null
): { sessionId: string; logDir: string; sessionDir: string } {
  LOG_DIR = join(process.cwd(), "logs");
  SESSION_ID = sessionId || generateSessionId();
  SESSION_DIR = join(LOG_DIR, SESSION_ID);

  return { sessionId: SESSION_ID, logDir: LOG_DIR, sessionDir: SESSION_DIR };
}

/**
 * Session dizinini ve meta dosyasını oluştur
 */
export async function ensureSessionDir(): Promise<void> {
  if (!SESSION_DIR) initLogSystem();

  if (!SESSION_DIR) {
    throw new Error("SESSION_DIR not initialized");
  }

  if (!existsSync(SESSION_DIR)) {
    await mkdir(SESSION_DIR, { recursive: true });

    if (!SESSION_ID) {
      throw new Error("SESSION_ID not initialized");
    }

    const meta: SessionMeta = {
      sessionId: SESSION_ID,
      startTime: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions?.electron || "unknown",
      appVersion: process.env.npm_package_version || "unknown",
    };
    
    await writeFile(
      join(SESSION_DIR, "meta.json"),
      JSON.stringify(meta, null, 2)
    );
  }
}

/**
 * Session özeti yaz (uygulama kapanırken çağrılır)
 */
export async function writeSessionSummary(
  totalLogs: number,
  errorCount: number,
  warnCount: number,
  chunkIndex: number,
  endReason: string = "normal"
): Promise<void> {
  try {
    await ensureSessionDir();

    if (!SESSION_ID) {
      throw new Error("SESSION_ID not initialized");
    }

    const summary: SessionSummary = {
      sessionId: SESSION_ID,
      startTime: (appStateSnapshot.startTime as string) || new Date().toISOString(),
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

    if (!SESSION_DIR) {
      throw new Error("SESSION_DIR not initialized");
    }

    await writeFile(
      join(SESSION_DIR, "summary.json"),
      JSON.stringify(summary, null, 2)
    );
  } catch (_err) {
    // Ignore errors
  }
}

/**
 * Mevcut session'ları listele
 */
export async function listSessions(): Promise<SessionListItem[]> {
  try {
    if (!LOG_DIR) initLogSystem();
    if (!LOG_DIR || !existsSync(LOG_DIR)) return [];
    
    const entries = await readdir(LOG_DIR, { withFileTypes: true });
    const sessions = [];
    
    if (!LOG_DIR) {
      throw new Error("LOG_DIR not initialized");
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = join(LOG_DIR, entry.name, "meta.json");
        const summaryPath = join(LOG_DIR, entry.name, "summary.json");
        
        let meta = null;
        let summary = null;
        
        try {
          if (existsSync(metaPath)) {
            meta = JSON.parse(await readFile(metaPath, "utf-8"));
          }
          if (existsSync(summaryPath)) {
            summary = JSON.parse(await readFile(summaryPath, "utf-8"));
          }
        } catch {
        }
        
        sessions.push({
          sessionId: entry.name,
          startTime: meta?.startTime || null,
          endTime: summary?.endTime || null,
          endReason: summary?.endReason || (entry.name === SESSION_ID ? "active" : "unknown"),
          stats: summary?.stats || null,
        });
      }
    }
    
    sessions.sort((a, b) => {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
    
    return sessions;
  } catch (_err) {
    return [];
  }
}

/**
 * Log dosyalarını temizle
 */
export async function clearLogs(targetSessionId: string | null = null): Promise<void> {
  try {
    const sessionDir = targetSessionId 
      ? (LOG_DIR ? join(LOG_DIR, targetSessionId) : null)
      : SESSION_DIR;
    
    if (sessionDir && existsSync(sessionDir)) {
      await rm(sessionDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error("Failed to clear logs:", err);
  }
}

// ============================================
// ============================================

/**
 * Uygulama durumunu güncelle
 */
export function updateAppState(state: Partial<AppState>): void {
  appStateSnapshot = {
    ...appStateSnapshot,
    ...state,
    lastUpdate: new Date().toISOString(),
  };
}

/**
 * Son state snapshot'ı al
 */
export function getAppState(): AppState {
  return { ...appStateSnapshot };
}

// ============================================
// Getters
// ============================================

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
