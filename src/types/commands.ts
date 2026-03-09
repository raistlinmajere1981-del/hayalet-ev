/**
 * Command Types - command system types
 *
 * @module src/js/types/commands
 */

import type { SlotId, Attachment } from "./common.js";

// Command Job Types

/** Command status */
export type CommandJobStatus = "pending" | "processing" | "done" | "failed";

/** Basic command job */
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

/** Command payload */
export interface CommandPayload {
  message?: string;
  files?: string[];
  attachments?: Attachment[];
  options?: Record<string, unknown>;
  // Extra fields used by the server command utilities.
  provider?: string;
  args?: string;
  sender?: string;
  source?: string;
  detail?: string;
  testMode?: boolean;
  [key: string]: unknown;
}

/** Command result */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// Command Definition Types

/** Command definition */
export interface CommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  examples?: string[];
  handler: CommandHandler;
}

/** Command handler function */
export type CommandHandler = (args: CommandArgs) => Promise<CommandResult>;

/** Command arguments */
export interface CommandArgs {
  raw: string;
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
  source?: SlotId | "user";
  target?: SlotId;
}

// Meta Command Types

/** Meta command definition (user-defined) */
export interface MetaCommand {
  name: string;
  description: string;
  code: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

/** Meta command list result */
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
