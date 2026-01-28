/**
 * Message Store - Type Definitions
 * 
 * Normalized message, part, and queue types
 */

// ===========================================================================
// Message Types
// ===========================================================================

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  status: MessageStatus;
  revision: number;
  isEphemeral: boolean;
  partIds: string[];
  parts: Record<string, MessagePart>;
  createdAt: number;
  updatedAt: number;
  errorInfo?: MessageErrorInfo;
}

export type MessageStatus = 'sending' | 'sent' | 'complete' | 'streaming' | 'error';

export interface MessageErrorInfo {
  code?: string;
  message?: string;
  retryable?: boolean;
}

export interface MessageUpsertInput {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  status?: MessageStatus;
  isEphemeral?: boolean;
  parts?: Array<Partial<MessagePart>>;
  createdAt?: number;
}

export interface OptimisticMessageInput {
  tempId?: string;
  sessionId: string;
  role: string;
  content: string;
}

export interface OptimisticMessageResult {
  tempId: string;
  record: MessageRecord;
}

export interface ReplaceMessageIdOptions {
  oldId: string;
  newId: string;
}

// ===========================================================================
// Message Part Types
// ===========================================================================

export type PartType = 'text' | 'tool' | 'thinking' | 'step';

export interface MessagePart {
  id: string;
  messageId: string;
  type: PartType;
  revision: number;
  text?: string;
  toolCall?: ToolCallData;
  thinking?: ThinkingData;
  step?: StepData;
  createdAt: number;
  updatedAt: number;
}

export interface PartUpdateInput {
  messageId: string;
  partId?: string;
  type: PartType;
  text?: string;
  toolCall?: unknown;
  thinking?: unknown;
  step?: unknown;
}

export interface ToolCallData {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  output?: string;
  status?: 'pending' | 'running' | 'success' | 'error';
}

export interface ThinkingData {
  content: string;
  tokens?: number;
}

export interface StepData {
  id: string;
  status: 'start' | 'finish';
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  startedAt?: number;
  finishedAt?: number;
}

// ===========================================================================
// Permission Queue Types
// ===========================================================================

export interface PermissionEntry {
  id?: string;
  messageId?: string;
  partId?: string;
  permission: PermissionRequest;
  createdAt?: number;
}

export interface PermissionRequest {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  metadata?: unknown;
  risk?: string;
}

export interface PermissionState {
  queue: PermissionEntry[];
  active: PermissionEntry | null;
  byMessage: Record<string, Record<string, PermissionEntry>>;
}

// ===========================================================================
// Question Queue Types
// ===========================================================================

export interface QuestionEntry {
  id: string;
  messageId?: string;
  question?: unknown;
  createdAt?: number;
}

export interface QuestionState {
  queue: QuestionEntry[];
  active: QuestionEntry | null;
}

// ===========================================================================
// Store Events
// ===========================================================================

export type StoreEventType =
  | 'message:created'
  | 'message:updated'
  | 'message:deleted'
  | 'part:updated'
  | 'permission:updated'
  | 'permission:removed'
  | 'permission:cleared'
  | 'question:updated'
  | 'question:removed'
  | 'question:cleared'
  | 'session:changed';

export interface StoreEvent {
  type: StoreEventType;
  timestamp: number;
  messageId?: string;
  sessionId?: string;
  partId?: string;
  permissionId?: string;
  questionId?: string;
  error?: unknown;
}

export type StoreListener = (event: StoreEvent) => void;
