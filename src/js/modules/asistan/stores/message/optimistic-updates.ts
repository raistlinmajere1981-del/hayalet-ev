/**
 * Message Store - Optimistic Updates
 * 
 * Ephemeral messages for immediate UI feedback (FAZ 3 pattern)
 */

import type {
  MessageRecord,
  OptimisticMessageInput,
  OptimisticMessageResult,
  MessageErrorInfo,
} from './types.ts';

export function createOptimisticMessage(
  input: OptimisticMessageInput,
  now: number,
  upsertMessage: (config: any) => MessageRecord
): OptimisticMessageResult {
  const tempId = input.tempId || `msg_temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const record = upsertMessage({
    id: tempId,
    sessionId: input.sessionId,
    role: input.role,
    status: 'sending',
    isEphemeral: true,
    parts: [{ type: 'text', text: input.content }],
    createdAt: now,
  });

  return { tempId, record };
}

export function markMessageSent(message: MessageRecord): void {
  message.status = 'sent';
  message.revision += 1;
  message.updatedAt = Date.now();
}

export function markMessageComplete(message: MessageRecord): void {
  message.status = 'complete';
  message.isEphemeral = false;
  message.revision += 1;
  message.updatedAt = Date.now();
}

export function markMessageFailed(
  message: MessageRecord,
  errorInfo?: MessageErrorInfo
): void {
  message.status = 'error';
  message.revision += 1;
  message.updatedAt = Date.now();

  if (errorInfo) {
    message.errorInfo = errorInfo;
  }
}

export function retryMessage(message: MessageRecord): boolean {
  if (message.status !== 'error') return false;

  message.status = 'sending';
  message.isEphemeral = true;
  message.revision += 1;
  message.updatedAt = Date.now();
  delete message.errorInfo;

  return true;
}
