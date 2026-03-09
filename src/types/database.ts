/**
 * Database Types - database type definitions
 *
 * @module src/js/types/database
 */

// Conversation Types

/** Conversation record */
export interface Conversation {
  id: string;
  accountId: string;
  title: string;
  webUrl: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
  lastMessage?: string;
  archived?: boolean;
  starred?: boolean;
  tags?: string[];
}

/** Conversation update payload */
export interface ConversationUpdate {
  accountId: string;
  conversationId: string;
  title?: string;
  archived?: boolean;
  starred?: boolean;
  tags?: string[];
  [key: string]: unknown;
}

// Message Types

/** Message role */
export type MessageRole = "user" | "assistant" | "system";

/** Message record */
export interface Message {
  id: string;
  conversationId: string;
  accountId: string;
  role: MessageRole;
  content: string;
  contentHash: string;
  index: number;
  createdAt: number;
  updatedAt?: number;
  metadata?: MessageMetadata;
}

/** Message metadata */
export interface MessageMetadata {
  model?: string;
  tokens?: number;
  attachments?: MessageAttachment[];
  reactions?: string[];
  [key: string]: unknown;
}

/** Attachment added to a message */
export interface MessageAttachment {
  id: string;
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

// Sync Types

/** Message synchronization payload */
export interface MessageSyncPayload {
  accountId: string;
  webUrl: string;
  messages: SyncMessage[];
  authors?: SyncAuthors;
}

/** Message to synchronize */
export interface SyncMessage {
  role: MessageRole;
  text: string;
  index: number;
  contentHash?: string;
}

/** Author information */
export interface SyncAuthors {
  user?: string;
  assistant?: string;
}

/** Synchronization result */
export interface SyncResult {
  success: boolean;
  conversationId?: string;
  added?: number;
  updated?: number;
  deleted?: number;
  message?: string;
}

// Search Types

/** Search parameters */
export interface SearchParams {
  accountId?: string;
  query: string;
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
}

/** Search filters */
export interface SearchFilters {
  role?: MessageRole;
  dateFrom?: number;
  dateTo?: number;
  conversationId?: string;
}

/** Search result */
export interface SearchResult {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

// Attachment Store Types

/** Stored attachment */
export interface StoredAttachment {
  id: string;
  conversationId: string;
  accountId: string;
  messageId?: string;
  name: string;
  path?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  hash?: string;
  createdAt: number;
}
