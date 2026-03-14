import type { SlotId, Attachment } from "./common.js";

export type CommandJobStatus = "pending" | "processing" | "done" | "failed";

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

export interface CommandPayload {
  message?: string;
  files?: string[];
  attachments?: Attachment[];
  options?: Record<string, unknown>;
  // NOTE: Extra fields used by server command utilities.
  provider?: string;
  args?: string;
  sender?: string;
  source?: string;
  detail?: string;
  testMode?: boolean;
  [key: string]: unknown;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export interface CommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  examples?: string[];
  handler: CommandHandler;
}

export type CommandHandler = (args: CommandArgs) => Promise<CommandResult>;

export interface CommandArgs {
  raw: string;
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
  source?: SlotId | "user";
  target?: SlotId;
}

export interface ExecutorContext {
  slot: SlotId;
  jobId?: string;
  attachments?: Attachment[];
  tempPaths?: string[];
}

export interface ExecutorOptions {
  timeout?: number;
  retries?: number;
  onProgress?: (progress: number) => void;
}
