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
import { ensureSessionDir, getSessionDir, getAppState } from "./session-manager.js";

let currentChunkIndex = 1;
let currentChunkLines = 0;
const MAX_CHUNK_LINES = 10000;

let CONSOLE_LOG = null;
let ERROR_LOG = null;
let STRUCTURED_LOG = null;

/**
 * Log dosya yollarını güncelle
 */
export function updateLogPaths() {
  const sessionDir = getSessionDir();
  if (!sessionDir) return;
  
  CONSOLE_LOG = join(sessionDir, `console-${String(currentChunkIndex).padStart(3, "0")}.log`);
  ERROR_LOG = join(sessionDir, "error.log");
  STRUCTURED_LOG = join(sessionDir, "structured.jsonl");
}

/**
 * Log mesajını formatla
 * @param {string} level - Log seviyesi
 * @param {string} source - Kaynak (MAIN, RENDERER, WEBVIEW-AI1, etc.)
 * @param {any[]} args - Log argümanları
 * @param {object} [context] - Ek bağlam bilgisi
 * @returns {string}
 */
export function formatLog(level, source, args, context = null) {
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
 * @param {string} level - Log seviyesi
 * @param {string} source - Kaynak
 * @param {any[]} args - Log argümanları
 * @param {object} [context] - Ek bağlam
 * @param {boolean} [isError=false] - Error log'a da yaz
 */
export async function writeLog(level, source, args, context = null, isError = false) {
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
 * @param {string} level - Log seviyesi
 * @param {string} source - Kaynak
 * @param {any[]} args - Log argümanları
 * @param {object} [context] - Ek bağlam
 */
export async function writeErrorLog(level, source, args, context = null) {
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
 * Structured log yaz (JSONL format)
 * @param {object} entry - Log girdisi
 */
export async function writeStructuredLog(entry) {
  try {
    await ensureSessionDir();
    updateLogPaths();
    
    if (!STRUCTURED_LOG) return;
    
    await appendFile(STRUCTURED_LOG, JSON.stringify(entry) + "\n");
  } catch (_err) {
  }
}

/**
 * State snapshot yaz
 */
export async function writeStateSnapshot() {
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
// ============================================

export function getConsoleLogPath() {
  return CONSOLE_LOG;
}

export function getErrorLogPath() {
  return ERROR_LOG;
}

export function getStructuredLogPath() {
  return STRUCTURED_LOG;
}

export function getCurrentChunkIndex() {
  return currentChunkIndex;
}

export { CONSOLE_LOG, ERROR_LOG, STRUCTURED_LOG };
