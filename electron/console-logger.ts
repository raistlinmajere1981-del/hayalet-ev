/**
 * Unified Console Logger for Hayalet-ev (Orchestrator)
 *
 * Tüm console output'larını (main + renderer + webview) dosyaya yazar.
 * Session bazlı log dosyaları oluşturur.
 *
 * Alt modüller:
 * - logger/session-manager.ts: Session yönetimi
 * - logger/log-writer.ts: Log yazma işlemleri
 * - logger/log-reader.ts: Log okuma ve sorgulama
 */

import type { BrowserWindow } from "electron";

export {
  generateSessionId,
  initLogSystem,
  ensureSessionDir,
  writeSessionSummary,
  listSessions,
  clearLogs,
  updateAppState,
  getAppState,
  getSessionId,
  getSessionDir,
  getLogDir,
  SESSION_ID,
  SESSION_DIR,
  LOG_DIR,
} from "./logger/session-manager.ts";

export {
  formatLog,
  writeLog,
  writeErrorLog,
  writeStructuredLog,
  writeStateSnapshot,
  updateLogPaths,
  getConsoleLogPath,
  getErrorLogPath,
  getStructuredLogPath,
  getCurrentChunkIndex,
  CONSOLE_LOG,
  ERROR_LOG,
  STRUCTURED_LOG,
} from "./logger/log-writer.ts";

export {
  readConsoleLogs,
  readErrorLogs,
  readAllLogs,
  queryLogs,
  calculateLogStats,
} from "./logger/log-reader.ts";

import {
  initLogSystem,
  getSessionId,
  writeSessionSummary as _writeSessionSummary,
} from "./logger/session-manager.ts";

import {
  writeLog,
  writeErrorLog,
  updateLogPaths,
  getCurrentChunkIndex as _getCurrentChunkIndex,
} from "./logger/log-writer.ts";

import { calculateLogStats as _calculateLogStats } from "./logger/log-reader.ts";

// ============================================
// State
// ============================================

let mainWindowRef: BrowserWindow | null = null;

/**
 * Erken loglar - UI hazır olmadan önce oluşan loglar
 * Renderer hazır olduğunda bu loglar IPC ile gönderilir
 */
interface EarlyLog {
  level: string;
  source: string;
  message: string;
  timestamp: string;
  visibility: 1 | 2 | 3;
}

const earlyLogs: EarlyLog[] = [];
const MAX_EARLY_LOGS = 100;

/**
 * Log visibility seviyesini belirle
 * 1 = toast (error, warning)
 * 2 = panel (info, system)
 * 3 = verbose (debug)
 */
function inferVisibility(level: string, source: string): 1 | 2 | 3 {
  if (level === 'error' || level === 'warning') return 1;
  if (level === 'debug') return 3;
  
  // Sistem ve DB logları panel seviyesinde
  const panelSources = ['DB', 'session-manager', 'MAIN', 'WindowManager', 'OPENCODE'];
  if (panelSources.some(s => source.includes(s))) return 2;
  
  return 2; // Default panel
}

/**
 * Main window referansını ayarla (IPC için gerekli)
 */
export function setMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win;
}

/**
 * Renderer'a hazır olduğunu bildir - erken logları temizle
 */
// Not: setRendererReady gelecekte erken logları temizlemek için kullanılacak
// export function setRendererReady(): void { }

/**
 * Erken logları al (IPC handler için)
 */
export function getEarlyLogs(): EarlyLog[] {
  return [...earlyLogs];
}

/**
 * Erken logları temizle
 */
export function clearEarlyLogs(): void {
  earlyLogs.length = 0;
}

/**
 * LogManager'a IPC üzerinden log gönder
 */
function forwardToLogManager(
  level: string,
  source: string,
  message: string,
  context: Record<string, unknown> | null = null
): void {
  const visibility = inferVisibility(level, source);
  const timestamp = new Date().toISOString();
  
  // FIX: Daha kapsamlı hazırlık kontrolü - webContents tam hazır olmalı
  if (!mainWindowRef || mainWindowRef.isDestroyed()) {
    // Erken log olarak sakla
    if (earlyLogs.length < MAX_EARLY_LOGS) {
      earlyLogs.push({ level, source, message, timestamp, visibility });
    }
    return;
  }
  
  const webContents = mainWindowRef.webContents;
  if (!webContents || webContents.isDestroyed()) {
    if (earlyLogs.length < MAX_EARLY_LOGS) {
      earlyLogs.push({ level, source, message, timestamp, visibility });
    }
    return;
  }
  
  // WebContents'in IPC mesajı alabilecek durumda olup olmadığını kontrol et
  try {
    // Sadece hazır olan pencereye gönder
    if (webContents.isLoading()) {
      if (earlyLogs.length < MAX_EARLY_LOGS) {
        earlyLogs.push({ level, source, message, timestamp, visibility });
      }
      return;
    }
    
    webContents.send("console-log-forward", {
      level,
      source,
      message,
      context,
      timestamp,
      visibility,
    });
  } catch (_err) {
    // Sessizce geç - IPC henüz hazır değil
    if (earlyLogs.length < MAX_EARLY_LOGS) {
      earlyLogs.push({ level, source, message, timestamp, visibility });
    }
  }
}

// ============================================
// Correlation ID
// ============================================

let correlationCounter = 0;

/**
 * Benzersiz correlation ID oluştur
 */
export function generateCorrelationId(prefix: string = "op"): string {
  correlationCounter++;
  const timestamp = Date.now().toString(36);
  const counter = correlationCounter.toString(36).padStart(4, "0");
  return `${prefix}-${timestamp}-${counter}`;
}

// ============================================
// Console Interception
// ============================================

/**
 * Main process console'unu intercept et
 */
export function interceptMainConsole(): void {
  if (!getSessionId()) initLogSystem();
  updateLogPaths();

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  console.log = (...args) => {
    originalLog(...args);
    writeLog("LOG", "MAIN", args);
    forwardToLogManager("info", "main", args.join(" "));
  };

  console.warn = (...args) => {
    originalWarn(...args);
    writeLog("WARN", "MAIN", args, null, true);
    forwardToLogManager("warning", "main", args.join(" "));
  };

  console.error = (...args) => {
    originalError(...args);
    writeErrorLog("ERROR", "MAIN", args);
    forwardToLogManager("error", "main", args.join(" "));
  };

  console.info = (...args) => {
    originalInfo(...args);
    writeLog("INFO", "MAIN", args);
    forwardToLogManager("info", "main", args.join(" "));
  };

  console.debug = (...args) => {
    originalDebug(...args);
    writeLog("DEBUG", "MAIN", args);
    forwardToLogManager("debug", "main", args.join(" "));
  };
}

/**
 * Renderer process loglarını dinle
 */
export function setupRendererLogger(webContents: Electron.WebContents): void {
  // Yeni Event<WebContentsConsoleMessageEventParams> API kullanımı
  webContents.on("console-message", (details) => {
    // Event objesinden değerleri al (yeni API)
    // level: 0=verbose, 1=info, 2=warning, 3=error
    const level = Number(details.level);
    const message = details.message as string;
    const line = (details as unknown as { line?: number }).line ?? 0;
    const sourceId = details.sourceId as string | undefined;
    
    const levelMap: Record<number, string> = {
      0: "LOG",
      1: "INFO",
      2: "WARN",
      3: "ERROR",
    };

    const levelName = levelMap[level] || "LOG";
    const source = sourceId ? ` (${sourceId}:${line})` : "";
    const fullMessage = `${message}${source}`;

    const isError = level === 3;
    const isWarn = level === 2;
    
    writeLog(levelName, "RENDERER", [fullMessage], null, isError || isWarn);

    const logType = isError ? "error" : isWarn ? "warning" : "info";
    forwardToLogManager(logType, "renderer", fullMessage);
  });

  webContents.on("render-process-gone", (_event, details) => {
    const msg = `Renderer process crashed: ${JSON.stringify(details)}`;
    writeErrorLog("FATAL", "RENDERER", [msg]);
    forwardToLogManager("error", "renderer", msg);
  });

  webContents.on("preload-error", (_event, preloadPath, error) => {
    const msg = `Preload script error: ${preloadPath} - ${error.stack || error}`;
    writeErrorLog("PRELOAD-ERROR", "RENDERER", [msg]);
    forwardToLogManager("error", "preload", msg);
  });
}

/**
 * Webview loglarını dinle
 */
export function setupWebviewLogger(
  webviewContents: Electron.WebContents | null,
  slot: string,
  provider: string = "unknown"
): void {
  if (!webviewContents) return;

  const source = `WEBVIEW-${slot.toUpperCase()}`;

  // Yeni Event<WebContentsConsoleMessageEventParams> API kullanımı
  webviewContents.on("console-message", (details) => {
    // Event objesinden değerleri al (yeni API)
    // level: 0=verbose, 1=info, 2=warning, 3=error
    const level = Number(details.level);
    const message = String(details.message);
    const line = (details as unknown as { line?: number }).line ?? 0;
    const sourceId = details.sourceId ? String(details.sourceId) : undefined;
    
    const levelMap: Record<number, string> = {
      0: "LOG",
      1: "INFO",
      2: "WARN",
      3: "ERROR",
    };

    const levelName = levelMap[level] || "LOG";
    const sourceInfo = sourceId ? ` (${sourceId}:${line})` : "";
    const fullMessage = `[${provider}] ${message}${sourceInfo}`;

    const context = { provider, slot, url: webviewContents.getURL?.() || "" };
    const isError = level === 3;
    const isWarn = level === 2;

    writeLog(levelName, source, [fullMessage], context, isError || isWarn);

    const logType = isError ? "error" : isWarn ? "warning" : "info";
    forwardToLogManager(logType, `webview-${slot}`, fullMessage, context);
  });

  webviewContents.on("render-process-gone", (_event, details) => {
    const msg = `Webview crashed: ${JSON.stringify(details)}`;
    const context = { provider, slot };
    writeErrorLog("FATAL", source, [msg], context);
    forwardToLogManager("error", `webview-${slot}`, msg, context);
  });

  webviewContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return;
    const msg = `Load failed: ${errorDescription} (${errorCode}) - ${validatedURL}`;
    const context = { provider, slot, errorCode, url: validatedURL };
    writeErrorLog("LOAD-ERROR", source, [msg], context);
    forwardToLogManager("error", `webview-${slot}`, msg, context);
  });
}

