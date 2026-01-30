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
import { getErrorMessage } from "../types/index.js";
import type { SlotId } from "../types/index.js";
import type { 
  SlotStateMachine} from "./slot/state-machine.js";
import { 
  SlotStates, 
  createSlotStateMachine,
  type SlotStateType,
  type TransitionResult,
} from "./slot/state-machine.js";

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
/**
 * Webview element tipi (slot modülleriyle uyumlu)
 */
type WebviewElement = HTMLElement & {
  getURL?: () => string;
  loadURL?: (url: string) => Promise<void>;
  isLoading?: () => boolean;
  src: string;
};

/**
 * Slot state - tüm slot modülleriyle uyumlu birleşik interface
 */
interface SlotStateData {
  state: string;
  stateMachine: SlotStateMachine; // Robust state machine
  accountId: string | null;
  providerId: string | null;
  providerConfig: unknown | null;
  webview: WebviewElement | null;
  webviewRegistered: boolean;
  domReady: boolean;
  currentUrl: string;
  urlExcluded: boolean;
  trafficStarted: boolean;
  correlationId: string;
  error: Error | null;
  lastActivity: number;
  // Webview handler için
  _overrideUrl?: string;
  _pendingLoad?: boolean;
  _targetUrl?: string;
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

// ============================================
// ============================================
class SlotControllerClass {
  _slots: Record<string, SlotStateData>;
  _listeners: ((...args: unknown[]) => void)[];
  _initialized: boolean;
  _boundLog: typeof this._log;
  _boundEmit: typeof this._emit;
  _boundTransition: typeof this._transition;

  constructor() {
    this._slots = {
      ai0: createSlotState("ai0"), // Asistan slotu
      ai1: createSlotState("ai1"),
      ai2: createSlotState("ai2"),
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
      handleSettingsChange(this._slots as any, settings as any, changedPaths, ((slot: string, s: SlotStateData) => {
        this._syncSlotWithSettings(slot, s);
      }) as any);
    });
    
    const settings = SettingsManager.getSnapshot();
    syncWithSettings(this._slots as any, settings as any, ((slot: string, s: SlotStateData) => {
      this._syncSlotWithSettings(slot, s);
    }) as any);
    
    this._initialized = true;
    LogManager.addEvent("slot-controller", "info", "SlotController initialized", { visibility: 2 });
  }

  // ============================================
  // ============================================

  /**
   * Type-safe slot accessor with null check
   */
  private _getSlot(slot: string): SlotStateData | null {
    if (!this._isValidSlot(slot)) return null;
    return this._slots[slot] ?? null;
  }

  getState(slot: string) {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return { ...slotData };
  }

  isConnected(slot: string) {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    return slotData.state === SlotState.CONNECTED;
  }

  isAssigned(slot: string) {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    return slotData.state !== SlotState.EMPTY;
  }

  isTransitioning(slot: string) {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    const state = slotData.state;
    return state === SlotState.CONNECTING || state === SlotState.DISCONNECTING;
  }

  isUrlExcluded(slot: string) {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    return slotData.urlExcluded;
  }

  getProviderId(slot: string) {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return slotData.providerId;
  }

  getWebview(slot: string) {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return slotData.webview;
  }

  // ============================================
  // ============================================

  registerWebview(slot: string, webview: HTMLElement) {
    const slotState = this._getSlot(slot);
    if (!slotState || !webview) return;
    
    // Zaten aynı webview register edilmişse tekrar log yazma
    if (slotState.webviewRegistered && slotState.webview === webview) {
      return; // Çift register'u önle
    }
    
    slotState.webview = webview as any;
    slotState.webviewRegistered = true;
    slotState.lastActivity = Date.now();
    
    this._log(slot, "info", "Webview registered");
    this._emit(slot, SlotEvent.WEBVIEW_REGISTERED, { webview });
  }

  unregisterWebview(slot: string) {
    const slotState = this._getSlot(slot);
    if (!slotState) return;
    
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
    const slotState = this._getSlot(slot);
    if (!slotState) {
      return { success: false, message: "invalid-slot" };
    }
    
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
    
    // State transition - başarısız olursa devam etme
    const transitionResult = this._transition(slot, SlotState.CONNECTING);
    if (!transitionResult.success) {
      this._log(slot, "error", `Invalid state transition blocked: ${slotState.state} → connecting. ${transitionResult.error}`, { correlationId });
      return { success: false, message: "invalid-state-transition", correlationId, error: transitionResult.error };
    }
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
      await attachWebview(slotState as any, slot as SlotId, correlationId, this._boundLog, this._boundEmit, SlotEvent.WEBVIEW_ATTACHED);

      await waitForDomReady(slotState as any, slot as SlotId, correlationId, this._boundLog);
      slotState.domReady = true;
      this._emit(slot, SlotEvent.WEBVIEW_DOM_READY, { correlationId });

      await this._delay(CONFIG.urlCheckDelayMs);
      const currentUrl = getCurrentUrl(slotState as any);
      slotState.currentUrl = currentUrl;
      
      const isExcluded = checkUrlExclusion(slotState as any, currentUrl);
      slotState.urlExcluded = isExcluded;

      if (isExcluded) {
        this._emit(slot, SlotEvent.URL_EXCLUDED, { url: currentUrl, correlationId });
        this._log(slot, "info", `URL excluded: ${currentUrl} - traffic disabled`, { correlationId });
      } else {
        this._emit(slot, SlotEvent.URL_INCLUDED, { url: currentUrl, correlationId });
        await this._startTraffic(slot, correlationId);
      }

      setupUrlChangeHandler(slotState as any, slot as SlotId, correlationId, (s: string, url: string) => {
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

  async disconnect(slot: string, _options: { force?: boolean } = {}) {
    const slotState = this._getSlot(slot);
    if (!slotState) {
      return { success: false, message: "invalid-slot" };
    }

    const correlationId = this._generateCorrelationId(slot, "disconnect");

    this._log(slot, "info", "Disconnect requested", { correlationId });

    if (slotState.state === SlotState.EMPTY) {
      return { success: true, message: "not-assigned", correlationId };
    }

    // ASSIGNED durumunda zaten bağlı değil - disconnect gereksiz
    // force=true olsa bile ASSIGNED'dan DISCONNECTING'e geçiş geçersiz
    if (slotState.state === SlotState.ASSIGNED) {
      this._log(slot, "debug", "Already disconnected (ASSIGNED state)", { correlationId });
      return { success: true, message: "already-disconnected", correlationId };
    }

    if (slotState.state === SlotState.DISCONNECTING) {
      return { success: false, message: "disconnect-in-progress", correlationId };
    }

    // State transition - başarısız olursa devam etme
    const transitionResult = this._transition(slot, SlotState.DISCONNECTING);
    if (!transitionResult.success) {
      this._log(slot, "error", `Invalid state transition blocked: ${slotState.state} → disconnecting. ${transitionResult.error}`, { correlationId });
      return { success: false, message: "invalid-state-transition", correlationId, error: transitionResult.error };
    }
    this._emit(slot, SlotEvent.DISCONNECT_START, { correlationId });

    try {
      clearUrlChangeHandler(slot as SlotId);

      if (slotState.trafficStarted) {
        await this._stopTraffic(slot, correlationId);
      }

      await detachWebview(slotState as any, slot as SlotId, correlationId, this._boundLog, this._boundEmit, SlotEvent.WEBVIEW_DETACHED);

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
      
      this._log(slot, "warning", `Disconnect completed with errors: ${getErrorMessage(error)}`, { correlationId });
      return { success: true, message: "disconnected-with-errors", correlationId };
    }
  }

  // ============================================
  // ============================================

  navigate(slot: string, url: string | null = null) {
    const slotState = this._getSlot(slot);
    if (!slotState) return;
    
    navigateWebview(
      slotState as any, slot as SlotId, url, SlotState.CONNECTED,
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
    const wrapper = ((payload: any) => {
      if (payload && typeof payload === 'object' && payload.event === eventType) {
        listener(payload);
      }
    }) as any;
    
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
    const slotState = this._getSlot(slot);
    if (!slotState) return;
    
    syncSlotWithSettings(
      slotState as any, slot, settings as any,
      { EMPTY: SlotState.EMPTY, ASSIGNED: SlotState.ASSIGNED, CONNECTED: SlotState.CONNECTED, CONNECTING: SlotState.CONNECTING },
      { ACCOUNT_ASSIGNED: SlotEvent.ACCOUNT_ASSIGNED, ACCOUNT_REMOVED: SlotEvent.ACCOUNT_REMOVED },
      this._boundLog, this._boundTransition, this._boundEmit,
      (s: string, opts?: { force?: boolean }) => this.disconnect(s, opts),
      (s: string) => this.navigate(s)
    );
  }

  // ============================================
  // ============================================

  _handleUrlChange(slot: string, newUrl: string) {
    const slotState = this._getSlot(slot);
    if (!slotState) return;
    
    handleUrlChange(
      slotState as any, slot as SlotId, newUrl, SlotState.CONNECTED,
      this._boundLog, this._boundEmit,
      { URL_CHANGED: SlotEvent.URL_CHANGED, URL_EXCLUDED: SlotEvent.URL_EXCLUDED, URL_INCLUDED: SlotEvent.URL_INCLUDED },
      (s: SlotId, cid: string) => this._startTraffic(s as string, cid),
      (s: SlotId, cid: string) => this._stopTraffic(s as string, cid)
    );
  }

  // ============================================
  // ============================================

  async _startTraffic(slot: string, correlationId: string) {
    const slotState = this._getSlot(slot);
    if (!slotState || !slotState.webview || slotState.trafficStarted) return;

    try {
      slotState.trafficStarted = true;
      this._emit(slot, SlotEvent.TRAFFIC_STARTED, { correlationId });
      this._log(slot, "debug", "Traffic started", { correlationId });
    } catch (err) {
      this._log(slot, "warning", `Traffic start warning: ${getErrorMessage(err)}`, { correlationId });
    }
  }

  async _stopTraffic(slot: string, correlationId: string) {
    const slotState = this._getSlot(slot);
    if (!slotState || !slotState.trafficStarted) return;

    try {
      slotState.trafficStarted = false;
      this._emit(slot, SlotEvent.TRAFFIC_STOPPED, { correlationId });
      this._log(slot, "debug", "Traffic stopped", { correlationId });
    } catch (err) {
      this._log(slot, "warning", `Traffic stop warning: ${getErrorMessage(err)}`, { correlationId });
    }
  }

  // ============================================
  // ============================================

  async _cleanupAfterError(slot: string, correlationId: string) {
    const slotState = this._getSlot(slot);
    if (!slotState) return;
    
    await cleanupAfterError(
      slotState as any, slot as SlotId, correlationId,
      this._boundLog,
      (s: string) => clearUrlChangeHandler(s as SlotId),
      (s: string) => clearDomReadyHandler(s as SlotId),
      (s: string, cid: string) => this._stopTraffic(s, cid),
      async (s: string, cid: string) => {
        const innerSlot = this._getSlot(s);
        if (innerSlot) {
          await detachWebview(innerSlot as any, s as SlotId, cid, this._boundLog, this._boundEmit, SlotEvent.WEBVIEW_DETACHED as string);
        }
      }
    );
  }

  // ============================================
  // ============================================

  /**
   * State transition with validation
   * @returns TransitionResult with success status and details
   */
  _transition(slot: string, newState: string, reason?: string): TransitionResult {
    const slotState = this._getSlot(slot);
    if (!slotState) {
      return { success: false, error: "invalid-slot", fromState: "unknown" as SlotStateType, toState: newState as SlotStateType };
    }
    
    const oldState = slotState.state;
    
    // State machine ile geçerlilik kontrolü ve geçiş
    const result = slotState.stateMachine.transition(
      newState as SlotStateType,
      {
        correlationId: slotState.correlationId || undefined,
        reason,
      }
    );
    
    if (result.success) {
      // Legacy state alanını da güncelle (backward compatibility)
      slotState.state = newState;
      slotState.lastActivity = Date.now();
      
      if (!result.wasNoOp) {
        this._emit(slot, SlotEvent.STATE_CHANGED, { 
          oldState, 
          newState,
          validated: true,
        });
      }
    } else {
      // Geçersiz transition - hata logla ama crash etme
      this._log(slot, "error", `Invalid state transition blocked: ${oldState} → ${newState}. ${result.error}`);
    }
    
    return result;
  }

  /**
   * State machine üzerinden mevcut state'i al
   */
  getStateMachineState(slot: string): SlotStateType | null {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return slotData.stateMachine.state;
  }

  /**
   * State machine debug bilgisini al
   */
  getStateMachineDebugInfo(slot: string) {
    const slotData = this._getSlot(slot);
    if (!slotData) return null;
    return slotData.stateMachine.getDebugInfo();
  }

  /**
   * Belirli bir state'e geçiş yapılabilir mi kontrol et
   */
  canTransitionTo(slot: string, targetState: string): boolean {
    const slotData = this._getSlot(slot);
    if (!slotData) return false;
    return slotData.stateMachine.canTransitionTo(targetState as SlotStateType);
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
