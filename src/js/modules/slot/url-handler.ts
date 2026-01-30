/**
 * UrlHandler - Slot URL işlemleri
 * 
 * Bu modül slot webview URL değişikliklerini yönetir:
 * - URL değişiklik takibi
 * - URL exclusion kontrolü
 * - Navigation event handling
 */

import { normalizeUrl, isUrlExcluded as checkUrlExcluded } from "../webview/methods/shared/url-utils.js";
import type { SlotId, LogLevel } from "../../types/index.js";
import type { BaseProviderConfig } from "../../types/provider.js";

// ============================================================================
// Types
// ============================================================================

/** Webview element tipi */
type WebviewElement = HTMLElement & {
  getURL?: () => string;
  loadURL?: (url: string) => Promise<void>;
  isLoading?: () => boolean;
  src: string;
  addEventListener: (type: string, listener: EventListener, options?: AddEventListenerOptions) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
};

/** Slot state - url-handler için gerekli alanlar */
interface UrlHandlerSlotState {
  webview: WebviewElement | null;
  providerConfig: BaseProviderConfig | null;
  state: string;
  currentUrl: string;
  urlExcluded: boolean;
  trafficStarted: boolean;
  correlationId: string;
}

/** URL change handler bilgisi */
interface UrlChangeHandlerInfo {
  handler: (event: { url?: string }) => void;
  webview: WebviewElement;
}

/** URL change event sabitleri */
interface UrlEvents {
  URL_CHANGED: string;
  URL_EXCLUDED: string;
  URL_INCLUDED: string;
}

/** Log fonksiyonu tipi */
type LogFn = (slot: SlotId, level: LogLevel, message: string) => void;

/** Event emit fonksiyonu tipi */
type EmitFn = (slot: SlotId, event: string, data: Record<string, unknown>) => void;

/** Traffic kontrol fonksiyonu tipi */
type TrafficFn = (slot: SlotId, correlationId: string) => void;

/** URL change callback tipi */
type UrlChangeCallback = (slot: SlotId, url: string) => void;

// ============================================================================
// State
// ============================================================================

/**
 * URL change handler'larını saklamak için map
 */
const urlChangeHandlers: Record<string, UrlChangeHandlerInfo> = {};

// ============================================================================
// Functions
// ============================================================================

/**
 * URL'in excluded olup olmadığını kontrol et
 */
export function checkUrlExclusion(slotState: UrlHandlerSlotState, url: string): boolean {
  const config = slotState.providerConfig;
  
  if (!config?.excludedUrls?.length || !url) return false;

  return checkUrlExcluded(url, config.excludedUrls);
}

/**
 * URL change handler'ı kur
 */
export function setupUrlChangeHandler(
  slotState: UrlHandlerSlotState,
  slot: SlotId,
  _correlationId: string,
  onUrlChange: UrlChangeCallback
): void {
  clearUrlChangeHandler(slot);

  const webview = slotState.webview;
  if (!webview) return;

  const handler = (event: { url?: string }): void => {
    const url = event?.url || "";
    if (url && url !== "about:blank" && !url.startsWith("data:")) {
      onUrlChange(slot, url);
    }
  };

  urlChangeHandlers[slot] = { handler, webview };

  webview.addEventListener("did-navigate", handler as EventListener);
  webview.addEventListener("did-navigate-in-page", handler as EventListener);
}

/**
 * URL change handler'ı temizle
 */
export function clearUrlChangeHandler(slot: SlotId): void {
  const handlers = urlChangeHandlers[slot];
  if (!handlers) return;

  const { handler, webview } = handlers;
  try {
    webview?.removeEventListener?.("did-navigate", handler as EventListener);
    webview?.removeEventListener?.("did-navigate-in-page", handler as EventListener);
  } catch (_e) {
    // Ignore cleanup errors
  }
  delete urlChangeHandlers[slot];
}

/**
 * URL değişikliğini işle
 */
export function handleUrlChange(
  slotState: UrlHandlerSlotState, 
  slot: SlotId, 
  newUrl: string, 
  connectedState: string,
  logFn: LogFn, 
  emitFn: EmitFn, 
  events: UrlEvents,
  startTrafficFn: TrafficFn,
  stopTrafficFn: TrafficFn
): void {
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
 */
export function navigate(
  slotState: UrlHandlerSlotState,
  slot: SlotId,
  url: string | null,
  connectedState: string,
  logFn: LogFn,
  emitFn: EmitFn,
  navigatedEvent: string
): void {
  if (slotState.state !== connectedState) {
    logFn(slot, "warning", "Cannot navigate: not connected");
    return;
  }

  const webview = slotState.webview;
  if (!webview) return;

  let targetUrl: string | undefined = url ?? undefined;
  if (!targetUrl) {
    targetUrl = slotState.providerConfig?.baseUrl;
  }

  if (!targetUrl) {
    logFn(slot, "warning", "No URL for navigation");
    return;
  }

  let currentUrl = "";
  try {
    currentUrl = webview.getURL?.() || webview.getAttribute?.("src") || "";
  } catch (_e) {
    // Ignore errors
  }
  
  if (normalizeUrl(currentUrl) === normalizeUrl(targetUrl)) {
    return;
  }

  logFn(slot, "info", `Navigating to ${targetUrl}`);

  try {
    if (typeof webview.loadURL === "function") {
      webview.loadURL(targetUrl).catch((err: Error) => {
        logFn(slot, "warning", `Navigation warning: ${err.message}`);
      });
    } else {
      webview.src = targetUrl;
    }
    emitFn(slot, navigatedEvent, { url: targetUrl });
  } catch (err) {
    const error = err as Error;
    logFn(slot, "error", `Navigation error: ${error.message}`);
  }
}
