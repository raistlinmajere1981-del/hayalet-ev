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

let LOG_DIR = null;
let SESSION_ID = null;
let SESSION_DIR = null;

let appStateSnapshot = {};

/**
 * Session ID oluştur (LogManager ile aynı format)
 * @returns {string}
 */
export function generateSessionId() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
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
 * @param {string} [sessionId] - Opsiyonel session ID
 * @returns {{ sessionId: string, logDir: string, sessionDir: string }}
 */
export function initLogSystem(sessionId = null) {
  LOG_DIR = join(process.cwd(), "logs");
  SESSION_ID = sessionId || generateSessionId();
  SESSION_DIR = join(LOG_DIR, SESSION_ID);

  return { sessionId: SESSION_ID, logDir: LOG_DIR, sessionDir: SESSION_DIR };
}

/**
 * Session dizinini ve meta dosyasını oluştur
 */
export async function ensureSessionDir() {
  if (!SESSION_DIR) initLogSystem();
  
  if (!existsSync(SESSION_DIR)) {
    await mkdir(SESSION_DIR, { recursive: true });
    
    const meta = {
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
 * @param {number} totalLogs - Toplam log sayısı
 * @param {number} errorCount - Hata sayısı
 * @param {number} warnCount - Uyarı sayısı
 * @param {number} chunkIndex - Chunk index
 * @param {string} [endReason='normal'] - Kapanış nedeni
 */
export async function writeSessionSummary(totalLogs, errorCount, warnCount, chunkIndex, endReason = "normal") {
  try {
    await ensureSessionDir();
    
    const summary = {
      sessionId: SESSION_ID,
      startTime: appStateSnapshot.startTime || new Date().toISOString(),
      endTime: new Date().toISOString(),
      endReason,
      stats: {
        totalLogs,
        errors: errorCount,
        warnings: warnCount,
        chunks: chunkIndex,
      },
      lastState: appStateSnapshot,
    };
    
    await writeFile(
      join(SESSION_DIR, "summary.json"),
      JSON.stringify(summary, null, 2)
    );
  } catch (_err) {
  }
}

/**
 * Mevcut session'ları listele
 * @returns {Promise<object[]>}
 */
export async function listSessions() {
  try {
    if (!LOG_DIR) initLogSystem();
    if (!existsSync(LOG_DIR)) return [];
    
    const entries = await readdir(LOG_DIR, { withFileTypes: true });
    const sessions = [];
    
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
      return new Date(b.startTime) - new Date(a.startTime);
    });
    
    return sessions;
  } catch (_err) {
    return [];
  }
}

/**
 * Log dosyalarını temizle
 * @param {string} [targetSessionId] - Hedef session (null = aktif session)
 */
export async function clearLogs(targetSessionId = null) {
  try {
    const sessionDir = targetSessionId 
      ? join(LOG_DIR, targetSessionId) 
      : SESSION_DIR;
    
    if (existsSync(sessionDir)) {
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
 * @param {object} state - Uygulama durumu
 */
export function updateAppState(state) {
  appStateSnapshot = {
    ...appStateSnapshot,
    ...state,
    lastUpdate: new Date().toISOString(),
  };
}

/**
 * Son state snapshot'ı al
 * @returns {object}
 */
export function getAppState() {
  return { ...appStateSnapshot };
}

// ============================================
// ============================================

export function getSessionId() {
  return SESSION_ID;
}

export function getSessionDir() {
  return SESSION_DIR;
}

export function getLogDir() {
  return LOG_DIR;
}

export { SESSION_ID, SESSION_DIR, LOG_DIR };
