/**
 * Store Bridge - Optimistic Updates
 * 
 * User message operations: create, mark sent, mark failed, retry
 */

export function addOptimisticUserMessage(
  MessageStore: any,
  SessionStore: any,
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

export function markUserMessageSent(MessageStore: any, messageId: string) {
  MessageStore?.markMessageSent?.(messageId);
}

export function markUserMessageFailed(
  MessageStore: any,
  SessionStore: any,
  messageId: string,
  errorInfo?: { code?: string; message?: string; retryable?: boolean }
) {
  const defaultError = {
    code: 'SEND_FAILED',
    message: 'Mesaj gönderilemedi',
    retryable: true,
  };

  MessageStore?.markMessageFailed?.(messageId, errorInfo || defaultError);
  SessionStore?.updateStatus?.('idle');
}

export function retryMessage(MessageStore: any, SessionStore: any, messageId: string): boolean {
  const success = MessageStore?.retryMessage?.(messageId);
  if (success) {
    SessionStore?.updateStatus?.('processing');
  }
  return success;
}

export function replaceMessageId(MessageStore: any, tempId: string, realId: string) {
  MessageStore?.replaceMessageId?.({ oldId: tempId, newId: realId });
}

export function getPendingMessageContent(MessageStore: any, messageId: string): string | null {
  return MessageStore?.getMessageContent?.(messageId) || null;
}

export function setLastUserMessage(
  state: any,
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
