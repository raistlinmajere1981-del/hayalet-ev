/**
 * Relay Types - AI-AI ve AI-Asistan iletişim tipleri
 *
 * @module src/js/types/relay
 */

import type { SlotId, Attachment } from "./common.js";

// Relay Message Types

/** Relay mesaj tipi */
export type RelayMessageType = "text" | "command" | "file" | "system";

/** Relay mesajı */
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

/** Relay mesaj metadata'sı */
export interface RelayMessageMetadata {
  originalMessageId?: string;
  replyTo?: string;
  flags?: string[];
  [key: string]: unknown;
}

// Relay State Types

/** Relay durumu */
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

/** Relay yapılandırması */
export interface RelayConfig {
  autoStart?: boolean;
  maxQueueSize?: number;
  messageDelay?: number;
  retryAttempts?: number;
  retryDelay?: number;
  filters?: RelayFilters;
}

/** Relay filtreleri */
export interface RelayFilters {
  allowedTypes?: RelayMessageType[];
  blockedPatterns?: string[];
  maxMessageLength?: number;
}

// AI-AI Relay Types

/** AI-AI relay modu */
export type AIRelayMode = "ping-pong" | "broadcast" | "chain";

/** AI-AI relay yapılandırması */
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

// AI-Asistan Relay Types

/** Asistan relay yapılandırması */
export interface AsistanRelayConfig extends RelayConfig {
  asistanSlot: SlotId;
  userSlot: SlotId;
  commandPrefix?: string;
}

/** Asistan relay state */
export interface AsistanRelayState extends RelayState {
  asistanSlot: SlotId;
  userSlot: SlotId;
  pendingCommands: string[];
}

// Relay Events

/** Relay event tipi */
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
