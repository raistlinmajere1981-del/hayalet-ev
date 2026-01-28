/**
 * Types for Message Renderer
 */
export interface MessageRecord {
  id: string;
  sessionId?: string;
  role?: string;
  content?: string;
  status?: string;
  revision?: number;
  parts?: Record<string, MessagePart> | MessagePart[];
  timestamp?: number;
  createdAt?: number;
  [key: string]: unknown;
}

export interface StepData {
  id: string;
  status?: 'start' | 'finish';
  startedAt?: number;
  finishedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}

export interface ToolCallData {
  toolId?: string;
  output?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  description?: string;
}

export interface ThinkingData {
  content?: string;
  isComplete?: boolean;
}

export interface MessagePart {
  type?: string;
  content?: string;
  status?: string;
  step?: StepData;
  toolCall?: {
    toolId?: string;
    toolName?: string;
    status?: string;
    input?: unknown;
    output?: string;
  };
  thinking?: ThinkingData;
}

export interface StoreEvent {
  type: string;
  messageId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface MessageRendererOptions {
  reactive?: boolean;
}
