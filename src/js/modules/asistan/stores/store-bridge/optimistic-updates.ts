/**
 * Store Bridge - Optimistic Updates
 * 
 * User message operations: create, mark sent, mark failed, retry
 */

import type {
  OptimisticMessageInput,
  OptimisticMessageResult,
  MessageErrorInfo,
  ReplaceMessageIdOptions,
  SessionStatus,
} from '../message/types';

// ============================================================================
// Store Interface Types
// ============================================================================

interface MessageStoreAPI {
  createOptimisticMessage?: (input: OptimisticMessageInput) => OptimisticMessageResult;
  markMessageSent?: (messageId: string) => void;
  markMessageFailed?: (messageId: string, errorInfo?: MessageErrorInfo) => void;
  retryMessage?: (messageId: string) => boolean;
  replaceMessageId?: (options: ReplaceMessageIdOptions) => void;
  getMessageContent?: (messageId: string) => string | null;
}

interface SessionStoreAPI {
  getCurrentSessionId?: () => string | null;
  updateStatus?: (status: SessionStatus) => void;
}

interface EchoFilterState {
  lastUserMessage: string | null;
  lastUserMessageByInstance: Map<string, string>;
  echoTimeoutByInstance: Map<string, NodeJS.Timeout>;
  ignoredMessageIds: Set<string>;
}

// ============================================================================
// Optimistic Update Functions
// ============================================================================

export function addOptimisticUserMessage(
  MessageStore: MessageStoreAPI,
  SessionStore: SessionStoreAPI,
  content: string,
  messageId?: string
): string {
  const sessionId = SessionStore?.getCurrentSessionId?.() || 'default';

  const { tempId } = MessageStore?.createOptimisticMessage?.({  
    sessionId,
    role: 'user',
    content,
    tempId: messageId,
  }) || { tempId: messageId || `msg-${Date.now()}` };

  SessionStore?.updateStatus?.('processing');

  return tempId;
}

export function markUserMessageSent(MessageStore: MessageStoreAPI, messageId: string) {
  MessageStore?.markMessageSent?.(messageId);
}

export function markUserMessageFailed(
  MessageStore: MessageStoreAPI,
  SessionStore: SessionStoreAPI,
  messageId: string,
  errorInfo?: MessageErrorInfo
) {
  const defaultError: MessageErrorInfo = {
    code: 'SEND_FAILED',
    message: 'Mesaj gönderilemedi',
    retryable: true,
  };

  MessageStore?.markMessageFailed?.(messageId, errorInfo || defaultError);
  SessionStore?.updateStatus?.('idle');
}

export function retryMessage(
  MessageStore: MessageStoreAPI,
  SessionStore: SessionStoreAPI,
  messageId: string
): boolean {
  const success = MessageStore?.retryMessage?.(messageId);
  if (success) {
    SessionStore?.updateStatus?.('processing');
  }
  return success || false;
}

export function replaceMessageId(
  MessageStore: MessageStoreAPI,
  tempId: string,
  realId: string
) {
  MessageStore?.replaceMessageId?.({ oldId: tempId, newId: realId });
}

export function getPendingMessageContent(
  MessageStore: MessageStoreAPI,
  messageId: string
): string | null {
  return MessageStore?.getMessageContent?.(messageId) || null;
}

export function setLastUserMessage(
  state: EchoFilterState,
  message: string,
  instanceId = 'default'
) {
  const normalizedMessage = (message || '').trim();
  state.lastUserMessage = normalizedMessage;
  state.lastUserMessageByInstance.set(instanceId, normalizedMessage);

  // Clear existing timeout
  const existingTimeout = state.echoTimeoutByInstance.get(instanceId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Auto-clear after 30 seconds
  const timeoutId = setTimeout(() => {
    if (state.lastUserMessage === normalizedMessage) {
      state.lastUserMessage = null;
    }
    state.lastUserMessageByInstance.delete(instanceId);
    state.echoTimeoutByInstance.delete(instanceId);
  }, 30000);

  state.echoTimeoutByInstance.set(instanceId, timeoutId);
}
