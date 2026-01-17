/**
 * Unified Console Logger for Hayalet-ev (Orchestrator)
 * 
 * Tüm console output'larını (main + renderer + webview) dosyaya yazar.
 * Session bazlı log dosyaları oluşturur.
 * 
 * Alt modüller:
 * - logger/session-manager.js: Session yönetimi
 * - logger/log-writer.js: Log yazma işlemleri
 * - logger/log-reader.js: Log okuma ve sorgulama
 */

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
} from "./logger/session-manager.js";

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
} from "./logger/log-writer.js";

export {
  readConsoleLogs,
  readErrorLogs,
  readAllLogs,
  queryLogs,
  calculateLogStats,
} from "./logger/log-reader.js";

import {
  initLogSystem,
  getSessionId,
  writeSessionSummary as _writeSessionSummary,
} from "./logger/session-manager.js";

import {
  writeLog,
  writeErrorLog,
  updateLogPaths,
  getCurrentChunkIndex as _getCurrentChunkIndex,
} from "./logger/log-writer.js";

import { calculateLogStats as _calculateLogStats } from "./logger/log-reader.js";

// ============================================
// ============================================

let mainWindowRef = null;

/**
 * Main window referansını ayarla (IPC için gerekli)
 * @param {Electron.BrowserWindow} win
 */
export function setMainWindow(win) {
  mainWindowRef = win;
}

/**
 * LogManager'a IPC üzerinden log gönder
 * @param {string} level - Log seviyesi
 * @param {string} source - Kaynak
 * @param {string} message - Mesaj
 * @param {object} [context] - Bağlam
 */
function forwardToLogManager(level, source, message, context = null) {
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
// ============================================

let correlationCounter = 0;

/**
 * Benzersiz correlation ID oluştur
 * @param {string} [prefix='op'] - ID prefix'i
 * @returns {string}
 */
export function generateCorrelationId(prefix = "op") {
  correlationCounter++;
  const timestamp = Date.now().toString(36);
  const counter = correlationCounter.toString(36).padStart(4, "0");
  return `${prefix}-${timestamp}-${counter}`;
}

// ============================================
// ============================================

/**
 * Main process console'unu intercept et
 */
export function interceptMainConsole() {
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
 * @param {Electron.WebContents} webContents
 */
export function setupRendererLogger(webContents) {
  webContents.on("console-message", (/** @type {any} */ event, /** @type {any} */ level, /** @type {any} */ message, /** @type {any} */ line, /** @type {any} */ sourceId) => {
    // Handle both old (separate params) and new (event object) API
    const _level = typeof level === 'number' ? level : event?.level ?? 0;
    const _message = typeof message === 'string' ? message : event?.message ?? '';
    const _line = typeof line === 'number' ? line : event?.line ?? 0;
    const _sourceId = typeof sourceId === 'string' ? sourceId : event?.sourceId ?? '';
    
    /** @type {Record<number, string>} */
    const levelMap = {
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
 * @param {Electron.WebContents} webviewContents - Webview webContents
 * @param {string} slot - Slot adı (ai1, ai2)
 * @param {string} [provider] - Provider adı (chatgpt, gemini, etc.)
 */
export function setupWebviewLogger(webviewContents, slot, provider = "unknown") {
  if (!webviewContents) return;

  const source = `WEBVIEW-${slot.toUpperCase()}`;

  webviewContents.on("console-message", (/** @type {any} */ event, /** @type {any} */ level, /** @type {any} */ message, /** @type {any} */ line, /** @type {any} */ sourceId) => {
    // Handle both old (separate params) and new (event object) API
    const _level = typeof level === 'number' ? level : event?.level ?? 0;
    const _message = typeof message === 'string' ? message : event?.message ?? '';
    const _line = typeof line === 'number' ? line : event?.line ?? 0;
    const _sourceId = typeof sourceId === 'string' ? sourceId : event?.sourceId ?? '';
    
    /** @type {Record<number, string>} */
    const levelMap = {
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

