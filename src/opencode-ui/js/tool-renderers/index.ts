/**
 * OpenCode UI - Tool Renderer Registry
 * 
 * Per-tool custom renderer sistemi.
 * Her tool için özel görünüm ve davranış tanımlanabilir.
 * 
 * Adapted from CodeNomad's tool-call/resolveToolRenderer pattern
 */

interface ToolRendererConfig {
  name?: string;
  icon?: string;
  label?: string;
  renderCard?: (toolCall: ToolCallData) => HTMLElement;
  renderInput?: (input: unknown, toolCall: ToolCallData) => string;
  renderOutput?: (output: string, toolCall: ToolCallData) => string;
  shouldAutoCollapse?: (toolCall: ToolCallData) => boolean;
}

interface ToolCallData {
  toolId?: string;
  toolName?: string;
  status?: string;
  input?: unknown;
  output?: string;
}

type HookType = 'beforeRender' | 'afterRender' | 'onStatusChange';
type HookCallback = (data: unknown) => void;
type RegistryListener = (event: unknown) => void;

const ToolRendererRegistry = {
  /** @type {Map<string, ToolRendererConfig>} */
  _renderers: new Map<string, ToolRendererConfig>(),

  /** @type {ToolRendererConfig} */
  _defaultRenderer: null as ToolRendererConfig | null,

  // =========================================================================
  // Registry API
  // =========================================================================

  _listeners: new Set<RegistryListener>(),

  /** @type {Map<string, Function[]>} Tool-specific hooks */
  _hooks: new Map<string, HookCallback[]>(),

  /**
   * Register a custom renderer for a tool
   * @param {string} toolName - Tool name (e.g., 'read', 'write', 'bash')
   * @param {ToolRendererConfig} config - Renderer configuration
   * @returns {Function} Unregister function
   */
  register(toolName: string, config: ToolRendererConfig) {
    this._renderers.set(toolName, {
      name: toolName,
      ...config,
    });
    console.log('[ToolRendererRegistry] Registered:', toolName);
    this._notify({ type: 'renderer:registered', toolName });
    
    // Return unregister function
    return () => this.unregister(toolName);
  },

  /**
   * Alias for register (extensibility API)
   * @param {string} toolName
   * @param {ToolRendererConfig} config
   * @returns {Function} Unregister function
   */
  registerRenderer(toolName: string, config: ToolRendererConfig) {
    return this.register(toolName, config);
  },

  /**
   * Unregister a tool renderer
   * @param {string} toolName
   * @returns {boolean} True if renderer was removed
   */
  unregister(toolName: string) {
    const existed = this._renderers.delete(toolName);
    if (existed) {
      console.log('[ToolRendererRegistry] Unregistered:', toolName);
      this._notify({ type: 'renderer:unregistered', toolName });
    }
    return existed;
  },

  /**
   * Alias for unregister (extensibility API)
   * @param {string} toolName
   * @returns {boolean}
   */
  unregisterRenderer(toolName: string) {
    return this.unregister(toolName);
  },

  /**
   * Set default renderer for unregistered tools
   * @param {ToolRendererConfig} config
   */
  setDefault(config: ToolRendererConfig) {
    this._defaultRenderer = config;
    this._notify({ type: 'default:changed' });
  },

  /**
   * Add a hook for tool events (before/after render)
   * @param {string} toolName - Tool name or '*' for all tools
   * @param {'beforeRender' | 'afterRender' | 'onStatusChange'} hookType
   * @param {Function} callback
   * @returns {Function} Unhook function
   */
  addHook(toolName: string, hookType: HookType, callback: HookCallback) {
    const key = `${toolName}:${hookType}`;
    if (!this._hooks.has(key)) {
      this._hooks.set(key, []);
    }
    this._hooks.get(key)!.push(callback);
    
    return () => this.removeHook(toolName, hookType, callback);
  },

  /**
   * Remove a hook
   * @param {string} toolName
   * @param {string} hookType
   * @param {Function} callback
   */
  removeHook(toolName: string, hookType: HookType, callback: HookCallback) {
    const key = `${toolName}:${hookType}`;
    const hooks = this._hooks.get(key);
    if (hooks) {
      const index = hooks.indexOf(callback);
      if (index !== -1) {
        hooks.splice(index, 1);
      }
    }
  },

  /**
   * Execute hooks for a tool
   * @param {string} toolName
   * @param {string} hookType
   * @param {object} data
   */
  _executeHooks(toolName: string, hookType: HookType, data: unknown) {
    // Tool-specific hooks
    const specificKey = `${toolName}:${hookType}`;
    const specificHooks = this._hooks.get(specificKey) || [];
    
    // Wildcard hooks (apply to all tools)
    const wildcardKey = `*:${hookType}`;
    const wildcardHooks = this._hooks.get(wildcardKey) || [];
    
    [...wildcardHooks, ...specificHooks].forEach(hook => {
      try {
        hook(data);
      } catch (err) {
        console.error('[ToolRendererRegistry] Hook error:', err);
      }
    });
  },

  /**
   * Subscribe to registry changes
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener: RegistryListener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  /**
   * Notify listeners
   * @param {object} event
   */
  _notify(event: unknown) {
    this._listeners.forEach((listener: RegistryListener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[ToolRendererRegistry] Listener error:', err);
      }
    });
  },

  /**
   * Get renderer for a tool
   * @param {string} toolName
   * @returns {ToolRendererConfig}
   */
  get(toolName: string) {
    return this._renderers.get(toolName) || this._defaultRenderer;
  },

  /**
   * Check if tool has custom renderer
   * @param {string} toolName
   * @returns {boolean}
   */
  has(toolName: string) {
    return this._renderers.has(toolName);
  },

  /**
   * Get all registered tool names
   * @returns {string[]}
   */
  getRegisteredTools() {
    return Array.from(this._renderers.keys());
  },

  // =========================================================================
  // Render Helpers
  // =========================================================================

  /**
   * Render tool card with appropriate renderer
   * @param {object} toolCall - Tool call data
   * @returns {HTMLElement}
   */
  renderToolCard(toolCall: ToolCallData) {
    // Execute beforeRender hooks
    this._executeHooks(toolCall.toolName || '', 'beforeRender', { toolCall });
    
    const renderer = this.get(toolCall.toolName || '');
    let card;
    
    if (renderer?.renderCard) {
      card = renderer.renderCard(toolCall);
    } else {
      // Fallback to default ToolRenderer
      card = ToolRenderer.createToolCard(toolCall);
    }
    
    // Execute afterRender hooks
    this._executeHooks(toolCall.toolName || '', 'afterRender', { toolCall, element: card });
    
    return card;
  },

  /**
   * Update tool status and execute hooks
   * @param {object} toolCall
   * @param {string} newStatus
   */
  updateStatus(toolCall: ToolCallData, newStatus: string) {
    const oldStatus = toolCall.status;
    toolCall.status = newStatus;
    
    // Execute status change hooks
    this._executeHooks(toolCall.toolName || '', 'onStatusChange', { 
      toolCall, 
      oldStatus, 
      newStatus 
    });
  },

  /**
   * Render tool input with appropriate renderer
   * @param {object} toolCall
   * @returns {string} HTML string
   */
  renderInput(toolCall: ToolCallData) {
    const renderer = this.get(toolCall.toolName || '');
    
    if (renderer?.renderInput) {
      return renderer.renderInput(toolCall.input, toolCall);
    }
    
    // Default JSON rendering
    return this._defaultRenderInput(toolCall.input);
  },

  /**
   * Render tool output with appropriate renderer
   * @param {object} toolCall
   * @returns {string} HTML string
   */
  renderOutput(toolCall: ToolCallData) {
    const renderer = this.get(toolCall.toolName || '');
    
    if (renderer?.renderOutput) {
      return renderer.renderOutput(toolCall.output || '', toolCall);
    }
    
    // Default output rendering with ANSI support
    return this._defaultRenderOutput(toolCall.output || '');
  },

  /**
   * Check if tool should auto-collapse
   * @param {object} toolCall
   * @returns {boolean}
   */
  shouldAutoCollapse(toolCall: ToolCallData) {
    const renderer = this.get(toolCall.toolName || '');
    
    if (renderer?.shouldAutoCollapse) {
      return renderer.shouldAutoCollapse(toolCall);
    }
    
    // Default: collapse successful tools with large output
    return toolCall.status === 'success' && 
           (toolCall.output?.length || 0) > 500;
  },

  // =========================================================================
  // Default Renderers
  // =========================================================================

  /**
   * Default input renderer
   * @param {object} input
   * @returns {string}
   */
  _defaultRenderInput(input: unknown) {
    if (!input) return '';
    
    const inputStr = typeof input === 'string' 
      ? input 
      : JSON.stringify(input, null, 2);
    
    return `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-label">INPUT</span>
        </div>
        <div class="tool-input"><pre>${this._escapeHtml(inputStr)}</pre></div>
      </div>
    `;
  },

  /**
   * Default output renderer with ANSI support
   * @param {string} output
   * @returns {string}
   */
  _defaultRenderOutput(output: string) {
    if (!output) return '';
    
    return `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-label">OUTPUT</span>
          <button class="tool-section-copy" onclick="ToolRendererRegistry._copyToClipboard(this)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
        <div class="tool-output" data-raw-content="${this._escapeHtml(output)}">
          ${ToolRenderer._parseAnsi(this._escapeHtml(output))}
        </div>
      </div>
    `;
  },

  /**
   * Copy to clipboard helper
   * @param {HTMLElement} btn
   */
  _copyToClipboard(btn: HTMLElement) {
    const section = btn.closest('.tool-section');
    const output = section?.querySelector('.tool-output, .tool-input');
    const content = output?.getAttribute('data-raw-content') || output?.textContent || '';
    
    navigator.clipboard.writeText(content).then(() => {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 1500);
    });
  },

  /**
   * HTML escape
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text: string) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

// Global export
window.ToolRendererRegistry = ToolRendererRegistry;

/**
 * @typedef {Object} ToolRendererConfig
 * @property {string} [name] - Tool name
 * @property {string} [icon] - Custom icon SVG
 * @property {string} [label] - Custom label
 * @property {(toolCall: object) => HTMLElement} [renderCard] - Full card renderer
 * @property {(input: object, toolCall: object) => string} [renderInput] - Input section renderer
 * @property {(output: string, toolCall: object) => string} [renderOutput] - Output section renderer
 * @property {(toolCall: object) => boolean} [shouldAutoCollapse] - Auto-collapse logic
 */
