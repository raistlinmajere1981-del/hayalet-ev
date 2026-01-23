/**
 * OpenCode UI - SSE Client
 * 
 * Server-Sent Events bağlantısını yönetir.
 * Real-time event streaming için EventSource API kullanır.
 */

const SSEClient = {
  // ===========================================================================
  // Legacy Single Connection State (backward compatibility)
  // ===========================================================================
  
  /** @type {EventSource | null} */
  _eventSource: null,
  
  /** @type {string | null} */
  _serverUrl: null,
  
  /** @type {boolean} */
  _connected: false,
  
  /** @type {number} */
  _reconnectAttempts: 0,
  
  /** @type {number} */
  _maxReconnectAttempts: null,
  
  /** @type {number} */
  _reconnectDelay: null,

  // ===========================================================================
  // Multi-Instance State
  // ===========================================================================

  /** @type {Map<string, EventSource>} Instance ID -> EventSource */
  _connections: new Map(),

  /** @type {Map<string, string>} Instance ID -> Server URL */
  _instanceUrls: new Map(),

  /** @type {Map<string, boolean>} Instance ID -> Connection status */
  _connectionStatus: new Map(),

  /** @type {Map<string, number>} Instance ID -> Reconnect attempts */
  _instanceReconnectAttempts: new Map(),

  /** @type {Map<string, number>} Instance ID -> Reconnect timeout ID */
  _instanceReconnectTimeouts: new Map(),

  /**
   * Get config value with fallback
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  _getConfig(key, fallback) {
    if (typeof OpenCodeConfig !== 'undefined') {
      return OpenCodeConfig.get(key, fallback);
    }
    return fallback;
  },

  /**
   * Get server URL
   * @returns {string}
   */
  _getServerUrl() {
    if (!this._serverUrl) {
      this._serverUrl = (typeof OpenCodeConfig !== 'undefined')
        ? OpenCodeConfig.getServerUrl()
        : 'http://127.0.0.1:4097';
    }
    return this._serverUrl;
  },

  /**
   * Get max reconnect attempts
   * @returns {number}
   */
  _getMaxReconnectAttempts() {
    if (this._maxReconnectAttempts === null) {
      this._maxReconnectAttempts = this._getConfig('maxReconnectAttempts', 5);
    }
    return this._maxReconnectAttempts;
  },

  /**
   * Get reconnect delay
   * @returns {number}
   */
  _getReconnectDelay() {
    if (this._reconnectDelay === null) {
      this._reconnectDelay = this._getConfig('reconnectDelay', 2000);
    }
    return this._reconnectDelay;
  },
  
  /** @type {Map<string, Function[]>} */
  _listeners: new Map(),
  
  /** @type {number | null} */
  _reconnectTimeout: null,

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * SSE bağlantısını başlat
   * @param {string} [serverUrl] - Server URL (optional)
   * @returns {Promise<boolean>}
   */
  async connect(serverUrl) {
    if (serverUrl) {
      this._serverUrl = serverUrl;
    }

    return new Promise((resolve) => {
      try {
        // Mevcut bağlantıyı kapat
        this.disconnect();

        const eventsUrl = `${this._getServerUrl()}/api/events`;
        console.log('[SSE] Connecting to:', eventsUrl);

        this._eventSource = new EventSource(eventsUrl);

        this._eventSource.onopen = () => {
          console.log('[SSE] Connected');
          this._connected = true;
          this._reconnectAttempts = 0;
          this._emit('connection', { status: 'connected' });
          resolve(true);
        };

        this._eventSource.onmessage = (event) => {
          this._handleMessage(event);
        };

        this._eventSource.onerror = (error) => {
          console.error('[SSE] Error:', error);
          this._connected = false;
          this._emit('connection', { status: 'error', error });
          
          // Auto-reconnect
          if (this._reconnectAttempts < this._maxReconnectAttempts) {
            this._scheduleReconnect();
          } else {
            this._emit('connection', { status: 'failed' });
          }
          
          resolve(false);
        };
      } catch (err) {
        console.error('[SSE] Connection failed:', err);
        this._emit('connection', { status: 'error', error: err });
        resolve(false);
      }
    });
  },

  /**
   * SSE bağlantısını kapat
   */
  disconnect() {
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }

    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }

    this._connected = false;
    this._emit('connection', { status: 'disconnected' });
  },

  /**
   * Bağlantı durumunu kontrol et
   * @returns {boolean}
   */
  isConnected() {
    return this._connected && this._eventSource?.readyState === EventSource.OPEN;
  },

  // ===========================================================================
  // Multi-Instance API
  // ===========================================================================

  /**
   * Connect to a specific instance
   * @param {string} instanceId - Instance ID
   * @param {string} serverUrl - Server URL for this instance
   * @returns {Promise<boolean>}
   */
  async connectInstance(instanceId, serverUrl) {
    return new Promise((resolve) => {
      try {
        // Close existing connection for this instance
        this.disconnectInstance(instanceId);

        this._instanceUrls.set(instanceId, serverUrl);
        const eventsUrl = `${serverUrl}/api/events`;
        console.log(`[SSE] Connecting instance ${instanceId} to:`, eventsUrl);

        const eventSource = new EventSource(eventsUrl);
        this._connections.set(instanceId, eventSource);

        eventSource.onopen = () => {
          console.log(`[SSE] Instance ${instanceId} connected`);
          this._connectionStatus.set(instanceId, true);
          this._instanceReconnectAttempts.set(instanceId, 0);
          this._emit('connection', { status: 'connected', instanceId });
          
          // Update InstanceStore
          if (typeof InstanceStore !== 'undefined') {
            InstanceStore.setInstanceStatus(instanceId, 'connected');
          }
          
          resolve(true);
        };

        eventSource.onmessage = (event) => {
          this._handleInstanceMessage(instanceId, event);
        };

        eventSource.onerror = (error) => {
          console.error(`[SSE] Instance ${instanceId} error:`, error);
          this._connectionStatus.set(instanceId, false);
          this._emit('connection', { status: 'error', instanceId, error });
          
          // Update InstanceStore
          if (typeof InstanceStore !== 'undefined') {
            InstanceStore.setInstanceStatus(instanceId, 'error', 'Connection error');
          }
          
          // Auto-reconnect
          const attempts = this._instanceReconnectAttempts.get(instanceId) || 0;
          if (attempts < this._getMaxReconnectAttempts()) {
            this._scheduleInstanceReconnect(instanceId);
          } else {
            this._emit('connection', { status: 'failed', instanceId });
          }
          
          resolve(false);
        };
      } catch (err) {
        console.error(`[SSE] Instance ${instanceId} connection failed:`, err);
        this._emit('connection', { status: 'error', instanceId, error: err });
        resolve(false);
      }
    });
  },

  /**
   * Disconnect a specific instance
   * @param {string} instanceId
   */
  disconnectInstance(instanceId) {
    // Clear reconnect timeout
    const timeoutId = this._instanceReconnectTimeouts.get(instanceId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this._instanceReconnectTimeouts.delete(instanceId);
    }

    // Close EventSource
    const eventSource = this._connections.get(instanceId);
    if (eventSource) {
      eventSource.close();
      this._connections.delete(instanceId);
    }

    this._connectionStatus.set(instanceId, false);
    this._instanceUrls.delete(instanceId);
    this._instanceReconnectAttempts.delete(instanceId);
    
    this._emit('connection', { status: 'disconnected', instanceId });
  },

  /**
   * Check if instance is connected
   * @param {string} instanceId
   * @returns {boolean}
   */
  isInstanceConnected(instanceId) {
    const eventSource = this._connections.get(instanceId);
    return this._connectionStatus.get(instanceId) === true && 
           eventSource?.readyState === EventSource.OPEN;
  },

  /**
   * Get all connected instance IDs
   * @returns {string[]}
   */
  getConnectedInstances() {
    return Array.from(this._connections.keys())
      .filter(id => this.isInstanceConnected(id));
  },

  /**
   * Disconnect all instances
   */
  disconnectAll() {
    const instanceIds = Array.from(this._connections.keys());
    instanceIds.forEach(id => this.disconnectInstance(id));
    
    // Also disconnect legacy single connection
    this.disconnect();
  },

  /**
   * Handle message from a specific instance
   * @param {string} instanceId
   * @param {MessageEvent} event
   */
  _handleInstanceMessage(instanceId, event) {
    try {
      const data = JSON.parse(event.data);
      
      // Debug log (skip heartbeat)
      if (data.type !== 'heartbeat') {
        console.log(`[SSE] Instance ${instanceId} event:`, data.type, data);
      }

      // Enrich data with instanceId
      const enrichedData = { ...data, instanceId };

      // Emit with instanceId prefix for instance-specific listeners
      this._emit(`${instanceId}:${data.type}`, enrichedData);
      
      // Also emit globally
      this._emit(data.type, enrichedData);
      this._emit('*', enrichedData);
    } catch (err) {
      console.error(`[SSE] Instance ${instanceId} failed to parse:`, err, event.data);
    }
  },

  /**
   * Schedule reconnect for an instance
   * @param {string} instanceId
   */
  _scheduleInstanceReconnect(instanceId) {
    const attempts = (this._instanceReconnectAttempts.get(instanceId) || 0) + 1;
    this._instanceReconnectAttempts.set(instanceId, attempts);
    
    const delay = this._getReconnectDelay() * attempts;
    console.log(`[SSE] Instance ${instanceId} reconnecting in ${delay}ms (attempt ${attempts})`);
    
    this._emit('connection', { 
      status: 'reconnecting', 
      instanceId,
      attempt: attempts,
      maxAttempts: this._getMaxReconnectAttempts() 
    });

    const timeoutId = setTimeout(() => {
      const serverUrl = this._instanceUrls.get(instanceId);
      if (serverUrl) {
        this.connectInstance(instanceId, serverUrl);
      }
    }, delay);
    
    this._instanceReconnectTimeouts.set(instanceId, timeoutId);
  },

  // ===========================================================================
  // Event Listener API
  // ===========================================================================

  /**
   * Event listener ekle
   * @param {string} eventType - Event tipi
   * @param {Function} callback - Callback fonksiyonu
   * @returns {Function} - Unsubscribe fonksiyonu
   */
  on(eventType, callback) {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, []);
    }
    this._listeners.get(eventType).push(callback);

    // Unsubscribe fonksiyonu dön
    return () => {
      const listeners = this._listeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  },

  /**
   * Tüm event'leri dinle
   * @param {Function} callback - Callback fonksiyonu
   * @returns {Function} - Unsubscribe fonksiyonu
   */
  onAny(callback) {
    return this.on('*', callback);
  },

  /**
   * Event listener kaldır
   * @param {string} eventType - Event tipi
   * @param {Function} [callback] - Specific callback (optional)
   */
  off(eventType, callback) {
    if (callback) {
      const listeners = this._listeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else {
      this._listeners.delete(eventType);
    }
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * SSE mesajını işle
   * @param {MessageEvent} event
   */
  _handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Debug log
      if (data.type !== 'heartbeat') {
        console.log('[SSE] Event:', data.type, data);
      }

      // Event tipine göre emit
      this._emit(data.type, data);
      
      // Wildcard listener'lara da gönder
      this._emit('*', data);
    } catch (err) {
      console.error('[SSE] Failed to parse message:', err, event.data);
    }
  },

  /**
   * Event emit et
   * @param {string} eventType
   * @param {any} data
   */
  _emit(eventType, data) {
    const listeners = this._listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[SSE] Listener error for ${eventType}:`, err);
        }
      });
    }
  },

  /**
   * Yeniden bağlanmayı planla
   */
  _scheduleReconnect() {
    this._reconnectAttempts++;
    const delay = this._reconnectDelay * this._reconnectAttempts;
    
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`);
    
    this._emit('connection', { 
      status: 'reconnecting', 
      attempt: this._reconnectAttempts,
      maxAttempts: this._getMaxReconnectAttempts() 
    });

    this._reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
};

// Global'e ekle
window.SSEClient = SSEClient;
