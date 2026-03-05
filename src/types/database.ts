/**
 * Database Types - Veritabanı tipleri
 *
 * @module src/js/types/database
 */

// Conversation Types

/** Konuşma kaydı */
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

/** Konuşma güncelleme payload'ı */
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

/** Mesaj rolü */
export type MessageRole = "user" | "assistant" | "system";

/** Mesaj kaydı */
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

/** Mesaj metadata'sı */
export interface MessageMetadata {
  model?: string;
  tokens?: number;
  attachments?: MessageAttachment[];
  reactions?: string[];
  [key: string]: unknown;
}

/** Mesaja eklenmiş dosya */
export interface MessageAttachment {
  id: string;
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

// Sync Types

/** Mesaj senkronizasyon payload'ı */
export interface MessageSyncPayload {
  accountId: string;
  webUrl: string;
  messages: SyncMessage[];
  authors?: SyncAuthors;
}

/** Senkronize edilecek mesaj */
export interface SyncMessage {
  role: MessageRole;
  text: string;
  index: number;
  contentHash?: string;
}

/** Yazar bilgileri */
export interface SyncAuthors {
  user?: string;
  assistant?: string;
}

/** Senkronizasyon sonucu */
export interface SyncResult {
  success: boolean;
  conversationId?: string;
  added?: number;
  updated?: number;
  deleted?: number;
  message?: string;
}

// Search Types

/** Arama parametreleri */
export interface SearchParams {
  accountId?: string;
  query: string;
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
}

/** Arama filtreleri */
export interface SearchFilters {
  role?: MessageRole;
  dateFrom?: number;
  dateTo?: number;
  conversationId?: string;
}

/** Arama sonucu */
export interface SearchResult {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

// Attachment Store Types

/** Kayıtlı attachment */
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
