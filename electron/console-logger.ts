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
 * Main window referansını ayarla (IPC için gerekli)
 */
export function setMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win;
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
  // FIX: Daha kapsamlı hazırlık kontrolü - webContents tam hazır olmalı
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
  
  const webContents = mainWindowRef.webContents;
  if (!webContents || webContents.isDestroyed()) return;
  
  // WebContents'in IPC mesajı alabilecek durumda olup olmadığını kontrol et
  // isLoading() true ise veya henüz did-finish-load olmadıysa mesaj göndermeyiz
  try {
    // Sadece hazır olan pencereye gönder
    if (webContents.isLoading()) return;
    
    webContents.send("console-log-forward", {
      level,
      source,
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (_err) {
    // Sessizce geç - IPC henüz hazır değil
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
  webContents.on("console-message", (event: unknown, level: unknown, message: unknown, line: unknown, sourceId: unknown) => {
    // Handle both old (separate params) and new (event object) API
    const _event = event as Record<string, unknown>;
    const _level = typeof level === 'number' ? level : (_event?.level as number) ?? 0;
    const _message = typeof message === 'string' ? message : (_event?.message as string) ?? '';
    const _line = typeof line === 'number' ? line : (_event?.line as number) ?? 0;
    const _sourceId = typeof sourceId === 'string' ? sourceId : (_event?.sourceId as string) ?? '';

    const levelMap: Record<number, string> = {
      0: "LOG",
      1: "WARN",
      2: "ERROR",
      3: "DEBUG",
    };

    const levelName = levelMap[_level] || "LOG";
    const source = _sourceId ? ` (${_sourceId}:${_line})` : "";
    const fullMessage = `${_message}${source}`;

    const isError = _level === 2;
    const isWarn = _level === 1;
    
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

  webviewContents.on("console-message", (event: unknown, level: unknown, message: unknown, line: unknown, sourceId: unknown) => {
    // Handle both old (separate params) and new (event object) API
    const _event = event as Record<string, unknown>;
    const _level = typeof level === 'number' ? level : (_event?.level as number) ?? 0;
    const _message = typeof message === 'string' ? message : (_event?.message as string) ?? '';
    const _line = typeof line === 'number' ? line : (_event?.line as number) ?? 0;
    const _sourceId = typeof sourceId === 'string' ? sourceId : (_event?.sourceId as string) ?? '';

    const levelMap: Record<number, string> = {
      0: "LOG",
      1: "WARN",
      2: "ERROR",
      3: "DEBUG",
    };

    const levelName = levelMap[_level] || "LOG";
    const sourceInfo = _sourceId ? ` (${_sourceId}:${_line})` : "";
    const fullMessage = `[${provider}] ${_message}${sourceInfo}`;

    const context = { provider, slot, url: webviewContents.getURL?.() || "" };
    const isError = _level === 2;
    const isWarn = _level === 1;

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

