import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { google } from "googleapis";
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
import { PassThrough } from "stream";
import screenshot from "screenshot-desktop";
import { basename } from "path";
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
import {
  fmTempPath,
  fmEnsureDirs,
  fmWriteFileAtomic,
  fmArchiveWrite,
  ensureScope,
  readFileAsBase64,
  copyToAssets,
  copyFileTo,
  removeArchive,
  deleteAsset,
  readArchivesIndex,
  writeArchivesIndex,
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
  appRestart,
} from "./window-manager.js";
import { catboxUpload, uguuUpload, archiveSync } from "./webview-manager.js";
import {
  googledriveStartAuth,
  googledriveExchangeCode,
  googledriveDisconnect,
  googledriveUpload,
} from "./googledrive-manager.js";
import { ServerCommands } from "./server-commands.js";
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
import { assistantManager } from "./asistan-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

const PATHS = {
  archives: () => join(process.cwd(), "archives"),
  commands: () => join(process.cwd(), "commands"),
  whispers: () => join(process.cwd(), "archives"),
  logs: () => join(process.cwd(), "logs"),
};

// Log sistemini başlat (session oluştur)
const { sessionId } = initLogSystem();

// Console logger'ı başlat (main process)
interceptMainConsole();

// Terminal focus tracking modunu devre dışı bırak (ANSI escape kodlarını önler)
// ^[[O (focus out) ve ^[[I (focus in) karakterlerini engeller
if (process.stdout && process.stdout.isTTY) {
  try {
    process.stdout.write('\x1b[?1004l'); // Focus events OFF
  } catch (e) {
    // Terminal write hatası - sessizce geç
  }
}

// Uygulama başlangıç state'ini kaydet
updateAppState({
  startTime: new Date().toISOString(),
  platform: process.platform,
  nodeVersion: process.version,
});

app.whenReady().then(async () => {
  try {
    mainWindow = await createAppWindow({ __dirname });

    // Main window referansını ayarla (IPC forwarding için)
    setMainWindow(mainWindow);

    // Renderer process logger'ını bağla
    setupRendererLogger(mainWindow.webContents);

    try {
      ServerCommands?.init?.({ mainWindow });
    } catch (e) {
      // ServerCommands init failed - non-critical
    }
    try {
      initWindowManager({ mainWindow });
    } catch (e) {
      // WindowManager init failed - non-critical
    }
    try {
      assistantManager.setMainWindow(mainWindow);
    } catch (e) {
      // AssistantManager init failed - non-critical
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

app.on("window-all-closed", () => {
  // Asistan process'ini temizle
  if (assistantManager) {
    assistantManager.disconnect().catch(err => {
      console.error("Failed to disconnect assistant:", err);
    });
  }
  
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("window-minimize", windowMinimize);
ipcMain.on("window-close", windowClose);
ipcMain.on("window-toggle-fullscreen", windowToggleFullscreen);

ipcMain.handle("app-restart", appRestart);

app.on("will-quit", (event) => {
  /* noop */
});

app.on("before-quit", async (event) => {
  // Session summary yaz
  try {
    await writeSessionSummary("normal");
  } catch (err) {
    console.error("Failed to write session summary:", err);
  }
  
  // Asistan web server'ını temizle
  if (assistantManager && assistantManager.isConnected) {
    event.preventDefault();
    try {
      await assistantManager.disconnect();
    } catch (err) {
      console.error("Failed to disconnect assistant:", err);
    }
    // Cleanup tamamlandıktan sonra quit'e izin ver
    setTimeout(() => {
      app.quit();
    }, 300);
  }
});

// Handle SIGTERM and SIGINT for clean shutdown
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
    // This path is now specifically for webviews
    return `file://${join(__dirname, "webview-preload.cjs")}`;
  } catch (err) {
    throw err;
  }
});

// Return provider config by dynamic-importing provider config module.
ipcMain.handle("get-provider-config", async (event, providerId) => {
  try {
    if (!providerId) return null;
    const cfgPath = join(
      __dirname,
      "..",
      "src",
      "js",
      "modules",
      "webview",
      "providers",
      providerId,
      "config.js",
    );
    if (!existsSync(cfgPath)) return null;
    const mod = await import(pathToFileURL(cfgPath).href);
    const cfg = mod?.config || mod?.default || mod;
    if (!cfg) return null;
    // Only expose a minimal set of fields to the preload/guest.
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

// Legacy IPC removed: create-account, assign-account-to-slot
// Now handled in renderer via SettingsManager.save()

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

ipcMain.handle("fm-write-file-atomic", fmWriteFileAtomic);
ipcMain.handle("fm-archive-write", fmArchiveWrite);

ipcMain.handle("read-file", readFileAsBase64);

ipcMain.handle("catbox-upload", catboxUpload);
ipcMain.handle("googledrive-start-auth", async () => {
  const result = await googledriveStartAuth();
  if (result?.success && result?.url) {
    try {
      await shell.openExternal(result.url);
    } catch (err) {
      // Failed to open browser - silent failure
      result.message = "Tarayıcı açılamadı: " + (err?.message || "hata");
    }
  }
  return result;
});
ipcMain.handle("googledrive-exchange-code", googledriveExchangeCode);
ipcMain.handle("googledrive-disconnect", googledriveDisconnect);
ipcMain.handle("googledrive-upload", googledriveUpload);

ipcMain.handle("uguu-upload", uguuUpload);

ipcMain.handle("read-archives-index", readArchivesIndex);
ipcMain.handle("write-archives-index", writeArchivesIndex);

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

ipcMain.handle("archive-sync", archiveSync);

ipcMain.handle("append-log", appendLog);

ipcMain.handle("copy-to-assets", copyToAssets);

ipcMain.handle("copy-file-to", copyFileTo);

ipcMain.handle("remove-archive", removeArchive);
ipcMain.handle("delete-asset", deleteAsset);

ipcMain.handle("open-path", openPath);

ipcMain.handle("generate-tree", generateTree);

// Console log handlers
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

// Yeni log handler'ları
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

// Assistant IPC handlers (Web mode only)
ipcMain.handle("assistant-connect", async (event, provider) => {
  try {
    return await assistantManager.connect(provider);
  } catch (err) {
    console.error("[IPC] assistant-connect error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("assistant-disconnect", async (event) => {
  try {
    await assistantManager.disconnect();
    return { success: true };
  } catch (err) {
    console.error("[IPC] assistant-disconnect error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("assistant-status", async (event) => {
  try {
    return assistantManager.getStatus();
  } catch (err) {
    console.error("[IPC] assistant-status error:", err);
    return { isConnected: false };
  }
});

ipcMain.handle("assistant-get-config", async (event, providerId) => {
  try {
    return await assistantManager.getProviderConfig(providerId);
  } catch (err) {
    console.error("[IPC] assistant-get-config error:", err);
    return null;
  }
});
