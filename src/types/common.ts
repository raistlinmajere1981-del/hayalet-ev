/**
 * Common Types - Genel amaçlı type tanımları
 *
 * @module src/js/types/common
 */

// Slot & Provider Types

/** AI slot tanımlayıcısı */
export type SlotId = "ai0" | "ai1" | "ai2";

/** Kullanıcı tarafından atanabilir slotlar */
export type UserSlotId = "ai1" | "ai2";

/** Asistan slotu */
export type AsistanSlotId = "ai0";

/** Ana AI provider'ları */
export type ProviderId = "chatgpt" | "gemini" | "grok" | "opencode";

/** Asistan provider'ları */
export type AsistanProviderId = "opencode" | "opencode-ui";

/** Asistan provider listesi (runtime guard için) */
export const ASISTAN_PROVIDER_IDS = ["opencode", "opencode-ui"] as const;

/** Asistan provider type guard */
export function isAsistanProviderId(value: unknown): value is AsistanProviderId {
  return typeof value === "string" && (ASISTAN_PROVIDER_IDS as readonly string[]).includes(value);
}

/** Tüm provider'lar */
export type AllProviderId = ProviderId | AsistanProviderId;

/** Özel sayfalar */
export type SpecialPage = "settings" | "archives" | "webview" | "asistan";

// Generic Utility Types

/** Nullable type */
export type Nullable<T> = T | null;

/** Optional type */
export type Optional<T> = T | undefined;

/** Callback fonksiyon tipi */
export type Callback<T = void> = () => T;

/** Async callback fonksiyon tipi */
export type AsyncCallback<T = void> = () => Promise<T>;

/** Event listener tipi */
export type EventListener<T = unknown> = (payload: T) => void;

/** Unsubscribe fonksiyonu */
export type Unsubscribe = () => void;

// Result Types (IPC için)

/** Temel sonuç tipi */
export interface BaseResult {
  success: boolean;
  message?: string;
  error?: string;
}

/** Veri içeren sonuç tipi */
export interface DataResult<T> extends BaseResult {
  data?: T;
}

/** Liste sonuç tipi */
export interface ListResult<T> extends BaseResult {
  items?: T[];
  total?: number;
}

// File Types

/** Dosya bilgisi */
export interface FileInfo {
  path: string;
  name: string;
  size?: number;
  mimeType?: string;
  data?: string; // base64
}

/** Yüklenen dosya */
export interface UploadedFile extends FileInfo {
  url?: string;
  uploadedAt?: number;
}

/** Attachment (mesaja eklenen dosya) */
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

/** Log seviyesi */
export type LogLevel = "debug" | "info" | "warning" | "error";

/** Log kaynağı */
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

/** Error benzeri obje tipi */
export interface ErrorLike {
  message?: string;
  name?: string;
  stack?: string;
}

/**
 * Unknown tipindeki error'dan güvenli şekilde mesaj çıkarır
 * TypeScript'te catch bloklarında error tipi 'unknown' olduğu için bu helper gerekli
 *
 * @param error - Herhangi bir tipte error
 * @returns Error mesajı string olarak
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
