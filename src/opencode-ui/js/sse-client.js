/**
 * OpenCode UI - SSE Client
 * 
 * Server-Sent Events bağlantısını yönetir.
 * Real-time event streaming için EventSource API kullanır.
 */

const SSEClient = {
  /** @type {EventSource | null} */
  _eventSource: null,
  
  /** @type {string} */
  _serverUrl: 'http://127.0.0.1:4097',
  
  /** @type {boolean} */
  _connected: false,
  
  /** @type {number} */
  _reconnectAttempts: 0,
  
  /** @type {number} */
  _maxReconnectAttempts: 5,
  
  /** @type {number} */
  _reconnectDelay: 2000,
  
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

        const eventsUrl = `${this._serverUrl}/api/events`;
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
      maxAttempts: this._maxReconnectAttempts 
    });

    this._reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
};

// Global'e ekle
window.SSEClient = SSEClient;
