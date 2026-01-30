/**
 * OpenCode UI - Tool Renderer
 * 
 * Tool call kartlarını render eder.
 * Expand/collapse, status gösterimi ve output rendering içerir.
 */

const ToolRenderer = {
  /** @type {Map<string, HTMLElement>} */
  _toolElements: new Map() as Map<string, HTMLElement>,
  
  /** @type {Set<string>} Session bazlı auto-approve */
  _autoApprovedTools: new Set() as Set<string>,
  
  /** @type {Map<string, number>} Tool execution start times */
  _toolStartTimes: new Map() as Map<string, number>,

  /** @type {Map<string, Function>} Permission handlers */
  _permissionHandlers: new Map() as Map<string, (result: boolean) => void>,

  /** @type {Map<string, Function>} Question handlers */
  _questionHandlers: new Map() as Map<string, (answer: string) => void>,

  /** @type {Map<string, ReturnType<typeof setInterval>>} Live timers */
  _liveTimers: new Map() as Map<string, ReturnType<typeof setInterval>>,

  // =========================================================================
  // Auto-Approve Management
  // =========================================================================

  /**
   * Tool auto-approve kontrolu (session + localStorage)
   * @param {string} toolName
   * @returns {boolean}
   */
  isAutoApproved(toolName: string) {
    // Session bazlı kontrol
    if (this._autoApprovedTools.has(toolName)) return true;
    
    // LocalStorage'dan kontrol
    try {
      const persisted = JSON.parse(localStorage.getItem('opencode-auto-approved-tools') || '[]');
      return persisted.includes(toolName);
    } catch {
      return false;
    }
  },

  /**
   * Tool'u auto-approve listesine ekle ve persist et
   * @param {string} toolName
   * @param {boolean} persist - localStorage'a da kaydet (default: true)
   */
  setAutoApprove(toolName: string, persist = true) {
    this._autoApprovedTools.add(toolName);
    
    if (persist) {
      this._persistAutoApprove(toolName);
    }
  },

  /**
   * Auto-approve tercihini localStorage'a kaydet
   * @param {string} toolName
   */
  _persistAutoApprove(toolName: string) {
    try {
      const persisted = JSON.parse(localStorage.getItem('opencode-auto-approved-tools') || '[]');
      if (!persisted.includes(toolName)) {
        persisted.push(toolName);
        localStorage.setItem('opencode-auto-approved-tools', JSON.stringify(persisted));
      }
    } catch (err) {
      console.warn('[ToolRenderer] Failed to persist auto-approve:', err);
    }
  },

  /**
   * Auto-approve tercihini kaldır
   * @param {string} toolName
   */
  removeAutoApprove(toolName: string) {
    try {
      const persisted = JSON.parse(localStorage.getItem('opencode-auto-approved-tools') || '[]');
      const filtered = persisted.filter((t: string) => t !== toolName);
      localStorage.setItem('opencode-auto-approved-tools', JSON.stringify(filtered));
      this._autoApprovedTools.delete(toolName);
    } catch (err) {
      console.warn('[ToolRenderer] Failed to remove auto-approve:', err);
    }
  },

  /**
   * Tüm auto-approve tercihlerini temizle
   */
  clearAllAutoApproves() {
    try {
      localStorage.removeItem('opencode-auto-approved-tools');
      this._autoApprovedTools.clear();
    } catch (err) {
      console.warn('[ToolRenderer] Failed to clear auto-approves:', err);
    }
  },

  // =========================================================================
  // Execution Time Tracking
  // =========================================================================

  /**
   * Tool execution başlangıç zamanını kaydet
   * @param {string} toolId
   */
  markToolStart(toolId: string) {
    this._toolStartTimes.set(toolId, Date.now());
  },

  /**
   * Tool execution süresini hesapla
   * @param {string} toolId
   * @returns {number|null} milliseconds or null if not started
   */
  getExecutionTime(toolId: string) {
    const startTime = this._toolStartTimes.get(toolId);
    if (!startTime) return null;
    return Date.now() - startTime;
  },

  /**
   * Execution time'ı formatla
   * @param {number} ms
   * @returns {string}
   */
  formatExecutionTime(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  },

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Tool call kartı oluştur (CodeNomad Style)
   * @param {object} toolCall
   * @param {string} toolCall.toolId - Tool ID
   * @param {string} toolCall.toolName - Tool adı
   * @param {'pending' | 'running' | 'success' | 'error'} toolCall.status - Durum
   * @param {object} [toolCall.input] - Input parametreleri
   * @param {string} [toolCall.output] - Output
   * @param {string} [toolCall.error] - Hata mesajı
   * @param {string} [toolCall.description] - Tool açıklaması
   * @returns {HTMLElement}
   */
  createToolCard(toolCall: { toolId?: string; toolName?: string; status?: string; input?: unknown; output?: string; error?: string; startedAt?: number; completedAt?: number; description?: string }) {
    const toolId = toolCall.toolId ?? `tool-${Date.now()}`;
    const toolName = toolCall.toolName ?? 'unknown';
    
    // Check if ToolRendererRegistry has a custom renderer for this tool
    if (typeof ToolRendererRegistry !== 'undefined' && ToolRendererRegistry.has(toolName)) {
      const customRenderer = ToolRendererRegistry.get(toolName);
      if (customRenderer?.renderCard) {
        const element = customRenderer.renderCard(toolCall);
        this._toolElements.set(toolId, element);
        return element;
      }
    }

    // Default rendering (fallback)
    const div = document.createElement('div');
    div.className = `tool-card ${toolCall.status ?? 'pending'}`;
    div.setAttribute('data-tool-id', toolId);

    // Get custom icon/label from registry or use defaults
    const registry = typeof ToolRendererRegistry !== 'undefined' ? ToolRendererRegistry.get(toolName) : null;
    const toolIcon = registry?.icon || `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>`;
    const toolLabel = registry?.label || 'Tool Call';

    // Use custom input/output renderers if available
    const inputHtml = registry?.renderInput 
      ? registry.renderInput(toolCall.input, toolCall)
      : (toolCall.input ? this._renderInput(toolCall.input) : '');
    
    const outputHtml = registry?.renderOutput
      ? registry.renderOutput(toolCall.output || '', toolCall)
      : (toolCall.output ? this._renderOutput(String(toolCall.output)) : '');

    const safeToolId = toolCall.toolId || '';
    const safeToolName = toolCall.toolName || 'unknown';
    const safeStatus = toolCall.status || 'pending';

    // Check for auto-collapse
    const shouldCollapse = registry?.shouldAutoCollapse?.(toolCall) ?? false;
    if (shouldCollapse) {
      div.classList.add('collapsed');
    }

    div.innerHTML = `
      <div class="tool-header" onclick="ToolRenderer.toggleCollapse('${safeToolId}')">
        <div class="tool-icon">${toolIcon}</div>
        <span class="tool-label">${toolLabel}</span>
        <span class="tool-name-badge">${this._escapeHtml(safeToolName)}</span>
        <div class="tool-header-spacer"></div>
        <span class="tool-status ${safeStatus}">${this._getStatusText(safeStatus)}</span>
        <button class="tool-copy-btn" onclick="event.stopPropagation(); ToolRenderer.copyOutput('${safeToolId}')"">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        <div class="tool-toggle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      <div class="tool-body">
        ${toolCall.description ? this._renderDescription(toolCall.description) : ''}
        ${inputHtml}
        <div class="tool-output-container">
          ${outputHtml}
          ${toolCall.error ? this._renderError(toolCall.error) : ''}
        </div>
      </div>
    `;

    this._toolElements.set(safeToolId, div);
    return div;
  },
  
  /**
   * Tool description render (collapsible)
   * @param {string} description
   * @returns {string}
   */
  _renderDescription(description: string) {
    return `
      <div class="tool-description" onclick="ToolRenderer.toggleDescription(this)">
        <div class="tool-description-toggle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="tool-description-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
        </div>
        <span class="tool-description-text">${this._escapeHtml(description)}</span>
        <div class="tool-description-edit">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </div>
      </div>
    `;
  },
  
  /**
   * Toggle description collapse
   * @param {HTMLElement} element
   */
  toggleDescription(element: HTMLElement) {
    element.classList.toggle('collapsed');
  },
  
  /**
   * Copy tool output to clipboard
   * @param {string} toolId
   */
  copyOutput(toolId: string) {
    const element = this._toolElements.get(toolId);
    if (!element) return;
    
    const output = element.querySelector('.tool-output');
    const content = output?.textContent || '';
    
    navigator.clipboard.writeText(content).then(() => {
      const btn = element.querySelector('.tool-copy-btn');
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
        setTimeout(() => {
          btn.innerHTML = originalHTML;
        }, 1500);
      }
    }).catch(err => {
      console.error('[ToolRenderer] Copy failed:', err);
    });
  },

  /** @type {boolean} Enable debug logging */
  _debug: false,

  /**
   * Enable/disable debug logging
   * @param {boolean} enabled
   */
  setDebug(enabled: boolean) {
    this._debug = enabled;
  },

  /**
   * Tool card güncelle
   * @param {string} toolId - Tool ID
   * @param {object} update - Güncelleme
   */
  updateToolCard(toolId: string, update: { status?: string; output?: string; error?: string; completedAt?: number }) {
    const element = this._toolElements.get(toolId);
    if (!element) {
      // Debug log: element not found
      if (this._debug) {
        console.warn(`[ToolRenderer] updateToolCard failed: element not found for toolId="${toolId}"`, {
          toolId,
          update,
          registeredTools: Array.from(this._toolElements.keys()),
          selector: `[data-tool-id="${toolId}"]`,
        });
      }
      return;
    }

    if (this._debug) {
      console.log(`[ToolRenderer] updateToolCard:`, { toolId, update });
    }

    // Status güncelle
    if (update.status) {
      element.className = `tool-card ${update.status}`;
      
      const icon = element.querySelector('.tool-icon');
      if (icon && update.status) {
        const statusIcon = this._getStatusIcon(update.status);
        if (statusIcon) icon.innerHTML = statusIcon;
      }

      const statusText = element.querySelector('.tool-status');
      if (statusText) {
        // Execution time ekle (completed/error durumlarında)
        let statusStr = this._getStatusText(update.status);
        if ((update.status === 'completed' || update.status === 'error') && this._toolStartTimes.has(toolId)) {
          const execTime = this.getExecutionTime(toolId);
          if (execTime !== null) {
            statusStr += ` (${this.formatExecutionTime(execTime)})`;
          }
          this._toolStartTimes.delete(toolId); // Cleanup
        }
        statusText.textContent = statusStr;
      }
      
      // Running durumunda start time'ı kaydet
      if (update.status === 'running' && !this._toolStartTimes.has(toolId)) {
        this.markToolStart(toolId);
      }
    }

    // Output güncelle
    if (update.output !== undefined) {
      const outputContainer = element.querySelector('.tool-output-container');
      if (outputContainer) {
        outputContainer.innerHTML = this._renderOutput(update.output);
      }
    }

    // Error güncelle
    if (update.error) {
      const outputContainer = element.querySelector('.tool-output-container');
      if (outputContainer) {
        outputContainer.innerHTML = this._renderError(update.error);
      }
    }
  },

  /**
   * Output'a delta ekle (streaming)
   * @param {string} toolId - Tool ID
   * @param {string} delta - Eklenecek metin
   */
  appendOutput(toolId: string, delta: string) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    let outputEl = element.querySelector('.tool-output');
    
    // Output elementi yoksa oluştur
    if (!outputEl) {
      const container = element.querySelector('.tool-output-container');
      if (container) {
        container.innerHTML = `
          <div class="tool-section">
            <span class="tool-section-label">Output</span>
            <div class="tool-output streaming"></div>
          </div>
        `;
        outputEl = container.querySelector('.tool-output');
      }
    }

    if (outputEl) {
      const currentContent = outputEl.getAttribute('data-raw-content') || '';
      const newContent = currentContent + delta;
      outputEl.setAttribute('data-raw-content', newContent);
      outputEl.innerHTML = this._parseAnsi(this._escapeHtml(newContent));
    }
  },

  /**
   * Tool card'ı collapse/expand et
   * @param {string} toolId - Tool ID
   */
  toggleCollapse(toolId: string) {
    const element = this._toolElements.get(toolId);
    if (element) {
      element.classList.toggle('collapsed');
    }
  },

  /**
   * Tüm tool card'ları temizle
   */
  clear() {
    this._toolElements.clear();
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Status ikonu
   * @param {string} status
   * @returns {string}
   */
  _getStatusIcon(status: string) {
    const icons: Record<string, string> = {
      pending: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>',
      running: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
      success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    };
    return icons[status] || icons.pending;
  },

  /**
   * Status metni
   * @param {string} status
   * @returns {string}
   */
  _getStatusText(status: string) {
    // Config'den al
    if (typeof window.OpenCodeConfig !== 'undefined') {
      return window.OpenCodeConfig?.getStatusText(status);
    }
    // Fallback
    const texts: Record<string, string> = {
      pending: 'Bekliyor',
      running: 'Çalışıyor',
      success: 'Tamamlandı',
      error: 'Hata',
    };
    return texts[status] || status;
  },

  /**
   * Input render (CodeNomad Style with header)
   * @param {object} input
   * @returns {string}
   */
  _renderInput(input: unknown) {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
    return `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-label">INPUT</span>
        </div>
        <div class="tool-input">${this._escapeHtml(inputStr)}</div>
      </div>
    `;
  },

  /**
   * Output render (CodeNomad Style with header and Copy button)
   * @param {string} output
   * @returns {string}
   */
  _renderOutput(output: string) {
    return `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-label">OUTPUT</span>
          <button class="tool-section-copy" onclick="ToolRenderer._copySection(this)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
        <div class="tool-output" data-raw-content="${this._escapeHtml(output)}">
          ${this._parseAnsi(this._escapeHtml(output))}
        </div>
      </div>
    `;
  },
  
  /**
   * Copy section content
   * @param {HTMLElement} btn
   */
  _copySection(btn: HTMLElement) {
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
   * Error render
   * @param {string} error
   * @returns {string}
   */
  _renderError(error: string) {
    return `
      <div class="tool-section">
        <span class="tool-section-label">Hata</span>
        <div class="tool-error">${this._escapeHtml(error)}</div>
      </div>
    `;
  },

  /**
   * ANSI renk kodlarını HTML'e çevir
   * Enhanced parser with 256 color, bright colors, decorations support
   * Adapted from CodeNomad's ansi.ts
   * @param {string} text
   * @returns {string}
   */
  _parseAnsi(text: string) {
    // Normalize literal escape sequences
    const normalized = text
      .replace(/\\u001b/gi, '\u001b')
      .replace(/\\x1b/gi, '\u001b')
      .replace(/\\033/g, '\u001b');

    // If no ANSI codes, return as-is
    // eslint-disable-next-line no-control-regex
    if (!/\u001b/.test(normalized)) {
      return text;
    }

    // Parse ANSI sequences
    const result: string[] = [];
    const currentStyles: Record<string, string | boolean | null> = {
      fg: null,
      bg: null,
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      strikethrough: false,
      reverse: false,
    };

    // Split by ANSI escape sequences
    // eslint-disable-next-line no-control-regex
    const parts = normalized.split(/(\u001b\[[0-9;]*m)/);

    for (const part of parts) {
      if (!part) continue;

      // Check if this is an ANSI sequence
      // eslint-disable-next-line no-control-regex
      const match = part.match(/^\u001b\[([0-9;]*)m$/);
      if (match) {
        const codesStr = match[1];
        if (codesStr !== undefined) {
          const codes = codesStr.split(';').map((c: string) => parseInt(c, 10) || 0);
          this._applyAnsiCodes(codes, currentStyles);
        }
      } else {
        // Regular text - apply current styles
        const styledText = this._applyStylesToText(part, currentStyles);
        result.push(styledText);
      }
    }

    return result.join('');
  },

  /**
   * Apply ANSI codes to current style state
   * @param {number[]} codes
   * @param {object} styles
   */
  _applyAnsiCodes(codes: number[], styles: Record<string, string | boolean | null>) {
    let i = 0;
    while (i < codes.length) {
      const code = codes[i];

      switch (code) {
        case 0: // Reset
          styles.fg = null;
          styles.bg = null;
          styles.bold = false;
          styles.dim = false;
          styles.italic = false;
          styles.underline = false;
          styles.strikethrough = false;
          styles.reverse = false;
          break;
        case 1: styles.bold = true; break;
        case 2: styles.dim = true; break;
        case 3: styles.italic = true; break;
        case 4: styles.underline = true; break;
        case 7: styles.reverse = true; break;
        case 9: styles.strikethrough = true; break;
        case 22: styles.bold = false; styles.dim = false; break;
        case 23: styles.italic = false; break;
        case 24: styles.underline = false; break;
        case 27: styles.reverse = false; break;
        case 29: styles.strikethrough = false; break;

        // Standard foreground colors (30-37)
        case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
          styles.fg = this._getAnsiColor(code);
          break;
        case 39: styles.fg = null; break; // Default fg

        // Standard background colors (40-47)
        case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
          styles.bg = this._getAnsiColor(code - 10); // Map 40-47 to 30-37
          break;
        case 49: styles.bg = null; break; // Default bg

        // Bright foreground colors (90-97)
        case 90: case 91: case 92: case 93: case 94: case 95: case 96: case 97:
          styles.fg = this._getAnsiColor(code);
          break;

        // Bright background colors (100-107)
        case 100: case 101: case 102: case 103: case 104: case 105: case 106: case 107:
          styles.bg = this._getAnsiColor(code - 10); // Map 100-107 to 90-97
          break;
        case 38:
          if (codes[i + 1] === 5) {
            const colorCode = codes[i + 2];
            if (colorCode !== undefined) {
              const color = this._get256Color(colorCode);
              if (color) styles.fg = color.toString();
              i += 2;
            }
          }
          break;
        case 48:
          if (codes[i + 1] === 5) {
            const colorCode = codes[i + 2];
            if (colorCode !== undefined) {
              const color = this._get256Color(colorCode);
              if (color) styles.bg = color.toString();
              i += 2;
            }
          }
          break;
      }
      i++;
    }
  },

  /**
   * Get ANSI color from config or fallback
   * @param {number} code - ANSI color code (30-37, 90-97)
   * @returns {string}
   */
  _getAnsiColor(code: number) {
    // Try config first
    if (typeof window.OpenCodeConfig !== 'undefined') {
      const color = window.OpenCodeConfig?.getAnsiColor(code);
      if (color) return color;
    }
    // Fallback to built-in defaults
    return this._defaultAnsiColors[code] || '#e5e5e5';
  },

  /** @type {Object<number, string>} Default ANSI colors */
  _defaultAnsiColors: {
    30: '#000000', 31: '#cd3131', 32: '#0dbc79', 33: '#e5e510',
    34: '#2472c8', 35: '#bc3fbc', 36: '#11a8cd', 37: '#e5e5e5',
    90: '#666666', 91: '#f14c4c', 92: '#23d18b', 93: '#f5f543',
    94: '#3b8eea', 95: '#d670d6', 96: '#29b8db', 97: '#ffffff',
  } as Record<number, string>,

  /**
   * Convert 256 color index to hex
   * @param {number} n
   * @returns {string}
   */
  _get256Color(n: number) {
    // Standard colors (0-15) - use _getAnsiColor for consistency
    if (n < 8) return this._getAnsiColor(30 + n);
    if (n < 16) return this._getAnsiColor(90 + (n - 8));

    // Legacy standard array for any edge cases
    const standard = [
      '#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
      '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff',
    ];
    if (n < 16) return standard[n];

    // 216 color cube (16-231)
    if (n < 232) {
      const index = n - 16;
      const r = Math.floor(index / 36);
      const g = Math.floor((index % 36) / 6);
      const b = index % 6;
      const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Grayscale (232-255)
    const gray = 8 + (n - 232) * 10;
    const hex = gray.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  },

  /**
   * Apply styles to text
   * @param {string} text
   * @param {object} styles
   * @returns {string}
   */
  _applyStylesToText(text: string, styles: Record<string, string | boolean | null>) {
    const cssStyles: string[] = [];
    let fg = styles.fg;
    let bg = styles.bg;

    // Handle reverse video
    if (styles.reverse) {
      [fg, bg] = [bg, fg];
    }

    if (fg) cssStyles.push(`color: ${fg}`);
    if (bg) cssStyles.push(`background-color: ${bg}`);
    if (styles.bold) cssStyles.push('font-weight: 600');
    if (styles.dim) cssStyles.push('opacity: 0.7');
    if (styles.italic) cssStyles.push('font-style: italic');

    const textDecorations: string[] = [];
    if (styles.underline) textDecorations.push('underline');
    if (styles.strikethrough) textDecorations.push('line-through');
    if (textDecorations.length > 0) {
      cssStyles.push(`text-decoration: ${textDecorations.join(' ')}`);
    }

    if (cssStyles.length === 0) {
      return text;
    }

    return `<span style="${cssStyles.join('; ')}">${text}</span>`;
  },

  /**
   * HTML escape
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // =========================================================================
  // Inline Permission Approval (FAZ 4)
  // =========================================================================

  /**
   * Tool card'a inline permission approval ekle
   * @param {string} toolId - Tool ID
   * @param {object} permission - Permission bilgisi
   * @param {string} permission.permissionId - Permission ID
   * @param {string} permission.description - Açıklama
   * @param {'low' | 'medium' | 'high'} permission.risk - Risk seviyesi
   */
  addInlinePermission(toolId: string, permission: { permissionId: string; description: string; risk?: 'low' | 'medium' | 'high' }) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const body = element.querySelector('.tool-body');
    if (!body) return;

    // Mevcut permission varsa kaldır
    const existing = body.querySelector('.tool-permission');
    if (existing) existing.remove();

    const riskClass = permission.risk === 'high' ? 'danger' : permission.risk === 'medium' ? 'warning' : 'info';
    const riskText = permission.risk === 'high' ? 'Yüksek Risk' : permission.risk === 'medium' ? 'Orta Risk' : 'Düşük Risk';

    const permissionHtml = `
      <div class="tool-permission" data-permission-id="${permission.permissionId}">
        <div class="tool-permission-header">
          <span class="tool-permission-icon">⚠️</span>
          <span class="tool-permission-title">Onay Gerekiyor</span>
          <span class="tool-permission-risk ${riskClass}">${riskText}</span>
        </div>
        <div class="tool-permission-description">${this._escapeHtml(permission.description)}</div>
        <div class="tool-permission-actions">
          <button class="btn btn-success btn-sm" onclick="ToolRenderer._handlePermissionApprove('${toolId}', '${permission.permissionId}')">
            <span class="kbd-hint">A</span> Onayla
          </button>
          <button class="btn btn-danger btn-sm" onclick="ToolRenderer._handlePermissionDeny('${toolId}', '${permission.permissionId}')">
            <span class="kbd-hint">D</span> Reddet
          </button>
          <label class="tool-permission-auto">
            <input type="checkbox" id="auto-approve-${toolId}">
            <span>Bu oturumda otomatik onayla</span>
          </label>
        </div>
      </div>
    `;

    body.insertAdjacentHTML('afterbegin', permissionHtml);

    // Keyboard shortcuts
    this._setupPermissionKeyboard(toolId, permission.permissionId);
  },

  /**
   * Permission keyboard shortcuts
   * @param {string} toolId
   * @param {string} permissionId
   */
  _setupPermissionKeyboard(toolId: string, permissionId: string) {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this._handlePermissionApprove(toolId, permissionId);
        document.removeEventListener('keydown', handler);
      } else if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this._handlePermissionDeny(toolId, permissionId);
        document.removeEventListener('keydown', handler);
      }
    };
    document.addEventListener('keydown', handler);

    // Store handler reference for cleanup
    this._permissionHandlers = this._permissionHandlers || new Map();
    this._permissionHandlers.set(toolId, handler as unknown as (result: boolean) => void);
  },

  /**
   * Permission onay handler
   * @param {string} toolId
   * @param {string} permissionId
   */
  async _handlePermissionApprove(toolId: string, permissionId: string) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    // Auto-approve checkbox kontrolü
    const autoApprove = (element.querySelector(`#auto-approve-${toolId}`) as HTMLInputElement | null)?.checked || false;
    if (autoApprove) {
      // Session'da bu tool için auto-approve kaydet
      this._autoApprovedTools = this._autoApprovedTools || new Set();
      const toolName = element.querySelector('.tool-name-badge')?.textContent;
      if (toolName) this._autoApprovedTools.add(toolName);
    }

    // Permission UI'yı kaldır
    this._removePermissionUI(toolId);

    // API'ye gönder
    if (typeof APIClient !== 'undefined' && APIClient?.respondToPermission) {
      try {
        await APIClient.respondToPermission(permissionId, true);
      } catch (err) {
        console.error('[ToolRenderer] Permission approve failed:', err);
      }
    }
  },

  /**
   * Permission reddet handler
   * @param {string} toolId
   * @param {string} permissionId
   */
  async _handlePermissionDeny(toolId: string, permissionId: string) {
    // Permission UI'yı kaldır
    this._removePermissionUI(toolId);

    // API'ye gönder
    if (typeof APIClient !== 'undefined' && APIClient?.respondToPermission) {
      try {
        await APIClient.respondToPermission(permissionId, false);
      } catch (err) {
        console.error('[ToolRenderer] Permission deny failed:', err);
      }
    }
  },

  /**
   * Permission UI'yı kaldır
   * @param {string} toolId
   */
  _removePermissionUI(toolId: string) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const permissionEl = element.querySelector('.tool-permission');
    if (permissionEl) {
      permissionEl.remove();
    }

    // Keyboard handler'u temizle
    if (this._permissionHandlers?.has(toolId)) {
      const handler = this._permissionHandlers.get(toolId);
      if (handler) document.removeEventListener('keydown', handler as unknown as EventListener);
      this._permissionHandlers.delete(toolId);
    }
  },

  // =========================================================================
  // Inline Question Support (FAZ 4)
  // =========================================================================

  /**
   * Tool card'a inline question ekle
   * @param {string} toolId - Tool ID
   * @param {object} question - Question bilgisi
   * @param {string} question.questionId - Question ID
   * @param {string} question.text - Soru metni
   * @param {'text' | 'select' | 'confirm'} question.type - Soru tipi
   * @param {Array<{label: string, value: string}>} [question.options] - Seçenekler
   * @param {string} [question.default] - Default değer
   */
  addInlineQuestion(toolId: string, question: { questionId: string; text: string; type: 'text' | 'select' | 'confirm'; options?: Array<{label: string; value: string}>; default?: string }) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const body = element.querySelector('.tool-body');
    if (!body) return;

    // Mevcut question varsa kaldır
    const existing = body.querySelector('.tool-question');
    if (existing) existing.remove();

    let inputHtml = '';
    
    if (question.type === 'select' && question.options?.length) {
      inputHtml = `
        <div class="tool-question-options">
          ${question.options.map((opt: {label: string; value: string}, i: number) => `
            <label class="tool-question-option">
              <input type="radio" name="q-${question.questionId}" value="${this._escapeHtml(opt.value)}" ${i === 0 ? 'checked' : ''}>
              <span>${this._escapeHtml(opt.label)}</span>
            </label>
          `).join('')}
        </div>
      `;
    } else if (question.type === 'confirm') {
      inputHtml = `
        <div class="tool-question-confirm">
          <button class="btn btn-success btn-sm" onclick="ToolRenderer._handleQuestionAnswer('${toolId}', '${question.questionId}', 'yes')">
            <span class="kbd-hint">Y</span> Evet
          </button>
          <button class="btn btn-danger btn-sm" onclick="ToolRenderer._handleQuestionAnswer('${toolId}', '${question.questionId}', 'no')">
            <span class="kbd-hint">N</span> Hayır
          </button>
        </div>
      `;
    } else {
      inputHtml = `
        <input type="text" class="tool-question-input" 
               placeholder="Cevabınızı yazın..." 
               value="${this._escapeHtml(question.default || '')}"
               onkeydown="if(event.key==='Enter') ToolRenderer._submitQuestionInput('${toolId}', '${question.questionId}', this)">
      `;
    }

    const questionHtml = `
      <div class="tool-question" data-question-id="${question.questionId}">
        <div class="tool-question-header">
          <span class="tool-question-icon">❓</span>
          <span class="tool-question-title">Soru</span>
        </div>
        <div class="tool-question-text">${this._escapeHtml(question.text)}</div>
        ${inputHtml}
        ${question.type !== 'confirm' ? `
          <div class="tool-question-actions">
            <button class="btn btn-primary btn-sm" onclick="ToolRenderer._submitQuestionFromButton('${toolId}', '${question.questionId}')">
              <span class="kbd-hint">Enter</span> Gönder
            </button>
          </div>
        ` : ''}
      </div>
    `;

    body.insertAdjacentHTML('afterbegin', questionHtml);

    // Focus input if text type
    if (question.type === 'text') {
      const input = body.querySelector('.tool-question-input') as HTMLInputElement | null;
      if (input) setTimeout(() => input.focus(), 100);
    }

    // Keyboard shortcuts for confirm
    if (question.type === 'confirm') {
      this._setupQuestionKeyboard(toolId, question.questionId);
    }
  },

  /**
   * Question keyboard shortcuts (Y/N for confirm)
   * @param {string} toolId
   * @param {string} questionId
   */
  _setupQuestionKeyboard(toolId: string, questionId: string) {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'y' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this._handleQuestionAnswer(toolId, questionId, 'yes');
        document.removeEventListener('keydown', handler);
      } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this._handleQuestionAnswer(toolId, questionId, 'no');
        document.removeEventListener('keydown', handler);
      }
    };
    document.addEventListener('keydown', handler);

    this._questionHandlers = this._questionHandlers || new Map();
    this._questionHandlers.set(toolId, handler as unknown as (answer: string) => void);
  },

  /**
   * Submit question from input field
   * @param {string} toolId
   * @param {string} questionId
   * @param {HTMLInputElement} input
   */
  _submitQuestionInput(toolId: string, questionId: string, input: HTMLInputElement) {
    const answer = input.value.trim();
    if (answer) {
      this._handleQuestionAnswer(toolId, questionId, answer);
    }
  },

  /**
   * Submit question from button (reads input or selected option)
   * @param {string} toolId
   * @param {string} questionId
   */
  _submitQuestionFromButton(toolId: string, questionId: string) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const questionEl = element.querySelector('.tool-question');
    if (!questionEl) return;

    // Check for text input
    const textInput = questionEl.querySelector('.tool-question-input') as HTMLInputElement | null;
    if (textInput) {
      const answer = textInput.value.trim();
      if (answer) {
        this._handleQuestionAnswer(toolId, questionId, answer);
      }
      return;
    }

    // Check for radio selection
    const selectedRadio = questionEl.querySelector('input[type="radio"]:checked') as HTMLInputElement | null;
    if (selectedRadio) {
      this._handleQuestionAnswer(toolId, questionId, selectedRadio.value);
    }
  },

  /**
   * Handle question answer
   * @param {string} toolId
   * @param {string} questionId
   * @param {string} answer
   */
  async _handleQuestionAnswer(toolId: string, questionId: string, answer: string) {
    // Remove question UI
    this._removeQuestionUI(toolId);

    // Send to API
    if (typeof APIClient !== 'undefined' && APIClient?.respondToQuestion) {
      try {
        await APIClient.respondToQuestion(questionId, answer);
      } catch (err) {
        console.error('[ToolRenderer] Question answer failed:', err);
      }
    }

    // Remove from store
    if (typeof MessageStore !== 'undefined' && MessageStore?.removeQuestion) {
      MessageStore.removeQuestion(questionId);
    }
  },

  /**
   * Question UI'yı kaldır
   * @param {string} toolId
   */
  _removeQuestionUI(toolId: string) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const questionEl = element.querySelector('.tool-question');
    if (questionEl) {
      questionEl.remove();
    }

    // Keyboard handler'ı temizle
    if (this._questionHandlers?.has(toolId)) {
      const handler = this._questionHandlers.get(toolId);
      if (handler) document.removeEventListener('keydown', handler as unknown as EventListener);
      this._questionHandlers.delete(toolId);
    }
  },

  // =========================================================================
  // Diff Viewer (FAZ 4 - file_write tool için)
  // =========================================================================

  /**
   * Tool card'a diff viewer ekle
   * @param {string} toolId - Tool ID
   * @param {object} diff - Diff bilgisi
   * @param {string} diff.filename - Dosya adı
   * @param {string} diff.oldContent - Eski içerik
   * @param {string} diff.newContent - Yeni içerik
   * @param {string} [diff.unifiedDiff] - Unified diff formatı (opsiyonel)
   */
  addDiffViewer(toolId: string, diff: { filename?: string; oldContent?: string; newContent?: string; unifiedDiff?: string }) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const outputContainer = element.querySelector('.tool-output-container');
    if (!outputContainer) return;

    // Mevcut diff varsa kaldır
    const existing = outputContainer.querySelector('.diff-viewer');
    if (existing) existing.remove();

    const lines = diff.unifiedDiff 
      ? this._parseUnifiedDiff(diff.unifiedDiff)
      : this._generateDiff(diff.oldContent || '', diff.newContent || '');

    const diffHtml = `
      <div class="diff-viewer">
        <div class="diff-header">
          <span class="diff-filename">📄 ${this._escapeHtml(diff.filename || 'unknown')}</span>
          <div class="diff-actions">
            <button class="btn btn-sm" onclick="ToolRenderer._toggleDiffView('${toolId}')" title="View mode">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button class="btn btn-sm" onclick="ToolRenderer._copyDiff('${toolId}')" title="Copy diff">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="diff-content" data-raw-diff="${this._escapeHtml(diff.unifiedDiff || '')}">
          ${lines.map((line, i) => this._renderDiffLine(line, i)).join('')}
        </div>
      </div>
    `;

    outputContainer.insertAdjacentHTML('beforeend', diffHtml);
  },

  /**
   * Unified diff parse et
   * @param {string} unifiedDiff
   * @returns {Array<{type: 'added' | 'removed' | 'context', content: string, lineNumber: number}>}
   */
  _parseUnifiedDiff(unifiedDiff: string) {
    const lines = unifiedDiff.split('\n');
    const result: Array<{ type: string; content: string; lineNumber: number }> = [];
    let lineNumber = 0;

    for (const line of lines) {
      // Skip diff headers
      if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
        continue;
      }

      if (line.startsWith('+')) {
        result.push({ type: 'added', content: line.slice(1), lineNumber: ++lineNumber });
      } else if (line.startsWith('-')) {
        result.push({ type: 'removed', content: line.slice(1), lineNumber });
      } else {
        result.push({ type: 'context', content: line.slice(1) || line, lineNumber: ++lineNumber });
      }
    }

    return result;
  },

  /**
   * Basit diff üret (line-by-line karşılaştırma)
   * @param {string} oldContent
   * @param {string} newContent
   * @returns {Array<{type: 'added' | 'removed' | 'context', content: string, lineNumber: number}>}
   */
  _generateDiff(oldContent: string, newContent: string) {
    const oldLines = (oldContent || '').split('\n');
    const newLines = (newContent || '').split('\n');
    const result: Array<{ type: string; content: string; lineNumber: number }> = [];

    // Basit LCS-based diff (satır bazında)
    let lineNumber = 0;
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        result.push({ type: 'context', content: newLine || '', lineNumber: ++lineNumber });
      } else {
        if (oldLine !== undefined) {
          result.push({ type: 'removed', content: oldLine, lineNumber });
        }
        if (newLine !== undefined) {
          result.push({ type: 'added', content: newLine, lineNumber: ++lineNumber });
        }
      }
    }

    return result;
  },

  /**
   * Diff satırı render et
   * @param {{type: string, content: string, lineNumber: number}} line
   * @returns {string}
   */
  _renderDiffLine(line: { type: string; content: string; lineNumber: number }, _index?: number) {
    return `
      <div class="diff-line ${line.type}">
        <span class="diff-line-number">${line.lineNumber || ''}</span>
        <span class="diff-line-content">${this._escapeHtml(line.content)}</span>
      </div>
    `;
  },

  /**
   * Diff view toggle (unified/split)
   * @param {string} toolId
   */
  _toggleDiffView(toolId: string) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const diffViewer = element.querySelector('.diff-viewer');
    if (diffViewer) {
      diffViewer.classList.toggle('split-view');
    }
  },

  /**
   * Diff kopyala
   * @param {string} toolId
   */
  _copyDiff(toolId: string) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const diffContent = element.querySelector('.diff-content');
    const rawDiff = diffContent?.getAttribute('data-raw-diff') || diffContent?.textContent || '';

    navigator.clipboard.writeText(rawDiff).then(() => {
      console.log('[ToolRenderer] Diff copied');
    }).catch(err => {
      console.error('[ToolRenderer] Diff copy failed:', err);
    });
  },

  // =========================================================================
  // Execution Time (FAZ 4)
  // =========================================================================

  /**
   * Tool card'a execution time badge ekle
   * @param {string} toolId
   * @param {number} startedAt - Başlangıç timestamp
   * @param {number} [completedAt] - Bitiş timestamp (opsiyonel, running ise null)
   */
  updateExecutionTime(toolId: string, startedAt: number, completedAt?: number) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    const header = element.querySelector('.tool-header');
    if (!header) return;

    // Mevcut time badge'i bul veya oluştur
    let timeBadge = header.querySelector('.tool-time');
    if (!timeBadge) {
      timeBadge = document.createElement('span');
      timeBadge.className = 'tool-time';
      const statusEl = header.querySelector('.tool-status');
      if (statusEl) {
        statusEl.insertAdjacentElement('beforebegin', timeBadge);
      }
    }

    if (completedAt) {
      const duration = completedAt - startedAt;
      timeBadge.textContent = this._formatDuration(duration);
      timeBadge.classList.remove('running');
    } else {
      // Running - canlı güncelleme
      timeBadge.classList.add('running');
      this._startLiveTimer(toolId, startedAt, timeBadge as HTMLElement);
    }
  },

  /**
   * Canlı timer başlat
   * @param {string} toolId
   * @param {number} startedAt
   * @param {HTMLElement} badge
   */
  _startLiveTimer(toolId: string, startedAt: number, badge: HTMLElement) {
    // Mevcut timer'u temizle
    if (this._liveTimers?.has(toolId)) {
      clearInterval(this._liveTimers.get(toolId));
    }

    this._liveTimers = this._liveTimers || new Map();

    const update = () => {
      const duration = Date.now() - startedAt;
      badge.textContent = this._formatDuration(duration);
    };

    update();
    const intervalId = setInterval(update, 100);
    this._liveTimers.set(toolId, intervalId);
  },

  /**
   * Süre formatla
   * @param {number} ms - Milisaniye
   * @returns {string}
   */
  _formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
};

// ES6 Export
export { ToolRenderer };

// Global export (backward compatibility)
(window as any).ToolRenderer = ToolRenderer;
