/**
 * WebviewHandler - Slot webview operations
 *
 * This module manages the lifecycle of slot-bound webviews:
 * - attach: attach the webview to the slot and set src
 * - detach: detach the webview from the slot
 * - waitForDomReady: wait until the DOM is ready
 */

import { TIMEOUTS } from "@timeouts";
import type { SlotId } from "@shared/index.js";
import { LogLevel } from "@shared/index.js";
import type { BaseProviderConfig } from "@shared/provider.js";

type WebviewElement = HTMLElement & {
  getURL?: () => string;
  loadURL?: (url: string) => Promise<void>;
  isLoading?: () => boolean;
  src: string;
  style: CSSStyleDeclaration;
  addEventListener: (
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
};

interface WebviewHandlerSlotState {
  webview: WebviewElement | null;
  providerConfig: BaseProviderConfig | null;
  lastActivity: number;
  _overrideUrl?: string;
  _pendingLoad?: boolean;
  _targetUrl?: string;
}

interface AttachResult {
  needsLoad: boolean;
  targetUrl: string;
}

interface DomReadyHandlerInfo {
  handler: () => void;
  errorHandler: (event: { errorCode?: number; errorDescription?: string }) => void;
  webview: WebviewElement;
  timeoutId: ReturnType<typeof setTimeout>;
}

type LogFn = (
  slot: SlotId,
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
) => void;

type EmitFn = (slot: SlotId, event: string, data: Record<string, unknown>) => void;

export function ensureWebviewMounted(slot: SlotId, webview: WebviewElement): boolean {
  const mountEl = document.getElementById(`${slot}-webview-mount`);
  if (!mountEl || mountEl.contains(webview)) {
    return false;
  }

  mountEl.appendChild(webview);
  webview.style.position = "relative";
  webview.style.top = "0";
  webview.style.left = "0";
  webview.style.width = "100%";
  webview.style.height = "100%";
  return true;
}

export function markWebviewAttached(webview: WebviewElement): void {
  const detachedAttr = webview.getAttribute("data-detached");
  if (detachedAttr !== null && detachedAttr !== "") {
    webview.removeAttribute("data-detached");
  }
  webview.style.display = "";
}

export function markWebviewDetached(webview: WebviewElement): void {
  webview.setAttribute("data-detached", "1");
  webview.removeAttribute("src");
  webview.style.display = "none";
}

export async function attachWebview(
  slotState: WebviewHandlerSlotState,
  slot: SlotId,
  correlationId: string,
  logFn: LogFn,
  emitFn: EmitFn,
  eventAttached: string
): Promise<AttachResult> {
  const webview = slotState.webview;

  if (!webview) {
    throw new Error("Webview not available");
  }

  markWebviewAttached(webview);

  const moved = ensureWebviewMounted(slot, webview);
  if (moved) {
    logFn(slot, LogLevel.DEBUG, "Webview moved to mount point", { correlationId });
  }

  const currentSrc = webview.getAttribute("src") ?? "";
  let currentUrl = "";
  try {
    const fullUrl = webview.getURL?.() ?? "";
    const parts = fullUrl.split("?");
    const beforeQuery = parts[0];
    if (beforeQuery !== undefined && beforeQuery !== "") {
      const hashParts = beforeQuery.split("#");
      currentUrl = hashParts[0] ?? "";
    }
  } catch (_e) {}

  const targetUrl = slotState._overrideUrl ?? slotState.providerConfig?.baseUrl ?? "";
  const targetParts = targetUrl.split("?");
  const targetBeforeQuery = targetParts[0] ?? "";
  const targetHashParts = targetBeforeQuery.split("#");
  const normalizedTarget = targetHashParts[0] ?? "";

  const hasOverride = slotState._overrideUrl !== undefined && slotState._overrideUrl !== "";

  if (slotState._overrideUrl !== undefined && slotState._overrideUrl !== "") {
    delete slotState._overrideUrl;
  }

  const hasCurrentSource = currentSrc !== "" || currentUrl !== "";
  const urlsMismatch =
    currentUrl !== "" &&
    normalizedTarget !== "" &&
    !currentUrl.startsWith(normalizedTarget) &&
    !normalizedTarget.startsWith(currentUrl);
  const needsLoad = hasOverride || !hasCurrentSource || urlsMismatch;

  slotState._pendingLoad = needsLoad && targetUrl !== "";
  slotState._targetUrl = targetUrl;

  if (!needsLoad && currentUrl !== "") {
    logFn(slot, LogLevel.DEBUG, `Webview already loaded: ${currentUrl}`, { correlationId });
  }

  slotState.lastActivity = Date.now();
  emitFn(slot, eventAttached, { correlationId });
  logFn(slot, LogLevel.DEBUG, "Webview attached", { correlationId });

  return await Promise.resolve({ needsLoad: slotState._pendingLoad ?? false, targetUrl });
}

export async function detachWebview(
  slotState: WebviewHandlerSlotState,
  slot: SlotId,
  correlationId: string,
  logFn: LogFn,
  emitFn: EmitFn,
  eventDetached: string
): Promise<void> {
  const webview = slotState.webview;

  if (!webview) {
    await Promise.resolve();
    return;
  }

  try {
    markWebviewDetached(webview);

    emitFn(slot, eventDetached, { correlationId });
    logFn(slot, LogLevel.DEBUG, "Webview detached", { correlationId });
  } catch (err) {
    logFn(slot, LogLevel.ERROR, `Webview detach error: ${String(err)}`, { correlationId });
  }

  slotState._pendingLoad = false;
  delete slotState._targetUrl;
  slotState.lastActivity = Date.now();

  await Promise.resolve();
}
const domReadyHandlers: Record<string, DomReadyHandlerInfo> = {};

/**
 * Wait until DOM ready.
 * Attach event listeners first, then set `src` to avoid race conditions.
 */
export async function waitForDomReady(
  slotState: WebviewHandlerSlotState,
  slot: SlotId,
  correlationId: string,
  logFn: LogFn
): Promise<void> {
  const webview = slotState.webview;

  if (!webview) {
    await Promise.reject(new Error("Webview not available"));
    return;
  }

  await new Promise<void>((resolve, reject) => {
    if (slotState._pendingLoad !== true) {
      try {
        const loadedUrl = webview.getURL?.() ?? "";
        const isLoading = webview.isLoading?.();
        if (loadedUrl !== "" && isLoading !== true) {
          logFn(slot, LogLevel.DEBUG, "Webview already loaded", { correlationId });
          resolve();
          return;
        }
      } catch (_e) {}
    }

    const timeoutId = setTimeout(() => {
      clearDomReadyHandler(slot);
      reject(new Error("DOM ready timeout"));
    }, TIMEOUTS.DOM_READY);

    const handler = (): void => {
      clearTimeout(timeoutId);
      clearDomReadyHandler(slot);
      logFn(slot, LogLevel.DEBUG, "DOM ready event received", { correlationId });
      resolve();
    };

    const errorHandler = (event: { errorCode?: number; errorDescription?: string }): void => {
      clearTimeout(timeoutId);
      clearDomReadyHandler(slot);
      if (event.errorCode !== -3 && event.errorCode !== -102) {
        reject(new Error(`Load failed: ${event.errorDescription ?? "unknown"}`));
      } else {
        resolve();
      }
    };

    domReadyHandlers[slot] = { handler, errorHandler, webview, timeoutId };

    webview.addEventListener("dom-ready", handler, { once: true });
    webview.addEventListener("did-fail-load", errorHandler as EventListener, { once: true });

    // Set `src` afterwards to avoid race conditions.
    if (
      slotState._pendingLoad === true &&
      slotState._targetUrl !== undefined &&
      slotState._targetUrl !== ""
    ) {
      logFn(slot, LogLevel.INFO, `Loading URL: ${slotState._targetUrl}`, { correlationId });
      webview.setAttribute("src", slotState._targetUrl);
      slotState._pendingLoad = false;
      delete slotState._targetUrl;
    }
  });
}

export function clearDomReadyHandler(slot: SlotId): void {
  const handlers = domReadyHandlers[slot];
  if (!handlers) return;

  const { handler, errorHandler, webview, timeoutId } = handlers;
  try {
    clearTimeout(timeoutId);
    webview.removeEventListener("dom-ready", handler);
    webview.removeEventListener("did-fail-load", errorHandler as EventListener);
  } catch (_e) {}
  delete domReadyHandlers[slot];
}

export function getCurrentUrl(slotState: WebviewHandlerSlotState | null): string {
  const webview = slotState?.webview;
  if (!webview) return "";
  try {
    const url = webview.getURL?.();
    if (url !== undefined && url !== "") return url;
    return webview.getAttribute("src") ?? "";
  } catch (_e) {
    return "";
  }
}
