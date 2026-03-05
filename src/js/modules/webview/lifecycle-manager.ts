import { LogCategory } from "@shared/logging-core";
import { ASISTAN_TIMEOUTS } from "@timeouts";
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

import { Logger } from "../logger/index.js";
import { getErrorMessage } from "@shared/index.js";
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

  private _isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private _isSlotId(provider: string): provider is "ai0" | "ai1" | "ai2" {
    return provider === "ai0" || provider === "ai1" || provider === "ai2";
  }

  private _resolveSlotWebview(provider: "ai0" | "ai1" | "ai2"): Electron.WebviewTag | null {
    const slotWebview = SlotController.getWebview(provider);
    if (slotWebview !== null) {
      return slotWebview as Electron.WebviewTag;
    }

    if (typeof document === "undefined") {
      return null;
    }

    const fallbackId = `${provider}-webview`;
    const found = document.getElementById(fallbackId) as Electron.WebviewTag | null;
    if (found !== null) {
      SlotController.registerWebview(provider, found);
    }
    return found;
  }

  register(provider: string, webview: HTMLElement): void {
    if (provider === "") return;

    if (this._isSlotId(provider)) {
      SlotController.registerWebview(provider, webview);
      return;
    }

    this.webviews[provider] = webview as Electron.WebviewTag;
    this._lastActivity[provider] = Date.now();
  }

  get(provider: string): Electron.WebviewTag | null {
    if (this._isSlotId(provider)) {
      return this._resolveSlotWebview(provider);
    }

    return this.webviews[provider] ?? null;
  }

  resolve(provider: string): Electron.WebviewTag | null {
    if (this._isSlotId(provider)) {
      return this._resolveSlotWebview(provider);
    }

    if (this.webviews[provider]) return this.webviews[provider];

    if (typeof document === "undefined") {
      return null;
    }

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
  attach(
    provider: string,
    webview: Electron.WebviewTag,
    opts: { providerId?: string; onReady?: () => void; urgent?: boolean } = {}
  ): void {
    if (provider === "") return;

    if (this._isSlotId(provider)) {
      SlotController.registerWebview(provider, webview);
      SlotController.ensureWebviewMounted(provider);
      SlotController.ensureWebviewAttached(provider);
      SlotController.markActive(provider);
      return;
    }

    this.register(provider, webview);

    const { providerId, onReady } = opts;

    try {
      if (providerId === undefined || providerId === "") {
        Logger.warn(LogCategory.WEBVIEW, "attach: no provider configured for slot", { provider });
        return;
      }

      const cfg = ProviderRegistry.get(providerId);
      const defaultPage =
        this._isRecord(cfg) && typeof cfg["baseUrl"] === "string" ? cfg["baseUrl"] : "";

      const detachedAttr = webview.getAttribute("data-detached");
      if (detachedAttr !== null && detachedAttr !== "") {
        webview.removeAttribute("data-detached");
        webview.style.display = "";
      }

      const isActive = AppState.getState().activeProvider === provider;
      const isUrgent = opts.urgent ?? false;

      const loadWebview = (): void => {
        const currentSrc = webview.getAttribute("src") ?? "";
        let currentUrl = "";
        try {
          const fullUrl = webview.getURL();
          const parts = fullUrl.split("?");
          const beforeQuery = parts[0] ?? "";
          if (beforeQuery !== "") {
            const hashParts = beforeQuery.split("#");
            currentUrl = hashParts[0] ?? "";
          }
        } catch (_err) {
          const errorMessage = _err instanceof Error ? _err.message : String(_err);
          Logger.warn(LogCategory.WEBVIEW, "Failed to get webview URL", {
            provider,
            error: errorMessage,
          });
        }

        const targetParts = defaultPage.split("?");
        const targetBeforeQuery = targetParts[0] ?? "";
        const targetHashParts = targetBeforeQuery.split("#");
        const targetUrl = targetHashParts[0] ?? "";

        const hasCurrentSource = currentSrc !== "" || currentUrl !== "";
        const urlMismatch =
          currentUrl !== "" &&
          targetUrl !== "" &&
          !currentUrl.startsWith(targetUrl) &&
          !targetUrl.startsWith(currentUrl);
        const needsReload = !hasCurrentSource || urlMismatch;

        if (defaultPage !== "" && needsReload) {
          Logger.info(LogCategory.WEBVIEW, "attach: loading URL", { provider, url: defaultPage });
          webview.setAttribute("src", defaultPage);
        }

        this._setupWebviewLogger(webview, provider, providerId);
      };

      if (isActive || isUrgent) {
        loadWebview();
      } else {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(
            () => {
              loadWebview();
            },
            { timeout: 2000 }
          );
        } else {
          setTimeout(loadWebview, ASISTAN_TIMEOUTS.NAVIGATE_SETTLE);
        }
      }

      if (onReady && typeof onReady === "function") {
        const handleReady = (): void => {
          try {
            onReady();
            Logger.info(LogCategory.WEBVIEW, "attach: onReady callback executed after dom-ready", {
              provider,
            });
          } catch (err) {
            Logger.error(LogCategory.WEBVIEW, "attach: onReady callback error", {
              provider,
              error: getErrorMessage(err),
            });
          }
        };
        webview.addEventListener("dom-ready", handleReady, true);
      }

      Logger.info(LogCategory.WEBVIEW, "attach: webview attached", { provider });
    } catch (err) {
      Logger.error(LogCategory.WEBVIEW, "attach error", { provider, error: getErrorMessage(err) });
    }
  }

  detach(
    provider: string,
    {
      cleanupDom = true,
      skipTrafficStop = false,
    }: { cleanupDom?: boolean; skipTrafficStop?: boolean } = {}
  ): void {
    if (provider === "") return;

    if (this._isSlotId(provider)) {
      SlotController.parkWebview(provider, "lifecycle_manager_detach");
      return;
    }

    const webview = this.webviews[provider];

    try {
      if (!skipTrafficStop) {
        TrafficManager.stop(provider, { force: true });
        TrafficManager.detachWebview(provider);
      }

      ConversationSyncer.cancelListeners(provider);

      if (webview && cleanupDom) {
        webview.setAttribute("data-detached", "1");
        webview.style.display = "none";
        webview.removeAttribute("src");
      }
    } catch (_err) {
    } finally {
      delete this.webviews[provider];
      Logger.info(LogCategory.WEBVIEW, "webview detached", {
        provider,
        cleanup: !!cleanupDom,
        skipTrafficStop: !!skipTrafficStop,
      });
    }
  }

  destroy(provider: string): void {
    if (provider === "") return;

    if (this._isSlotId(provider)) {
      SlotController.parkWebview(provider, "lifecycle_manager_destroy");
      return;
    }

    const webview = this.webviews[provider];
    if (!webview) return;

    try {
      TrafficManager.detachWebview(provider);

      if (webview.parentNode) {
        webview.parentNode.removeChild(webview);
      }

      delete this.webviews[provider];
      delete this._lastActivity[provider];

      Logger.info(LogCategory.WEBVIEW, "Webview destroyed to free memory", { provider });
    } catch (err) {
      Logger.error(LogCategory.WEBVIEW, "Webview destroy failed", {
        provider,
        error: getErrorMessage(err),
      });
    }
  }

  markActive(provider: string): void {
    if (provider === "") return;

    if (this._isSlotId(provider)) {
      SlotController.markActive(provider);
      return;
    }

    this._lastActivity[provider] = Date.now();
  }

  cleanupInactive(): void {
    SlotController.cleanupInactiveWebviews(this._inactivityThreshold);

    const now = Date.now();
    const providers = Object.keys(this.webviews).filter((provider) => !this._isSlotId(provider));

    for (const provider of providers) {
      const lastActivity = this._lastActivity[provider] ?? 0;
      const inactive = now - lastActivity > this._inactivityThreshold;

      const isVisible = AppState.getState().activeProvider === provider;
      const isConnected = SlotController.isConnected(provider) === true;

      if (inactive && !isVisible && !isConnected) {
        Logger.info(LogCategory.WEBVIEW, "Detaching inactive webview", {
          provider,
          idleMinutes: Math.floor((now - lastActivity) / 60000),
        });
        this.detach(provider, { cleanupDom: true, skipTrafficStop: false });
      }
    }
  }

  _setupWebviewLogger(webview: Electron.WebviewTag, provider: string, providerId: string): void {
    try {
      const webContentsId = webview.getWebContentsId();
      if (window.electronAPI?.setupWebviewLogger) {
        window.electronAPI
          .setupWebviewLogger(webContentsId, provider, providerId)
          .then(() => {})
          .catch((err) => {
            Logger.warn(LogCategory.WEBVIEW, "Webview logger setup failed", {
              provider,
              providerId,
              error: getErrorMessage(err),
            });
          });
      }
    } catch (_err) {
      Logger.warn(LogCategory.WEBVIEW, "Failed to attach webview handlers", {
        provider,
        error: getErrorMessage(_err),
      });
    }
  }

  /**
   * Tüm kayıtlı webview'ları getir
   * @returns {Object}
   */
  getAll(): Record<string, Electron.WebviewTag> {
    const all: Record<string, Electron.WebviewTag> = { ...this.webviews };

    (["ai0", "ai1", "ai2"] as const).forEach((slot) => {
      const webview = this._resolveSlotWebview(slot);
      if (webview !== null) {
        all[slot] = webview;
      }
    });

    return all;
  }

  has(provider: string): boolean {
    if (this._isSlotId(provider)) {
      return this._resolveSlotWebview(provider) !== null;
    }

    return !!this.webviews[provider];
  }
}

const lifecycleManager = new LifecycleManagerClass();
export { lifecycleManager as LifecycleManager };
