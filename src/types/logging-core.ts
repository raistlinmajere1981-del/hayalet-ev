/**
 * Hayalet-ev Unified Logging System - Core Types
 *
 * Single source of truth for all logging types across:
 * - Renderer process (src/)
 * - Main process (electron/)
 * - MCP server (mcp-server/)
 *
 * @module @types/logging/core
 * @version 2.0.0
 */

/**
 * Standardized log levels
 * Mapping: console.log → DEBUG, console.info → INFO, etc.
 */
export enum LogLevel {
  DEBUG = "debug", // Verbose output, console.debug
  INFO = "info", // General info, console.log/info
  SUCCESS = "success", // Successful operations (custom)
  WARNING = "warning", // Degraded state, console.warn
  ERROR = "error", // Failures, console.error
}

/**
 * UI visibility levels (hierarchical)
 * Level 1 (TOAST) is most visible, Level 3 (VERBOSE) is least
 */
export enum LogVisibility {
  TOAST = 1, // User notifications (success, error alerts)
  PANEL = 2, // Process status (slot assigned, sync started)
  VERBOSE = 3, // Debug only (state transitions, internal ops)
}

/**
 * Standardized log categories (source taxonomy)
 * Use dot notation for subcategories: 'provider:chatgpt', 'ui:toast'
 */
export enum LogCategory {
  SYSTEM = "system",
  RENDERER = "renderer",
  MAIN = "main",
  MCP = "mcp",

  UI = "ui",
  UI_TOAST = "ui:toast",
  UI_MODAL = "ui:modal",
  UI_THEME = "ui:theme",
  UI_SPLASH = "ui:splash",
  UI_ANIMATION = "ui:animation",
  UI_AUDIO = "ui:audio",
  UI_CANVAS = "ui:canvas",

  WEBVIEW = "webview",
  SLOT = "slot",
  TRAFFIC = "traffic",
  RELAY = "relay",
  COMMAND = "command",
  META_COMMAND = "meta-command",
  SERVER_COMMANDS = "server-commands",
  CATCH_MANAGER = "catch-manager",

  PROVIDER_CHATGPT = "provider:chatgpt",
  PROVIDER_GEMINI = "provider:gemini",
  PROVIDER_GROK = "provider:grok",
  PROVIDER_OPENCODE = "provider:opencode",
  PROVIDER_GENERIC = "provider:generic",

  ASSISTANT_CORE = "assistant:core",
  ASSISTANT_STORE = "assistant:store",
  ASSISTANT_MESSAGE = "assistant:message",
  ASSISTANT_SESSION = "assistant:session",
  ASSISTANT_UI = "assistant:ui",
  ASSISTANT_SSE = "assistant:sse",
  ASSISTANT_TOOL = "assistant:tool",
  ASSISTANT_PROVIDER = "assistant:provider",

  IPC = "ipc",
  DATABASE = "database",
  FILE_MANAGER = "file-manager",
  SCREENSHOT = "screenshot",
  WHISPER = "whisper",
  SETTINGS = "settings",
  WORKSPACE = "workspace",

  // Page-specific categories
  ENTRANCE = "entrance",
  ANALYZE = "analyze",
  ARCHIVES = "archives",

  LEGACY = "legacy", // Migrated console.* calls (temporary)
  MIGRATION = "migration", // Migration process logs
  TEST = "test", // Test execution
  UNKNOWN = "unknown", // Fallback
}

/**
 * Unified log entry structure
 * Used across renderer, main, and MCP
 */
export interface LogEntry {
  timestamp: string; // ISO 8601 format
  level: LogLevel;
  category: LogCategory | string; // Allow custom categories
  message: string;

  visibility?: LogVisibility; // UI display level (1-3)
  correlationId?: string; // Track operation flow
  sessionId?: string; // Log session ID

  context?: {
    // Common fields
    provider?: string; // Provider name (chatgpt, gemini)
    slotId?: string; // Slot identifier (AI1, AI2)
    userId?: string; // User/account ID
    url?: string; // Page URL
    selector?: string; // DOM selector

    // Webview specific
    webviewId?: string;
    loadState?: string;

    // Operation specific
    operationName?: string;
    operationStep?: string;

    // Performance
    duration?: number; // Operation duration (ms)
    memoryUsage?: number; // Memory snapshot (MB)

    // Custom fields
    [key: string]: unknown;
  };

  error?: {
    name: string; // Error class name
    message: string; // Error message
    stack?: string; // Stack trace
    code?: string; // Error code (if available)
    cause?: unknown; // Error cause chain
  };

  aiHint?: {
    category: string; // Error category
    suggestion: string; // Fix suggestion
    documentationLink?: string; // Relevant docs
    fixCommand?: string; // MCP tool to fix
    confidence?: number; // 0-1, hint confidence
  };

  isoTimestamp?: string; // Alias for timestamp (legacy)
  source?: string; // Process source (renderer/main/mcp)
  type?: string; // Legacy type field (deprecated)
  meta?: Record<string, unknown>; // Legacy metadata (deprecated)
}

/**
 * Operation tracking for correlation
 */
export interface LogOperation {
  id: string; // Unique correlation ID
  name: string; // Operation name
  category: LogCategory | string;
  startTime: number; // Performance.now() or Date.now()
  context?: Record<string, unknown>;

  // Updated on completion
  endTime?: number;
  status?: "success" | "failed" | "timeout" | "cancelled";
  result?: string;
}

/**
 * Log query filters (for readers)
 */
export interface LogQueryFilter {
  // Time range
  timeRange?: {
    from: string; // ISO 8601
    to: string; // ISO 8601
  };

  // Level/category filters
  levels?: LogLevel[];
  categories?: (LogCategory | string)[];
  visibility?: LogVisibility[];

  // Text search
  contains?: string; // Message contains
  regex?: string; // Regex pattern

  // Context filters
  correlationId?: string;
  sessionId?: string;
  provider?: string;
  slotId?: string;

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sortBy?: "timestamp" | "level" | "category";
  sortOrder?: "asc" | "desc";
}

/**
 * Log statistics (for analysis)
 */
export interface LogStats {
  totalCount: number;
  timeRange: { from: string; to: string };

  // By level
  byLevel: Record<LogLevel, number>;

  // By category
  byCategory: Array<{ category: string; count: number }>;

  // Error clustering
  errorClusters?: Array<{
    pattern: string;
    count: number;
    examples: LogEntry[];
  }>;

  // Performance
  averageDuration?: number;
  peakMemoryUsage?: number;
}

/**
 * Batch log payload (for IPC optimization)
 */
export interface LogBatch {
  entries: LogEntry[];
  sessionId: string;
  batchTimestamp: string;
  processSource: "renderer" | "main";
}

/**
 * Export format options
 */
export type LogExportFormat = "json" | "jsonl" | "csv" | "txt";

/**
 * Export result
 */
export interface LogExportResult {
  format: LogExportFormat;
  outputPath: string;
  totalExported: number;
  fileSize: number; // Bytes
  duration: number; // ms
}

/**
 * Type guards
 */
export const isLogEntry = (obj: unknown): obj is LogEntry => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "timestamp" in obj &&
    "level" in obj &&
    "category" in obj &&
    "message" in obj
  );
};

export const isValidLogLevel = (level: string): level is LogLevel => {
  return Object.values(LogLevel).includes(level as LogLevel);
};

export const isValidVisibility = (vis: number): vis is LogVisibility => {
  return vis === 1 || vis === 2 || vis === 3;
};
