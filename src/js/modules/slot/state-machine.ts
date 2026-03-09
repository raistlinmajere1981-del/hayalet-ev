/**
 * Slot State Machine - Robust State Management
 *
 * Provides a type-safe, validated state machine for SlotController.
 * Prevents invalid state transitions and keeps history for debugging.
 *
 * Features:
 * - Type-safe state and event definitions
 * - Transition validation (allowed transitions)
 * - State history tracking
 * - Guard conditions
 * - Side effects
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
    slotStates.ASSIGNED, // When an account is assigned
  ],
  [slotStates.ASSIGNED]: [
    slotStates.EMPTY, // When the account is removed
    slotStates.CONNECTING, // When a connection starts
    slotStates.ERROR, // On error
  ],
  [slotStates.CONNECTING]: [
    slotStates.CONNECTED, // Connection succeeded
    slotStates.ASSIGNED, // Connection cancelled
    slotStates.ERROR, // Connection error
    slotStates.DISCONNECTING, // Force disconnect during connect
  ],
  [slotStates.CONNECTED]: [
    slotStates.DISCONNECTING, // Normal disconnect
    slotStates.ERROR, // Connection dropped
    slotStates.CONNECTING, // Force reconnect
  ],
  [slotStates.DISCONNECTING]: [
    slotStates.ASSIGNED, // Disconnect completed
    slotStates.EMPTY, // Account was also removed
    slotStates.ERROR, // Disconnect error
  ],
  [slotStates.ERROR]: [
    slotStates.EMPTY, // Account removed
    slotStates.ASSIGNED, // Recovery (manual or automatic)
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
   * Perform a state transition.
   * @returns True if the transition succeeds, false if invalid
   */
  transition(targetState: SlotStateType, context?: TransitionContext): TransitionResult {
    const fromState = this._currentState;

    if (fromState === targetState) {
      Logger.debugT(
        LogCategory.SLOT,
        "app.logs.slotStateMachine.noOpTransition",
        { fromState, targetState },
        {
          slotId: this._slotId,
          state: targetState,
          correlationId: context?.correlationId,
        }
      );

      return {
        success: true,
        fromState,
        toState: targetState,
        wasNoOp: true,
      };
    }

    if (!this.canTransitionTo(targetState)) {
      const error = `Invalid transition: ${fromState} → ${targetState}. Allowed: [${this.getAvailableTransitions().join(", ")}]`;

      Logger.debugT(
        LogCategory.SLOT,
        "app.logs.slotStateMachine.invalidTransition",
        {
          fromState,
          targetState,
          allowedTransitions: this.getAvailableTransitions().join(", "),
        },
        {
          slotId: this._slotId,
          fromState,
          toState: targetState,
          allowedTransitions: this.getAvailableTransitions(),
          correlationId: context?.correlationId,
        }
      );

      return {
        success: false,
        fromState,
        toState: targetState,
        error,
      };
    }

    if (context?.guard && !context.guard(fromState, targetState)) {
      const error = `Transition guard rejected: ${fromState} → ${targetState}`;

      Logger.debugT(
        LogCategory.SLOT,
        "app.logs.slotStateMachine.guardRejected",
        { fromState, targetState },
        {
          slotId: this._slotId,
          fromState,
          toState: targetState,
          correlationId: context.correlationId,
        }
      );

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

    Logger.panelT(
      LogCategory.SLOT,
      LogLevel.INFO,
      "app.logs.slotStateMachine.transitioned",
      {
        slotId: this._slotId,
        fromState,
        targetState,
        reasonSuffix:
          context?.reason !== undefined && context.reason !== "" ? ` (${context.reason})` : "",
      },
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
        Logger.debugT(
          LogCategory.SLOT,
          "app.logs.slotStateMachine.transitionCallbackError",
          {
            fromState,
            targetState,
            message: err instanceof Error ? err.message : String(err),
          },
          {
            slotId: this._slotId,
            fromState,
            toState: targetState,
            operation: "transition-callback",
            correlationId: context?.correlationId,
          }
        );
      }
    }

    if (context?.sideEffect) {
      try {
        context.sideEffect(fromState, targetState);
      } catch (err) {
        Logger.debugT(
          LogCategory.SLOT,
          "app.logs.slotStateMachine.sideEffectError",
          {
            fromState,
            targetState,
            message: err instanceof Error ? err.message : String(err),
          },
          {
            slotId: this._slotId,
            fromState,
            toState: targetState,
            operation: "side-effect",
            correlationId: context.correlationId,
          }
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
   * Add a transition callback.
   * @returns Unsubscribe function
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
   * Return state-machine debug info.
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
