import { getErrorMessage } from "@shared/index.js";
import type { SlotId } from "@shared/index.js";
import { normalizeUrl } from "../webview/methods/shared/url-utils.js";
import type { TransitionResult } from "./state-machine.js";
import type { SlotOperationResult, SlotStateData } from "./controller-state.js";
import {
  attachWebview,
  clearDomReadyHandler,
  detachWebview,
  getCurrentUrl,
  waitForDomReady,
} from "./webview-handler.js";
import {
  checkUrlExclusion,
  clearUrlChangeHandler,
  handleUrlChange,
  setupUrlChangeHandler,
} from "./url-handler.js";
import {
  cleanupAfterError as cleanupTimeoutAfterError,
  clearTimeout,
  handleConnectError,
  handleConnectTimeout,
  startTimeout,
} from "./timeout-handler.js";

interface LifecycleStates {
  EMPTY: string;
  ASSIGNED: string;
  CONNECTING: string;
  CONNECTED: string;
  DISCONNECTING: string;
  ERROR: string;
}

interface LifecycleEvents {
  CONNECT_START: string;
  CONNECT_COMPLETE: string;
  CONNECT_FAILED: string;
  DISCONNECT_START: string;
  DISCONNECT_COMPLETE: string;
  WEBVIEW_ATTACHED: string;
  WEBVIEW_DETACHED: string;
  WEBVIEW_DOM_READY: string;
  TRAFFIC_STARTED: string;
  TRAFFIC_STOPPED: string;
  URL_CHANGED: string;
  URL_EXCLUDED: string;
  URL_INCLUDED: string;
}

interface LifecycleConfig {
  connectTimeoutMs: number;
  urlCheckDelayMs: number;
}

interface LifecycleContext {
  getSlot: (slot: string) => SlotStateData | null;
  generateCorrelationId: (slot: string, operation: string) => string;
  log: (
    slot: string,
    level: string,
    message: string,
    context?: { correlationId?: string }
  ) => void;
  emit: (slot: string, event: string, data?: Record<string, unknown>) => void;
  transition: (slot: string, newState: string, reason?: string) => TransitionResult;
  delay: (ms: number) => Promise<void>;
  disconnect: (slot: string, options?: { force?: boolean }) => Promise<SlotOperationResult>;
  startTraffic: (slot: string, correlationId: string) => Promise<void>;
  stopTraffic: (slot: string, correlationId: string) => Promise<void>;
  cleanupAfterError: (slot: string, correlationId: string) => Promise<void>;
  states: LifecycleStates;
  events: LifecycleEvents;
  config: LifecycleConfig;
}

export async function connectSlotLifecycle(
  slot: SlotId,
  options: { force?: boolean; url?: string; correlationId?: string } = {},
  context: LifecycleContext
): Promise<SlotOperationResult> {
  const slotState = context.getSlot(slot);
  if (!slotState) {
    return { success: false, message: "invalid-slot" };
  }

  const correlationId = context.generateCorrelationId(slot, "connect");

  context.log(slot, "info", "Connect requested", { correlationId });

  if (slotState.state === context.states.EMPTY) {
    context.log(slot, "warning", "Cannot connect: no account assigned", { correlationId });
    return { success: false, message: "no-account-assigned", correlationId };
  }

  if (slotState.state === context.states.CONNECTED && options.force !== true) {
    context.log(slot, "debug", "Already connected", { correlationId });
    return { success: true, message: "already-connected", correlationId };
  }

  if (slotState.state === context.states.CONNECTING) {
    context.log(slot, "warning", "Connection already in progress", { correlationId });
    return { success: false, message: "connection-in-progress", correlationId };
  }

  if (slotState.state === context.states.ERROR) {
    context.log(slot, "info", "Recovering from ERROR state", { correlationId });
    slotState.error = null;
    context.transition(slot, context.states.ASSIGNED);
  }

  if (slotState.state === context.states.CONNECTED && options.force === true) {
    context.log(slot, "info", "Force reconnect - disconnecting first", { correlationId });
    await context.disconnect(slot, { force: true });
  }

  if (!slotState.webview) {
    context.log(slot, "error", "Cannot connect: webview not registered", { correlationId });
    return { success: false, message: "webview-not-registered", correlationId };
  }

  if (options.url !== undefined && options.url !== "") {
    slotState._overrideUrl = options.url;
    context.log(slot, "debug", `URL override set: ${options.url}`, { correlationId });
  }

  slotState.correlationId = correlationId;

  const transitionResult = context.transition(slot, context.states.CONNECTING);
  if (!transitionResult.success) {
    context.log(
      slot,
      "error",
      `Invalid state transition blocked: ${slotState.state} -> connecting. ${transitionResult.error ?? "unknown"}`,
      { correlationId }
    );
    return {
      success: false,
      message: "invalid-state-transition",
      correlationId,
      ...(transitionResult.error !== undefined ? { error: transitionResult.error } : {}),
    };
  }
  context.emit(slot, context.events.CONNECT_START, { correlationId });

  startTimeout(slot, "connect", context.config.connectTimeoutMs, () => {
    handleConnectTimeout(
      slotState,
      slot,
      correlationId,
      context.states.ERROR,
      context.log,
      context.emit,
      context.transition,
      context.events.CONNECT_FAILED,
      (innerSlot, innerCorrelationId) => {
        void context.cleanupAfterError(innerSlot, innerCorrelationId);
      }
    );
  });

  try {
    await attachWebview(
      slotState,
      slot,
      correlationId,
      context.log,
      context.emit,
      context.events.WEBVIEW_ATTACHED
    );

    await waitForDomReady(slotState, slot, correlationId, context.log);
    slotState.domReady = true;
    context.emit(slot, context.events.WEBVIEW_DOM_READY, { correlationId });

    if (slotState.providerConfig) {
      try {
        const webviewEl = slotState.webview as HTMLElement & {
          send?: (channel: string, ...args: unknown[]) => void;
        };
        if (typeof webviewEl.send === "function") {
          webviewEl.send("hayalet-set-provider", {
            providerId: slotState.providerConfig.id,
            slot,
          });
          context.log(
            slot,
            "debug",
            `Provider info sent to webview: ${slotState.providerConfig.id}`,
            { correlationId }
          );
        }
      } catch (sendErr) {
        context.log(
          slot,
          "warning",
          `Failed to send provider info to webview: ${getErrorMessage(sendErr)}`,
          { correlationId }
        );
      }
    }

    await context.delay(context.config.urlCheckDelayMs);
    const currentUrl = getCurrentUrl(slotState);
    slotState.currentUrl = currentUrl;

    const isExcluded = checkUrlExclusion(slotState, currentUrl);
    slotState.urlExcluded = isExcluded;

    if (isExcluded) {
      context.emit(slot, context.events.URL_EXCLUDED, { url: currentUrl, correlationId });
      context.log(slot, "info", `URL excluded: ${currentUrl} - traffic disabled`, {
        correlationId,
      });
    } else {
      context.emit(slot, context.events.URL_INCLUDED, { url: currentUrl, correlationId });
      await context.startTraffic(slot, correlationId);
    }

    setupUrlChangeHandler(slotState, slot, correlationId, (innerSlot, newUrl) => {
      handleSlotUrlChange(innerSlot, newUrl, context);
    });

    clearTimeout(slot, "connect");
    context.transition(slot, context.states.CONNECTED);
    context.emit(slot, context.events.CONNECT_COMPLETE, {
      correlationId,
      urlExcluded: isExcluded,
    });

    const elapsed = Date.now() - slotState.lastActivity;
    context.log(
      slot,
      "success",
      `Connected successfully (${elapsed}ms)${isExcluded ? " [URL excluded]" : ""}`,
      { correlationId }
    );

    return { success: true, message: "connected", correlationId };
  } catch (error) {
    clearTimeout(slot, "connect");
    return handleConnectError(
      slotState,
      slot,
      correlationId,
      error,
      context.states.ERROR,
      context.log,
      context.emit,
      context.transition,
      context.events.CONNECT_FAILED,
      (innerSlot, innerCorrelationId) => {
        void context.cleanupAfterError(innerSlot, innerCorrelationId);
      }
    );
  }
}

export async function disconnectSlotLifecycle(
  slot: string,
  _options: { force?: boolean } = {},
  context: LifecycleContext
): Promise<SlotOperationResult> {
  const slotState = context.getSlot(slot);
  if (!slotState) {
    return { success: false, message: "invalid-slot" };
  }

  const correlationId = context.generateCorrelationId(slot, "disconnect");

  context.log(slot, "info", "Disconnect requested", { correlationId });

  if (slotState.state === context.states.EMPTY) {
    return { success: true, message: "not-assigned", correlationId };
  }

  if (slotState.state === context.states.ASSIGNED) {
    context.log(slot, "debug", "Already disconnected (ASSIGNED state)", { correlationId });
    return { success: true, message: "already-disconnected", correlationId };
  }

  if (slotState.state === context.states.DISCONNECTING) {
    return { success: false, message: "disconnect-in-progress", correlationId };
  }

  const transitionResult = context.transition(slot, context.states.DISCONNECTING);
  if (!transitionResult.success) {
    context.log(
      slot,
      "error",
      `Invalid state transition blocked: ${slotState.state} -> disconnecting. ${transitionResult.error ?? "unknown"}`,
      { correlationId }
    );
    return {
      success: false,
      message: "invalid-state-transition",
      correlationId,
      ...(transitionResult.error !== undefined ? { error: transitionResult.error } : {}),
    };
  }
  context.emit(slot, context.events.DISCONNECT_START, { correlationId });

  try {
    clearUrlChangeHandler(slot as SlotId);

    if (slotState.trafficStarted) {
      await context.stopTraffic(slot, correlationId);
    }

    await detachWebview(
      slotState,
      slot as SlotId,
      correlationId,
      context.log,
      context.emit,
      context.events.WEBVIEW_DETACHED
    );

    slotState.domReady = false;
    slotState.currentUrl = "";
    slotState.urlExcluded = false;
    slotState.trafficStarted = false;
    slotState.correlationId = "";
    slotState.error = null;

    context.transition(slot, context.states.ASSIGNED);
    context.emit(slot, context.events.DISCONNECT_COMPLETE, { correlationId });

    context.log(slot, "success", "Disconnected successfully", { correlationId });
    return { success: true, message: "disconnected", correlationId };
  } catch (error) {
    slotState.domReady = false;
    slotState.trafficStarted = false;
    context.transition(slot, context.states.ASSIGNED);

    context.log(
      slot,
      "warning",
      `Disconnect completed with errors: ${getErrorMessage(error)}`,
      { correlationId }
    );
    return { success: true, message: "disconnected-with-errors", correlationId };
  }
}

export function handleSlotUrlChange(
  slot: SlotId,
  newUrl: string,
  context: LifecycleContext
): void {
  const slotState = context.getSlot(slot);
  if (!slotState) {
    return;
  }

  handleUrlChange(
    slotState,
    slot,
    newUrl,
    context.states.CONNECTED,
    context.log,
    context.emit,
    {
      URL_CHANGED: context.events.URL_CHANGED,
      URL_EXCLUDED: context.events.URL_EXCLUDED,
      URL_INCLUDED: context.events.URL_INCLUDED,
    },
    (innerSlot, correlationId) => {
      void context.startTraffic(innerSlot, correlationId);
    },
    (innerSlot, correlationId) => {
      void context.stopTraffic(innerSlot, correlationId);
    }
  );

  const baseUrl = slotState.providerConfig?.baseUrl;
  if (baseUrl !== undefined && baseUrl !== "" && normalizeUrl(newUrl) === normalizeUrl(baseUrl)) {
    context.emit(slot, context.events.URL_CHANGED, { newUrl, isDefaultPage: true });
  }
}

export async function startSlotTraffic(
  slot: string,
  correlationId: string,
  context: LifecycleContext
): Promise<void> {
  const slotState = context.getSlot(slot);
  if (!slotState || !slotState.webview || slotState.trafficStarted) {
    await Promise.resolve();
    return;
  }

  try {
    slotState.trafficStarted = true;
    context.emit(slot, context.events.TRAFFIC_STARTED, { correlationId });
    context.log(slot, "debug", "Traffic started", { correlationId });
  } catch (err) {
    context.log(slot, "warning", `Traffic start warning: ${getErrorMessage(err)}`, {
      correlationId,
    });
  }
  await Promise.resolve();
}

export async function stopSlotTraffic(
  slot: string,
  correlationId: string,
  context: LifecycleContext
): Promise<void> {
  const slotState = context.getSlot(slot);
  if (slotState?.trafficStarted !== true) {
    await Promise.resolve();
    return;
  }

  try {
    slotState.trafficStarted = false;
    context.emit(slot, context.events.TRAFFIC_STOPPED, { correlationId });
    context.log(slot, "debug", "Traffic stopped", { correlationId });
  } catch (err) {
    context.log(slot, "warning", `Traffic stop warning: ${getErrorMessage(err)}`, {
      correlationId,
    });
  }
  await Promise.resolve();
}

export async function cleanupSlotAfterError(
  slot: string,
  correlationId: string,
  context: LifecycleContext
): Promise<void> {
  const slotState = context.getSlot(slot);
  if (!slotState) {
    return;
  }

  await cleanupTimeoutAfterError(
    slotState,
    slot,
    correlationId,
    context.log,
    (innerSlot) => {
      clearUrlChangeHandler(innerSlot as SlotId);
    },
    (innerSlot) => {
      clearDomReadyHandler(innerSlot as SlotId);
    },
    async (innerSlot, innerCorrelationId) => {
      await context.stopTraffic(innerSlot, innerCorrelationId);
    },
    async (innerSlot, innerCorrelationId) => {
      const innerSlotState = context.getSlot(innerSlot);
      if (innerSlotState) {
        await detachWebview(
          innerSlotState,
          innerSlot as SlotId,
          innerCorrelationId,
          context.log,
          context.emit,
          context.events.WEBVIEW_DETACHED
        );
      }
    }
  );
}
