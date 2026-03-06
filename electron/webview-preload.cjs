const { contextBridge, ipcRenderer } = require("electron");

let __global_hayalet_slot = null;

contextBridge.exposeInMainWorld("electronAPI", {
  readDirectoryFiles: (dirPath) => ipcRenderer.invoke("read-directory-files", dirPath),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  readArchivesIndex: () => ipcRenderer.invoke("read-archives-index"),
  writeArchivesIndex: (entries) => ipcRenderer.invoke("write-archives-index", entries),
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
  copyToAssets: (srcPath, role) => ipcRenderer.invoke("copy-to-assets", srcPath, role),
  removeArchive: (folderPath) => ipcRenderer.invoke("remove-archive", folderPath),
  copyFileTo: (srcPath, destDir) => ipcRenderer.invoke("copy-file-to", srcPath, destDir),
  openPath: (path) => ipcRenderer.invoke("open-path", path),
  fmEnsureDirs: (scope) => ipcRenderer.invoke("fm-ensure-dirs", scope),
  fmTempPath: (prefix, ext) => ipcRenderer.invoke("fm-temp-path", prefix, ext),
  fmWriteFileAtomic: (payload) => ipcRenderer.invoke("fm-write-file-atomic", payload),
  fmArchiveWrite: (meta, files) => ipcRenderer.invoke("fm-archive-write", meta, files),
  getPreloadPath: (type) => ipcRenderer.invoke("get-preload-path", type),
  getProviderConfig: (providerId) => ipcRenderer.invoke("get-provider-config", providerId),
  sendToHost: (channel, data) => ipcRenderer.sendToHost(channel, data),
  archiveSync: (payload) => ipcRenderer.invoke("archive-sync", payload),
  whisperLoad: (provider) => ipcRenderer.invoke("whisper-load", provider),
  whisperSave: (provider, payload) => ipcRenderer.invoke("whisper-save", provider, payload),
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
  appRestart: () => ipcRenderer.invoke("app-restart"),
  deviceAction: (action, payload) => ipcRenderer.invoke("device-action", action, payload),
  generateTree: (basePath, options) => ipcRenderer.invoke("generate-tree", basePath, options),

  // OpenCode Native UI - Config & Filesystem
  loadOpencodeConfig: () => ipcRenderer.invoke("opc-load-config"),
  saveOpencodeConfig: (config) => ipcRenderer.invoke("opc-save-config", config),
  opcAddRecentFolder: (path, name) => ipcRenderer.invoke("opc-add-recent-folder", path, name),
  opcRemoveRecentFolder: (path) => ipcRenderer.invoke("opc-remove-recent-folder", path),
  opcAddBinary: (path, version) => ipcRenderer.invoke("opc-add-binary", path, version),
  opcRemoveBinary: (path) => ipcRenderer.invoke("opc-remove-binary", path),
  opcUpdatePreferences: (updates) => ipcRenderer.invoke("opc-update-preferences", updates),
  opcRecordLaunch: (folderPath, binaryPath) =>
    ipcRenderer.invoke("opc-record-launch", folderPath, binaryPath),
  opcOpenFolderDialog: (options) => ipcRenderer.invoke("opc-open-folder-dialog", options),
  opcOpenFileDialog: (options) => ipcRenderer.invoke("opc-open-file-dialog", options),
  opcListFilesystem: (path, options) => ipcRenderer.invoke("opc-list-filesystem", path, options),
  opcValidatePath: (path) => ipcRenderer.invoke("opc-validate-path", path),
  opcGetHomePath: () => ipcRenderer.invoke("opc-get-home-path"),
  opcJoinPath: (...segments) => ipcRenderer.invoke("opc-join-path", ...segments),
  opcPathInfo: (path) => ipcRenderer.invoke("opc-path-info", path),

  // OpenCode CLI Integration (Agent & Model Lists)
  opcListModels: () => ipcRenderer.invoke("opc-list-models"),
  opcListAgents: () => ipcRenderer.invoke("opc-list-agents"),
  opcGetAgentModelPreference: (folderPath) =>
    ipcRenderer.invoke("opc-get-agent-model-preference", folderPath),
  opcSaveAgentModelPreference: (prefs, folderPath) =>
    ipcRenderer.invoke("opc-save-agent-model-preference", prefs, folderPath),
  opencodeUiApiProxy: (options) => ipcRenderer.invoke("opencode-ui-api-proxy", options),
  opencodeUiFsListSessions: (dbPath) => ipcRenderer.invoke("opencode-ui-fs-list-sessions", dbPath),
  opencodeUiFsEnsureSession: (sessionId, title, dbPath) =>
    ipcRenderer.invoke("opencode-ui-fs-ensure-session", sessionId, title, dbPath),
  opencodeUiFsReadSession: (sessionId, dbPath) =>
    ipcRenderer.invoke("opencode-ui-fs-read-session", sessionId, dbPath),
  opencodeUiHevTools: () => ipcRenderer.invoke("opencode-ui-hev-tools"),
});

function setupProvider() {
  let slot = __global_hayalet_slot;

  if (!slot) {
    try {
      slot = window.__hayalet_slot || null;
    } catch (_) {}
  }

  if (!slot) {
    const hash = window.location.hash || "";
    slot = hash.substring(1);
  }

  if (slot === "ai0") {
    return;
  }

  if (!slot || (slot !== "ai1" && slot !== "ai2")) {
    return;
  }

  console.info(
    "[Hayalet-Preload] Setting up provider for slot:",
    slot,
    "(from",
    __global_hayalet_slot ? "IPC" : "hash",
    ")"
  );

  let readyState = "loading";
  let sendState = "not-found";
  let thinkingState = "idle";
  let stabilityTimer = null;

  function updateState() {
    try {
      ipcRenderer.sendToHost("provider-state", {
        slot,
        readyState,
        sendState,
        thinkingState,
      });
    } catch (e) {}
  }

  function checkReady() {
    const pcfg =
      (window.__hayalet_provider_config && window.__hayalet_provider_config.selectors) || {};
    const prompt = pcfg.inputField ? document.querySelector(pcfg.inputField) : null;
    const sendButton = pcfg.sendButton ? document.querySelector(pcfg.sendButton) : null;

    if (prompt && sendButton) {
      if (stabilityTimer) clearTimeout(stabilityTimer);
      stabilityTimer = setTimeout(() => {
        readyState = "ready";
        sendState = sendButton.disabled ? "disabled" : "enabled";
        updateState();
      }, 500);
    } else {
      readyState = "loading";
      updateState();
    }
  }

  function updateSend() {
    const pcfg =
      (window.__hayalet_provider_config && window.__hayalet_provider_config.selectors) || {};
    const sendButton = pcfg.sendButton ? document.querySelector(pcfg.sendButton) : null;
    sendState = sendButton ? (sendButton.disabled ? "disabled" : "enabled") : "not-found";
    updateState();
  }

  function updateThinking() {
    const pcfg =
      (window.__hayalet_provider_config && window.__hayalet_provider_config.selectors) || {};
    const stopButton = pcfg.stopButton ? document.querySelector(pcfg.stopButton) : null;
    thinkingState = stopButton ? "thinking" : "idle";
    updateState();
  }

  const observer = new MutationObserver(() => {
    checkReady();
    updateSend();
    updateThinking();
  });

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      setTimeout(startObserver, 100);
    }
  }

  ipcRenderer.on("nav-start", () => {
    readyState = "loading";
    sendState = "not-found";
    thinkingState = "idle";
    updateState();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      startObserver();
      checkReady();
    });
  } else if (document.body) {
    startObserver();
    checkReady();
  } else {
    window.addEventListener("load", () => {
      startObserver();
      checkReady();
    });
  }

  setInterval(() => {
    updateSend();
    updateThinking();
  }, 1000);
}

// Don't call setupProvider() immediately - wait for IPC message
// setupProvider(); // Removed: causes race condition, slot info comes via IPC

ipcRenderer.on("hayalet-set-provider", async (event, payload) => {
  try {
    const providerId = typeof payload === "string" ? payload : payload?.providerId;
    const slot = typeof payload === "object" ? payload?.slot : null;

    if (!providerId) return;

    const cfg = await ipcRenderer.invoke("get-provider-config", providerId);
    if (!cfg) {
      console.error("[Hayalet-Preload] Failed to get provider config for:", providerId);
      return;
    }

    try {
      try {
        window.__hayalet_provider_config = cfg;
        console.info("[Hayalet-Preload] Provider config set:", cfg.id, cfg.name);
      } catch (e) {
        console.error("[Hayalet-Preload] Failed to set provider config:", e);
      }
    } catch (e) {
      console.error("[Hayalet-Preload] Outer error setting provider config:", e);
    }

    if (slot) {
      try {
        __global_hayalet_slot = slot;
        window.__hayalet_slot = slot;
        console.info("[Hayalet-Preload] Slot set via IPC:", slot);
        setupProvider();
      } catch (err) {
        console.warn("[Hayalet-Preload] Failed to set slot:", err);
      }
    }

    // --- Apply DOM selector filters (simple remove) ---
    try {
      const sels = (cfg.filters && cfg.filters.selectors) || [];
      if (sels && sels.length) {
        const applyFilters = () => {
          try {
            sels.forEach((sel) => {
              try {
                document.querySelectorAll(sel).forEach((n) => n.remove());
              } catch (_) {}
            });
          } catch (_) {}
        };
        applyFilters();
        try {
          const moTarget = document.documentElement || document.body;
          if (moTarget) {
            const mo = new MutationObserver(() => applyFilters());
            mo.observe(moTarget, { childList: true, subtree: true });
          }
        } catch (_) {}
      }
    } catch (_) {}

    // --- Telemetry: intercept fetch and XHR for configured endpoints ---
    try {
      const endpoints = (cfg.telemetry && cfg.telemetry.endpoints) || [];
      const tokenPaths = (cfg.telemetry && cfg.telemetry.tokenPaths) || [];
      const matchesEndpoint = (url) => {
        try {
          if (!url) return false;
          return endpoints.some((e) => e && url.indexOf(e) !== -1);
        } catch (_) {
          return false;
        }
      };

      const extractTokens = (obj) => {
        try {
          const out = [];
          tokenPaths.forEach((p) => {
            try {
              const parts = p.split(".");
              let cur = obj;
              for (const part of parts) {
                if (cur == null) break;
                cur = cur[part];
              }
              if (cur != null) out.push(cur);
            } catch (_) {}
          });
          return out;
        } catch (_) {
          return [];
        }
      };

      try {
        const _fetch = window.fetch;
        window.fetch = async function (...args) {
          const res = await _fetch.apply(this, args);
          try {
            const reqUrl =
              typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || res.url;
            if (matchesEndpoint(reqUrl)) {
              try {
                const clone = res.clone();
                const ct =
                  (clone.headers && clone.headers.get && clone.headers.get("content-type")) || "";
                if (ct.includes("application/json")) {
                  clone
                    .json()
                    .then((json) => {
                      const toks = extractTokens(json);
                      if (toks && toks.length) {
                        try {
                          ipcRenderer.sendToHost("provider-usage", {
                            providerId,
                            url: reqUrl,
                            tokens: toks,
                          });
                        } catch (err) {
                          console.warn("[Hayalet-Webview] provider-usage send failed", err);
                        }
                      }
                    })
                    .catch(() => {});
                }
              } catch (_) {}
            }
          } catch (_) {}
          return res;
        };
      } catch (_) {}

      try {
        const OrigXHR = window.XMLHttpRequest;
        function WrappedXHR() {
          const xhr = new OrigXHR();
          let _url = null;
          const _open = xhr.open;
          xhr.open = function (method, url, ...rest) {
            _url = url;
            return _open.call(this, method, url, ...rest);
          };
          const _onready = xhr.onreadystatechange;
          xhr.onreadystatechange = function () {
            try {
              if (this.readyState === 4) {
                try {
                  if (matchesEndpoint(_url)) {
                    const ct =
                      (this.getResponseHeader && this.getResponseHeader("content-type")) || "";
                    if (ct.includes("application/json")) {
                      try {
                        const json = JSON.parse(this.responseText || "{}");
                        const toks = extractTokens(json);
                        if (toks && toks.length) {
                          try {
                            ipcRenderer.sendToHost("provider-usage", {
                              providerId,
                              url: _url,
                              tokens: toks,
                            });
                          } catch (err) {
                            console.warn("[Hayalet-Webview] provider-usage send failed", err);
                          }
                        }
                      } catch (_) {}
                    }
                  }
                } catch (_) {}
              }
            } catch (_) {}
            if (typeof _onready === "function") return _onready.apply(this, arguments);
          };
          return xhr;
        }
        try {
          WrappedXHR.prototype = OrigXHR.prototype;
          window.XMLHttpRequest = WrappedXHR;
        } catch (_) {}
      } catch (_) {}
    } catch (_) {}
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("hayalet-set-provider handler error", err);
    }
  }
});
