/**
 * Command Types - Komut sistemi tipleri
 *
 * @module src/js/types/commands
 */

import type { SlotId, Attachment } from "./common.js";

// Command Job Types

/** Komut durumu */
export type CommandJobStatus = "pending" | "processing" | "done" | "failed";

/** Temel komut job'ı */
export interface CommandJob {
  id: string;
  command: string;
  status: CommandJobStatus;
  createdAt: number;
  updatedAt?: number;
  source?: SlotId | "user" | "system";
  target?: SlotId;
  payload?: CommandPayload;
  result?: CommandResult;
  error?: string;
}

/** Komut payload'ı */
export interface CommandPayload {
  message?: string;
  files?: string[];
  attachments?: Attachment[];
  options?: Record<string, unknown>;
  // Server command utils için ek alanlar
  provider?: string;
  args?: string;
  sender?: string;
  source?: string;
  detail?: string;
  testMode?: boolean;
  [key: string]: unknown;
}

/** Komut sonucu */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// Command Definition Types

/** Komut tanımı */
export interface CommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  examples?: string[];
  handler: CommandHandler;
}

/** Komut handler fonksiyonu */
export type CommandHandler = (args: CommandArgs) => Promise<CommandResult>;

/** Komut argümanları */
export interface CommandArgs {
  raw: string;
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
  source?: SlotId | "user";
  target?: SlotId;
}

// Meta Command Types

/** Meta komut tanımı (kullanıcı tanımlı) */
export interface MetaCommand {
  name: string;
  description: string;
  code: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

/** Meta komut listesi sonucu */
export interface MetaCommandListResult {
  success: boolean;
  commands?: Record<string, MetaCommand>;
  message?: string;
}

// Command Executor Types

/** Executor context */
export interface ExecutorContext {
  slot: SlotId;
  jobId?: string;
  attachments?: Attachment[];
  tempPaths?: string[];
}

/** Executor options */
export interface ExecutorOptions {
  timeout?: number;
  retries?: number;
  onProgress?: (progress: number) => void;
}
