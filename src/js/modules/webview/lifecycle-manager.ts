/**
 * LifecycleManager - Webview yaşam döngüsü yönetimi
 *
 * Bu modül webview'ların kayıt, bağlama, ayırma ve bellek yönetimini sağlar:
 * - register: Webview'ı kaydet
 * - attach: Webview'ı slot'a bağla
 * - detach: Webview'ı slot'tan ayır
 * - destroy: Webview'ı tamamen kaldır
 * - cleanupInactive: İnaktif webview'ları temizle
 */

import { LogManager } from "../log-manager.js";
import { getErrorMessage } from "../../types/index.js";
import { TrafficManager } from "../traffic-manager.js";
import { AppState } from "../app-state.js";
import { SlotController } from "../slot-controller.js";
import { ProviderRegistry } from "./provider-registry.js";

import { ConversationSyncer } from "./conversation-syncer.js";

class LifecycleManagerClass {
  webviews: Record<string, Electron.WebviewTag>;
  _lastActivity: Record<string, number>;
  _inactivityThreshold: number;

  constructor() {
    this.webviews = {};
    this._lastActivity = {};
    this._inactivityThreshold = 30 * 60 * 1000;
  }

  register(provider: string, webview: HTMLElement) {
    if (!provider || !webview) return;
    this.webviews[provider] = webview;
    this._lastActivity[provider] = Date.now();
  }

  get(provider: string): Electron.WebviewTag | null {
    return this.webviews[provider] || null;
  }

  resolve(provider: string): Electron.WebviewTag | null {
    if (this.webviews[provider]) return this.webviews[provider];

    // Dinamik ID arama: önce provider-webview dene
    const fallbackId = `${provider}-webview`;
    const found = document.getElementById(fallbackId);
    if (found) {
      this.webviews[provider] = found as Electron.WebviewTag;
    }
    return found as Electron.WebviewTag | null;
  }

  /**
   * Webview'ı slot'a bağla
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi
   * @param {Object} opts - { providerId, onReady }
   */
  attach(provider: string, webview: Electron.WebviewTag, opts: { providerId?: string; onReady?: () => void; urgent?: boolean } = {}) {
    if (!provider || !webview) return;

    this.register(provider, webview);

    const { providerId, onReady } = opts;

    try {
      if (!providerId) {
        LogManager.addEvent(
          `webview-${provider}`,
          "warning",
          "attach: no provider configured for slot"
        );
        return;
      }

      const cfg = ProviderRegistry.get(providerId as "opencode" | "chatgpt" | "grok" | "gemini");
      const defaultPage = cfg?.baseUrl || "";

      if (webview.getAttribute?.("data-detached")) {
        webview.removeAttribute("data-detached");
        if (webview.style) webview.style.display = "";
      }

      // Lazy Loading Optimizasyonu
      const isActive = AppState.getState()?.activeProvider === provider;
      const isUrgent = opts.urgent || false;

      const loadWebview = () => {
        const currentSrc = webview.getAttribute("src") || "";
        let currentUrl = "";
        try {
          const fullUrl = webview.getURL?.() || "";
          const parts = fullUrl.split("?");
          const beforeQuery = parts[0];
          if (beforeQuery) {
            const hashParts = beforeQuery.split("#");
            currentUrl = hashParts[0] || "";
          }
        } catch (_err) {}

        const targetParts = defaultPage.split("?");
        const targetBeforeQuery = targetParts[0] || "";
        const targetHashParts = targetBeforeQuery.split("#");
        const targetUrl = targetHashParts[0] || "";

        const needsReload =
          (!currentSrc && !currentUrl) ||
          (currentUrl &&
            targetUrl &&
            !currentUrl.startsWith(targetUrl) &&
            !targetUrl.startsWith(currentUrl));

        if (defaultPage && needsReload) {
          LogManager.addEvent(`webview-${provider}`, "info", `attach: loading URL ${defaultPage}`);
          webview.setAttribute("src", defaultPage);
        } else if (currentUrl) {
          LogManager.addEvent(
            `webview-${provider}`,
            "debug",
            `attach: webview already loaded (${currentUrl}), skipping reload`
          );
        }

        this._setupWebviewLogger(webview, provider, providerId);
      };

      if (isActive || isUrgent) {
        loadWebview();
      } else {
        // Aktif değilse idle zamanında yükle
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => loadWebview(), { timeout: 2000 });
        } else {
          setTimeout(loadWebview, 100);
        }
      }

      if (onReady && typeof onReady === "function") {
        const handleReady = () => {
          try {
            onReady();
            LogManager.addEvent(
              `webview-${provider}`,
              "info",
              "attach: onReady callback executed after dom-ready"
            );
          } catch (err) {
            LogManager.addEvent(
              `webview-${provider}`,
              "error",
              `attach: onReady callback error: ${getErrorMessage(err)}`
            );
          }
        };
        webview.addEventListener("dom-ready", handleReady as EventListener, { once: true });
      }

      LogManager.addEvent(`webview-${provider}`, "info", "attach: webview attached", { visibility: 2 });
    } catch (err) {
      LogManager.addEvent(`webview-${provider}`, "error", `attach error: ${getErrorMessage(err)}`);
    }
  }

  detach(provider: string, { cleanupDom = true, skipTrafficStop = false } = {}) {
    if (!provider) return;

    const webview = this.webviews[provider];

    try {
      if (!skipTrafficStop) {
        TrafficManager.stop(provider, { force: true });
        TrafficManager.detachWebview(provider);
      }

      // Listener temizliği (Memory Leak önlemi)
      ConversationSyncer.cancelListeners(provider);

      if (webview && cleanupDom) {
        webview.setAttribute("data-detached", "1");
        if (webview.style) webview.style.display = "none";
        webview.removeAttribute("src");
      }
    } catch (_err) {
    } finally {
      delete this.webviews[provider];
      LogManager.addEvent(
        `webview-${provider}`,
        "info",
        `detached (cleanup=${!!cleanupDom}, skipTrafficStop=${!!skipTrafficStop})`
      );
    }
  }

  destroy(provider: string) {
    if (!provider) return;

    const webview = this.webviews[provider];
    if (!webview) return;

    try {
      TrafficManager.detachWebview(provider);

      if (webview.parentNode) {
        webview.parentNode.removeChild(webview);
      }

      delete this.webviews[provider];
      delete this._lastActivity[provider];

      LogManager.addEvent(`webview-${provider}`, "info", "Webview destroyed to free memory", { visibility: 2 });
    } catch (err) {
      LogManager.addEvent(
        `webview-${provider}`,
        "error",
        `Webview destroy failed: ${getErrorMessage(err)}`
      );
    }
  }

  markActive(provider: string) {
    if (!provider) return;
    this._lastActivity[provider] = Date.now();
  }

  /**
   * İnaktif webview'ları temizle
   */
  cleanupInactive() {
    const now = Date.now();
    const providers = Object.keys(this.webviews);

    for (const provider of providers) {
      const lastActivity = this._lastActivity[provider] || 0;
      const inactive = now - lastActivity > this._inactivityThreshold;

      const isVisible = AppState.getState()?.activeProvider === provider;
      const isConnected = SlotController.isConnected(provider);

      if (inactive && !isVisible && !isConnected) {
        LogManager.addEvent(
          `webview-${provider}`,
          "info",
          `Detaching inactive webview (${Math.floor((now - lastActivity) / 60000)}min idle)`
        );
        this.detach(provider, { cleanupDom: true, skipTrafficStop: false });
      }
    }
  }

  _setupWebviewLogger(webview: Electron.WebviewTag, provider: string, providerId: string) {
    try {
      const webContentsId = webview.getWebContentsId?.();
      if (webContentsId && window.electronAPI?.setupWebviewLogger) {
        window.electronAPI
          .setupWebviewLogger(webContentsId, provider, providerId)
          .then((result) => {
            if (result?.success) {
              LogManager.addEvent(
                `webview-${provider}`,
                "debug",
                `Webview logger kuruldu (${providerId})`
              );
            }
          })
          .catch(() => {});
      }
    } catch (_err) {}
  }

  /**
   * Tüm kayıtlı webview'ları getir
   * @returns {Object}
   */
  getAll() {
    return { ...this.webviews };
  }

  has(provider: string): boolean {
    return !!this.webviews[provider];
  }
}

export const LifecycleManager = new LifecycleManagerClass();
