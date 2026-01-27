/**
 * OpenCode UI - Message Store
 * 
 * Normalized message store with pub/sub pattern.
 * Adapted from CodeNomad's message-v2/instance-store.ts
 * 
 * Architecture:
 * - messages: Map<messageId, MessageRecord>
 * - parts: Map<partId, MessagePart> (denormalized for quick access)
 * - sessionMessages: Map<sessionId, messageId[]>
 * - Revision-based change detection for efficient re-renders
 * 
 * Optimistic Updates (FAZ 3):
 * - createOptimisticMessage(): Create ephemeral message with 'sending' status
 * - markMessageSent(): Transition sending → complete
 * - markMessageFailed(): Transition sending → error with error info
 * - Collision-safe ID generation with counter
 */

// ===========================================================================
// ID Generation (adapted from CodeNomad's session-actions.ts)
// ===========================================================================

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

let _lastTimestamp = 0;
let _localCounter = 0;

/**
 * Generate random base62 string
 * @param {number} length
 * @returns {string}
 */
function randomBase62(length: number): string {
  let result = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[arr[i] % 62];
  }
  return result;
}

/**
 * Create a unique, sortable ID with prefix
 * Format: prefix_timestamp(base62)_counter_random
 * @param {string} prefix - ID prefix (e.g., 'msg', 'part')
 * @returns {string}
 */
function createId(prefix: string): string {
  const now = Date.now();
  
  // Reset counter if timestamp changed, otherwise increment
  if (now !== _lastTimestamp) {
    _lastTimestamp = now;
    _localCounter = 0;
  } else {
    _localCounter++;
  }
  
  // Convert timestamp to base62 for compactness
  let ts = now;
  let tsBase62 = '';
  while (ts > 0) {
    tsBase62 = BASE62_CHARS[ts % 62] + tsBase62;
    ts = Math.floor(ts / 62);
  }
  
  // Counter in base62
  let counter = _localCounter;
  let counterBase62 = '';
  do {
    counterBase62 = BASE62_CHARS[counter % 62] + counterBase62;
    counter = Math.floor(counter / 62);
  } while (counter > 0);
  
  // Random suffix for extra uniqueness
  const random = randomBase62(4);
  
  return `${prefix}_${tsBase62}${counterBase62}${random}`;
}

const MessageStore = {
  // ===========================================================================
  // State
  // ===========================================================================

  /** @type {Map<string, import('./types.js').MessageRecord>} */
  _messages: new Map(),

  /** @type {Map<string, import('./types.js').MessagePart>} */
  _parts: new Map(),

  /** @type {Map<string, string[]>} */
  _sessionMessages: new Map(),

  /** @type {Map<string, number>} */
  _sessionRevisions: new Map(),

  _listeners: new Set<(event: unknown) => void>(),

  /** @type {number} */
  _globalRevision: 0,

  // ===========================================================================
  // Permission Queue State (adapted from CodeNomad)
  // ===========================================================================

  /**
   * Permission queue for tool approvals
   * @type {{
   *   queue: Array<{id: string, messageId: string, partId: string, permission: Object, createdAt: number}>,
   *   active: {id: string, messageId: string, partId: string, permission: Object, createdAt: number} | null,
   *   byMessage: Object.<string, Object.<string, Object>>
   * }}
   */
  _permissionState: {
    queue: [] as Array<{ id?: string; messageId?: string; partId?: string; permission: { id: string }; createdAt?: number }>,
    active: null as { id?: string; messageId?: string; partId?: string; permission: { id: string }; createdAt?: number } | null,
    byMessage: {} as Record<string, Record<string, unknown>>,
  },

  _questionState: {
    queue: [] as Array<{ id: string; messageId?: string; question?: unknown; createdAt?: number }>,
    active: null as { id: string; messageId?: string; question?: unknown; createdAt?: number } | null,
  },

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get a message by ID
   * @param {string} messageId
   * @returns {import('./types.js').MessageRecord | undefined}
   */
  getMessage(messageId: string) {
    return this._messages.get(messageId);
  },

  /**
   * Get all messages for a session (ordered)
   * @param {string} sessionId
   * @returns {import('./types.js').MessageRecord[]}
   */
  getSessionMessages(sessionId: string) {
    const messageIds = this._sessionMessages.get(sessionId) || [];
    return messageIds
      .map((id: string) => this._messages.get(id))
      .filter(Boolean);
  },

  /**
   * Get message IDs for a session
   * @param {string} sessionId
   * @returns {string[]}
   */
  getSessionMessageIds(sessionId: string) {
    return this._sessionMessages.get(sessionId) || [];
  },

  /**
   * Get all parts for a message (ordered)
   * @param {string} messageId
   * @returns {import('./types.js').MessagePart[]}
   */
  getMessageParts(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message) return [];
    
    return message.partIds
      .map((id: string) => message.parts[id])
      .filter(Boolean);
  },

  /**
   * Get a specific part
   * @param {string} partId
   * @returns {import('./types.js').MessagePart | undefined}
   */
  getPart(partId: string) {
    return this._parts.get(partId);
  },

  /**
   * Get combined text content of a message
   * @param {string} messageId
   * @returns {string}
   */
  getMessageContent(messageId: string) {
    const parts = this.getMessageParts(messageId);
    return parts
      .filter((p: { type?: string }) => p.type === 'text')
      .map((p: { text?: string }) => p.text || '')
      .join('');
  },

  /**
   * Get session revision (for change detection)
   * @param {string} sessionId
   * @returns {number}
   */
  getSessionRevision(sessionId: string) {
    return this._sessionRevisions.get(sessionId) || 0;
  },

  /**
   * Check if a message exists
   * @param {string} messageId
   * @returns {boolean}
   */
  hasMessage(messageId: string) {
    return this._messages.has(messageId);
  },

  // ===========================================================================
  // Mutation Methods
  // ===========================================================================

  /**
   * Create or update a message
   * @param {import('./types.js').MessageUpsertInput} input
   * @returns {import('./types.js').MessageRecord}
   */
  upsertMessage(input: { id: string; sessionId: string; role: string; status?: string; isEphemeral?: boolean; parts?: Array<{ id?: string; type: string; text?: string }>; createdAt?: number }) {
    const now = Date.now();
    const existing = this._messages.get(input.id);
    
    /** @type {import('./types.js').MessageRecord} */
    const record = {
      id: input.id,
      sessionId: input.sessionId,
      role: input.role,
      status: input.status || (existing?.status || 'streaming'),
      revision: existing ? existing.revision + 1 : 0,
      isEphemeral: input.isEphemeral ?? existing?.isEphemeral ?? false,
      partIds: existing?.partIds || [],
      parts: existing?.parts || {},
      createdAt: input.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    };

    // Process initial parts if provided
    if (input.parts && input.parts.length > 0) {
      input.parts.forEach((part, index) => {
        const partId = part.id || this._generatePartId(input.id, index);
        const partRecord = {
          ...part,
          id: partId,
          messageId: input.id,
          revision: 0,
          createdAt: now,
          updatedAt: now,
        };
        record.parts[partId] = partRecord;
        if (!record.partIds.includes(partId)) {
          record.partIds.push(partId);
        }
        // Also store in denormalized parts map
        this._parts.set(partId, partRecord);
      });
    }

    this._messages.set(input.id, record);
    this._addMessageToSession(input.sessionId, input.id);
    this._bumpSessionRevision(input.sessionId);
    this._notify({ type: existing ? 'message:updated' : 'message:created', messageId: input.id, sessionId: input.sessionId });

    return record;
  },

  /**
   * Update message status
   * @param {string} messageId
   * @param {import('./types.js').MessageStatus} status
   */
  updateMessageStatus(messageId: string, status: string) {
    const message = this._messages.get(messageId);
    if (!message) return;

    message.status = status;
    message.revision += 1;
    message.updatedAt = Date.now();
    
    if (status === 'complete') {
      message.isEphemeral = false;
    }

    this._bumpSessionRevision(message.sessionId);
    this._notify({ type: 'message:updated', messageId, sessionId: message.sessionId });
  },

  // ===========================================================================
  // Optimistic Update Methods (FAZ 3)
  // ===========================================================================

  /**
   * Create an optimistic (ephemeral) message
   * Used for immediate UI feedback before server confirmation
   * @param {import('./types.js').OptimisticMessageInput} input
   * @returns {import('./types.js').OptimisticMessageResult}
   */
  createOptimisticMessage(input: { tempId?: string; sessionId: string; role: string; content: string }) {
    const tempId = input.tempId || createId('msg_temp');
    const now = Date.now();

    const record = this.upsertMessage({
      id: tempId,
      sessionId: input.sessionId,
      role: input.role,
      status: 'sending',
      isEphemeral: true,
      parts: [{ type: 'text', text: input.content }],
      createdAt: now,
    });

    return { tempId, record };
  },

  /**
   * Mark an optimistic message as acknowledged by server
   * Transitions: sending → sent
   * @param {string} messageId
   */
  markMessageSent(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message) return;

    message.status = 'sent';
    message.revision += 1;
    message.updatedAt = Date.now();

    this._bumpSessionRevision(message.sessionId);
    this._notify({ type: 'message:updated', messageId, sessionId: message.sessionId });
  },

  /**
   * Mark a sent message as complete (assistant started responding)
   * Transitions: sent → complete
   * @param {string} messageId
   */
  markMessageComplete(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message) return;

    message.status = 'complete';
    message.isEphemeral = false;
    message.revision += 1;
    message.updatedAt = Date.now();

    this._bumpSessionRevision(message.sessionId);
    this._notify({ type: 'message:updated', messageId, sessionId: message.sessionId });
  },

  /**
   * Mark an optimistic message as failed
   * Transitions: sending → error
   * @param {string} messageId
   * @param {import('./types.js').MessageErrorInfo} [errorInfo]
   */
  markMessageFailed(messageId: string, errorInfo?: { code?: string; message?: string; retryable?: boolean }) {
    const message = this._messages.get(messageId);
    if (!message) return;

    message.status = 'error';
    message.revision += 1;
    message.updatedAt = Date.now();
    
    // Store error info in message metadata
    if (errorInfo) {
      message.errorInfo = errorInfo;
    }

    this._bumpSessionRevision(message.sessionId);
    this._notify({ type: 'message:updated', messageId, sessionId: message.sessionId, error: errorInfo });
  },

  /**
   * Get error info for a failed message
   * @param {string} messageId
   * @returns {import('./types.js').MessageErrorInfo | undefined}
   */
  getMessageError(messageId: string) {
    const message = this._messages.get(messageId);
    return message?.errorInfo;
  },

  /**
   * Retry a failed message (reset to sending state)
   * @param {string} messageId
   * @returns {boolean} True if message was reset
   */
  retryMessage(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message || message.status !== 'error') return false;

    message.status = 'sending';
    message.isEphemeral = true;
    message.revision += 1;
    message.updatedAt = Date.now();
    delete message.errorInfo;

    this._bumpSessionRevision(message.sessionId);
    this._notify({ type: 'message:updated', messageId, sessionId: message.sessionId });
    return true;
  },

  /**
   * Add or update a part in a message
   * @param {import('./types.js').PartUpdateInput} input
   * @returns {import('./types.js').MessagePart | null}
   */
  addOrUpdatePart(input: { messageId: string; partId?: string; type: string; text?: string; toolCall?: unknown; thinking?: unknown; step?: unknown }) {
    const message = this._messages.get(input.messageId);
    if (!message) {
      console.warn('[MessageStore] Cannot add part - message not found:', input.messageId);
      return null;
    }

    const now = Date.now();
    const partId = input.partId || this._findOrCreatePartId(message, input.type);
    const existing = message.parts[partId];

    /** @type {import('./types.js').MessagePart} */
    const partRecord = {
      id: partId,
      messageId: input.messageId,
      type: input.type,
      revision: existing ? existing.revision + 1 : 0,
      text: input.text ?? existing?.text,
      toolCall: input.toolCall ?? existing?.toolCall,
      thinking: input.thinking ?? existing?.thinking,
      step: input.step ?? existing?.step,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    // Update message
    message.parts[partId] = partRecord;
    if (!message.partIds.includes(partId)) {
      message.partIds.push(partId);
    }
    message.revision += 1;
    message.updatedAt = now;

    // Update denormalized parts map
    this._parts.set(partId, partRecord);

    this._bumpSessionRevision(message.sessionId);
    this._notify({ type: 'part:updated', messageId: input.messageId, partId, sessionId: message.sessionId });

    return partRecord;
  },

  /**
   * Update text content of a message's text part
   * Convenience method for streaming text updates
   * @param {string} messageId
   * @param {string} text
   * @param {boolean} [append=false] - If true, append to existing text
   */
  updateTextPart(messageId: string, text: string, append = false) {
    const message = this._messages.get(messageId);
    if (!message) return;

    // Find existing text part or create new
    const textPartId = message.partIds.find((id: string) => message.parts[id]?.type === 'text');
    
    if (textPartId && append) {
      const existing = message.parts[textPartId];
      text = (existing.text || '') + text;
    }

    this.addOrUpdatePart({
      messageId,
      partId: textPartId,
      type: 'text',
      text,
    });
  },

  /**
   * Replace a temporary message ID with a real one
   * Used for optimistic updates
   * @param {import('./types.js').ReplaceMessageIdOptions} options
   */
  replaceMessageId(options: { oldId: string; newId: string }) {
    const { oldId, newId } = options;
    if (oldId === newId) return;

    const message = this._messages.get(oldId);
    if (!message) return;

    // Clone with new ID
    const updated = {
      ...message,
      id: newId,
      isEphemeral: false,
      updatedAt: Date.now(),
    };

    // Update parts to reference new message ID
    Object.keys(updated.parts).forEach(partId => {
      updated.parts[partId] = {
        ...updated.parts[partId],
        messageId: newId,
      };
      // Update denormalized map
      this._parts.set(partId, updated.parts[partId]);
    });

    // Remove old, add new
    this._messages.delete(oldId);
    this._messages.set(newId, updated);

    // Update session messages list
    const sessionMsgs = this._sessionMessages.get(message.sessionId);
    if (sessionMsgs) {
      const index = sessionMsgs.indexOf(oldId);
      if (index !== -1) {
        sessionMsgs[index] = newId;
      }
    }

    this._bumpSessionRevision(message.sessionId);
    this._notify({ type: 'message:updated', messageId: newId, sessionId: message.sessionId });
  },

  /**
   * Remove a message
   * @param {string} messageId
   */
  removeMessage(messageId: string) {
    const message = this._messages.get(messageId);
    if (!message) return;

    // Remove parts from denormalized map
    message.partIds.forEach((partId: string) => {
      this._parts.delete(partId);
    });

    // Remove from session
    const sessionMsgs = this._sessionMessages.get(message.sessionId);
    if (sessionMsgs) {
      const index = sessionMsgs.indexOf(messageId);
      if (index !== -1) {
        sessionMsgs.splice(index, 1);
      }
    }

    this._messages.delete(messageId);
    this._bumpSessionRevision(message.sessionId);
    this._notify({ type: 'message:deleted', messageId, sessionId: message.sessionId });
  },

  // ===========================================================================
  // Permission Queue Methods (adapted from CodeNomad)
  // ===========================================================================

  /**
   * Add permission request to queue
   * @param {{id: string, messageId: string, partId: string, permission: Object}} entry
   */
  upsertPermission(entry: { id?: string; messageId?: string; partId?: string; permission: { id: string; type?: string; title?: string; description?: string; metadata?: unknown; risk?: string } }) {
    const existing = this._permissionState.queue.find(
      (p: { permission: { id: string } }) => p.permission.id === entry.permission.id
    );

    const permissionEntry = {
      ...entry,
      createdAt: existing?.createdAt || Date.now(),
    };

    if (existing) {
      // Update existing
      Object.assign(existing, permissionEntry);
    } else {
      // Add new
      this._permissionState.queue.push(permissionEntry);
    }

    // Update byMessage index
    if (entry.messageId) {
      if (!this._permissionState.byMessage[entry.messageId]) {
        this._permissionState.byMessage[entry.messageId] = {};
      }
      this._permissionState.byMessage[entry.messageId][entry.partId || '_default'] = permissionEntry;
    }

    // Auto-activate first in queue if none active
    if (!this._permissionState.active && this._permissionState.queue.length > 0) {
      this._permissionState.active = this._permissionState.queue[0];
    }

    this._notify({ type: 'permission:updated', permissionId: entry.permission.id });
  },

  /**
   * Remove permission from queue
   * @param {string} permissionId
   */
  removePermission(permissionId: string) {
    const index = this._permissionState.queue.findIndex(
      (p: { permission: { id: string } }) => p.permission.id === permissionId
    );

    if (index === -1) return;

    const removed = this._permissionState.queue.splice(index, 1)[0];

    // Clean up byMessage index
    if (removed.messageId && this._permissionState.byMessage[removed.messageId]) {
      delete this._permissionState.byMessage[removed.messageId][removed.partId || '_default'];
    }

    // Update active if removed was active
    if (this._permissionState.active?.permission.id === permissionId) {
      this._permissionState.active = this._permissionState.queue[0] || null;
    }

    this._notify({ type: 'permission:removed', permissionId });
  },

  /**
   * Get current active permission
   * @returns {{id: string, messageId: string, partId: string, permission: Object, createdAt: number} | null}
   */
  getActivePermission() {
    return this._permissionState.active;
  },

  /**
   * Get all pending permissions
   * @returns {Array}
   */
  getPermissionQueue() {
    return [...this._permissionState.queue];
  },

  /**
   * Get permission for specific message/part
   * @param {string} messageId
   * @param {string} [partId]
   * @returns {Object | undefined}
   */
  getPermissionForPart(messageId: string, partId = '_default') {
    return this._permissionState.byMessage[messageId]?.[partId];
  },

  /**
   * Clear all permissions
   */
  clearPermissions() {
    this._permissionState.queue = [];
    this._permissionState.active = null;
    this._permissionState.byMessage = {};
    this._notify({ type: 'permission:cleared' });
  },

  // ===========================================================================
  // Question Queue Methods
  // ===========================================================================

  /**
   * Add question to queue
   * @param {{id: string, messageId: string, question: Object}} entry
   */
  upsertQuestion(entry: { id: string; messageId?: string; question?: unknown; createdAt?: number }) {
    const existing = this._questionState.queue.find((q: { id: string }) => q.id === entry.id);

    const questionEntry = {
      ...entry,
      createdAt: existing?.createdAt || Date.now(),
    };

    if (existing) {
      Object.assign(existing, questionEntry);
    } else {
      this._questionState.queue.push(questionEntry);
    }

    // Auto-activate first in queue
    if (!this._questionState.active && this._questionState.queue.length > 0) {
      this._questionState.active = this._questionState.queue[0];
    }

    this._notify({ type: 'question:updated', questionId: entry.id });
  },

  /**
   * Remove question from queue
   * @param {string} questionId
   */
  removeQuestion(questionId: string) {
    const index = this._questionState.queue.findIndex((q: { id: string }) => q.id === questionId);
    if (index === -1) return;

    this._questionState.queue.splice(index, 1);

    if (this._questionState.active?.id === questionId) {
      this._questionState.active = this._questionState.queue[0] || null;
    }

    this._notify({ type: 'question:removed', questionId });
  },

  /**
   * Get current active question
   * @returns {{id: string, messageId: string, question: Object, createdAt: number} | null}
   */
  getActiveQuestion() {
    return this._questionState.active;
  },

  /**
   * Get all pending questions
   * @returns {Array}
   */
  getQuestionQueue() {
    return [...this._questionState.queue];
  },

  /**
   * Clear all questions
   */
  clearQuestions() {
    this._questionState.queue = [];
    this._questionState.active = null;
    this._notify({ type: 'question:cleared' });
  },

  // ===========================================================================
  // Subscription
  // ===========================================================================

  /**
   * Subscribe to store changes
   * @param {Function} listener - Called with StoreEvent on changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener: (event: unknown) => void) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  /**
   * Notify all listeners
   * @param {import('./types.js').StoreEvent} event
   */
  _notify(event: { type: string; messageId?: string; sessionId?: string; partId?: string; error?: unknown; permissionId?: string; questionId?: string }) {
    this._globalRevision++;
    const eventWithTimestamp = { ...event, timestamp: Date.now() };
    this._listeners.forEach((listener: (event: unknown) => void) => {
      try {
        listener(eventWithTimestamp);
      } catch (err) {
        console.error('[MessageStore] Listener error:', err);
      }
    });
  },

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Clear all messages for a session
   * @param {string} sessionId
   */
  clearSession(sessionId: string) {
    const messageIds = this._sessionMessages.get(sessionId) || [];
    
    messageIds.forEach((msgId: string) => {
      const message = this._messages.get(msgId);
      if (message) {
        message.partIds.forEach((partId: string) => this._parts.delete(partId));
      }
      this._messages.delete(msgId);
    });

    this._sessionMessages.delete(sessionId);
    this._sessionRevisions.delete(sessionId);
    this._notify({ type: 'session:changed', sessionId });
  },

  /**
   * Clear entire store
   */
  clear() {
    this._messages.clear();
    this._parts.clear();
    this._sessionMessages.clear();
    this._sessionRevisions.clear();
    this._globalRevision = 0;
    this._notify({ type: 'session:changed' });
  },

  /**
   * Get store stats (for debugging)
   * @returns {Object}
   */
  getStats() {
    return {
      messageCount: this._messages.size,
      partCount: this._parts.size,
      sessionCount: this._sessionMessages.size,
      globalRevision: this._globalRevision,
      listenerCount: this._listeners.size,
    };
  },

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Add message to session's message list
   * @param {string} sessionId
   * @param {string} messageId
   */
  _addMessageToSession(sessionId: string, messageId: string) {
    if (!this._sessionMessages.has(sessionId)) {
      this._sessionMessages.set(sessionId, []);
    }
    const list = this._sessionMessages.get(sessionId);
    if (!list.includes(messageId)) {
      list.push(messageId);
    }
  },

  /**
   * Bump session revision counter
   * @param {string} sessionId
   */
  _bumpSessionRevision(sessionId: string) {
    const current = this._sessionRevisions.get(sessionId) || 0;
    this._sessionRevisions.set(sessionId, current + 1);
  },

  /**
   * Generate a part ID
   * @param {string} messageId
   * @param {number} index
   * @returns {string}
   */
  _generatePartId(messageId: string, index: number) {
    return `${messageId}-part-${index}-${Date.now()}`;
  },

  /**
   * Find existing part of type or create new ID
   * @param {import('./types.js').MessageRecord} message
   * @param {import('./types.js').PartType} type
   * @returns {string}
   */
  _findOrCreatePartId(message: { id: string; partIds: string[]; parts: Record<string, { type?: string }> }, type: string) {
    // For text parts, reuse existing text part (streaming update)
    if (type === 'text') {
      const existingTextPart = message.partIds.find(id => message.parts[id]?.type === 'text');
      if (existingTextPart) return existingTextPart;
    }
    
    // For thinking, reuse existing thinking part
    if (type === 'thinking') {
      const existingThinkingPart = message.partIds.find(id => message.parts[id]?.type === 'thinking');
      if (existingThinkingPart) return existingThinkingPart;
    }
    
    // Generate new ID for tool parts or new parts
    return this._generatePartId(message.id, message.partIds.length);
  },

  // ID generation for external use (CodeNomad pattern)
  createId(prefix: string = 'id') {
    return createId(prefix);
  },
};

// Global exports
(window as unknown as { MessageStore: typeof MessageStore }).MessageStore = MessageStore;
