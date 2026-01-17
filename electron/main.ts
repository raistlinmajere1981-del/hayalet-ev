import { app, BrowserWindow, ipcMain as _ipcMain, dialog, shell } from "electron";
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
  openPath as _openPath,
} from "./file-manager.ts";
import {
  createWindow as createAppWindow,
  initWindowManager,
  setTrayIconPath,
  appRestart as _appRestart,
} from "./window-manager.ts";
import { catboxUpload, uguuUpload } from "./webview-manager.ts";
import {
  googledriveStartAuth,
  googledriveExchangeCode,
  googledriveDisconnect,
  googledriveUpload,
} from "./googledrive-manager.ts";
import { ServerCommands } from "./server-commands.ts";
import { OpenCodeManager } from "./opencode-manager.ts";
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
  writeStateSnapshot as _writeStateSnapshot,
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
import { registerHandler } from "./handlers/ipc-helpers.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CDP (Chrome DevTools Protocol) remote debugging için port ayarla
const CDP_PORT = process.env.CDP_PORT || 9222;
app.commandLine.appendSwitch("remote-debugging-port", CDP_PORT.toString());

let mainWindow: BrowserWindow | null = null;

const { sessionId: _sessionId } = initLogSystem();

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
registerHandler("db-init-account", (event, params: { accountId: string }) => 
  DatabaseManager.initAccount(event, params)
);
registerHandler("db-get-conversations", (event, params: { accountId: string }) =>
  DatabaseManager.getConversations(event, params)
);
registerHandler("db-get-messages", (event, params: { accountId: string; conversationId: string }) => 
  DatabaseManager.getMessages(event, params)
);
registerHandler("db-sync-messages", (event, params: { accountId: string; webUrl: string; messages: unknown[] }) => 
  DatabaseManager.syncMessages(event, params as Parameters<typeof DatabaseManager.syncMessages>[1])
);
registerHandler("db-save-attachment", (event, params: { accountId: string; conversationId: string; messageId: string; filePath: string; originalName: string; mimeType?: string }) =>
  DatabaseManager.saveAttachment(event, params)
);
registerHandler("db-get-attachments", (event, params: { accountId: string; conversationId: string }) =>
  DatabaseManager.getAttachments(event, params)
);
registerHandler("db-delete-conversation", (event, params: { accountId: string; conversationId: string }) =>
  DatabaseManager.deleteConversation(event, params)
);
registerHandler("db-search-messages", (event, params: { accountId: string; query: string; limit?: number }) =>
  DatabaseManager.searchMessages(event, params)
);
registerHandler("db-search-attachments", (event, params: { accountId: string; query: string; limit?: number }) =>
  DatabaseManager.searchAttachments(event, params)
);
registerHandler("db-search-all-accounts", (event, params: { query: string; limit?: number }) =>
  DatabaseManager.searchAllAccounts(event, params)
);
registerHandler("db-update-conversation", (event, params: { accountId: string; conversationId: string; title?: string; summary?: string }) =>
  DatabaseManager.updateConversationDetails(event, params)
);

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
