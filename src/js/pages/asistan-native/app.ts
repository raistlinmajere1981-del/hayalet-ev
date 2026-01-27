/**
 * OpenCode UI - Main Application
 * 
 * Tüm bileşenleri koordine eden ana uygulama.
 * SSE event'lerini dinler ve UI'yı günceller.
 */

// Type definitions for SSE events and callbacks
interface SSEEventData {
  sessionId?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface _PermissionRequestData {
  id?: string;
  partId?: string;
  messageId?: string;
  permission?: { id: string; type?: string; path?: string; command?: string };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface QuestionData {
  id?: string;
  question?: { type?: string; text?: string; options?: Array<{ label: string; value: string }> };
}

const OpenCodeApp = {
  /** @type {boolean} */
  _initialized: false,

  /** @type {string | null} */
  _serverUrl: null as string | null,

  /** @type {string | null} */
  _workspace: null as string | null,

  /** @type {AbortController | null} */
  _eventAbortController: null as AbortController | null,

  /** @type {boolean} */
  _isProcessing: false,

  /** @type {Map<string, Function>} */
  _permissionHandlers: new Map() as Map<string, (result: boolean) => void>,

  /** @type {Map<string, Function>} */
  _questionHandlers: new Map() as Map<string, (answer: string) => void>,

  /** @type {Map<string, number>} */
  _liveTimers: new Map() as Map<string, number>,

  /** @type {ReturnType<typeof setInterval> | null} */
  _statusPanelInterval: null as ReturnType<typeof setInterval> | null,

  /** @type {Function | null} */
  _unsubscribeSession: null as (() => void) | null,

  /** @type {Function | null} */
  _unsubscribeMessage: null as (() => void) | null,

  // Set from OpenCodeConfig

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
    
    // Workspace kontrolü
    if (!this._checkWorkspace()) {
      return;
    }
    
    // Aktif projeleri yükle ve instance'lar oluştur
    await this._loadActiveProjects();

    // UI bileşenlerini başlat
    this._initComponents();

    // Event listener'ları kur
    this._setupEventListeners();

    // Session store subscription (UI güncellemeleri için)
    this._subscribeToSessionStore();
    
    // Session badge ve status panel tracking
    this._initSessionBadgeTracking();

    // NOT: SSE bağlantısı otomatik başlatılmıyor
    // Kullanıcı "Bağlan" butonuna tıkladığında _connectSSE() çağrılır
    
    // Loading overlay'ı gizle ve app'i göster
    this._showApp();
    
    // Başlangıç durumunu göster
    this._updateStatus('disconnected', 'Bağlanılmadı');

    console.log('[OpenCode] Initialized (ready for connection)');
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
   * Workspace kontrolü - aktif projeleri yükle
   * @returns {boolean} true to continue initialization
   */
  _checkWorkspace() {
    // URL'den workspace gelmediyse, aktif projelerden ilkini kullan
    if (!this._workspace) {
      // Aktif projeleri async olarak yükleyeceğiz, şimdilik default kullan
      console.log('[OpenCode] No workspace from URL, will load from activeProjects');
    } else {
      console.log('[OpenCode] Workspace from URL:', this._workspace);
    }
    
    // Her zaman devam et - aktif projeler _loadActiveProjects'ta yüklenecek
    return true;
  },

  /**
   * Aktif projeleri yükle ve instance'ları oluştur
   * @returns {Promise<void>}
   */
  async _loadActiveProjects() {
    try {
      // Electron API üzerinden aktif projeleri al
      const activeProjects = await window.electronAPI?.opcGetActiveProjects?.() || [];
      
      console.log('[OpenCode] Loading active projects:', activeProjects);
      
      if (activeProjects.length === 0) {
        console.warn('[OpenCode] No active projects found');
        return;
      }
      
      // İlk projeyi workspace olarak ayarla (URL'den gelmediyse)
      if (!this._workspace) {
        const firstProject = activeProjects[0];
        this._workspace = typeof firstProject === 'string' ? firstProject : firstProject.folder;
        sessionStorage.setItem('opencode-workspace', this._workspace);
        console.log('[OpenCode] Set default workspace:', this._workspace);
      }
      
      // Her aktif proje için instance oluştur (disconnected olarak başlar)
      for (const project of activeProjects) {
        const projectPath = typeof project === 'string' ? project : project.folder;
        if (typeof InstanceStore !== 'undefined') {
          const existing = InstanceStore.findByFolder(projectPath);
          if (!existing) {
            const instance = InstanceStore.createInstance({
              folder: projectPath,
              name: projectPath.split('/').pop() || projectPath.split('\\').pop() || 'Workspace',
              url: this._serverUrl || undefined,
            });
            // Status: disconnected - kullanıcı "Bağlan" butonuna tıklamalı
            InstanceStore.setInstanceStatus(instance.id, 'disconnected');
            console.log('[OpenCode] Created instance for active project:', instance.name, '(disconnected)');
          }
        }
      }
      
      // İlk instance'ı aktif yap
      if (typeof InstanceStore !== 'undefined') {
        const instances = InstanceStore.getInstancesArray() as Array<{ id: string; folder: string; name: string }>;
        if (instances.length > 0 && !InstanceStore.getActiveInstance()) {
          InstanceStore.setActiveInstance(instances[0].id);
        }
      }
      
    } catch (err) {
      console.error('[OpenCode] Failed to load active projects:', err);
    }
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
      const messagesContainer = messagesList.closest('.messages-container') as HTMLElement | null;
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
        input: promptInput as HTMLTextAreaElement,
        sendButton: sendButton,
        onSend: (message: string) => this._handleSendMessage(message),
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
      AgentModelSelector.subscribe((event: unknown) => {
        const e = event as { type: string };
        if (e.type === 'model:changed' || e.type === 'selection:changed') {
          this._updateModelSelectorButton();
        }
        if (e.type === 'agent:changed' || e.type === 'selection:changed') {
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
  _openAgentDropdown(triggerBtn: HTMLElement) {
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
      agents.forEach((agent: { name: string; mode?: string; description?: string }, index: number) => {
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
    dropdown.querySelectorAll<HTMLElement>('.agent-dropdown-item').forEach(item => {
      item.addEventListener('click', async () => {
        const agentName = item.dataset.agent;
        if (agentName) {
          await AgentModelSelector.selectAgent(agentName);
        }
        dropdown.remove();
      });
    });
    
    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && e.target !== triggerBtn) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    
    // Close on escape
    const escHandler = (e: KeyboardEvent) => {
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
  _openModelDropdown(triggerBtn: HTMLElement) {
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
      models.forEach((model: { key?: string; providerId: string; id: string; name: string; providerName: string }, index: number) => {
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
    const searchInput = dropdown.querySelector<HTMLInputElement>('.model-search-input');
    searchInput?.focus();
    
    // Search filter
    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      dropdown.querySelectorAll<HTMLElement>('.model-dropdown-item').forEach(item => {
        const text = (item.textContent || '').toLowerCase();
        item.style.display = text.includes(query) ? '' : 'none';
      });
    });
    
    // Item click
    dropdown.querySelectorAll<HTMLElement>('.model-dropdown-item').forEach(item => {
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
    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && e.target !== triggerBtn) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    
    // Close on escape
    const escHandler = (e: KeyboardEvent) => {
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

    // Keyboard shortcuts with AbortController for cleanup
    this._eventAbortController = new AbortController();
    const { signal } = this._eventAbortController;

    document.addEventListener('keydown', (e) => {
      // Ctrl+N - Yeni oturum
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        this._handleNewSession();
      }
      // Ctrl+Shift+A - Agent seçici aç
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        document.getElementById('agent-selector')?.click();
      }
      // Ctrl+Shift+M - Model seçici aç
      if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        document.getElementById('model-selector')?.click();
      }
      // Ctrl+Shift+P - Command Palette
      if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        this._toggleCommandPalette();
      }
      // Escape - İşlemi iptal et veya modal kapat
      if (e.key === 'Escape') {
        if (this._isProcessing) {
          APIClient.cancel().catch(console.error);
        }
        // Modal'ları kapat
        this._closeAllDropdowns();
      }
    }, { signal });
  },

  /**
   * Cleanup all event listeners (call on destroy/unmount)
   */
  destroy() {
    console.log('[OpenCode] Destroying app, cleaning up event listeners...');
    
    // Abort all event listeners
    if (this._eventAbortController) {
      this._eventAbortController.abort();
      this._eventAbortController = null;
    }

    // Disconnect SSE
    if (typeof SSEClient !== 'undefined') {
      SSEClient.disconnectAll();
    }

    // Cancel pending API requests
    if (typeof APIClient !== 'undefined') {
      APIClient.cancelAllRequests();
    }

    this._initialized = false;
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
    SSEClient.on('connection', (data: unknown) => this._handleConnectionChange(data as SSEEventData));
    
    // Session events -> StoreBridge (include top-level sessionId)
    SSEClient.on('session.started', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('session.started', { ...d.data, sessionId: d.sessionId });
      this._handleSessionStarted(d);
    });
    SSEClient.on('session.stopped', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('session.stopped', { ...d.data, sessionId: d.sessionId });
      this._handleSessionStopped(d);
    });
    
    // Message events -> StoreBridge (reactive mode - include sessionId)
    SSEClient.on('message.start', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('message.start', { ...d.data, sessionId: d.sessionId });
    });
    SSEClient.on('message.created', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('message.created', { ...d.data, sessionId: d.sessionId });
    });
    SSEClient.on('message.delta', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('message.delta', { ...d.data, sessionId: d.sessionId });
      // Status update only (UI handled by reactive store)
      this._updateStatus('processing', 'İşleniyor...');
      PromptHandler.setProcessing(true);
    });
    SSEClient.on('message.end', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('message.end', { ...d.data, sessionId: d.sessionId });
      // Status update only
      this._updateStatus('connected', 'Bağlı');
      PromptHandler.setProcessing(false);
      PromptHandler.focus();
    });
    SSEClient.on('message.completed', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('message.completed', { ...d.data, sessionId: d.sessionId });
      // Status update only
      this._updateStatus('connected', 'Bağlı');
      PromptHandler.setProcessing(false);
      PromptHandler.focus();
    });
    
    // Tool events -> StoreBridge (reactive mode - include sessionId)
    SSEClient.on('tool.start', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('tool.start', { ...d.data, sessionId: d.sessionId });
    });
    SSEClient.on('tool.output', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('tool.output', { ...d.data, sessionId: d.sessionId });
    });
    SSEClient.on('tool.end', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('tool.end', { ...d.data, sessionId: d.sessionId });
    });
    
    // Permission & Question (modal handling required)
    SSEClient.on('permission.request', (data: unknown) => this._handlePermissionRequest(data as SSEEventData));
    SSEClient.on('question.ask', (data: unknown) => this._handleQuestion(data as SSEEventData));
    
    // Thinking events -> StoreBridge (reactive mode - include sessionId)
    SSEClient.on('thinking.start', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('thinking.start', { ...d.data, sessionId: d.sessionId });
    });
    SSEClient.on('thinking.delta', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('thinking.delta', { ...d.data, sessionId: d.sessionId });
    });
    SSEClient.on('thinking.end', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('thinking.end', { ...d.data, sessionId: d.sessionId });
    });
    
    // Session update event -> Update agent/model info
    SSEClient.on('session.updated', (data: unknown) => {
      const d = data as SSEEventData;
      const sessionId = d.sessionId;
      const sessionData = (d.data || {}) as { agent?: string; provider?: string; model?: string };
      
      console.log('[OpenCode] Session updated:', sessionId, sessionData);
      
      // Only update defined values (agent and model come in separate events)
      const hasAgent = sessionData.agent !== undefined && sessionData.agent !== null;
      const hasModel = sessionData.provider !== undefined && sessionData.model !== undefined;
      
      console.log('[OpenCode] Session update check:', { hasAgent, hasModel, sessionData });
      
      if (sessionId && (hasAgent || hasModel)) {
        // Build update object with only defined values
        const updateInfo: { agent?: string; provider?: string; model?: string } = {};
        if (hasAgent) updateInfo.agent = sessionData.agent;
        if (hasModel) {
          updateInfo.provider = sessionData.provider;
          updateInfo.model = sessionData.model;
        }
        
        console.log('[OpenCode] Updating with:', updateInfo);
        
        window.SessionStore?.updateSessionInfo(sessionId, updateInfo);
        
        // Update AgentModelSelector (only with defined values)
        if (typeof AgentModelSelector !== 'undefined') {
          console.log('[OpenCode] Calling AgentModelSelector.setFromSession');
          AgentModelSelector.setFromSession(updateInfo);
        } else {
          console.warn('[OpenCode] AgentModelSelector not available');
        }
        
        // Refresh token display
        this._updateTokenDisplay();
      }
    });

    // Status events -> StoreBridge
    SSEClient.on('status.change', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('status.change', d.data);
      this._handleStatusChange(d);
    });
    SSEClient.on('session.idle', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('session.idle', d.data);
      this._handleStatusChange({ data: { status: 'idle' } });
    });
    SSEClient.on('session.completed', (data: unknown) => {
      const d = data as SSEEventData;
      StoreBridge.handleEvent('session.completed', d.data);
      this._handleStatusChange({ data: { status: 'idle' } });
    });
    
    // Error handling
    SSEClient.on('error', (data: unknown) => this._handleError(data as SSEEventData));

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
  _handleConnectionChange(data: SSEEventData) {
    switch (data.status) {
      case 'connected':
        this._updateStatus('connected', 'Bağlı');
        // Otomatik instance oluştur (eğer yoksa)
        this._ensureInstanceExists();
        // Loading overlay'ı gizle ve app'i göster
        this._showApp();
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
        // Hata durumunda da app'i göster (hata mesajı görünsün)
        this._showApp();
        break;
      case 'error':
        this._updateStatus('error', 'Hata');
        this._updateActiveInstanceStatus('error');
        // Hata durumunda da app'i göster (hata mesajı görünsün)
        this._showApp();
        break;
    }
  },

  /**
   * Loading overlay'ı gizle ve app'i göster
   */
  _showApp() {
    const overlay = document.getElementById('loading-overlay');
    const app = document.getElementById('app');
    
    if (overlay) {
      overlay.classList.add('hidden');
    }
    
    if (app) {
      app.style.opacity = '1';
      app.style.pointerEvents = 'auto';
      app.classList.add('ready');
    }
    
    console.log('[OpenCode] App ready');
  },

  /**
   * Mevcut workspace için instance yoksa oluştur
   */
  _ensureInstanceExists() {
    if (typeof InstanceStore === 'undefined') return;

    // Zaten instance varsa sadece status güncelle
    const existingInstances = InstanceStore.getInstancesArray() as Array<{ id: string; folder: string; name: string }>;
    const currentWorkspace = this._workspace;
    
    // Bu workspace için instance var mı kontrol et
    const existingInstance = existingInstances.find(inst => inst.folder === currentWorkspace);
    
    if (existingInstance) {
      // Var olan instance'ı aktif yap (status değiştirme - bağlantı durumunu koru)
      InstanceStore.setActiveInstance(existingInstance.id);
      console.log('[OpenCode] Existing instance activated:', existingInstance.id);
      
      // AgentModelSelector'a folder path set et
      if (currentWorkspace) this._updateAgentModelSelectorFolder(currentWorkspace);
      return;
    }

    // Yeni instance oluştur
    const instance = InstanceStore.createInstance({
      folder: currentWorkspace || '',
      name: currentWorkspace ? (currentWorkspace.split('/').pop() || 'Workspace') : 'Workspace',
      url: this._serverUrl || undefined,
    });

    // Disconnected olarak başla - kullanıcı "Bağlan" butonuna tıklamalı
    InstanceStore.setInstanceStatus(instance.id, 'disconnected');
    
    // AgentModelSelector'a folder path set et
    if (currentWorkspace) this._updateAgentModelSelectorFolder(currentWorkspace);
    
    console.log('[OpenCode] New instance created:', instance.id, instance.name, '(disconnected)');
  },

  /**
   * AgentModelSelector'a folder path set et ve preference'ları yükle
   */
  _updateAgentModelSelectorFolder(folderPath: string) {
    if (typeof AgentModelSelector !== 'undefined' && folderPath) {
      AgentModelSelector.setFolderPath(folderPath);
      
      // Kaydedilmiş preference varsa yükle
      AgentModelSelector._loadSavedPreference().then(pref => {
        if (pref) {
          AgentModelSelector.setFromSession(pref);
        }
      }).catch(err => {
        console.warn('[OpenCode] Failed to load saved preference:', err);
      });
    }
  },

  /**
   * Aktif instance'ın status'unu güncelle
   */
  _updateActiveInstanceStatus(status: string) {
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
  _handleSessionStarted(data: SSEEventData) {
    console.log('[OpenCode] Session started:', data);
    (this as unknown as { _currentSession: unknown })._currentSession = data.data?.session || null;
    
    // Eğer mevcut mesajlar varsa yükle
    const sessionMessages = (this._currentSession as unknown as { messages?: Array<{ timestamp: number; role: string; content: string }> })?.messages;
    if (sessionMessages) {
      sessionMessages.forEach(msg => {
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
  _handleSessionStopped(data: SSEEventData) {
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
  _pendingPermissionId: null as string | null,

  /** @type {string | null} */
  _pendingQuestionId: null as string | null,

  /**
   * Permission isteği
   */
  _handlePermissionRequest(data: SSEEventData) {
    const { permissionId, toolName, description, risk } = data.data || {};
    this._pendingPermissionId = permissionId as string | null;

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
  async _handlePermissionResponse(approved: boolean) {
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
  _handleQuestion(data: SSEEventData) {
    const { questionId, question, options, allowFreeform } = data.data || {};
    this._pendingQuestionId = questionId as string | null;

    const modal = document.getElementById('question-modal');
    const body = document.getElementById('question-body');

    if (body) {
      let html = `<p class="question-text">${question}</p>`;
      
      if (options && (options as Array<{value: string; label: string}>).length > 0) {
        html += '<div class="question-options">';
        (options as Array<{value: string; label: string}>).forEach((opt, _i) => {
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
  _selectOption(button: Element) {
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
    const input = body?.querySelector<HTMLInputElement>('.question-input');
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
      onSelect: (instanceId: string) => this._onInstanceSelect(instanceId),
      onClose: (instanceId: string) => this._onInstanceClose(instanceId),
      onNew: () => this._onInstanceNew(),
    });

    // Subscribe to InstanceStore for sync
    if (typeof InstanceStore !== 'undefined') {
      InstanceStore.subscribe((event: unknown) => {
        const e = event as { type?: string; instanceId?: string; previousInstanceId?: string };
        if (e.type === 'instance:activated' && e.instanceId) {
          this._onInstanceActivated(e.instanceId, e.previousInstanceId ?? null);
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
  async createInstance(options: { folder: string; name?: string; serverUrl?: string }) {
    if (typeof InstanceStore === 'undefined') {
      console.error('[OpenCode] InstanceStore not available');
      return null;
    }

    try {
      // Create instance in store (starts as disconnected)
      const instance = InstanceStore.createInstance({
        folder: options.folder,
        name: options.name,
        url: options.serverUrl,
      });

      // Set status to disconnected (user must click "Bağlan" to connect)
      InstanceStore.setInstanceStatus(instance.id, 'disconnected');

      console.log('[OpenCode] Created instance:', instance.id, '(disconnected)');

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
  async closeInstance(instanceId: string) {
    if (typeof InstanceStore === 'undefined') return;

    console.log('[OpenCode] Closing instance:', instanceId);

    // Disconnect SSE
    if (typeof SSEClient !== 'undefined') {
      SSEClient.disconnectInstance(instanceId);
    }

    // Clear session data
    if (typeof SessionStore !== 'undefined') {
      window.SessionStore?.clearInstance(instanceId);
    }

    // Remove from store
    InstanceStore.removeInstance(instanceId);
  },

  /**
   * Switch to an instance
   * @param {string} instanceId
   */
  switchInstance(instanceId: string) {
    if (typeof InstanceStore === 'undefined') return;
    InstanceStore.setActiveInstance(instanceId);
  },

  /**
   * Handle instance selection from tabs
   * @param {string} instanceId
   */
  _onInstanceSelect(instanceId: string) {
    console.log('[OpenCode] Instance selected:', instanceId);
    this.switchInstance(instanceId);
  },

  /**
   * Handle instance close from tabs
   * @param {string} instanceId
   */
  async _onInstanceClose(instanceId: string) {
    // Confirm if this is the last instance
    if (typeof InstanceStore !== 'undefined' && InstanceStore.getInstanceCount() <= 1) {
      // Don't allow closing the last instance
      console.log('[OpenCode] Cannot close last instance');
      this._showToast('Son workspace kapatılamaz', 'warning');
      return;
    }
    
    // Get instance info before closing
    const instance = InstanceStore.getInstance(instanceId);
    const folderPath = instance?.folder;
    
    // Close the instance
    await this.closeInstance(instanceId);
    
    // Remove from activeProjects in settings
    if (folderPath && window.electronAPI?.opcRemoveActiveProject) {
      try {
        await window.electronAPI.opcRemoveActiveProject(folderPath);
        console.log('[OpenCode] Removed from active projects:', folderPath);
      } catch (err) {
        console.error('[OpenCode] Failed to remove from active projects:', err);
      }
    }
  },

  /**
   * Handle new instance request from tabs
   */
  async _onInstanceNew() {
    console.log('[OpenCode] New instance requested');
    
    // Folder seçme dialog'u aç
    if (window.electronAPI?.showOpenDialog) {
      try {
        const result = await window.electronAPI.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Workspace Seçin',
          buttonLabel: 'Seç'
        });
        
        if (result && !result.canceled && result.filePaths?.length > 0) {
          const folderPath = result.filePaths[0];
          const folderName = folderPath.split('/').pop() || folderPath.split('\\').pop() || 'Workspace';
          
          // Check if already exists
          if (typeof InstanceStore !== 'undefined') {
            const existing = InstanceStore.findByFolder(folderPath);
            if (existing) {
              // Activate existing instance
              InstanceStore.setActiveInstance(existing.id);
              this._showToast(`${folderName} zaten açık`, 'info');
              return;
            }
          }
          
          // Create new instance
          const instanceId = await this.createInstance({
            folder: folderPath,
            name: folderName,
            serverUrl: this._serverUrl ?? undefined,
          });
          
          if (instanceId) {
            // Activate the new instance
            if (typeof InstanceStore !== 'undefined') {
              InstanceStore.setActiveInstance(instanceId);
            }
            
            // Add to activeProjects in settings
            if (window.electronAPI?.opcAddActiveProject) {
              try {
                await window.electronAPI.opcAddActiveProject(folderPath);
                console.log('[OpenCode] Added to active projects:', folderPath);
              } catch (err) {
                console.error('[OpenCode] Failed to add to active projects:', err);
              }
            }
            
            this._showToast(`${folderName} eklendi`, 'success');
          }
        }
      } catch (err) {
        console.error('[OpenCode] Folder dialog error:', err);
        this._showToast('Klasör seçilemedi', 'error');
      }
    } else {
      this._showToast('Dialog kullanılamıyor', 'error');
    }
  },

  /**
   * Handle instance activation
   * @param {string} instanceId
   * @param {string | null} previousInstanceId
   */
  _onInstanceActivated(instanceId: string, previousInstanceId: string | null) {
    console.log('[OpenCode] Instance activated:', instanceId, 'previous:', previousInstanceId);

    // Sync SessionStore to the new active instance
    if (typeof SessionStore !== 'undefined') {
      window.SessionStore?.syncFromActiveInstance();
    }

    // Update UI to reflect the new instance's state
    this._updateInstanceUI(instanceId);

    // Refresh session list for the new instance
    this._renderSessionList();
  },

  /**
   * Update UI for active instance
   * @param {string} instanceId
   */
  _updateInstanceUI(instanceId: string) {
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
        statusText.textContent = statusTexts[instance.status as keyof typeof statusTexts] || instance.status;
      }
    }

    // Update token usage for this instance
    if (typeof SessionStore !== 'undefined') {
      // Token display is updated via _updateTokenDisplay which reads from SessionStore
      this._updateTokenDisplay();
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
          if (panel === 'status' || panel === 'actions' || panel === 'trash') {
            this._switchRightPanel(panel);
          }
        });
      }
    });
  },

  /**
   * Sağ sidebar panel içeriğini değiştir
   * @param {'status' | 'actions' | 'trash'} panelType
   */
  _switchRightPanel(panelType: 'status' | 'actions' | 'trash') {
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
  async _executeQuickAction(action: string) {
    const prompts = {
      'analyze': 'Bu projeyi analiz et ve özet çıkar',
      'lint': 'Projede lint kontrolü yap ve hataları listele',
      'test': 'Projenin testlerini çalıştır',
      'git-status': 'Git status göster ve değişiklikleri özetle',
      'compact': '/compact'
    };
    
    const prompt = prompts[action as keyof typeof prompts];
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
   * - SessionStore'daki eski/geçersiz session referanslarını temizle
   * - Orphan attachment'ları temizle
   * - LocalStorage'daki eski verileri temizle
   */
  async _clearTrash() {
    let cleanedCount = 0;
    
    try {
      // 1. SessionStore'dan geçersiz session'ları temizle
      if (typeof SessionStore !== 'undefined') {
        const sessions = window.SessionStore?.getAllSessions() as Array<{ id: string }>;
        const validSessionIds = new Set<string>();
        
        // API'den güncel session listesini al
        const apiSessions = await APIClient?.listSessions() as Array<{ id: string }> | undefined;
        if (apiSessions && Array.isArray(apiSessions)) {
          apiSessions.forEach(s => validSessionIds.add(s.id));
          
          // Store'daki ama API'de olmayan session'ları temizle
          sessions.forEach(session => {
            if (!validSessionIds.has(session.id)) {
              window.SessionStore?.removeSession(session.id);
              cleanedCount++;
            }
          });
        }
      }
      
      // 2. Orphan attachment'ları temizle
      if (typeof AttachmentStore !== 'undefined') {
        const _currentSessionId = SessionStore?.getCurrentSessionId();
        // Tüm instance'lardaki attachment'ları kontrol et
        // Not: Şu an sadece current session dışındakileri temizliyoruz
        // Çünkü diğer session'ların attachment'ları zaten API'den gelmiyor
        console.log('[OpenCode] Attachment cleanup: current session preserved, id:', _currentSessionId);
      }
      
      // 3. LocalStorage temizliği (eski auto-approve, vs.)
      try {
        // 30 günden eski auto-approve tercihlerini temizle (opsiyonel)
        const autoApproved = JSON.parse(localStorage.getItem('opencode-auto-approved-tools') || '[]');
        if (autoApproved.length > 50) {
          // Çok fazla birikmişse ilk 20'yi tut
          localStorage.setItem('opencode-auto-approved-tools', JSON.stringify(autoApproved.slice(-20)));
          cleanedCount += autoApproved.length - 20;
        }
      } catch {
        // LocalStorage erişim hatası - görmezden gel
      }
      
      // 4. MessageStore cache temizliği
      if (typeof MessageStore !== 'undefined' && (MessageStore as unknown as { clearOldCache?: () => void }).clearOldCache) {
        (MessageStore as unknown as { clearOldCache: () => void }).clearOldCache();
      }
      
      if (cleanedCount > 0) {
        this._showToast(`${cleanedCount} öğe temizlendi`, 'success');
      } else {
        this._showToast('Temizlenecek öğe yok', 'info');
      }
      
      console.log('[OpenCode] Trash cleared:', cleanedCount, 'items');
      
    } catch (err) {
      console.error('[OpenCode] Clear trash error:', err);
      this._showToast('Temizleme sırasında hata oluştu', 'error');
    }
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
        const input = paletteModal.querySelector<HTMLInputElement>('.palette-input');
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
            const input = paletteModal.querySelector<HTMLInputElement>('.palette-input');
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
  _updateConnectionStatus(status: string, text: string) {
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
  _handleStatusChange(data: SSEEventData | { data: { status: string } }) {
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
  _handleError(data: SSEEventData) {
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
  async _handleSendMessage(message: string) {
    console.log('[OpenCode] Sending message:', message);

    // Echo filtreleme için kaydet
    this._lastSentMessage = message.trim();
    StoreBridge.setLastUserMessage(message);

    // Client-side messageId üret (CodeNomad pattern)
    const messageId = (MessageStore as { createId?: (prefix: string) => string }).createId?.('msg') || `msg_${Date.now()}`;
    
    // Optimistic user message - Store'a ekle (UI otomatik güncellenecek)
    // tempId yerine gerçek messageId kullan
    const tempId = StoreBridge.addOptimisticUserMessage(message, messageId);
    (this as unknown as { _pendingUserMessageId: string | null })._pendingUserMessageId = tempId;
    
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
      const errObj = err as { code?: string; message?: string };
      StoreBridge.markUserMessageFailed(tempId, {
        code: errObj.code || 'SEND_FAILED',
        message: errObj.message || 'Mesaj gönderilemedi',
        retryable: true,
      });
      
      // Keep content in cache for retry
    } finally {
      (this as unknown as { _pendingUserMessageId: string | null })._pendingUserMessageId = null;
    }
  },

  /**
   * Retry a failed message
   * Called from MessageRenderer when retry button is clicked
   * @param {string} messageId
   * @param {string} [content] - Optional content override
   */
  async _retryMessage(messageId: string, content?: string) {
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
      await APIClient.sendMessage(messageContent, messageId);
      // Mark as sent
      StoreBridge.markUserMessageSent(messageId);
      // Clear from retry cache
      this._retryContentCache.delete(messageId);
    } catch (err) {
      console.error('[OpenCode] Retry failed:', err);
      this._updateStatus('error', 'Yeniden gönderim başarısız');
      PromptHandler.setProcessing(false);
      
      // Mark as failed again
      const errObj = err as { code?: string; message?: string };
      StoreBridge.markUserMessageFailed(messageId, {
        code: errObj.code || 'RETRY_FAILED',
        message: errObj.message || 'Yeniden gönderim başarısız',
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
    const currentSessionId = window.SessionStore?.getCurrentSessionId();
    if (currentSessionId) {
      MessageStore.clearSession(currentSessionId);
    }
    StoreBridge.clear();
    window.SessionStore?.clear();
    
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
  _updateStatus(status: string, text: string) {
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
   * SessionStore değişikliklerini dinle (session badge için)
   * Not: Token tracking ayrı _subscribeToSessionStore'da (FAZ 4)
   */
  _initSessionBadgeTracking() {
    if (typeof SessionStore === 'undefined') return;
    
    window.SessionStore?.subscribe((event) => {
      this._updateSessionBadge();
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
      ? window.SessionStore?.getCurrentSessionId() 
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
    interface SessionRecord { id: string; title?: string; status?: string; messageIds?: string[]; updatedAt?: number; }
    let sessions: SessionRecord[] = [];
    if (typeof SessionStore !== 'undefined') {
      sessions = window.SessionStore?.getAllSessions() as SessionRecord[];
      
      // API session'larını store'a ekle
      apiSessions.forEach((apiSession: { id: string; title?: string; status?: string }) => {
        if (!window.SessionStore?.getSession(apiSession.id)) {
          window.SessionStore?.upsertSession(apiSession.id, {
            title: apiSession.title,
            messageIds: [],
            status: apiSession.status || 'idle',
          });
        }
      });
      
      // Güncel listeyi al
      sessions = window.SessionStore?.getAllSessions() as SessionRecord[];
    } else {
      sessions = apiSessions as SessionRecord[];
    }

    const currentId = typeof SessionStore !== 'undefined' 
      ? window.SessionStore?.getCurrentSessionId() 
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
    const sortedSessions = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    container.innerHTML = sortedSessions.map(session => {
      const isActive = session.id === currentId;
      const title = session.title || `Oturum ${session.id.substring(0, 8)}`;
      const time = this._formatSessionTime(session.updatedAt ?? 0);
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
            <button class="btn-session-action" title="Compact (Sıkıştır)" onclick="event.stopPropagation(); OpenCodeApp._compactSession('${session.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
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
  async _switchSession(sessionId: string) {
    if (typeof SessionStore === 'undefined') return;

    const currentId = window.SessionStore?.getCurrentSessionId();
    if (sessionId === currentId) return;

    console.log('[OpenCode] Switching to session:', sessionId);

    // Session'u aktif yap
    window.SessionStore?.setCurrentSession(sessionId);

    // Mesaj listesini temizle ve yeniden yükle
    MessageRenderer.clear();

    // API'den mesajları yükle
    if (typeof APIClient !== 'undefined' && APIClient.getSessionMessages) {
      try {
        const result = await APIClient.getSessionMessages(sessionId);
        if (result.messages) {
          result.messages.forEach((msg: { id: string; role: string; content: string; timestamp?: number }) => {
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
  async _renameSession(sessionId: string) {
    if (typeof SessionStore === 'undefined') {
      console.warn('[OpenCode] SessionStore not available');
      return;
    }
    
    const session = window.SessionStore?.getSession(sessionId);
    if (!session) {
      console.warn('[OpenCode] Session not found:', sessionId);
      return;
    }

    const currentTitle = session.title || `Oturum ${sessionId.substring(0, 8)}`;
    const newTitle = prompt('Yeni oturum adı:', currentTitle);

    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) return;

    try {
      // Store'u güncelle
      window.SessionStore?.upsertSession(sessionId, { title: newTitle.trim() });

      // API'ye bildir
      if (typeof APIClient !== 'undefined' && APIClient.renameSession) {
        await APIClient.renameSession(sessionId, newTitle.trim());
      }

      console.log('[OpenCode] Session renamed:', sessionId, '->', newTitle.trim());
      this._showToast?.('Oturum yeniden adlandırıldı', 'success');
    } catch (err) {
      console.error('[OpenCode] Failed to rename session:', err);
      this._showToast?.('Yeniden adlandırma başarısız', 'error');
    }

    this._renderSessionList();
  },

  /**
   * Session'u fork et
   * @param {string} sessionId
   */
  async _forkSession(sessionId: string) {
    const session = window.SessionStore?.getSession(sessionId);
    if (!session) return;

    const messages = MessageStore.getSessionMessages(sessionId);
    const lastMessageId = messages[messages.length - 1]?.id;

    if (lastMessageId && typeof MessageRenderer !== 'undefined') {
      // MessageRenderer'daki fork fonksiyonunu kullan
      await MessageRenderer._handleFork(lastMessageId);
    }
  },

  /**
   * Session'u compact et (sıkıştır)
   * Token kullanımını azaltmak için eski mesajları özetler
   * @param {string} sessionId
   */
  async _compactSession(sessionId: string) {
    if (typeof SessionStore === 'undefined') {
      console.warn('[OpenCode] SessionStore not available');
      return;
    }
    
    const session = window.SessionStore?.getSession(sessionId);
    if (!session) {
      console.warn('[OpenCode] Session not found for compact:', sessionId);
      return;
    }

    const confirmed = confirm('Bu oturum sıkıştırılacak. Eski mesajlar özetlenecek ve token kullanımı azalacak. Devam edilsin mi?');
    if (!confirmed) return;

    try {
      // API'den compact işlemi yap
      if (typeof APIClient !== 'undefined' && APIClient.compact) {
        const result = await APIClient.compact() as { success: boolean; savedTokens?: number; tokensSaved?: number; error?: string };
        
        if (result.success) {
          // Token kazancını göster
          const savedTokens = result.savedTokens || result.tokensSaved || 0;
          const message = savedTokens > 0 
            ? `Oturum sıkıştırıldı. ${savedTokens.toLocaleString()} token tasarruf edildi.`
            : 'Oturum sıkıştırıldı.';
          
          console.log('[OpenCode] Session compacted:', sessionId, { savedTokens });
          this._showToast?.(message, 'success', 4000);
          
          // Mesaj listesini yenile
          if (typeof MessageStore !== 'undefined') {
            MessageStore.clearSession(sessionId);
          }
          // Reload session - trigger re-render
          this._renderSessionList();
        } else {
          throw new Error(result.error || 'Compact failed');
        }
      } else {
        this._showToast?.('Compact API mevcut değil', 'warning');
      }
    } catch (err) {
      console.error('[OpenCode] Failed to compact session:', err);
      this._showToast?.('Sıkıştırma başarısız', 'error');
    }
  },

  /**
   * Session'u sil
   * @param {string} sessionId
   */
  async _deleteSession(sessionId: string) {
    if (typeof SessionStore === 'undefined') {
      console.warn('[OpenCode] SessionStore not available');
      return;
    }
    
    const session = window.SessionStore?.getSession(sessionId);
    if (!session) {
      console.warn('[OpenCode] Session not found for delete:', sessionId);
      return;
    }

    const sessionTitle = session.title || `Oturum ${sessionId.substring(0, 8)}`;
    const confirmed = confirm(`"${sessionTitle}" oturumu silinecek. Emin misiniz?`);
    if (!confirmed) return;

    try {
      // API'den sil
      if (typeof APIClient !== 'undefined' && APIClient.deleteSession) {
        await APIClient.deleteSession(sessionId);
      }

      // Store'dan sil
      window.SessionStore?.removeSession(sessionId);
      
      // MessageStore varsa mesajları da temizle
      if (typeof MessageStore !== 'undefined' && MessageStore.clearSession) {
        MessageStore.clearSession(sessionId);
      }

      console.log('[OpenCode] Session deleted:', sessionId);
      this._showToast?.('Oturum silindi', 'success');

      // Eğer aktif session silindiyse, yeni session oluştur veya başka session'a geç
      const remainingSessions = window.SessionStore?.getAllSessions() as Array<{ id: string }>;
      if (window.SessionStore?.getCurrentSessionId() === sessionId || window.SessionStore?.getCurrentSessionId() === null) {
        if (remainingSessions.length > 0) {
          // Başka bir session'a geç
          window.SessionStore?.setCurrentSession(remainingSessions[0].id);
        } else {
          // Hiç session kalmadı, yeni oluştur
          this._handleNewSession();
        }
      }
    } catch (err) {
      console.error('[OpenCode] Failed to delete session:', err);
      this._showToast?.('Silme başarısız', 'error');
    }

    this._renderSessionList();
  },

  /**
   * Command Palette'i aç/kapat
   */
  _toggleCommandPalette() {
    const paletteModal = document.getElementById('command-palette-modal');
    if (!paletteModal) return;
    
    paletteModal.classList.toggle('hidden');
    if (!paletteModal.classList.contains('hidden')) {
      const input = paletteModal.querySelector<HTMLInputElement>('.palette-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  },

  /**
   * Tüm açık dropdown'ları kapat
   */
  _closeAllDropdowns() {
    // Agent dropdown
    const agentDropdown = document.querySelector('.agent-dropdown-popup');
    if (agentDropdown && !agentDropdown.classList.contains('hidden')) {
      agentDropdown.classList.add('hidden');
    }
    
    // Model dropdown
    const modelDropdown = document.querySelector('.model-dropdown-popup');
    if (modelDropdown && !modelDropdown.classList.contains('hidden')) {
      modelDropdown.classList.add('hidden');
    }
    
    // Command palette
    const paletteModal = document.getElementById('command-palette-modal');
    if (paletteModal && !paletteModal.classList.contains('hidden')) {
      paletteModal.classList.add('hidden');
    }
  },

  /**
   * Session zamanını formatla
   * @param {number} timestamp
   * @returns {string}
   */
  _formatSessionTime(timestamp: number) {
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
  _escapeHtml(text: string) {
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
      ? window.SessionStore?.getCurrentSessionId() 
      : null;

    let usage = { tokens: 0, cost: 0 };
    
    if (sessionId && typeof SessionStore !== 'undefined') {
      usage = window.SessionStore?.getSessionUsage(sessionId);
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

    container.innerHTML = servers.map((server: { name: string; toolCount?: number; status?: string }) => `
      <div class="server-item">
        <span class="server-name">${this._escapeHtml(server.name)}</span>
        ${server.toolCount ? `<span class="server-tools">${server.toolCount} tools</span>` : ''}
        <span class="server-status ${server.status || ''}"></span>
      </div>
    `).join('');
  },

  /**
   * Plugin listesini güncelle
   */
  async _updatePlugins() {
    const container = document.getElementById('plugin-list');
    if (!container) return;

    // API'den plugin listesi al
    let plugins = [];
    if (typeof APIClient !== 'undefined' && APIClient.getPlugins) {
      try {
        const result = await APIClient.getPlugins();
        plugins = result.plugins || [];
      } catch {
        // Fallback: status endpoint'inden dene
        try {
          const statusResult = await APIClient.status();
          plugins = statusResult.plugins || [];
        } catch {
          plugins = [];
        }
      }
    }

    if (plugins.length === 0) {
      container.innerHTML = '<p class="placeholder-text">No plugins installed.</p>';
      return;
    }

    container.innerHTML = plugins.map((plugin: string | { name: string; enabled?: boolean }) => {
      const name = typeof plugin === 'string' ? plugin : plugin.name;
      const enabled = typeof plugin === 'object' ? plugin.enabled !== false : true;
      const statusClass = enabled ? 'enabled' : 'disabled';
      
      return `
        <div class="plugin-item ${statusClass}">
          <span class="plugin-status-dot"></span>
          <span class="plugin-name">${this._escapeHtml(name)}</span>
        </div>
      `;
    }).join('');
  },

  /**
   * Background shell'leri güncelle
   */

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

    container.innerHTML = shells.map((shell: { pid: number; command: string; status?: string }) => `
      <div class="shell-item">
        <span class="shell-pid">${shell.pid}</span>
        <span class="shell-command" title="${this._escapeHtml(shell.command)}">${this._escapeHtml(shell.command.substring(0, 30))}...</span>
        <span class="shell-status ${shell.status || ''}"></span>
      </div>
    `).join('');
  },

  /**
   * Sayıyı formatla (1000 -> 1K)
   * @param {number} num
   * @returns {string}
   */
  _formatNumber(num: number) {
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
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unnamed';
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
    window.SessionStore?.subscribe((event: unknown) => {
      const e = event as { type?: string };
      switch (e.type) {
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
      window.MessageStore?.subscribe?.((event: unknown) => {
        const e = event as { type?: string };
        // Step finish event'leri token güncellemesi tetikler
        if (e.type === 'part:updated' || e.type === 'message:updated') {
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

  _tokenUpdateTimeout: null as ReturnType<typeof setTimeout> | null,

  /**
   * Update token display in UI
   * Uses real data from SessionStore instead of dummy values
   */
  _updateTokenDisplay() {
    const sessionId = SessionStore?.getCurrentSessionId?.();
    
    // Get session-specific info (detailed breakdown)
    const sessionInfo = sessionId ? window.SessionStore?.getSessionInfo?.(sessionId) as { inputTokens?: number; outputTokens?: number; cost?: number } | null : null;
    
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
  _formatTokenCount(count: number) {
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
  },

  // =========================================================================
  // Toast Notifications
  // =========================================================================

  /**
   * Toast mesajı göster
   * @param {string} message - Gösterilecek mesaj
   * @param {'success' | 'error' | 'info' | 'warning'} type - Toast tipi
   * @param {number} duration - Gösterim süresi (ms)
   */
  _showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 3000) {
    // Mevcut toast container'ı bul veya oluştur
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    // Toast elementi oluştur
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon seç
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });
    
    // Auto remove
    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // =========================================================================
  // Session Modals
  // =========================================================================

  /** @type {string|null} */
  _pendingRenameSessionId: null as string | null,
  /** @type {string|null} */
  _pendingDeleteSessionId: null,

  /**
   * Session Rename Modal'ı aç
   * @param {string} sessionId
   * @param {string} currentTitle
   */
  showRenameModal(sessionId: string, currentTitle: string) {
    this._pendingRenameSessionId = sessionId;
    const modal = document.getElementById('session-rename-modal');
    const input = document.getElementById('session-rename-input') as HTMLInputElement | null;
    const idInput = document.getElementById('session-rename-id') as HTMLInputElement | null;
    
    if (modal && input && idInput) {
      input.value = currentTitle || '';
      idInput.value = sessionId;
      modal.classList.remove('hidden');
      input.focus();
      input.select();
    }
  },

  /**
   * Session Rename Modal'ı kapat
   */
  hideRenameModal() {
    const modal = document.getElementById('session-rename-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this._pendingRenameSessionId = null;
  },

  /**
   * Session rename işlemini uygula
   */
  async confirmRename() {
    const input = document.getElementById('session-rename-input') as HTMLInputElement | null;
    const sessionId = this._pendingRenameSessionId;
    const newTitle = input?.value?.trim();
    
    if (!sessionId || !newTitle) {
      this._showToast('Lütfen geçerli bir isim girin', 'warning');
      return;
    }
    
    this.hideRenameModal();
    
    const success = window.SessionStore?.renameSession 
      ? await window.SessionStore?.renameSession(sessionId, newTitle)
      : false;
    if (success) {
      this._showToast('Oturum yeniden adlandırıldı', 'success');
    } else {
      this._showToast('Yeniden adlandırma başarısız', 'error');
    }
  },

  /**
   * Session Delete Modal'ı aç
   * @param {string} sessionId
   * @param {string} sessionTitle
   */
  showDeleteModal(sessionId: string, sessionTitle: string) {
    (this as unknown as { _pendingDeleteSessionId: string | null })._pendingDeleteSessionId = sessionId;
    const modal = document.getElementById('session-delete-modal');
    const namePreview = document.getElementById('delete-session-name');
    const idInput = document.getElementById('session-delete-id') as HTMLInputElement | null;
    
    if (modal && namePreview && idInput) {
      namePreview.textContent = sessionTitle || sessionId;
      idInput.value = sessionId;
      modal.classList.remove('hidden');
    }
  },

  /**
   * Session Delete Modal'ı kapat
   */
  hideDeleteModal() {
    const modal = document.getElementById('session-delete-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this._pendingDeleteSessionId = null;
  },

  /**
   * Session delete işlemini uygula
   */
  async confirmDelete() {
    const sessionId = this._pendingDeleteSessionId;
    
    if (!sessionId) return;
    
    this.hideDeleteModal();
    
    try {
      if (window.SessionStore?.deleteSession) {
        await window.SessionStore?.deleteSession(sessionId);
      }
      this._showToast('Oturum silindi', 'success');
      // Eğer silinen oturum aktifse, yeni oturum oluştur
      const currentId = window.SessionStore?.getCurrentSessionId?.();
      if (currentId === sessionId) {
        this._handleNewSession();
      }
    } catch {
      this._showToast('Silme işlemi başarısız', 'error');
    }
  },

  /**
   * Shell Output Modal'ı aç
   * @param {string} content
   */
  showShellOutputModal(content: string) {
    const modal = document.getElementById('shell-output-modal');
    const outputEl = document.getElementById('shell-output-content');
    
    if (modal && outputEl) {
      outputEl.textContent = content || '';
      modal.classList.remove('hidden');
    }
  },

  /**
   * Shell Output Modal'ı kapat
   */
  hideShellOutputModal() {
    const modal = document.getElementById('shell-output-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },

  /**
   * Modal event listener'larını kur
   */
  _setupModalListeners() {
    // Rename modal
    document.getElementById('rename-modal-close')?.addEventListener('click', () => this.hideRenameModal());
    document.getElementById('btn-rename-cancel')?.addEventListener('click', () => this.hideRenameModal());
    document.getElementById('btn-rename-confirm')?.addEventListener('click', () => this.confirmRename());
    document.getElementById('session-rename-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.confirmRename();
      if (e.key === 'Escape') this.hideRenameModal();
    });
    
    // Delete modal
    document.getElementById('delete-modal-close')?.addEventListener('click', () => this.hideDeleteModal());
    document.getElementById('btn-delete-cancel')?.addEventListener('click', () => this.hideDeleteModal());
    document.getElementById('btn-delete-confirm')?.addEventListener('click', () => this.confirmDelete());
    
    // Shell output modal
    document.getElementById('shell-modal-close')?.addEventListener('click', () => this.hideShellOutputModal());
    document.getElementById('btn-shell-close')?.addEventListener('click', () => this.hideShellOutputModal());
    
    // Overlay click to close
    document.getElementById('session-rename-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'session-rename-modal') this.hideRenameModal();
    });
    document.getElementById('session-delete-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'session-delete-modal') this.hideDeleteModal();
    });
    document.getElementById('shell-output-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'shell-output-modal') this.hideShellOutputModal();
    });
  }
};

// Global'e ekle
window.OpenCodeApp = OpenCodeApp;

// Modal listener'ları DOM hazır olduğunda kur
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => OpenCodeApp._setupModalListeners());
} else {
  // DOM zaten yüklü
  setTimeout(() => OpenCodeApp._setupModalListeners(), 0);
}

// DOM hazır olunca başlat
document.addEventListener('DOMContentLoaded', () => {
  OpenCodeApp.init();
});
