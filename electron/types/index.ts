/**
 * Electron Main Process Type Definitions
 *
 * This file contains shared type definitions for all modules under electron/.
 * The types are used for the incremental TypeScript migration.
 *
 * @module electron/types
 */

import type { IpcMainInvokeEvent, BrowserWindow } from "electron";
import type { LogLevel } from "@shared/index.js";

export type IpcHandler<Args extends unknown[] = unknown[], R = unknown> = (
  event: IpcMainInvokeEvent,
  ...args: Args
) => R | Promise<R>;

export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

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

export interface SyncMessagesParams {
  accountId: string;
  webUrl: string;
  messages: Array<{
    role: "user" | "assistant";
    text: string;
    /** Sender nickname (preserves the real sender in relay/++cmd scenarios) */
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

export interface SyncMessagesResult {
  success: boolean;
  conversationId?: string;
  added?: number;
  total?: number;
  error?: string;
}

export type LogSource =
  | "MAIN"
  | "RENDERER"
  | "WEBVIEW"
  | "WEBVIEW-AI1"
  | "WEBVIEW-AI2"
  | "IPC"
  | "DB";

export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

export interface SessionMeta {
  sessionId: string;
  startTime: string;
  platform: string;
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
}

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

export interface SessionListItem {
  sessionId: string;
  startTime: string | null;
  endTime: string | null;
  endReason: string;
  stats: SessionSummary["stats"] | null;
}

export interface AppState {
  startTime?: string;
  lastUpdate?: string;
  [key: string]: unknown;
}

export interface LogQueryParams {
  type?: "all" | "console" | LogLevel.ERROR;
  source?: string;
  contains?: string;
  level?: LogLevel;
  since?: string;
  tail?: number;
  sessionId?: string;
}

export interface StructuredLogEntry {
  timestamp: string;
  isoTimestamp?: string;
  level?: LogLevel;
  type?: string;
  source: LogSource;
  message: string;
  locale?: string;
  messageKey?: string;
  context?: LogContext;
  sessionId?: string;
  correlationId?: string | null;
  visibility?: number;
  meta?: Record<string, unknown>;
  aiHint?: Record<string, unknown>;
}

export interface SlotSettings {
  provider: string;
  url: string;
  account?: string;
}

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

export interface WindowRef {
  mainWindow: BrowserWindow | null;
  isQuitting: boolean;
}

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

export interface FileOperationResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface CommandDefinition {
  name: string;
  description: string;
  usage?: string;
  handler: (args: string[]) => Promise<string> | string;
}

export type { IpcMainInvokeEvent, BrowserWindow } from "electron";

// Re-export domain types
export type { ServerOptions, ServerInfo } from "./server.ts";
export type { ErrorHint, MatchedHint } from "./error-patterns.ts";
export type { PathConfig, PathResolver } from "./paths.js";
