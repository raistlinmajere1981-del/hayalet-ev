/**
 * UrlHandler - Slot URL işlemleri
 * 
 * Bu modül slot webview URL değişikliklerini yönetir:
 * - URL değişiklik takibi
 * - URL exclusion kontrolü
 * - Navigation event handling
 */

import { normalizeUrl, isUrlExcluded as checkUrlExcluded } from "../webview/methods/shared/url-utils.js";

/**
 * URL change handler'larını saklamak için map
 */
const urlChangeHandlers = {};

/**
 * URL'in excluded olup olmadığını kontrol et
 * @param {Object} slotState - Slot state objesi
 * @param {string} url - Kontrol edilecek URL
 * @returns {boolean}
 */
export function checkUrlExclusion(slotState, url) {
  const config = slotState.providerConfig;
  
  if (!config?.excludedUrls?.length || !url) return false;

  return checkUrlExcluded(url, config.excludedUrls);
}

/**
 * URL change handler'ı kur
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID
 * @param {string} _correlationId - İşlem correlation ID (kullanılmıyor ama tutarlılık için)
 * @param {Function} onUrlChange - URL değiştiğinde çağrılacak callback
 */
export function setupUrlChangeHandler(slotState, slot, _correlationId, onUrlChange) {
  // Önceki handler'ı temizle
  clearUrlChangeHandler(slot);

  const webview = slotState.webview;
  if (!webview) return;

  const handler = (event) => {
    const url = event?.url || "";
    if (url && url !== "about:blank" && !url.startsWith("data:")) {
      onUrlChange(slot, url);
    }
  };

  urlChangeHandlers[slot] = { handler, webview };

  webview.addEventListener("did-navigate", handler);
  webview.addEventListener("did-navigate-in-page", handler);
}

/**
 * URL change handler'ı temizle
 * @param {string} slot - Slot ID
 */
export function clearUrlChangeHandler(slot) {
  const handlers = urlChangeHandlers[slot];
  if (!handlers) return;

  const { handler, webview } = handlers;
  try {
    webview?.removeEventListener?.("did-navigate", handler);
    webview?.removeEventListener?.("did-navigate-in-page", handler);
  } catch (_e) {
    // Already removed
  }
  delete urlChangeHandlers[slot];
}

/**
 * URL değişikliğini işle
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID
 * @param {string} newUrl - Yeni URL
 * @param {string} connectedState - CONNECTED state değeri
 * @param {Function} logFn - Log fonksiyonu
 * @param {Function} emitFn - Event emit fonksiyonu
 * @param {Object} events - Event sabitleri { URL_CHANGED, URL_EXCLUDED, URL_INCLUDED }
 * @param {Function} startTrafficFn - Traffic başlatma fonksiyonu
 * @param {Function} stopTrafficFn - Traffic durdurma fonksiyonu
 */
export function handleUrlChange(
  slotState, 
  slot, 
  newUrl, 
  connectedState,
  logFn, 
  emitFn, 
  events,
  startTrafficFn,
  stopTrafficFn
) {
  if (slotState.state !== connectedState) return;

  const normalizedNew = normalizeUrl(newUrl);
  const normalizedOld = normalizeUrl(slotState.currentUrl);

  if (normalizedNew === normalizedOld) return;

  logFn(slot, "info", `URL changed: ${normalizedOld} → ${normalizedNew}`);
  emitFn(slot, events.URL_CHANGED, { oldUrl: slotState.currentUrl, newUrl });

  slotState.currentUrl = newUrl;
  const isExcluded = checkUrlExclusion(slotState, newUrl);
  const wasExcluded = slotState.urlExcluded;

  if (isExcluded !== wasExcluded) {
    slotState.urlExcluded = isExcluded;

    if (isExcluded && slotState.trafficStarted) {
      logFn(slot, "info", `URL now excluded: ${newUrl} - stopping traffic`);
      emitFn(slot, events.URL_EXCLUDED, { url: newUrl });
      stopTrafficFn(slot, slotState.correlationId);
    } else if (!isExcluded && !slotState.trafficStarted) {
      logFn(slot, "info", `URL no longer excluded: ${newUrl} - starting traffic`);
      emitFn(slot, events.URL_INCLUDED, { url: newUrl });
      startTrafficFn(slot, slotState.correlationId);
    }
  }
}

/**
 * Webview'ı belirtilen URL'e navigate et
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID
 * @param {string|null} url - Hedef URL (null ise provider baseUrl kullanılır)
 * @param {string} connectedState - CONNECTED state değeri
 * @param {Function} logFn - Log fonksiyonu
 * @param {Function} emitFn - Event emit fonksiyonu
 * @param {string} navigatedEvent - WEBVIEW_NAVIGATED event adı
 */
export function navigate(slotState, slot, url, connectedState, logFn, emitFn, navigatedEvent) {
  if (slotState.state !== connectedState) {
    logFn(slot, "warning", "Cannot navigate: not connected");
    return;
  }

  const webview = slotState.webview;
  if (!webview) return;

  // URL belirtilmemişse default URL kullan
  let targetUrl = url;
  if (!targetUrl) {
    targetUrl = slotState.providerConfig?.baseUrl;
  }

  if (!targetUrl) {
    logFn(slot, "warning", "No URL for navigation");
    return;
  }

  // Mevcut URL ile aynıysa skip
  let currentUrl = "";
  try {
    currentUrl = webview.getURL?.() || webview.getAttribute?.("src") || "";
  } catch (_e) {
    // Webview not ready
  }
  
  if (normalizeUrl(currentUrl) === normalizeUrl(targetUrl)) {
    return;
  }

  logFn(slot, "info", `Navigating to ${targetUrl}`);

  try {
    if (typeof webview.loadURL === "function") {
      webview.loadURL(targetUrl).catch((err) => {
        logFn(slot, "warning", `Navigation warning: ${err.message}`);
      });
    } else {
      webview.src = targetUrl;
    }
    emitFn(slot, navigatedEvent, { url: targetUrl });
  } catch (err) {
    logFn(slot, "error", `Navigation error: ${err.message}`);
  }
}
