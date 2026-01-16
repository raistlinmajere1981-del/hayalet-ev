import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { deviceActionHandler } from "./device-manager.js";
import { capturePageHandler, screenshotCaptureHandler } from "./screenshot-manager.js";
import { appendLog } from "./log-manager.js";
import { whisperLoad, whisperSave } from "./whisper-manager.js";
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
} from "./command-manager.js";
import { DatabaseManager } from "./database/index.js";
import {
  fmWriteFileAtomic,
  readFileAsBase64,
  copyToAssets,
  copyFileTo,
  deleteAsset,
  generateTree,
  openPath,
} from "./file-manager.js";
import {
  createWindow as createAppWindow,
  initWindowManager,
  setTrayIconPath,
  appRestart,
} from "./window-manager.js";
import { catboxUpload, uguuUpload } from "./webview-manager.js";
import {
  googledriveStartAuth,
  googledriveExchangeCode,
  googledriveDisconnect,
  googledriveUpload,
} from "./googledrive-manager.js";
import { ServerCommands } from "./server-commands.js";
import { OpenCodeManager } from "./opencode-manager.js";
import {
  initLogSystem,
  interceptMainConsole,
  setupRendererLogger,
  setupWebviewLogger,
  setMainWindow,
  getSessionId,
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
} from "./console-logger.js";
import { SessionManager } from "./session-manager.js";
import { MetaCommandManager } from "./meta-command-manager.js";

// Handler Setup Imports
import { setupFsHandlers } from "./handlers/ipc-fs.js";
import { setupWindowHandlers } from "./handlers/ipc-window.js";
import { setupProviderHandlers } from "./handlers/ipc-provider.js";
import { setupSettingsHandlers } from "./handlers/ipc-settings.js";
import { registerHandler } from "./handlers/ipc-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CDP (Chrome DevTools Protocol) remote debugging için port ayarla
const CDP_PORT = process.env.CDP_PORT || 9222;
app.commandLine.appendSwitch("remote-debugging-port", CDP_PORT.toString());

let mainWindow;

const { sessionId } = initLogSystem();

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

app.whenReady().then(async () => {
  try {
    // Startup cache temizliği (login bilgileri korunur)
    try {
      await SessionManager.clearStartupCache();
    } catch (e) {
      console.warn("Startup cache temizliği başarısız:", e?.message);
    }

    mainWindow = await createAppWindow({ __dirname });

    setMainWindow(mainWindow);

    setupRendererLogger(mainWindow.webContents);

    // Setup Modular Handlers
    setupFsHandlers(mainWindow);
    setupWindowHandlers();
    setupProviderHandlers(__dirname);
    setupSettingsHandlers();

    try {
      ServerCommands?.init?.({ mainWindow });
    } catch (e) {}
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
  } catch (err) {
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
  } catch (err) {
    console.error("[MAIN] OpenCode cleanup failed:", err);
  }

  // Session summary yaz
  try {
    await writeSessionSummary("normal");
    console.log("[MAIN] Session summary yazıldı");
  } catch (err) {
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

registerHandler("show-message-box", async (event, options = {}) => {
  const win = mainWindow || null;
  return await dialog.showMessageBox(win, options || {});
});

registerHandler("fm-write-file-atomic", fmWriteFileAtomic);
registerHandler("read-file", readFileAsBase64);
registerHandler("catbox-upload", catboxUpload);

// Güvenilir Google OAuth domain'leri
const ALLOWED_GOOGLE_AUTH_DOMAINS = ["accounts.google.com"];

registerHandler("googledrive-start-auth", async () => {
  const result = await googledriveStartAuth();
  if (result?.success && result?.url) {
    try {
      const urlObj = new URL(result.url);
      if (!ALLOWED_GOOGLE_AUTH_DOMAINS.includes(urlObj.hostname)) {
        result.success = false;
        result.message = "Güvenilmeyen URL: " + urlObj.hostname;
        return result;
      }
      await shell.openExternal(result.url);
    } catch (err) {
      result.message = "Tarayıcı açılamadı: " + (err?.message || "hata");
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

registerHandler("server-command-run", ServerCommands.run);
registerHandler("server-command-list", ServerCommands.list);

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

// Database IPC Handlers
registerHandler("db-init-account", (event, params) => DatabaseManager.initAccount(event, params));
registerHandler("db-get-conversations", (event, params) =>
  DatabaseManager.getConversations(event, params)
);
registerHandler("db-get-messages", (event, params) => DatabaseManager.getMessages(event, params));
registerHandler("db-sync-messages", (event, params) => DatabaseManager.syncMessages(event, params));
registerHandler("db-save-attachment", (event, params) =>
  DatabaseManager.saveAttachment(event, params)
);
registerHandler("db-get-attachments", (event, params) =>
  DatabaseManager.getAttachments(event, params)
);
registerHandler("db-delete-conversation", (event, params) =>
  DatabaseManager.deleteConversation(event, params)
);
registerHandler("db-search-messages", (event, params) =>
  DatabaseManager.searchMessages(event, params)
);
registerHandler("db-search-attachments", (event, params) =>
  DatabaseManager.searchAttachments(event, params)
);
registerHandler("db-search-all-accounts", (event, params) =>
  DatabaseManager.searchAllAccounts(event, params)
);
registerHandler("db-update-conversation", (event, params) =>
  DatabaseManager.updateConversationDetails(event, params)
);

// Meta Command IPC handlers
registerHandler("meta-define-command", (event, params) =>
  MetaCommandManager.defineCommand(event, params)
);
registerHandler("meta-delete-command", (event, params) =>
  MetaCommandManager.deleteCommand(event, params)
);
registerHandler("meta-list-commands", (event) => MetaCommandManager.listCommands(event));
registerHandler("meta-get-command", (event, params) =>
  MetaCommandManager.getCommand(event, params)
);

registerHandler("append-log", appendLog);

registerHandler("copy-to-assets", copyToAssets);
registerHandler("copy-file-to", copyFileTo);
registerHandler("delete-asset", deleteAsset);
registerHandler("generate-tree", generateTree);

registerHandler("read-console-logs", async (event, tail = 100) => await readConsoleLogs(tail));
registerHandler("read-error-logs", async (event, tail = 100) => await readErrorLogs(tail));

registerHandler("get-log-paths", async () => {
  return {
    console: CONSOLE_LOG,
    error: ERROR_LOG,
    sessionDir: getSessionDir(),
    logDir: getLogDir(),
  };
});

registerHandler("get-session-id", async () => getSessionId());
registerHandler(
  "read-all-logs",
  async (event, targetSessionId = null) => await readAllLogs(targetSessionId)
);
registerHandler("query-logs", async (event, query = {}) => await queryLogs(query));
registerHandler("list-sessions", async () => await listSessions());

registerHandler("get-app-state", async () => getAppState());

registerHandler("write-state-snapshot", async () => {
  await writeStateSnapshot();
  return { success: true };
});

registerHandler("setup-webview-logger", async (event, webviewId, slot, provider) => {
  const { webContents } = await import("electron");
  const wc = webContents.fromId(webviewId);
  if (wc) {
    setupWebviewLogger(wc, slot, provider);
    return { success: true };
  }
  return { success: false, error: "WebContents not found" };
});

registerHandler("generate-correlation-id", async (event, prefix = "op") => {
  return generateCorrelationId(prefix);
});

// OpenCode Server IPC Handlers
registerHandler(
  "opencode-start",
  async (event, options = {}) => await OpenCodeManager.start(options)
);
registerHandler("opencode-stop", async () => await OpenCodeManager.stop());
registerHandler("opencode-status", async () => OpenCodeManager.getStatus());
