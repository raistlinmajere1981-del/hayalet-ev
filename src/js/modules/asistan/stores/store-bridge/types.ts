/**
 * Store Bridge - Type Definitions
 */

export interface EchoFilterState {
  lastUserMessage: string | null;
  lastUserMessageByInstance: Map<string, string>;
  echoTimeoutByInstance: Map<string, NodeJS.Timeout>;
  ignoredMessageIds: Set<string>;
}

export interface StreamingState {
  currentMessageId: string | null;
  currentMessageByInstance: Map<string, string | null>;
  pendingIdReplacements: Map<string, null>;
}

export interface ToolCallData {
  toolId: string;
  toolName: string;
  status: 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  output?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ThinkingData {
  content: string;
  isComplete?: boolean;
}

export interface StepData {
  stepId: string;
  status: 'start' | 'finish';
  startedAt?: number;
  finishedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}

export interface DiffViewerData {
  filename: string;
  oldContent: string;
  newContent: string;
  unifiedDiff: string;
}

export interface SessionData {
  id: string;
  title?: string;
  messages?: Array<{
    id?: string;
    role: string;
    content: string;
    timestamp?: number;
  }>;
}

export interface PermissionData {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  metadata?: unknown;
  risk?: string;
}

export interface QuestionData {
  id: string;
  text: string;
  type?: string;
  options?: unknown[];
  default?: unknown;
}
