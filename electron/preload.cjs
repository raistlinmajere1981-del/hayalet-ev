const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readDirectoryFiles: (dirPath) =>
    ipcRenderer.invoke("read-directory-files", dirPath),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  commandInit: () => ipcRenderer.invoke("command-init"),
  commandWrite: (item) => ipcRenderer.invoke("command-write", item),
  commandMove: (id, status, reason) =>
    ipcRenderer.invoke("command-move", id, status, reason),
  commandPaths: () => ipcRenderer.invoke("command-paths"),
  commandStageAttachments: (payload) =>
    ipcRenderer.invoke("command-stage-attachments", payload),
  commandStageTemp: (payload) =>
    ipcRenderer.invoke("command-stage-temp", payload),
  commandCleanupTemp: (payload) =>
    ipcRenderer.invoke("command-cleanup-temp", payload),
  commandMoveFailed: (payload) =>
    ipcRenderer.invoke("command-move-failed", payload),
  commandArchiveCopy: (payload) =>
    ipcRenderer.invoke("command-archive-copy", payload),
  commandCleanupJob: (payload) =>
    ipcRenderer.invoke("command-cleanup-job", payload),
  copyToAssets: (srcPath, role, accountInfo) =>
    ipcRenderer.invoke("copy-to-assets", srcPath, role, accountInfo),
  deleteAsset: (assetPath) => ipcRenderer.invoke("delete-asset", assetPath),
  copyFileTo: (srcPath, destDir) =>
    ipcRenderer.invoke("copy-file-to", srcPath, destDir),
  openPath: (path) => ipcRenderer.invoke("open-path", path),
  fmEnsureDirs: (scope) => ipcRenderer.invoke("fm-ensure-dirs", scope),
  fmTempPath: (prefix, ext) => ipcRenderer.invoke("fm-temp-path", prefix, ext),
  fmWriteFileAtomic: (payload) =>
    ipcRenderer.invoke("fm-write-file-atomic", payload),
  getPreloadPath: (type) => ipcRenderer.invoke("get-preload-path", type),
  getProviderConfig: (providerId) =>
    ipcRenderer.invoke("get-provider-config", providerId),
  sendToHost: (channel, data) => ipcRenderer.sendToHost(channel, data),
  
  // Database API
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
  
  appendLog: (payload) => ipcRenderer.invoke("append-log", payload),
  getSessionId: () => ipcRenderer.invoke("get-session-id"),
  getEarlyLogs: () => ipcRenderer.invoke("get-early-logs"),
  readAllLogs: (sessionId) => ipcRenderer.invoke("read-all-logs", sessionId),
  queryLogs: (query) => ipcRenderer.invoke("query-logs", query),
  listSessions: () => ipcRenderer.invoke("list-sessions"),
  getAppState: () => ipcRenderer.invoke("get-app-state"),
  writeStateSnapshot: () => ipcRenderer.invoke("write-state-snapshot"),
  setupWebviewLogger: (webviewId, slot, provider) =>
    ipcRenderer.invoke("setup-webview-logger", webviewId, slot, provider),
  generateCorrelationId: (prefix) =>
    ipcRenderer.invoke("generate-correlation-id", prefix),
  readConsoleLogs: (tail) => ipcRenderer.invoke("read-console-logs", tail),
  readErrorLogs: (tail) => ipcRenderer.invoke("read-error-logs", tail),
  getLogPaths: () => ipcRenderer.invoke("get-log-paths"),
  onConsoleLogForward: (callback) =>
    ipcRenderer.on("console-log-forward", (event, data) => callback(data)),
  whisperLoad: (params) => ipcRenderer.invoke("whisper-load", params),
  whisperSave: (params) => ipcRenderer.invoke("whisper-save", params),
  capturePage: (type, region) =>
    ipcRenderer.invoke("capture-page", type, region),
  screenshotCapture: (options) =>
    ipcRenderer.invoke("screenshot-capture", options),
  catboxUpload: (payload) => ipcRenderer.invoke("catbox-upload", payload),
  uguuUpload: (payload) => ipcRenderer.invoke("uguu-upload", payload),
  googledriveStartAuth: () => ipcRenderer.invoke("googledrive-start-auth"),
  googledriveExchangeCode: (code) =>
    ipcRenderer.invoke("googledrive-exchange-code", code),
  googledriveUpload: (payload) =>
    ipcRenderer.invoke("googledrive-upload", payload),
  googledriveDisconnect: () => ipcRenderer.invoke("googledrive-disconnect"),
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowToggleFullscreen: () => ipcRenderer.send("window-toggle-fullscreen"),
  windowClose: () => ipcRenderer.send("window-close"),
  windowMinimizeToTray: () => ipcRenderer.send("window-minimize-to-tray"),
  appRestart: () => ipcRenderer.invoke("app-restart"),
  openTerminal: (path) => ipcRenderer.invoke("open-terminal", path),
  shellOpenPath: (path) => ipcRenderer.invoke("shell-open-path", path),
  deviceAction: (action, payload) =>
    ipcRenderer.invoke("device-action", action, payload),
  generateTree: (basePath, options) =>
    ipcRenderer.invoke("generate-tree", basePath, options),
  // OpenCode Config API
  loadOpencodeConfig: () => ipcRenderer.invoke("load-opencode-config"),
  saveOpencodeConfig: (config) => ipcRenderer.invoke("save-opencode-config", config),
  opcAddRecentFolder: (path, name) => ipcRenderer.invoke("opencode-add-recent-folder", path, name),
  opcRemoveRecentFolder: (path) => ipcRenderer.invoke("opencode-remove-recent-folder", path),
  opcAddBinary: (path, version) => ipcRenderer.invoke("opencode-add-binary", path, version),
  opcRemoveBinary: (path) => ipcRenderer.invoke("opencode-remove-binary", path),
  opcUpdatePreferences: (updates) => ipcRenderer.invoke("opencode-update-preferences", updates),
  opcRecordWorkspaceLaunch: (folderPath, binaryPath) => ipcRenderer.invoke("opencode-record-workspace-launch", folderPath, binaryPath),

  // OpenCode Server API
  opencodeStart: (options) => ipcRenderer.invoke("opencode-start", options),
  opencodeStop: () => ipcRenderer.invoke("opencode-stop"),
  opencodeStatus: () => ipcRenderer.invoke("opencode-status"),

  // OpenCode SSE Server
  opencodeSSEStart: (config) => ipcRenderer.invoke("opencode-sse-start", config),
  opencodeSSEStop: () => ipcRenderer.invoke("opencode-sse-stop"),
  opencodeSSEStatus: () => ipcRenderer.invoke("opencode-sse-status"),
  opencodeSSESession: () => ipcRenderer.invoke("opencode-sse-session"),
  opencodeSSEStartSession: () => ipcRenderer.invoke("opencode-sse-start-session"),
  opencodeSSEEndSession: () => ipcRenderer.invoke("opencode-sse-end-session"),
  opencodeSSEConnect: () => ipcRenderer.invoke("opencode-sse-connect"),
  opencodeSSEDisconnect: () => ipcRenderer.invoke("opencode-sse-disconnect"),
  
  // Legacy assistant aliases (opencode'a yönlendirilir)
  assistantConnect: (provider, options) =>
    ipcRenderer.invoke("opencode-start", options),
  assistantDisconnect: () => ipcRenderer.invoke("opencode-stop"),
  assistantStatus: () => ipcRenderer.invoke("opencode-status"),
  assistantGetConfig: (providerId) =>
    ipcRenderer.invoke("get-provider-config", providerId),
  onAssistantDisconnected: (callback) =>
    ipcRenderer.on("assistant-disconnected", (event, data) => callback(data)),
  
  // OpenCode CLI Integration (Agent & Model Lists)
  opcListModels: () => ipcRenderer.invoke("opc-list-models"),
  opcListAgents: () => ipcRenderer.invoke("opc-list-agents"),
  
  // OpenCode Agent/Model Preference Persistence
  opcGetAgentModelPreference: (folderPath) => ipcRenderer.invoke("opc-get-agent-model-preference", folderPath),
  opcSaveAgentModelPreference: (preference, folderPath) => ipcRenderer.invoke("opc-save-agent-model-preference", preference, folderPath),
  opcSaveAgentPreference: (agent, folderPath) => ipcRenderer.invoke("opc-save-agent-preference", agent, folderPath),
  opcSaveModelPreference: (providerId, modelId, folderPath) => ipcRenderer.invoke("opc-save-model-preference", providerId, modelId, folderPath),
  
  // OpenCode Filesystem (Directory Browser)
  opcOpenFolderDialog: (options) => ipcRenderer.invoke("opc-open-folder-dialog", options),
  opcOpenFileDialog: (options) => ipcRenderer.invoke("opc-open-file-dialog", options),
  opcListFilesystem: (path, options) => ipcRenderer.invoke("opc-list-filesystem", path, options),
  opcValidatePath: (path) => ipcRenderer.invoke("opc-validate-path", path),
  opcGetHomePath: () => ipcRenderer.invoke("opc-get-home-path"),
  opcJoinPath: (...segments) => ipcRenderer.invoke("opc-join-path", ...segments),
  opcPathInfo: (path) => ipcRenderer.invoke("opc-path-info", path),
});

try {
  const isMainFrame =
    !window.location.href.startsWith("http") ||
    window.location.hostname.includes("localhost");

  if (typeof window !== "undefined" && isMainFrame) {
    function disableSpellcheck() {
      try {
        document.querySelectorAll("input, textarea").forEach((el) => {
          el.setAttribute("spellcheck", "false");
          el.autocapitalize = "off";
          el.autocomplete = "off";
        });
      } catch (err) {
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
          console.log("[Hayalet-Preload] /js/app.js loaded via src.");
        };
        s.onerror = (err) => {
          console.error(
            "[Hayalet-Preload] Error loading /js/app.js via src:",
            JSON.stringify(err),
          );
        };

        (document.head || document.documentElement).appendChild(s);
      } catch (err) {
        console.warn("injectInitApp failed", err);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", injectInitApp);
    } else {
      injectInitApp();
    }
  }
} catch (e) {
}
