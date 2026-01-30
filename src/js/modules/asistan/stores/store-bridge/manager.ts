/**
 * Store Bridge - Main Manager
 * 
 * Bridges SSE events to the normalized stores.
 * Handles event mapping, echo filtering, and optimistic updates.
 */

import { InstanceStore } from '../instance-store.js';
import { SessionStore } from '../session-store.js';
import { MessageStore } from '../message/index';
import type { MessageErrorInfo } from '../message/types';
import { createEventHandlers } from './event-handlers';
import {
  // normalizeForComparison, // Unused
  // isEcho, // Unused
  createEchoFilterState,
  clearEchoFilter,
} from './utils';
import {
  addOptimisticUserMessage,
  markUserMessageSent,
  markUserMessageFailed,
  retryMessage,
  replaceMessageId,
  getPendingMessageContent,
  setLastUserMessage,
} from './optimistic-updates';

const echoFilterState = createEchoFilterState();

const streamingState = {
  currentMessageId: null as string | null,
  currentMessageByInstance: new Map<string, string | null>(),
  pendingIdReplacements: new Map<string, null>(),
};

const StoreBridge = {
  _debug: false,
  _echoFilterState: echoFilterState,
  _streamingState: streamingState,

  // Create event handler functions
  _handlers: null as ReturnType<typeof createEventHandlers> | null,

  _initHandlers() {
    if (!this._handlers) {
      this._handlers = createEventHandlers({
        MessageStore,
        SessionStore,
        InstanceStore,
        PartNormalizer: (window as any).PartNormalizer,
        ToolRenderer: (window as any).ToolRenderer,
        get currentMessageId() {
          return StoreBridge._streamingState.currentMessageId;
        },
        set currentMessageId(value: string | null) {
          StoreBridge._streamingState.currentMessageId = value;
        },
        debug: this._debug,
      });
    }
  },

  /**
   * Main event handler - dispatches to appropriate handler
   */
  handleEvent(eventType: string, data: unknown, instanceId: string | null = null) {
    this._initHandlers();

    const dataObj = (data || {}) as Record<string, unknown>;
    const resolvedInstanceId =
      instanceId || (dataObj.instanceId as string | null) || InstanceStore?.getActiveInstanceId?.();

    const enrichedData = { ...dataObj, instanceId: resolvedInstanceId };

    if (this._debug) {
      console.log('[StoreBridge] Event:', eventType, enrichedData);
    }

    // Route to appropriate handler (handlers is guaranteed non-null after _initHandlers)
    const handlers = this._handlers!;
    switch (eventType) {
      // Message events
      case 'message.delta':
      case 'message.part.updated':
        handlers.handleMessageDelta(enrichedData);
        break;

      case 'message.start':
      case 'message.created':
        handlers.handleMessageStart(enrichedData);
        break;

      case 'message.end':
      case 'message.completed':
        handlers.handleMessageCompleted(enrichedData);
        break;

      // Tool events
      case 'tool.start':
        handlers.handleToolStart(enrichedData);
        break;

      case 'tool.output':
        handlers.handleToolOutput(enrichedData);
        break;

      case 'tool.end':
        handlers.handleToolEnd(enrichedData);
        break;

      // Thinking events
      case 'thinking.start':
        handlers.handleThinkingStart(enrichedData);
        break;

      case 'thinking.delta':
        handlers.handleThinkingDelta(enrichedData);
        break;

      case 'thinking.end':
        handlers.handleThinkingEnd(enrichedData);
        break;

      // Session events
      case 'session.started':
        handlers.handleSessionStarted(enrichedData);
        break;

      case 'session.stopped':
      case 'session.idle':
      case 'session.completed':
        handlers.handleSessionIdle(enrichedData);
        break;

      // Status events
      case 'status.change':
        handlers.handleStatusChange(enrichedData);
        break;

      // Permission events
      case 'permission.requested':
        handlers.handlePermissionRequested(enrichedData);
        break;

      case 'permission.resolved':
        handlers.handlePermissionResolved(enrichedData);
        break;

      // Question events
      case 'question.requested':
        handlers.handleQuestionRequested(enrichedData);
        break;

      case 'question.answered':
        handlers.handleQuestionAnswered(enrichedData);
        break;

      // Step events
      case 'step.start':
        handlers.handleStepStart(enrichedData);
        break;

      case 'step.finish':
        handlers.handleStepFinish(enrichedData);
        break;

      default:
        if (this._debug) {
          console.log('[StoreBridge] Unhandled event:', eventType);
        }
    }
  },

  /**
   * Optimistic Updates API
   */

  setLastUserMessage(message: string, instanceId = 'default') {
    setLastUserMessage(this._echoFilterState, message, instanceId);
  },

  addOptimisticUserMessage(content: string, messageId?: string) {
    const tempId = addOptimisticUserMessage(MessageStore, SessionStore, content, messageId);
    this._streamingState.pendingIdReplacements.set(tempId, null);
    setLastUserMessage(this._echoFilterState, content);
    return tempId;
  },

  markUserMessageSent(messageId: string) {
    markUserMessageSent(MessageStore, messageId);
    this._streamingState.pendingIdReplacements.delete(messageId);
  },

  markUserMessageFailed(messageId: string, errorInfo?: MessageErrorInfo) {
    markUserMessageFailed(MessageStore, SessionStore, messageId, errorInfo);
    this._streamingState.pendingIdReplacements.delete(messageId);
  },

  retryMessage(messageId: string) {
    const success = retryMessage(MessageStore, SessionStore, messageId);
    if (success) {
      this._streamingState.pendingIdReplacements.set(messageId, null);
    }
    return success;
  },

  replaceMessageId(tempId: string, realId: string) {
    replaceMessageId(MessageStore, tempId, realId);
    this._streamingState.pendingIdReplacements.delete(tempId);
  },

  getPendingMessageContent(messageId: string) {
    return getPendingMessageContent(MessageStore, messageId);
  },

  hasPendingMessages() {
    return this._streamingState.pendingIdReplacements.size > 0;
  },

  /**
   * Utilities
   */

  getCurrentMessageId() {
    return this._streamingState.currentMessageId;
  },

  clear() {
    clearEchoFilter(this._echoFilterState);
    this._streamingState.currentMessageId = null;
    this._streamingState.currentMessageByInstance.clear();
    this._streamingState.pendingIdReplacements.clear();
  },

  setDebug(enabled: boolean) {
    this._debug = enabled;
    // Note: handlers don't have a debug property, they use the deps.debug getter
  },
};

export { StoreBridge };

// Global compatibility
(window as any).StoreBridge = StoreBridge;
