/**
 * OpenCode UI - Tool Renderer Registry
 * 
 * Per-tool custom renderer sistemi.
 * Her tool için özel görünüm ve davranış tanımlanabilir.
 * 
 * Adapted from CodeNomad's tool-call/resolveToolRenderer pattern
 */

const ToolRendererRegistry = {
  /** @type {Map<string, ToolRendererConfig>} */
  _renderers: new Map(),

  /** @type {ToolRendererConfig} */
  _defaultRenderer: null,

  // =========================================================================
  // Registry API
  // =========================================================================

  /**
   * Register a custom renderer for a tool
   * @param {string} toolName - Tool name (e.g., 'read', 'write', 'bash')
   * @param {ToolRendererConfig} config - Renderer configuration
   */
  register(toolName, config) {
    this._renderers.set(toolName, {
      name: toolName,
      ...config,
    });
    console.log('[ToolRendererRegistry] Registered:', toolName);
  },

  /**
   * Set default renderer for unregistered tools
   * @param {ToolRendererConfig} config
   */
  setDefault(config) {
    this._defaultRenderer = config;
  },

  /**
   * Get renderer for a tool
   * @param {string} toolName
   * @returns {ToolRendererConfig}
   */
  get(toolName) {
    return this._renderers.get(toolName) || this._defaultRenderer;
  },

  /**
   * Check if tool has custom renderer
   * @param {string} toolName
   * @returns {boolean}
   */
  has(toolName) {
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
  renderToolCard(toolCall) {
    const renderer = this.get(toolCall.toolName);
    
    if (renderer?.renderCard) {
      return renderer.renderCard(toolCall);
    }
    
    // Fallback to default ToolRenderer
    return ToolRenderer.createToolCard(toolCall);
  },

  /**
   * Render tool input with appropriate renderer
   * @param {object} toolCall
   * @returns {string} HTML string
   */
  renderInput(toolCall) {
    const renderer = this.get(toolCall.toolName);
    
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
  renderOutput(toolCall) {
    const renderer = this.get(toolCall.toolName);
    
    if (renderer?.renderOutput) {
      return renderer.renderOutput(toolCall.output, toolCall);
    }
    
    // Default output rendering with ANSI support
    return this._defaultRenderOutput(toolCall.output);
  },

  /**
   * Check if tool should auto-collapse
   * @param {object} toolCall
   * @returns {boolean}
   */
  shouldAutoCollapse(toolCall) {
    const renderer = this.get(toolCall.toolName);
    
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
  _defaultRenderInput(input) {
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
  _defaultRenderOutput(output) {
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
  _copyToClipboard(btn) {
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
  _escapeHtml(text) {
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
