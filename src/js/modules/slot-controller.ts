import { LogCategory, LogLevel } from "@shared/logging-core";
/**
 * SlotController - Merkezi Slot Yaşam Döngüsü Yöneticisi (Orchestrator)
 *
 * Tüm slot işlemlerini (account assignment, connection, webview, traffic)
 * tek bir state machine ile yönetir.
 *
 * Alt modüller:
 * - slot/webview-handler.js: Webview attach/detach/dom-ready
 * - slot/url-handler.js: URL değişiklik takibi ve exclusion
 * - slot/timeout-handler.js: Timeout ve hata yönetimi
 * - slot/settings-sync.js: Settings senkronizasyonu
 */

import { Logger } from "./logger/index.js";
import { SettingsManager } from "./settings-manager.js";
import { getErrorMessage } from "@shared/index.js";
import type { SlotId } from "@shared/index.js";
import type { BaseProviderConfig } from "@shared/provider.js";
import type { SlotStateMachine } from "./slot/state-machine.js";
import { SlotStates, createSlotStateMachine } from "./slot/state-machine.js";
import type { SlotStateType, TransitionResult } from "./slot/state-machine.js";

import {
  attachWebview,
  detachWebview,
  waitForDomReady,
  clearDomReadyHandler,
  getCurrentUrl,
  ensureWebviewMounted,
  markWebviewAttached,
  markWebviewDetached,
} from "./slot/webview-handler.js";

import {
  checkUrlExclusion,
  setupUrlChangeHandler,
  clearUrlChangeHandler,
  handleUrlChange,
  navigate as navigateWebview,
} from "./slot/url-handler.js";

import { normalizeUrl } from "./webview/methods/shared/url-utils.js";

import {
  startTimeout,
  clearTimeout,
  handleConnectTimeout,
  handleConnectError,
  cleanupAfterError,
} from "./slot/timeout-handler.js";

import {
  handleSettingsChange,
  syncWithSettings,
  syncSlotWithSettings,
} from "./slot/settings-sync.js";
import type { Settings } from "./slot/settings-sync.js";

export enum SlotState {
  EMPTY = "empty",
  ASSIGNED = "assigned",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTING = "disconnecting",
  ERROR = "error",
}

export enum SlotEvent {
  ACCOUNT_ASSIGNED = "account_assigned",
  ACCOUNT_REMOVED = "account_removed",
  CONNECT_START = "connect_start",
  CONNECT_COMPLETE = "connect_complete",
  CONNECT_FAILED = "connect_failed",
  DISCONNECT_START = "disconnect_start",
  DISCONNECT_COMPLETE = "disconnect_complete",
  WEBVIEW_REGISTERED = "webview_registered",
  WEBVIEW_ATTACHED = "webview_attached",
  WEBVIEW_DETACHED = "webview_detached",
  WEBVIEW_DOM_READY = "webview_dom_ready",
  WEBVIEW_NAVIGATED = "webview_navigated",
  TRAFFIC_STARTED = "traffic_started",
  TRAFFIC_STOPPED = "traffic_stopped",
  URL_CHANGED = "url_changed",
  URL_EXCLUDED = "url_excluded",
  URL_INCLUDED = "url_included",
  STATE_CHANGED = "state_changed",
}

const CONFIG = {
  connectTimeoutMs: 30000,
  urlCheckDelayMs: 500,
};

type WebviewElement = HTMLElement & {
  getURL?: () => string;
  loadURL?: (url: string) => Promise<void>;
  isLoading?: () => boolean;
  src: string;
};

/**
 * Slot state - tüm slot modülleriyle uyumlu birleşik interface
 * Bu interface tüm alt modüllerin (webview-handler, url-handler, settings-sync, timeout-handler)
 * gerektirdiği alanları içerir.
 */
interface SlotStateData {
  state: string;
  stateMachine: SlotStateMachine;

  accountId: string | null;
  providerId: string | null;
  providerConfig: BaseProviderConfig | null;

  webview: WebviewElement | null;
  webviewRegistered: boolean;
  domReady: boolean;

  currentUrl: string;
  urlExcluded: boolean;

  trafficStarted: boolean;

  correlationId: string;
  error: Error | null;
  lastActivity: number;

  _overrideUrl?: string;
  _pendingLoad?: boolean;
  _targetUrl?: string;
}

interface SlotOperationResult {
  success: boolean;
  message: string;
  correlationId?: string;
  error?: string;
}

const createSlotState = (slotId: string): SlotStateData => ({
  state: SlotState.EMPTY,
  stateMachine: createSlotStateMachine(slotId, SlotStates.EMPTY),
  accountId: null,
  providerId: null,
  providerConfig: null,
  webview: null,
  webviewRegistered: false,
  domReady: false,
  currentUrl: "",
  urlExcluded: false,
  trafficStarted: false,
  correlationId: "",
  error: null,
  lastActivity: Date.now(),
});

class SlotControllerClass {
  _slots: Record<string, SlotStateData>;
  _listeners: ((...args: unknown[]) => void)[];
  _initialized: boolean;
  _boundLog: typeof this._log;
  _boundEmit: typeof this._emit;
  _boundTransition: typeof this._transition;
  // Race condition fix: Operation locks per slot
  _operationLocks: Record<string, Promise<unknown> | null>;

  constructor() {
    this._slots = {
      ai0: createSlotState("ai0"), // Asistan slotu
      ai1: createSlotState("ai1"),
      ai2: createSlotState("ai2"),
    };
    this._listeners = [];
    this._initialized = false;
    this._operationLocks = { ai0: null, ai1: null, ai2: null };

    this._boundLog = this._log.bind(this);
    this._boundEmit = this._emit.bind(this);
    this._boundTransition = this._transition.bind(this);
  }

  /**
   * Race condition fix: Acquire operation lock for a slot
   * Prevents concurrent operations on the same slot
   */
  private async _acquireLock<T>(slot: string, operation: () => Promise<T>): Promise<T> {
    const waitForUnlock = async (): Promise<void> => {
      const pending = this._operationLocks[slot];
      if (pending == null) return;
      try {
        await pending;
      } catch {}
      await waitForUnlock();
    };
    await waitForUnlock();

    const operationPromise = operation();
    this._operationLocks[slot] = operationPromise;

    try {
      const result = await operationPromise;
      return result;
    } finally {
      this._operationLocks[slot] = null;
    }
  }

  async init(): Promise<void> {
    if (this._initialized) {
      await Promise.resolve();
      return;
    }

    const settings = SettingsManager.getSnapshot();
    syncWithSettings(this._slots, settings as Settings | null, (slot: string, s: unknown) => {
      this._syncSlotWithSettings(slot, s as Settings);
    });

    SettingsManager.subscribe(
      ({ settings, changedPaths }: { settings: unknown; changedPaths: string[] }) => {
        handleSettingsChange(
          this._slots,
          settings as Settings | null,
          changedPaths,
          (slot: string, s: unknown) => {
            this._syncSlotWithSettings(slot, s as Settings);
          }
        );
      }
    );

    this._initialized = true;
    Logger.info(LogCategory.SLOT, "SlotController initialized");
    await Promise.resolve();
  }

  private _getSlot(slot: string): SlotStateData | null {
    if (!this._isValidSlot(slot)) return null;
    return this._slots[slot] ?? null;
  }

  getState(slot: string): SlotStateData | null {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return { ...slotData };
  }

  isConnected(slot: string): boolean {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    return slotData.state === SlotState.CONNECTED;
  }

  isAssigned(slot: string): boolean {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    return slotData.state !== SlotState.EMPTY;
  }

  isTransitioning(slot: string): boolean {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    const state = slotData.state;
    return state === SlotState.CONNECTING || state === SlotState.DISCONNECTING;
  }

  isUrlExcluded(slot: string): boolean {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    return slotData.urlExcluded;
  }

  getProviderId(slot: string): string | null {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return slotData.providerId;
  }

  getWebview(slot: string): WebviewElement | null {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return slotData.webview;
  }

  ensureWebviewMounted(slot: SlotId): boolean {
    const slotState = this._getSlot(slot);
    if (!slotState?.webview) {
      return false;
    }

    const moved = ensureWebviewMounted(slot, slotState.webview);
    if (moved) {
      slotState.lastActivity = Date.now();
      this._log(slot, "debug", "Webview mounted to slot container");
    }

    return moved;
  }

  ensureWebviewAttached(slot: SlotId): boolean {
    const slotState = this._getSlot(slot);
    if (!slotState?.webview) {
      return false;
    }

    markWebviewAttached(slotState.webview);
    slotState.lastActivity = Date.now();
    return true;
  }

  markActive(slot: SlotId): boolean {
    const slotState = this._getSlot(slot);
    if (!slotState) {
      return false;
    }

    slotState.lastActivity = Date.now();
    return true;
  }

  parkWebview(slot: SlotId, reason = "manual_park"): boolean {
    const slotState = this._getSlot(slot);
    if (!slotState || !slotState.webviewRegistered || !slotState.webview) {
      return false;
    }

    markWebviewDetached(slotState.webview);
    slotState.domReady = false;
    slotState.currentUrl = "";
    slotState.urlExcluded = false;
    slotState.lastActivity = Date.now();

    this._emit(slot, SlotEvent.WEBVIEW_DETACHED, {
      reason,
    });

    if (reason === "inactive_cleanup") {
      this._log(slot, "info", "Inactive webview parked");
    } else {
      this._log(slot, "debug", `Webview parked (${reason})`);
    }

    return true;
  }

  cleanupInactiveWebviews(inactivityThresholdMs = 30 * 60 * 1000): number {
    const now = Date.now();
    let detachedCount = 0;

    (["ai0", "ai1", "ai2"] as SlotId[]).forEach((slot) => {
      const slotState = this._getSlot(slot);
      if (!slotState || !slotState.webviewRegistered || !slotState.webview) {
        return;
      }

      const state = slotState.state;
      const isConnected = state === SlotState.CONNECTED;
      const isTransitioning = state === SlotState.CONNECTING || state === SlotState.DISCONNECTING;
      if (isConnected || isTransitioning) {
        return;
      }

      const inactive = now - slotState.lastActivity > inactivityThresholdMs;
      if (!inactive) {
        return;
      }

      if (this.parkWebview(slot, "inactive_cleanup")) {
        detachedCount += 1;
      }
    });

    return detachedCount;
  }

  registerWebview(slot: string, webview: HTMLElement): void {
    const slotState = this._getSlot(slot);
    if (!slotState) return;

    if (slotState.webviewRegistered && slotState.webview === webview) {
      return; // Çift register'u önle
    }

    slotState.webview = webview as WebviewElement;
    slotState.webviewRegistered = true;
    slotState.lastActivity = Date.now();

    this._log(slot, "info", "Webview registered");
    this._emit(slot, SlotEvent.WEBVIEW_REGISTERED, { webview });
  }

  unregisterWebview(slot: string): void {
    const slotState = this._getSlot(slot);
    if (!slotState) return;

    // Race condition fix: Await disconnect to prevent state inconsistency
    if (slotState.state === SlotState.CONNECTED) {
      this._log(slot, "warning", "Unregistering connected slot - disconnecting first");
      this.disconnect(slot, { force: true })
        .then((result: { success?: boolean; message?: string }) => {
          if (result.success !== true) {
            Logger.panel(LogCategory.SLOT, LogLevel.ERROR, "Disconnect during unregister failed", {
              slot,
              error: result.message,
            });
          }
        })
        .catch((err) => {
          Logger.panel(LogCategory.SLOT, LogLevel.ERROR, "disconnect error during unregister", {
            error: err,
          });
        });
      return; // Exit early - disconnect will handle cleanup
    }

    slotState.webview = null;
    slotState.webviewRegistered = false;
    slotState.domReady = false;

    this._log(slot, "info", "Webview unregistered");
    this._emit(slot, SlotEvent.WEBVIEW_DETACHED, {});
  }

  recoverFromError(slot: string): SlotOperationResult {
    const slotState = this._getSlot(slot);
    if (!slotState) {
      return { success: false, message: "invalid-slot" };
    }

    if (slotState.state !== SlotState.ERROR) {
      return { success: false, message: "not-in-error-state" };
    }

    this._log(slot, "info", "Manual recovery from ERROR state");
    slotState.error = null;

    if (slotState.accountId !== null && slotState.accountId !== "") {
      this._transition(slot, SlotState.ASSIGNED);
    } else {
      this._transition(slot, SlotState.EMPTY);
    }

    return { success: true, message: "recovered" };
  }

  async connect(
    slot: SlotId,
    options: { force?: boolean; url?: string; correlationId?: string } = {}
  ): Promise<SlotOperationResult> {
    // Race condition fix: Use lock to prevent concurrent connect operations
    return await this._acquireLock(slot, async () => await this._connectInternal(slot, options));
  }

  private async _connectInternal(
    slot: SlotId,
    options: { force?: boolean; url?: string; correlationId?: string } = {}
  ): Promise<SlotOperationResult> {
    const slotState = this._getSlot(slot);
    if (!slotState) {
      return { success: false, message: "invalid-slot" };
    }

    const correlationId = this._generateCorrelationId(slot, "connect");

    this._log(slot, "info", `Connect requested`, { correlationId });

    if (slotState.state === SlotState.EMPTY) {
      this._log(slot, "warning", "Cannot connect: no account assigned", { correlationId });
      return { success: false, message: "no-account-assigned", correlationId };
    }

    if (slotState.state === SlotState.CONNECTED && options.force !== true) {
      this._log(slot, "debug", "Already connected", { correlationId });
      return { success: true, message: "already-connected", correlationId };
    }

    if (slotState.state === SlotState.CONNECTING) {
      this._log(slot, "warning", "Connection already in progress", { correlationId });
      return { success: false, message: "connection-in-progress", correlationId };
    }

    if (slotState.state === SlotState.ERROR) {
      this._log(slot, "info", "Recovering from ERROR state", { correlationId });
      slotState.error = null;
      this._transition(slot, SlotState.ASSIGNED);
    }

    if (slotState.state === SlotState.CONNECTED && options.force === true) {
      this._log(slot, "info", "Force reconnect - disconnecting first", { correlationId });
      await this.disconnect(slot, { force: true });
    }

    if (!slotState.webview) {
      this._log(slot, "error", "Cannot connect: webview not registered", { correlationId });
      return { success: false, message: "webview-not-registered", correlationId };
    }

    if (options.url !== undefined && options.url !== "") {
      slotState._overrideUrl = options.url;
      this._log(slot, "debug", `URL override set: ${options.url}`, { correlationId });
    }

    slotState.correlationId = correlationId;

    const transitionResult = this._transition(slot, SlotState.CONNECTING);
    if (!transitionResult.success) {
      this._log(
        slot,
        "error",
        `Invalid state transition blocked: ${slotState.state} → connecting. ${transitionResult.error ?? "unknown"}`,
        { correlationId }
      );
      return {
        success: false,
        message: "invalid-state-transition",
        correlationId,
        ...(transitionResult.error !== undefined ? { error: transitionResult.error } : {}),
      };
    }
    this._emit(slot, SlotEvent.CONNECT_START, { correlationId });

    startTimeout(slot, "connect", CONFIG.connectTimeoutMs, () => {
      handleConnectTimeout(
        slotState,
        slot,
        correlationId,
        SlotState.ERROR,
        this._boundLog,
        this._boundEmit,
        this._boundTransition,
        SlotEvent.CONNECT_FAILED,
        (s, cid) => {
          void this._cleanupAfterError(s, cid);
        }
      );
    });

    try {
      await attachWebview(
        slotState,
        slot,
        correlationId,
        this._boundLog,
        this._boundEmit,
        SlotEvent.WEBVIEW_ATTACHED
      );

      await waitForDomReady(slotState, slot, correlationId, this._boundLog);
      slotState.domReady = true;
      this._emit(slot, SlotEvent.WEBVIEW_DOM_READY, { correlationId });

      if (slotState.providerConfig) {
        try {
          const webviewEl = slotState.webview as HTMLElement & {
            send?: (channel: string, ...args: unknown[]) => void;
          };
          if (typeof webviewEl.send === "function") {
            webviewEl.send("hayalet-set-provider", {
              providerId: slotState.providerConfig.id,
              slot: slot,
            });
            this._log(
              slot,
              "debug",
              `Provider info sent to webview: ${slotState.providerConfig.id}`,
              { correlationId }
            );
          }
        } catch (sendErr) {
          this._log(
            slot,
            "warning",
            `Failed to send provider info to webview: ${getErrorMessage(sendErr)}`,
            { correlationId }
          );
        }
      }

      await this._delay(CONFIG.urlCheckDelayMs);
      const currentUrl = getCurrentUrl(slotState);
      slotState.currentUrl = currentUrl;

      const isExcluded = checkUrlExclusion(slotState, currentUrl);
      slotState.urlExcluded = isExcluded;

      if (isExcluded) {
        this._emit(slot, SlotEvent.URL_EXCLUDED, { url: currentUrl, correlationId });
        this._log(slot, "info", `URL excluded: ${currentUrl} - traffic disabled`, {
          correlationId,
        });
      } else {
        this._emit(slot, SlotEvent.URL_INCLUDED, { url: currentUrl, correlationId });
        await this._startTraffic(slot, correlationId);
      }

      setupUrlChangeHandler(slotState, slot, correlationId, (s: string, url: string) => {
        this._handleUrlChange(s as SlotId, url);
      });

      clearTimeout(slot, "connect");
      this._transition(slot, SlotState.CONNECTED);
      this._emit(slot, SlotEvent.CONNECT_COMPLETE, { correlationId, urlExcluded: isExcluded });

      const elapsed = Date.now() - slotState.lastActivity;
      this._log(
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
        SlotState.ERROR,
        this._boundLog,
        this._boundEmit,
        this._boundTransition,
        SlotEvent.CONNECT_FAILED,
        (s, cid) => {
          void this._cleanupAfterError(s, cid);
        }
      );
    }
  }

  async disconnect(slot: string, _options: { force?: boolean } = {}): Promise<SlotOperationResult> {
    // Race condition fix: Use lock to prevent concurrent disconnect operations
    return await this._acquireLock(
      slot,
      async () => await this._disconnectInternal(slot, _options)
    );
  }

  private async _disconnectInternal(
    slot: string,
    _options: { force?: boolean } = {}
  ): Promise<SlotOperationResult> {
    const slotState = this._getSlot(slot);
    if (!slotState) {
      return { success: false, message: "invalid-slot" };
    }

    const correlationId = this._generateCorrelationId(slot, "disconnect");

    this._log(slot, "info", "Disconnect requested", { correlationId });

    if (slotState.state === SlotState.EMPTY) {
      return { success: true, message: "not-assigned", correlationId };
    }

    if (slotState.state === SlotState.ASSIGNED) {
      this._log(slot, "debug", "Already disconnected (ASSIGNED state)", { correlationId });
      return { success: true, message: "already-disconnected", correlationId };
    }

    if (slotState.state === SlotState.DISCONNECTING) {
      return { success: false, message: "disconnect-in-progress", correlationId };
    }

    const transitionResult = this._transition(slot, SlotState.DISCONNECTING);
    if (!transitionResult.success) {
      this._log(
        slot,
        "error",
        `Invalid state transition blocked: ${slotState.state} → disconnecting. ${transitionResult.error ?? "unknown"}`,
        { correlationId }
      );
      return {
        success: false,
        message: "invalid-state-transition",
        correlationId,
        ...(transitionResult.error !== undefined ? { error: transitionResult.error } : {}),
      };
    }
    this._emit(slot, SlotEvent.DISCONNECT_START, { correlationId });

    try {
      clearUrlChangeHandler(slot as SlotId);

      if (slotState.trafficStarted) {
        await this._stopTraffic(slot, correlationId);
      }

      await detachWebview(
        slotState,
        slot as SlotId,
        correlationId,
        this._boundLog,
        this._boundEmit,
        SlotEvent.WEBVIEW_DETACHED
      );

      slotState.domReady = false;
      slotState.currentUrl = "";
      slotState.urlExcluded = false;
      slotState.trafficStarted = false;
      slotState.correlationId = "";
      slotState.error = null;

      this._transition(slot, SlotState.ASSIGNED);
      this._emit(slot, SlotEvent.DISCONNECT_COMPLETE, { correlationId });

      this._log(slot, "success", "Disconnected successfully", { correlationId });
      return { success: true, message: "disconnected", correlationId };
    } catch (error) {
      slotState.domReady = false;
      slotState.trafficStarted = false;
      this._transition(slot, SlotState.ASSIGNED);

      this._log(slot, "warning", `Disconnect completed with errors: ${getErrorMessage(error)}`, {
        correlationId,
      });
      return { success: true, message: "disconnected-with-errors", correlationId };
    }
  }

  navigate(slot: SlotId, url: string | null = null): void {
    const slotState = this._getSlot(slot);
    if (!slotState) return;

    navigateWebview(
      slotState,
      slot,
      url,
      SlotState.CONNECTED,
      this._boundLog,
      this._boundEmit,
      SlotEvent.WEBVIEW_NAVIGATED
    );
  }

  subscribe(listener: (payload: unknown) => void) {
    if (typeof listener === "function") {
      this._listeners.push(listener);
    }
    return (): void => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  on(eventType: string, listener: (payload: { event?: string; slot?: string }) => void) {
    type WrapperFunction = ((payload: unknown) => void) & {
      _original: typeof listener;
      _eventType: string;
    };

    const wrapper = ((payload: unknown): void => {
      if (
        payload !== null &&
        payload !== undefined &&
        typeof payload === "object" &&
        "event" in payload &&
        payload.event === eventType
      ) {
        listener(payload as { event?: string; slot?: string });
      }
    }) as WrapperFunction;

    wrapper._original = listener;
    wrapper._eventType = eventType;

    this._listeners.push(wrapper);
    return (): void => {
      this._listeners = this._listeners.filter((l) => l !== wrapper);
    };
  }

  _syncSlotWithSettings(slot: string, settings: Settings): void {
    const slotState = this._getSlot(slot);
    if (!slotState) return;

    syncSlotWithSettings(
      slotState,
      slot,
      settings as Settings | null,
      {
        EMPTY: SlotState.EMPTY,
        ASSIGNED: SlotState.ASSIGNED,
        CONNECTED: SlotState.CONNECTED,
        CONNECTING: SlotState.CONNECTING,
      },
      { ACCOUNT_ASSIGNED: SlotEvent.ACCOUNT_ASSIGNED, ACCOUNT_REMOVED: SlotEvent.ACCOUNT_REMOVED },
      this._boundLog,
      this._boundTransition,
      this._boundEmit,
      async (s: string, opts?: { force?: boolean }) => await this.disconnect(s, opts),
      (s: string) => {
        this.navigate(s as SlotId);
      }
    );
  }

  _handleUrlChange(slot: SlotId, newUrl: string): void {
    const slotState = this._getSlot(slot);
    if (!slotState) return;

    handleUrlChange(
      slotState,
      slot,
      newUrl,
      SlotState.CONNECTED,
      this._boundLog,
      this._boundEmit,
      {
        URL_CHANGED: SlotEvent.URL_CHANGED,
        URL_EXCLUDED: SlotEvent.URL_EXCLUDED,
        URL_INCLUDED: SlotEvent.URL_INCLUDED,
      },
      (s: SlotId, cid: string) => {
        void this._startTraffic(s, cid);
      },
      (s: SlotId, cid: string) => {
        void this._stopTraffic(s, cid);
      }
    );

    // If navigated to provider's default page, reset conversation list to "Yeni Sohbet"
    const baseUrl = slotState.providerConfig?.baseUrl;
    if (baseUrl !== undefined && baseUrl !== "" && normalizeUrl(newUrl) === normalizeUrl(baseUrl)) {
      this._emit(slot, SlotEvent.URL_CHANGED, { newUrl, isDefaultPage: true });
    }
  }

  async _startTraffic(slot: string, correlationId: string): Promise<void> {
    const slotState = this._getSlot(slot);
    if (!slotState || !slotState.webview || slotState.trafficStarted) {
      await Promise.resolve();
      return;
    }

    try {
      slotState.trafficStarted = true;
      this._emit(slot, SlotEvent.TRAFFIC_STARTED, { correlationId });
      this._log(slot, "debug", "Traffic started", { correlationId });
    } catch (err) {
      this._log(slot, "warning", `Traffic start warning: ${getErrorMessage(err)}`, {
        correlationId,
      });
    }
    await Promise.resolve();
  }
  async _stopTraffic(slot: string, correlationId: string): Promise<void> {
    const slotState = this._getSlot(slot);
    if (slotState?.trafficStarted !== true) {
      await Promise.resolve();
      return;
    }

    try {
      slotState.trafficStarted = false;
      this._emit(slot, SlotEvent.TRAFFIC_STOPPED, { correlationId });
      this._log(slot, "debug", "Traffic stopped", { correlationId });
    } catch (err) {
      this._log(slot, "warning", `Traffic stop warning: ${getErrorMessage(err)}`, {
        correlationId,
      });
    }
    await Promise.resolve();
  }

  async _cleanupAfterError(slot: string, correlationId: string): Promise<void> {
    const slotState = this._getSlot(slot);
    if (!slotState) return;

    await cleanupAfterError(
      slotState,
      slot,
      correlationId,
      this._boundLog,
      (s: string) => {
        clearUrlChangeHandler(s as SlotId);
      },
      (s: string) => {
        clearDomReadyHandler(s as SlotId);
      },
      async (s: string, cid: string) => {
        await this._stopTraffic(s, cid);
      },
      async (s: string, cid: string) => {
        const innerSlot = this._getSlot(s);
        if (innerSlot) {
          await detachWebview(
            innerSlot,
            s as SlotId,
            cid,
            this._boundLog,
            this._boundEmit,
            SlotEvent.WEBVIEW_DETACHED
          );
        }
      }
    );
  }

  /**
   * State transition with validation
   * @returns TransitionResult with success status and details
   */
  _transition(slot: string, newState: string, reason?: string): TransitionResult {
    const slotState = this._getSlot(slot);
    if (!slotState) {
      return {
        success: false,
        error: "invalid-slot",
        fromState: "unknown" as SlotStateType,
        toState: newState as SlotStateType,
      };
    }

    const oldState = slotState.state;

    const result = slotState.stateMachine.transition(newState as SlotStateType, {
      ...(slotState.correlationId !== "" ? { correlationId: slotState.correlationId } : {}),
      ...(reason !== undefined && reason !== "" ? { reason } : {}),
    });

    if (result.success) {
      // Legacy state alanını da güncelle (backward compatibility)
      slotState.state = newState;
      slotState.lastActivity = Date.now();

      if (result.wasNoOp !== true) {
        this._emit(slot, SlotEvent.STATE_CHANGED, {
          oldState,
          newState,
          validated: true,
        });
      }
    } else {
      this._log(
        slot,
        "error",
        `Invalid state transition blocked: ${oldState} → ${newState}. ${result.error ?? "unknown"}`
      );
    }

    return result;
  }

  getStateMachineState(slot: string): SlotStateType | null {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return slotData.stateMachine.state;
  }

  /**
   * State machine debug bilgisini al
   */
  getStateMachineDebugInfo(slot: string): unknown {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return slotData.stateMachine.getDebugInfo();
  }

  canTransitionTo(slot: string, targetState: string): boolean {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    return slotData.stateMachine.canTransitionTo(targetState as SlotStateType);
  }

  _isValidSlot(slot: string): boolean {
    return slot === "ai0" || slot === "ai1" || slot === "ai2";
  }

  _generateCorrelationId(slot: string, operation: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `${slot}-${operation}-${timestamp}-${random}`;
  }

  _emit(slot: string, event: string, data: Record<string, unknown> = {}): void {
    const payload = {
      slot,
      event,
      data,
      timestamp: Date.now(),
      state: this._slots[slot]?.state,
    };

    this._listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch {}
    });

    if (event === SlotEvent.STATE_CHANGED) {
      window.dispatchEvent(
        new CustomEvent("slot-state-changed", {
          detail: payload,
        })
      );
    }
  }

  _log(
    slot: string,
    level: string,
    message: string,
    context: { correlationId?: string } = {}
  ): void {
    const logContext = {
      ...(context.correlationId !== undefined && context.correlationId !== ""
        ? { correlationId: context.correlationId }
        : {}),
      slotId: slot,
    };
    const category = LogCategory.SLOT;
    const formattedMessage = `[${slot.toUpperCase()}] ${message}`;

    if (level === "error") {
      Logger.panel(category, LogLevel.ERROR, formattedMessage, logContext);
    } else if (level === "warning") {
      Logger.warn(category, formattedMessage, logContext);
    } else if (level === "debug") {
      Logger.debug(category, formattedMessage, logContext);
    } else if (level === "success") {
      Logger.info(category, `✅ ${formattedMessage}`, logContext);
    } else {
      Logger.info(category, formattedMessage, logContext);
    }
  }

  async _delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

const slotController = new SlotControllerClass();
export { slotController as SlotController };
