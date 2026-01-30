/**
 * Traffic Types - State tracking tipleri
 * 
 * @module src/js/types/traffic
 */

import type { SlotId, ProviderId } from "./common.js";

// ============================================================================
// Traffic State Types
// ============================================================================

/** Slot durumu */
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

/** Tüm slotların durumu */
export type TrafficState = Record<SlotId, SlotState>;

/** State değişiklik event'i */
export interface StateChangeEvent {
  slot: SlotId;
  field: keyof SlotState;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

// ============================================================================
// Loading Tracker Types
// ============================================================================

/** Loading durumu */
export interface LoadingState {
  isLoading: boolean;
  startedAt?: number;
  progress?: number;
  url?: string;
}

/** Loading event'i */
export interface LoadingEvent {
  slot: SlotId;
  type: "start" | "progress" | "complete" | "error";
  url?: string;
  progress?: number;
  error?: string;
}

// ============================================================================
// Thinking Tracker Types
// ============================================================================

/** Thinking durumu */
export interface ThinkingState {
  isThinking: boolean;
  startedAt?: number;
  indicator?: ThinkingIndicator;
}

/** Thinking göstergesi */
export interface ThinkingIndicator {
  visible: boolean;
  element?: string;
  text?: string;
}

/** Thinking event'i */
export interface ThinkingEvent {
  slot: SlotId;
  type: "start" | "stop";
  duration?: number;
}

// ============================================================================
// Send Tracker Types
// ============================================================================

/** Gönderim durumu */
export interface SendState {
  isSending: boolean;
  startedAt?: number;
  message?: string;
  attachments?: number;
}

/** Gönderim event'i */
export interface SendEvent {
  slot: SlotId;
  type: "start" | "complete" | "error";
  messageLength?: number;
  attachmentCount?: number;
  duration?: number;
  error?: string;
}

// ============================================================================
// Probe Types
// ============================================================================

/** Probe sonucu */
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

/** Probe script oluşturucu options */
export interface ProbeScriptOptions {
  provider: ProviderId;
  checkInput?: boolean;
  checkSendButton?: boolean;
  checkThinking?: boolean;
  checkMessages?: boolean;
}
