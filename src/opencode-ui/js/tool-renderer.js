/**
 * OpenCode UI - Tool Renderer
 * 
 * Tool call kartlarını render eder.
 * Expand/collapse, status gösterimi ve output rendering içerir.
 */

const ToolRenderer = {
  /** @type {Map<string, HTMLElement>} */
  _toolElements: new Map(),

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Tool call kartı oluştur
   * @param {object} toolCall
   * @param {string} toolCall.toolId - Tool ID
   * @param {string} toolCall.toolName - Tool adı
   * @param {'pending' | 'running' | 'success' | 'error'} toolCall.status - Durum
   * @param {object} [toolCall.input] - Input parametreleri
   * @param {string} [toolCall.output] - Output
   * @param {string} [toolCall.error] - Hata mesajı
   * @returns {HTMLElement}
   */
  createToolCard(toolCall) {
    const div = document.createElement('div');
    div.className = `tool-card ${toolCall.status}`;
    div.setAttribute('data-tool-id', toolCall.toolId);

    div.innerHTML = `
      <div class="tool-header" onclick="ToolRenderer.toggleCollapse('${toolCall.toolId}')">
        <div class="tool-icon">
          ${this._getStatusIcon(toolCall.status)}
        </div>
        <span class="tool-name">${this._escapeHtml(toolCall.toolName)}</span>
        <span class="tool-status">${this._getStatusText(toolCall.status)}</span>
        <div class="tool-toggle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      <div class="tool-body">
        ${toolCall.input ? this._renderInput(toolCall.input) : ''}
        <div class="tool-output-container">
          ${toolCall.output ? this._renderOutput(toolCall.output) : ''}
          ${toolCall.error ? this._renderError(toolCall.error) : ''}
        </div>
      </div>
    `;

    this._toolElements.set(toolCall.toolId, div);
    return div;
  },

  /**
   * Tool card güncelle
   * @param {string} toolId - Tool ID
   * @param {object} update - Güncelleme
   */
  updateToolCard(toolId, update) {
    const element = this._toolElements.get(toolId);
    if (!element) return;

    // Status güncelle
    if (update.status) {
      element.className = `tool-card ${update.status}`;
      
      const icon = element.querySelector('.tool-icon');
      if (icon) {
        icon.innerHTML = this._getStatusIcon(update.status);
      }

      const statusText = element.querySelector('.tool-status');
      if (statusText) {
        statusText.textContent = this._getStatusText(update.status);
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
  appendOutput(toolId, delta) {
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
  toggleCollapse(toolId) {
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
  _getStatusIcon(status) {
    const icons = {
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
  _getStatusText(status) {
    const texts = {
      pending: 'Bekliyor',
      running: 'Çalışıyor',
      success: 'Tamamlandı',
      error: 'Hata',
    };
    return texts[status] || status;
  },

  /**
   * Input render
   * @param {object} input
   * @returns {string}
   */
  _renderInput(input) {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
    return `
      <div class="tool-section">
        <span class="tool-section-label">Input</span>
        <div class="tool-input">${this._escapeHtml(inputStr)}</div>
      </div>
    `;
  },

  /**
   * Output render
   * @param {string} output
   * @returns {string}
   */
  _renderOutput(output) {
    return `
      <div class="tool-section">
        <span class="tool-section-label">Output</span>
        <div class="tool-output" data-raw-content="${this._escapeHtml(output)}">
          ${this._parseAnsi(this._escapeHtml(output))}
        </div>
      </div>
    `;
  },

  /**
   * Error render
   * @param {string} error
   * @returns {string}
   */
  _renderError(error) {
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
  _parseAnsi(text) {
    // Normalize literal escape sequences
    let normalized = text
      .replace(/\\u001b/gi, '\u001b')
      .replace(/\\x1b/gi, '\u001b')
      .replace(/\\033/g, '\u001b');

    // If no ANSI codes, return as-is
    if (!/\u001b/.test(normalized)) {
      return text;
    }

    // Parse ANSI sequences
    const result = [];
    let currentStyles = {
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
    const parts = normalized.split(/(\u001b\[[0-9;]*m)/);

    for (const part of parts) {
      if (!part) continue;

      // Check if this is an ANSI sequence
      const match = part.match(/^\u001b\[([0-9;]*)m$/);
      if (match) {
        const codes = match[1].split(';').map(c => parseInt(c, 10) || 0);
        this._applyAnsiCodes(codes, currentStyles);
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
  _applyAnsiCodes(codes, styles) {
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
        case 30: styles.fg = '#000000'; break;
        case 31: styles.fg = '#cd3131'; break;
        case 32: styles.fg = '#0dbc79'; break;
        case 33: styles.fg = '#e5e510'; break;
        case 34: styles.fg = '#2472c8'; break;
        case 35: styles.fg = '#bc3fbc'; break;
        case 36: styles.fg = '#11a8cd'; break;
        case 37: styles.fg = '#e5e5e5'; break;
        case 39: styles.fg = null; break; // Default fg

        // Standard background colors (40-47)
        case 40: styles.bg = '#000000'; break;
        case 41: styles.bg = '#cd3131'; break;
        case 42: styles.bg = '#0dbc79'; break;
        case 43: styles.bg = '#e5e510'; break;
        case 44: styles.bg = '#2472c8'; break;
        case 45: styles.bg = '#bc3fbc'; break;
        case 46: styles.bg = '#11a8cd'; break;
        case 47: styles.bg = '#e5e5e5'; break;
        case 49: styles.bg = null; break; // Default bg

        // Bright foreground colors (90-97)
        case 90: styles.fg = '#666666'; break;
        case 91: styles.fg = '#f14c4c'; break;
        case 92: styles.fg = '#23d18b'; break;
        case 93: styles.fg = '#f5f543'; break;
        case 94: styles.fg = '#3b8eea'; break;
        case 95: styles.fg = '#d670d6'; break;
        case 96: styles.fg = '#29b8db'; break;
        case 97: styles.fg = '#ffffff'; break;

        // Bright background colors (100-107)
        case 100: styles.bg = '#666666'; break;
        case 101: styles.bg = '#f14c4c'; break;
        case 102: styles.bg = '#23d18b'; break;
        case 103: styles.bg = '#f5f543'; break;
        case 104: styles.bg = '#3b8eea'; break;
        case 105: styles.bg = '#d670d6'; break;
        case 106: styles.bg = '#29b8db'; break;
        case 107: styles.bg = '#ffffff'; break;

        // 256 color mode (38;5;n or 48;5;n)
        case 38:
          if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
            styles.fg = this._get256Color(codes[i + 2]);
            i += 2;
          }
          break;
        case 48:
          if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
            styles.bg = this._get256Color(codes[i + 2]);
            i += 2;
          }
          break;
      }
      i++;
    }
  },

  /**
   * Convert 256 color index to hex
   * @param {number} n
   * @returns {string}
   */
  _get256Color(n) {
    // Standard colors (0-15)
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
      const toHex = (v) => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, '0');
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
  _applyStylesToText(text, styles) {
    const cssStyles = [];
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

    const textDecorations = [];
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
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Global'e ekle
window.ToolRenderer = ToolRenderer;
