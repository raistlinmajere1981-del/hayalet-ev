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

import { LogManager } from "./log-manager.js";
import { SettingsManager } from "./settings-manager.js";
import type { SlotId } from "../types/index.js";

import {
  attachWebview,
  detachWebview,
  waitForDomReady,
  clearDomReadyHandler,
  getCurrentUrl,
} from "./slot/webview-handler.js";

import {
  checkUrlExclusion,
  setupUrlChangeHandler,
  clearUrlChangeHandler,
  handleUrlChange,
  navigate as navigateWebview,
} from "./slot/url-handler.js";

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

// ============================================
// ============================================
export const SlotState = {
  EMPTY: "empty",
  ASSIGNED: "assigned",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTING: "disconnecting",
  ERROR: "error",
};

// ============================================
// ============================================
export const SlotEvent = {
  ACCOUNT_ASSIGNED: "account_assigned",
  ACCOUNT_REMOVED: "account_removed",
  CONNECT_START: "connect_start",
  CONNECT_COMPLETE: "connect_complete",
  CONNECT_FAILED: "connect_failed",
  DISCONNECT_START: "disconnect_start",
  DISCONNECT_COMPLETE: "disconnect_complete",
  WEBVIEW_REGISTERED: "webview_registered",
  WEBVIEW_ATTACHED: "webview_attached",
  WEBVIEW_DETACHED: "webview_detached",
  WEBVIEW_DOM_READY: "webview_dom_ready",
  WEBVIEW_NAVIGATED: "webview_navigated",
  TRAFFIC_STARTED: "traffic_started",
  TRAFFIC_STOPPED: "traffic_stopped",
  URL_CHANGED: "url_changed",
  URL_EXCLUDED: "url_excluded",
  URL_INCLUDED: "url_included",
  STATE_CHANGED: "state_changed",
};

// ============================================
// ============================================
const CONFIG = {
  connectTimeoutMs: 30000,
  urlCheckDelayMs: 500,
};

// ============================================
// Slot State Interface
// ============================================
interface SlotStateData {
  state: string;
  accountId: string | null;
  providerId: string | null;
  providerConfig: unknown | null;
  webview: HTMLElement | null;
  webviewRegistered: boolean;
  domReady: boolean;
  currentUrl: string | null;
  urlExcluded: boolean;
  trafficStarted: boolean;
  correlationId: string | null;
  error: Error | null;
  lastActivity: number;
}

const createSlotState = (): SlotStateData => ({
  state: SlotState.EMPTY,
  accountId: null,
  providerId: null,
  providerConfig: null,
  webview: null,
  webviewRegistered: false,
  domReady: false,
  currentUrl: null,
  urlExcluded: false,
  trafficStarted: false,
  correlationId: null,
  error: null,
  lastActivity: Date.now(),
});

// ============================================
// ============================================
class SlotControllerClass {
  _slots: Record<string, any>;
  _listeners: ((...args: any[]) => void)[];
  _initialized: boolean;
  _boundLog: typeof this._log;
  _boundEmit: typeof this._emit;
  _boundTransition: typeof this._transition;

  constructor() {
    this._slots = {
      ai0: createSlotState(), // Asistan slotu
      ai1: createSlotState(),
      ai2: createSlotState(),
    };
    this._listeners = [];
    this._initialized = false;
    
    this._boundLog = this._log.bind(this);
    this._boundEmit = this._emit.bind(this);
    this._boundTransition = this._transition.bind(this);
  }

  // ============================================
  // ============================================
  
  async init() {
    if (this._initialized) return;
    
    SettingsManager.subscribe(({ settings, changedPaths }: { settings: unknown; changedPaths: string[] }) => {
      handleSettingsChange(this._slots, settings as any, changedPaths, ((slot: string, s: SlotStateData) => {
        this._syncSlotWithSettings(slot, s);
      }) as any);
    });
    
    const settings = SettingsManager.getSnapshot();
    syncWithSettings(this._slots, settings as any, ((slot: string, s: SlotStateData) => {
      this._syncSlotWithSettings(slot, s);
    }) as any);
    
    this._initialized = true;
    LogManager.addEvent("slot-controller", "info", "SlotController initialized");
  }

  // ============================================
  // ============================================

  getState(slot: string) {
    if (!this._isValidSlot(slot)) return null;
    return { ...this._slots[slot] };
  }

  isConnected(slot: string) {
    if (!this._isValidSlot(slot)) return false;
    return this._slots[slot].state === SlotState.CONNECTED;
  }

  isAssigned(slot: string) {
    if (!this._isValidSlot(slot)) return false;
    return this._slots[slot].state !== SlotState.EMPTY;
  }

  isTransitioning(slot: string) {
    if (!this._isValidSlot(slot)) return false;
    const state = this._slots[slot].state;
    return state === SlotState.CONNECTING || state === SlotState.DISCONNECTING;
  }

  isUrlExcluded(slot: string) {
    if (!this._isValidSlot(slot)) return false;
    return this._slots[slot].urlExcluded;
  }

  getProviderId(slot: string) {
    if (!this._isValidSlot(slot)) return null;
    return this._slots[slot].providerId;
  }

  getWebview(slot: string) {
    if (!this._isValidSlot(slot)) return null;
    return this._slots[slot].webview;
  }

  // ============================================
  // ============================================

  registerWebview(slot: string, webview: HTMLElement) {
    if (!this._isValidSlot(slot) || !webview) return;
    
    const slotState = this._slots[slot];
    slotState.webview = webview;
    slotState.webviewRegistered = true;
    slotState.lastActivity = Date.now();
    
    this._log(slot, "info", "Webview registered");
    this._emit(slot, SlotEvent.WEBVIEW_REGISTERED, { webview });
  }

  unregisterWebview(slot: string) {
    if (!this._isValidSlot(slot)) return;
    
    const slotState = this._slots[slot];
    
    if (slotState.state === SlotState.CONNECTED) {
      this.disconnect(slot, { force: true });
    }
    
    slotState.webview = null;
    slotState.webviewRegistered = false;
    slotState.domReady = false;
    
    this._log(slot, "info", "Webview unregistered");
    this._emit(slot, SlotEvent.WEBVIEW_DETACHED, {});
  }

  recoverFromError(slot: string) {
    if (!this._isValidSlot(slot)) {
      return { success: false, message: "invalid-slot" };
    }

    const slotState = this._slots[slot];
    
    if (slotState.state !== SlotState.ERROR) {
      return { success: false, message: "not-in-error-state" };
    }

    this._log(slot, "info", "Manual recovery from ERROR state");
    slotState.error = null;
    
    if (slotState.accountId) {
      this._transition(slot, SlotState.ASSIGNED);
    } else {
      this._transition(slot, SlotState.EMPTY);
    }

    return { success: true, message: "recovered" };
  }

  // ============================================
  // ============================================

  async connect(slot: string, options: { force?: boolean; url?: string; correlationId?: string } = {}) {
    if (!this._isValidSlot(slot)) {
      return { success: false, message: "invalid-slot" };
    }

    const slotState = this._slots[slot];
    const correlationId = this._generateCorrelationId(slot, "connect");
    
    this._log(slot, "info", `Connect requested`, { correlationId });

    if (slotState.state === SlotState.EMPTY) {
      this._log(slot, "warning", "Cannot connect: no account assigned", { correlationId });
      return { success: false, message: "no-account-assigned", correlationId };
    }

    if (slotState.state === SlotState.CONNECTED && !options.force) {
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

    if (slotState.state === SlotState.CONNECTED && options.force) {
      this._log(slot, "info", "Force reconnect - disconnecting first", { correlationId });
      await this.disconnect(slot, { force: true });
    }

    if (!slotState.webview) {
      this._log(slot, "error", "Cannot connect: webview not registered", { correlationId });
      return { success: false, message: "webview-not-registered", correlationId };
    }

    // URL override desteği (OpenCode gibi dinamik URL gerektiren provider'lar için)
    if (options.url) {
      slotState._overrideUrl = options.url;
      this._log(slot, "debug", `URL override set: ${options.url}`, { correlationId });
    }

    slotState.correlationId = correlationId;
    this._transition(slot, SlotState.CONNECTING);
    this._emit(slot, SlotEvent.CONNECT_START, { correlationId });

    startTimeout(slot, "connect", CONFIG.connectTimeoutMs, () => {
      handleConnectTimeout(
        slotState, slot, correlationId, SlotState.ERROR,
        this._boundLog, this._boundEmit, this._boundTransition,
        SlotEvent.CONNECT_FAILED,
        (s, cid) => this._cleanupAfterError(s, cid)
      );
    });

    try {
      await attachWebview(slotState, slot, correlationId, this._boundLog, this._boundEmit, SlotEvent.WEBVIEW_ATTACHED);

      await waitForDomReady(slotState, slot, correlationId, this._boundLog);
      slotState.domReady = true;
      this._emit(slot, SlotEvent.WEBVIEW_DOM_READY, { correlationId });

      await this._delay(CONFIG.urlCheckDelayMs);
      const currentUrl = getCurrentUrl(slotState);
      slotState.currentUrl = currentUrl;
      
      const isExcluded = checkUrlExclusion(slotState, currentUrl);
      slotState.urlExcluded = isExcluded;

      if (isExcluded) {
        this._emit(slot, SlotEvent.URL_EXCLUDED, { url: currentUrl, correlationId });
        this._log(slot, "info", `URL excluded: ${currentUrl} - traffic disabled`, { correlationId });
      } else {
        this._emit(slot, SlotEvent.URL_INCLUDED, { url: currentUrl, correlationId });
        await this._startTraffic(slot, correlationId);
      }

      setupUrlChangeHandler(slotState, slot, correlationId, (s: string, url: string) => {
        this._handleUrlChange(s, url);
      });

      clearTimeout(slot, "connect");
      this._transition(slot, SlotState.CONNECTED);
      this._emit(slot, SlotEvent.CONNECT_COMPLETE, { correlationId, urlExcluded: isExcluded });

      const elapsed = Date.now() - slotState.lastActivity;
      this._log(slot, "success", `Connected successfully (${elapsed}ms)${isExcluded ? " [URL excluded]" : ""}`, { correlationId });

      return { success: true, message: "connected", correlationId };
    } catch (error) {
      clearTimeout(slot, "connect");
      return handleConnectError(
        slotState, slot, correlationId, error, SlotState.ERROR,
        this._boundLog, this._boundEmit, this._boundTransition,
        SlotEvent.CONNECT_FAILED,
        (s, cid) => this._cleanupAfterError(s, cid)
      );
    }
  }

  async disconnect(slot: string, options: { force?: boolean } = {}) {
    if (!this._isValidSlot(slot)) {
      return { success: false, message: "invalid-slot" };
    }

    const slotState = this._slots[slot];
    const correlationId = this._generateCorrelationId(slot, "disconnect");

    this._log(slot, "info", "Disconnect requested", { correlationId });

    if (slotState.state === SlotState.EMPTY) {
      return { success: true, message: "not-assigned", correlationId };
    }

    if (slotState.state === SlotState.ASSIGNED && !options.force) {
      return { success: true, message: "already-disconnected", correlationId };
    }

    if (slotState.state === SlotState.DISCONNECTING) {
      return { success: false, message: "disconnect-in-progress", correlationId };
    }

    this._transition(slot, SlotState.DISCONNECTING);
    this._emit(slot, SlotEvent.DISCONNECT_START, { correlationId });

    try {
      clearUrlChangeHandler(slot);

      if (slotState.trafficStarted) {
        await this._stopTraffic(slot, correlationId);
      }

      await detachWebview(slotState, slot, correlationId, this._boundLog, this._boundEmit, SlotEvent.WEBVIEW_DETACHED);

      slotState.domReady = false;
      slotState.currentUrl = null;
      slotState.urlExcluded = false;
      slotState.trafficStarted = false;
      slotState.correlationId = null;
      slotState.error = null;

      this._transition(slot, SlotState.ASSIGNED);
      this._emit(slot, SlotEvent.DISCONNECT_COMPLETE, { correlationId });

      this._log(slot, "success", "Disconnected successfully", { correlationId });
      return { success: true, message: "disconnected", correlationId };
    } catch (error) {
      slotState.domReady = false;
      slotState.trafficStarted = false;
      this._transition(slot, SlotState.ASSIGNED);
      
      this._log(slot, "warning", `Disconnect completed with errors: ${error.message}`, { correlationId });
      return { success: true, message: "disconnected-with-errors", correlationId };
    }
  }

  // ============================================
  // ============================================

  navigate(slot: string, url: string | null = null) {
    if (!this._isValidSlot(slot)) return;
    
    navigateWebview(
      this._slots[slot], slot, url, SlotState.CONNECTED,
      this._boundLog, this._boundEmit, SlotEvent.WEBVIEW_NAVIGATED
    );
  }

  // ============================================
  // ============================================

  subscribe(listener: (payload: unknown) => void) {
    if (typeof listener === "function") {
      this._listeners.push(listener);
    }
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  on(eventType: string, listener: (payload: { event?: string; slot?: string }) => void) {
    const wrapper = (payload: { event?: string; slot?: string }) => {
      if (payload.event === eventType) {
        listener(payload);
      }
    };
    wrapper._original = listener;
    wrapper._eventType = eventType;
    this._listeners.push(wrapper);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== wrapper);
    };
  }

  // ============================================
  // ============================================

  _syncSlotWithSettings(slot: string, settings: SlotStateData) {
    syncSlotWithSettings(
      this._slots[slot], slot, settings as any,
      { EMPTY: SlotState.EMPTY, ASSIGNED: SlotState.ASSIGNED, CONNECTED: SlotState.CONNECTED, CONNECTING: SlotState.CONNECTING },
      { ACCOUNT_ASSIGNED: SlotEvent.ACCOUNT_ASSIGNED, ACCOUNT_REMOVED: SlotEvent.ACCOUNT_REMOVED },
      this._boundLog, this._boundTransition, this._boundEmit,
      (s: string, opts: { force?: boolean }) => this.disconnect(s, opts),
      (s: string) => this.navigate(s)
    );
  }

  // ============================================
  // ============================================

  _handleUrlChange(slot: string, newUrl: string) {
    handleUrlChange(
      this._slots[slot], slot as SlotId, newUrl, SlotState.CONNECTED,
      this._boundLog, this._boundEmit,
      { URL_CHANGED: SlotEvent.URL_CHANGED, URL_EXCLUDED: SlotEvent.URL_EXCLUDED, URL_INCLUDED: SlotEvent.URL_INCLUDED },
      (s: SlotId, cid: string) => this._startTraffic(s, cid),
      (s: SlotId, cid: string) => this._stopTraffic(s, cid)
    );
  }

  // ============================================
  // ============================================

  async _startTraffic(slot: string, correlationId: string) {
    const slotState = this._slots[slot];
    if (!slotState.webview || slotState.trafficStarted) return;

    try {
      slotState.trafficStarted = true;
      this._emit(slot, SlotEvent.TRAFFIC_STARTED, { correlationId });
      this._log(slot, "debug", "Traffic started", { correlationId });
    } catch (err) {
      this._log(slot, "warning", `Traffic start warning: ${err.message}`, { correlationId });
    }
  }

  async _stopTraffic(slot: string, correlationId: string) {
    const slotState = this._slots[slot];
    if (!slotState.trafficStarted) return;

    try {
      slotState.trafficStarted = false;
      this._emit(slot, SlotEvent.TRAFFIC_STOPPED, { correlationId });
      this._log(slot, "debug", "Traffic stopped", { correlationId });
    } catch (err) {
      this._log(slot, "warning", `Traffic stop warning: ${err.message}`, { correlationId });
    }
  }

  // ============================================
  // ============================================

  async _cleanupAfterError(slot: string, correlationId: string) {
    await cleanupAfterError(
      this._slots[slot], slot, correlationId,
      this._boundLog,
      clearUrlChangeHandler,
      clearDomReadyHandler,
      (s: string, cid: string) => this._stopTraffic(s, cid),
      (s: string, cid: string) => detachWebview(this._slots[s], s as SlotId, cid, this._boundLog, this._boundEmit, SlotEvent.WEBVIEW_DETACHED)
    );
  }

  // ============================================
  // ============================================

  _transition(slot: string, newState: string) {
    const slotState = this._slots[slot];
    const oldState = slotState.state;
    
    if (oldState === newState) return;
    
    slotState.state = newState;
    slotState.lastActivity = Date.now();
    
    this._log(slot, "debug", `State: ${oldState} → ${newState}`);
    this._emit(slot, SlotEvent.STATE_CHANGED, { oldState, newState });
  }

  // ============================================
  // ============================================

  _isValidSlot(slot: string) {
    return slot === "ai0" || slot === "ai1" || slot === "ai2";
  }

  _generateCorrelationId(slot: string, operation: string) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `${slot}-${operation}-${timestamp}-${random}`;
  }

  _emit(slot: string, event: string, data: Record<string, unknown> = {}) {
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
      } catch (_err) {
      }
    });
  }

  _log(slot: string, level: string, message: string, context: { correlationId?: string } = {}) {
    const prefix = context.correlationId ? `[${context.correlationId}] ` : "";
    LogManager.addEvent(`slot-${slot}`, level, `${prefix}${message}`);
  }

  _delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const SlotController = new SlotControllerClass();
