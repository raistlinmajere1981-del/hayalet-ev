/**
 * IPC Channel Type Definitions
 *
 * Bu dosya tüm IPC kanalları için type-safe tanımlamalar içerir.
 * Main process ve Renderer process arasındaki iletişimde tip güvenliği sağlar.
 *
 * @example
 * // Type-safe IPC çağrısı
 * const result = await IPC.invoke("db-get-conversations", { accountId: "123" });
 * // result tipi otomatik olarak DbGetConversationsResult olur
 */

import type { ProviderTestSuite } from "./provider.js";

// Database Channel Types

export interface DbInitAccountParams {
  accountId: string;
}

export interface DbInitAccountResult {
  success: boolean;
  error?: string;
}

export interface DbGetConversationsParams {
  accountId: string;
}

export interface DbConversation {
  id: string;
  value: string;
  webUrl: string;
  title: string;
  summary: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  folder: string;
  label: string;
}

export interface DbGetConversationsResult {
  success: boolean;
  data?: DbConversation[];
  error?: string;
}

export interface DbGetMessagesParams {
  accountId: string;
  conversationId: string;
}

export interface DbMessage {
  id: string;
  index: number;
  role: string;
  author: string;
  text: string;
  contentHash: string;
  domIndex: number | null;
  domId: string | null;
  createdAt: number;
}

export interface DbGetMessagesResult {
  success: boolean;
  data?: DbMessage[];
  error?: string;
}

export interface DbSyncMessagesParams {
  accountId: string;
  webUrl: string;
  messages: Array<{
    role: string;
    author?: string;
    content: string;
    domIndex?: number;
    domId?: string;
  }>;
}

export interface DbSyncMessagesResult {
  success: boolean;
  conversationId?: string;
  syncedCount?: number;
  error?: string;
}

export interface DbDeleteConversationParams {
  accountId: string;
  conversationId: string;
}

export interface DbDeleteConversationResult {
  success: boolean;
  error?: string;
}

export interface DbUpdateConversationParams {
  accountId: string;
  conversationId: string;
  title?: string;
  summary?: string;
}

export interface DbUpdateConversationResult {
  success: boolean;
  error?: string;
}

export interface DbSaveAttachmentParams {
  accountId: string;
  conversationId: string;
  messageId: string;
  filePath: string;
  originalName: string;
  mimeType?: string;
}

export interface DbSaveAttachmentResult {
  success: boolean;
  attachmentId?: string;
  storedPath?: string;
  error?: string;
}

export interface DbGetAttachmentsParams {
  accountId: string;
  conversationId: string;
}

export interface DbAttachment {
  id: string;
  messageId: string;
  originalName: string;
  storedName: string;
  storedPath: string;
  mimeType: string | null;
  size: number;
  createdAt: number;
}

export interface DbGetAttachmentsResult {
  success: boolean;
  data?: DbAttachment[];
  error?: string;
}

export interface DbSearchMessagesParams {
  accountId: string;
  query: string;
  limit?: number;
}

export interface DbSearchMessageResult {
  id: string;
  conversationId: string;
  conversationTitle: string;
  webUrl: string;
  role: string;
  author: string;
  content: string;
  snippet: string;
  createdAt: number;
}

export interface DbSearchMessagesResult {
  success: boolean;
  data?: DbSearchMessageResult[];
  error?: string;
}

export interface DbSearchAttachmentsParams {
  accountId: string;
  query: string;
  limit?: number;
}

export interface DbSearchAttachmentResult {
  id: string;
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  webUrl: string;
  originalName: string;
  storedPath: string;
  mimeType: string | null;
  size: number;
  createdAt: number;
}

export interface DbSearchAttachmentsResult {
  success: boolean;
  data?: DbSearchAttachmentResult[];
  error?: string;
}

export interface DbSearchAllAccountsParams {
  query: string;
  limit?: number;
}

export interface DbSearchAllAccountsResult {
  success: boolean;
  data?: {
    messages: Array<DbSearchMessageResult & { accountId: string }>;
    attachments: Array<DbSearchAttachmentResult & { accountId: string }>;
  };
  error?: string;
}

// Settings Channel Types

export interface LoadSettingsResult {
  [key: string]: unknown;
}

export interface SaveSettingsParams {
  [key: string]: unknown;
}

export interface SaveSettingsResult {
  success: boolean;
  error?: string;
}

// File System Channel Types

export interface ReadFileParams {
  filePath: string;
}

export interface ReadFileResult {
  success: boolean;
  data?: string;
  error?: string;
}

export interface WriteFileParams {
  filePath: string;
  content: string;
}

export interface WriteFileResult {
  success: boolean;
  error?: string;
}

export interface FileExistsParams {
  filePath: string;
}

export interface FileExistsResult {
  exists: boolean;
}

// Window Channel Types

export interface OpenDevToolsParams {
  webviewId?: string;
}

export interface SetAlwaysOnTopParams {
  value: boolean;
}

// Memory Channel Types

export interface MemoryItem {
  id: string;
  namespace: string;
  content: string;
  summary: string | null;
  sourceProvider: string | null;
  memoryType: string;
  importance: number;
  pinned: boolean;
  tags: string[];
  metadata: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

export interface MemoryStats {
  totalMemories: number;
  pinnedMemories: number;
  averageImportance: number;
  lastUpdatedAt: number | null;
}

export interface MemorySearchParams {
  namespace?: string;
  query?: string;
  sourceProvider?: string;
  tags?: string[];
  limit?: number;
}

export interface MemorySearchResult {
  success: boolean;
  data?: { items: MemoryItem[]; total: number };
  error?: string;
}

export interface MemoryStatsParams {
  namespace?: string;
}

export interface MemoryStatsResult {
  success: boolean;
  data?: MemoryStats;
  error?: string;
}

export interface MemoryDeleteParams {
  id: string;
}

export interface MemoryDeleteResult {
  success: boolean;
  deleted?: boolean;
  error?: string;
}

export interface MemoryUpdateParams {
  id: string;
  content?: string;
  summary?: string;
  importance?: number;
  pinned?: boolean;
  tags?: string[];
  memoryType?: string;
}

export interface MemoryUpdateResult {
  success: boolean;
  updated?: boolean;
  error?: string;
}

export interface MemoryWriteParams {
  namespace?: string;
  content: string;
  summary?: string;
  sourceProvider?: string;
  memoryType?: string;
  importance?: number;
  pinned?: boolean;
  tags?: string[];
}

export interface MemoryWriteResult {
  success: boolean;
  data?: MemoryItem;
  error?: string;
}

export interface MemoryPruneParams {
  namespace?: string;
  maxItems: number;
  olderThanDays?: number;
}

export interface MemoryPruneResult {
  success: boolean;
  deleted?: number;
  error?: string;
}

export interface MemoryDeleteAllParams {
  namespace?: string;
}

export interface MemoryDeleteAllResult {
  success: boolean;
  deleted?: number;
  error?: string;
}

// IPC Channel Map - Tüm kanalların tip eşleştirmesi

/**
 * IPC Channel Map
 *
 * Her IPC kanalı için params ve result tiplerini tanımlar.
 * Bu map, type-safe IPC çağrıları için kullanılır.
 */
export interface IPCChannelMap {
  // Database
  "db-init-account": { params: DbInitAccountParams; result: DbInitAccountResult };
  "db-get-conversations": { params: DbGetConversationsParams; result: DbGetConversationsResult };
  "db-get-messages": { params: DbGetMessagesParams; result: DbGetMessagesResult };
  "db-sync-messages": { params: DbSyncMessagesParams; result: DbSyncMessagesResult };
  "db-delete-conversation": {
    params: DbDeleteConversationParams;
    result: DbDeleteConversationResult;
  };
  "db-update-conversation": {
    params: DbUpdateConversationParams;
    result: DbUpdateConversationResult;
  };
  "db-save-attachment": { params: DbSaveAttachmentParams; result: DbSaveAttachmentResult };
  "db-get-attachments": { params: DbGetAttachmentsParams; result: DbGetAttachmentsResult };
  "db-search-messages": { params: DbSearchMessagesParams; result: DbSearchMessagesResult };
  "db-search-attachments": { params: DbSearchAttachmentsParams; result: DbSearchAttachmentsResult };
  "db-search-all-accounts": {
    params: DbSearchAllAccountsParams;
    result: DbSearchAllAccountsResult;
  };

  // Settings
  "load-settings": { params: undefined; result: LoadSettingsResult };
  "save-settings": { params: SaveSettingsParams; result: SaveSettingsResult };

  // File System
  "read-file": { params: ReadFileParams; result: ReadFileResult };
  "write-file": { params: WriteFileParams; result: WriteFileResult };
  "file-exists": { params: FileExistsParams; result: FileExistsResult };

  // Window
  "open-devtools": { params: OpenDevToolsParams | undefined; result: undefined };
  "set-always-on-top": { params: SetAlwaysOnTopParams; result: undefined };
  "minimize-window": { params: undefined; result: undefined };
  "maximize-window": { params: undefined; result: undefined };
  "close-window": { params: undefined; result: undefined };
  "test-provider": {
    params: { slot: "ai0" | "ai1" | "ai2" };
    result: ProviderTestSuite;
  };
}

/**
 * IPC Channel Names
 */
export type IPCChannel = keyof IPCChannelMap;

/**
 * IPC Channel Params Helper
 */
export type IPCParams<T extends IPCChannel> = IPCChannelMap[T]["params"];

/**
 * IPC Channel Result Helper
 */
export type IPCResult<T extends IPCChannel> = IPCChannelMap[T]["result"];
