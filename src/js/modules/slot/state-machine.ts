/**
 * Slot State Machine - Robust State Management
 * 
 * Bu modül SlotController için type-safe ve validasyonlu state machine sağlar.
 * Geçersiz state transition'larını engeller ve debugging için history tutar.
 * 
 * Features:
 * - Type-safe state ve event tanımları
 * - Transition validation (izin verilen geçişler)
 * - State history tracking
 * - Guard conditions (koşullu geçişler)
 * - Side effects (geçiş sonrası aksiyonlar)
 */

import { LogManager } from "../log-manager.js";

// ============================================================================
// State Definitions
// ============================================================================

/**
 * Slot durumları
 */
export const SlotStates = {
  EMPTY: "empty",
  ASSIGNED: "assigned", 
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTING: "disconnecting",
  ERROR: "error",
} as const;

export type SlotStateType = typeof SlotStates[keyof typeof SlotStates];

// ============================================================================
// Transition Definitions
// ============================================================================

/**
 * İzin verilen state transition'ları
 * Format: [fromState]: [toState1, toState2, ...]
 */
const ALLOWED_TRANSITIONS: Record<SlotStateType, SlotStateType[]> = {
  [SlotStates.EMPTY]: [
    SlotStates.ASSIGNED,  // Account atandığında
  ],
  [SlotStates.ASSIGNED]: [
    SlotStates.EMPTY,       // Account kaldırıldığında
    SlotStates.CONNECTING,  // Bağlantı başlatıldığında
    SlotStates.ERROR,       // Hata durumunda
  ],
  [SlotStates.CONNECTING]: [
    SlotStates.CONNECTED,     // Bağlantı başarılı
    SlotStates.ASSIGNED,      // Bağlantı iptal edildi
    SlotStates.ERROR,         // Bağlantı hatası
    SlotStates.DISCONNECTING, // Force disconnect during connect
  ],
  [SlotStates.CONNECTED]: [
    SlotStates.DISCONNECTING, // Normal disconnect
    SlotStates.ERROR,         // Bağlantı koptu
    SlotStates.CONNECTING,    // Force reconnect
  ],
  [SlotStates.DISCONNECTING]: [
    SlotStates.ASSIGNED,  // Disconnect tamamlandı
    SlotStates.EMPTY,     // Account da kaldırıldı
    SlotStates.ERROR,     // Disconnect hatası
  ],
  [SlotStates.ERROR]: [
    SlotStates.EMPTY,     // Account kaldırıldı
    SlotStates.ASSIGNED,  // Recovery (manuel veya otomatik)
    SlotStates.CONNECTING, // Retry connection
  ],
};

// ============================================================================
// State History
// ============================================================================

interface StateHistoryEntry {
  fromState: SlotStateType;
  toState: SlotStateType;
  timestamp: number;
  correlationId?: string;
  reason?: string;
}

const MAX_HISTORY_SIZE = 50;

// ============================================================================
// State Machine Class
// ============================================================================

export class SlotStateMachine {
  private _slotId: string;
  private _currentState: SlotStateType;
  private _history: StateHistoryEntry[];
  private _onTransitionCallbacks: Array<(from: SlotStateType, to: SlotStateType, context?: TransitionContext) => void>;

  constructor(slotId: string, initialState: SlotStateType = SlotStates.EMPTY) {
    this._slotId = slotId;
    this._currentState = initialState;
    this._history = [];
    this._onTransitionCallbacks = [];
  }

  /**
   * Mevcut state'i döndür
   */
  get state(): SlotStateType {
    return this._currentState;
  }

  /**
   * State history'yi döndür
   */
  get history(): readonly StateHistoryEntry[] {
    return this._history;
  }

  /**
   * Belirli bir state'e geçiş yapılabilir mi kontrol et
   */
  canTransitionTo(targetState: SlotStateType): boolean {
    const allowedTargets = ALLOWED_TRANSITIONS[this._currentState];
    return allowedTargets?.includes(targetState) ?? false;
  }

  /**
   * Mevcut state'den geçilebilecek tüm state'leri döndür
   */
  getAvailableTransitions(): SlotStateType[] {
    return ALLOWED_TRANSITIONS[this._currentState] ?? [];
  }

  /**
   * State geçişi yap
   * @returns true eğer geçiş başarılı, false eğer geçersiz
   */
  transition(
    targetState: SlotStateType,
    context?: TransitionContext
  ): TransitionResult {
    const fromState = this._currentState;

    // Aynı state'e geçiş - sessizce başarılı say
    if (fromState === targetState) {
      return {
        success: true,
        fromState,
        toState: targetState,
        wasNoOp: true,
      };
    }

    // Geçerlilik kontrolü
    if (!this.canTransitionTo(targetState)) {
      const error = `Invalid transition: ${fromState} → ${targetState}. Allowed: [${this.getAvailableTransitions().join(", ")}]`;
      
      LogManager.addEvent(
        `slot-${this._slotId}`,
        "error",
        `[StateMachine] ${error}`
      );

      return {
        success: false,
        fromState,
        toState: targetState,
        error,
      };
    }

    // Guard condition kontrolü (varsa)
    if (context?.guard && !context.guard(fromState, targetState)) {
      const error = `Transition guard rejected: ${fromState} → ${targetState}`;
      
      LogManager.addEvent(
        `slot-${this._slotId}`,
        "warning",
        `[StateMachine] ${error}`
      );

      return {
        success: false,
        fromState,
        toState: targetState,
        error,
        guardRejected: true,
      };
    }

    // State'i güncelle
    this._currentState = targetState;

    // History'e ekle
    const historyEntry: StateHistoryEntry = {
      fromState,
      toState: targetState,
      timestamp: Date.now(),
      correlationId: context?.correlationId,
      reason: context?.reason,
    };
    this._history.unshift(historyEntry);
    
    // History boyutunu sınırla
    if (this._history.length > MAX_HISTORY_SIZE) {
      this._history.pop();
    }

    // Log
    LogManager.addEvent(
      `slot-${this._slotId}`,
      "debug",
      `[StateMachine] ${fromState} → ${targetState}${context?.reason ? ` (${context.reason})` : ""}`
    );

    // Callback'leri çağır
    for (const callback of this._onTransitionCallbacks) {
      try {
        callback(fromState, targetState, context);
      } catch (err) {
        LogManager.addEvent(
          `slot-${this._slotId}`,
          "error",
          `[StateMachine] Transition callback error: ${err}`
        );
      }
    }

    // Side effect (varsa)
    if (context?.sideEffect) {
      try {
        context.sideEffect(fromState, targetState);
      } catch (err) {
        LogManager.addEvent(
          `slot-${this._slotId}`,
          "error",
          `[StateMachine] Side effect error: ${err}`
        );
      }
    }

    return {
      success: true,
      fromState,
      toState: targetState,
    };
  }

  /**
   * Transition callback ekle
   * @returns Unsubscribe fonksiyonu
   */
  onTransition(
    callback: (from: SlotStateType, to: SlotStateType, context?: TransitionContext) => void
  ): () => void {
    this._onTransitionCallbacks.push(callback);
    return () => {
      this._onTransitionCallbacks = this._onTransitionCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  /**
   * State machine'i resetle
   */
  reset(initialState: SlotStateType = SlotStates.EMPTY): void {
    this._currentState = initialState;
    this._history = [];
    LogManager.addEvent(
      `slot-${this._slotId}`,
      "info",
      `[StateMachine] Reset to ${initialState}`
    );
  }

  /**
   * State belirli bir değer mi kontrol et
   */
  is(state: SlotStateType): boolean {
    return this._currentState === state;
  }

  /**
   * State verilen değerlerden biri mi kontrol et
   */
  isOneOf(...states: SlotStateType[]): boolean {
    return states.includes(this._currentState);
  }

  /**
   * Debugging için state machine durumunu döndür
   */
  getDebugInfo(): SlotStateMachineDebugInfo {
    return {
      slotId: this._slotId,
      currentState: this._currentState,
      availableTransitions: this.getAvailableTransitions(),
      historyLength: this._history.length,
      lastTransition: this._history[0] ?? null,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

export interface TransitionContext {
  correlationId?: string;
  reason?: string;
  guard?: (from: SlotStateType, to: SlotStateType) => boolean;
  sideEffect?: (from: SlotStateType, to: SlotStateType) => void;
}

export interface TransitionResult {
  success: boolean;
  fromState: SlotStateType;
  toState: SlotStateType;
  error?: string;
  wasNoOp?: boolean;
  guardRejected?: boolean;
}

export interface SlotStateMachineDebugInfo {
  slotId: string;
  currentState: SlotStateType;
  availableTransitions: SlotStateType[];
  historyLength: number;
  lastTransition: StateHistoryEntry | null;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Yeni slot state machine oluştur
 */
export function createSlotStateMachine(
  slotId: string,
  initialState?: SlotStateType
): SlotStateMachine {
  return new SlotStateMachine(slotId, initialState);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * State transition geçerli mi kontrol et (static)
 */
function _isValidTransition(
  fromState: SlotStateType,
  toState: SlotStateType
): boolean {
  const allowedTargets = ALLOWED_TRANSITIONS[fromState];
  return allowedTargets?.includes(toState) ?? false;
}

/**
 * State'in "terminal" olup olmadığını kontrol et
 * Terminal state'ler: kullanıcı müdahalesi gerektiren durumlar
 */
function _isTerminalState(state: SlotStateType): boolean {
  return state === SlotStates.ERROR;
}

/**
 * State'in "transitioning" olup olmadığını kontrol et
 */
export function isTransitioningState(state: SlotStateType): boolean {
  return state === SlotStates.CONNECTING || state === SlotStates.DISCONNECTING;
}

/**
 * State'in "active" olup olmadığını kontrol et (connection var)
 */
function _isActiveState(state: SlotStateType): boolean {
  return state === SlotStates.CONNECTED || state === SlotStates.CONNECTING;
}
