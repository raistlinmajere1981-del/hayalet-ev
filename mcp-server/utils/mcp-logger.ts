/**
 * MCP Server Logger
 * 
 * Tool çağrılarını ve hataları log'a kaydeder.
 * Log dosyası: mcp-server/logs/mcp-server.log
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, renameSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_DIR = join(__dirname, "..", "logs");
const LOG_FILE = join(LOG_DIR, "mcp-server.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

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
 * Log bir entry yaz
 */
function writeLog(entry: LogEntry): void {
  try {
    const line = JSON.stringify(entry) + "\n";
    appendFileSync(LOG_FILE, line, "utf-8");
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
 * Log dosyasını oku (son N satır)
 */
export function readLogs(tail: number = 50): string[] {
  try {
    if (!existsSync(LOG_FILE)) return [];
    
    const content = readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n");
    
    return lines.slice(-tail);
  } catch {
    return [];
  }
}

/**
 * Log dosyası boyutunu kontrol et ve gerekirse rotate et
 */
export function rotateLogsIfNeeded(): void {
  try {
    if (!existsSync(LOG_FILE)) return;
    
    const stats = statSync(LOG_FILE);
    if (stats.size > MAX_LOG_SIZE) {
      const backupFile = LOG_FILE + ".old";
      
      // Eski backup'ı sil
      if (existsSync(backupFile)) {
        unlinkSync(backupFile);
      }
      
      // Mevcut log'u backup yap
      renameSync(LOG_FILE, backupFile);
    }
  } catch {
    // Silent fail
  }
}

// Startup'ta log rotation kontrol et
rotateLogsIfNeeded();
