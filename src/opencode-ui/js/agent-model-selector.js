/**
 * Agent & Model Selector
 * 
 * Dinamik agent ve model seçimi için dropdown komponenti.
 * CodeNomad'ın agent-selector.tsx ve model-selector.tsx'inden adapte edildi.
 * 
 * Features:
 * - Agent listesi ve seçimi
 * - Model listesi ve seçimi (provider gruplu)
 * - Arama/filtreleme
 * - Keyboard navigation
 * - Caching
 */

const AgentModelSelector = {
  // ===========================================================================
  // State
  // ===========================================================================
  
  /** @type {Array<Agent>} */
  _agents: [],
  
  /** @type {Array<Provider>} */
  _providers: [],
  
  /** @type {string | null} */
  _currentAgent: null,
  
  /** @type {{providerId: string, modelId: string} | null} */
  _currentModel: null,
  
  /** @type {boolean} */
  _loading: false,
  
  /** @type {string | null} */
  _error: null,
  
  /** @type {boolean} */
  _initialized: false,
  
  /** @type {Set<Function>} */
  _listeners: new Set(),
  
  /** @type {number} */
  _revision: 0,
  
  // Dropdown state
  _activeDropdown: null, // 'agent' | 'model' | null
  _searchQuery: '',
  _selectedIndex: 0,
  
  // DOM refs
  _agentTrigger: null,
  _modelTrigger: null,
  _dropdown: null,
  
  // ===========================================================================
  // Initialization
  // ===========================================================================
  
  /**
   * Initialize selector - fetch agents and providers
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    
    this._loading = true;
    this._notify({ type: 'loading:start' });
    
    try {
      // Fetch agents and providers in parallel
      const [agents, providers] = await Promise.all([
        this._fetchAgents(),
        this._fetchProviders(),
      ]);
      
      this._agents = agents || [];
      this._providers = providers || [];
      this._initialized = true;
      
      // Set default agent if available and not already set
      if (!this._currentAgent && this._agents.length > 0) {
        this._currentAgent = this._agents[0].name;
      }
      
      // Set default model if available and not already set
      if (!this._currentModel && this._providers.length > 0) {
        const firstProvider = this._providers[0];
        if (firstProvider?.models?.length > 0) {
          this._currentModel = firstProvider.models[0].id;
        }
      }
      
      console.log('[AgentModelSelector] Initialized:', {
        agents: this._agents.length,
        providers: this._providers.length,
        currentAgent: this._currentAgent,
        currentModel: this._currentModel,
      });
      
      // Update UI with current values
      this._updateUI();
      
      this._notify({ type: 'initialized' });
      
    } catch (err) {
      console.error('[AgentModelSelector] Init error:', err);
      this._error = err.message || 'Failed to load agents/models';
      this._notify({ type: 'error', error: this._error });
    } finally {
      this._loading = false;
      this._notify({ type: 'loading:end' });
    }
  },
  
  /**
   * Fetch agents - try Electron IPC first (opencode CLI), then REST API
   */
  async _fetchAgents() {
    // Try Electron IPC (opencode agent list via CLI)
    if (window.electronAPI?.opcListAgents) {
      try {
        const agents = await window.electronAPI.opcListAgents();
        if (agents && agents.length > 0) {
          console.log('[AgentModelSelector] Fetched agents via IPC:', agents.length);
          return agents;
        }
      } catch (err) {
        console.warn('[AgentModelSelector] IPC agent fetch failed:', err);
      }
    }
    
    // Try REST API as fallback
    if (window.APIClient?.listAgents) {
      try {
        const response = await window.APIClient.listAgents();
        const agents = Array.isArray(response) ? response : (response?.data || response || []);
        if (agents.length > 0) {
          return agents.map(agent => ({
            name: agent.name,
            description: agent.description || '',
            mode: agent.mode,
          }));
        }
      } catch (err) {
        console.warn('[AgentModelSelector] API agent fetch failed:', err);
      }
    }
    
    // No fallback - return empty array so errors are visible
    console.log('[AgentModelSelector] No agents available from IPC or API');
    return [];
  },
  
  /**
   * Fetch models/providers - try Electron IPC first (config file), then REST API
   * Includes retry mechanism to wait for bridge to be ready
   */
  async _fetchProviders() {
    // Wait for bridge to be ready (max 5 seconds with 500ms intervals)
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
      if (window.electronAPI?.opcListModels) {
        try {
          const providers = await window.electronAPI.opcListModels();
          if (providers && providers.length > 0) {
            // Yeni format: direkt provider array döner
            // Her provider: { id, name, models: [{ id, name, providerId, context?, output?, variants? }] }
            console.log('[AgentModelSelector] Fetched providers via IPC:', providers.length, 
              'models:', providers.reduce((sum, p) => sum + (p.models?.length || 0), 0));
            return providers;
          }
        } catch (err) {
          console.warn('[AgentModelSelector] IPC provider fetch failed:', err);
        }
        break; // IPC available but returned empty/failed, don't retry
      }
      
      // Bridge not ready yet, wait and retry
      if (i < maxRetries - 1) {
        console.log(`[AgentModelSelector] Waiting for IPC bridge... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Try REST API as fallback
    if (window.APIClient?.listProviders) {
      try {
        const response = await window.APIClient.listProviders();
        const data = response?.data || response || {};
        const providers = data.providers || [];
        
        if (providers.length > 0) {
          return providers.map(provider => ({
            id: provider.id,
            name: provider.name,
            models: Object.entries(provider.models || {}).map(([id, model]) => ({
              id,
              name: model.name || id,
              providerId: provider.id,
            })),
          }));
        }
      } catch (err) {
        console.warn('[AgentModelSelector] API provider fetch failed:', err);
      }
    }
    
    // Fallback - return empty array, UI will show "no models available"
    console.log('[AgentModelSelector] No providers available from IPC or API');
    return [];
  },
  
  /**
   * Set current agent/model from session info
   * @param {object} sessionInfo - Session details
   */
  setFromSession(sessionInfo) {
    if (!sessionInfo) return;
    
    const changed = 
      this._currentAgent !== sessionInfo.agent ||
      this._currentModel?.providerId !== sessionInfo.provider ||
      this._currentModel?.modelId !== sessionInfo.model;
    
    if (changed) {
      this._currentAgent = sessionInfo.agent || null;
      this._currentModel = sessionInfo.provider && sessionInfo.model 
        ? { providerId: sessionInfo.provider, modelId: sessionInfo.model }
        : null;
      
      this._notify({ type: 'selection:changed' });
      this._updateUI();
    }
  },
  
  // ===========================================================================
  // Query Methods
  // ===========================================================================
  
  /**
   * Get current agent
   * @returns {Agent | null}
   */
  getCurrentAgent() {
    if (!this._currentAgent) return null;
    return this._agents.find(a => a.name === this._currentAgent) || { name: this._currentAgent };
  },
  
  /**
   * Get current model
   * @returns {{provider: Provider, model: Model} | null}
   */
  getCurrentModel() {
    if (!this._currentModel) return null;
    
    const provider = this._providers.find(p => p.id === this._currentModel.providerId);
    if (!provider) {
      return {
        provider: { id: this._currentModel.providerId, name: this._currentModel.providerId, models: [] },
        model: { id: this._currentModel.modelId, providerId: this._currentModel.providerId, name: this._currentModel.modelId },
      };
    }
    
    const model = provider.models.find(m => m.id === this._currentModel.modelId);
    return {
      provider,
      model: model || { id: this._currentModel.modelId, providerId: this._currentModel.providerId, name: this._currentModel.modelId },
    };
  },
  
  /**
   * Get all agents (filtered by mode if not child session)
   * @param {boolean} includeSubagents
   * @returns {Agent[]}
   */
  getAvailableAgents(includeSubagents = false) {
    if (includeSubagents) return this._agents;
    return this._agents.filter(a => a.mode !== 'subagent');
  },
  
  /**
   * Get all models flattened with provider info
   * @returns {FlatModel[]}
   */
  getFlatModels() {
    return this._providers.flatMap(provider => 
      provider.models.map(model => ({
        ...model,
        providerName: provider.name,
        key: `${model.providerId}/${model.id}`,
        searchText: `${model.name} ${provider.name} ${model.providerId} ${model.id}`.toLowerCase(),
      }))
    );
  },
  
  /**
   * Filter models by search query
   * @param {string} query
   * @returns {FlatModel[]}
   */
  filterModels(query) {
    const models = this.getFlatModels();
    if (!query) return models;
    
    const lower = query.toLowerCase();
    return models.filter(m => m.searchText.includes(lower));
  },
  
  // ===========================================================================
  // Selection Actions
  // ===========================================================================
  
  /**
   * Change agent
   * @param {string} agentName
   * @returns {Promise<boolean>}
   */
  async selectAgent(agentName) {
    if (agentName === this._currentAgent) return true;
    
    const sessionId = window.SessionStore?.getCurrentSessionId?.();
    if (!sessionId) {
      console.warn('[AgentModelSelector] No active session');
      return false;
    }
    
    try {
      await window.APIClient?.updateSessionAgent?.(sessionId, agentName);
      this._currentAgent = agentName;
      this._notify({ type: 'agent:changed', agent: agentName });
      this._updateUI();
      return true;
    } catch (err) {
      console.error('[AgentModelSelector] Failed to change agent:', err);
      return false;
    }
  },
  
  /**
   * Change model
   * @param {string} providerId
   * @param {string} modelId
   * @returns {Promise<boolean>}
   */
  async selectModel(providerId, modelId) {
    if (this._currentModel?.providerId === providerId && this._currentModel?.modelId === modelId) {
      return true;
    }
    
    const sessionId = window.SessionStore?.getCurrentSessionId?.();
    if (!sessionId) {
      console.warn('[AgentModelSelector] No active session');
      return false;
    }
    
    try {
      await window.APIClient?.updateSessionModel?.(sessionId, providerId, modelId);
      this._currentModel = { providerId, modelId };
      this._notify({ type: 'model:changed', providerId, modelId });
      this._updateUI();
      return true;
    } catch (err) {
      console.error('[AgentModelSelector] Failed to change model:', err);
      return false;
    }
  },
  
  // ===========================================================================
  // UI Rendering
  // ===========================================================================
  
  /**
   * Render selector into container
   * @param {HTMLElement} container
   */
  render(container) {
    if (!container) return;
    
    container.innerHTML = `
      <div class="agent-model-selector">
        <div class="selector-row">
          <button class="selector-trigger" data-selector="agent" title="Agent seç">
            <span class="selector-label">Agent:</span>
            <span class="selector-value" data-value="agent">-</span>
            <svg class="selector-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          
          <button class="selector-trigger" data-selector="model" title="Model seç">
            <span class="selector-label">Model:</span>
            <span class="selector-value" data-value="model">-</span>
            <svg class="selector-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // Store refs
    this._agentTrigger = container.querySelector('[data-selector="agent"]');
    this._modelTrigger = container.querySelector('[data-selector="model"]');
    
    // Event listeners
    this._agentTrigger?.addEventListener('click', () => this._toggleDropdown('agent'));
    this._modelTrigger?.addEventListener('click', () => this._toggleDropdown('model'));
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this._activeDropdown && !e.target.closest('.agent-model-selector') && !e.target.closest('.selector-dropdown')) {
        this._closeDropdown();
      }
    });
    
    // Update display
    this._updateUI();
  },
  
  /**
   * Update UI with current values
   */
  _updateUI() {
    const agentValue = document.querySelector('[data-value="agent"]');
    const modelValue = document.querySelector('[data-value="model"]');
    
    if (agentValue) {
      const agent = this.getCurrentAgent();
      agentValue.textContent = agent?.name || '-';
      agentValue.title = agent?.description || '';
    }
    
    if (modelValue) {
      const modelInfo = this.getCurrentModel();
      if (modelInfo?.model) {
        modelValue.textContent = modelInfo.model.name || modelInfo.model.id;
        modelValue.title = `${modelInfo.provider.name} • ${modelInfo.model.providerId}/${modelInfo.model.id}`;
      } else {
        modelValue.textContent = '-';
        modelValue.title = '';
      }
    }
  },
  
  /**
   * Toggle dropdown
   * @param {'agent' | 'model'} type
   */
  _toggleDropdown(type) {
    if (this._activeDropdown === type) {
      this._closeDropdown();
    } else {
      this._openDropdown(type);
    }
  },
  
  /**
   * Open dropdown
   * @param {'agent' | 'model'} type
   */
  _openDropdown(type) {
    this._closeDropdown();
    this._activeDropdown = type;
    this._searchQuery = '';
    this._selectedIndex = 0;
    
    const trigger = type === 'agent' ? this._agentTrigger : this._modelTrigger;
    if (!trigger) return;
    
    // Create dropdown
    this._dropdown = document.createElement('div');
    this._dropdown.className = 'selector-dropdown';
    this._dropdown.innerHTML = this._renderDropdownContent(type);
    
    // Position dropdown
    const rect = trigger.getBoundingClientRect();
    this._dropdown.style.top = `${rect.bottom + 4}px`;
    this._dropdown.style.left = `${rect.left}px`;
    this._dropdown.style.minWidth = `${Math.max(rect.width, 200)}px`;
    
    document.body.appendChild(this._dropdown);
    
    // Setup event listeners
    this._setupDropdownEvents();
    
    // Focus search if model dropdown
    if (type === 'model') {
      const searchInput = this._dropdown.querySelector('.selector-search');
      searchInput?.focus();
    }
    
    // Mark trigger as active
    trigger.classList.add('active');
  },
  
  /**
   * Close dropdown
   */
  _closeDropdown() {
    if (this._dropdown) {
      this._dropdown.remove();
      this._dropdown = null;
    }
    
    this._agentTrigger?.classList.remove('active');
    this._modelTrigger?.classList.remove('active');
    this._activeDropdown = null;
  },
  
  /**
   * Render dropdown content
   * @param {'agent' | 'model'} type
   * @returns {string}
   */
  _renderDropdownContent(type) {
    if (type === 'agent') {
      return this._renderAgentList();
    } else {
      return this._renderModelList();
    }
  },
  
  /**
   * Render agent list
   */
  _renderAgentList() {
    const agents = this.getAvailableAgents();
    
    if (agents.length === 0) {
      return `<div class="selector-empty">No agents available</div>`;
    }
    
    const items = agents.map((agent, index) => `
      <div class="selector-option ${agent.name === this._currentAgent ? 'selected' : ''} ${index === this._selectedIndex ? 'focused' : ''}"
           data-agent="${agent.name}"
           data-index="${index}">
        <div class="selector-option-main">
          <span class="selector-option-name">${agent.name}</span>
          ${agent.mode === 'subagent' ? '<span class="selector-badge">subagent</span>' : ''}
        </div>
        ${agent.description ? `<div class="selector-option-desc">${agent.description}</div>` : ''}
      </div>
    `).join('');
    
    return `<div class="selector-list">${items}</div>`;
  },
  
  /**
   * Render model list with search
   */
  _renderModelList() {
    const models = this.filterModels(this._searchQuery);
    
    const searchHtml = `
      <div class="selector-search-container">
        <input type="text" class="selector-search" placeholder="Search models..." value="${this._searchQuery}">
      </div>
    `;
    
    if (models.length === 0) {
      return searchHtml + `<div class="selector-empty">No models found</div>`;
    }
    
    const currentKey = this._currentModel ? `${this._currentModel.providerId}/${this._currentModel.modelId}` : null;
    
    const items = models.map((model, index) => `
      <div class="selector-option ${model.key === currentKey ? 'selected' : ''} ${index === this._selectedIndex ? 'focused' : ''}"
           data-provider="${model.providerId}"
           data-model="${model.id}"
           data-index="${index}">
        <div class="selector-option-main">
          <span class="selector-option-name">${model.name}</span>
        </div>
        <div class="selector-option-desc">${model.providerName} • ${model.providerId}/${model.id}</div>
      </div>
    `).join('');
    
    return searchHtml + `<div class="selector-list">${items}</div>`;
  },
  
  /**
   * Setup dropdown event listeners
   */
  _setupDropdownEvents() {
    if (!this._dropdown) return;
    
    // Option click
    this._dropdown.querySelectorAll('.selector-option').forEach(option => {
      option.addEventListener('click', () => {
        if (this._activeDropdown === 'agent') {
          const agentName = option.dataset.agent;
          if (agentName) this.selectAgent(agentName);
        } else {
          const providerId = option.dataset.provider;
          const modelId = option.dataset.model;
          if (providerId && modelId) this.selectModel(providerId, modelId);
        }
        this._closeDropdown();
      });
    });
    
    // Search input
    const searchInput = this._dropdown.querySelector('.selector-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._searchQuery = e.target.value;
        this._selectedIndex = 0;
        this._refreshDropdown();
      });
      
      searchInput.addEventListener('keydown', (e) => this._handleKeydown(e));
    }
    
    // Keyboard nav on dropdown
    this._dropdown.addEventListener('keydown', (e) => this._handleKeydown(e));
  },
  
  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} e
   */
  _handleKeydown(e) {
    const items = this._activeDropdown === 'agent' 
      ? this.getAvailableAgents()
      : this.filterModels(this._searchQuery);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._selectedIndex = Math.min(items.length - 1, this._selectedIndex + 1);
        this._updateFocus();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this._selectedIndex = Math.max(0, this._selectedIndex - 1);
        this._updateFocus();
        break;
        
      case 'Enter':
        e.preventDefault();
        const item = items[this._selectedIndex];
        if (item) {
          if (this._activeDropdown === 'agent') {
            this.selectAgent(item.name);
          } else {
            this.selectModel(item.providerId, item.id);
          }
        }
        this._closeDropdown();
        break;
        
      case 'Escape':
        e.preventDefault();
        this._closeDropdown();
        break;
    }
  },
  
  /**
   * Update focus state in dropdown
   */
  _updateFocus() {
    if (!this._dropdown) return;
    
    this._dropdown.querySelectorAll('.selector-option').forEach((option, index) => {
      option.classList.toggle('focused', index === this._selectedIndex);
      if (index === this._selectedIndex) {
        option.scrollIntoView({ block: 'nearest' });
      }
    });
  },
  
  /**
   * Refresh dropdown content
   */
  _refreshDropdown() {
    if (!this._dropdown || !this._activeDropdown) return;
    this._dropdown.innerHTML = this._renderDropdownContent(this._activeDropdown);
    this._setupDropdownEvents();
    
    // Re-focus search
    const searchInput = this._dropdown.querySelector('.selector-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.selectionStart = searchInput.value.length;
    }
  },
  
  // ===========================================================================
  // Subscription
  // ===========================================================================
  
  /**
   * Subscribe to changes
   * @param {Function} listener
   * @returns {Function} Unsubscribe
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },
  
  /**
   * Notify listeners
   */
  _notify(event) {
    this._revision++;
    const eventWithMeta = { ...event, revision: this._revision, timestamp: Date.now() };
    this._listeners.forEach(listener => {
      try {
        listener(eventWithMeta);
      } catch (err) {
        console.error('[AgentModelSelector] Listener error:', err);
      }
    });
  },
};

// Global export
window.AgentModelSelector = AgentModelSelector;
