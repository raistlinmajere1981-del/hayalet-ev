/**
 * OpenCode UI - Configuration
 * 
 * Merkezi yapılandırma dosyası.
 * Tüm hardcoded değerler burada tanımlanır.
 * 
 * Environment variables ve user preferences desteği.
 */

const OpenCodeConfig = {
  // =========================================================================
  // Server Configuration
  // =========================================================================

  /** @type {string} Default server URL */
  serverUrl: 'http://127.0.0.1:4097',

  /** @type {number} Server port */
  serverPort: 4097,

  /** @type {string} SSE endpoint path */
  sseEndpoint: '/sse',

  /** @type {string} API base path */
  apiBasePath: '/api',

  // =========================================================================
  // Connection & Retry Settings
  // =========================================================================

  /** @type {number} Max reconnect attempts */
  maxReconnectAttempts: 5,

  /** @type {number} Base reconnect delay in ms */
  reconnectDelay: 2000,

  /** @type {number} Reconnect backoff multiplier */
  reconnectBackoffMultiplier: 1.5,

  /** @type {number} Max reconnect delay in ms */
  maxReconnectDelay: 30000,

  /** @type {number} Connection timeout in ms */
  connectionTimeout: 10000,

  /** @type {number} Request timeout in ms */
  requestTimeout: 30000,

  /** @type {number} Heartbeat interval in ms */
  heartbeatInterval: 30000,

  // =========================================================================
  // UI Settings
  // =========================================================================

  /** @type {number} Status panel update interval in ms */
  statusPanelUpdateInterval: 30000,

  /** @type {number} Token display update debounce in ms */
  tokenUpdateDebounce: 100,

  /** @type {number} Draft save debounce in ms */
  draftSaveDebounce: 500,

  /** @type {number} Auto-scroll user intent timeout in ms */
  autoScrollIntentTimeout: 3000,

  /** @type {number} Toast notification duration in ms */
  toastDuration: 3000,

  /** @type {number} Copy feedback duration in ms */
  copyFeedbackDuration: 1500,

  // =========================================================================
  // Limits
  // =========================================================================

  /** @type {number} Max history items */
  maxHistoryItems: 50,

  /** @type {number} Max attachment file size in bytes (10MB) */
  maxAttachmentSize: 10 * 1024 * 1024,

  /** @type {number} Max text file size to read content (100KB) */
  maxTextFileReadSize: 100 * 1024,

  /** @type {number} Context window size for display */
  contextWindowSize: 200000,

  /** @type {number} Auto-collapse threshold for step cards (lines) */
  stepAutoCollapseThreshold: 50,

  /** @type {number} Auto-collapse threshold for tool output (characters) */
  toolAutoCollapseThreshold: 500,

  // =========================================================================
  // Default Values
  // =========================================================================

  /** @type {string} Default agent name */
  defaultAgent: 'coder',

  /** @type {string} Default session prefix */
  defaultSessionPrefix: 'ses_',

  /** @type {string} Default message prefix */
  defaultMessagePrefix: 'msg_',

  // =========================================================================
  // Feature Flags
  // =========================================================================

  /** @type {boolean} Enable debug logging */
  debug: false,

  /** @type {boolean} Enable step cards in messages */
  enableStepCards: true,

  /** @type {boolean} Enable inline permissions */
  enableInlinePermissions: true,

  /** @type {boolean} Enable image paste */
  enableImagePaste: true,

  /** @type {boolean} Enable smart scroll */
  enableSmartScroll: true,

  // =========================================================================
  // Quick Action Prompts (Turkish)
  // =========================================================================

  quickActions: {
    analyze: 'Bu projeyi analiz et ve özet çıkar',
    lint: 'Projede lint kontrolü yap ve hataları listele',
    test: 'Projenin testlerini çalıştır',
    'git-status': 'Git status göster ve değişiklikleri özetle',
    compact: '/compact',
  },

  // =========================================================================
  // Commands (Turkish)
  // =========================================================================

  commands: [
    { name: 'clear', description: 'Sohbeti temizle' },
    { name: 'new', description: 'Yeni oturum başlat' },
    { name: 'help', description: 'Yardım göster' },
    { name: 'history', description: 'Geçmişi göster' },
    { name: 'compact', description: 'Context\'ı sıkıştır' },
    { name: 'cancel', description: 'İşlemi iptal et' },
    { name: 'retry', description: 'Son mesajı tekrarla' },
  ],

  // =========================================================================
  // Status Texts (Turkish)
  // =========================================================================

  statusTexts: {
    pending: 'Bekliyor',
    running: 'Çalışıyor',
    success: 'Tamamlandı',
    error: 'Hata',
    waiting: 'Onay bekleniyor',
    processing: 'İşleniyor',
    idle: 'Boşta',
    connected: 'Bağlı',
    disconnected: 'Bağlantı kesildi',
    reconnecting: 'Yeniden bağlanıyor...',
  },

  // =========================================================================
  // ANSI Color Palette
  // =========================================================================

  ansiColors: {
    // Standard colors
    30: '#000000', // Black
    31: '#cd3131', // Red
    32: '#0dbc79', // Green
    33: '#e5e510', // Yellow
    34: '#2472c8', // Blue
    35: '#bc3fbc', // Magenta
    36: '#11a8cd', // Cyan
    37: '#e5e5e5', // White
    // Bright colors
    90: '#666666', // Bright Black
    91: '#f14c4c', // Bright Red
    92: '#23d18b', // Bright Green
    93: '#f5f543', // Bright Yellow
    94: '#3b8eea', // Bright Blue
    95: '#d670d6', // Bright Magenta
    96: '#29b8db', // Bright Cyan
    97: '#ffffff', // Bright White
  },

  // =========================================================================
  // File Extensions
  // =========================================================================

  codeExtensions: [
    '.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.kt',
    '.swift', '.c', '.cpp', '.h', '.cs', '.php', '.html', '.css', '.scss',
    '.json', '.yaml', '.yml', '.xml', '.md', '.sql', '.sh', '.bash',
  ],

  textExtensions: ['.txt', '.log', '.csv', '.env', '.gitignore', '.dockerignore'],

  imageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],

  // =========================================================================
  // Keyboard Shortcuts
  // =========================================================================

  shortcuts: {
    send: 'Enter',
    newLine: 'Shift+Enter',
    historyPrev: 'ArrowUp',
    historyNext: 'ArrowDown',
    cancel: 'Escape',
    approvePermission: 'a',
    denyPermission: 'd',
    confirmYes: 'y',
    confirmNo: 'n',
  },

  // =========================================================================
  // Methods
  // =========================================================================

  /**
   * Get server URL (checks for override)
   * @returns {string}
   */
  getServerUrl() {
    // Check localStorage override
    try {
      const override = localStorage.getItem('opencode-server-url');
      if (override) return override;
    } catch {
      // Storage error
    }
    return this.serverUrl;
  },

  /**
   * Set server URL override
   * @param {string} url
   */
  setServerUrl(url) {
    try {
      localStorage.setItem('opencode-server-url', url);
      this.serverUrl = url;
    } catch {
      // Storage error
    }
  },

  /**
   * Get a config value with optional default
   * @param {string} key - Dot notation key (e.g., 'shortcuts.send')
   * @param {*} defaultValue
   * @returns {*}
   */
  get(key, defaultValue = undefined) {
    const parts = key.split('.');
    let value = this;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue;
      }
    }
    
    return value ?? defaultValue;
  },

  /**
   * Check if a feature is enabled
   * @param {string} feature
   * @returns {boolean}
   */
  isEnabled(feature) {
    const key = `enable${feature.charAt(0).toUpperCase() + feature.slice(1)}`;
    return this[key] === true;
  },

  /**
   * Get status text
   * @param {string} status
   * @returns {string}
   */
  getStatusText(status) {
    return this.statusTexts[status] || status;
  },

  /**
   * Get ANSI color
   * @param {number} code
   * @returns {string | null}
   */
  getAnsiColor(code) {
    return this.ansiColors[code] || null;
  },

  /**
   * Load user preferences from localStorage
   */
  loadUserPreferences() {
    try {
      const prefs = localStorage.getItem('opencode-preferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        // Merge with defaults (user prefs override)
        Object.assign(this, parsed);
        console.log('[OpenCodeConfig] User preferences loaded');
      }
    } catch (err) {
      console.warn('[OpenCodeConfig] Failed to load preferences:', err);
    }
  },

  /**
   * Save user preferences to localStorage
   * @param {Object} prefs
   */
  saveUserPreferences(prefs) {
    try {
      const existing = localStorage.getItem('opencode-preferences');
      const current = existing ? JSON.parse(existing) : {};
      const merged = { ...current, ...prefs };
      localStorage.setItem('opencode-preferences', JSON.stringify(merged));
      Object.assign(this, prefs);
      console.log('[OpenCodeConfig] User preferences saved');
    } catch (err) {
      console.warn('[OpenCodeConfig] Failed to save preferences:', err);
    }
  },

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    try {
      localStorage.removeItem('opencode-preferences');
      localStorage.removeItem('opencode-server-url');
      // Reload page to apply defaults
      window.location.reload();
    } catch {
      // Storage error
    }
  },
};

// Load user preferences on init
OpenCodeConfig.loadUserPreferences();

// Global export
window.OpenCodeConfig = OpenCodeConfig;

