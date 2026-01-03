// @ts-nocheck
// Webview sayfası controller'ı
import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { AppState } from "../modules/app-state.js";
import { ProviderRegistry } from "../modules/webview/provider-registry.js";

export class WebviewController {
  constructor() {
    this.ai1Webview = null;
    this.ai2Webview = null;
    this.settings = null;
    this.trafficUnsub = null;
    this.loadLogState = {
      ai1: { lastStart: 0, lastStop: 0 },
      ai2: { lastStart: 0, lastStop: 0 },
    };
  }

  async init() {
    await this.loadSettings();
    this.applyTitles();

    // Realtime settings sync
    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe((s) => {
        this.settings = s;
        this.applyTitles();
      });
    }
    if (!this.trafficUnsub) {
      this.trafficUnsub = TrafficManager.onUpdate(({ provider, state }) => {
        if (provider) {
          this.updateUrlDisplay(provider, state);
        } else {
          ["ai1", "ai2"].forEach((p) => {
            this.updateUrlDisplay(p, TrafficManager.state[p]);
          });
        }
      });
    }
    this.setupEventListeners();
    this.setupWebviews();
    try {
      await this.applyCatchToggles();
    } catch (_) {
      void 0;
    }
    this.updateUrlDisplay("ai1", TrafficManager.state.ai1);
    this.updateUrlDisplay("ai2", TrafficManager.state.ai2);
  }

  updateUrlDisplay(provider, state) {
    const urlDisplay = document.getElementById(`${provider}-url-display`);
    if (!urlDisplay) return;

    // Check if slot has an active account
    const hasAccount = !!this.settings?.[provider]?.activeAccountId;
    if (!hasAccount) {
      urlDisplay.textContent = "Slot boş - Hesap atanmadı";
      return;
    }

    const href = state?.lastHref || "";
    if (href) {
      urlDisplay.textContent = href;
    } else {
      urlDisplay.textContent = "-";
    }
  }

  applyTitles() {
    const chatTitle = document.getElementById("ai1-title");
    const ai2Title = document.getElementById("ai2-title");
    if (chatTitle) chatTitle.textContent = AppState.getNickname("ai1");
    if (ai2Title) ai2Title.textContent = AppState.getNickname("ai2");
  }

  async loadSettings() {
    this.settings = await SettingsManager.load();
    CoreEngine.useSettings(this.settings);
  }

  // Apply per-webview catch toggles (UI) and wire to settings
  async applyCatchToggles() {
    try {
      const ai1Toggle = document.getElementById("ai1-catch-toggle");
      const ai2Toggle = document.getElementById("ai2-catch-toggle");
      const ai1Val = this.settings?.ai1?.catchCommands;
      const ai2Val = this.settings?.ai2?.catchCommands;
      if (ai1Toggle) {
        ai1Toggle.checked = typeof ai1Val === "boolean" ? ai1Val : true;
        ai1Toggle.addEventListener("change", async (e) => {
          try {
            await SettingsManager.set("ai1.catchCommands", !!e.target.checked);
            await this.loadSettings();
            CoreEngine.useSettings(this.settings);
          } catch (err) {
            console.error("Failed to save ai1 catch setting", err);
          }
        });
      }
      if (ai2Toggle) {
        ai2Toggle.checked = typeof ai2Val === "boolean" ? ai2Val : true;
        ai2Toggle.addEventListener("change", async (e) => {
          try {
            await SettingsManager.set("ai2.catchCommands", !!e.target.checked);
            await this.loadSettings();
            CoreEngine.useSettings(this.settings);
          } catch (err) {
            console.error("Failed to save ai2 catch setting", err);
          }
        });
      }
    } catch (err) {
      console.warn("applyCatchToggles failed", err);
    }
  }

  setupEventListeners() {
    try {
      const ai1DevtoolsBtn = document.getElementById("ai1-devtools-btn");

      if (ai1DevtoolsBtn) {
        ai1DevtoolsBtn.addEventListener("click", () => {
          this.openDevTools("ai1");
        });
      }

      const ai2DevtoolsBtn = document.getElementById("ai2-devtools-btn");

      if (ai2DevtoolsBtn) {
        ai2DevtoolsBtn.addEventListener("click", () => {
          this.openDevTools("ai2");
        });
      }
    } catch (error) {
      console.error("Error setting up webview event listeners:", error);
      LogManager.addEvent(
        "webview",
        "error",
        `Event listener hatası: ${error.message}`,
      );
    }
  }

  async setupWebviews() {
    try {
      const ai1WebviewEl = document.getElementById("ai1-webview");
      const ai2WebviewEl = document.getElementById("ai2-webview");

      // Check if AI1 slot has an active account
      const ai1HasAccount = !!this.settings?.ai1?.activeAccountId;
      
      if (ai1WebviewEl && ai1HasAccount) {
        this.ai1Webview = ai1WebviewEl;
        CoreEngine.registerWebview("ai1", ai1WebviewEl);

        const ai1ProviderId = this.settings?.ai1?.providerId;
        this.setupWebviewEvents("ai1", ai1WebviewEl, ai1ProviderId);
        TrafficManager.attachWebview("ai1", ai1WebviewEl);

        // Preload script yolunu Electron IPC ile ayarla (src'den önce yapılmalı)
        if (window.electronAPI?.getPreloadPath) {
          try {
            const preloadPath = await window.electronAPI.getPreloadPath("ai1");
            if (preloadPath) {
              ai1WebviewEl.setAttribute("preload", preloadPath);
              this.addLog(
                "ai1",
                "info",
                `Preload script ayarlandı: ${preloadPath}`,
              );

              // Preload hazır olana kadar kısa bekle, sonra `src` ata (hash ile)
              setTimeout(() => {
                const providerId = this.settings?.ai1?.providerId;
                if (!providerId) return;
                const cfg = ProviderRegistry.get(providerId);
                const ai1Url = cfg?.baseUrl;
                if (ai1Url) {
                  // Load URL without hash
                  ai1WebviewEl.src = ai1Url;
                  this.addLog(
                    "ai1",
                    "info",
                    `Webview yükleniyor: ${ai1Url}`,
                  );
                }
              }, 100);
            }
          } catch (err) {
            console.warn("Could not set preload path for AI1:", err);
            this.addLog("ai1", "warning", "Preload script ayarlanamadı...");
          }
        }
      }

      // Check if AI2 slot has an active account
      const ai2HasAccount = !!this.settings?.ai2?.activeAccountId;
      
      if (ai2WebviewEl && ai2HasAccount) {
        this.ai2Webview = ai2WebviewEl;
        CoreEngine.registerWebview("ai2", ai2WebviewEl);

        const ai2ProviderId = this.settings?.ai2?.providerId;
        this.setupWebviewEvents("ai2", ai2WebviewEl, ai2ProviderId);
        TrafficManager.attachWebview("ai2", ai2WebviewEl);

        // Set preload script path via Electron IPC (must be set before src)
        if (window.electronAPI?.getPreloadPath) {
          try {
            const preloadPath = await window.electronAPI.getPreloadPath("ai2");
            if (preloadPath) {
              ai2WebviewEl.setAttribute("preload", preloadPath);
              this.addLog(
                "ai2",
                "info",
                `Preload script ayarlandı: ${preloadPath}`,
              );

              // Wait a bit for preload to be ready, then set src (with hash)
              setTimeout(() => {
                const providerId = this.settings?.ai2?.providerId;
                if (!providerId) return;
                const cfg = ProviderRegistry.get(providerId);
                const ai2Url = cfg?.baseUrl;
                if (ai2Url) {
                  // Load URL without hash
                  ai2WebviewEl.src = ai2Url;
                  this.addLog(
                    "ai2",
                    "info",
                    `Webview yükleniyor: ${ai2Url}`,
                  );
                }
              }, 100);
            }
          } catch (err) {
            console.warn("Could not set preload path for A2:", err);
            this.addLog("ai2", "warning", "Preload script ayarlanamadı...");
          }
        }
      }
    } catch (error) {
      console.error("Error setting up webviews:", error);
      LogManager.addEvent(
        "webview",
        "error",
        `Webview kurulum hatası: ${error.message}`,
      );
    }
  }

  setupWebviewEvents(type, webviewEl, providerId = null) {
    if (!webviewEl) return;

    let domReady = false;
    webviewEl.addEventListener("dom-ready", () => {
      domReady = true;
      this.addLog(type, "info", "DOM hazır");
    });

    webviewEl.addEventListener("did-start-loading", () => {
      const state = this.loadLogState[type] || { lastStart: 0, lastStop: 0 };
      const now = Date.now();

      if (now - state.lastStart > 1200) {
        this.addLog(type, "info", "Sayfa yükleniyor...");
        state.lastStart = now;
      }
      this.loadLogState[type] = state;

      const sendNavStart = () => {
        try {
          webviewEl.send?.("nav-start");
        } catch (err) {
          console.warn("nav-start send failed:", err);
        }
      };
      if (domReady) {
        sendNavStart();
      } else {
        webviewEl.addEventListener("dom-ready", sendNavStart, { once: true });
      }
    });

    webviewEl.addEventListener("did-stop-loading", () => {
      const state = this.loadLogState[type] || { lastStop: 0 };
      const now = Date.now();

      if (now - state.lastStop > 1200) {
        this.addLog(type, "info", "Sayfa yükleme tamamlandı");
        state.lastStop = now;
      }
      this.loadLogState[type] = state;
    });

    // Send providerId and slot into the guest preload once DOM ready so preload can fetch config
    webviewEl.addEventListener("dom-ready", async () => {
      try {
        if (providerId && webviewEl.send) {
          try {
            // Send both providerId and slot information via IPC
            this.addLog(
              type,
              "debug",
              `Sending hayalet-set-provider IPC: providerId=${providerId}, slot=${type}`,
            );
            webviewEl.send("hayalet-set-provider", { providerId, slot: type });
            this.addLog(
              type,
              "debug",
              `hayalet-set-provider IPC sent successfully`,
            );

            // ALSO inject provider config directly via executeJavaScript as a fallback
            try {
              const cfg = ProviderRegistry.get(providerId);
              if (cfg) {
                const configScript = `
                  (function() {
                    try {
                      window.__hayalet_slot = ${JSON.stringify(type)};
                      window.__hayalet_provider_config = ${JSON.stringify(cfg)};
                      console.log('[Hayalet-Direct-Inject] Provider config set for slot:', ${JSON.stringify(type)}, 'provider:', ${JSON.stringify(providerId)});
                      return true;
                    } catch (e) {
                      console.error('[Hayalet-Direct-Inject] Failed:', e);
                      return false;
                    }
                  })();
                `;
                await webviewEl.executeJavaScript(configScript);
                this.addLog(
                  type,
                  "debug",
                  `Provider config injected directly via executeJavaScript`,
                );
              }
            } catch (err) {
              this.addLog(
                type,
                "warning",
                `Failed to inject provider config directly: ${err.message}`,
              );
            }
          } catch (err) {
            this.addLog(
              type,
              "error",
              `Failed to send hayalet-set-provider IPC: ${err.message}`,
            );
          }
        } else {
          this.addLog(
            type,
            "warning",
            `Cannot send hayalet-set-provider: providerId=${providerId}, send=${!!webviewEl.send}`,
          );
        }
      } catch (err) {
        this.addLog(
          type,
          "error",
          `hayalet-set-provider outer error: ${err.message}`,
        );
      }
    });

    // Listen for provider telemetry messages from preload
    webviewEl.addEventListener("ipc-message", (event) => {
      try {
        if (!event || !event.channel) return;
        if (event.channel === "provider-usage") {
          const payload = (event.args && event.args[0]) || null;
          if (payload) {
            const titleEl = document.getElementById(`${type}-title`);
            if (titleEl) {
              const base = AppState.getNickname(type);
              const tokens = Array.isArray(payload.tokens)
                ? payload.tokens.join(",")
                : String(payload.tokens || "");
              titleEl.textContent = tokens
                ? `${base} — tokens: ${tokens}`
                : base;
            }
          }
        }
      } catch (err) {
        console.warn("ipc-message handler error", err);
      }
    });

    webviewEl.addEventListener("did-fail-load", (event) => {
      // -106 ERR_INVALID_URL, -105 ERR_NAME_NOT_RESOLVED
      if (event.errorCode !== -3 && event.errorCode !== -102) {
        this.addLog(
          type,
          "error",
          `Yükleme hatası (${event.errorCode}): ${event.errorDescription || "Bilinmeyen hata"}`,
        );
      } else if (event.errorCode === -3) {
        this.addLog(type, "info", "Yükleme iptal edildi (normal)");
      }
    });
  }

  openDevTools(type) {
    try {
      const webview = type === "ai1" ? this.ai1Webview : this.ai2Webview;
      if (!webview) {
        this.addLog(type, "error", "Webview bulunamadı");
        return;
      }

      webview.openDevTools();
      this.addLog(type, "info", "DevTools açıldı");
    } catch (error) {
      console.error(`Error opening DevTools for ${type}:`, error);
      this.addLog(type, "error", `DevTools açma hatası: ${error.message}`);
    }
  }

  addLog(type, level, message) {
    LogManager.addEvent(`webview-${type}`, level, message);
  }

  async onShow() {
    await this.loadSettings();

    // Gerekirse webview'leri yeniden kur
    if (!this.ai1Webview || !this.ai2Webview) {
      this.setupWebviews();
    }
  }


  onHide() {
    try {
      this._unsubSettings?.();
      this._unsubSettings = null;
    } catch (_) {
      void 0;
    }
  }
}
