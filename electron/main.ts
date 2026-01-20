import { app, BrowserWindow, dialog, shell } from "electron";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { deviceActionHandler } from "./device-manager.ts";
import { capturePageHandler, screenshotCaptureHandler } from "./screenshot-manager.ts";
import { appendLog } from "./log-manager.ts";
import { whisperLoad, whisperSave } from "./whisper-manager.ts";
import {
  commandInit,
  commandWrite,
  commandPaths,
  commandStageAttachments,
  commandStageTemp,
  commandCleanupTemp,
  commandMoveFailed,
  commandArchiveCopy,
  commandCleanupJob,
  commandMove,
} from "./command-manager.ts";
import { DatabaseManager } from "./database/index.ts";
import {
  fmWriteFileAtomic,
  readFileAsBase64,
  copyToAssets,
  copyFileTo,
  deleteAsset,
  generateTree,
} from "./file-manager.ts";
import {
  createWindow as createAppWindow,
  initWindowManager,
  setTrayIconPath,
} from "./window-manager.ts";
import { catboxUpload, uguuUpload } from "./webview-manager.ts";
import {
  googledriveStartAuth,
  googledriveExchangeCode,
  googledriveDisconnect,
  googledriveUpload,
} from "./googledrive-manager.ts";
import { OpenCodeManager } from "./opencode-manager.ts";
import { OpenCodeSSEServer } from "./opencode-sse-server.ts";
import {
  initLogSystem,
  interceptMainConsole,
  setupRendererLogger,
  setupWebviewLogger,
  setMainWindow,
  getSessionId,
  getEarlyLogs,
  clearEarlyLogs,
  getSessionDir,
  getLogDir,
  readConsoleLogs,
  readErrorLogs,
  readAllLogs,
  queryLogs,
  listSessions,
  writeStateSnapshot,
  writeSessionSummary,
  updateAppState,
  getAppState,
  generateCorrelationId,
  CONSOLE_LOG,
  ERROR_LOG,
} from "./console-logger.ts";
import { SessionManager } from "./session-manager.ts";
import { MetaCommandManager } from "./meta-command-manager.ts";
import type { LogQueryParams } from "./types/index.ts";

// Handler Setup Imports
import { setupFsHandlers } from "./handlers/ipc-fs.ts";
import { setupWindowHandlers } from "./handlers/ipc-window.ts";
import { setupProviderHandlers } from "./handlers/ipc-provider.ts";
import { setupSettingsHandlers } from "./handlers/ipc-settings.ts";
import { setupDatabaseHandlers } from "./handlers/ipc-database.ts";
import { registerHandler } from "./handlers/ipc-helpers.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CDP (Chrome DevTools Protocol) remote debugging için port ayarla
const CDP_PORT = process.env.CDP_PORT || 9222;
app.commandLine.appendSwitch("remote-debugging-port", CDP_PORT.toString());

let mainWindow: BrowserWindow | null = null;

initLogSystem();

interceptMainConsole();

if (process.stdout && process.stdout.isTTY) {
  try {
    process.stdout.write("\x1b[?1004l");
  } catch (e) {}
}

updateAppState({
  startTime: new Date().toISOString(),
  platform: process.platform,
  nodeVersion: process.version,
});

// Single instance lock - ikinci kopyanın açılmasını engelle
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Başka bir instance zaten çalışıyor, bu instance'ı kapat
  console.log("Another instance is already running. Exiting...");
  app.quit();
} else {
  // İkinci instance açılmaya çalışıldığında mevcut pencereyi ön plana getir
  app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
    if (mainWindow) {
      // Minimize edilmişse restore et
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      // Pencereyi ön plana getir
      mainWindow.focus();
      console.log("Second instance attempted - focused existing window");
    }
  });
}

app.whenReady().then(async () => {
  try {
    // Startup cache temizliği (login bilgileri korunur)
    try {
      await SessionManager.clearStartupCache();
    } catch (e: unknown) {
      console.warn("Startup cache temizliği başarısız:", (e as Error)?.message);
    }

    mainWindow = await createAppWindow({ __dirname });

    setMainWindow(mainWindow);

    setupRendererLogger(mainWindow.webContents);

    // Setup Modular Handlers
    setupFsHandlers(mainWindow);
    setupWindowHandlers();
    setupProviderHandlers(__dirname);
    setupSettingsHandlers();
    setupDatabaseHandlers();

    try {
      initWindowManager({ mainWindow });
    } catch (e) {}

    // System tray icon path'i kaydet (lazy - sadece minimize edilince oluşur)
    try {
      const iconPath = join(__dirname, "../src/assets/icon.png");
      setTrayIconPath(iconPath);
    } catch (e) {
      console.error("Tray icon path hatası:", e);
    }
  } catch (err: unknown) {
    console.error("CRITICAL: createAppWindow failed:", err);
    process.exit(1);
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createAppWindow({ __dirname });
    }
  });
});

// Cleanup tamamlandı mı flag'i
let cleanupDone = false;

/**
 * Uygulama kapanmadan önce cleanup işlemlerini yap
 */
async function performCleanup() {
  if (cleanupDone) return;
  cleanupDone = true;

  console.log("[MAIN] Cleanup başlatılıyor...");

  // OpenCode server'ı kapat
  try {
    await OpenCodeManager.cleanup();
    console.log("[MAIN] OpenCode server kapatıldı");
  } catch (err: unknown) {
    console.error("[MAIN] OpenCode cleanup failed:", err);
  }

  // SSE Server'ı kapat
  try {
    await OpenCodeSSEServer.stop();
    console.log("[MAIN] SSE Server kapatıldı");
  } catch (err: unknown) {
    console.error("[MAIN] SSE Server cleanup failed:", err);
  }

  // Session summary yaz
  try {
    // writeSessionSummary(totalLogs, errorCount, warnCount, chunkIndex, endReason)
    await writeSessionSummary(0, 0, 0, 0, "normal");
    console.log("[MAIN] Session summary yazıldı");
  } catch (err: unknown) {
    console.error("[MAIN] Failed to write session summary:", err);
  }
}

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    // X butonu ile kapatıldığında cleanup yap
    await performCleanup();
    app.quit();
  }
});

app.on("will-quit", async () => {
  // Database bağlantılarını kapat
  DatabaseManager.closeAll();
  // Cleanup henüz yapılmadıysa yap
  await performCleanup();
});

app.on("before-quit", async () => {
  // Cleanup henüz yapılmadıysa yap
  await performCleanup();
});

if (process.platform !== "win32") {
  process.on("SIGTERM", () => {
    app.quit();
  });

  process.on("SIGINT", () => {
    app.quit();
  });
}

// ============================================================================
// Remaining IPC Handlers (Not yet refactored to modules)
// ============================================================================

registerHandler("device-action", deviceActionHandler);

registerHandler("show-message-box", async (_event, options: Electron.MessageBoxOptions) => {
  if (!mainWindow) {
    return { response: 0, checkboxChecked: false };
  }
  return await dialog.showMessageBox(mainWindow, options);
});

registerHandler("fm-write-file-atomic", fmWriteFileAtomic);
registerHandler("read-file", readFileAsBase64);
registerHandler("catbox-upload", catboxUpload);

// Güvenilir Google OAuth domain'leri
const ALLOWED_GOOGLE_AUTH_DOMAINS = ["accounts.google.com"];

registerHandler("googledrive-start-auth", async (event) => {
  const result = await googledriveStartAuth(event);
  if (result?.success && result?.authUrl) {
    try {
      const urlObj = new URL(result.authUrl);
      if (!ALLOWED_GOOGLE_AUTH_DOMAINS.includes(urlObj.hostname)) {
        return { ...result, success: false, message: "Güvenilmeyen URL: " + urlObj.hostname };
      }
      await shell.openExternal(result.authUrl);
    } catch (err: unknown) {
      return { ...result, message: "Tarayıcı açılamadı: " + ((err as Error)?.message || "hata") };
    }
  }
  return result;
});
registerHandler("googledrive-exchange-code", googledriveExchangeCode);
registerHandler("googledrive-disconnect", googledriveDisconnect);
registerHandler("googledrive-upload", googledriveUpload);

registerHandler("uguu-upload", uguuUpload);

registerHandler("whisper-load", whisperLoad);
registerHandler("whisper-save", whisperSave);

// server-command-run ve server-command-list kaldırıldı (preload'da expose edilmiyordu)

registerHandler("command-init", commandInit);
registerHandler("command-write", commandWrite);
registerHandler("command-paths", commandPaths);
registerHandler("command-stage-attachments", commandStageAttachments);
registerHandler("command-stage-temp", commandStageTemp);
registerHandler("command-cleanup-temp", commandCleanupTemp);
registerHandler("command-move-failed", commandMoveFailed);
registerHandler("command-archive-copy", commandArchiveCopy);
registerHandler("command-cleanup-job", commandCleanupJob);
registerHandler("command-move", commandMove);

registerHandler("capture-page", capturePageHandler);
registerHandler("screenshot-capture", screenshotCaptureHandler);

// Database IPC Handlers - Moved to handlers/ipc-database.ts

// Meta Command IPC handlers
registerHandler("meta-define-command", (event, params: { name: string; description?: string; code: string; createdBy?: string }) =>
  MetaCommandManager.defineCommand(event, params)
);
registerHandler("meta-delete-command", (event, params: { name: string }) =>
  MetaCommandManager.deleteCommand(event, params)
);
registerHandler("meta-list-commands", (event) => MetaCommandManager.listCommands(event));
registerHandler("meta-get-command", (event, params: { name: string }) =>
  MetaCommandManager.getCommand(event, params)
);

registerHandler("append-log", appendLog);

registerHandler("copy-to-assets", copyToAssets);
registerHandler("copy-file-to", copyFileTo);
registerHandler("delete-asset", deleteAsset);
registerHandler("generate-tree", generateTree);

registerHandler("read-console-logs", async (_event, tail: number = 100) => await readConsoleLogs(tail));
registerHandler("read-error-logs", async (_event, tail: number = 100) => await readErrorLogs(tail));

registerHandler("get-log-paths", async () => {
  return {
    console: CONSOLE_LOG,
    error: ERROR_LOG,
    sessionDir: getSessionDir(),
    logDir: getLogDir(),
  };
});

registerHandler("get-session-id", async () => getSessionId());

// Erken logları al (UI hazır olmadan önce oluşanlar)
registerHandler("get-early-logs", async () => {
  const logs = getEarlyLogs();
  clearEarlyLogs(); // Alındıktan sonra temizle
  return logs;
});

registerHandler(
  "read-all-logs",
  async (_event, targetSessionId: string | null = null) => await readAllLogs(targetSessionId)
);
registerHandler("query-logs", async (_event, query: LogQueryParams = {}) => await queryLogs(query));
registerHandler("list-sessions", async () => await listSessions());

registerHandler("get-app-state", async () => getAppState());

registerHandler("write-state-snapshot", async () => {
  await writeStateSnapshot();
  return { success: true };
});

registerHandler("setup-webview-logger", async (_event, webviewId: number, slot: string, provider: string) => {
  const { webContents } = await import("electron");
  const wc = webContents.fromId(webviewId);
  if (wc) {
    setupWebviewLogger(wc, slot, provider);
    return { success: true };
  }
  return { success: false, error: "WebContents not found" };
});

registerHandler("generate-correlation-id", async (_event, prefix: string = "op") => {
  return generateCorrelationId(prefix);
});

// OpenCode Server IPC Handlers
registerHandler(
  "opencode-start",
  async (_event, options: { port?: number; cors?: string; projectPath?: string } = {}) => await OpenCodeManager.start(options)
);
registerHandler("opencode-stop", async () => await OpenCodeManager.stop());
registerHandler("opencode-status", async () => OpenCodeManager.getStatus());

// OpenCode SSE Server IPC Handlers
registerHandler(
  "opencode-sse-start",
  async (_event, config: { port?: number; host?: string; corsOrigin?: string } = {}) => await OpenCodeSSEServer.start(config)
);
registerHandler("opencode-sse-stop", async () => await OpenCodeSSEServer.stop());
registerHandler("opencode-sse-status", async () => OpenCodeSSEServer.getStatus());
registerHandler("opencode-sse-session", async () => OpenCodeSSEServer.getSession());
registerHandler("opencode-sse-start-session", async () => OpenCodeSSEServer.startSession());
registerHandler("opencode-sse-end-session", async () => OpenCodeSSEServer.endSession());
registerHandler("opencode-sse-connect", async () => await OpenCodeSSEServer.connectToOpenCode());
registerHandler("opencode-sse-disconnect", async () => OpenCodeSSEServer.disconnectFromOpenCode());
