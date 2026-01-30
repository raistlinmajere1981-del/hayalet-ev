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

// ============================================================================
// Database Channel Types
// ============================================================================

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

// ============================================================================
// Settings Channel Types
// ============================================================================

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

// ============================================================================
// File System Channel Types
// ============================================================================

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

// ============================================================================
// Window Channel Types
// ============================================================================

export interface OpenDevToolsParams {
  webviewId?: string;
}

export interface SetAlwaysOnTopParams {
  value: boolean;
}

// ============================================================================
// IPC Channel Map - Tüm kanalların tip eşleştirmesi
// ============================================================================

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
  "db-delete-conversation": { params: DbDeleteConversationParams; result: DbDeleteConversationResult };
  "db-update-conversation": { params: DbUpdateConversationParams; result: DbUpdateConversationResult };
  "db-save-attachment": { params: DbSaveAttachmentParams; result: DbSaveAttachmentResult };
  "db-get-attachments": { params: DbGetAttachmentsParams; result: DbGetAttachmentsResult };
  "db-search-messages": { params: DbSearchMessagesParams; result: DbSearchMessagesResult };
  "db-search-attachments": { params: DbSearchAttachmentsParams; result: DbSearchAttachmentsResult };
  "db-search-all-accounts": { params: DbSearchAllAccountsParams; result: DbSearchAllAccountsResult };
  
  // Settings
  "load-settings": { params: void; result: LoadSettingsResult };
  "save-settings": { params: SaveSettingsParams; result: SaveSettingsResult };
  
  // File System
  "read-file": { params: ReadFileParams; result: ReadFileResult };
  "write-file": { params: WriteFileParams; result: WriteFileResult };
  "file-exists": { params: FileExistsParams; result: FileExistsResult };
  
  // Window
  "open-devtools": { params: OpenDevToolsParams | void; result: void };
  "set-always-on-top": { params: SetAlwaysOnTopParams; result: void };
  "minimize-window": { params: void; result: void };
  "maximize-window": { params: void; result: void };
  "close-window": { params: void; result: void };
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
