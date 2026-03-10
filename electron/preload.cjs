const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_IPC_RENDERER_CHANNELS = new Set(["log:ui-notify", "log:ui-notify-batch"]);
const OPENCODE_UI_SESSION_UPDATED_CHANNEL = "opencode-ui:session-updated";
const PROVIDER_SCENARIO_PROGRESS_CHANNEL = "provider-scenario:progress";
const opencodeUiSessionUpdatedHandlers = new Map();
const providerScenarioProgressHandlers = new Map();
let __hayalet_preload_locale = "tr";
let __hayalet_preload_catalog = null;

const PRELOAD_MESSAGE_FALLBACKS = {
  appScriptLoaded: "/js/app.js loaded via src.",
  disableSpellcheckFailed: "Failed to disable spellcheck: {{message}}",
  appScriptLoadFailed: "Failed to load /js/app.js via src: {{message}}",
  injectInitAppFailed: "injectInitApp failed: {{message}}",
  initFailed: "Preload initialization failed: {{message}}",
};

function normalizePreloadLocale(value) {
  if (typeof value !== "string") {
    return "tr";
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  return normalized !== "" ? normalized : "tr";
}

function resolvePreloadMessageLocale(value) {
  const normalized = normalizePreloadLocale(value);
  return normalized === "tr" || normalized.startsWith("tr-") ? "tr" : "en";
}

function readCatalogValue(catalog, path) {
  if (!catalog || typeof catalog !== "object") {
    return null;
  }

  const parts = path.split(".");
  let current = catalog;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return null;
    }
    current = current[part];
  }

  return typeof current === "string" ? current : null;
}

async function syncPreloadLocale() {
  try {
    const settings = await ipcRenderer.invoke("load-settings");
    const nextLocale = normalizePreloadLocale(settings && settings.general && settings.general.language);
    __hayalet_preload_locale = nextLocale;

    const pack = await ipcRenderer.invoke("i18n-load-language", nextLocale);
    __hayalet_preload_catalog =
      pack && pack.catalog && typeof pack.catalog === "object" ? pack.catalog : null;
  } catch (_) {
    __hayalet_preload_catalog = null;
  }

  return __hayalet_preload_locale;
}

function getPreloadErrorMessage(error) {
  if (error && typeof error.message === "string" && error.message.trim() !== "") {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim() !== "") {
    return error.trim();
  }

  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

function preloadT(key, params) {
  const messageLocale = resolvePreloadMessageLocale(__hayalet_preload_locale);
  const template =
    readCatalogValue(__hayalet_preload_catalog, `electron.preload.${key}.${messageLocale}`) ||
    readCatalogValue(__hayalet_preload_catalog, "electron.preload." + key) ||
    PRELOAD_MESSAGE_FALLBACKS[key] ||
    key;

  return template.replace(/\{\{(\w+)\}\}/g, (_, token) => {
    const value =
      params && Object.prototype.hasOwnProperty.call(params, token) ? params[token] : "";
    return value == null ? "" : String(value);
  });
}

void syncPreloadLocale();

contextBridge.exposeInMainWorld("electronAPI", {
  readDirectoryFiles: (dirPath) => ipcRenderer.invoke("read-directory-files", dirPath),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  i18nListLanguages: () => ipcRenderer.invoke("i18n-list-languages"),
  i18nLoadLanguage: (locale) => ipcRenderer.invoke("i18n-load-language", locale),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  loadProtocols: () => ipcRenderer.invoke("load-protocols"),
  saveProtocol: (key, content) => ipcRenderer.invoke("save-protocol", key, content),
  roomsListWorkspace: () => ipcRenderer.invoke("rooms-list-workspace"),
  roomsListInstalled: () => ipcRenderer.invoke("rooms-list-installed"),
  roomsInstallFromWorkspace: (roomId) => ipcRenderer.invoke("rooms-install-from-workspace", roomId),
  roomsRemoveInstalled: (roomId) => ipcRenderer.invoke("rooms-remove-installed", roomId),
  roomsExportToWorkspace: (payload) => ipcRenderer.invoke("rooms-export-to-workspace", payload),
  roomsPackageFromWorkspace: (payload) =>
    ipcRenderer.invoke("rooms-package-from-workspace", payload),
  roomsImportBundle: (payload) => ipcRenderer.invoke("rooms-import-bundle", payload),
  commandInit: () => ipcRenderer.invoke("command-init"),
  commandWrite: (item) => ipcRenderer.invoke("command-write", item),
  commandMove: (id, status, reason) => ipcRenderer.invoke("command-move", id, status, reason),
  commandPaths: () => ipcRenderer.invoke("command-paths"),
  commandStageAttachments: (payload) => ipcRenderer.invoke("command-stage-attachments", payload),
  commandStageTemp: (payload) => ipcRenderer.invoke("command-stage-temp", payload),
  commandCleanupTemp: (payload) => ipcRenderer.invoke("command-cleanup-temp", payload),
  commandMoveFailed: (payload) => ipcRenderer.invoke("command-move-failed", payload),
  commandArchiveCopy: (payload) => ipcRenderer.invoke("command-archive-copy", payload),
  commandCleanupJob: (payload) => ipcRenderer.invoke("command-cleanup-job", payload),
  copyToAssets: (srcPath, role, accountInfo) =>
    ipcRenderer.invoke("copy-to-assets", srcPath, role, accountInfo),
  deleteAsset: (assetPath) => ipcRenderer.invoke("delete-asset", assetPath),
  copyFileTo: (srcPath, destDir) => ipcRenderer.invoke("copy-file-to", srcPath, destDir),
  openPath: (path) => ipcRenderer.invoke("open-path", path),
  fmEnsureDirs: (scope) => ipcRenderer.invoke("fm-ensure-dirs", scope),
  fmTempPath: (prefix, ext) => ipcRenderer.invoke("fm-temp-path", prefix, ext),
  fmWriteFileAtomic: (payload) => ipcRenderer.invoke("fm-write-file-atomic", payload),
  getPreloadPath: (type) => ipcRenderer.invoke("get-preload-path", type),
  getProviderConfig: (providerId) => ipcRenderer.invoke("get-provider-config", providerId),
  runProviderScenario: (params) => ipcRenderer.invoke("run-provider-scenario", params),
  cancelProviderScenario: (params) => ipcRenderer.invoke("cancel-provider-scenario", params),
  testProvider: (params) => ipcRenderer.invoke("test-provider", params),
  onProviderScenarioProgress: (callback) => {
    if (typeof callback !== "function" || providerScenarioProgressHandlers.has(callback)) {
      return;
    }
    const handler = (_event, payload) => callback(payload);
    providerScenarioProgressHandlers.set(callback, handler);
    ipcRenderer.on(PROVIDER_SCENARIO_PROGRESS_CHANNEL, handler);
  },
  offProviderScenarioProgress: (callback) => {
    const handler = providerScenarioProgressHandlers.get(callback);
    if (!handler) return;
    ipcRenderer.removeListener(PROVIDER_SCENARIO_PROGRESS_CHANNEL, handler);
    providerScenarioProgressHandlers.delete(callback);
  },
  onProviderTestProgress: (callback) => {
    if (typeof callback !== "function" || providerScenarioProgressHandlers.has(callback)) {
      return;
    }
    const handler = (_event, payload) => callback(payload);
    providerScenarioProgressHandlers.set(callback, handler);
    ipcRenderer.on(PROVIDER_SCENARIO_PROGRESS_CHANNEL, handler);
  },
  offProviderTestProgress: (callback) => {
    const handler = providerScenarioProgressHandlers.get(callback);
    if (!handler) return;
    ipcRenderer.removeListener(PROVIDER_SCENARIO_PROGRESS_CHANNEL, handler);
    providerScenarioProgressHandlers.delete(callback);
  },
  sendToHost: (channel, data) => ipcRenderer.sendToHost(channel, data),

  // Database API
  dbDeleteAccount: (params) => ipcRenderer.invoke("db-delete-account", params),
  dbInitAccount: (params) => ipcRenderer.invoke("db-init-account", params),
  dbGetConversations: (params) => ipcRenderer.invoke("db-get-conversations", params),
  dbGetMessages: (params) => ipcRenderer.invoke("db-get-messages", params),
  dbSyncMessages: (params) => ipcRenderer.invoke("db-sync-messages", params),
  dbSaveAttachment: (params) => ipcRenderer.invoke("db-save-attachment", params),
  dbGetAttachments: (params) => ipcRenderer.invoke("db-get-attachments", params),
  dbDeleteConversation: (params) => ipcRenderer.invoke("db-delete-conversation", params),
  dbSearchMessages: (params) => ipcRenderer.invoke("db-search-messages", params),
  dbSearchAttachments: (params) => ipcRenderer.invoke("db-search-attachments", params),
  dbSearchAllAccounts: (params) => ipcRenderer.invoke("db-search-all-accounts", params),
  dbUpdateConversation: (params) => ipcRenderer.invoke("db-update-conversation", params),

  // Meta Command API
  metaDefineCommand: (params) => ipcRenderer.invoke("meta-define-command", params),
  metaDeleteCommand: (params) => ipcRenderer.invoke("meta-delete-command", params),
  metaListCommands: () => ipcRenderer.invoke("meta-list-commands"),
  metaGetCommand: (params) => ipcRenderer.invoke("meta-get-command", params),

  // Unified logger API
  logger: {
    appendBatch: (entries) => ipcRenderer.invoke("logger:appendBatch", entries),
    getSessionId: () => ipcRenderer.invoke("get-session-id"),
    readAllLogs: (sessionId) => ipcRenderer.invoke("read-all-logs", sessionId),
    queryLogs: (query) => ipcRenderer.invoke("query-logs", query),
    listSessions: () => ipcRenderer.invoke("list-sessions"),
    getAppState: () => ipcRenderer.invoke("get-app-state"),
    writeStateSnapshot: () => ipcRenderer.invoke("write-state-snapshot"),
    setupWebviewLogger: (webviewId, slot, provider) =>
      ipcRenderer.invoke("setup-webview-logger", webviewId, slot, provider),
    generateCorrelationId: (prefix) => ipcRenderer.invoke("generate-correlation-id", prefix),
    readConsoleLogs: (tail) => ipcRenderer.invoke("read-console-logs", tail),
    readErrorLogs: (tail) => ipcRenderer.invoke("read-error-logs", tail),
    getLogPaths: () => ipcRenderer.invoke("get-log-paths"),
    onLogUINotify: (callback) => ipcRenderer.on("log:ui-notify", (event, data) => callback(data)),
  },
  whisperLoad: (params) => ipcRenderer.invoke("whisper-load", params),
  whisperSave: (params) => ipcRenderer.invoke("whisper-save", params),
  capturePage: (type, region) => ipcRenderer.invoke("capture-page", type, region),
  screenshotCapture: (options) => ipcRenderer.invoke("screenshot-capture", options),
  catboxUpload: (payload) => ipcRenderer.invoke("catbox-upload", payload),
  uguuUpload: (payload) => ipcRenderer.invoke("uguu-upload", payload),
  googledriveStartAuth: () => ipcRenderer.invoke("googledrive-start-auth"),
  googledriveExchangeCode: (code) => ipcRenderer.invoke("googledrive-exchange-code", code),
  googledriveUpload: (payload) => ipcRenderer.invoke("googledrive-upload", payload),
  googledriveDisconnect: () => ipcRenderer.invoke("googledrive-disconnect"),
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowToggleFullscreen: () => ipcRenderer.send("window-toggle-fullscreen"),
  windowClose: () => ipcRenderer.send("window-close"),
  windowMinimizeToTray: () => ipcRenderer.send("window-minimize-to-tray"),
  appRestart: (options) => ipcRenderer.invoke("app-restart", options),
  openTerminal: (path) => ipcRenderer.invoke("open-terminal", path),
  assistantRuntimeRead: () => ipcRenderer.invoke("assistant-runtime-read"),
  assistantRuntimeWrite: (payload) => ipcRenderer.invoke("assistant-runtime-write", payload),
  shellOpenPath: (path) => ipcRenderer.invoke("shell-open-path", path),
  deviceAction: (action, payload) => ipcRenderer.invoke("device-action", action, payload),
  generateTree: (basePath, options) => ipcRenderer.invoke("generate-tree", basePath, options),

  // Memory API
  memorySearch: (params) => ipcRenderer.invoke("memory-search", params),
  memoryStats: (params) => ipcRenderer.invoke("memory-stats", params),
  memoryDelete: (params) => ipcRenderer.invoke("memory-delete", params),
  memoryUpdate: (params) => ipcRenderer.invoke("memory-update", params),
  memoryWrite: (params) => ipcRenderer.invoke("memory-write", params),
  memoryPrune: (params) => ipcRenderer.invoke("memory-prune", params),
  memoryDeleteAll: (params) => ipcRenderer.invoke("memory-delete-all", params),

  // OpenCode Web API (Simple spawn)
  // OpenCode Serve API
  opencodeServeStart: (options) => ipcRenderer.invoke("opencode-serve-start", options),
  opencodeServeStop: () => ipcRenderer.invoke("opencode-serve-stop"),
  opencodeServeStatus: () => ipcRenderer.invoke("opencode-serve-status"),
  opencodeServeFindPort: (start, end) => ipcRenderer.invoke("opencode-serve-find-port", start, end),
  opencodeServeFindRunning: (start, end) =>
    ipcRenderer.invoke("opencode-serve-find-running", start, end),
  opencodeServeHealth: (url) => ipcRenderer.invoke("opencode-serve-health", url),
  opencodeServeDoctor: (options) => ipcRenderer.invoke("opencode-serve-doctor", options),
  opencodeCheckUpdates: (installedVersion) =>
    ipcRenderer.invoke("opencode-check-updates", installedVersion),
  opencodeLaunchInstall: () => ipcRenderer.invoke("opencode-launch-install"),

  opencodeUiApiProxy: (options) => ipcRenderer.invoke("opencode-ui-api-proxy", options),
  opencodeUiFsListSessions: (dbPath) => ipcRenderer.invoke("opencode-ui-fs-list-sessions", dbPath),
  opencodeUiFsEnsureSession: (sessionId, title, dbPath) =>
    ipcRenderer.invoke("opencode-ui-fs-ensure-session", sessionId, title, dbPath),
  opencodeUiFsReadSession: (sessionId, dbPath) =>
    ipcRenderer.invoke("opencode-ui-fs-read-session", sessionId, dbPath),
  opencodeUiFsArchiveSession: (sessionId, archived, dbPath) =>
    ipcRenderer.invoke("opencode-ui-fs-archive-session", sessionId, archived, dbPath),
  opencodeUiHevTools: () => ipcRenderer.invoke("opencode-ui-hev-tools"),
  opencodeUiQuickPromptsRead: () => ipcRenderer.invoke("opencode-ui-quick-prompts-read"),
  opencodeUiQuickPromptsWrite: (prompts) =>
    ipcRenderer.invoke("opencode-ui-quick-prompts-write", prompts),
  opencodeUiSessionWatchStart: (sessionId, dbPath) =>
    ipcRenderer.invoke("opencode-ui-session-watch-start", sessionId, dbPath),
  opencodeUiSessionWatchStop: () => ipcRenderer.invoke("opencode-ui-session-watch-stop"),
  opencodeUiOnSessionUpdated: (callback) => {
    if (typeof callback !== "function" || opencodeUiSessionUpdatedHandlers.has(callback)) {
      return;
    }
    const handler = (_event, payload) => callback(payload);
    opencodeUiSessionUpdatedHandlers.set(callback, handler);
    ipcRenderer.on(OPENCODE_UI_SESSION_UPDATED_CHANNEL, handler);
  },
  opencodeUiOffSessionUpdated: (callback) => {
    const handler = opencodeUiSessionUpdatedHandlers.get(callback);
    if (!handler) return;
    ipcRenderer.removeListener(OPENCODE_UI_SESSION_UPDATED_CHANNEL, handler);
    opencodeUiSessionUpdatedHandlers.delete(callback);
  },

  // Startup flags (read from process.argv)
  getStartupFlags: () => {
    const argv = process.argv || [];

    const readFlagValue = (flagName) => {
      const prefix = `${flagName}=`;
      const raw = argv.find((arg) => typeof arg === "string" && arg.startsWith(prefix));
      if (typeof raw !== "string") {
        return null;
      }
      const value = raw.slice(prefix.length).trim();
      return value === "" ? null : value;
    };

    const startPage = readFlagValue("--hayalet-start-page") ?? readFlagValue("--start-page");
    const autoConnect =
      argv.includes("--hayalet-auto-connect=1") ||
      argv.includes("--hayalet-auto-connect=true") ||
      argv.includes("--hayalet-auto-connect") ||
      argv.includes("--auto-connect");

    return { startPage, autoConnect };
  },

  // IPC Renderer for custom event listeners (e.g., log:ui-notify)
  ipcRenderer: {
    on: (channel, callback) => {
      if (!ALLOWED_IPC_RENDERER_CHANNELS.has(channel) || typeof callback !== "function") {
        return;
      }
      ipcRenderer.on(channel, callback);
    },
    removeListener: (channel, callback) => {
      if (!ALLOWED_IPC_RENDERER_CHANNELS.has(channel) || typeof callback !== "function") {
        return;
      }
      ipcRenderer.removeListener(channel, callback);
    },
  },
});

try {
  const isMainFrame =
    !window.location.href.startsWith("http") || window.location.hostname.includes("localhost");

  if (typeof window !== "undefined" && isMainFrame) {
    function disableSpellcheck() {
      try {
        document.querySelectorAll("input, textarea").forEach((el) => {
          el.setAttribute("spellcheck", "false");
          el.autocapitalize = "off";
          el.autocomplete = "off";
        });
      } catch (err) {
        console.warn(
          preloadT("disableSpellcheckFailed", { message: getPreloadErrorMessage(err) }),
          err
        );
      }
    }

    function injectInitApp() {
      try {
        if (window.__hayalet_init_injected) return;
        window.__hayalet_init_injected = true;
        disableSpellcheck();

        const s = document.createElement("script");
        s.type = "module";
        s.src = "/js/app.js"; // Set the src directly
        s.onload = () => {
          console.info(preloadT("appScriptLoaded"));
        };
        s.onerror = (err) => {
          console.error(preloadT("appScriptLoadFailed", { message: getPreloadErrorMessage(err) }));
        };

        (document.head || document.documentElement).appendChild(s);
      } catch (err) {
        console.warn(
          preloadT("injectInitAppFailed", { message: getPreloadErrorMessage(err) }),
          err
        );
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", injectInitApp);
    } else {
      injectInitApp();
    }
  }
} catch (e) {
  console.warn(preloadT("initFailed", { message: getPreloadErrorMessage(e) }), e);
}
