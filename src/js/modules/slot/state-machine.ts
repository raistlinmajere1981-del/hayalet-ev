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

import { Logger } from "../logger/index.js";
import { MAX_HISTORY_SIZE } from "@limits";
import { LogCategory, LogLevel } from "@shared/index.js";

const slotStates = {
  EMPTY: "empty",
  ASSIGNED: "assigned",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTING: "disconnecting",
  ERROR: "error",
} as const;

export { slotStates as SlotStates };

export type SlotStateType = (typeof slotStates)[keyof typeof slotStates];

const ALLOWED_TRANSITIONS: Record<SlotStateType, SlotStateType[]> = {
  [slotStates.EMPTY]: [
    slotStates.ASSIGNED, // Account atandığında
  ],
  [slotStates.ASSIGNED]: [
    slotStates.EMPTY, // Account kaldırıldığında
    slotStates.CONNECTING, // Bağlantı başlatıldığında
    slotStates.ERROR, // Hata durumunda
  ],
  [slotStates.CONNECTING]: [
    slotStates.CONNECTED, // Bağlantı başarılı
    slotStates.ASSIGNED, // Bağlantı iptal edildi
    slotStates.ERROR, // Bağlantı hatası
    slotStates.DISCONNECTING, // Force disconnect during connect
  ],
  [slotStates.CONNECTED]: [
    slotStates.DISCONNECTING, // Normal disconnect
    slotStates.ERROR, // Bağlantı koptu
    slotStates.CONNECTING, // Force reconnect
  ],
  [slotStates.DISCONNECTING]: [
    slotStates.ASSIGNED, // Disconnect tamamlandı
    slotStates.EMPTY, // Account da kaldırıldı
    slotStates.ERROR, // Disconnect hatası
  ],
  [slotStates.ERROR]: [
    slotStates.EMPTY, // Account kaldırıldı
    slotStates.ASSIGNED, // Recovery (manuel veya otomatik)
    slotStates.CONNECTING, // Retry connection
  ],
};

interface StateHistoryEntry {
  fromState: SlotStateType;
  toState: SlotStateType;
  timestamp: number;
  correlationId?: string;
  reason?: string;
}

export class SlotStateMachine {
  private _slotId: string;
  private _currentState: SlotStateType;
  private _history: StateHistoryEntry[];
  private _onTransitionCallbacks: Array<
    (from: SlotStateType, to: SlotStateType, context?: TransitionContext) => void
  >;

  constructor(slotId: string, initialState: SlotStateType = slotStates.EMPTY) {
    this._slotId = slotId;
    this._currentState = initialState;
    this._history = [];
    this._onTransitionCallbacks = [];
  }

  get state(): SlotStateType {
    return this._currentState;
  }

  get history(): readonly StateHistoryEntry[] {
    return this._history;
  }

  canTransitionTo(targetState: SlotStateType): boolean {
    const allowedTargets = ALLOWED_TRANSITIONS[this._currentState];
    return allowedTargets.includes(targetState);
  }

  getAvailableTransitions(): SlotStateType[] {
    return ALLOWED_TRANSITIONS[this._currentState];
  }

  /**
   * State geçişi yap
   * @returns true eğer geçiş başarılı, false eğer geçersiz
   */
  transition(targetState: SlotStateType, context?: TransitionContext): TransitionResult {
    const fromState = this._currentState;

    if (fromState === targetState) {
      Logger.debug(LogCategory.SLOT, `No-op transition: ${fromState} → ${targetState}`, {
        slotId: this._slotId,
        state: targetState,
        correlationId: context?.correlationId,
      });

      return {
        success: true,
        fromState,
        toState: targetState,
        wasNoOp: true,
      };
    }

    if (!this.canTransitionTo(targetState)) {
      const error = `Invalid transition: ${fromState} → ${targetState}. Allowed: [${this.getAvailableTransitions().join(", ")}]`;

      Logger.debug(LogCategory.SLOT, error, {
        slotId: this._slotId,
        fromState,
        toState: targetState,
        allowedTransitions: this.getAvailableTransitions(),
        correlationId: context?.correlationId,
      });

      return {
        success: false,
        fromState,
        toState: targetState,
        error,
      };
    }

    if (context?.guard && !context.guard(fromState, targetState)) {
      const error = `Transition guard rejected: ${fromState} → ${targetState}`;

      Logger.debug(LogCategory.SLOT, error, {
        slotId: this._slotId,
        fromState,
        toState: targetState,
        correlationId: context.correlationId,
      });

      return {
        success: false,
        fromState,
        toState: targetState,
        error,
        guardRejected: true,
      };
    }

    this._currentState = targetState;

    const historyEntry: StateHistoryEntry = {
      fromState,
      toState: targetState,
      timestamp: Date.now(),
      ...(context?.correlationId !== undefined && context.correlationId !== ""
        ? { correlationId: context.correlationId }
        : {}),
      ...(context?.reason !== undefined && context.reason !== "" ? { reason: context.reason } : {}),
    };
    this._history.unshift(historyEntry);

    if (this._history.length > MAX_HISTORY_SIZE) {
      this._history.pop();
    }

    Logger.panel(
      LogCategory.SLOT,
      LogLevel.INFO,
      `${this._slotId}: ${fromState} → ${targetState}${
        context?.reason !== undefined && context.reason !== "" ? ` (${context.reason})` : ""
      }`,
      {
        slotId: this._slotId,
        fromState,
        toState: targetState,
        reason: context?.reason,
        correlationId: context?.correlationId,
        timestamp: Date.now(),
      }
    );

    for (const callback of this._onTransitionCallbacks) {
      try {
        callback(fromState, targetState, context);
      } catch (err) {
        Logger.debug(LogCategory.SLOT, err instanceof Error ? err.message : String(err), {
          slotId: this._slotId,
          fromState,
          toState: targetState,
          operation: "transition-callback",
          correlationId: context?.correlationId,
        });
      }
    }

    if (context?.sideEffect) {
      try {
        context.sideEffect(fromState, targetState);
      } catch (err) {
        Logger.debug(LogCategory.SLOT, err instanceof Error ? err.message : String(err), {
          slotId: this._slotId,
          fromState,
          toState: targetState,
          operation: "side-effect",
          correlationId: context.correlationId,
        });
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
      this._onTransitionCallbacks = this._onTransitionCallbacks.filter((cb) => cb !== callback);
    };
  }

  reset(initialState: SlotStateType = slotStates.EMPTY): void {
    this._currentState = initialState;
    this._history = [];
  }

  is(state: SlotStateType): boolean {
    return this._currentState === state;
  }

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

export function createSlotStateMachine(
  slotId: string,
  initialState?: SlotStateType
): SlotStateMachine {
  return new SlotStateMachine(slotId, initialState);
}
