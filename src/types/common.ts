/**
 * Common types.
 *
 * @module src/js/types/common
 */

// Slot & Provider Types

/** AI slot identifier. */
export type SlotId = "ai0" | "ai1" | "ai2";

/** User-assignable slots. */
export type UserSlotId = "ai1" | "ai2";

/** Assistant slot. */
export type AssistantSlotId = "ai0";

/** Primary AI providers. */
export type ProviderId = "chatgpt" | "gemini" | "grok" | "opencode";

/** Assistant providers. */
export type AssistantProviderId = "opencode" | "opencode-ui";

/** Assistant provider list for runtime guards. */
export const ASSISTANT_PROVIDER_IDS = ["opencode", "opencode-ui"] as const;

/** Assistant provider type guard. */
export function isAssistantProviderId(value: unknown): value is AssistantProviderId {
  return typeof value === "string" && (ASSISTANT_PROVIDER_IDS as readonly string[]).includes(value);
}

/** All providers. */
export type AllProviderId = ProviderId | AssistantProviderId;

/** Special pages. */
export type SpecialPage = "settings" | "archives" | "webview" | "assistant";

// Generic Utility Types

/** Nullable type */
export type Nullable<T> = T | null;

/** Optional type */
export type Optional<T> = T | undefined;

/** Callback function type. */
export type Callback<T = void> = () => T;

/** Async callback function type. */
export type AsyncCallback<T = void> = () => Promise<T>;

/** Event listener type. */
export type EventListener<T = unknown> = (payload: T) => void;

/** Unsubscribe function. */
export type Unsubscribe = () => void;

// Result Types (for IPC)

/** Base result type. */
export interface BaseResult {
  success: boolean;
  message?: string;
  error?: string;
}

/** Data-carrying result type. */
export interface DataResult<T> extends BaseResult {
  data?: T;
}

/** List result type. */
export interface ListResult<T> extends BaseResult {
  items?: T[];
  total?: number;
}

// File Types

/** File metadata. */
export interface FileInfo {
  path: string;
  name: string;
  size?: number;
  mimeType?: string;
  data?: string; // base64
}

/** Uploaded file. */
export interface UploadedFile extends FileInfo {
  url?: string;
  uploadedAt?: number;
}

/** Attachment added to a message. */
export interface Attachment {
  id?: string;
  name: string;
  path?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  data?: string; // base64
}

// Logging Types

/** Log level. */
export type LogLevel = "debug" | "info" | "warning" | "error";

/** Log source. */
export type LogSource = string;

/** Log entry */
export interface LogEntry {
  timestamp: number;
  source: LogSource;
  level: LogLevel;
  message: string;
  data?: unknown;
}

// Error Handling Utilities

/** Error-like object shape. */
export interface ErrorLike {
  message?: string;
  name?: string;
  stack?: string;
}

/**
 * Safely extract a message from an unknown error value.
 * This helper exists because TypeScript treats catch-block errors as `unknown`.
 *
 * @param error - Any error-like value
 * @returns The error message as a string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error !== null && error !== undefined && typeof error === "object" && "message" in error) {
    return String((error as ErrorLike).message);
  }
  return String(error);
}
