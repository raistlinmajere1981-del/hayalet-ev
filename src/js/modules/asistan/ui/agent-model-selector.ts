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

interface Agent {
  id: string;
  name: string;
  description?: string;
  mode?: string;
  [key: string]: unknown;
}

interface Model {
  id: string;
  name: string;
  providerId: string;
}

interface Provider {
  id: string;
  name: string;
  models: Model[];
}

interface ModelSelection {
  providerId: string;
  modelId: string;
}

interface FlatModel {
  providerId: string;
  providerName: string;
  id: string;
  name: string;
  searchText: string;
  key: string;
}

const AgentModelSelector = {
  // ===========================================================================
  // State
  // ===========================================================================
  
  _agents: [] as Agent[],
  
  _providers: [] as Provider[],
  
  _currentAgent: null as string | null,
  
  _currentModel: null as ModelSelection | null,
  
  _loading: false,
  
  _error: null as string | null,
  
  _initialized: false,
  
  _listeners: new Set<(event: unknown) => void>(),
  
  _revision: 0,
  
  // Dropdown state
  _activeDropdown: null as 'agent' | 'model' | null,
  _searchQuery: '',
  _selectedIndex: 0,
  
  // DOM refs
  _agentTrigger: null as HTMLElement | null,
  _modelTrigger: null as HTMLElement | null,
  _dropdown: null as HTMLElement | null,
  
  // ===========================================================================
  // Initialization
  // ===========================================================================
  
  /** @type {string | null} Current folder path for preference persistence */
  _currentFolderPath: null as string | null,

  /**
   * Set current folder path for preference persistence
   * @param {string} folderPath
   */
  setFolderPath(folderPath: string) {
    this._currentFolderPath = folderPath;
    console.log('[AgentModelSelector] Folder path set:', folderPath);
  },

  /**
   * Initialize selector - fetch agents and providers
   * @param {string} [folderPath] - Optional folder path for loading saved preferences
   * @returns {Promise<void>}
   */
  async initialize(folderPath: string | null = null) {
    if (this._initialized) return;
    
    if (folderPath) {
      this._currentFolderPath = folderPath;
    }
    
    this._loading = true;
    this._notify({ type: 'loading:start' });
    
    try {
      // Fetch agents, providers, and saved preferences in parallel
      const [agents, providers, savedPreference] = await Promise.all([
        this._fetchAgents(),
        this._fetchProviders(),
        this._loadSavedPreference(),
      ]);
      
      this._agents = (agents || []) as Agent[];
      this._providers = (providers || []) as Provider[];
      this._initialized = true;
      
      // Apply saved preference if available
      if (savedPreference) {
        console.log('[AgentModelSelector] Applying saved preference:', savedPreference);
        
        if (savedPreference.agent) {
          this._currentAgent = savedPreference.agent;
        }
        
        if (savedPreference.providerId && savedPreference.modelId) {
          this._currentModel = {
            providerId: savedPreference.providerId,
            modelId: savedPreference.modelId,
          };
        }
      }
      
      // Set default agent if still not set and agents available
      if (!this._currentAgent && this._agents.length > 0) {
        this._currentAgent = this._agents[0].name;
        console.log('[AgentModelSelector] Default agent set:', this._currentAgent);
      }
      
      // Set default model if still not set and providers available
      if (!this._currentModel && this._providers.length > 0) {
        const firstProvider = this._providers[0];
        if (firstProvider?.models?.length > 0) {
          const firstModel = firstProvider.models[0];
          this._currentModel = {
            providerId: firstProvider.id,
            modelId: firstModel.id,
          };
          console.log('[AgentModelSelector] Default model set:', this._currentModel);
        }
      }
      
      console.log('[AgentModelSelector] Initialized:', {
        agents: this._agents.length,
        providers: this._providers.length,
        currentAgent: this._currentAgent,
        currentModel: this._currentModel,
        savedPreference: !!savedPreference,
      });
      
      // Update UI with current values
      this._updateUI();
      
      this._notify({ type: 'initialized' });
      
    } catch (err) {
      console.error('[AgentModelSelector] Init error:', err);
      this._error = err instanceof Error ? err.message : 'Failed to load agents/models';
      this._notify({ type: 'error', error: this._error });
    } finally {
      this._loading = false;
      this._notify({ type: 'loading:end' });
    }
  },

  /**
   * Load saved preference from config
   * @returns {Promise<{agent?: string, providerId?: string, modelId?: string} | null>}
   */
  async _loadSavedPreference() {
    try {
      if (window.electronAPI?.opcGetAgentModelPreference) {
        const pref = await window.electronAPI.opcGetAgentModelPreference(this._currentFolderPath ?? '');
        if (pref) {
          console.log('[AgentModelSelector] Loaded saved preference:', pref);
          return pref;
        }
      }
    } catch (err) {
      console.warn('[AgentModelSelector] Failed to load saved preference:', err);
    }
    return null;
  },

  /**
   * Save current preference to config
   */
  async _saveCurrentPreference() {
    try {
      if (window.electronAPI?.opcSaveAgentModelPreference) {
        const preference = {
          agent: this._currentAgent || undefined,
          providerId: this._currentModel?.providerId,
          modelId: this._currentModel?.modelId,
        };
        await window.electronAPI.opcSaveAgentModelPreference(preference, this._currentFolderPath ?? '');
        console.log('[AgentModelSelector] Saved preference:', preference);
      }
    } catch (err) {
      console.warn('[AgentModelSelector] Failed to save preference:', err);
    }
  },
  
  /**
   * Set agent/model from session data (called from SSE events)
   * @param {Object} sessionData
   * @param {string} [sessionData.agent]
   * @param {string} [sessionData.provider]
   * @param {string} [sessionData.model]
   */
  setFromSession(sessionData: { agent?: string; provider?: string; model?: string } | null) {
    if (!sessionData) return;
    
    let changed = false;
    
    if (sessionData.agent && sessionData.agent !== this._currentAgent) {
      this._currentAgent = sessionData.agent;
      changed = true;
      console.log('[AgentModelSelector] Agent set from session:', sessionData.agent);
    }
    
    if (sessionData.provider && sessionData.model) {
      const newModel = {
        providerId: sessionData.provider,
        modelId: sessionData.model,
      };
      if (this._currentModel?.providerId !== newModel.providerId || 
          this._currentModel?.modelId !== newModel.modelId) {
        this._currentModel = newModel;
        changed = true;
        console.log('[AgentModelSelector] Model set from session:', newModel);
      }
    }
    
    if (changed) {
      this._updateUI();
      // Save the new preference
      this._saveCurrentPreference().catch((err: unknown) => {
        console.warn('[AgentModelSelector] Failed to save preference from session:', err);
      });
    }
  },

  /**
   * Fetch agents - try Electron IPC first (opencode CLI), then REST API
   * Includes retry mechanism to wait for bridge to be ready
   */
  async _fetchAgents() {
    // Wait for bridge to be ready (max 5 seconds with 500ms intervals)
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
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
        break; // IPC available but returned empty/failed, don't retry
      }
      
      // Bridge not ready yet, wait and retry
      if (i < maxRetries - 1) {
        console.log(`[AgentModelSelector] Waiting for IPC bridge (agents)... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Try REST API as fallback
    if (window.APIClient?.listAgents) {
      try {
        const response = await window.APIClient.listAgents() as { data?: unknown[] } | unknown[];
        const agentsRaw = Array.isArray(response) ? response : ((response as { data?: unknown[] })?.data || response || []);
        const agents = agentsRaw as Array<{ name: string; description?: string; mode?: string }>;
        if (agents.length > 0) {
          return agents.map((agent: { name: string; description?: string; mode?: string }) => ({
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
            const providerCount = Array.isArray(providers) ? providers.length : 0;
            const modelCount = Array.isArray(providers)
              ? providers.reduce<number>((sum: number, p: { models?: unknown[] }) => sum + (Array.isArray(p.models) ? p.models.length : 0), 0)
              : 0;
            console.log('[AgentModelSelector] Fetched providers via IPC:', providerCount,
              'models:', modelCount);
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
        const response = await window.APIClient.listProviders() as { data?: { providers?: unknown[] }; providers?: unknown[] } | null;
        const data = (response?.data || response || {}) as { providers?: Array<{ id: string; name: string; models?: Record<string, { name?: string }> }> };
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
  
  // setFromSession - moved to line ~203 with save functionality
  
  // ===========================================================================
  // Query Methods
  // ===========================================================================
  
  /**
   * Get current agent
   * @returns {Agent | null}
   */
  getCurrentAgent() {
    if (!this._currentAgent) return null;
    return this._agents.find((a: Agent) => a.name === this._currentAgent) || { name: this._currentAgent };
  },
  
  /**
   * Get current model
   * @returns {{provider: Provider, model: Model} | null}
   */
  getCurrentModel() {
    if (!this._currentModel) return null;
    
    const currentModel = this._currentModel; // Local reference for type narrowing
    const provider = this._providers.find((p: Provider) => p.id === currentModel.providerId);
    if (!provider) {
      return {
        provider: { id: currentModel.providerId, name: currentModel.providerId, models: [] as Model[] },
        model: { id: currentModel.modelId, providerId: currentModel.providerId, name: currentModel.modelId },
      };
    }
    
    const model = provider.models.find((m: Model) => m.id === currentModel.modelId);
    return {
      provider,
      model: model || { id: currentModel.modelId, providerId: currentModel.providerId, name: currentModel.modelId },
    };
  },
  
  /**
   * Get all agents (filtered by mode if not child session)
   * @param {boolean} includeSubagents
   * @returns {Agent[]}
   */
  getAvailableAgents(includeSubagents = false) {
    if (includeSubagents) return this._agents;
    return this._agents.filter((a: Agent) => a.mode !== 'subagent');
  },
  
  /**
   * Get all models flattened with provider info
   * @returns {FlatModel[]}
   */
  getFlatModels() {
    return this._providers.flatMap((provider: Provider) => 
      provider.models.map((model: Model) => ({
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
  filterModels(query: string): FlatModel[] {
    const models = this.getFlatModels();
    if (!query) return models;
    
    const lower = query.toLowerCase();
    return models.filter((m) => m.searchText.includes(lower));
  },
  
  // ===========================================================================
  // Selection Actions
  // ===========================================================================
  
  /**
   * Change agent
   * @param {string} agentName
   * @returns {Promise<boolean>}
   */
  async selectAgent(agentName: string) {
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
      
      // Save preference to config
      this._saveCurrentPreference();
      
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
  async selectModel(providerId: string, modelId: string) {
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
      
      // Save preference to config
      this._saveCurrentPreference();
      
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
  render(container: HTMLElement) {
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
      const target = e.target as HTMLElement;
      if (this._activeDropdown && !target.closest('.agent-model-selector') && !target.closest('.selector-dropdown')) {
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
      (agentValue as HTMLElement).title = (agent && 'description' in agent ? agent.description : '') || '';
    }
    
    if (modelValue) {
      const modelInfo = this.getCurrentModel();
      if (modelInfo?.model) {
        modelValue.textContent = modelInfo.model.name || modelInfo.model.id;
        (modelValue as HTMLElement).title = `${modelInfo.provider.name} • ${modelInfo.model.providerId}/${modelInfo.model.id}`;
      } else {
        modelValue.textContent = '-';
        (modelValue as HTMLElement).title = '';
      }
    }
  },
  
  /**
   * Toggle dropdown
   * @param {'agent' | 'model'} type
   */
  _toggleDropdown(type: 'agent' | 'model') {
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
  _openDropdown(type: 'agent' | 'model') {
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
      const searchInput = this._dropdown.querySelector('.selector-search') as HTMLInputElement | null;
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
  _renderDropdownContent(type: 'agent' | 'model') {
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
    
    const items = agents.map((agent: Agent, index: number) => `
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
    
    const items = models.map((model, index: number) => `
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
    this._dropdown.querySelectorAll('.selector-option').forEach((opt: Element) => {
      const option = opt as HTMLElement;
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
    const searchInput = this._dropdown.querySelector('.selector-search') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._searchQuery = (e.target as HTMLInputElement).value;
        this._selectedIndex = 0;
        this._refreshDropdown();
      });
      
      searchInput.addEventListener('keydown', (e) => this._handleKeydown(e));
    }
    
    // Keyboard nav on dropdown
    this._dropdown.addEventListener('keydown', (e: Event) => this._handleKeydown(e as KeyboardEvent));
  },
  
  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} e
   */
  _handleKeydown(e: KeyboardEvent) {
    const isAgent = this._activeDropdown === 'agent';
    const agents = isAgent ? this.getAvailableAgents() : [];
    const models = !isAgent ? this.filterModels(this._searchQuery) : [];
    const itemCount = isAgent ? agents.length : models.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._selectedIndex = Math.min(itemCount - 1, this._selectedIndex + 1);
        this._updateFocus();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this._selectedIndex = Math.max(0, this._selectedIndex - 1);
        this._updateFocus();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (isAgent) {
          const agent = agents[this._selectedIndex];
          if (agent) this.selectAgent(agent.name);
        } else {
          const model = models[this._selectedIndex];
          if (model) this.selectModel(model.providerId, model.id);
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
    
    this._dropdown.querySelectorAll('.selector-option').forEach((option: Element, index: number) => {
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
    const searchInput = this._dropdown.querySelector('.selector-search') as HTMLInputElement | null;
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
  subscribe(listener: (event: unknown) => void) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },
  
  /**
   * Notify listeners
   */
  _notify(event: Record<string, unknown>) {
    this._revision++;
    const eventWithMeta = { ...event, revision: this._revision, timestamp: Date.now() };
    this._listeners.forEach((listener: (event: unknown) => void) => {
      try {
        listener(eventWithMeta);
      } catch (err) {
        console.error('[AgentModelSelector] Listener error:', err);
      }
    });
  },
};

// Global export
(window as unknown as { AgentModelSelector: typeof AgentModelSelector }).AgentModelSelector = AgentModelSelector;
