import { LogManager } from "../../modules/log-manager.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { AppState } from "../../modules/app-state.js";
import { SlotController } from "../../modules/slot-controller.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { ProviderRegistry } from "../../modules/webview/provider-registry.js";
import { WebviewManager } from "../../modules/webview-manager.js";
import type { LogLevel } from "../../types/index.js";
import type { AppSettings } from "../../types/settings.js";

// ============================================================================
// Types
// ============================================================================

type SlotType = "ai1" | "ai2";

interface TrafficState {
  lastHref?: string;
  [key: string]: unknown;
}

interface SlotState {
  hasAccount: boolean;
  connected: boolean;
  connecting: boolean;
  active: boolean;
}

interface WebviewElement extends HTMLElement {
  getWebContentsId?: () => number;
  getURL?: () => string;
  executeJavaScript?: (script: string) => Promise<unknown>;
  openDevTools?: () => void;
}

// ============================================================================
// WebviewPanel
// ============================================================================

/**
 * Webview Panel Controller
 * AI1 ve AI2 webview panellerini yönetir
 */
export class WebviewPanel {
  ai1Webview: HTMLElement | null;
  ai2Webview: HTMLElement | null;
  trafficUnsub: (() => void) | null;
  loadLogState: Record<string, { lastStart: number; lastStop: number }>;

  constructor() {
    this.ai1Webview = null;
    this.ai2Webview = null;
    this.trafficUnsub = null;
    this.loadLogState = {
      ai1: { lastStart: 0, lastStop: 0 },
      ai2: { lastStart: 0, lastStop: 0 },
    };
  }

  init(): void {
    this.setupEventListeners();
  }

  setupEventListeners(): void {
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
      LogManager.addEvent("webview-panel", "error", `Event listener setup hatası: ${error.message}`);
    }
  }

  subscribeToTraffic(): void {
    if (!this.trafficUnsub) {
      this.trafficUnsub = TrafficManager.onUpdate(({ provider, state }: { provider?: string; state?: unknown }) => {
        if (provider) {
          this.updateUrlDisplay(provider, state as TrafficState);
        } else {
          (["ai1", "ai2"] as SlotType[]).forEach((p) => {
            this.updateUrlDisplay(p, TrafficManager.state[p] as TrafficState);
          });
        }
      });
    }
  }

  applyTitles(): void {
    const ai1Title = document.getElementById("ai1-title");
    const ai2Title = document.getElementById("ai2-title");
    if (ai1Title) ai1Title.textContent = AppState.getNickname("ai1");
    if (ai2Title) ai2Title.textContent = AppState.getNickname("ai2");
  }

  updateUrlDisplay(provider: string, state: TrafficState | undefined): void {
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

  async setupWebviews(): Promise<void> {
    try {
      const ai1WebviewEl = document.getElementById("ai1-webview");
      const ai2WebviewEl = document.getElementById("ai2-webview");
      
      if (ai1WebviewEl && !this.ai1Webview) {
        this.ai1Webview = ai1WebviewEl;
        SlotController.registerWebview("ai1", ai1WebviewEl);
        WebviewManager.register("ai1", ai1WebviewEl);
      }
      
      if (ai2WebviewEl && !this.ai2Webview) {
        this.ai2Webview = ai2WebviewEl;
        SlotController.registerWebview("ai2", ai2WebviewEl);
        WebviewManager.register("ai2", ai2WebviewEl);
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
              this.addLog("ai1", "info", `Preload script ayarlandı: ${preloadPath}`);
            }
          } catch (err) {
            const error = err as Error;
            LogManager.addEvent("webview-panel", "warning", `AI1 preload path ayarlanamadı: ${error.message}`);
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
              this.addLog("ai2", "info", `Preload script ayarlandı: ${preloadPath}`);
            }
          } catch (err) {
            const error = err as Error;
            LogManager.addEvent("webview-panel", "warning", `AI2 preload path ayarlanamadı: ${error.message}`);
            this.addLog("ai2", "warning", "Preload script ayarlanamadı...");
          }
        }
      }
    } catch (err) {
      const error = err as Error;
      LogManager.addEvent("webview-panel", "error", `Webview setup hatası: ${error.message}`);
    }
  }

  getSlotState(settings: AppSettings | null, provider: string): SlotState {
    const slots = settings?.slots as Record<string, { accountId?: string }> | undefined;
    const slot = slots?.[provider] || {};
    const hasAccount = !!slot.accountId;
    const connected = SlotController.isConnected(provider);
    const connecting = SlotController.isTransitioning(provider);
    return {
      hasAccount,
      connected,
      connecting,
      // Webview aktif olmalı: bağlı VEYA bağlanıyor durumunda
      active: hasAccount && (connected || connecting),
    };
  }

  setDevtoolsEnabled(provider: string, enabled: boolean) {
    const btn = document.getElementById(`${provider}-devtools-btn`) as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);
  }

  applyGating(settings: AppSettings | null, _changedPaths: string[] = []): void {
    if (!settings) settings = SettingsManager.getSnapshot() as AppSettings;
    
    // Update titles
    this.applyTitles();

    const providers: SlotType[] = ["ai1", "ai2"];

    for (const provider of providers) {
      const state = this.getSlotState(settings, provider);
      const webviewEl = document.getElementById(`${provider}-webview`);
      const overlayEl = document.getElementById(`${provider}-webview-overlay`);
      const urlDisplay = document.getElementById(`${provider}-url-display`);

      if (!state.hasAccount) {
        // Slot empty - webview gizle, overlay göster
        this.setDevtoolsEnabled(provider, false);
        if (urlDisplay) urlDisplay.textContent = "";
        if (webviewEl) webviewEl.style.display = "none";
        if (overlayEl) {
          overlayEl.classList.remove("hidden");
          const icon = overlayEl.querySelector(".overlay-icon");
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (icon) icon.textContent = "🔌";
          if (title) title.textContent = "Hesap Atanmadı";
          if (subtitle) subtitle.textContent = "Settings'ten hesap atayın";
        }
        continue;
      }

      if (!state.connected && !state.connecting) {
        // Slot assigned but disconnected - webview gizle, overlay göster
        this.setDevtoolsEnabled(provider, false);
        if (urlDisplay) urlDisplay.textContent = "";
        if (overlayEl) {
          overlayEl.classList.remove("hidden");
          const icon = overlayEl.querySelector(".overlay-icon");
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (icon) icon.textContent = "⏸️";
          if (title) title.textContent = "Bağlantı Kesildi";
          if (subtitle) subtitle.textContent = "Bağlanmak için tıklayın";
        }
        if (webviewEl) webviewEl.style.display = "none";
        continue;
      }

      if (state.connecting) {
        // Bağlanıyor - webview'ı göster ama overlay'da "Bağlanıyor" göster
        this.setDevtoolsEnabled(provider, false);
        if (overlayEl) {
          overlayEl.classList.remove("hidden");
          const icon = overlayEl.querySelector(".overlay-icon");
          const title = overlayEl.querySelector(".overlay-title");
          const subtitle = overlayEl.querySelector(".overlay-subtitle");
          if (icon) icon.textContent = "🔄";
          if (title) title.textContent = "Bağlanıyor...";
          if (subtitle) subtitle.textContent = "Lütfen bekleyin";
        }
        // Webview'ı mount et ve GÖSTER (dom-ready için gerekli!)
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
        continue;
      }

      // Active (assigned + connected) - webview göster ve UI güncelle
      this.setDevtoolsEnabled(provider, true);
      
      // Bağlı durum - overlay'ı gizle
      if (overlayEl) {
        overlayEl.classList.add("hidden");
      }

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

      // If not set up yet, run setup
      if (provider === "ai1" && !this.ai1Webview) {
        void this.setupWebviews();
      }
      if (provider === "ai2" && !this.ai2Webview) {
        void this.setupWebviews();
      }
    }
  }

  setupWebviewEvents(type: SlotType, webviewEl: WebviewElement, providerId: string | null = null): void {
    if (!webviewEl) return;

    webviewEl.addEventListener("did-start-loading", () => {
      try {
        if (typeof webviewEl.getWebContentsId !== "function") return;
        webviewEl.getWebContentsId();
      } catch (_) {
        return;
      }

      let currentUrl = "";
      try {
        currentUrl = webviewEl.getURL?.() || "";
      } catch (_) {
        // getURL başarısız olabilir
      }
      const isExcluded = WebviewManager?.isUrlExcluded?.(type, currentUrl);
      
      const state = this.loadLogState[type] || { lastStart: 0, lastStop: 0 };
      const now = Date.now();

      if (!isExcluded && now - state.lastStart > 1200) {
        this.addLog(type, "info", "Sayfa yükleniyor...");
        state.lastStart = now;
      }
      this.loadLogState[type] = state;
    });

    webviewEl.addEventListener("did-stop-loading", async () => {
      try {
        if (typeof webviewEl.getWebContentsId !== "function") return;
        webviewEl.getWebContentsId();
      } catch (_) {
        return;
      }

      const state = this.loadLogState[type] || { lastStart: 0, lastStop: 0 };
      const now = Date.now();

      if (now - state.lastStop > 1200) {
        this.addLog(type, "info", "Sayfa yükleme tamamlandı");
        state.lastStop = now;
      }
      this.loadLogState[type] = state;

      // Provider config injection - sadece excluded olmayan sayfalarda
      let currentUrl = "";
      try {
        currentUrl = webviewEl.getURL?.() || "";
      } catch (_) {
        return;
      }
      
      const isExcluded = WebviewManager?.isUrlExcluded?.(type, currentUrl);
      if (isExcluded) return;

      const currentProviderId = AppState.getProviderIdForSlot(type) || providerId;
      const cfg = currentProviderId ? ProviderRegistry.get(currentProviderId) : null;
      if (cfg) {
        try {
          const configScript = `
            (function() {
              try {
                window.__hayalet_slot = ${JSON.stringify(type)};
                window.__hayalet_provider_config = ${JSON.stringify(cfg)};
                return true;
              } catch (e) {
                console.error('[Hayalet-Config-Inject] Failed:', e);
                return false;
              }
            })();
          `;
          await webviewEl.executeJavaScript?.(configScript);
        } catch (_err) {
          // Config injection başarısız - send() öncesi fallback devreye girecek
        }
      }
    });

    webviewEl.addEventListener("ipc-message", (event: Event & { channel?: string; args?: unknown[] }) => {
      try {
        if (!event || !event.channel) return;
        if (event.channel === "provider-usage") {
          const payload = (event.args && event.args[0]) as { tokens?: string | string[] } | null;
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
        const error = err as Error;
        LogManager.addEvent("webview-panel", "warning", `IPC message handler hatası: ${error.message}`);
      }
    });

    webviewEl.addEventListener("did-fail-load", (event: Event & { errorCode?: number; errorDescription?: string }) => {
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

  openDevTools(type: SlotType): void {
    try {
      const webview = type === "ai1" ? this.ai1Webview : this.ai2Webview;
      if (!webview) {
        this.addLog(type, "error", "Webview bulunamadı");
        return;
      }

      (webview as WebviewElement).openDevTools?.();
      this.addLog(type, "info", "DevTools açıldı");
    } catch (err) {
      const error = err as Error;
      LogManager.addEvent("webview-panel", "error", `DevTools açma hatası: ${error.message}`, { context: { type } });
      this.addLog(type, "error", `DevTools açma hatası: ${error.message}`);
    }
  }

  addLog(type: SlotType, level: LogLevel, message: string): void {
    LogManager.addEvent(`webview-panel-${type}`, level, message);
  }

  destroy(): void {
    if (this.trafficUnsub) {
      this.trafficUnsub();
      this.trafficUnsub = null;
    }
  }
}
