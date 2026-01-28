/**
 * OpenCode SSE Server - Type Definitions
 */

import type { ServerResponse } from 'http';
import type { NativeUIEvent } from '../opencode-event-parser.ts';

/** SSE Event tipleri - CodeNomad uyumlu */
export type SSEEventType =
  | 'session.started'
  | 'session.stopped'
  | 'session.error'
  | 'session.updated'
  | 'session.completed'
  | 'session.compacted'
  | 'message.start'
  | 'message.created'
  | 'message.delta'
  | 'message.end'
  | 'message.completed'
  | 'message.removed'
  | 'message.part.removed'
  | 'tool.start'
  | 'tool.output'
  | 'tool.end'
  | 'permission.request'
  | 'permission.resolved'
  | 'permission.updated'
  | 'permission.replied'
  | 'permission.requested'
  | 'question.ask'
  | 'question.asked'
  | 'question.replied'
  | 'question.requested'
  | 'question.answered'
  | 'thinking.start'
  | 'thinking.delta'
  | 'thinking.end'
  | 'step.start'
  | 'step.finish'
  | 'status.change'
  | 'error'
  | 'heartbeat';

/** SSE Event payload */
export interface SSEEvent {
  type: SSEEventType;
  timestamp: number;
  sessionId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}

/** Connected SSE client */
export interface SSEClient {
  id: number;
  response: ServerResponse;
  connectedAt: number;
}

/** Server configuration */
export interface SSEServerConfig {
  port: number;
  host: string;
  corsOrigin: string;
}

/** Permission request data */
export interface PermissionEventData {
  permissionId: string;
  toolName: string;
  description: string;
  risk: string;
}

/** Question event data */
export interface QuestionEventData {
  questionId: string;
  question: string;
  options?: Array<{ label: string; value: string }>;
  allowFreeform?: boolean;
}

export type { NativeUIEvent };
