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
  interceptMainConsole, 
  setupRendererLogger,
  readConsoleLogs,
  readErrorLogs,
  CONSOLE_LOG,
  ERROR_LOG
} from "./console-logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

const PATHS = {
  archives: () => join(process.cwd(), "archives"),
  commands: () => join(process.cwd(), "commands"),
  whispers: () => join(process.cwd(), "archives"),
  logs: () => join(process.cwd(), "logs"),
};

// Console logger'ı başlat (main process)
interceptMainConsole();

app.whenReady().then(async () => {
  try {
    mainWindow = await createAppWindow({ __dirname });
    
    // Renderer process logger'ını bağla
    setupRendererLogger(mainWindow.webContents);
    
    try {
      ServerCommands?.init?.({ mainWindow });
    } catch (e) {
      console.error("ServerCommands.init failed:", e);
    }
    try {
      initWindowManager({ mainWindow });
    } catch (e) {
      console.error("initWindowManager failed:", e);
    }
  } catch (err) {
    console.error("createAppWindow failed:", err);
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createAppWindow({ __dirname });
    }
  });
});

app.on("window-all-closed", () => {
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

app.on("before-quit", () => {
  /* noop */
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
    console.error("get-preload-path handler error:", err);
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
    console.error("get-provider-config handler error for", providerId, err);
    return null;
  }
});

ipcMain.handle("load-settings", async (event, ...args) => {
  try {
    return await loadSettings(event, ...args);
  } catch (err) {
    console.error("load-settings handler error:", err);
    throw err;
  }
});

ipcMain.handle("save-settings", async (event, ...args) => {
  try {
    return await saveSettings(event, ...args);
  } catch (err) {
    console.error("save-settings handler error:", err);
    throw err;
  }
});

ipcMain.handle("create-account", async (event, accountData) => {
  try {
    const settings = await loadSettings(event);
    if (!settings) {
      throw new Error("Ayarlar yüklenemedi");
    }

    if (!Array.isArray(settings.accounts)) {
      settings.accounts = [];
    }

    const generateId = () =>
      `acc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;

    let avatarPath = accountData.avatarPath || "";

    // If a local avatar file is provided, copy it into src/assets with the naming rule
    try {
      if (avatarPath) {
        const copied = await copyToAssets(
          event,
          avatarPath,
          "account",
          { email: accountData.email, provider: accountData.provider },
        );
        if (copied?.success && copied?.path) {
          avatarPath = copied.path;
        }
      }
    } catch (e) {
      console.warn("Account avatar copy failed:", e?.message || e);
    }

    const newAccount = {
      id: accountData.id || generateId(),
      email: accountData.email,
      provider: accountData.provider,
      nickname: accountData.nickname || accountData.email,
      avatarPath,
    };

    const existingIndex = settings.accounts.findIndex(
      (acc) =>
        acc.email === newAccount.email && acc.provider === newAccount.provider,
    );

    if (existingIndex >= 0) {
      settings.accounts[existingIndex] = newAccount;
    } else {
      settings.accounts.push(newAccount);
    }

    await saveSettings(event, settings);
    return { success: true, account: newAccount };
  } catch (err) {
    console.error("create-account handler error:", err);
    throw err;
  }
});

ipcMain.handle("assign-account-to-slot", async (event, slot, accountId) => {
  try {
    if (!slot || !["ai1", "ai2"].includes(slot)) {
      throw new Error("Geçersiz slot");
    }

    const settings = await loadSettings(event);
    if (!settings) {
      throw new Error("Ayarlar yüklenemedi");
    }

    if (!accountId) {
      settings[slot].activeAccountId = null;
      settings[slot].providerId = "";
      await saveSettings(event, settings);
      return { success: true, slot, accountId: null };
    }

    if (!Array.isArray(settings.accounts)) {
      throw new Error("Hesap bulunamadı");
    }

    const account = settings.accounts.find((acc) => acc.id === accountId);
    if (!account) {
      throw new Error("Hesap bulunamadı");
    }

    settings[slot].activeAccountId = accountId;
    settings[slot].providerId = account.provider;
    settings[slot].nickname = account.nickname;
    settings[slot].avatarPath = account.avatarPath;

    await saveSettings(event, settings);
    return { success: true, slot, accountId, account };
  } catch (err) {
    console.error("assign-account-to-slot handler error:", err);
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
    console.error("show-open-dialog error:", err);
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
      console.error("Failed to open browser:", err);
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

ipcMain.handle("open-path", openPath);

ipcMain.handle("generate-tree", generateTree);

// Console log handlers
ipcMain.handle("read-console-logs", async () => {
  try {
    return await readConsoleLogs();
  } catch (err) {
    console.error("read-console-logs handler error:", err);
    throw err;
  }
});

ipcMain.handle("read-error-logs", async () => {
  try {
    return await readErrorLogs();
  } catch (err) {
    console.error("read-error-logs handler error:", err);
    throw err;
  }
});

ipcMain.handle("get-log-paths", async () => {
  return {
    console: CONSOLE_LOG,
    error: ERROR_LOG
  };
});
