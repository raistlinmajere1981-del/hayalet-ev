/**
 * Types - OpenCodeApp interfaces and event data
 */

export interface SSEEventData {
  sessionId?: string;
  status?: string;
  data?: Record<string, unknown>;
  attempt?: number;
  maxAttempts?: number;
  [key: string]: unknown;
}

export interface PermissionRequestData {
  id?: string;
  partId?: string;
  messageId?: string;
  permission?: { id: string; type?: string; path?: string; command?: string };
  permissionId?: string;
  toolName?: string;
  description?: string;
  risk?: string;
}

export interface QuestionData {
  id?: string;
  questionId?: string;
  question?: string;
  options?: Array<{ label: string; value: string }>;
  allowFreeform?: boolean;
}

export interface SessionRecord {
  id: string;
  title?: string;
  status?: string;
  messageIds?: string[];
  updatedAt?: number;
}

export interface InstanceInfo {
  id: string;
  folder: string;
  name: string;
  status?: string;
  url?: string;
}

export interface ModelInfo {
  model?: {
    id: string;
    name?: string;
    providerId: string;
  };
  provider?: string;
}
