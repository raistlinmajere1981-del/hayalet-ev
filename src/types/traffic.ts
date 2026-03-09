/**
 * Traffic Types - state tracking types
 *
 * @module src/js/types/traffic
 */

import type { SlotId, ProviderId } from "./common.js";

// Traffic State Types

/** Slot state */
export interface SlotState {
  slot: SlotId;
  provider: ProviderId | null;
  url: string | null;
  isLoading: boolean;
  isThinking: boolean;
  isSending: boolean;
  isReady: boolean;
  lastActivity: number;
  error?: string;
}

/** State of all slots */
export type TrafficState = Record<SlotId, SlotState>;

/** State-change event */
export interface StateChangeEvent {
  slot: SlotId;
  field: keyof SlotState;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

// Loading Tracker Types

/** Loading state */
export interface LoadingState {
  isLoading: boolean;
  startedAt?: number;
  progress?: number;
  url?: string;
}

/** Loading event */
export interface LoadingEvent {
  slot: SlotId;
  type: "start" | "progress" | "complete" | "error";
  url?: string;
  progress?: number;
  error?: string;
}

// Thinking Tracker Types

/** Thinking state */
export interface ThinkingState {
  isThinking: boolean;
  startedAt?: number;
  indicator?: ThinkingIndicator;
}

/** Thinking indicator */
export interface ThinkingIndicator {
  visible: boolean;
  element?: string;
  text?: string;
}

/** Thinking event */
export interface ThinkingEvent {
  slot: SlotId;
  type: "start" | "stop";
  duration?: number;
}

// Send Tracker Types

/** Send state */
export interface SendState {
  isSending: boolean;
  startedAt?: number;
  message?: string;
  attachments?: number;
}

/** Send event */
export interface SendEvent {
  slot: SlotId;
  type: "start" | "complete" | "error";
  messageLength?: number;
  attachmentCount?: number;
  duration?: number;
  error?: string;
}

// Probe Types

/** Probe result */
export interface ProbeResult {
  slot: SlotId;
  timestamp: number;
  isReady: boolean;
  isLoading: boolean;
  isThinking: boolean;
  hasInput: boolean;
  hasSendButton: boolean;
  messageCount?: number;
  error?: string;
}

/** Probe-script builder options */
export interface ProbeScriptOptions {
  provider: ProviderId;
  checkInput?: boolean;
  checkSendButton?: boolean;
  checkThinking?: boolean;
  checkMessages?: boolean;
}
