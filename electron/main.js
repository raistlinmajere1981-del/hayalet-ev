import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  appendFile,
  copyFile,
  unlink,
  rename,
  stat,
  rm,
} from "fs/promises";
import { existsSync } from "fs";
import screenshot from "screenshot-desktop";
import { deviceActionHandler } from "./device-manager.js";
import {
  capturePageHandler,
  screenshotCaptureHandler,
} from "./screenshot-manager.js";
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
  fmTempPath,
  fmEnsureDirs,
  fmWriteFileAtomic,
  ensureScope,
  readFileAsBase64,
  copyToAssets,
  copyFileTo,
  deleteAsset,
  generateTree,
  openPath,
} from "./file-manager.js";
import { loadSettings, saveSettings } from "./settings-manager.js";
import {
  createWindow as createAppWindow,
  initWindowManager,
  windowMinimize,
  windowClose,
  windowToggleFullscreen,
  setTrayIconPath,
  minimizeToTray,
  destroyTray,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CDP (Chrome DevTools Protocol) remote debugging için port ayarla
// Bu sayede MCP server üzerinden Electron'a bağlanılabilir
const CDP_PORT = process.env.CDP_PORT || 9222;
app.commandLine.appendSwitch("remote-debugging-port", CDP_PORT.toString());

let mainWindow;

const PATHS = {
  archives: () => join(process.cwd(), "archives"),
  commands: () => join(process.cwd(), "commands"),
  whispers: () => join(process.cwd(), "archives"),
  logs: () => join(process.cwd(), "logs"),
  providerConfig: (providerId) => join(__dirname, "..", "src", "js", "modules", "webview", "providers", providerId, "config.js"),
};

const { sessionId } = initLogSystem();

interceptMainConsole();

if (process.stdout && process.stdout.isTTY) {
  try {
    process.stdout.write('\x1b[?1004l');
  } catch (e) {
  }
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

    try {
      ServerCommands?.init?.({ mainWindow });
    } catch (e) {
    }
    try {
      initWindowManager({ mainWindow });
    } catch (e) {
    }
    
    // System tray icon path'i kaydet (lazy - sadece minimize edilince oluşur)
    try {
      const iconPath = join(__dirname, '../src/assets/icon.png');
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

ipcMain.on("window-minimize", windowMinimize);
ipcMain.on("window-close", windowClose);
ipcMain.on("window-toggle-fullscreen", windowToggleFullscreen);
ipcMain.on("window-minimize-to-tray", minimizeToTray);

ipcMain.handle("app-restart", appRestart);

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

ipcMain.handle("get-preload-path", async (event, type) => {
  try {
    return `file://${join(__dirname, "webview-preload.cjs")}`;
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("get-provider-config", async (event, providerId) => {
  try {
    if (!providerId) return null;
    const cfgPath = PATHS.providerConfig(providerId);
    if (!existsSync(cfgPath)) return null;
    const mod = await import(pathToFileURL(cfgPath).href);
    const cfg = mod?.config || mod?.default || mod;
    if (!cfg) return null;
    const allowed = {
      id: cfg.id,
      name: cfg.name,
      baseUrl: cfg.baseUrl,
      loginUrl: cfg.loginUrl,
      selectors: cfg.selectors,
      scrollerSelectors: cfg.scrollerSelectors,
      filters: cfg.filters || null,
      telemetry: cfg.telemetry || null,
    };
    return allowed;
  } catch (err) {
    return null;
  }
});

ipcMain.handle("load-settings", async (event, ...args) => {
  try {
    return await loadSettings(event, ...args);
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("save-settings", async (event, ...args) => {
  try {
    return await saveSettings(event, ...args);
  } catch (err) {
    throw err;
  }
});


ipcMain.handle("device-action", deviceActionHandler);

ipcMain.handle("fm-temp-path", fmTempPath);

ipcMain.handle("fm-ensure-dirs", fmEnsureDirs);

ipcMain.handle("show-open-dialog", async (event, options = {}) => {
  try {
    const win = mainWindow || null;
    const res = await dialog.showOpenDialog(win, options || {});
    return res;
  } catch (err) {
    return { canceled: true, message: err?.message || String(err) };
  }
});

ipcMain.handle("show-message-box", async (event, options = {}) => {
  try {
    const win = mainWindow || null;
    const res = await dialog.showMessageBox(win, options || {});
    return res;
  } catch (err) {
    return { response: 0, message: err?.message || String(err) };
  }
});

ipcMain.handle("fm-write-file-atomic", fmWriteFileAtomic);

ipcMain.handle("read-file", readFileAsBase64);

ipcMain.handle("catbox-upload", catboxUpload);

// Güvenilir Google OAuth domain'leri
const ALLOWED_GOOGLE_AUTH_DOMAINS = ["accounts.google.com"];

ipcMain.handle("googledrive-start-auth", async () => {
  const result = await googledriveStartAuth();
  if (result?.success && result?.url) {
    try {
      // URL güvenlik kontrolü - sadece Google OAuth URL'lerine izin ver
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
ipcMain.handle("googledrive-exchange-code", googledriveExchangeCode);
ipcMain.handle("googledrive-disconnect", googledriveDisconnect);
ipcMain.handle("googledrive-upload", googledriveUpload);

ipcMain.handle("uguu-upload", uguuUpload);

ipcMain.handle("whisper-load", whisperLoad);
ipcMain.handle("whisper-save", whisperSave);

ipcMain.handle("server-command-run", ServerCommands.run);
ipcMain.handle("server-command-list", ServerCommands.list);

ipcMain.handle("command-init", commandInit);
ipcMain.handle("command-write", commandWrite);
ipcMain.handle("command-paths", commandPaths);
ipcMain.handle("command-stage-attachments", commandStageAttachments);
ipcMain.handle("command-stage-temp", commandStageTemp);
ipcMain.handle("command-cleanup-temp", commandCleanupTemp);
ipcMain.handle("command-move-failed", commandMoveFailed);
ipcMain.handle("command-archive-copy", commandArchiveCopy);
ipcMain.handle("command-cleanup-job", commandCleanupJob);
ipcMain.handle("command-move", commandMove);

ipcMain.handle("capture-page", capturePageHandler);
ipcMain.handle("screenshot-capture", screenshotCaptureHandler);

// ============================================================================
// Database IPC Handlers
// ============================================================================
ipcMain.handle("db-init-account", (event, params) => DatabaseManager.initAccount(event, params));
ipcMain.handle("db-get-conversations", (event, params) => DatabaseManager.getConversations(event, params));
ipcMain.handle("db-get-messages", (event, params) => DatabaseManager.getMessages(event, params));
ipcMain.handle("db-sync-messages", (event, params) => DatabaseManager.syncMessages(event, params));
ipcMain.handle("db-save-attachment", (event, params) => DatabaseManager.saveAttachment(event, params));
ipcMain.handle("db-get-attachments", (event, params) => DatabaseManager.getAttachments(event, params));
ipcMain.handle("db-delete-conversation", (event, params) => DatabaseManager.deleteConversation(event, params));
ipcMain.handle("db-search-messages", (event, params) => DatabaseManager.searchMessages(event, params));
ipcMain.handle("db-search-attachments", (event, params) => DatabaseManager.searchAttachments(event, params));
ipcMain.handle("db-search-all-accounts", (event, params) => DatabaseManager.searchAllAccounts(event, params));
ipcMain.handle("db-update-conversation", (event, params) => DatabaseManager.updateConversationDetails(event, params));

// Meta Command IPC handlers
ipcMain.handle("meta-define-command", (event, params) => MetaCommandManager.defineCommand(event, params));
ipcMain.handle("meta-delete-command", (event, params) => MetaCommandManager.deleteCommand(event, params));
ipcMain.handle("meta-list-commands", (event) => MetaCommandManager.listCommands(event));
ipcMain.handle("meta-get-command", (event, params) => MetaCommandManager.getCommand(event, params));

ipcMain.handle("append-log", appendLog);

ipcMain.handle("copy-to-assets", copyToAssets);

ipcMain.handle("copy-file-to", copyFileTo);
ipcMain.handle("delete-asset", deleteAsset);

ipcMain.handle("open-path", openPath);

ipcMain.handle("generate-tree", generateTree);

ipcMain.handle("read-console-logs", async (event, tail = 100) => {
  try {
    return await readConsoleLogs(tail);
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("read-error-logs", async (event, tail = 100) => {
  try {
    return await readErrorLogs(tail);
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("get-log-paths", async () => {
  return {
    console: CONSOLE_LOG,
    error: ERROR_LOG,
    sessionDir: getSessionDir(),
    logDir: getLogDir(),
  };
});

ipcMain.handle("get-session-id", async () => {
  return getSessionId();
});

ipcMain.handle("read-all-logs", async (event, targetSessionId = null) => {
  try {
    return await readAllLogs(targetSessionId);
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("query-logs", async (event, query = {}) => {
  try {
    return await queryLogs(query);
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("list-sessions", async () => {
  try {
    return await listSessions();
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("get-app-state", async () => {
  return getAppState();
});

ipcMain.handle("write-state-snapshot", async () => {
  try {
    await writeStateSnapshot();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("setup-webview-logger", async (event, webviewId, slot, provider) => {
  try {
    const { webContents } = await import("electron");
    const wc = webContents.fromId(webviewId);
    if (wc) {
      setupWebviewLogger(wc, slot, provider);
      return { success: true };
    }
    return { success: false, error: "WebContents not found" };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("generate-correlation-id", async (event, prefix = "op") => {
  return generateCorrelationId(prefix);
});

// =========================================================================
// OpenCode Server IPC Handlers
// =========================================================================

ipcMain.handle("opencode-start", async (event, options = {}) => {
  try {
    return await OpenCodeManager.start(options);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("opencode-stop", async () => {
  try {
    return await OpenCodeManager.stop();
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("opencode-status", async () => {
  try {
    return OpenCodeManager.getStatus();
  } catch (err) {
    return { running: false, error: err.message };
  }
});

