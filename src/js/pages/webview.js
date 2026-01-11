import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { AppState } from "../modules/app-state.js";
import { ProviderRegistry } from "../modules/webview/provider-registry.js";
import { WebviewManager } from "../modules/webview-manager.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";

export class WebviewController {
  constructor() {
    this.ai1Webview = null;
    this.ai2Webview = null;
    this.trafficUnsub = null;
    this.loadLogState = {
      ai1: { lastStart: 0, lastStop: 0 },
      ai2: { lastStart: 0, lastStop: 0 },
    };
  }

  async init() {
    await this.loadSettings();
    this.applyTitles();

    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(
        ({ settings, changedPaths }) => {
          this.applyTitles();
          this.applyWebviewGating(settings, changedPaths);
        },
      );
    }
    
    if (!this._unsubSlotController) {
      this._unsubSlotController = SlotController.on(SlotEvent.STATE_CHANGED, () => {
        this.applyWebviewGating(SettingsManager.getSnapshot(), ["*"]);
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
    await this.setupWebviews();
    this.applyWebviewGating(SettingsManager.getSnapshot(), ["*"]);
    this.updateUrlDisplay("ai1", TrafficManager.state.ai1);
    this.updateUrlDisplay("ai2", TrafficManager.state.ai2);
  }

  updateUrlDisplay(provider, state) {
    const urlDisplay = document.getElementById(`${provider}-url-display`);
    if (!urlDisplay) return;

    const hasAccount = !!AppState.getAccountForSlot(provider);
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
    const settings = await SettingsManager.load();
    CoreEngine.useSettings(settings);
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
    } catch (err) {
      const error = /** @type {Error} */ (err);
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
      
      if (ai1WebviewEl && !this.ai1Webview) {
        this.ai1Webview = ai1WebviewEl;
        CoreEngine.registerWebview("ai1", ai1WebviewEl);
      }
      
      if (ai2WebviewEl && !this.ai2Webview) {
        this.ai2Webview = ai2WebviewEl;
        CoreEngine.registerWebview("ai2", ai2WebviewEl);
      }
      
      const ai1Mount = document.getElementById("ai1-webview-mount");
      const ai2Mount = document.getElementById("ai2-webview-mount");
      
      if (ai1WebviewEl && ai1Mount && !ai1Mount.contains(ai1WebviewEl)) {
        ai1Mount.appendChild(ai1WebviewEl);
        ai1WebviewEl.style.position = "relative";
        ai1WebviewEl.style.top = "0";
        ai1WebviewEl.style.left = "0";
      }
      
      if (ai2WebviewEl && ai2Mount && !ai2Mount.contains(ai2WebviewEl)) {
        ai2Mount.appendChild(ai2WebviewEl);
        ai2WebviewEl.style.position = "relative";
        ai2WebviewEl.style.top = "0";
        ai2WebviewEl.style.left = "0";
      }

      const ai1HasAccount = !!AppState.getAccountForSlot("ai1");

      if (ai1WebviewEl && ai1HasAccount && !ai1WebviewEl.dataset.eventsSetup) {
        const ai1ProviderId = AppState.getProviderIdForSlot("ai1") || "";
        
        this.setupWebviewEvents("ai1", ai1WebviewEl, ai1ProviderId);
        ai1WebviewEl.dataset.eventsSetup = "true";

        if (window.electronAPI?.getPreloadPath && !ai1WebviewEl.getAttribute("preload")) {
          try {
            const preloadPath = await window.electronAPI.getPreloadPath("ai1");
            if (preloadPath) {
              ai1WebviewEl.setAttribute("preload", preloadPath);
              this.addLog(
                "ai1",
                "info",
                `Preload script ayarlandı: ${preloadPath}`,
              );
            }
          } catch (error) {
            const err = /** @type {Error} */ (error);
            console.warn("Could not set preload path for AI1:", error);
            this.addLog("ai1", "warning", "Preload script ayarlanamadı...");
          }
        }
      }

      const ai2HasAccount = !!AppState.getAccountForSlot("ai2");

      if (ai2WebviewEl && ai2HasAccount && !ai2WebviewEl.dataset.eventsSetup) {
        const ai2ProviderId = AppState.getProviderIdForSlot("ai2") || "";
        
        this.setupWebviewEvents("ai2", ai2WebviewEl, ai2ProviderId);
        ai2WebviewEl.dataset.eventsSetup = "true";

        if (window.electronAPI?.getPreloadPath && !ai2WebviewEl.getAttribute("preload")) {
          try {
            const preloadPath = await window.electronAPI.getPreloadPath("ai2");
            if (preloadPath) {
              ai2WebviewEl.setAttribute("preload", preloadPath);
              this.addLog(
                "ai2",
                "info",
                `Preload script ayarlandı: ${preloadPath}`,
              );
            }
          } catch (error) {
            const err = /** @type {Error} */ (error);
            console.warn("Could not set preload path for AI2:", error);
            this.addLog("ai2", "warning", "Preload script ayarlanamadı...");
          }
        }
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      console.error("Error setting up webviews:", error);
      LogManager.addEvent(
        "webview",
        "error",
        `Webview kurulum hatası: ${err.message}`,
      );
    }
  }

  getSlotState(settings, provider) {
    const slot = settings?.slots?.[provider] || {};
    const hasAccount = !!slot.accountId;
    const connected = SlotController.isConnected(provider);
    return {
      hasAccount,
      connected,
      active: hasAccount && connected,
    };
  }

  setDevtoolsEnabled(provider, enabled) {
    const btn = document.getElementById(`${provider}-devtools-btn`);
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);
  }

  applyWebviewGating(settings, _changedPaths = []) {
    if (!settings) settings = SettingsManager.getSnapshot();

    /** @type {Array<"ai1"|"ai2">} */
    const providers = ["ai1", "ai2"];

    for (const provider of providers) {
      const state = this.getSlotState(settings, provider);
      const webviewEl = document.getElementById(`${provider}-webview`);

      // URL display rule (doc): empty for non-assigned/non-connected
      const urlDisplay = document.getElementById(`${provider}-url-display`);

      if (!state.hasAccount) {
        // Slot empty - webview gizle ve UI güncelle
        this.setDevtoolsEnabled(provider, false);
        if (urlDisplay) urlDisplay.textContent = "";
        if (webviewEl) webviewEl.style.display = "none";
        continue;
      }

      if (!state.connected) {
        // Slot assigned but disconnected - webview gizle ve UI güncelle
        this.setDevtoolsEnabled(provider, false);
        if (urlDisplay) urlDisplay.textContent = "";
        if (webviewEl) webviewEl.style.display = "none";
        continue;
      }

      // Active (assigned + connected) - webview göster ve UI güncelle
      this.setDevtoolsEnabled(provider, true);
      
      // Webview'ı mount point'e taşı (eğer henüz taşınmadıysa)
      const mountId = `${provider}-webview-mount`;
      const mountEl = document.getElementById(mountId);
      if (webviewEl && mountEl && !mountEl.contains(webviewEl)) {
        mountEl.appendChild(webviewEl);
        webviewEl.style.position = "relative";
        webviewEl.style.top = "0";
        webviewEl.style.left = "0";
        webviewEl.style.width = "100%";
        webviewEl.style.height = "100%";
      }
      
      if (webviewEl) {
        webviewEl.style.display = "";
        webviewEl.removeAttribute("data-detached");
      }

      // If not set up yet, run setup (async) and let setup set src/preload
      if (provider === "ai1" && !this.ai1Webview) {
        void this.setupWebviews();
      }
      if (provider === "ai2" && !this.ai2Webview) {
        void this.setupWebviews();
      }
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
      // FIX: Check if URL is excluded before logging
      const currentUrl = webviewEl.getURL?.() || "";
      const isExcluded = WebviewManager?.isUrlExcluded?.(type, currentUrl);
      
      const state = this.loadLogState[type] || { lastStart: 0, lastStop: 0 };
      const now = Date.now();

      if (!isExcluded && now - state.lastStart > 1200) {
        this.addLog(type, "info", "Sayfa yükleniyor...");
        state.lastStart = now;
      }
      this.loadLogState[type] = state;

      const sendNavStart = () => {
        try {
          webviewEl.send?.("nav-start");
        } catch (error) {
          const err = /** @type {Error} */ (error);
          console.warn("nav-start send failed:", error);
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
            } catch (error) {
              this.addLog(
                type,
                "warning",
                `Failed to inject provider config directly: ${error.message}`,
              );
            }
          } catch (err) {
            const error = /** @type {Error} */ (err);
            this.addLog(
              type,
              "error",
              `Failed to send hayalet-set-provider IPC: ${error.message}`,
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
        const error = /** @type {Error} */ (err);
        this.addLog(
          type,
          "error",
          `hayalet-set-provider outer error: ${error.message}`,
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
      } catch (error) {
        console.warn("ipc-message handler error", error);
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

    const ai1WebviewEl = document.getElementById("ai1-webview");
    const ai2WebviewEl = document.getElementById("ai2-webview");
    
    // Mount point'leri al (webview sayfası gösterildiğinde DOM'da olacaklar)
    const ai1Mount = document.getElementById("ai1-webview-mount");
    const ai2Mount = document.getElementById("ai2-webview-mount");
    
    // SlotController.isConnected() runtime bağlantı durumunu kontrol eder
    const ai1Connected = SlotController.isConnected("ai1");
    const ai2Connected = SlotController.isConnected("ai2");
    
    if (ai1WebviewEl) {
      // Bağlıysa mount et ve göster
      if (ai1Connected) {
        // Mount point'e taşı (eğer henüz taşınmadıysa)
        if (ai1Mount && !ai1Mount.contains(ai1WebviewEl)) {
          ai1Mount.appendChild(ai1WebviewEl);
          ai1WebviewEl.style.position = "relative";
          ai1WebviewEl.style.top = "0";
          ai1WebviewEl.style.left = "0";
          ai1WebviewEl.style.width = "100%";
          ai1WebviewEl.style.height = "100%";
        }
        ai1WebviewEl.style.display = "";
        ai1WebviewEl.removeAttribute("data-detached");
      } else {
        ai1WebviewEl.style.display = "none";
      }
    }
    
    if (ai2WebviewEl) {
      // Bağlıysa mount et ve göster
      if (ai2Connected) {
        // Mount point'e taşı (eğer henüz taşınmadıysa)
        if (ai2Mount && !ai2Mount.contains(ai2WebviewEl)) {
          ai2Mount.appendChild(ai2WebviewEl);
          ai2WebviewEl.style.position = "relative";
          ai2WebviewEl.style.top = "0";
          ai2WebviewEl.style.left = "0";
        }
        ai2WebviewEl.style.display = "";
        ai2WebviewEl.removeAttribute("data-detached");
      } else {
        ai2WebviewEl.style.display = "none";
      }
    }

    this.applyTitles();
    this.applyWebviewGating(SettingsManager.getSnapshot(), ["*"]);
  }

  onHide() {
    // Webview'ları gizleme - arka planda çalışmaya devam etsinler
    // Sadece sayfa değişikliğinde webview sayfası gizlenecek, webview elementleri değil
    // Don't cleanup subscriptions (keep them active across page changes)
  }
}
