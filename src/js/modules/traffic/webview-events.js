/**
 * WebviewEvents - Traffic webview event yönetimi
 * 
 * Bu modül webview navigation eventlerini yönetir:
 * - Event listener attachment/detachment
 * - Navigation event handling
 * - DOM ready handling
 */

import { LogManager } from "../log-manager.js";

/**
 * Webview handler'larını saklamak için map
 */
const webviewHandlers = {};

/**
 * URL'i normalize et (query string ve hash'i kaldır)
 * @param {string} href - URL
 * @returns {string}
 */
export function normalizeHref(href) {
  if (!href) return "";
  const clean = href.split("?")[0].split("#")[0];
  return clean;
}

/**
 * Webview'a event listener'ları ekle
 * @param {string} provider - Slot ID
 * @param {HTMLElement} webviewEl - Webview elementi
 * @param {Object} callbacks - { onNavigation, onDomReady, onFailLoad, buildProbeScript }
 */
export function attachWebviewEvents(provider, webviewEl, callbacks) {
  if (!provider || !webviewEl) return;

  if (webviewHandlers[provider]) {
    return;
  }

  const { onNavigation, onDomReady, onFailLoad, buildProbeScript } = callbacks;

  const ensureBridge = () => {
    // FIX: Webview'ın hazır olduğunu doğrula
    try {
      if (typeof webviewEl.getWebContentsId !== "function") return;
      webviewEl.getWebContentsId(); // Hazır değilse hata fırlatır
      if (webviewEl.isLoading?.()) return; // Yükleme devam ediyorsa bekle
    } catch (_) {
      return; // Webview henüz hazır değil
    }
    
    const script = buildProbeScript(provider);
    webviewEl.executeJavaScript(script).catch(() => {
    });
  };

  const handleNavEvent = (url, _eventType) => {
    let href = "";
    if (url) {
      href = normalizeHref(url);
    } else {
      try {
        href = normalizeHref(webviewEl.getURL?.());
      } catch (_err) {
        href = "";
      }
    }
    if (!href) return;

    if (href === "about:blank" || href.startsWith("data:")) {
      return;
    }

    onNavigation(provider, href);
  };

  const domReadyHandler = () => {
    ensureBridge();
    try {
      handleNavEvent(webviewEl.getURL?.(), "dom-ready");
    } catch (_e) {
    }
    onDomReady?.(provider);
  };

  const failLoadHandler = () => {
    onFailLoad(provider);
  };

  const listeners = {
    didStartLoading: (e) => handleNavEvent(e?.url, "did-start-loading"),
    didStartNavigation: (e) => handleNavEvent(e?.url, "did-start-navigation"),
    willNavigate: (e) => handleNavEvent(e?.url, "will-navigate"),
    didNavigate: (e) => handleNavEvent(e?.url, "did-navigate"),
    didNavigateInPage: (e) => handleNavEvent(e?.url, "did-navigate-in-page"),
    domReady: domReadyHandler,
    failLoad: failLoadHandler,
  };

  webviewHandlers[provider] = {
    handleNavEvent,
    domReadyHandler,
    failLoadHandler,
    listeners,
    webviewEl,
  };

  webviewEl.addEventListener("did-start-loading", listeners.didStartLoading);
  webviewEl.addEventListener("did-start-navigation", listeners.didStartNavigation);
  webviewEl.addEventListener("will-navigate", listeners.willNavigate);
  webviewEl.addEventListener("did-navigate", listeners.didNavigate);
  webviewEl.addEventListener("did-navigate-in-page", listeners.didNavigateInPage);
  webviewEl.addEventListener("dom-ready", listeners.domReady);
  webviewEl.addEventListener("did-fail-load", listeners.failLoad);

  LogManager.addEvent("traffic", "info", `Event listeners attached for ${provider}`);
}

/**
 * Webview'dan event listener'ları kaldır
 * @param {string} provider - Slot ID
 */
export function detachWebviewEvents(provider) {
  if (!provider) return;

  const handlers = webviewHandlers[provider];
  if (!handlers) return;

  const webviewEl = handlers.webviewEl;
  const l = handlers.listeners || {};

  try {
    try { webviewEl.removeEventListener("did-start-loading", l.didStartLoading); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("did-start-navigation", l.didStartNavigation); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("will-navigate", l.willNavigate); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("did-navigate", l.didNavigate); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("did-navigate-in-page", l.didNavigateInPage); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("dom-ready", l.domReady); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("did-fail-load", l.failLoad); } catch (_) { void 0; }
  } catch (_err) {
  }

  delete webviewHandlers[provider];
  LogManager.addEvent("traffic", "info", `Event listeners detached for ${provider}`);
}

/**
 * Provider için handler kayıtlı mı?
 * @param {string} provider - Slot ID
 * @returns {boolean}
 */
export function hasHandlers(provider) {
  return !!webviewHandlers[provider];
}
