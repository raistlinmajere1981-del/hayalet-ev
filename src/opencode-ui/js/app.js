/**
 * OpenCode UI - Main Application
 * 
 * Tüm bileşenleri koordine eden ana uygulama.
 * SSE event'lerini dinler ve UI'yı günceller.
 */

const OpenCodeApp = {
  /** @type {boolean} */
  _initialized: false,

  /** @type {string} */
  _serverUrl: 'http://127.0.0.1:4097',

  /** @type {object | null} */
  _currentSession: null,

  // _currentMessageId removed - now managed by StoreBridge.getCurrentMessageId()

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Uygulamayı başlat
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    console.log('[OpenCode] Initializing...');

    // URL parametrelerinden server URL'ini al
    this._parseUrlParams();

    // UI bileşenlerini başlat
    this._initComponents();

    // Event listener'ları kur
    this._setupEventListeners();

    // Session store subscription (UI güncellemeleri için)
    this._subscribeToSessionStore();

    // SSE bağlantısını başlat
    await this._connectSSE();

    console.log('[OpenCode] Initialized');
  },

  /**
   * URL parametrelerini parse et
   */
  _parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const serverUrl = params.get('server');
    if (serverUrl) {
      this._serverUrl = serverUrl;
    }
  },

  /**
   * UI bileşenlerini başlat
   */
  _initComponents() {
    // Message Renderer - Reactive mode aktif
    const messagesList = document.getElementById('messages-list');
    if (messagesList) {
      MessageRenderer.init(messagesList, { reactive: true });
      console.log('[OpenCode] MessageRenderer initialized with reactive mode');
    }

    // Prompt Handler
    const promptInput = document.getElementById('prompt-input');
    const sendButton = document.getElementById('btn-send');
    if (promptInput && sendButton) {
      PromptHandler.init({
        input: promptInput,
        sendButton: sendButton,
        onSend: (message) => this._handleSendMessage(message),
      });
    }

    // Permission Modal - Queue-based permission handling
    if (typeof PermissionModal !== 'undefined') {
      PermissionModal.init();
      console.log('[OpenCode] PermissionModal initialized');
    }

    // Question Modal - Queue-based question handling
    if (typeof QuestionModal !== 'undefined') {
      QuestionModal.init();
      console.log('[OpenCode] QuestionModal initialized');
    }

    // API Client URL
    APIClient.setServerUrl(this._serverUrl);
  },

  /**
   * Event listener'ları kur
   */
  _setupEventListeners() {
    // New session button
    const newSessionBtn = document.getElementById('btn-new-session');
    if (newSessionBtn) {
      newSessionBtn.addEventListener('click', () => this._handleNewSession());
    }

    // Quick actions
    const quickActions = document.querySelectorAll('.quick-action');
    quickActions.forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        if (prompt) {
          PromptHandler.setValue(prompt);
          PromptHandler.focus();
        }
      });
    });

    // Permission modal buttons
    const approveBtn = document.getElementById('btn-approve');
    const denyBtn = document.getElementById('btn-deny');
    if (approveBtn) {
      approveBtn.addEventListener('click', () => this._handlePermissionResponse(true));
    }
    if (denyBtn) {
      denyBtn.addEventListener('click', () => this._handlePermissionResponse(false));
    }

    // Question modal
    const answerBtn = document.getElementById('btn-answer');
    if (answerBtn) {
      answerBtn.addEventListener('click', () => this._handleQuestionResponse());
    }
  },

  // =========================================================================
  // SSE Connection
  // =========================================================================

  /**
   * SSE bağlantısını başlat
   */
  async _connectSSE() {
    this._updateStatus('connecting', 'Bağlanıyor...');

    // SSE event listener'ları - StoreBridge üzerinden yönlendirilir
    SSEClient.on('connection', (data) => this._handleConnectionChange(data));
    
    // Session events -> StoreBridge (include top-level sessionId)
    SSEClient.on('session.started', (data) => {
      StoreBridge.handleEvent('session.started', { ...data.data, sessionId: data.sessionId });
      this._handleSessionStarted(data);
    });
    SSEClient.on('session.stopped', (data) => {
      StoreBridge.handleEvent('session.stopped', { ...data.data, sessionId: data.sessionId });
      this._handleSessionStopped(data);
    });
    
    // Message events -> StoreBridge (reactive mode - include sessionId)
    SSEClient.on('message.start', (data) => {
      StoreBridge.handleEvent('message.start', { ...data.data, sessionId: data.sessionId });
    });
    SSEClient.on('message.created', (data) => {
      StoreBridge.handleEvent('message.created', { ...data.data, sessionId: data.sessionId });
    });
    SSEClient.on('message.delta', (data) => {
      StoreBridge.handleEvent('message.delta', { ...data.data, sessionId: data.sessionId });
      // Status update only (UI handled by reactive store)
      this._updateStatus('processing', 'İşleniyor...');
      PromptHandler.setProcessing(true);
    });
    SSEClient.on('message.end', (data) => {
      StoreBridge.handleEvent('message.end', { ...data.data, sessionId: data.sessionId });
      // Status update only
      this._updateStatus('connected', 'Bağlı');
      PromptHandler.setProcessing(false);
      PromptHandler.focus();
    });
    SSEClient.on('message.completed', (data) => {
      StoreBridge.handleEvent('message.completed', { ...data.data, sessionId: data.sessionId });
      // Status update only
      this._updateStatus('connected', 'Bağlı');
      PromptHandler.setProcessing(false);
      PromptHandler.focus();
    });
    
    // Tool events -> StoreBridge (reactive mode - include sessionId)
    SSEClient.on('tool.start', (data) => {
      StoreBridge.handleEvent('tool.start', { ...data.data, sessionId: data.sessionId });
    });
    SSEClient.on('tool.output', (data) => {
      StoreBridge.handleEvent('tool.output', { ...data.data, sessionId: data.sessionId });
    });
    SSEClient.on('tool.end', (data) => {
      StoreBridge.handleEvent('tool.end', { ...data.data, sessionId: data.sessionId });
    });
    
    // Permission & Question (modal handling required)
    SSEClient.on('permission.request', (data) => this._handlePermissionRequest(data));
    SSEClient.on('question.ask', (data) => this._handleQuestion(data));
    
    // Thinking events -> StoreBridge (reactive mode - include sessionId)
    SSEClient.on('thinking.start', (data) => {
      StoreBridge.handleEvent('thinking.start', { ...data.data, sessionId: data.sessionId });
    });
    SSEClient.on('thinking.delta', (data) => {
      StoreBridge.handleEvent('thinking.delta', { ...data.data, sessionId: data.sessionId });
    });
    SSEClient.on('thinking.end', (data) => {
      StoreBridge.handleEvent('thinking.end', { ...data.data, sessionId: data.sessionId });
    });
    
    // Status events -> StoreBridge
    SSEClient.on('status.change', (data) => {
      StoreBridge.handleEvent('status.change', data.data);
      this._handleStatusChange(data);
    });
    SSEClient.on('session.idle', (data) => {
      StoreBridge.handleEvent('session.idle', data.data);
      this._handleStatusChange({ data: { status: 'idle' } });
    });
    SSEClient.on('session.completed', (data) => {
      StoreBridge.handleEvent('session.completed', data.data);
      this._handleStatusChange({ data: { status: 'idle' } });
    });
    
    // Error handling
    SSEClient.on('error', (data) => this._handleError(data));

    // SSE Server'a bağlan
    const connected = await SSEClient.connect(this._serverUrl);
    
    if (connected) {
      this._updateStatus('connected', 'SSE Bağlı');
      
      // OpenCode'a bağlan
      await this._connectToOpenCode();
    } else {
      this._updateStatus('error', 'Bağlantı hatası');
    }
  },

  /**
   * OpenCode'a bağlan
   */
  async _connectToOpenCode() {
    this._updateStatus('connecting', 'OpenCode\'a bağlanıyor...');
    
    try {
      const result = await APIClient.connect();
      
      if (result.success) {
        this._updateStatus('connected', 'Hazır');
        PromptHandler.focus();
        console.log('[OpenCode] Connected to OpenCode, session:', result.sessionId);
      } else {
        this._updateStatus('warning', 'OpenCode bağlantısı bekleniyor');
        console.warn('[OpenCode] OpenCode connection failed:', result.error);
      }
    } catch (err) {
      this._updateStatus('warning', 'OpenCode bağlantısı bekleniyor');
      console.warn('[OpenCode] OpenCode connection error:', err);
    }
  },

  // =========================================================================
  // Event Handlers - Connection
  // =========================================================================

  /**
   * Bağlantı durumu değişikliği
   */
  _handleConnectionChange(data) {
    switch (data.status) {
      case 'connected':
        this._updateStatus('connected', 'Bağlı');
        break;
      case 'disconnected':
        this._updateStatus('disconnected', 'Bağlantı kesildi');
        break;
      case 'reconnecting':
        this._updateStatus('connecting', `Yeniden bağlanıyor (${data.attempt}/${data.maxAttempts})...`);
        break;
      case 'failed':
        this._updateStatus('error', 'Bağlantı başarısız');
        break;
      case 'error':
        this._updateStatus('error', 'Hata');
        break;
    }
  },

  // =========================================================================
  // Event Handlers - Session
  // =========================================================================

  /**
   * Session başladı
   */
  _handleSessionStarted(data) {
    console.log('[OpenCode] Session started:', data);
    this._currentSession = data.data?.session || null;
    
    // Eğer mevcut mesajlar varsa yükle
    if (this._currentSession?.messages) {
      this._currentSession.messages.forEach(msg => {
        MessageRenderer.addMessage({
          id: `msg-${msg.timestamp}`,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        });
      });
    }
  },

  /**
   * Session bitti
   */
  _handleSessionStopped(data) {
    console.log('[OpenCode] Session stopped:', data);
    this._currentSession = null;
    this._updateStatus('connected', 'Bağlı');
  },

  // =========================================================================
  // Event Handlers - Messages
  // =========================================================================

  // =========================================================================
  // LEGACY HANDLERS REMOVED - Now using StoreBridge + Reactive Mode
  // Message, Tool, and Thinking events are handled by:
  // - StoreBridge.handleEvent() -> MessageStore
  // - MessageRenderer._onStoreChange() -> DOM reconciliation
  // =========================================================================


  // =========================================================================
  // Event Handlers - Permission & Question
  // =========================================================================

  /** @type {string | null} */
  _pendingPermissionId: null,

  /** @type {string | null} */
  _pendingQuestionId: null,

  /**
   * Permission isteği
   */
  _handlePermissionRequest(data) {
    const { permissionId, toolName, description, risk } = data.data || {};
    this._pendingPermissionId = permissionId;

    const modal = document.getElementById('permission-modal');
    const body = document.getElementById('permission-body');
    
    if (body) {
      const riskClass = risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'info';
      body.innerHTML = `
        <div class="permission-card" style="margin: 0; border: none;">
          <p><strong>${toolName}</strong></p>
          <p class="permission-description">${description}</p>
          <p><span class="status-badge ${riskClass}">Risk: ${risk}</span></p>
        </div>
      `;
    }

    modal?.classList.remove('hidden');
    this._updateStatus('waiting', 'Onay bekleniyor...');
  },

  /**
   * Permission yanıtı
   */
  async _handlePermissionResponse(approved) {
    const modal = document.getElementById('permission-modal');
    modal?.classList.add('hidden');

    if (this._pendingPermissionId) {
      try {
        await APIClient.respondToPermission(this._pendingPermissionId, approved);
      } catch (err) {
        console.error('[OpenCode] Permission response error:', err);
      }
      this._pendingPermissionId = null;
    }

    this._updateStatus('processing', 'İşleniyor...');
  },

  /**
   * Soru geldi
   */
  _handleQuestion(data) {
    const { questionId, question, options, allowFreeform } = data.data || {};
    this._pendingQuestionId = questionId;

    const modal = document.getElementById('question-modal');
    const body = document.getElementById('question-body');

    if (body) {
      let html = `<p class="question-text">${question}</p>`;
      
      if (options && options.length > 0) {
        html += '<div class="question-options">';
        options.forEach((opt, i) => {
          html += `
            <button class="question-option" data-value="${opt.value}" onclick="OpenCodeApp._selectOption(this)">
              ${opt.label}
            </button>
          `;
        });
        html += '</div>';
      }

      if (allowFreeform) {
        html += '<input type="text" class="question-input" placeholder="Veya kendi cevabınızı yazın...">';
      }

      body.innerHTML = html;
    }

    modal?.classList.remove('hidden');
    this._updateStatus('waiting', 'Cevap bekleniyor...');
  },

  /**
   * Option seçimi
   */
  _selectOption(button) {
    // Tüm seçimleri kaldır
    document.querySelectorAll('.question-option').forEach(btn => {
      btn.classList.remove('selected');
    });
    // Seçili yap
    button.classList.add('selected');
  },

  /**
   * Soru yanıtı
   */
  async _handleQuestionResponse() {
    const modal = document.getElementById('question-modal');
    const body = document.getElementById('question-body');
    
    let answer = '';
    
    // Seçili option
    const selectedOption = body?.querySelector('.question-option.selected');
    if (selectedOption) {
      answer = selectedOption.getAttribute('data-value') || '';
    }
    
    // Veya input değeri
    const input = body?.querySelector('.question-input');
    if (input && input.value.trim()) {
      answer = input.value.trim();
    }

    modal?.classList.add('hidden');

    if (this._pendingQuestionId && answer) {
      try {
        await APIClient.respondToQuestion(this._pendingQuestionId, answer);
      } catch (err) {
        console.error('[OpenCode] Question response error:', err);
      }
      this._pendingQuestionId = null;
    }

    this._updateStatus('processing', 'İşleniyor...');
  },

  // =========================================================================
  // Event Handlers - Status
  // =========================================================================

  /**
   * Status değişikliği
   * Tüm status event'lerini tek bir handler'da yönetir
   */
  _handleStatusChange(data) {
    const { status } = data.data || {};
    console.log('[OpenCode] Status change:', status);
    
    switch (status) {
      case 'idle':
        this._updateStatus('connected', 'Hazır');
        PromptHandler.setProcessing(false);
        break;
      case 'processing':
        this._updateStatus('processing', 'İşleniyor...');
        PromptHandler.setProcessing(true);
        break;
      case 'waiting_permission':
        this._updateStatus('waiting', 'Onay bekleniyor...');
        break;
      case 'waiting_answer':
        this._updateStatus('waiting', 'Yanıt bekleniyor...');
        break;
      case 'connected':
        this._updateStatus('connected', 'Bağlı');
        PromptHandler.setProcessing(false);
        break;
      case 'opencode_connected':
        this._updateStatus('connected', 'Hazır');
        PromptHandler.focus();
        break;
      case 'opencode_disconnected':
        this._updateStatus('warning', 'OpenCode bağlantısı kesildi');
        break;
      case 'cancelled':
        this._updateStatus('connected', 'İptal edildi');
        PromptHandler.setProcessing(false);
        break;
      default:
        console.log('[OpenCode] Unknown status:', status);
    }
  },

  /**
   * Hata event'i
   */
  _handleError(data) {
    const { message, code } = data.data || {};
    console.error('[OpenCode] Error:', message, code);
    
    this._updateStatus('error', 'Hata');
    PromptHandler.setProcessing(false);
    
    // Hata mesajı göster
    MessageRenderer.addMessage({
      id: `msg-error-${Date.now()}`,
      role: 'assistant',
      content: `❌ Hata: ${message || 'Bilinmeyen hata'}`,
      timestamp: Date.now(),
      isError: true,
    });
  },

  // =========================================================================
  // Actions
  // =========================================================================

  /** @type {string} Son gönderilen user mesajı (echo filtreleme) */
  _lastSentMessage: '',

  /** @type {string | null} Pending user message temp ID */
  _pendingUserMessageId: null,

  /** @type {Map<string, string>} Message ID -> Content mapping for retries */
  _retryContentCache: new Map(),

  /**
   * Mesaj gönder (Reactive Mode - Store-based with Optimistic Updates)
   * CodeNomad pattern: messageId client-side üretilir ve API'ye gönderilir
   */
  async _handleSendMessage(message) {
    console.log('[OpenCode] Sending message:', message);

    // Echo filtreleme için kaydet
    this._lastSentMessage = message.trim();
    StoreBridge.setLastUserMessage(message);

    // Client-side messageId üret (CodeNomad pattern)
    const messageId = MessageStore.createId('msg');
    
    // Optimistic user message - Store'a ekle (UI otomatik güncellenecek)
    // tempId yerine gerçek messageId kullan
    const tempId = StoreBridge.addOptimisticUserMessage(message, messageId);
    this._pendingUserMessageId = tempId;
    
    // Cache content for potential retry
    this._retryContentCache.set(tempId, message);

    this._updateStatus('processing', 'İşleniyor...');
    PromptHandler.setProcessing(true);

    try {
      // messageId'yi API'ye gönder (CodeNomad pattern)
      await APIClient.sendMessage(message, messageId);
      // Mark as sent in store (sending → complete)
      StoreBridge.markUserMessageSent(tempId);
      // Clear retry cache on success
      this._retryContentCache.delete(tempId);
    } catch (err) {
      console.error('[OpenCode] Send message error:', err);
      this._updateStatus('error', 'Gönderim hatası');
      PromptHandler.setProcessing(false);
      
      // Mark message as failed with error info (sending → error)
      StoreBridge.markUserMessageFailed(tempId, {
        code: err.code || 'SEND_FAILED',
        message: err.message || 'Mesaj gönderilemedi',
        retryable: true,
      });
      
      // Keep content in cache for retry
    } finally {
      this._pendingUserMessageId = null;
    }
  },

  /**
   * Retry a failed message
   * Called from MessageRenderer when retry button is clicked
   * @param {string} messageId
   * @param {string} [content] - Optional content override
   */
  async _retryMessage(messageId, content) {
    // Get content from cache or parameter
    const messageContent = content || this._retryContentCache.get(messageId);
    
    if (!messageContent) {
      console.error('[OpenCode] No content found for retry:', messageId);
      return;
    }

    console.log('[OpenCode] Retrying message:', messageId);

    // Reset message state in store (handled by StoreBridge.retryMessage)
    this._updateStatus('processing', 'Yeniden deneniyor...');
    PromptHandler.setProcessing(true);

    try {
      await APIClient.sendMessage(messageContent);
      // Mark as sent
      StoreBridge.markUserMessageSent(messageId);
      // Clear from retry cache
      this._retryContentCache.delete(messageId);
    } catch (err) {
      console.error('[OpenCode] Retry failed:', err);
      this._updateStatus('error', 'Yeniden gönderim başarısız');
      PromptHandler.setProcessing(false);
      
      // Mark as failed again
      StoreBridge.markUserMessageFailed(messageId, {
        code: err.code || 'RETRY_FAILED',
        message: err.message || 'Yeniden gönderim başarısız',
        retryable: true,
      });
    }
  },

  /**
   * Yeni session
   */
  async _handleNewSession() {
    console.log('[OpenCode] Creating new session...');
    
    // Clear stores
    const currentSessionId = SessionStore.getCurrentSessionId();
    if (currentSessionId) {
      MessageStore.clearSession(currentSessionId);
    }
    StoreBridge.clear();
    SessionStore.clear();
    
    // Clear UI
    MessageRenderer.clear();
    ToolRenderer.clear();
    
    // Reset state
    this._currentSession = null;
    this._lastSentMessage = '';
    
    // Update session badge
    this._updateSessionBadge();
    
    // Show welcome message
    const welcome = document.getElementById('welcome-message');
    if (welcome) {
      welcome.classList.remove('hidden');
    }
    
    // Status güncelle
    this._updateStatus('connected', 'Yeni oturum');
    
    PromptHandler.focus();
    
    console.log('[OpenCode] New session ready');
  },

  // =========================================================================
  // UI Helpers
  // =========================================================================

  /**
   * Status badge güncelle
   * @param {string} status - Status classı
   * @param {string} text - Status metni
   */
  _updateStatus(status, text) {
    const badge = document.getElementById('status-badge');
    if (badge) {
      badge.className = `status-badge ${status}`;
      badge.textContent = text;
    }
  },

  // =========================================================================
  // Session UI
  // =========================================================================

  /**
   * SessionStore değişikliklerini dinle
   */
  _subscribeToSessionStore() {
    if (typeof SessionStore === 'undefined') return;
    
    SessionStore.subscribe((event) => {
      this._updateSessionBadge();
    });
    
    // İlk yüklemede de güncelle
    this._updateSessionBadge();
  },

  /**
   * Session badge'i güncelle
   */
  _updateSessionBadge() {
    const sessionBadge = document.getElementById('session-badge');
    const sessionIdText = document.getElementById('session-id-text');
    
    if (!sessionBadge || !sessionIdText) return;
    
    const sessionId = typeof SessionStore !== 'undefined' 
      ? SessionStore.getCurrentSessionId() 
      : null;
    
    if (sessionId) {
      // Session ID'nin kısa halini göster (ilk 12 karakter)
      const shortId = sessionId.replace('ses_', '').substring(0, 8);
      sessionIdText.textContent = shortId;
      sessionBadge.classList.add('active');
      sessionBadge.title = `Session: ${sessionId}`;
    } else {
      sessionIdText.textContent = '-';
      sessionBadge.classList.remove('active');
      sessionBadge.title = 'Session ID';
    }
  }
};

// Global'e ekle
window.OpenCodeApp = OpenCodeApp;

// DOM hazır olunca başlat
document.addEventListener('DOMContentLoaded', () => {
  OpenCodeApp.init();
});
