/**
 * MCP Server Type Definitions
 */

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
