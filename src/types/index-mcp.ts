/**
 * MCP Server Type Definitions
 */

// === Enhanced Tool Metadata Types (Phase 1.1) ===
export * from "./tool-metadata-mcp.js";

// CDP Types
export interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export interface CDPConnection {
  ws: WebSocket | null;
  connected: boolean;
  messageId: number;
  pendingRequests: Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
  >;
}

export interface CDPResponse {
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
  method?: string;
  params?: Record<string, unknown>;
}

// Tool Types
export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/** Tool arguments - generic */
export type ToolArgs = Record<string, unknown>;

export interface ToolHandler {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

// Log Types
export interface LogEntry {
  timestamp: string;
  level: string;
  source?: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface LogSession {
  id: string;
  startTime: string;
  endTime?: string;
  entries: LogEntry[];
}

// Provider Types
export interface ProviderInfo {
  name: string;
  url: string;
  active: boolean;
}

// ============================================
// Filesystem Tool Types
// ============================================

/** File content result */
export interface FileContent {
  path: string;
  content: string;
  lineCount: number;
  isCollapsed: boolean;
  error?: string;
}

/** Code chunk (used by expand) */
export interface CodeChunk {
  startLine: number;
  endLine: number;
  content: string;
  symbol?: string;
}

/** Grep result */
export interface GrepMatch {
  file: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

export interface GrepResult {
  pattern: string;
  matches: GrepMatch[];
  totalMatches: number;
  filesSearched: number;
}

/** Folder entry */
export interface FolderEntry {
  name: string;
  type: "file" | "directory";
  path: string;
  size?: number;
  children?: FolderEntry[];
}

/** Bash command result */
export interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  pid?: number;
  timedOut?: boolean;
}

/** Find & Replace result */
export interface ReplaceResult {
  file: string;
  replacements: number;
  success: boolean;
  error?: string;
  preview?: string; // Preview for dry-run mode
  contextPreview?: string; // Context around the changed region (±5 lines)
}

/** Technical plan types */
export interface CodeSnippet {
  startLine: number;
  endLine: number;
  code: string;
}

export interface FileChange {
  filePath: string;
  descriptionOfChange: string;
  clarifyingQuestionIfAny?: string;
  codeSnippetsToChange?: CodeSnippet[];
}

export interface LogicalChange {
  summary: string;
  filesToChange: FileChange[];
}

export interface TechnicalPlan {
  logicalChanges: LogicalChange[];
}

/** Code structure for collapsed view */
export interface CodeStructure {
  type: "function" | "class" | "method" | "interface" | "type" | "const" | "variable";
  name: string;
  startLine: number;
  endLine: number;
  signature?: string;
  children?: CodeStructure[];
}
