/**
 * Electron Main Process Type Definitions
 *
 * Bu dosya electron/ klasöründeki tüm modüller için ortak tip tanımlarını içerir.
 * Tip tanımları incremental TypeScript dönüşümü için kullanılır.
 *
 * @module electron/types
 */

import type { IpcMainInvokeEvent, BrowserWindow } from "electron";
import type Database from "better-sqlite3";

// ============================================================================
// IPC Types
// ============================================================================

/**
 * IPC Handler fonksiyon tipi
 * Args tuple olarak tanımlanır (farklı tipteki argümanlar için)
 */
export type IpcHandler<Args extends unknown[] = unknown[], R = unknown> = (
  event: IpcMainInvokeEvent,
  ...args: Args
) => R | Promise<R>;

/**
 * IPC Result wrapper - başarı/hata durumu
 */
export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ============================================================================
// Database Types
// ============================================================================

/**
 * Conversation kaydı
 */
export interface Conversation {
  id: string;
  web_url: string;
  title: string;
  summary: string;
  message_count: number;
  last_message_id: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Message kaydı
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  author: string | null;
  content: string;
  dom_index: number | null;
  dom_id: string | null;
  content_hash: string | null;
  created_at: number;
}

/**
 * Attachment kaydı
 */
export interface Attachment {
  id: string;
  message_id: string;
  conversation_id: string;
  original_name: string;
  stored_name: string;
  stored_path: string;
  mime_type: string | null;
  size: number;
  created_at: number;
}

/**
 * Database connection pool entry
 */
export interface DbConnection {
  db: Database.Database;
  queries: PreparedQueries;
}

/**
 * Prepared statements koleksiyonu
 */
export interface PreparedQueries {
  // Conversation queries
  getConversations: Database.Statement;
  getConversationById: Database.Statement;
  getConversationByUrl: Database.Statement;
  getConversationCount: Database.Statement;
  insertConversation: Database.Statement;
  updateConversation: Database.Statement;
  deleteConversation: Database.Statement;

  // Message queries
  getMessages: Database.Statement;
  getMessageHashes: Database.Statement;
  getMessageCount: Database.Statement;
  getLastMessage: Database.Statement;
  insertMessage: Database.Statement;

  // Attachment queries
  getAttachmentsByConversation: Database.Statement;
  getAttachmentsByMessage: Database.Statement;
  insertAttachment: Database.Statement;

  // Search queries
  searchMessages: Database.Statement;
}

/**
 * SyncMessages parametreleri
 */
export interface SyncMessagesParams {
  accountId: string;
  webUrl: string;
  messages: Array<{
    role: "user" | "assistant";
    text: string;
    author?: string;
    index?: number;
    domIndex?: number;
    domId?: string;
    contentHash?: string;
  }>;
  authors?: {
    user?: string;
    assistant?: string;
  };
}

/**
 * SyncMessages sonucu
 */
export interface SyncMessagesResult {
  success: boolean;
  conversationId?: string;
  added?: number;
  total?: number;
  error?: string;
}

// ============================================================================
// Logger Types
// ============================================================================

/**
 * Log seviyeleri
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log kaynağı
 */
export type LogSource =
  | "MAIN"
  | "RENDERER"
  | "WEBVIEW"
  | "WEBVIEW-AI1"
  | "WEBVIEW-AI2"
  | "IPC"
  | "DB"
  | string;

/**
 * Log context bilgisi
 */
export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

/**
 * Session meta bilgisi
 */
export interface SessionMeta {
  sessionId: string;
  startTime: string;
  platform: string;
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
}

/**
 * Session summary bilgisi
 */
export interface SessionSummary {
  sessionId: string;
  startTime: string;
  endTime: string;
  endReason: "normal" | "crash" | "unknown" | "active";
  stats: {
    totalLogs: number;
    errors: number;
    warnings: number;
    chunks: number;
  };
  lastState: AppState;
}

/**
 * Session listesi item
 */
export interface SessionListItem {
  sessionId: string;
  startTime: string | null;
  endTime: string | null;
  endReason: string;
  stats: SessionSummary["stats"] | null;
}

/**
 * Uygulama state snapshot
 */
export interface AppState {
  startTime?: string;
  lastUpdate?: string;
  [key: string]: unknown;
}

/**
 * Log query parametreleri
 */
export interface LogQueryParams {
  type?: "all" | "console" | "error";
  source?: string;
  contains?: string;
  level?: LogLevel;
  since?: string;
  tail?: number;
  sessionId?: string;
}

/**
 * Structured log entry
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  context?: LogContext;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Slot ayarları
 */
export interface SlotSettings {
  provider: string;
  url: string;
  account?: string;
}

/**
 * Uygulama ayarları
 */
export interface AppSettings {
  slots: {
    AI1: SlotSettings;
    AI2: SlotSettings;
  };
  whisper?: {
    enabled: boolean;
    model?: string;
  };
  googleDrive?: {
    enabled: boolean;
    syncInterval?: number;
  };
  theme?: "light" | "dark" | "system";
  [key: string]: unknown;
}

// ============================================================================
// Window Types
// ============================================================================

/**
 * Window manager için window referansı
 */
export interface WindowRef {
  mainWindow: BrowserWindow | null;
  isQuitting: boolean;
}

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Provider config yapısı
 */
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  loginUrl?: string;
  selectors: {
    input?: string;
    submit?: string;
    messages?: string;
    userMessage?: string;
    assistantMessage?: string;
    thinking?: string;
    loading?: string;
    [key: string]: string | undefined;
  };
  scrollerSelectors?: string[];
  filters?: Record<string, unknown> | null;
  telemetry?: Record<string, unknown> | null;
}

// ============================================================================
// File Manager Types
// ============================================================================

/**
 * Dosya işlem sonucu
 */
export interface FileOperationResult {
  success: boolean;
  path?: string;
  error?: string;
}

// ============================================================================
// Command Types
// ============================================================================

/**
 * Komut tanımı
 */
export interface CommandDefinition {
  name: string;
  description: string;
  usage?: string;
  handler: (args: string[]) => Promise<string> | string;
}

// ============================================================================
// Re-exports
// ============================================================================

export type { IpcMainInvokeEvent, BrowserWindow } from "electron";
export type { Database } from "better-sqlite3";
