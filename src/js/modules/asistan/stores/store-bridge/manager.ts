/**
 * Store Bridge - Main Manager
 * 
 * Bridges SSE events to the normalized stores.
 * Handles event mapping, echo filtering, and optimistic updates.
 */

import { InstanceStore } from '../instance-store.js';
import { SessionStore } from '../session-store.js';
import { MessageStore } from '../message/index';
import { createEventHandlers } from './event-handlers';
import {
  normalizeForComparison,
  isEcho,
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
  _handlers: null as any,

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

    // Route to appropriate handler
    switch (eventType) {
      // Message events
      case 'message.delta':
      case 'message.part.updated':
        this._handlers.handleMessageDelta(enrichedData);
        break;

      case 'message.start':
      case 'message.created':
        this._handlers.handleMessageStart(enrichedData);
        break;

      case 'message.end':
      case 'message.completed':
        this._handlers.handleMessageCompleted(enrichedData);
        break;

      // Tool events
      case 'tool.start':
        this._handlers.handleToolStart(enrichedData);
        break;

      case 'tool.output':
        this._handlers.handleToolOutput(enrichedData);
        break;

      case 'tool.end':
        this._handlers.handleToolEnd(enrichedData);
        break;

      // Thinking events
      case 'thinking.start':
        this._handlers.handleThinkingStart(enrichedData);
        break;

      case 'thinking.delta':
        this._handlers.handleThinkingDelta(enrichedData);
        break;

      case 'thinking.end':
        this._handlers.handleThinkingEnd(enrichedData);
        break;

      // Session events
      case 'session.started':
        this._handlers.handleSessionStarted(enrichedData);
        break;

      case 'session.stopped':
      case 'session.idle':
      case 'session.completed':
        this._handlers.handleSessionIdle(enrichedData);
        break;

      // Status events
      case 'status.change':
        this._handlers.handleStatusChange(enrichedData);
        break;

      // Permission events
      case 'permission.requested':
        this._handlers.handlePermissionRequested(enrichedData);
        break;

      case 'permission.resolved':
        this._handlers.handlePermissionResolved(enrichedData);
        break;

      // Question events
      case 'question.requested':
        this._handlers.handleQuestionRequested(enrichedData);
        break;

      case 'question.answered':
        this._handlers.handleQuestionAnswered(enrichedData);
        break;

      // Step events
      case 'step.start':
        this._handlers.handleStepStart(enrichedData);
        break;

      case 'step.finish':
        this._handlers.handleStepFinish(enrichedData);
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

  markUserMessageFailed(messageId: string, errorInfo?: any) {
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
    if (this._handlers) {
      (this._handlers as any).debug = enabled;
    }
  },
};

export { StoreBridge };

// Global compatibility
(window as any).StoreBridge = StoreBridge;
