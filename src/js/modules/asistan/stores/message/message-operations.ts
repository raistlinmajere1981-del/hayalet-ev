/**
 * Message Store - Message Operations
 * 
 * Core message CRUD operations: create, read, update
 */

import type {
  MessageRecord,
  MessageStatus,
  MessageUpsertInput,
} from './types.ts';

export function createMessageRecord(
  input: MessageUpsertInput,
  now: number,
  existing?: MessageRecord
): MessageRecord {
  return {
    id: input.id,
    sessionId: input.sessionId,
    role: input.role as 'user' | 'assistant' | 'system',
    status: (input.status || existing?.status || 'streaming') as MessageStatus,
    revision: existing ? existing.revision + 1 : 0,
    isEphemeral: input.isEphemeral ?? existing?.isEphemeral ?? false,
    partIds: existing?.partIds || [],
    parts: existing?.parts || {},
    createdAt: input.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function updateMessageStatus(
  message: MessageRecord,
  status: MessageStatus
): void {
  message.status = status;
  message.revision += 1;
  message.updatedAt = Date.now();

  if (status === 'complete') {
    message.isEphemeral = false;
  }
}

export function getMessageContent(message: MessageRecord): string {
  return Object.values(message.parts)
    .filter((p) => p.type === 'text')
    .map((p) => p.text || '')
    .join('');
}
