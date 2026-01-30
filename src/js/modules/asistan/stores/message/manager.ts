/**
 * Message Store - Main Manager
 * 
 * Normalized message store with pub/sub pattern.
 * Coordinates all message, part, permission, and question operations.
 */

import type {
  MessageRecord,
  MessagePart,
  MessageUpsertInput,
  PartUpdateInput,
  PermissionState,
  QuestionState,
  StoreListener,
  OptimisticMessageInput,
  MessageErrorInfo,
  PermissionEntry,
  QuestionEntry,
  MessageStatus,
} from './types';
import { createId } from './id-generator';
import {
  createMessageRecord,
  updateMessageStatus,
  getMessageContent,
} from './message-operations';
import {
  createOptimisticMessage,
  markMessageSent,
  markMessageComplete,
  markMessageFailed,
  retryMessage,
} from './optimistic-updates';
import {
  addOrUpdatePart,
  updateTextPart,
  getMessageParts,
  // getPart, // Unused
} from './part-operations';
import {
  upsertPermission,
  removePermission,
  getActivePermission,
  getPermissionQueue,
  getPermissionForPart,
  clearPermissions,
} from './permission-queue';
import {
  upsertQuestion,
  removeQuestion,
  getActiveQuestion,
  getQuestionQueue,
  clearQuestions,
} from './question-queue';
import { EventBus } from './subscription';

const messageStore = {
  _messages: new Map<string, MessageRecord>(),
  _parts: new Map<string, MessagePart>(),
  _sessionMessages: new Map<string, string[]>(),
  _sessionRevisions: new Map<string, number>(),
  _eventBus: new EventBus(),
  _permissionState: {
    queue: [],
    active: null,
    byMessage: {},
  } as PermissionState,
  _questionState: {
    queue: [],
    active: null,
  } as QuestionState,

  // =========================================================================
  // Query Methods
  // =========================================================================

  getMessage(messageId: string): MessageRecord | null {
    return this._messages.get(messageId) || null;
  },

  getSessionMessages(sessionId: string) {
    const messageIds = this._sessionMessages.get(sessionId) || [];
    return messageIds
      .map((id) => this._messages.get(id))
      .filter(Boolean) as MessageRecord[];
  },

  getSessionMessageIds(sessionId: string) {
    return this._sessionMessages.get(sessionId) || [];
  },

  getMessageParts(messageId: string) {
    const message = this._messages.get(messageId);
    return message ? getMessageParts(message) : [];
  },

  getPart(partId: string) {
    return this._parts.get(partId);
  },

  getMessageContent(messageId: string) {
    const message = this._messages.get(messageId);
    return message ? getMessageContent(message) : '';
  },

  getSessionRevision(sessionId: string) {
    return this._sessionRevisions.get(sessionId) || 0;
  },

  hasMessage(messageId: string) {
    return this._messages.has(messageId);
  },

  // =========================================================================
  // Mutation Methods
  // =========================================================================

  upsertMessage(input: MessageUpsertInput) {
    const now = Date.now();
    const existing = this._messages.get(input.id);
    const record = createMessageRecord(input, now, existing);

    // Process initial parts if provided
    if (input.parts && input.parts.length > 0) {
      input.parts.forEach((part, index) => {
        const partId = part.id || `${input.id}-part-${index}-${now}`;
        const partRecord: MessagePart = {
          id: partId,
          messageId: input.id,
          type: part.type || 'text',
          revision: 0,
          text: part.text,
          toolCall: part.toolCall,
          thinking: part.thinking,
          step: part.step,
          createdAt: now,
          updatedAt: now,
        };
        record.parts[partId] = partRecord;
        if (!record.partIds.includes(partId)) {
          record.partIds.push(partId);
        }
        this._parts.set(partId, partRecord);
      });
    }

    this._messages.set(input.id, record);
    this._addMessageToSession(input.sessionId, input.id);
    this._bumpSessionRevision(input.sessionId);
    this._eventBus.notify({
      type: existing ? 'message:updated' : 'message:created',
      messageId: input.id,
      sessionId: input.sessionId,
    });

    return record;
  },

  updateMessageStatus(messageId: string, status: string) {
    const message = this._messages.get(messageId);
    if (!message) return;

    updateMessageStatus(message, status as MessageStatus);
    this._bumpSessionRevision(message.sessionId);
    this._eventBus.notify({
      type: 'message:updated',
      messageId,
      sessionId: message.sessionId,
    });
  },

  // =========================================================================
  // Optimistic Updates
  // =========================================================================

  createOptimisticMessage(input: OptimisticMessageInput) {
    return createOptimisticMessage(input, Date.now(), (cfg) =>
      this.upsertMessage(cfg)
    );
  },

  markMessageSent(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message) return;

    markMessageSent(message);
    this._bumpSessionRevision(message.sessionId);
    this._eventBus.notify({
      type: 'message:updated',
      messageId,
      sessionId: message.sessionId,
    });
  },

  markMessageComplete(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message) return;

    markMessageComplete(message);
    this._bumpSessionRevision(message.sessionId);
    this._eventBus.notify({
      type: 'message:updated',
      messageId,
      sessionId: message.sessionId,
    });
  },

  markMessageFailed(messageId: string, errorInfo?: MessageErrorInfo) {
    const message = this._messages.get(messageId);
    if (!message) return;

    markMessageFailed(message, errorInfo);
    this._bumpSessionRevision(message.sessionId);
    this._eventBus.notify({
      type: 'message:updated',
      messageId,
      sessionId: message.sessionId,
      error: errorInfo,
    });
  },

  getMessageError(messageId: string) {
    const message = this._messages.get(messageId);
    return message?.errorInfo;
  },

  retryMessage(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message) return false;

    const success = retryMessage(message);
    if (success) {
      this._bumpSessionRevision(message.sessionId);
      this._eventBus.notify({
        type: 'message:updated',
        messageId,
        sessionId: message.sessionId,
      });
    }
    return success;
  },

  // =========================================================================
  // Part Operations
  // =========================================================================

  addOrUpdatePart(input: PartUpdateInput) {
    const message = this._messages.get(input.messageId);
    if (!message) return null;

    const now = Date.now();
    const partRecord = addOrUpdatePart(message, input, now);

    if (partRecord) {
      this._parts.set(partRecord.id, partRecord);
      this._bumpSessionRevision(message.sessionId);
      this._eventBus.notify({
        type: 'part:updated',
        messageId: input.messageId,
        partId: partRecord.id,
        sessionId: message.sessionId,
      });
    }

    return partRecord;
  },

  updateTextPart(messageId: string, text: string, append = false) {
    const message = this._messages.get(messageId);
    if (!message) return;

    const now = Date.now();
    updateTextPart(message, text, append, now);
    this._bumpSessionRevision(message.sessionId);
    this._eventBus.notify({
      type: 'part:updated',
      messageId,
      sessionId: message.sessionId,
    });
  },

  replaceMessageId(options: { oldId: string; newId: string }) {
    const { oldId, newId } = options;
    if (oldId === newId) return;

    const message = this._messages.get(oldId);
    if (!message) return;

    const updated: MessageRecord = {
      ...message,
      id: newId,
      isEphemeral: false,
      updatedAt: Date.now(),
    };

    Object.keys(updated.parts).forEach((partId) => {
      const part = updated.parts[partId];
      if (part) {
        updated.parts[partId] = {
          ...part,
          messageId: newId,
        };
        const updatedPart = updated.parts[partId];
        if (updatedPart) this._parts.set(partId, updatedPart);
      }
    });

    this._messages.delete(oldId);
    this._messages.set(newId, updated);

    const sessionMsgs = this._sessionMessages.get(message.sessionId);
    if (sessionMsgs) {
      const index = sessionMsgs.indexOf(oldId);
      if (index !== -1) {
        sessionMsgs[index] = newId;
      }
    }

    this._bumpSessionRevision(message.sessionId);
    this._eventBus.notify({
      type: 'message:updated',
      messageId: newId,
      sessionId: message.sessionId,
    });
  },

  removeMessage(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message) return;

    message.partIds.forEach((partId) => this._parts.delete(partId));

    const sessionMsgs = this._sessionMessages.get(message.sessionId);
    if (sessionMsgs) {
      const index = sessionMsgs.indexOf(messageId);
      if (index !== -1) {
        sessionMsgs.splice(index, 1);
      }
    }

    this._messages.delete(messageId);
    this._bumpSessionRevision(message.sessionId);
    this._eventBus.notify({
      type: 'message:deleted',
      messageId,
      sessionId: message.sessionId,
    });
  },

  // =========================================================================
  // Permission Queue
  // =========================================================================

  upsertPermission(entry: PermissionEntry) {
    upsertPermission(this._permissionState, entry);
    this._eventBus.notify({
      type: 'permission:updated',
      permissionId: entry.permission.id,
    });
  },

  removePermission(permissionId: string) {
    removePermission(this._permissionState, permissionId);
    this._eventBus.notify({
      type: 'permission:removed',
      permissionId,
    });
  },

  getActivePermission() {
    return getActivePermission(this._permissionState);
  },

  getPermissionQueue() {
    return getPermissionQueue(this._permissionState);
  },

  getPermissionForPart(messageId: string, partId?: string) {
    return getPermissionForPart(this._permissionState, messageId, partId);
  },

  clearPermissions() {
    clearPermissions(this._permissionState);
    this._eventBus.notify({ type: 'permission:cleared' });
  },

  // =========================================================================
  // Question Queue
  // =========================================================================

  upsertQuestion(entry: QuestionEntry) {
    upsertQuestion(this._questionState, entry);
    this._eventBus.notify({
      type: 'question:updated',
      questionId: entry.id,
    });
  },

  removeQuestion(questionId: string) {
    removeQuestion(this._questionState, questionId);
    this._eventBus.notify({
      type: 'question:removed',
      questionId,
    });
  },

  getActiveQuestion() {
    return getActiveQuestion(this._questionState);
  },

  getQuestionQueue() {
    return getQuestionQueue(this._questionState);
  },

  clearQuestions() {
    clearQuestions(this._questionState);
    this._eventBus.notify({ type: 'question:cleared' });
  },

  // =========================================================================
  // Subscription
  // =========================================================================

  subscribe(listener: StoreListener) {
    return this._eventBus.subscribe(listener);
  },

  // =========================================================================
  // Utilities
  // =========================================================================

  clearSession(sessionId: string) {
    const messageIds = this._sessionMessages.get(sessionId) || [];

    messageIds.forEach((msgId) => {
      const message = this._messages.get(msgId);
      if (message) {
        message.partIds.forEach((partId) => this._parts.delete(partId));
      }
      this._messages.delete(msgId);
    });

    this._sessionMessages.delete(sessionId);
    this._sessionRevisions.delete(sessionId);
    this._eventBus.notify({ type: 'session:changed', sessionId });
  },

  clear() {
    this._messages.clear();
    this._parts.clear();
    this._sessionMessages.clear();
    this._sessionRevisions.clear();
    this._eventBus = new EventBus();
    this._eventBus.notify({ type: 'session:changed' });
  },

  getStats() {
    return {
      messageCount: this._messages.size,
      partCount: this._parts.size,
      sessionCount: this._sessionMessages.size,
      globalRevision: this._eventBus.getGlobalRevision(),
      listenerCount: this._eventBus.getListenerCount(),
    };
  },

  createId(prefix = 'msg') {
    return createId(prefix);
  },

  // =========================================================================
  // Private
  // =========================================================================

  _addMessageToSession(sessionId: string, messageId: string) {
    if (!this._sessionMessages.has(sessionId)) {
      this._sessionMessages.set(sessionId, []);
    }
    const list = this._sessionMessages.get(sessionId);
    if (list && !list.includes(messageId)) {
      list.push(messageId);
    }
  },

  _bumpSessionRevision(sessionId: string) {
    const current = this._sessionRevisions.get(sessionId) || 0;
    this._sessionRevisions.set(sessionId, current + 1);
  },
};

export { messageStore };
