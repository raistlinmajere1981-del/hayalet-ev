/**
 * LogWriter - Log yazma işlemleri
 *
 * Bu modül log dosyalarına yazma işlemlerini yönetir:
 * - Log mesajı formatlama
 * - Dosyaya yazma (chunk rotation ile)
 * - Structured log (JSONL)
 * - State snapshot yazma
 */

import { appendFile } from "fs/promises";
import { join } from "path";
import { ensureSessionDir, getSessionDir, getAppState } from "./session-manager.ts";
import type { LogLevel, LogSource, LogContext, StructuredLogEntry } from "../types/index.ts";

let currentChunkIndex = 1;
let currentChunkLines = 0;
const MAX_CHUNK_LINES = 10000;

let CONSOLE_LOG: string | null = null;
let ERROR_LOG: string | null = null;
let STRUCTURED_LOG: string | null = null;

/**
 * Log dosya yollarını güncelle
 */
export function updateLogPaths(): void {
  const sessionDir = getSessionDir();
  if (!sessionDir) return;
  
  CONSOLE_LOG = join(sessionDir, `console-${String(currentChunkIndex).padStart(3, "0")}.log`);
  ERROR_LOG = join(sessionDir, "error.log");
  STRUCTURED_LOG = join(sessionDir, "structured.jsonl");
}

/**
 * Log mesajını formatla
 */
export function formatLog(
  level: LogLevel | string,
  source: LogSource | string,
  args: unknown[],
  context: LogContext | null = null
): string {
  const timestamp = new Date().toISOString();
  const message = args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");

  let logLine = `[${timestamp}] [${level}] [${source}]`;
  
  if (context?.correlationId) {
    logLine += ` [${context.correlationId}]`;
  }
  
  logLine += ` ${message}`;
  
  if (context && Object.keys(context).length > 0) {
    const ctxWithoutCorrelation = { ...context };
    delete ctxWithoutCorrelation.correlationId;
    if (Object.keys(ctxWithoutCorrelation).length > 0) {
      logLine += ` | ctx: ${JSON.stringify(ctxWithoutCorrelation)}`;
    }
  }
  
  return logLine + "\n";
}

/**
 * Log dosyasına yaz (chunk rotation ile)
 */
export async function writeLog(
  level: LogLevel | string,
  source: LogSource | string,
  args: unknown[],
  context: LogContext | null = null,
  isError: boolean = false
): Promise<void> {
  try {
    await ensureSessionDir();
    updateLogPaths();
    
    const logMessage = formatLog(level, source, args, context);
    
    if (CONSOLE_LOG) {
      await appendFile(CONSOLE_LOG, logMessage);
      
      currentChunkLines++;
      if (currentChunkLines >= MAX_CHUNK_LINES) {
        currentChunkIndex++;
        currentChunkLines = 0;
        updateLogPaths();
      }
    }
    
    if (isError && ERROR_LOG) {
      await appendFile(ERROR_LOG, logMessage);
    }
  } catch (_err) {
  }
}

/**
 * Sadece error log'a yaz
 */
export async function writeErrorLog(
  level: LogLevel | string,
  source: LogSource | string,
  args: unknown[],
  context: LogContext | null = null
): Promise<void> {
  try {
    await ensureSessionDir();
    updateLogPaths();
    
    if (!ERROR_LOG) return;
    
    const logMessage = formatLog(level, source, args, context);
    await appendFile(ERROR_LOG, logMessage);
  } catch (_err) {
  }
}

/**
 * Structured log yaz (JSONL format + console log'a da yaz)
 */
export async function writeStructuredLog(entry: StructuredLogEntry): Promise<void> {
  try {
    await ensureSessionDir();
    updateLogPaths();
    
    if (!STRUCTURED_LOG) return;
    
    // JSONL dosyasına yaz (detaylı analiz için)
    await appendFile(STRUCTURED_LOG, JSON.stringify(entry) + "\n");
    
    // Console log'a da okunabilir formatta yaz (birleşik log)
    if (CONSOLE_LOG) {
      const visibility = entry.visibility ? `[L${entry.visibility}]` : "";
      const source = entry.source || "unknown";
      const type = entry.type || "info";
      const message = entry.message || "";
      const timestamp = entry.isoTimestamp || new Date().toISOString();
      
      let logLine = `[${timestamp}] [${type.toUpperCase()}] ${visibility} [RENDERER] [${source}] ${message}`;
      
      if (entry.meta && Object.keys(entry.meta).length > 0) {
        logLine += ` | meta: ${JSON.stringify(entry.meta)}`;
      }
      
      await appendFile(CONSOLE_LOG, logLine + "\n");
      
      currentChunkLines++;
      if (currentChunkLines >= MAX_CHUNK_LINES) {
        currentChunkIndex++;
        currentChunkLines = 0;
        updateLogPaths();
      }
    }
  } catch (_err) {
  }
}

/**
 * State snapshot yaz
 */
export async function writeStateSnapshot(): Promise<void> {
  try {
    await ensureSessionDir();
    const sessionDir = getSessionDir();
    if (!sessionDir) return;
    
    const snapshot = {
      timestamp: new Date().toISOString(),
      state: getAppState(),
      memory: process.memoryUsage(),
    };
    
    const snapshotPath = join(sessionDir, "state-snapshots.jsonl");
    await appendFile(snapshotPath, JSON.stringify(snapshot) + "\n");
  } catch (_err) {
  }
}

// ============================================
// Getters
// ============================================

export function getConsoleLogPath(): string | null {
  return CONSOLE_LOG;
}

export function getErrorLogPath(): string | null {
  return ERROR_LOG;
}

export function getStructuredLogPath(): string | null {
  return STRUCTURED_LOG;
}

export function getCurrentChunkIndex(): number {
  return currentChunkIndex;
}

export { CONSOLE_LOG, ERROR_LOG, STRUCTURED_LOG };
