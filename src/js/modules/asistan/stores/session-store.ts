/**
 * OpenCode UI - Session Store
 * 
 * Session state management with pub/sub pattern.
 * Tracks current session, session metadata, and UI status.
 */

interface SessionRecord {
  id: string;
  title?: string;
  messageIds?: string[];
  status?: string;
  createdAt?: number;
  updatedAt?: number;
  instanceId?: string;
  [key: string]: unknown;
}

interface SessionInfo {
  agent?: string;
  providerId?: string;
  modelId?: string;
  [key: string]: unknown;
}

interface SessionUsage {
  tokens: number;
  cost: number;
}

type SessionStatus = 'idle' | 'processing' | 'waiting' | string;
type SessionStoreListener = (event: unknown) => void;

const SessionStore = {
  // ===========================================================================
  // State
  // ===========================================================================

  /** @type {string | null} Current session ID (for active instance) */
  _currentSessionId: null as string | null,

  /** @type {Map<string, string | null>} Instance ID -> Current Session ID mapping */
  _currentSessionByInstance: new Map<string, string | null>(),

  /** @type {Map<string, SessionRecord>} */
  _sessions: new Map<string, SessionRecord>(),

  /** @type {Map<string, string[]>} Instance ID -> Session IDs mapping */
  _sessionsByInstance: new Map<string, string[]>(),

  /** @type {SessionStatus} */
  _status: 'idle' as SessionStatus,

  /** @type {Map<string, SessionStatus>} Status per instance */
  _statusByInstance: new Map<string, SessionStatus>(),

  _listeners: new Set<SessionStoreListener>(),

  /** @type {number} */
  _revision: 0,

  /** @type {Map<string, number>} Session-specific revision counters for granular change detection */
  _sessionRevisions: new Map<string, number>(),

  /** @type {Map<string, SessionUsage>} Token usage tracking per session */
  _sessionUsage: new Map<string, SessionUsage>(),

  /** @type {Map<string, SessionInfo>} Extended session info (agent, model, etc.) */
  _sessionInfo: new Map<string, SessionInfo>(),

  // ===========================================================================
  // Race Condition Protection
  // ===========================================================================

  /** @type {number} Request counter for race condition protection */
  _requestCounter: 0,

  /** @type {Map<string, number>} Operation name -> Last request ID */
  _lastRequestIds: new Map<string, number>(),

  /** @type {Map<string, boolean>} Operation name -> Loading state */
  _loadingStates: new Map<string, boolean>(),

  /**
   * Generate unique request ID for an operation
   * @param {string} operation - Operation name (e.g., 'loadSessions', 'fetchSession')
   * @returns {number} Request ID
   */
  _startRequest(operation: string) {
    const requestId = ++this._requestCounter;
    this._lastRequestIds.set(operation, requestId);
    this._loadingStates.set(operation, true);
    return requestId;
  },

  /**
   * Check if request is still valid (not superseded by newer request)
   * @param {string} operation - Operation name
   * @param {number} requestId - Request ID to check
   * @returns {boolean} True if request should be applied
   */
  _isRequestValid(operation: string, requestId: number) {
    return this._lastRequestIds.get(operation) === requestId;
  },

  /**
   * Mark operation as complete
   * @param {string} operation - Operation name
   * @param {number} requestId - Request ID
   */
  _endRequest(operation: string, requestId: number) {
    // Only clear loading if this was the last request
    if (this._isRequestValid(operation, requestId)) {
      this._loadingStates.set(operation, false);
    }
  },

  /**
   * Check if operation is currently loading
   * @param {string} operation - Operation name
   * @returns {boolean}
   */
  isLoading(operation: string) {
    return this._loadingStates.get(operation) === true;
  },

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get current session ID
   * @returns {string | null}
   */
  getCurrentSessionId() {
    return this._currentSessionId;
  },

  /**
   * Get current session record
   * @returns {import('./types.js').SessionRecord | null}
   */
  getCurrentSession() {
    if (!this._currentSessionId) return null;
    return this._sessions.get(this._currentSessionId) || null;
  },

  /**
   * Get session by ID
   * @param {string} sessionId
   * @returns {SessionRecord | undefined}
   */
  getSession(sessionId: string) {
    return this._sessions.get(sessionId);
  },

  /**
   * Get all sessions
   * @returns {import('./types.js').SessionRecord[]}
   */
  getAllSessions() {
    return Array.from(this._sessions.values());
  },

  /**
   * Get current UI status
   * @returns {import('./types.js').SessionStatus}
   */
  getStatus() {
    return this._status;
  },

  /**
   * Check if currently processing
   * @returns {boolean}
   */
  isProcessing() {
    return this._status === 'processing';
  },

  /**
   * Check if waiting for user input
   * @returns {boolean}
   */
  isWaiting() {
    return this._status === 'waiting';
  },

  /**
   * Check if idle
   * @returns {boolean}
   */
  isIdle() {
    return this._status === 'idle';
  },

  /**
   * Get session-specific revision (for granular change detection)
   * @param {string} sessionId
   * @returns {number}
   */
  getSessionRevision(sessionId: string) {
    return this._sessionRevisions.get(sessionId) || 0;
  },

  /**
   * Get token usage for a session
   * @param {string} sessionId
   * @returns {SessionUsage}
   */
  getSessionUsage(sessionId: string) {
    return this._sessionUsage.get(sessionId) || { tokens: 0, cost: 0 };
  },

  /**
   * Get total usage across all sessions
   * @returns {{tokens: number, cost: number}}
   */
  getTotalUsage() {
    let tokens = 0;
    let cost = 0;
    this._sessionUsage.forEach((usage: SessionUsage) => {
      tokens += usage.tokens;
      cost += usage.cost;
    });
    return { tokens, cost };
  },

  // ===========================================================================
  // Instance-Aware Query Methods
  // ===========================================================================

  /**
   * Get current session ID for a specific instance
   * @param {string} instanceId
   * @returns {string | null}
   */
  getCurrentSessionIdForInstance(instanceId: string) {
    return this._currentSessionByInstance.get(instanceId) || null;
  },

  /**
   * Get all sessions for a specific instance
   * @param {string} instanceId
   * @returns {SessionRecord[]}
   */
  getInstanceSessions(instanceId: string) {
    const sessionIds = this._sessionsByInstance.get(instanceId) || [];
    return sessionIds
      .map((id: string) => this._sessions.get(id))
      .filter(Boolean) as SessionRecord[];
  },

  /**
   * Get status for a specific instance
   * @param {string} instanceId
   * @returns {SessionStatus}
   */
  getInstanceStatus(instanceId: string) {
    return this._statusByInstance.get(instanceId) || 'idle';
  },

  /**
   * Check if instance is processing
   * @param {string} instanceId
   * @returns {boolean}
   */
  isInstanceProcessing(instanceId: string) {
    return this._statusByInstance.get(instanceId) === 'processing';
  },

  /**
   * Get total usage for an instance
   * @param {string} instanceId
   * @returns {{tokens: number, cost: number}}
   */
  getInstanceUsage(instanceId: string) {
    let tokens = 0;
    let cost = 0;
    const sessionIds = this._sessionsByInstance.get(instanceId) || [];
    sessionIds.forEach((sessionId: string) => {
      const usage = this._sessionUsage.get(sessionId);
      if (usage) {
        tokens += usage.tokens;
        cost += usage.cost;
      }
    });
    return { tokens, cost };
  },

  /**
   * Get extended session info (agent, model, tokens breakdown)
   * @param {string} sessionId
   * @returns {SessionInfo | null}
   */
  getSessionInfo(sessionId: string) {
    return this._sessionInfo.get(sessionId) || null;
  },

  /**
   * Update extended session info
   * @param {string} sessionId
   * @param {Partial<SessionInfo>} info
   */
  updateSessionInfo(sessionId: string, info: Partial<SessionInfo & { inputTokens?: number; outputTokens?: number; cost?: number; provider?: string; model?: string }>) {
    const existing = this._sessionInfo.get(sessionId) || {
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    };

    const existingTyped = existing as { inputTokens?: number; outputTokens?: number; cost?: number; agent?: string; providerId?: string; modelId?: string };

    // Accumulate token counts
    const updated: { inputTokens: number; outputTokens: number; cost: number; agent?: string; providerId?: string; modelId?: string } = {
      ...existingTyped,
      inputTokens: (existingTyped.inputTokens || 0) + (info.inputTokens || 0),
      outputTokens: (existingTyped.outputTokens || 0) + (info.outputTokens || 0),
      cost: (existingTyped.cost || 0) + (info.cost || 0),
    };

    // Override agent/model if provided
    if (info.agent) updated.agent = info.agent;
    if (info.provider) updated.providerId = info.provider;
    if (info.model) updated.modelId = info.model;

    this._sessionInfo.set(sessionId, updated);
    this._notify({ type: 'session:info:updated', sessionId });
  },

  /**
   * Set session info (replaces existing)
   * @param {string} sessionId
   * @param {SessionInfo} info
   */
  setSessionInfo(sessionId: string, info: SessionInfo) {
    this._sessionInfo.set(sessionId, { ...info });
    this._notify({ type: 'session:info:updated', sessionId });
  },

  // ===========================================================================
  // Mutation Methods
  // ===========================================================================

  /**
   * Set current session
   * @param {string | null} sessionId
   */
  setCurrentSession(sessionId: string | null) {
    if (this._currentSessionId === sessionId) return;

    const previousId = this._currentSessionId;
    this._currentSessionId = sessionId;

    // Ensure session exists
    if (sessionId && !this._sessions.has(sessionId)) {
      this._sessions.set(sessionId, this._createSessionRecord(sessionId));
    }

    this._notify({
      type: 'session:changed',
      sessionId,
      previousSessionId: previousId,
    });
  },

  /**
   * Set current session for a specific instance
   * @param {string} instanceId
   * @param {string | null} sessionId
   */
  setCurrentSessionForInstance(instanceId: string, sessionId: string | null) {
    const currentForInstance = this._currentSessionByInstance.get(instanceId);
    if (currentForInstance === sessionId) return;

    this._currentSessionByInstance.set(instanceId, sessionId);

    // Ensure session exists and is linked to instance
    if (sessionId) {
      if (!this._sessions.has(sessionId)) {
        this._sessions.set(sessionId, this._createSessionRecord(sessionId));
      }
      this._addSessionToInstance(instanceId, sessionId);
    }

    // Update global current if this is the active instance
    if (typeof InstanceStore !== 'undefined' && InstanceStore.getActiveInstanceId() === instanceId) {
      this._currentSessionId = sessionId;
    }

    this._notify({
      type: 'session:changed',
      sessionId,
      instanceId,
      previousSessionId: currentForInstance,
    });
  },

  /**
   * Update or create a session
   * @param {string} sessionId
   * @param {Partial<SessionRecord>} updates
   * @returns {SessionRecord}
   */
  upsertSession(sessionId: string, updates: Partial<SessionRecord> = {}) {
    const existing = this._sessions.get(sessionId);
    const now = Date.now();

    const updatesTyped = updates as { instanceId?: string; title?: string; messageIds?: string[]; status?: string };
    /** @type {import('./types.js').SessionRecord} */
    const record = {
      id: sessionId,
      instanceId: updatesTyped.instanceId ?? existing?.instanceId,
      title: updatesTyped.title ?? existing?.title,
      messageIds: updatesTyped.messageIds ?? existing?.messageIds ?? [],
      status: updatesTyped.status ?? existing?.status ?? 'idle',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this._sessions.set(sessionId, record);
    
    // Link session to instance if instanceId provided
    if (record.instanceId) {
      this._addSessionToInstance(record.instanceId, sessionId);
    }
    
    this._notify({ type: 'session:updated', sessionId, instanceId: record.instanceId });

    return record;
  },

  /**
   * Update UI status
   * @param {SessionStatus} status
   */
  updateStatus(status: SessionStatus) {
    if (this._status === status) return;

    const previousStatus = this._status;
    this._status = status;

    // Also update current session's status
    if (this._currentSessionId) {
      const session = this._sessions.get(this._currentSessionId);
      if (session) {
        session.status = status;
        session.updatedAt = Date.now();
      }
    }

    this._notify({
      type: 'status:changed',
      status,
      previousStatus,
      sessionId: this._currentSessionId,
    });
  },

  /**
   * Add message ID to session's message list
   * @param {string} sessionId
   * @param {string} messageId
   */
  addMessageToSession(sessionId: string, messageId: string) {
    let session = this._sessions.get(sessionId);
    
    if (!session) {
      session = this._createSessionRecord(sessionId);
      this._sessions.set(sessionId, session);
    }

    if (!session.messageIds) session.messageIds = [];
    if (!session.messageIds.includes(messageId)) {
      session.messageIds.push(messageId);
      session.updatedAt = Date.now();
      this._notify({ type: 'session:updated', sessionId });
    }
  },

  /**
   * Remove a session
   * @param {string} sessionId
   */
  removeSession(sessionId: string) {
    if (!this._sessions.has(sessionId)) return;

    this._sessions.delete(sessionId);
    this._sessionRevisions.delete(sessionId);
    this._sessionUsage.delete(sessionId);

    // Clear current if it was removed
    if (this._currentSessionId === sessionId) {
      this._currentSessionId = null;
    }

    this._notify({ type: 'session:deleted', sessionId });
  },

  /**
   * Rename a session (API + Store)
   * @param {string} sessionId
   * @param {string} newTitle
   * @returns {Promise<boolean>}
   */
  async renameSession(sessionId: string, newTitle: string) {
    try {
      const result = await window.APIClient?.renameSession(sessionId, newTitle) as { success: boolean } | undefined;
      if (result?.success) {
        const session = this._sessions.get(sessionId);
        if (session) {
          session.title = newTitle;
          session.updatedAt = Date.now();
          this.bumpSessionRevision(sessionId);
          this._notify({ type: 'session:renamed', sessionId, title: newTitle });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[SessionStore] Rename failed:', err);
      return false;
    }
  },

  /**
   * Delete a session (API + Store)
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async deleteSession(sessionId: string) {
    try {
      await window.APIClient?.deleteSession(sessionId);
      // deleteSession returns void, so just proceed if no error
      {
        this.removeSession(sessionId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[SessionStore] Delete failed:', err);
      return false;
    }
  },

  /**
   * Bump session revision (call after any session data change)
   * @param {string} sessionId
   */
  bumpSessionRevision(sessionId: string) {
    const current = this._sessionRevisions.get(sessionId) || 0;
    this._sessionRevisions.set(sessionId, current + 1);
  },

  /**
   * Update token usage for a session
   * @param {string} sessionId
   * @param {{tokens?: number, cost?: number}} delta - Values to add
   */
  updateSessionUsage(sessionId: string, delta: { tokens?: number; cost?: number }) {
    const current = this._sessionUsage.get(sessionId) || { tokens: 0, cost: 0 };
    
    this._sessionUsage.set(sessionId, {
      tokens: current.tokens + (delta.tokens || 0),
      cost: current.cost + (delta.cost || 0),
    });

    this._notify({ type: 'usage:updated', sessionId });
  },

  /**
   * Set token usage for a session (replaces existing)
   * @param {string} sessionId
   * @param {SessionUsage} usage
   */
  setSessionUsage(sessionId: string, usage: SessionUsage) {
    this._sessionUsage.set(sessionId, { ...usage });
    this._notify({ type: 'usage:updated', sessionId });
  },

  // ===========================================================================
  // Subscription
  // ===========================================================================

  /**
   * Subscribe to store changes
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener: SessionStoreListener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  /**
   * Notify all listeners
   * @param {Object} event
   */
  _notify(event: Record<string, unknown>) {
    this._revision++;
    const eventWithMeta = { ...event, timestamp: Date.now(), revision: this._revision };
    this._listeners.forEach((listener: SessionStoreListener) => {
      try {
        listener(eventWithMeta);
      } catch (err) {
        console.error('[SessionStore] Listener error:', err);
      }
    });
  },

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Clear all sessions
   */
  clear() {
    this._sessions.clear();
    this._sessionRevisions.clear();
    this._sessionUsage.clear();
    this._currentSessionId = null;
    this._status = 'idle';
    this._revision = 0;
    this._notify({ type: 'store:cleared' });
  },

  /**
   * Get store stats (for debugging)
   * @returns {Object}
   */
  getStats() {
    return {
      sessionCount: this._sessions.size,
      currentSessionId: this._currentSessionId,
      status: this._status,
      revision: this._revision,
      listenerCount: this._listeners.size,
      totalUsage: this.getTotalUsage(),
    };
  },

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Create a new session record
   * @param {string} sessionId
   * @returns {SessionRecord}
   */
  _createSessionRecord(sessionId: string): SessionRecord {
    const now = Date.now();
    return {
      id: sessionId,
      title: undefined as string | undefined,
      messageIds: [] as string[],
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Add session to instance mapping
   * @param {string} instanceId
   * @param {string} sessionId
   */
  _addSessionToInstance(instanceId: string, sessionId: string) {
    if (!this._sessionsByInstance.has(instanceId)) {
      this._sessionsByInstance.set(instanceId, []);
    }
    const sessions = this._sessionsByInstance.get(instanceId);
    if (sessions && !sessions.includes(sessionId)) {
      sessions.push(sessionId);
    }
  },

  /**
   * Remove session from instance mapping
   * @param {string} instanceId
   * @param {string} sessionId
   */
  _removeSessionFromInstance(instanceId: string, sessionId: string) {
    const sessions = this._sessionsByInstance.get(instanceId);
    if (sessions) {
      const index = sessions.indexOf(sessionId);
      if (index !== -1) {
        sessions.splice(index, 1);
      }
    }
  },

  /**
   * Update status for a specific instance
   * @param {string} instanceId
   * @param {SessionStatus} status
   */
  updateInstanceStatus(instanceId: string, status: SessionStatus) {
    const currentStatus = this._statusByInstance.get(instanceId);
    if (currentStatus === status) return;

    this._statusByInstance.set(instanceId, status);

    // Update global status if this is the active instance
    if (typeof InstanceStore !== 'undefined' && InstanceStore.getActiveInstanceId() === instanceId) {
      this._status = status;
    }

    this._notify({
      type: 'status:changed',
      status,
      instanceId,
      previousStatus: currentStatus,
    });
  },

  /**
   * Clear all data for an instance
   * @param {string} instanceId
   */
  clearInstance(instanceId: string) {
    // Remove all sessions for this instance
    const sessionIds = this._sessionsByInstance.get(instanceId) || [];
    sessionIds.forEach((sessionId: string) => {
      this._sessions.delete(sessionId);
      this._sessionRevisions.delete(sessionId);
      this._sessionUsage.delete(sessionId);
      this._sessionInfo.delete(sessionId);
    });

    // Clear instance mappings
    this._sessionsByInstance.delete(instanceId);
    this._currentSessionByInstance.delete(instanceId);
    this._statusByInstance.delete(instanceId);

    this._notify({ type: 'instance:cleared', instanceId });
  },

  /**
   * Sync current session from active instance
   * Call this when active instance changes
   */
  syncFromActiveInstance() {
    if (typeof InstanceStore === 'undefined') return;
    
    const activeInstanceId = InstanceStore.getActiveInstanceId();
    if (activeInstanceId) {
      this._currentSessionId = this._currentSessionByInstance.get(activeInstanceId) || null;
      this._status = this._statusByInstance.get(activeInstanceId) || 'idle';
    } else {
      this._currentSessionId = null;
      this._status = 'idle';
    }
  },
};

// Global export
(window as unknown as { SessionStore: typeof SessionStore }).SessionStore = SessionStore;
