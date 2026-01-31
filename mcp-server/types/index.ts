/**
 * MCP Server Type Definitions
 */

// === Enhanced Tool Metadata Types (Phase 1.1) ===
export * from '../core/types/tool-metadata.js';

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
  pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>;
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

/** Dosya içeriği sonucu */
export interface FileContent {
  path: string;
  content: string;
  lineCount: number;
  isCollapsed: boolean;
  error?: string;
}

/** Kod parçası (expand için) */
export interface CodeChunk {
  startLine: number;
  endLine: number;
  content: string;
  symbol?: string;
}

/** Grep sonucu */
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

/** Klasör içeriği */
export interface FolderEntry {
  name: string;
  type: "file" | "directory";
  path: string;
  size?: number;
  children?: FolderEntry[];
}

/** Bash komut sonucu */
export interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  pid?: number;
  timedOut?: boolean;
}

/** Find & Replace sonucu */
export interface ReplaceResult {
  file: string;
  replacements: number;
  success: boolean;
  error?: string;
  preview?: string;  // Dry run mode için önizleme
  contextPreview?: string; // Değişiklik bölgesinin context'i (±5 satır)
}

/** Technical Plan tipleri */
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

/** Collapsed view için kod yapısı */
export interface CodeStructure {
  type: "function" | "class" | "method" | "interface" | "type" | "const" | "variable";
  name: string;
  startLine: number;
  endLine: number;
  signature?: string;
  children?: CodeStructure[];
}
