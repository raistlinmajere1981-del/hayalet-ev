/**
 * WebviewHandler - Slot webview işlemleri
 * 
 * Bu modül slot'a bağlı webview'ların yaşam döngüsünü yönetir:
 * - attach: Webview'ı slot'a bağla ve src ayarla
 * - detach: Webview'ı slot'tan ayır
 * - waitForDomReady: DOM hazır olana kadar bekle
 */

import { TIMEOUTS } from "../../constants/index.js";

/**
 * Webview'ı slot'a bağla
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID (ai1/ai2)
 * @param {string} correlationId - İşlem correlation ID
 * @param {Function} logFn - Log fonksiyonu
 * @param {Function} emitFn - Event emit fonksiyonu
 * @param {string} eventAttached - WEBVIEW_ATTACHED event adı
 */
export async function attachWebview(slotState, slot, correlationId, logFn, emitFn, eventAttached) {
  const webview = slotState.webview;
  
  if (!webview) {
    throw new Error("Webview not available");
  }

  if (webview.getAttribute?.("data-detached")) {
    webview.removeAttribute("data-detached");
  }
  webview.style.display = "";

  const currentSrc = webview.getAttribute("src") || "";
  let currentUrl = "";
  try {
    currentUrl = (webview.getURL?.() || "").split("?")[0].split("#")[0];
  } catch (_e) {
  }

  const targetUrl = slotState.providerConfig?.baseUrl || "";
  const normalizedTarget = targetUrl.split("?")[0].split("#")[0];

  const needsReload = (!currentSrc && !currentUrl) ||
                      (currentUrl && normalizedTarget && 
                       !currentUrl.startsWith(normalizedTarget) && 
                       !normalizedTarget.startsWith(currentUrl));

  slotState._pendingLoad = false;

  if (targetUrl && needsReload) {
    logFn(slot, "info", `Loading URL: ${targetUrl}`, { correlationId });
    slotState._pendingLoad = true;
    webview.setAttribute("src", targetUrl);
  } else if (currentUrl) {
    logFn(slot, "debug", `Webview already loaded: ${currentUrl}`, { correlationId });
  }

  slotState.lastActivity = Date.now();
  emitFn(slot, eventAttached, { correlationId });
  logFn(slot, "debug", "Webview attached", { correlationId });
}

/**
 * Webview'ı slot'tan ayır
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID
 * @param {string} correlationId - İşlem correlation ID
 * @param {Function} logFn - Log fonksiyonu
 * @param {Function} emitFn - Event emit fonksiyonu
 * @param {string} eventDetached - WEBVIEW_DETACHED event adı
 */
export async function detachWebview(slotState, slot, correlationId, logFn, emitFn, eventDetached) {
  const webview = slotState.webview;

  if (!webview) return;

  try {
    webview.setAttribute("data-detached", "1");
    webview.style.display = "none";
    webview.removeAttribute("src");
    
    emitFn(slot, eventDetached, { correlationId });
    logFn(slot, "debug", "Webview detached", { correlationId });
  } catch (err) {
    logFn(slot, "warning", `Webview detach warning: ${err.message}`, { correlationId });
  }
}

/**
 * DOM ready handler'larını saklamak için map
 */
const domReadyHandlers = {};

/**
 * DOM ready olana kadar bekle
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID
 * @param {string} correlationId - İşlem correlation ID
 * @param {Function} logFn - Log fonksiyonu
 * @returns {Promise<void>}
 */
export function waitForDomReady(slotState, slot, correlationId, logFn) {
  const webview = slotState.webview;

  if (!webview) {
    return Promise.reject(new Error("Webview not available"));
  }

  return new Promise((resolve, reject) => {
    if (!slotState._pendingLoad) {
      try {
        if (webview.getURL?.() && !webview.isLoading?.()) {
          logFn(slot, "debug", "Webview already loaded", { correlationId });
          resolve();
          return;
        }
      } catch (_e) {
      }
    }

    slotState._pendingLoad = false;

    const timeoutId = setTimeout(() => {
      clearDomReadyHandler(slot);
      reject(new Error("DOM ready timeout"));
    }, TIMEOUTS.DOM_READY);

    const handler = () => {
      clearTimeout(timeoutId);
      clearDomReadyHandler(slot);
      logFn(slot, "debug", "DOM ready event received", { correlationId });
      resolve();
    };

    const errorHandler = (event) => {
      clearTimeout(timeoutId);
      clearDomReadyHandler(slot);
      if (event?.errorCode !== -3 && event?.errorCode !== -102) {
        reject(new Error(`Load failed: ${event?.errorDescription || "unknown"}`));
      } else {
        resolve();
      }
    };

    domReadyHandlers[slot] = { handler, errorHandler, webview, timeoutId };

    webview.addEventListener("dom-ready", handler, { once: true });
    webview.addEventListener("did-fail-load", errorHandler, { once: true });
  });
}

/**
 * DOM ready handler'ı temizle
 * @param {string} slot - Slot ID
 */
export function clearDomReadyHandler(slot) {
  const handlers = domReadyHandlers[slot];
  if (!handlers) return;

  const { handler, errorHandler, webview, timeoutId } = handlers;
  try {
    if (timeoutId) clearTimeout(timeoutId);
    webview?.removeEventListener?.("dom-ready", handler);
    webview?.removeEventListener?.("did-fail-load", errorHandler);
  } catch (_e) {
  }
  delete domReadyHandlers[slot];
}

/**
 * Webview'ın mevcut URL'ini al
 * @param {Object} slotState - Slot state objesi
 * @returns {string}
 */
export function getCurrentUrl(slotState) {
  const webview = slotState?.webview;
  if (!webview) return "";
  try {
    return webview.getURL?.() || webview.getAttribute?.("src") || "";
  } catch (_e) {
    return "";
  }
}
