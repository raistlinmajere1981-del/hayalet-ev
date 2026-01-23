/**
 * MCP Server Logger - Session Based
 * 
 * Her MCP server başlatıldığında yeni session oluşturur.
 * Log dosyaları: mcp-server/logs/SESSION_ID/
 *   - mcp.log: Tüm loglar
 *   - error.log: Sadece hatalar
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_BASE_DIR = join(__dirname, "..", "logs");

// Session ayarları
const MAX_SESSION_AGE_DAYS = 7; // 7 günden eski session'ları sil
const SESSION_ID = generateSessionId();
const SESSION_DIR = join(LOG_BASE_DIR, SESSION_ID);
const LOG_FILE = join(SESSION_DIR, "mcp.log");
const ERROR_FILE = join(SESSION_DIR, "error.log");

// Session klasörünü oluştur
ensureSessionDir();

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tool?: string;
  message: string;
  args?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  duration?: number;
}

/**
 * Session ID oluştur (timestamp bazlı)
 */
function generateSessionId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  
  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
}

/**
 * Session klasörünü oluştur ve eski session'ları temizle
 */
function ensureSessionDir(): void {
  try {
    // Base log klasörünü oluştur
    if (!existsSync(LOG_BASE_DIR)) {
      mkdirSync(LOG_BASE_DIR, { recursive: true });
    }
    
    // Session klasörünü oluştur
    if (!existsSync(SESSION_DIR)) {
      mkdirSync(SESSION_DIR, { recursive: true });
    }
    
    // Eski session'ları temizle
    cleanOldSessions();
  } catch {
    // Silent fail
  }
}

/**
 * 7 günden eski session'ları sil
 */
function cleanOldSessions(): void {
  try {
    const now = Date.now();
    const maxAge = MAX_SESSION_AGE_DAYS * 24 * 60 * 60 * 1000;
    
    const entries = readdirSync(LOG_BASE_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      // Sadece session klasörlerini kontrol et (YYYY-MM-DD formatında)
      if (!entry.isDirectory() || !entry.name.match(/^\d{4}-\d{2}-\d{2}/)) {
        continue;
      }
      
      const sessionPath = join(LOG_BASE_DIR, entry.name);
      const stats = statSync(sessionPath);
      
      if (now - stats.mtimeMs > maxAge) {
        rmSync(sessionPath, { recursive: true, force: true });
      }
    }
  } catch {
    // Silent fail
  }
}

/**
 * Log bir entry yaz
 */
function writeLog(entry: LogEntry): void {
  try {
    const line = JSON.stringify(entry) + "\n";
    
    // Ana log dosyasına yaz
    appendFileSync(LOG_FILE, line, "utf-8");
    
    // Hata ise error.log'a da yaz
    if (entry.level === "error") {
      appendFileSync(ERROR_FILE, line, "utf-8");
    }
  } catch {
    // Silent fail - logging hatası uygulamayı durdurmamalı
  }
}

/**
 * Tool çağrısı başlangıcını logla
 */
export function logToolCall(toolName: string, args: unknown): { startTime: number } {
  const startTime = Date.now();
  
  writeLog({
    timestamp: new Date().toISOString(),
    level: "info",
    tool: toolName,
    message: "Tool çağrısı başladı",
    args: truncateArgs(args),
  });
  
  return { startTime };
}

/**
 * Tool çağrısı başarılı sonucunu logla
 */
export function logToolSuccess(toolName: string, startTime: number): void {
  const duration = Date.now() - startTime;
  
  writeLog({
    timestamp: new Date().toISOString(),
    level: "info",
    tool: toolName,
    message: "Tool çağrısı başarılı",
    duration,
  });
}

/**
 * Tool çağrısı hatasını logla
 */
export function logToolError(toolName: string, error: Error, args: unknown, startTime?: number): void {
  const duration = startTime ? Date.now() - startTime : undefined;
  
  writeLog({
    timestamp: new Date().toISOString(),
    level: "error",
    tool: toolName,
    message: "Tool çağrısı hatası",
    args: truncateArgs(args),
    error: {
      message: error.message,
      stack: error.stack,
    },
    duration,
  });
  
  // Ayrıca stderr'e de yaz (MCP client görebilsin)
  console.error(`[MCP ERROR] ${toolName}: ${error.message}`);
}

/**
 * Genel hata logla
 */
export function logError(message: string, error?: Error): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: "error",
    message,
    error: error ? {
      message: error.message,
      stack: error.stack,
    } : undefined,
  });
}

/**
 * Debug log
 */
export function logDebug(message: string, data?: unknown): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: "debug",
    message,
    args: data,
  });
}

/**
 * Büyük argümanları kısalt (log dosyasını şişirmemek için)
 */
function truncateArgs(args: unknown, maxLength: number = 1000): unknown {
  if (args === null || args === undefined) return args;
  
  if (typeof args === "string") {
    if (args.length > maxLength) {
      return args.slice(0, maxLength) + `... (${args.length - maxLength} karakter kesildi)`;
    }
    return args;
  }
  
  if (typeof args === "object") {
    const truncated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
      if (typeof value === "string" && value.length > maxLength) {
        truncated[key] = value.slice(0, maxLength) + `... (${value.length - maxLength} karakter kesildi)`;
      } else {
        truncated[key] = value;
      }
    }
    return truncated;
  }
  
  return args;
}

/**
 * Mevcut session ID'yi döndür
 */
export function getCurrentSessionId(): string {
  return SESSION_ID;
}

/**
 * Session klasör yolunu döndür
 */
export function getSessionDir(): string {
  return SESSION_DIR;
}

/**
 * Log dosyasını oku (son N satır)
 */
export function readLogs(tail: number = 50, sessionId?: string): string[] {
  try {
    const targetSession = sessionId || SESSION_ID;
    const logFile = join(LOG_BASE_DIR, targetSession, "mcp.log");
    
    if (!existsSync(logFile)) return [];
    
    const content = readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    
    return lines.slice(-tail);
  } catch {
    return [];
  }
}

/**
 * Tüm session'ları listele
 */
export function listSessions(): Array<{ id: string; date: Date; size: number }> {
  try {
    const entries = readdirSync(LOG_BASE_DIR, { withFileTypes: true });
    const sessions: Array<{ id: string; date: Date; size: number }> = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.match(/^\d{4}-\d{2}-\d{2}/)) {
        continue;
      }
      
      const sessionPath = join(LOG_BASE_DIR, entry.name);
      const logFile = join(sessionPath, "mcp.log");
      
      let size = 0;
      if (existsSync(logFile)) {
        size = statSync(logFile).size;
      }
      
      const stats = statSync(sessionPath);
      
      sessions.push({
        id: entry.name,
        date: stats.mtime,
        size,
      });
    }
    
    // Tarihe göre sırala (en yeni önce)
    return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch {
    return [];
  }
}

/**
 * Session başlangıç logu
 */
writeLog({
  timestamp: new Date().toISOString(),
  level: "info",
  message: `MCP Server session başlatıldı: ${SESSION_ID}`,
});
