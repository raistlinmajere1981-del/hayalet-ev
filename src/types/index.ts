/**
 * Hayalet-ev Unified Type Definitions
 *
 * Centralized type definitions imported by all modules
 *
 * @module src/types
 * @version 2.0.0
 */

// Core application types
export * from "./common.js";
export * from "./provider.js";
export * from "./settings.js";
export * from "./i18n.js";
export * from "./commands.js";
export * from "./database.js";
export * from "./traffic.js";
export * from "./relay.js";
export * from "./ipc-channels.js";
export * from "./rooms.js";

// Logging types
export * from "./logging-core.js";

// Assistant types
export * from "./assistant.js";

// Re-export commonly used types for convenience (explicit for better IDE support)
export type {
  // Common
  BaseResult,
  ErrorLike,
} from "./common.js";

export type {
  // Commands
  CommandJob,
  CommandPayload,
  CommandResult,
  CommandDefinition,
  CommandArgs,
  ExecutorContext,
  ExecutorOptions,
} from "./commands.js";

export type {
  // Database
  Conversation,
  ConversationUpdate,
} from "./database.js";

export type {
  // Provider
  BaseSelectors,
  TelemetryConfig,
  BaseProviderConfig,
  ChatGPTConfig,
  OpenCodeConfig,
} from "./provider.js";

export type {
  // Traffic
  ThinkingState,
  ThinkingIndicator,
  ThinkingEvent,
} from "./traffic.js";

export type {
  // Logging
  LogEntry,
  LogOperation,
  LogQueryFilter,
  LogStats,
  LogBatch,
  LogExportResult,
} from "./logging-core.js";

export {
  // Logging enums
  LogLevel,
  LogVisibility,
  LogCategory,
} from "./logging-core.js";
