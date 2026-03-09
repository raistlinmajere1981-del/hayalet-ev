/**
 * Relay Types - communication types for AI-AI and AI-Assistant flows
 *
 * @module src/js/types/relay
 */

import type { SlotId, Attachment } from "./common.js";

// Relay Message Types

/** Relay message type */
export type RelayMessageType = "text" | "command" | "file" | "system";

/** Relay message */
export interface RelayMessage {
  id: string;
  type: RelayMessageType;
  source: SlotId;
  target: SlotId;
  content: string;
  attachments?: Attachment[];
  timestamp: number;
  metadata?: RelayMessageMetadata;
}

/** Relay message metadata */
export interface RelayMessageMetadata {
  originalMessageId?: string;
  replyTo?: string;
  flags?: string[];
  [key: string]: unknown;
}

// Relay State Types

/** Relay status */
export type RelayStatus = "idle" | "active" | "paused" | "error";

/** Relay state */
export interface RelayState {
  status: RelayStatus;
  source: SlotId | null;
  target: SlotId | null;
  messageQueue: RelayMessage[];
  lastActivity: number;
  error?: string;
}

// Relay Config Types

/** Relay configuration */
export interface RelayConfig {
  autoStart?: boolean;
  maxQueueSize?: number;
  messageDelay?: number;
  retryAttempts?: number;
  retryDelay?: number;
  filters?: RelayFilters;
}

/** Relay filters */
export interface RelayFilters {
  allowedTypes?: RelayMessageType[];
  blockedPatterns?: string[];
  maxMessageLength?: number;
}

// AI-AI Relay Types

/** AI-AI relay mode */
export type AIRelayMode = "ping-pong" | "broadcast" | "chain";

/** AI-AI relay configuration */
export interface AIRelayConfig extends RelayConfig {
  mode: AIRelayMode;
  participants: SlotId[];
  turnOrder?: SlotId[];
  maxTurns?: number;
}

/** AI-AI relay state */
export interface AIRelayState extends RelayState {
  mode: AIRelayMode;
  currentTurn: SlotId | null;
  turnCount: number;
  participants: SlotId[];
}

// AI-Assistant relay types

/** Assistant relay configuration. */
export interface AssistantRelayConfig extends RelayConfig {
  assistantSlot: SlotId;
  userSlot: SlotId;
  commandPrefix?: string;
}

/** Assistant relay state. */
export interface AssistantRelayState extends RelayState {
  assistantSlot: SlotId;
  userSlot: SlotId;
  pendingCommands: string[];
}

// Relay Events

/** Relay event type. */
export type RelayEventType =
  | "message:received"
  | "message:sent"
  | "message:error"
  | "status:changed"
  | "turn:changed"
  | "queue:updated";

/** Relay event */
export interface RelayEvent {
  type: RelayEventType;
  relay: string;
  timestamp: number;
  data: unknown;
}

/** Relay event listener */
export type RelayEventListener = (event: RelayEvent) => void;
