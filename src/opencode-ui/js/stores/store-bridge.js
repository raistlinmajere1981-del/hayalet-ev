/**
 * OpenCode UI - Store Bridge
 * 
 * Bridges SSE events to the normalized stores.
 * Handles event mapping, echo filtering, and optimistic updates.
 * 
 * Adapted from CodeNomad's message-v2/bridge.ts
 */

const StoreBridge = {
  // ===========================================================================
  // State
  // ===========================================================================

  /** @type {string} Last sent user message (for echo filtering) */
  _lastUserMessage: '',

  /** @type {string | null} Current streaming message ID */
  _currentMessageId: null,

  /** @type {Map<string, string>} Temp ID -> Real ID mapping */
  _pendingIdReplacements: new Map(),

  /** @type {Set<string>} Message IDs to ignore (user message echoes) */
  _ignoredMessageIds: new Set(),

  /** @type {boolean} Debug mode */
  _debug: false,

  // ===========================================================================
  // Main Event Handler
  // ===========================================================================

  /**
   * Handle SSE event and dispatch to appropriate store
   * @param {string} eventType - SSE event type
   * @param {Object} data - Event data
   */
  handleEvent(eventType, data) {
    if (this._debug) {
      console.log('[StoreBridge] Event:', eventType, data);
    }

    switch (eventType) {
      // Message events
      case 'message.delta':
      case 'message.part.updated':
        this._handleMessageDelta(data);
        break;

      case 'message.start':
      case 'message.created':
        this._handleMessageStart(data);
        break;

      case 'message.end':
      case 'message.completed':
        this._handleMessageCompleted(data);
        break;

      // Tool events
      case 'tool.start':
        this._handleToolStart(data);
        break;

      case 'tool.output':
        this._handleToolOutput(data);
        break;

      case 'tool.end':
        this._handleToolEnd(data);
        break;

      // Thinking events
      case 'thinking.start':
        this._handleThinkingStart(data);
        break;

      case 'thinking.delta':
        this._handleThinkingDelta(data);
        break;

      case 'thinking.end':
        this._handleThinkingEnd(data);
        break;

      // Session events
      case 'session.started':
        this._handleSessionStarted(data);
        break;

      case 'session.stopped':
      case 'session.idle':
      case 'session.completed':
        this._handleSessionIdle(data);
        break;

      // Status events
      case 'status.change':
        this._handleStatusChange(data);
        break;

      default:
        if (this._debug) {
          console.log('[StoreBridge] Unhandled event:', eventType);
        }
    }
  },

  // ===========================================================================
  // Message Event Handlers
  // ===========================================================================

  /**
   * Handle message delta (streaming text)
   * @param {Object} data
   */
  _handleMessageDelta(data) {
    const { messageId, delta, role, fullContent } = data || {};
    
    if (!messageId) return;

    // Skip already ignored message IDs
    if (this._ignoredMessageIds.has(messageId)) {
      return;
    }

    // Skip user role messages (these are echoes)
    if (role === 'user') {
      this._ignoredMessageIds.add(messageId);
      if (this._debug) {
        console.log('[StoreBridge] Ignoring user message (echo):', messageId);
      }
      return;
    }

    // Echo filtering: Skip if content matches last sent user message
    const contentToCheck = fullContent || delta;
    if (contentToCheck && this._isEcho(contentToCheck)) {
      this._ignoredMessageIds.add(messageId); // Ignore future events for this message
      if (this._debug) {
        console.log('[StoreBridge] Echo filtered, ignoring messageId:', messageId);
      }
      return;
    }

    // Use sessionId from event data, or fall back to current session
    const sessionId = data.sessionId || SessionStore.getCurrentSessionId() || 'default';

    // Ensure message exists
    if (!MessageStore.hasMessage(messageId)) {
      MessageStore.upsertMessage({
        id: messageId,
        sessionId,
        role: role || 'assistant',
        status: 'streaming',
        isEphemeral: true,
      });
      this._currentMessageId = messageId;
      SessionStore.updateStatus('processing');
    }

    // Update text content (with HTML entity normalization)
    if (fullContent !== undefined) {
      // Full content replacement - normalize HTML entities
      const normalized = window.PartNormalizer?.decodeHtml(fullContent) ?? fullContent;
      MessageStore.updateTextPart(messageId, normalized, false);
    } else if (delta) {
      // Delta append - normalize HTML entities
      const normalized = window.PartNormalizer?.decodeHtml(delta) ?? delta;
      MessageStore.updateTextPart(messageId, normalized, true);
    }
  },

  /**
   * Handle message start
   * @param {Object} data
   */
  _handleMessageStart(data) {
    const { messageId, role } = data || {};
    
    if (!messageId) return;

    // Skip user role messages (these are echoes of our own messages)
    if (role === 'user') {
      if (this._debug) {
        console.log('[StoreBridge] Skipping user message start (echo):', messageId);
      }
      return;
    }

    // Don't create empty message on start - wait for delta with content
    // Just track the message ID
    this._currentMessageId = messageId;
    SessionStore.updateStatus('processing');
  },

  /**
   * Handle message completed
   * @param {Object} data
   */
  _handleMessageCompleted(data) {
    const { messageId, content, role } = data || {};
    
    // Skip ignored messages
    if (messageId && this._ignoredMessageIds.has(messageId)) {
      return;
    }

    const targetId = messageId || this._currentMessageId;
    
    if (targetId && MessageStore.hasMessage(targetId)) {
      // Update final content if provided
      if (content) {
        MessageStore.updateTextPart(targetId, content, false);
      }
      MessageStore.updateMessageStatus(targetId, 'complete');
    } else if (content) {
      // Create complete message (non-streaming case)
      const sessionId = SessionStore.getCurrentSessionId() || 'default';
      MessageStore.upsertMessage({
        id: `msg-${Date.now()}`,
        sessionId,
        role: role || 'assistant',
        status: 'complete',
        parts: [{ type: 'text', text: content }],
      });
    }

    this._currentMessageId = null;
    SessionStore.updateStatus('idle');
  },

  // ===========================================================================
  // Tool Event Handlers
  // ===========================================================================

  /**
   * Handle tool start
   * @param {Object} data
   */
  _handleToolStart(data) {
    const { toolId, toolName, input, messageId } = data || {};
    
    const targetMessageId = messageId || this._currentMessageId;
    
    // Sessiz başarısızlık yerine debug log
    if (!toolId) {
      console.warn('[StoreBridge] tool.start missing toolId:', data);
      return;
    }
    
    if (!targetMessageId) {
      console.warn('[StoreBridge] tool.start has no target message, creating fallback:', { toolId, toolName });
      // Fallback: Yeni bir mesaj oluştur
      const sessionId = data.sessionId || SessionStore.getCurrentSessionId() || 'default';
      const fallbackMessageId = `msg-tool-${Date.now()}`;
      MessageStore.upsertMessage({
        id: fallbackMessageId,
        sessionId,
        role: 'assistant',
        status: 'streaming',
      });
      this._currentMessageId = fallbackMessageId;
    }

    // Ensure message exists
    if (!MessageStore.hasMessage(targetMessageId)) {
      const sessionId = SessionStore.getCurrentSessionId() || 'default';
      MessageStore.upsertMessage({
        id: targetMessageId,
        sessionId,
        role: 'assistant',
        status: 'streaming',
      });
    }

    MessageStore.addOrUpdatePart({
      messageId: targetMessageId,
      partId: `tool-${toolId}`,
      type: 'tool',
      toolCall: {
        toolId,
        toolName: toolName || 'unknown',
        status: 'running',
        input,
        startedAt: Date.now(),
      },
    });
  },

  /**
   * Handle tool output (streaming)
   * @param {Object} data
   */
  _handleToolOutput(data) {
    const { toolId, output, messageId } = data || {};
    
    const targetMessageId = messageId || this._currentMessageId;
    if (!targetMessageId || !toolId) return;

    const message = MessageStore.getMessage(targetMessageId);
    if (!message) return;

    const partId = `tool-${toolId}`;
    const existingPart = message.parts[partId];
    
    if (existingPart?.toolCall) {
      const currentOutput = existingPart.toolCall.output || '';
      // Normalize HTML entities in tool output
      const normalizedOutput = window.PartNormalizer?.decodeHtml(output) ?? output;
      MessageStore.addOrUpdatePart({
        messageId: targetMessageId,
        partId,
        type: 'tool',
        toolCall: {
          ...existingPart.toolCall,
          output: currentOutput + (normalizedOutput || ''),
        },
      });
    }
  },

  /**
   * Handle tool end
   * @param {Object} data
   */
  _handleToolEnd(data) {
    const { toolId, status, output, messageId } = data || {};
    
    const targetMessageId = messageId || this._currentMessageId;
    
    // Debug logging for missing data
    if (!toolId) {
      console.warn('[StoreBridge] tool.end missing toolId:', data);
      return;
    }
    
    if (!targetMessageId) {
      console.warn('[StoreBridge] tool.end has no target message:', { toolId });
      return;
    }

    const message = MessageStore.getMessage(targetMessageId);
    if (!message) return;

    const partId = `tool-${toolId}`;
    const existingPart = message.parts[partId];
    
    if (existingPart?.toolCall) {
      MessageStore.addOrUpdatePart({
        messageId: targetMessageId,
        partId,
        type: 'tool',
        toolCall: {
          ...existingPart.toolCall,
          status: status === 'error' ? 'error' : 'success',
          output: output ?? existingPart.toolCall.output,
          completedAt: Date.now(),
        },
      });
    }
  },

  // ===========================================================================
  // Thinking Event Handlers
  // ===========================================================================

  /**
   * Handle thinking start
   * @param {Object} data
   */
  _handleThinkingStart(data) {
    const { messageId } = data || {};
    
    const targetMessageId = messageId || this._currentMessageId;
    if (!targetMessageId) return;

    // Ensure message exists
    if (!MessageStore.hasMessage(targetMessageId)) {
      const sessionId = SessionStore.getCurrentSessionId() || 'default';
      MessageStore.upsertMessage({
        id: targetMessageId,
        sessionId,
        role: 'assistant',
        status: 'streaming',
      });
    }

    MessageStore.addOrUpdatePart({
      messageId: targetMessageId,
      type: 'thinking',
      thinking: {
        content: '',
        isComplete: false,
      },
    });
  },

  /**
   * Handle thinking delta
   * @param {Object} data
   */
  _handleThinkingDelta(data) {
    const { content, messageId } = data || {};
    
    const targetMessageId = messageId || this._currentMessageId;
    if (!targetMessageId || !content) return;

    const message = MessageStore.getMessage(targetMessageId);
    if (!message) return;

    // Find thinking part
    const thinkingPartId = message.partIds.find(id => message.parts[id]?.type === 'thinking');
    const existingPart = thinkingPartId ? message.parts[thinkingPartId] : null;
    const currentContent = existingPart?.thinking?.content || '';

    // Normalize HTML entities in thinking content
    const normalizedContent = window.PartNormalizer?.decodeHtml(content) ?? content;

    MessageStore.addOrUpdatePart({
      messageId: targetMessageId,
      partId: thinkingPartId,
      type: 'thinking',
      thinking: {
        content: currentContent + normalizedContent,
        isComplete: false,
      },
    });
  },

  /**
   * Handle thinking end
   * @param {Object} data
   */
  _handleThinkingEnd(data) {
    const { messageId } = data || {};
    
    const targetMessageId = messageId || this._currentMessageId;
    if (!targetMessageId) return;

    const message = MessageStore.getMessage(targetMessageId);
    if (!message) return;

    // Find thinking part and mark complete
    const thinkingPartId = message.partIds.find(id => message.parts[id]?.type === 'thinking');
    if (thinkingPartId) {
      const existingPart = message.parts[thinkingPartId];
      MessageStore.addOrUpdatePart({
        messageId: targetMessageId,
        partId: thinkingPartId,
        type: 'thinking',
        thinking: {
          content: existingPart?.thinking?.content || '',
          isComplete: true,
        },
      });
    }
  },

  // ===========================================================================
  // Session Event Handlers
  // ===========================================================================

  /**
   * Handle session started
   * @param {Object} data
   */
  _handleSessionStarted(data) {
    // Session ID can come from data.session.id or top-level sessionId
    const session = data?.session || {};
    const sessionId = session.id || data?.sessionId;
    
    if (!sessionId) {
      console.warn('[StoreBridge] session.started without sessionId');
      return;
    }

    console.log('[StoreBridge] Session started:', sessionId);

    // Clear ignored messages for new session
    this._ignoredMessageIds.clear();
    
    // Set current session
    SessionStore.setCurrentSession(sessionId);
    SessionStore.upsertSession(sessionId, {
      title: session.title || `Session ${sessionId.substring(0, 8)}`,
    });

    // Load existing messages if any
    if (session.messages && Array.isArray(session.messages)) {
      console.log('[StoreBridge] Loading', session.messages.length, 'existing messages');
      session.messages.forEach(msg => {
        MessageStore.upsertMessage({
          id: msg.id || `msg-${msg.timestamp}`,
          sessionId: sessionId,
          role: msg.role || 'assistant',
          status: 'complete',
          parts: [{ type: 'text', text: msg.content }],
          createdAt: msg.timestamp,
        });
      });
    }

    SessionStore.updateStatus('idle');
  },

  /**
   * Handle session idle/completed
   * @param {Object} data
   */
  _handleSessionIdle(data) {
    this._currentMessageId = null;
    SessionStore.updateStatus('idle');
  },

  /**
   * Handle status change
   * @param {Object} data
   */
  _handleStatusChange(data) {
    const { status } = data || {};
    
    switch (status) {
      case 'idle':
      case 'connected':
      case 'opencode_connected':
        // Aktif mesaj streaming varsa idle'a geçme
        // message.completed event'ini bekle
        if (this._currentMessageId) {
          const msg = MessageStore.getMessage(this._currentMessageId);
          if (msg && msg.status === 'streaming') {
            if (this._debug) {
              console.log('[StoreBridge] status.idle ignored - active streaming:', this._currentMessageId);
            }
            return; // idle'a geçme
          }
        }
        SessionStore.updateStatus('idle');
        break;
      case 'processing':
        SessionStore.updateStatus('processing');
        break;
      case 'waiting_permission':
      case 'waiting_answer':
        SessionStore.updateStatus('waiting');
        break;
      case 'cancelled':
        this._currentMessageId = null;
        SessionStore.updateStatus('idle');
        break;
    }
  },

  // ===========================================================================
  // User Message Helpers (Optimistic Updates - FAZ 3)
  // ===========================================================================

  /**
   * Set last user message (for echo filtering)
   * @param {string} message
   */
  setLastUserMessage(message) {
    this._lastUserMessage = (message || '').trim();
  },

  /**
   * Add optimistic user message with proper ID generation
   * Uses MessageStore.createOptimisticMessage() for collision-safe IDs
   * @param {string} content
   * @param {string} [messageId] - Optional pre-generated message ID (CodeNomad pattern)
   * @returns {string} Message ID (tempId or provided messageId)
   */
  addOptimisticUserMessage(content, messageId) {
    const sessionId = SessionStore.getCurrentSessionId() || 'default';

    // Store for echo filtering
    this.setLastUserMessage(content);

    // Use provided messageId or generate one (CodeNomad pattern)
    const { tempId } = MessageStore.createOptimisticMessage({
      sessionId,
      role: 'user',
      content,
      tempId: messageId, // Pass pre-generated ID if provided
    });

    // Track pending message for potential error handling
    this._pendingIdReplacements.set(tempId, null);

    SessionStore.updateStatus('processing');

    return tempId;
  },

  /**
   * Mark user message as sent (update status)
   * Transitions: sending → complete
   * @param {string} messageId
   */
  markUserMessageSent(messageId) {
    MessageStore.markMessageSent(messageId);
    this._pendingIdReplacements.delete(messageId);
  },

  /**
   * Mark user message as failed
   * Transitions: sending → error
   * @param {string} messageId
   * @param {import('./types.js').MessageErrorInfo} [errorInfo]
   */
  markUserMessageFailed(messageId, errorInfo) {
    const defaultError = {
      code: 'SEND_FAILED',
      message: 'Mesaj gönderilemedi',
      retryable: true,
    };
    
    MessageStore.markMessageFailed(messageId, errorInfo || defaultError);
    this._pendingIdReplacements.delete(messageId);
    SessionStore.updateStatus('idle');
  },

  /**
   * Retry a failed message
   * @param {string} messageId
   * @returns {boolean} True if retry was initiated
   */
  retryMessage(messageId) {
    const success = MessageStore.retryMessage(messageId);
    if (success) {
      this._pendingIdReplacements.set(messageId, null);
      SessionStore.updateStatus('processing');
    }
    return success;
  },

  /**
   * Replace temp message ID with real ID from server
   * @param {string} tempId
   * @param {string} realId
   */
  replaceMessageId(tempId, realId) {
    MessageStore.replaceMessageId({ oldId: tempId, newId: realId });
    this._pendingIdReplacements.delete(tempId);
  },

  /**
   * Get content of a pending message (for retry)
   * @param {string} messageId
   * @returns {string | null}
   */
  getPendingMessageContent(messageId) {
    return MessageStore.getMessageContent(messageId) || null;
  },

  /**
   * Check if there are any pending (sending) messages
   * @returns {boolean}
   */
  hasPendingMessages() {
    return this._pendingIdReplacements.size > 0;
  },

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Check if content is an echo of the last user message
   * Uses exact match only to prevent false positives
   * @param {string} content
   * @returns {boolean}
   */
  _isEcho(content) {
    if (!this._lastUserMessage) return false;
    
    // Normalize both strings for comparison
    const normalizedContent = this._normalizeForComparison(content);
    const normalizedLastMessage = this._normalizeForComparison(this._lastUserMessage);
    
    // Exact match only - startsWith removed to prevent filtering assistant responses
    // that happen to start with the same words as the user message
    return normalizedContent === normalizedLastMessage;
  },

  /**
   * Normalize string for echo comparison
   * @param {string} str
   * @returns {string}
   */
  _normalizeForComparison(str) {
    if (!str) return '';
    return str
      .trim()
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\s+/g, ' ')     // Collapse whitespace
      .toLowerCase();           // Case insensitive
  },

  /**
   * Get current streaming message ID
   * @returns {string | null}
   */
  getCurrentMessageId() {
    return this._currentMessageId;
  },

  /**
   * Clear all state (for new session)
   */
  clear() {
    this._lastUserMessage = '';
    this._currentMessageId = null;
    this._pendingIdReplacements.clear();
    this._ignoredMessageIds.clear();
  },

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this._debug = enabled;
  },
};

// Global export
window.StoreBridge = StoreBridge;
