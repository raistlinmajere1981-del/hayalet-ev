/**
 * WebviewEvents - Traffic webview event yönetimi
 * 
 * Bu modül webview navigation eventlerini yönetir:
 * - Event listener attachment/detachment
 * - Navigation event handling
 * - DOM ready handling
 */

// ============================================================================
// Types
// ============================================================================

interface WebviewElement {
  getWebContentsId?: () => number;
  getURL?: () => string;
  isLoading?: () => boolean;
  executeJavaScript: (script: string) => Promise<unknown>;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

interface NavigationEvent {
  url?: string;
}

interface WebviewCallbacks {
  onNavigation: (provider: string, href: string) => void;
  onDomReady?: (provider: string) => void;
  onFailLoad: (provider: string) => void;
  buildProbeScript: (provider: string) => string;
}

interface WebviewListeners {
  didStartLoading: (e: NavigationEvent) => void;
  didStartNavigation: (e: NavigationEvent) => void;
  willNavigate: (e: NavigationEvent) => void;
  didNavigate: (e: NavigationEvent) => void;
  didNavigateInPage: (e: NavigationEvent) => void;
  domReady: () => void;
  failLoad: () => void;
}

interface WebviewHandler {
  handleNavEvent: (url: string | undefined, eventType: string) => void;
  domReadyHandler: () => void;
  failLoadHandler: () => void;
  listeners: WebviewListeners;
  webviewEl: WebviewElement;
}

// ============================================================================
// State
// ============================================================================

/**
 * Webview handler'larını saklamak için map
 */
const webviewHandlers: Record<string, WebviewHandler> = {};

// ============================================================================
// Functions
// ============================================================================

/**
 * URL'i normalize et (query string ve hash'i kaldır)
 */
export function normalizeHref(href: string | undefined): string {
  if (!href) return "";
  const clean = href.split("?")[0].split("#")[0];
  return clean;
}

/**
 * Webview'a event listener'ları ekle
 */
export function attachWebviewEvents(
  provider: string,
  webviewEl: WebviewElement,
  callbacks: WebviewCallbacks
): void {
  if (!provider || !webviewEl) return;

  if (webviewHandlers[provider]) {
    return;
  }

  const { onNavigation, onDomReady, onFailLoad, buildProbeScript } = callbacks;

  const ensureBridge = (): void => {
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
      // Ignore
    });
  };

  const handleNavEvent = (url: string | undefined, _eventType: string): void => {
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

  const domReadyHandler = (): void => {
    ensureBridge();
    try {
      handleNavEvent(webviewEl.getURL?.(), "dom-ready");
    } catch (_e) {
      // Ignore
    }
    onDomReady?.(provider);
  };

  const failLoadHandler = (): void => {
    onFailLoad(provider);
  };

  const listeners: WebviewListeners = {
    didStartLoading: (e: NavigationEvent) => handleNavEvent(e?.url, "did-start-loading"),
    didStartNavigation: (e: NavigationEvent) => handleNavEvent(e?.url, "did-start-navigation"),
    willNavigate: (e: NavigationEvent) => handleNavEvent(e?.url, "will-navigate"),
    didNavigate: (e: NavigationEvent) => handleNavEvent(e?.url, "did-navigate"),
    didNavigateInPage: (e: NavigationEvent) => handleNavEvent(e?.url, "did-navigate-in-page"),
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

  webviewEl.addEventListener("did-start-loading", listeners.didStartLoading as EventListener);
  webviewEl.addEventListener("did-start-navigation", listeners.didStartNavigation as EventListener);
  webviewEl.addEventListener("will-navigate", listeners.willNavigate as EventListener);
  webviewEl.addEventListener("did-navigate", listeners.didNavigate as EventListener);
  webviewEl.addEventListener("did-navigate-in-page", listeners.didNavigateInPage as EventListener);
  webviewEl.addEventListener("dom-ready", listeners.domReady as EventListener);
  webviewEl.addEventListener("did-fail-load", listeners.failLoad as EventListener);

}

/**
 * Webview'dan event listener'ları kaldır
 */
export function detachWebviewEvents(provider: string): void {
  if (!provider) return;

  const handlers = webviewHandlers[provider];
  if (!handlers) return;

  const webviewEl = handlers.webviewEl;
  const l = handlers.listeners || {};

  try {
    try { webviewEl.removeEventListener("did-start-loading", l.didStartLoading as EventListener); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("did-start-navigation", l.didStartNavigation as EventListener); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("will-navigate", l.willNavigate as EventListener); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("did-navigate", l.didNavigate as EventListener); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("did-navigate-in-page", l.didNavigateInPage as EventListener); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("dom-ready", l.domReady as EventListener); } catch (_) { void 0; }
    try { webviewEl.removeEventListener("did-fail-load", l.failLoad as EventListener); } catch (_) { void 0; }
  } catch (_err) {
    // Ignore
  }

  delete webviewHandlers[provider];
}

/**
 * Provider için handler kayıtlı mı?
 */
export function hasHandlers(provider: string): boolean {
  return !!webviewHandlers[provider];
}
