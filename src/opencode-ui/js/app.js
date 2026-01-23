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
  _serverUrl: null, // Set from OpenCodeConfig

  /**
   * Get server URL from config
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
    
    // Workspace kontrolü - yoksa entrance sayfasına yönlendir
    if (!this._checkWorkspace()) {
      return;
    }

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
    
    // Workspace parametresini al
    const workspace = params.get('workspace');
    if (workspace) {
      this._workspace = workspace;
      sessionStorage.setItem('opencode-workspace', workspace);
    } else {
      // Session storage'dan kontrol et
      this._workspace = sessionStorage.getItem('opencode-workspace');
    }
  },

  /**
   * Workspace kontrolü - yoksa entrance sayfasına yönlendir
   * @returns {boolean} true if workspace exists
   */
  _checkWorkspace() {
    // Workspace varsa devam et
    if (this._workspace) {
      console.log('[OpenCode] Workspace:', this._workspace);
      return true;
    }
    
    // Entrance sayfasındaysak yönlendirme yapma
    if (window.location.pathname.includes('entrance.html')) {
      return false;
    }
    
    // Workspace yoksa entrance sayfasına yönlendir
    console.log('[OpenCode] No workspace, redirecting to entrance...');
    window.location.href = 'entrance.html';
    return false;
  },

  /**
   * UI bileşenlerini başlat
   */
  _initComponents() {
    // Instance Tabs - Multi-workspace support
    this._initInstanceTabs();
    
    // Message Renderer - Reactive mode aktif
    const messagesList = document.getElementById('messages-list');
    if (messagesList) {
      MessageRenderer.init(messagesList, { reactive: true });
      
      // Smart Scroll - IntersectionObserver based auto-scroll
      const messagesContainer = messagesList.closest('.messages-container');
      if (messagesContainer) {
        MessageRenderer.initSmartScroll(messagesContainer);
        console.log('[OpenCode] Smart scroll initialized');
      }
      
      console.log('[OpenCode] MessageRenderer initialized with reactive mode');
    }
    
    // Sidebar toggle butonlarını ayarla
    this._initSidebars();
    
    // Command palette
    this._initCommandPalette();
    
    // Collapsible sections
    this._initCollapsibleSections();

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
    APIClient.setServerUrl(this._getServerUrl());
    
    // Agent/Model Selector - Use existing buttons in left sidebar
    if (typeof AgentModelSelector !== 'undefined') {
      const modelSelectorBtn = document.getElementById('model-selector');
      const agentSelectorBtn = document.getElementById('agent-selector');
      
      // Initialize AgentModelSelector (fetch agents/providers)
      AgentModelSelector.initialize().then(() => {
        console.log('[OpenCode] AgentModelSelector initialized');
        // Update button displays
        this._updateModelSelectorButton();
        this._updateAgentSelectorButton();
      }).catch(err => {
        console.warn('[OpenCode] AgentModelSelector init error:', err);
      });
      
      // Model selector click handler
      if (modelSelectorBtn) {
        modelSelectorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openModelDropdown(modelSelectorBtn);
        });
      }
      
      // Agent selector click handler
      if (agentSelectorBtn) {
        agentSelectorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openAgentDropdown(agentSelectorBtn);
        });
      }
      
      // Subscribe to changes
      AgentModelSelector.subscribe((event) => {
        if (event.type === 'model:changed' || event.type === 'selection:changed') {
          this._updateModelSelectorButton();
        }
        if (event.type === 'agent:changed' || event.type === 'selection:changed') {
          this._updateAgentSelectorButton();
        }
      });
    }
  },
  
  /**
   * Update agent selector button display
   */
  _updateAgentSelectorButton() {
    const agentNameEl = document.querySelector('#agent-selector .agent-name');
    if (!agentNameEl) return;
    
    const agent = AgentModelSelector?.getCurrentAgent?.();
    if (agent?.name) {
      agentNameEl.textContent = `Agent: ${agent.name}`;
    }
  },
  
  /**
   * Open agent dropdown near the button
   */
  _openAgentDropdown(triggerBtn) {
    if (!AgentModelSelector) return;
    
    // Close existing dropdown
    const existingDropdown = document.querySelector('.agent-dropdown-popup');
    if (existingDropdown) {
      existingDropdown.remove();
      return;
    }
    
    // Also close model dropdown if open
    const modelDropdown = document.querySelector('.model-dropdown-popup');
    if (modelDropdown) modelDropdown.remove();
    
    // Get agents
    const agents = AgentModelSelector.getAvailableAgents();
    const currentAgent = AgentModelSelector._currentAgent;
    
    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'agent-dropdown-popup';
    
    let html = `<div class="agent-dropdown-list">`;
    
    if (agents.length === 0) {
      html += `<div class="agent-dropdown-empty">No agents available</div>`;
    } else {
      agents.forEach((agent, index) => {
        const isSelected = agent.name === currentAgent;
        const badge = agent.mode === 'subagent' ? '<span class="agent-item-badge">subagent</span>' : '';
        html += `
          <div class="agent-dropdown-item ${isSelected ? 'selected' : ''}" 
               data-agent="${agent.name}"
               data-index="${index}">
            <div class="agent-item-name">${agent.name}${badge}</div>
            ${agent.description ? `<div class="agent-item-desc">${agent.description}</div>` : ''}
          </div>
        `;
      });
    }
    
    html += `</div>`;
    dropdown.innerHTML = html;
    
    // Position dropdown above the button
    const rect = triggerBtn.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${Math.max(rect.width, 220)}px`;
    
    document.body.appendChild(dropdown);
    
    // Item click
    dropdown.querySelectorAll('.agent-dropdown-item').forEach(item => {
      item.addEventListener('click', async () => {
        const agentName = item.dataset.agent;
        if (agentName) {
          await AgentModelSelector.selectAgent(agentName);
        }
        dropdown.remove();
      });
    });
    
    // Close on outside click
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    
    // Close on escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        dropdown.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },
  
  /**
   * Update model selector button display
   */
  _updateModelSelectorButton() {
    const modelNameEl = document.querySelector('#model-selector .model-name');
    const modelIdEl = document.querySelector('#model-selector .model-id');
    
    if (!modelNameEl) return;
    
    const modelInfo = AgentModelSelector?.getCurrentModel?.();
    if (modelInfo?.model) {
      modelNameEl.textContent = `Model: ${modelInfo.model.name || modelInfo.model.id}`;
      if (modelIdEl) {
        modelIdEl.textContent = `${modelInfo.model.providerId}/${modelInfo.model.id}`;
      }
    }
  },
  
  /**
   * Open model dropdown near the button
   */
  _openModelDropdown(triggerBtn) {
    if (!AgentModelSelector) return;
    
    // Close existing dropdown
    const existingDropdown = document.querySelector('.model-dropdown-popup');
    if (existingDropdown) {
      existingDropdown.remove();
      return;
    }
    
    // Get models
    const models = AgentModelSelector.getFlatModels();
    const currentModel = AgentModelSelector._currentModel;
    const currentKey = currentModel ? `${currentModel.providerId}/${currentModel.modelId}` : null;
    
    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'model-dropdown-popup';
    
    // Search + list
    let html = `
      <div class="model-dropdown-search">
        <input type="text" placeholder="Search models..." class="model-search-input">
      </div>
      <div class="model-dropdown-list">
    `;
    
    if (models.length === 0) {
      html += `<div class="model-dropdown-empty">No models available</div>`;
    } else {
      models.forEach((model, index) => {
        const isSelected = model.key === currentKey;
        html += `
          <div class="model-dropdown-item ${isSelected ? 'selected' : ''}" 
               data-provider="${model.providerId}" 
               data-model="${model.id}"
               data-index="${index}">
            <div class="model-item-name">${model.name}</div>
            <div class="model-item-id">${model.providerName} • ${model.providerId}/${model.id}</div>
          </div>
        `;
      });
    }
    
    html += `</div>`;
    dropdown.innerHTML = html;
    
    // Position dropdown above the button
    const rect = triggerBtn.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${Math.max(rect.width, 280)}px`;
    
    document.body.appendChild(dropdown);
    
    // Focus search
    const searchInput = dropdown.querySelector('.model-search-input');
    searchInput?.focus();
    
    // Search filter
    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      dropdown.querySelectorAll('.model-dropdown-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? '' : 'none';
      });
    });
    
    // Item click
    dropdown.querySelectorAll('.model-dropdown-item').forEach(item => {
      item.addEventListener('click', async () => {
        const providerId = item.dataset.provider;
        const modelId = item.dataset.model;
        if (providerId && modelId) {
          await AgentModelSelector.selectModel(providerId, modelId);
        }
        dropdown.remove();
      });
    });
    
    // Close on outside click
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    
    // Close on escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        dropdown.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },

  /**
   * Event listener'ları kur
   */
  _setupEventListeners() {
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

    // Stop button - İşlemi iptal et
    const stopBtn = document.getElementById('btn-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', async () => {
        console.log('[OpenCode] Stop clicked');
        try {
          await APIClient.cancel();
          this._updateStatus('connected', 'İptal edildi');
          PromptHandler.setProcessing(false);
        } catch (err) {
          console.error('[OpenCode] Cancel failed:', err);
        }
      });
    }

    // Play button - Devam et (retry last)
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', async () => {
        console.log('[OpenCode] Play/Continue clicked');
        try {
          await APIClient.retry();
        } catch (err) {
          console.error('[OpenCode] Retry failed:', err);
        }
      });
    }

    // Attach button - Dosya ekle
    const attachBtn = document.getElementById('btn-attach');
    if (attachBtn) {
      attachBtn.addEventListener('click', () => {
        this._handleAttachFile();
      });
    }

    // Expand button - Prompt alanını genişlet
    const expandBtn = document.getElementById('btn-expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        this._togglePromptExpand();
      });
    }

    // New Session button
    const newSessionBtn = document.getElementById('btn-new-session');
    if (newSessionBtn) {
      newSessionBtn.addEventListener('click', () => this._handleNewSession());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+N - Yeni oturum
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this._handleNewSession();
      }
      // Escape - İşlemi iptal et
      if (e.key === 'Escape' && this._isProcessing) {
        APIClient.cancel().catch(console.error);
      }
    });
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
    const connected = await SSEClient.connect(this._getServerUrl());
    
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
        // Otomatik instance oluştur (eğer yoksa)
        this._ensureInstanceExists();
        break;
      case 'disconnected':
        this._updateStatus('disconnected', 'Bağlantı kesildi');
        // Instance status güncelle
        this._updateActiveInstanceStatus('disconnected');
        break;
      case 'reconnecting':
        this._updateStatus('connecting', `Yeniden bağlanıyor (${data.attempt}/${data.maxAttempts})...`);
        this._updateActiveInstanceStatus('connecting');
        break;
      case 'failed':
        this._updateStatus('error', 'Bağlantı başarısız');
        this._updateActiveInstanceStatus('error');
        break;
      case 'error':
        this._updateStatus('error', 'Hata');
        this._updateActiveInstanceStatus('error');
        break;
    }
  },

  /**
   * Mevcut workspace için instance yoksa oluştur
   */
  _ensureInstanceExists() {
    if (typeof InstanceStore === 'undefined') return;

    // Zaten instance varsa sadece status güncelle
    const existingInstances = InstanceStore.getInstancesArray();
    const currentWorkspace = this._workspace;
    
    // Bu workspace için instance var mı kontrol et
    const existingInstance = existingInstances.find(inst => inst.folder === currentWorkspace);
    
    if (existingInstance) {
      // Var olan instance'ı connected yap
      InstanceStore.setInstanceStatus(existingInstance.id, 'connected');
      InstanceStore.setActiveInstance(existingInstance.id);
      console.log('[OpenCode] Existing instance activated:', existingInstance.id);
      return;
    }

    // Yeni instance oluştur
    const instance = InstanceStore.createInstance({
      folder: currentWorkspace,
      name: currentWorkspace ? currentWorkspace.split('/').pop() : 'Workspace',
      url: this._serverUrl,
    });

    // Connected olarak işaretle
    InstanceStore.setInstanceStatus(instance.id, 'connected');
    
    console.log('[OpenCode] New instance created:', instance.id, instance.name);
  },

  /**
   * Aktif instance'ın status'unu güncelle
   */
  _updateActiveInstanceStatus(status) {
    if (typeof InstanceStore === 'undefined') return;
    
    const activeId = InstanceStore.getActiveInstanceId();
    if (activeId) {
      InstanceStore.setInstanceStatus(activeId, status);
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
  // Instance Management (Multi-workspace support)
  // =========================================================================

  /**
   * Initialize instance tabs UI
   */
  _initInstanceTabs() {
    const container = document.getElementById('instance-tabs-container');
    if (!container || typeof InstanceTabs === 'undefined') {
      console.log('[OpenCode] Instance tabs not available');
      return;
    }

    InstanceTabs.init(container, {
      onSelect: (instanceId) => this._onInstanceSelect(instanceId),
      onClose: (instanceId) => this._onInstanceClose(instanceId),
      onNew: () => this._onInstanceNew(),
    });

    // Subscribe to InstanceStore for sync
    if (typeof InstanceStore !== 'undefined') {
      InstanceStore.subscribe((event) => {
        if (event.type === 'instance:activated') {
          this._onInstanceActivated(event.instanceId, event.previousInstanceId);
        }
      });
    }

    console.log('[OpenCode] Instance tabs initialized');
  },

  /**
   * Create a new instance
   * @param {Object} options
   * @param {string} options.folder - Workspace folder path
   * @param {string} [options.name] - Display name
   * @param {string} [options.serverUrl] - Server URL
   * @returns {Promise<string | null>} Instance ID or null on failure
   */
  async createInstance(options) {
    if (typeof InstanceStore === 'undefined') {
      console.error('[OpenCode] InstanceStore not available');
      return null;
    }

    try {
      // Create instance in store
      const instance = InstanceStore.createInstance({
        folder: options.folder,
        name: options.name,
        url: options.serverUrl,
      });

      console.log('[OpenCode] Created instance:', instance.id);

      // Connect SSE for this instance
      if (options.serverUrl && typeof SSEClient !== 'undefined') {
        const connected = await SSEClient.connectInstance(instance.id, options.serverUrl);
        if (connected) {
          InstanceStore.setInstanceStatus(instance.id, 'connected');
        }
      }

      return instance.id;
    } catch (err) {
      console.error('[OpenCode] Failed to create instance:', err);
      return null;
    }
  },

  /**
   * Close an instance
   * @param {string} instanceId
   */
  async closeInstance(instanceId) {
    if (typeof InstanceStore === 'undefined') return;

    console.log('[OpenCode] Closing instance:', instanceId);

    // Disconnect SSE
    if (typeof SSEClient !== 'undefined') {
      SSEClient.disconnectInstance(instanceId);
    }

    // Clear session data
    if (typeof SessionStore !== 'undefined') {
      SessionStore.clearInstance(instanceId);
    }

    // Remove from store
    InstanceStore.removeInstance(instanceId);
  },

  /**
   * Switch to an instance
   * @param {string} instanceId
   */
  switchInstance(instanceId) {
    if (typeof InstanceStore === 'undefined') return;
    InstanceStore.setActiveInstance(instanceId);
  },

  /**
   * Handle instance selection from tabs
   * @param {string} instanceId
   */
  _onInstanceSelect(instanceId) {
    console.log('[OpenCode] Instance selected:', instanceId);
    this.switchInstance(instanceId);
  },

  /**
   * Handle instance close from tabs
   * @param {string} instanceId
   */
  _onInstanceClose(instanceId) {
    // Confirm if this is the last instance
    if (typeof InstanceStore !== 'undefined' && InstanceStore.getInstanceCount() <= 1) {
      // Don't allow closing the last instance, or show confirmation
      console.log('[OpenCode] Cannot close last instance');
      return;
    }
    this.closeInstance(instanceId);
  },

  /**
   * Handle new instance request from tabs
   */
  _onInstanceNew() {
    console.log('[OpenCode] New instance requested');
    // This would typically open a dialog to select a folder
    // For now, emit an event that can be handled elsewhere
    this._showToast('Yeni workspace seçmek için dialog açılacak', 'info');
    
    // Emit custom event for external handling
    window.dispatchEvent(new CustomEvent('opencode:new-instance-requested'));
  },

  /**
   * Handle instance activation
   * @param {string} instanceId
   * @param {string | null} previousInstanceId
   */
  _onInstanceActivated(instanceId, previousInstanceId) {
    console.log('[OpenCode] Instance activated:', instanceId, 'previous:', previousInstanceId);

    // Sync SessionStore to the new active instance
    if (typeof SessionStore !== 'undefined') {
      SessionStore.syncFromActiveInstance();
    }

    // Update UI to reflect the new instance's state
    this._updateInstanceUI(instanceId);

    // Refresh session list for the new instance
    this._refreshSessionList();
  },

  /**
   * Update UI for active instance
   * @param {string} instanceId
   */
  _updateInstanceUI(instanceId) {
    if (typeof InstanceStore === 'undefined') return;

    const instance = InstanceStore.getInstance(instanceId);
    if (!instance) return;

    // Update connection status display
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      const statusDot = statusEl.querySelector('.status-dot');
      const statusText = statusEl.querySelector('.status-text');
      
      if (statusDot) {
        statusDot.className = 'status-dot ' + (instance.status || 'disconnected');
      }
      if (statusText) {
        const statusTexts = {
          'connected': 'Bağlı',
          'connecting': 'Bağlanıyor...',
          'disconnected': 'Bağlı Değil',
          'error': 'Hata',
        };
        statusText.textContent = statusTexts[instance.status] || instance.status;
      }
    }

    // Update token usage for this instance
    if (typeof SessionStore !== 'undefined') {
      const usage = SessionStore.getInstanceUsage(instanceId);
      this._updateTokenDisplay(usage.tokens);
    }
  },

  // =========================================================================
  // UI Components - Sidebars & Panels
  // =========================================================================

  /**
   * Sidebar toggle butonlarını ayarla
   */
  _initSidebars() {
    // Sol sidebar toggle (hamburger menü)
    const menuBtn = document.getElementById('btn-menu');
    const leftSidebar = document.getElementById('sidebar-left');
    if (menuBtn && leftSidebar) {
      menuBtn.addEventListener('click', () => {
        leftSidebar.classList.toggle('collapsed');
        leftSidebar.classList.toggle('open');
      });
    }
    
    // Sağ sidebar toggle
    const rightToggleBtn = document.getElementById('btn-toggle-right-sidebar');
    const rightSidebar = document.getElementById('sidebar-right');
    if (rightToggleBtn && rightSidebar) {
      rightToggleBtn.addEventListener('click', () => {
        rightSidebar.classList.toggle('collapsed');
        rightSidebar.classList.toggle('open');
      });
    }
    
    // Action bar butonları - Panel değiştirme
    const panelBtns = [
      { id: 'btn-panel-status', panel: 'status' },
      { id: 'btn-panel-actions', panel: 'actions' },
      { id: 'btn-panel-trash', panel: 'trash' }
    ];
    
    panelBtns.forEach(({ id, panel }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          // Aktif butonu değiştir
          document.querySelectorAll('.action-bar .action-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          // Panel içeriğini değiştir
          this._switchRightPanel(panel);
        });
      }
    });
  },

  /**
   * Sağ sidebar panel içeriğini değiştir
   * @param {'status' | 'actions' | 'trash'} panelType
   */
  _switchRightPanel(panelType) {
    const content = document.querySelector('.sidebar-right .sidebar-content');
    if (!content) return;

    switch (panelType) {
      case 'status':
        // Mevcut status panel - değiştirme
        this._updateStatusPanel();
        break;
        
      case 'actions':
        content.innerHTML = `
          <div class="panel-header">
            <h3 class="panel-title">HIZLI İŞLEMLER</h3>
          </div>
          <div class="quick-actions-panel">
            <button class="quick-action-btn" onclick="OpenCodeApp._executeQuickAction('analyze')">
              <span class="icon">📊</span>
              <span>Projeyi Analiz Et</span>
            </button>
            <button class="quick-action-btn" onclick="OpenCodeApp._executeQuickAction('lint')">
              <span class="icon">🔍</span>
              <span>Lint Kontrolü</span>
            </button>
            <button class="quick-action-btn" onclick="OpenCodeApp._executeQuickAction('test')">
              <span class="icon">🧪</span>
              <span>Testleri Çalıştır</span>
            </button>
            <button class="quick-action-btn" onclick="OpenCodeApp._executeQuickAction('git-status')">
              <span class="icon">📝</span>
              <span>Git Status</span>
            </button>
            <button class="quick-action-btn" onclick="OpenCodeApp._executeQuickAction('compact')">
              <span class="icon">📦</span>
              <span>Context Sıkıştır</span>
            </button>
          </div>
        `;
        break;
        
      case 'trash':
        content.innerHTML = `
          <div class="panel-header">
            <h3 class="panel-title">ÇÖP KUTUSU</h3>
          </div>
          <div class="trash-panel">
            <p class="placeholder-text">Silinen mesajlar burada görünecek.</p>
            <button class="btn btn-sm" onclick="OpenCodeApp._clearTrash()" disabled>
              Çöp Kutusunu Boşalt
            </button>
          </div>
        `;
        break;
    }
  },

  /**
   * Hızlı işlem çalıştır
   * @param {string} action
   */
  async _executeQuickAction(action) {
    const prompts = {
      'analyze': 'Bu projeyi analiz et ve özet çıkar',
      'lint': 'Projede lint kontrolü yap ve hataları listele',
      'test': 'Projenin testlerini çalıştır',
      'git-status': 'Git status göster ve değişiklikleri özetle',
      'compact': '/compact'
    };
    
    const prompt = prompts[action];
    if (prompt) {
      if (prompt.startsWith('/')) {
        // Command
        PromptHandler._executeCommand(prompt.slice(1));
      } else {
        // Normal message
        PromptHandler.setValue(prompt);
        this._handleSendMessage(prompt);
      }
    }
  },

  /**
   * Çöp kutusunu boşalt
   */
  _clearTrash() {
    console.log('[OpenCode] Clear trash - not implemented yet');
  },

  /**
   * Command palette'i başlat
   */
  _initCommandPalette() {
    const paletteBtn = document.getElementById('btn-command-palette');
    const paletteModal = document.getElementById('command-palette-modal');
    
    if (paletteBtn && paletteModal) {
      // Açma
      paletteBtn.addEventListener('click', () => {
        paletteModal.classList.remove('hidden');
        const input = paletteModal.querySelector('.palette-input');
        if (input) input.focus();
      });
      
      // Kapatma (overlay click veya Escape)
      paletteModal.addEventListener('click', (e) => {
        if (e.target === paletteModal) {
          paletteModal.classList.add('hidden');
        }
      });
      
      document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+P ile aç/kapat
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
          e.preventDefault();
          paletteModal.classList.toggle('hidden');
          if (!paletteModal.classList.contains('hidden')) {
            const input = paletteModal.querySelector('.palette-input');
            if (input) input.focus();
          }
        }
        // Escape ile kapat
        if (e.key === 'Escape' && !paletteModal.classList.contains('hidden')) {
          paletteModal.classList.add('hidden');
        }
      });
    }
  },

  /**
   * Collapsible section'ları başlat
   */
  _initCollapsibleSections() {
    document.querySelectorAll('.panel-section .section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.panel-section');
        if (section) {
          section.classList.toggle('collapsed');
        }
      });
    });
  },

  /**
   * Connection status'u güncelle
   * @param {string} status - connected, processing, error, warning
   * @param {string} text - Gösterilecek metin
   */
  _updateConnectionStatus(status, text) {
    const statusEl = document.getElementById('connection-status');
    if (!statusEl) return;
    
    // Remove all status classes
    statusEl.classList.remove('connected', 'processing', 'error', 'warning');
    
    // Add current status class
    if (status) {
      statusEl.classList.add(status);
    }
    
    // Update text
    const textEl = statusEl.querySelector('.status-text');
    if (textEl) {
      textEl.textContent = text || status;
    }
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
   * @param {string} status - Status classı (connected, processing, error, warning, waiting)
   * @param {string} text - Status metni
   */
  _updateStatus(status, text) {
    // Header'daki connection status
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.classList.remove('connected', 'processing', 'error', 'warning', 'waiting', 'connecting');
      statusEl.classList.add(status);
      
      const textEl = statusEl.querySelector('.status-text');
      if (textEl) {
        textEl.textContent = text || status;
      }
    }
    
    // Legacy badge support
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
      
      // Token usage güncellendiğinde stats'u güncelle
      if (event.type === 'usage:updated') {
        this._updateTokenStats();
      }
    });
    
    // İlk yüklemede de güncelle
    this._updateSessionBadge();
    
    // Status panel'i başlat ve periyodik güncelle
    this._updateStatusPanel();
    this._statusPanelInterval = setInterval(() => {
      this._updateStatusPanel();
    }, 30000); // 30 saniyede bir güncelle
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

    // Session list'i de güncelle
    this._renderSessionList();
  },

  // =========================================================================
  // Session List (FAZ 6 - Sidebar)
  // =========================================================================

  /**
   * Session listesini render et
   * API'den session'ları al ve store ile birleştir
   */
  async _renderSessionList() {
    const container = document.getElementById('session-list');
    if (!container) return;

    // API'den session'ları al
    let apiSessions = [];
    if (typeof APIClient !== 'undefined' && APIClient.getSessions) {
      try {
        const result = await APIClient.getSessions();
        apiSessions = result.sessions || [];
      } catch (err) {
        console.warn('[OpenCode] Failed to fetch sessions from API:', err);
      }
    }

    // Store'daki session'larla birleştir
    let sessions = [];
    if (typeof SessionStore !== 'undefined') {
      sessions = SessionStore.getAllSessions();
      
      // API session'larını store'a ekle
      apiSessions.forEach(apiSession => {
        if (!SessionStore.getSession(apiSession.id)) {
          SessionStore.upsertSession(apiSession.id, {
            title: apiSession.title,
            messageIds: [],
            status: apiSession.status || 'idle',
          });
        }
      });
      
      // Güncel listeyi al
      sessions = SessionStore.getAllSessions();
    } else {
      sessions = apiSessions;
    }

    const currentId = typeof SessionStore !== 'undefined' 
      ? SessionStore.getCurrentSessionId() 
      : null;

    // Henüz session yoksa placeholder göster
    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="session-empty">
          <span class="empty-icon">💬</span>
          <span class="empty-text">Henüz oturum yok</span>
        </div>
      `;
      return;
    }

    // Session'ları tarihe göre sırala (en yeni en üstte)
    const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

    container.innerHTML = sortedSessions.map(session => {
      const isActive = session.id === currentId;
      const title = session.title || `Oturum ${session.id.substring(0, 8)}`;
      const time = this._formatSessionTime(session.updatedAt);
      const status = session.status || 'idle';
      const messageCount = session.messageIds?.length || 0;

      return `
        <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
          <div class="session-info" onclick="OpenCodeApp._switchSession('${session.id}')">
            <span class="session-title" title="${this._escapeHtml(title)}">${this._escapeHtml(title)}</span>
            <span class="session-meta">
              <span class="session-time">${time}</span>
              <span class="session-count">${messageCount} mesaj</span>
            </span>
          </div>
          <div class="session-status">
            <span class="status-badge ${status}">${status.toUpperCase()}</span>
          </div>
          <div class="session-actions">
            <button class="btn-session-action" title="Yeniden Adlandır" onclick="event.stopPropagation(); OpenCodeApp._renameSession('${session.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-session-action" title="Fork" onclick="event.stopPropagation(); OpenCodeApp._forkSession('${session.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="18" r="3"></circle>
                <circle cx="6" cy="6" r="3"></circle>
                <circle cx="18" cy="6" r="3"></circle>
                <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path>
                <path d="M12 12v3"></path>
              </svg>
            </button>
            <button class="btn-session-action danger" title="Sil" onclick="event.stopPropagation(); OpenCodeApp._deleteSession('${session.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Session'a geç
   * @param {string} sessionId
   */
  async _switchSession(sessionId) {
    if (typeof SessionStore === 'undefined') return;

    const currentId = SessionStore.getCurrentSessionId();
    if (sessionId === currentId) return;

    console.log('[OpenCode] Switching to session:', sessionId);

    // Session'u aktif yap
    SessionStore.setCurrentSession(sessionId);

    // Mesaj listesini temizle ve yeniden yükle
    MessageRenderer.clear();

    // API'den mesajları yükle
    if (typeof APIClient !== 'undefined' && APIClient.getSessionMessages) {
      try {
        const result = await APIClient.getSessionMessages(sessionId);
        if (result.messages) {
          result.messages.forEach(msg => {
            MessageStore.upsertMessage({
              id: msg.id,
              sessionId,
              role: msg.role,
              status: 'complete',
              parts: [{ type: 'text', text: msg.content }],
              createdAt: msg.timestamp,
            });
          });
        }
      } catch (err) {
        console.warn('[OpenCode] Failed to load session messages:', err);
      }
    }

    this._updateStatus('connected', 'Hazır');
  },

  /**
   * Session'u yeniden adlandır
   * @param {string} sessionId
   */
  async _renameSession(sessionId) {
    const session = SessionStore.getSession(sessionId);
    if (!session) return;

    const currentTitle = session.title || `Oturum ${sessionId.substring(0, 8)}`;
    const newTitle = prompt('Yeni oturum adı:', currentTitle);

    if (!newTitle || newTitle === currentTitle) return;

    // Store'u güncelle
    SessionStore.upsertSession(sessionId, { title: newTitle });

    // API'ye bildir
    if (typeof APIClient !== 'undefined' && APIClient.renameSession) {
      try {
        await APIClient.renameSession(sessionId, newTitle);
      } catch (err) {
        console.warn('[OpenCode] Failed to rename session on server:', err);
      }
    }

    this._renderSessionList();
  },

  /**
   * Session'u fork et
   * @param {string} sessionId
   */
  async _forkSession(sessionId) {
    const session = SessionStore.getSession(sessionId);
    if (!session) return;

    const messages = MessageStore.getSessionMessages(sessionId);
    const lastMessageId = messages[messages.length - 1]?.id;

    if (lastMessageId && typeof MessageRenderer !== 'undefined') {
      // MessageRenderer'daki fork fonksiyonunu kullan
      await MessageRenderer._handleFork(lastMessageId);
    }
  },

  /**
   * Session'u sil
   * @param {string} sessionId
   */
  async _deleteSession(sessionId) {
    const session = SessionStore.getSession(sessionId);
    if (!session) return;

    const confirmed = confirm(`"${session.title || sessionId}" oturumu silinecek. Emin misiniz?`);
    if (!confirmed) return;

    // API'den sil
    if (typeof APIClient !== 'undefined' && APIClient.deleteSession) {
      try {
        await APIClient.deleteSession(sessionId);
      } catch (err) {
        console.warn('[OpenCode] Failed to delete session on server:', err);
      }
    }

    // Store'dan sil
    SessionStore.removeSession(sessionId);
    MessageStore.clearSession(sessionId);

    // Eğer aktif session silindiyse, yeni session oluştur
    if (SessionStore.getCurrentSessionId() === null) {
      this._handleNewSession();
    }

    this._renderSessionList();
  },

  /**
   * Session zamanını formatla
   * @param {number} timestamp
   * @returns {string}
   */
  _formatSessionTime(timestamp) {
    if (!timestamp) return '';

    const now = Date.now();
    const diff = now - timestamp;

    // 1 dakikadan az
    if (diff < 60 * 1000) return 'Şimdi';
    // 1 saatten az
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} dk önce`;
    // 24 saatten az
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} sa önce`;
    // Tarih göster
    return new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  },

  /**
   * HTML escape
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  },

  // =========================================================================
  // Status Panel (FAZ 8 - Sağ Sidebar)
  // =========================================================================

  /**
   * Status panel'i güncelle
   * MCP servers, background shells, token usage
   */
  _updateStatusPanel() {
    // Token stats
    this._updateTokenStats();

    // MCP servers (API'den alınacak)
    this._updateMCPServers();

    // Background shells
    this._updateBackgroundShells();

    // Plugins
    this._updatePlugins();
  },

  /**
   * Token istatistiklerini güncelle
   */
  _updateTokenStats() {
    const sessionId = typeof SessionStore !== 'undefined' 
      ? SessionStore.getCurrentSessionId() 
      : null;

    let usage = { tokens: 0, cost: 0 };
    
    if (sessionId && typeof SessionStore !== 'undefined') {
      usage = SessionStore.getSessionUsage(sessionId);
    }

    // Input/Output tokens (basitleştirilmiş - tek değer göster)
    const inputEl = document.getElementById('stat-input');
    const outputEl = document.getElementById('stat-output');
    const costEl = document.getElementById('stat-cost');

    if (inputEl) inputEl.textContent = this._formatNumber(Math.floor(usage.tokens * 0.3));
    if (outputEl) outputEl.textContent = this._formatNumber(Math.floor(usage.tokens * 0.7));
    if (costEl) costEl.textContent = usage.cost.toFixed(4);
  },

  /**
   * MCP server'ları güncelle
   */
  async _updateMCPServers() {
    const container = document.getElementById('mcp-server-list') || document.querySelector('.server-list');
    if (!container) return;

    // API'den MCP server listesi al
    let servers = [];
    if (typeof APIClient !== 'undefined' && APIClient.getMCPServers) {
      try {
        const result = await APIClient.getMCPServers();
        servers = result.servers || [];
      } catch {
        // API hatası - boş liste
        servers = [];
      }
    }

    if (servers.length === 0) {
      container.innerHTML = '<div class="empty-state">MCP server bulunamadı</div>';
      return;
    }

    container.innerHTML = servers.map(server => `
      <div class="server-item">
        <span class="server-name">${this._escapeHtml(server.name)}</span>
        ${server.toolCount ? `<span class="server-tools">${server.toolCount} tools</span>` : ''}
        <span class="server-status ${server.status}"></span>
      </div>
    `).join('');
  },

  /**
   * Background shell'leri güncelle
   */
  /**
   * Plugin listesini güncelle
   */
  async _updatePlugins() {
    const container = document.getElementById('plugin-list');
    if (!container) return;

    // API'den plugin listesi al
    let plugins = [];
    if (typeof APIClient !== 'undefined' && APIClient.status) {
      try {
        const result = await APIClient.status();
        plugins = result.plugins || [];
      } catch {
        plugins = [];
      }
    }

    if (plugins.length === 0) {
      container.innerHTML = '<p class="placeholder-text">No plugins installed.</p>';
      return;
    }

    container.innerHTML = plugins.map(plugin => `
      <div class="plugin-item">
        <span class="plugin-name">${this._escapeHtml(typeof plugin === 'string' ? plugin : plugin.name)}</span>
      </div>
    `).join('');
  },

  async _updateBackgroundShells() {
    const container = document.querySelector('.shell-list');
    if (!container) return;

    // API'den shell listesi al
    let shells = [];
    if (typeof APIClient !== 'undefined' && APIClient.getBackgroundShells) {
      try {
        const result = await APIClient.getBackgroundShells();
        shells = result.shells || [];
      } catch {
        shells = [];
      }
    }

    if (shells.length === 0) {
      container.innerHTML = '<div class="empty-state">Aktif shell yok</div>';
      return;
    }

    container.innerHTML = shells.map(shell => `
      <div class="shell-item">
        <span class="shell-pid">${shell.pid}</span>
        <span class="shell-command" title="${this._escapeHtml(shell.command)}">${this._escapeHtml(shell.command.substring(0, 30))}...</span>
        <span class="shell-status ${shell.status}"></span>
      </div>
    `).join('');
  },

  /**
   * Sayıyı formatla (1000 -> 1K)
   * @param {number} num
   * @returns {string}
   */
  _formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  },

  // =========================================================================
  // File Attachment
  // =========================================================================

  /**
   * Dosya ekleme dialog'ı aç
   */
  async _handleAttachFile() {
    // Electron API varsa native dialog kullan
    if (window.electronAPI?.showOpenDialog) {
      try {
        const result = await window.electronAPI.showOpenDialog({
          properties: ['openFile', 'multiSelections'],
          title: 'Dosya Seçin',
          buttonLabel: 'Ekle'
        });
        
        if (result && !result.canceled && result.filePaths?.length > 0) {
          result.filePaths.forEach(filePath => {
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
            PromptHandler._addAttachment({
              name: fileName,
              path: filePath,
              type: 'file'
            });
          });
        }
      } catch (err) {
        console.error('[OpenCode] File dialog error:', err);
      }
    } else {
      // Fallback: @ mention kullan
      PromptHandler.setValue(PromptHandler.getValue() + '@');
      PromptHandler.focus();
    }
  },

  // =========================================================================
  // Token & Stats UI (FAZ 4 - Step Tracking)
  // =========================================================================

  /**
   * Subscribe to SessionStore for token updates
   */
  _subscribeToSessionStore() {
    if (typeof SessionStore === 'undefined') {
      console.warn('[OpenCode] SessionStore not available for subscription');
      return;
    }

    // Subscribe to session events
    SessionStore.subscribe((event) => {
      switch (event.type) {
        case 'session:changed':
        case 'session:usage:updated':
        case 'session:info:updated':
          this._updateTokenDisplay();
          break;
        case 'session:created':
        case 'session:updated':
          this._updateSessionList();
          break;
      }
    });

    // Subscribe to message store for step events (token tracking)
    if (typeof MessageStore !== 'undefined') {
      MessageStore.subscribe((event) => {
        // Step finish event'leri token güncellemesi tetikler
        if (event.type === 'part:updated' || event.type === 'message:updated') {
          // Debounce token display update
          if (this._tokenUpdateTimeout) {
            clearTimeout(this._tokenUpdateTimeout);
          }
          this._tokenUpdateTimeout = setTimeout(() => {
            this._updateTokenDisplay();
          }, 100);
        }
      });
    }

    // Initial update
    this._updateTokenDisplay();
    console.log('[OpenCode] Subscribed to SessionStore');
  },

  /** @type {number | null} */
  _tokenUpdateTimeout: null,

  /**
   * Update token display in UI
   * Uses real data from SessionStore instead of dummy values
   */
  _updateTokenDisplay() {
    const sessionId = SessionStore?.getCurrentSessionId?.();
    
    // Get session-specific info (detailed breakdown)
    const sessionInfo = sessionId ? SessionStore?.getSessionInfo?.(sessionId) : null;
    
    // Get session usage (simple totals)
    const sessionUsage = sessionId ? SessionStore?.getSessionUsage?.(sessionId) : null;
    
    // Get total usage across all sessions
    const totalUsage = SessionStore?.getTotalUsage?.() || { tokens: 0, cost: 0 };

    // Header token display (used/available)
    const tokensUsedEl = document.getElementById('tokens-used');
    const tokensAvailEl = document.getElementById('tokens-avail');
    
    if (tokensUsedEl) {
      const totalTokens = sessionInfo 
        ? (sessionInfo.inputTokens || 0) + (sessionInfo.outputTokens || 0)
        : (sessionUsage?.tokens || 0);
      tokensUsedEl.textContent = this._formatTokenCount(totalTokens);
    }
    
    if (tokensAvailEl) {
      // Context window size (default 200K for most models)
      tokensAvailEl.textContent = '200K';
    }

    // Sidebar stats (input/output breakdown)
    const statInputEl = document.getElementById('stat-input');
    const statOutputEl = document.getElementById('stat-output');
    const statCostEl = document.getElementById('stat-cost');

    if (statInputEl) {
      const inputTokens = sessionInfo?.inputTokens || Math.floor((sessionUsage?.tokens || 0) * 0.3);
      statInputEl.textContent = this._formatTokenCount(inputTokens);
    }

    if (statOutputEl) {
      const outputTokens = sessionInfo?.outputTokens || Math.floor((sessionUsage?.tokens || 0) * 0.7);
      statOutputEl.textContent = this._formatTokenCount(outputTokens);
    }

    if (statCostEl) {
      const cost = sessionInfo?.cost || sessionUsage?.cost || 0;
      statCostEl.textContent = cost.toFixed(4); // HTML'de $ prefix'i var
    }

    // Context usage (session tokens as context usage)
    const contextUsedEl = document.getElementById('stat-context-used');
    if (contextUsedEl) {
      const totalTokens = sessionInfo 
        ? (sessionInfo.inputTokens || 0) + (sessionInfo.outputTokens || 0)
        : (sessionUsage?.tokens || 0);
      contextUsedEl.textContent = this._formatTokenCount(totalTokens);
    }

    // Total usage display (if exists)
    const totalTokensEl = document.getElementById('total-tokens');
    const totalCostEl = document.getElementById('total-cost');

    if (totalTokensEl) {
      totalTokensEl.textContent = this._formatTokenCount(totalUsage.tokens);
    }

    if (totalCostEl) {
      totalCostEl.textContent = `$${totalUsage.cost.toFixed(4)}`;
    }
  },

  /**
   * Format token count for display (1.5K, 12.3K, 1.2M)
   * @param {number} count
   * @returns {string}
   */
  _formatTokenCount(count) {
    if (!count || count === 0) return '0';
    
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  },

  /**
   * Update session list in sidebar
   */
  _updateSessionList() {
    // Session list güncellemesi - mevcut implementasyon kullanılabilir
    console.log('[OpenCode] Session list update triggered');
  },

  // =========================================================================
  // Prompt Expand
  // =========================================================================

  /** @type {boolean} */
  _promptExpanded: false,

  /**
   * Prompt alanını genişlet/daralt
   */
  _togglePromptExpand() {
    this._promptExpanded = !this._promptExpanded;
    
    const promptContainer = document.querySelector('.prompt-container');
    const expandBtn = document.getElementById('btn-expand');
    
    if (promptContainer) {
      promptContainer.classList.toggle('expanded', this._promptExpanded);
    }
    
    if (expandBtn) {
      expandBtn.title = this._promptExpanded ? 'Daralt' : 'Genişlet';
      // Icon değiştir
      if (this._promptExpanded) {
        expandBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        `;
      } else {
        expandBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        `;
      }
    }
    
    // Textarea'yı yeniden boyutlandır
    const input = document.getElementById('prompt-input');
    if (input && this._promptExpanded) {
      input.style.height = '200px';
    } else if (input) {
      input.style.height = 'auto';
    }
  }
};

// Global'e ekle
window.OpenCodeApp = OpenCodeApp;

// DOM hazır olunca başlat
document.addEventListener('DOMContentLoaded', () => {
  OpenCodeApp.init();
});
