const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readDirectoryFiles: (dirPath) =>
    ipcRenderer.invoke("read-directory-files", dirPath),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  createAccount: (accountData) =>
    ipcRenderer.invoke("create-account", accountData),
  assignAccountToSlot: (slot, accountId) =>
    ipcRenderer.invoke("assign-account-to-slot", slot, accountId),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  readArchivesIndex: () => ipcRenderer.invoke("read-archives-index"),
  writeArchivesIndex: (entries) =>
    ipcRenderer.invoke("write-archives-index", entries),
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
  removeArchive: (folderPath) =>
    ipcRenderer.invoke("remove-archive", folderPath),
  copyFileTo: (srcPath, destDir) =>
    ipcRenderer.invoke("copy-file-to", srcPath, destDir),
  openPath: (path) => ipcRenderer.invoke("open-path", path),
  fmEnsureDirs: (scope) => ipcRenderer.invoke("fm-ensure-dirs", scope),
  fmTempPath: (prefix, ext) => ipcRenderer.invoke("fm-temp-path", prefix, ext),
  fmWriteFileAtomic: (payload) =>
    ipcRenderer.invoke("fm-write-file-atomic", payload),
  fmArchiveWrite: (meta, files) =>
    ipcRenderer.invoke("fm-archive-write", meta, files),
  getPreloadPath: (type) => ipcRenderer.invoke("get-preload-path", type),
  getProviderConfig: (providerId) =>
    ipcRenderer.invoke("get-provider-config", providerId),
  sendToHost: (channel, data) => ipcRenderer.sendToHost(channel, data),
  archiveSync: (payload) => ipcRenderer.invoke("archive-sync", payload),
  appendLog: (payload) => ipcRenderer.invoke("append-log", payload),
  whisperLoad: (provider) => ipcRenderer.invoke("whisper-load", provider),
  whisperSave: (provider, payload) =>
    ipcRenderer.invoke("whisper-save", provider, payload),
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
  appRestart: () => ipcRenderer.invoke("app-restart"),
  deviceAction: (action, payload) =>
    ipcRenderer.invoke("device-action", action, payload),
  generateTree: (basePath, options) =>
    ipcRenderer.invoke("generate-tree", basePath, options),
});

try {
  // Guard to ensure this only runs in the main application window, not in a provider webview.
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
        /* noop */
      }
    }

    function injectInitApp() {
      try {
        if (window.__hayalet_init_injected) return;
        window.__hayalet_init_injected = true;
        disableSpellcheck();

        // Create a script tag and set its src to load the main app script.
        // This is more CSP-friendly than setting textContent.
        const s = document.createElement("script");
        s.type = "module";
        s.src = "/js/app.js"; // Set the src directly
        s.onload = () => {
          console.log("[Hayalet-Preload] /js/app.js loaded via src.");
          // The app.js module itself should now handle calling initApp.
        };
        s.onerror = (err) => {
          // It's a bit tricky to get detailed error from script tags
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
  /* noop */
}
