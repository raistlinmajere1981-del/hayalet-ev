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
import { TrafficManager } from "../traffic-manager.js";
import { AppState } from "../app-state.js";
import { SlotController } from "../slot-controller.js";
import { ProviderRegistry } from "./provider-registry.js";

import { ConversationSyncer } from "./conversation-syncer.js";

class LifecycleManagerClass {
  webviews: Record<string, any>;
  _lastActivity: Record<string, number>;
  _inactivityThreshold: number;

  constructor() {
    this.webviews = {};
    this._lastActivity = {};
    this._inactivityThreshold = 30 * 60 * 1000;
  }

  /**
   * Webview'ı kaydet
   * @param {string} provider - Slot ID (ai1/ai2)
   * @param {HTMLElement} webview - Webview elementi
   */
  register(provider, webview) {
    if (!provider || !webview) return;
    this.webviews[provider] = webview;
    this._lastActivity[provider] = Date.now();
  }

  /**
   * Kayıtlı webview'ı getir
   * @param {string} provider - Slot ID
   * @returns {HTMLElement|null}
   */
  get(provider) {
    return this.webviews[provider] || null;
  }

  /**
   * Webview'ı çöz - önce cache'den, yoksa DOM'dan
   * @param {string} provider - Slot ID
   * @returns {HTMLElement|null}
   */
  resolve(provider) {
    if (this.webviews[provider]) return this.webviews[provider];

    // Dinamik ID arama: önce provider-webview dene
    const fallbackId = `${provider}-webview`;
    const found = document.getElementById(fallbackId);
    if (found) {
      this.webviews[provider] = found;
    }
    return found;
  }

  /**
   * Webview'ı slot'a bağla
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi
   * @param {Object} opts - { providerId, onReady }
   */
  attach(provider: string, webview: any, opts: { providerId?: string; onReady?: () => void; urgent?: boolean } = {}) {
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

      const cfg = ProviderRegistry.get(providerId);
      const defaultPage = cfg?.baseUrl || "";

      if (webview.getAttribute?.("data-detached")) {
        webview.removeAttribute("data-detached");
        if (webview.style) webview.style.display = "";
      }

      // Lazy Loading Optimizasyonu
      const isActive = AppState.getState()?.provider === provider;
      const isUrgent = opts.urgent || false;

      const loadWebview = () => {
        const currentSrc = webview.getAttribute("src") || "";
        let currentUrl = "";
        try {
          currentUrl = (webview.getURL?.() || "").split("?")[0].split("#")[0];
        } catch (_err) {}

        const targetUrl = defaultPage.split("?")[0].split("#")[0];

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
              `attach: onReady callback error: ${err?.message || err}`
            );
          }
        };
        webview.addEventListener("dom-ready", handleReady, { once: true });
      }

      LogManager.addEvent(`webview-${provider}`, "info", "attach: webview attached");
    } catch (err) {
      LogManager.addEvent(`webview-${provider}`, "error", `attach error: ${err?.message || err}`);
    }
  }

  /**
   * Webview'ı slot'tan ayır
   * @param {string} provider - Slot ID
   * @param {Object} opts - { cleanupDom, skipTrafficStop }
   */
  detach(provider, { cleanupDom = true, skipTrafficStop = false } = {}) {
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

  /**
   * Webview'ı tamamen yok et (bellek temizliği)
   * @param {string} provider - Slot ID
   */
  destroy(provider) {
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

      LogManager.addEvent(`webview-${provider}`, "info", "Webview destroyed to free memory");
    } catch (err) {
      LogManager.addEvent(
        `webview-${provider}`,
        "error",
        `Webview destroy failed: ${err?.message || err}`
      );
    }
  }

  /**
   * Webview'ı aktif olarak işaretle
   * @param {string} provider - Slot ID
   */
  markActive(provider) {
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

      const isVisible = AppState.getState()?.provider === provider;
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

  /**
   * Webview logger kurulumu (internal)
   * @private
   */
  _setupWebviewLogger(webview, provider, providerId) {
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

  /**
   * Belirli bir provider kayıtlı mı?
   * @param {string} provider - Slot ID
   * @returns {boolean}
   */
  has(provider) {
    return !!this.webviews[provider];
  }
}

export const LifecycleManager = new LifecycleManagerClass();
