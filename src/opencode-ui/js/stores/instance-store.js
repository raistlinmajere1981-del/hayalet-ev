/**
 * OpenCode UI - Instance Store
 * 
 * Multi-instance (workspace) yönetimi için store.
 * Her instance bağımsız bir OpenCode server bağlantısı ve session seti içerir.
 * 
 * Adapted from CodeNomad's stores/instances.ts
 */

const InstanceStore = {
  // ===========================================================================
  // State
  // ===========================================================================

  /** @type {Map<string, Instance>} */
  _instances: new Map(),

  /** @type {string | null} */
  _activeInstanceId: null,

  /** @type {Set<Function>} */
  _listeners: new Set(),

  /** @type {number} */
  _revision: 0,

  /** @type {Map<string, string | null>} Instance disconnection info */
  _disconnectedInstances: new Map(),

  // ===========================================================================
  // Types (JSDoc)
  // ===========================================================================

  /**
   * @typedef {Object} Instance
   * @property {string} id - Unique instance ID
   * @property {string} folder - Workspace folder path
   * @property {string} [name] - Display name
   * @property {'connecting' | 'connected' | 'disconnected' | 'error'} status - Connection status
   * @property {string} [url] - SSE endpoint URL
   * @property {number} createdAt - Creation timestamp
   * @property {number} updatedAt - Last update timestamp
   * @property {string | null} [currentSessionId] - Current session for this instance
   * @property {Object} [metadata] - Additional metadata (lspStatus, etc.)
   */

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get all instances
   * @returns {Map<string, Instance>}
   */
  getInstances() {
    return new Map(this._instances);
  },

  /**
   * Get instances as array
   * @returns {Instance[]}
   */
  getInstancesArray() {
    return Array.from(this._instances.values());
  },

  /**
   * Get instance by ID
   * @param {string} instanceId
   * @returns {Instance | undefined}
   */
  getInstance(instanceId) {
    return this._instances.get(instanceId);
  },

  /**
   * Get active instance ID
   * @returns {string | null}
   */
  getActiveInstanceId() {
    return this._activeInstanceId;
  },

  /**
   * Get active instance
   * @returns {Instance | null}
   */
  getActiveInstance() {
    if (!this._activeInstanceId) return null;
    return this._instances.get(this._activeInstanceId) || null;
  },

  // ===========================================================================
  // Null-Safe Helper Methods
  // ===========================================================================

  /**
   * Get active instance path (null-safe)
   * @returns {string | null}
   */
  getActiveInstancePath() {
    return this.getActiveInstance()?.folder || null;
  },

  /**
   * Get active instance session ID (null-safe)
   * @returns {string | null}
   */
  getActiveInstanceSessionId() {
    return this.getActiveInstance()?.sessionId || null;
  },

  /**
   * Get active instance URL (null-safe)
   * @returns {string | null}
   */
  getActiveInstanceUrl() {
    return this.getActiveInstance()?.url || null;
  },

  /**
   * Get active instance name (null-safe)
   * @returns {string | null}
   */
  getActiveInstanceName() {
    return this.getActiveInstance()?.name || null;
  },

  /**
   * Get active instance status (null-safe)
   * @returns {string}
   */
  getActiveInstanceStatus() {
    return this.getActiveInstance()?.status || 'disconnected';
  },

  /**
   * Check if active instance exists and is connected
   * @returns {boolean}
   */
  isActiveInstanceConnected() {
    return this.getActiveInstance()?.status === 'connected';
  },

  /**
   * Safely get a property from active instance
   * @param {string} property - Property name
   * @param {*} defaultValue - Default value if not found
   * @returns {*}
   */
  getActiveInstanceProperty(property, defaultValue = null) {
    const instance = this.getActiveInstance();
    if (!instance) return defaultValue;
    return instance[property] ?? defaultValue;
  },

  /**
   * Check if any instances exist
   * @returns {boolean}
   */
  hasInstances() {
    return this._instances.size > 0;
  },

  /**
   * Get instance count
   * @returns {number}
   */
  getInstanceCount() {
    return this._instances.size;
  },

  /**
   * Check if instance is connected
   * @param {string} instanceId
   * @returns {boolean}
   */
  isConnected(instanceId) {
    const instance = this._instances.get(instanceId);
    return instance?.status === 'connected';
  },

  /**
   * Get disconnection reason for an instance
   * @param {string} instanceId
   * @returns {string | null}
   */
  getDisconnectionReason(instanceId) {
    return this._disconnectedInstances.get(instanceId) || null;
  },

  // ===========================================================================
  // Mutation Methods
  // ===========================================================================

  /**
   * Find instance by folder path
   * @param {string} folderPath
   * @returns {Instance | null}
   */
  findByFolder(folderPath) {
    if (!folderPath) return null;
    
    const normalizedPath = this._normalizePath(folderPath);
    
    for (const instance of this._instances.values()) {
      if (this._normalizePath(instance.folder) === normalizedPath) {
        return instance;
      }
    }
    return null;
  },

  /**
   * Normalize path for comparison (handle trailing slashes, backslashes)
   * @param {string} path
   * @returns {string}
   */
  _normalizePath(path) {
    if (!path) return '';
    return path.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
  },

  /**
   * Create a new instance (with duplicate prevention)
   * @param {Object} options
   * @param {string} options.folder - Workspace folder path
   * @param {string} [options.name] - Display name
   * @param {string} [options.url] - SSE endpoint URL
   * @returns {Instance}
   */
  createInstance(options) {
    // Check for existing instance with same folder
    const existingInstance = this.findByFolder(options.folder);
    if (existingInstance) {
      console.log('[InstanceStore] Instance already exists for folder:', options.folder, '-> activating existing');
      
      // Update URL if provided and different
      if (options.url && existingInstance.url !== options.url) {
        this.updateInstance(existingInstance.id, { url: options.url });
      }
      
      // Activate existing instance
      this.setActiveInstance(existingInstance.id);
      
      return existingInstance;
    }

    const now = Date.now();
    const instanceId = `inst_${now}_${Math.random().toString(36).substr(2, 6)}`;
    
    /** @type {Instance} */
    const instance = {
      id: instanceId,
      folder: options.folder,
      name: options.name || this._extractFolderName(options.folder),
      status: 'connecting',
      url: options.url,
      createdAt: now,
      updatedAt: now,
      currentSessionId: null,
      metadata: {},
    };

    this._instances.set(instanceId, instance);
    
    // Auto-activate if first instance
    if (this._instances.size === 1) {
      this._activeInstanceId = instanceId;
    }

    console.log('[InstanceStore] Created new instance:', instanceId, 'for folder:', options.folder);
    this._notify({ type: 'instance:created', instanceId, instance });
    return instance;
  },

  /**
   * Add an existing instance (e.g., from server)
   * @param {Instance} instance
   */
  addInstance(instance) {
    this._instances.set(instance.id, instance);
    
    // Auto-activate if first instance
    if (this._instances.size === 1) {
      this._activeInstanceId = instance.id;
    }

    this._notify({ type: 'instance:created', instanceId: instance.id, instance });
  },

  /**
   * Update an instance
   * @param {string} instanceId
   * @param {Partial<Instance>} updates
   * @returns {Instance | null}
   */
  updateInstance(instanceId, updates) {
    const instance = this._instances.get(instanceId);
    if (!instance) return null;

    const updated = {
      ...instance,
      ...updates,
      updatedAt: Date.now(),
    };

    this._instances.set(instanceId, updated);
    this._notify({ type: 'instance:updated', instanceId, instance: updated, updates });
    return updated;
  },

  /**
   * Set instance status
   * @param {string} instanceId
   * @param {'connecting' | 'connected' | 'disconnected' | 'error'} status
   * @param {string} [reason] - Reason for disconnection/error
   */
  setInstanceStatus(instanceId, status, reason) {
    const instance = this._instances.get(instanceId);
    if (!instance) return;

    instance.status = status;
    instance.updatedAt = Date.now();

    if (status === 'disconnected' || status === 'error') {
      this._disconnectedInstances.set(instanceId, reason || null);
    } else {
      this._disconnectedInstances.delete(instanceId);
    }

    this._notify({ type: 'instance:status', instanceId, status, reason });
  },

  /**
   * Set active instance
   * @param {string | null} instanceId
   */
  setActiveInstance(instanceId) {
    if (this._activeInstanceId === instanceId) return;
    if (instanceId && !this._instances.has(instanceId)) return;

    const previousId = this._activeInstanceId;
    this._activeInstanceId = instanceId;

    this._notify({ 
      type: 'instance:activated', 
      instanceId, 
      previousInstanceId: previousId 
    });
  },

  /**
   * Set current session for an instance
   * @param {string} instanceId
   * @param {string | null} sessionId
   */
  setInstanceSession(instanceId, sessionId) {
    const instance = this._instances.get(instanceId);
    if (!instance) return;

    instance.currentSessionId = sessionId;
    instance.updatedAt = Date.now();

    this._notify({ type: 'instance:session', instanceId, sessionId });
  },

  /**
   * Get current session ID for an instance
   * @param {string} instanceId
   * @returns {string | null}
   */
  getInstanceSession(instanceId) {
    const instance = this._instances.get(instanceId);
    return instance?.currentSessionId || null;
  },

  /**
   * Remove an instance
   * @param {string} instanceId
   */
  removeInstance(instanceId) {
    if (!this._instances.has(instanceId)) return;

    this._instances.delete(instanceId);
    this._disconnectedInstances.delete(instanceId);

    // Update active instance if removed
    if (this._activeInstanceId === instanceId) {
      const remaining = Array.from(this._instances.keys());
      this._activeInstanceId = remaining.length > 0 ? remaining[0] : null;
    }

    this._notify({ type: 'instance:removed', instanceId });
  },

  /**
   * Update instance metadata
   * @param {string} instanceId
   * @param {Object} metadata
   */
  updateMetadata(instanceId, metadata) {
    const instance = this._instances.get(instanceId);
    if (!instance) return;

    instance.metadata = {
      ...instance.metadata,
      ...metadata,
    };
    instance.updatedAt = Date.now();

    this._notify({ type: 'instance:metadata', instanceId, metadata });
  },

  // ===========================================================================
  // Navigation Methods
  // ===========================================================================

  /**
   * Switch to next instance
   * @returns {string | null} New active instance ID
   */
  nextInstance() {
    const ids = Array.from(this._instances.keys());
    if (ids.length <= 1) return this._activeInstanceId;

    const currentIndex = ids.indexOf(this._activeInstanceId || '');
    const nextIndex = (currentIndex + 1) % ids.length;
    
    this.setActiveInstance(ids[nextIndex]);
    return ids[nextIndex];
  },

  /**
   * Switch to previous instance
   * @returns {string | null} New active instance ID
   */
  prevInstance() {
    const ids = Array.from(this._instances.keys());
    if (ids.length <= 1) return this._activeInstanceId;

    const currentIndex = ids.indexOf(this._activeInstanceId || '');
    const prevIndex = currentIndex <= 0 ? ids.length - 1 : currentIndex - 1;
    
    this.setActiveInstance(ids[prevIndex]);
    return ids[prevIndex];
  },

  /**
   * Switch to instance by index (1-based for keyboard shortcuts)
   * @param {number} index - 1-based index
   * @returns {string | null} New active instance ID
   */
  switchToIndex(index) {
    const ids = Array.from(this._instances.keys());
    const arrayIndex = index - 1;
    
    if (arrayIndex >= 0 && arrayIndex < ids.length) {
      this.setActiveInstance(ids[arrayIndex]);
      return ids[arrayIndex];
    }
    return this._activeInstanceId;
  },

  // ===========================================================================
  // Subscription
  // ===========================================================================

  /**
   * Subscribe to store changes
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  /**
   * Notify all listeners
   * @param {Object} event
   */
  _notify(event) {
    this._revision++;
    const eventWithMeta = { 
      ...event, 
      timestamp: Date.now(), 
      revision: this._revision 
    };
    
    this._listeners.forEach(listener => {
      try {
        listener(eventWithMeta);
      } catch (err) {
        console.error('[InstanceStore] Listener error:', err);
      }
    });
  },

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Clear all instances
   */
  clear() {
    this._instances.clear();
    this._disconnectedInstances.clear();
    this._activeInstanceId = null;
    this._revision = 0;
    this._notify({ type: 'store:cleared' });
  },

  /**
   * Get store stats
   * @returns {Object}
   */
  getStats() {
    return {
      instanceCount: this._instances.size,
      activeInstanceId: this._activeInstanceId,
      revision: this._revision,
      listenerCount: this._listeners.size,
    };
  },

  /**
   * Extract folder name from path
   * @param {string} folderPath
   * @returns {string}
   */
  _extractFolderName(folderPath) {
    if (!folderPath) return 'Unknown';
    const parts = folderPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || 'Workspace';
  },
};

// Global export
window.InstanceStore = InstanceStore;

