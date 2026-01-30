/**
 * OpenCode UI - Bash Tool Renderer
 * 
 * Shell/bash komutları için özel renderer.
 * ANSI renk desteği ve streaming output gösterimi.
 */

interface BashInput {
  command?: string;
  cmd?: string;
  cwd?: string;
  workingDir?: string;
  timeout?: number;
}

interface BashToolCall {
  status?: string;
  error?: string;
  exitCode?: number;
  output?: string;
  [key: string]: unknown;
}

const BashRenderer = {
    name: 'bash',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 17 10 11 4 5"></polyline>
      <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>`,
    label: 'Shell Command',

    /**
     * Custom input renderer - komut gösterimi
     * @param {object} input
     * @returns {string}
     */
    renderInput(input: unknown) {
      if (!input) return '';
      
      const inputObj = typeof input === 'string' ? { command: input } : (input as BashInput);
      const command = inputObj.command || inputObj.cmd || '';
      const cwd = inputObj.cwd || inputObj.workingDir;
      const timeout = inputObj.timeout;
      
      let metaHtml = '';
      if (cwd || timeout) {
        const parts: string[] = [];
        if (cwd) parts.push(`cwd: ${cwd}`);
        if (timeout) parts.push(`timeout: ${timeout}s`);
        metaHtml = `<span class="tool-command-meta">${parts.join(' • ')}</span>`;
      }
      
      return `
        <div class="tool-command-header">
          <span class="tool-command-prompt">$</span>
          <span class="tool-command-text">${this._escapeHtml(command)}</span>
          ${metaHtml}
        </div>
      `;
    },

    /**
     * Custom output renderer - terminal style output
     * @param {string} output
     * @param {object} toolCall
     * @returns {string}
     */
    renderOutput(output: string, toolCall: unknown) {
      const call = toolCall as BashToolCall;
      if (!output && !call.error) return '';
      
      const hasError = call.status === 'error' || call.error;
      const exitCode = call.exitCode ?? (hasError ? 1 : 0);
      
      // Parse ANSI codes
      const parsedOutput = (typeof window.ToolRenderer !== 'undefined' && window.ToolRenderer._parseAnsi) 
        ? window.ToolRenderer._parseAnsi(this._escapeHtml(output || ''))
        : this._escapeHtml(output || '');
      
      return `
        <div class="tool-section">
          <div class="tool-section-header">
            <span class="tool-section-label">OUTPUT</span>
            <span class="tool-section-meta">
              <span class="exit-code ${exitCode === 0 ? 'success' : 'error'}">exit ${exitCode}</span>
            </span>
            <button class="tool-section-copy" onclick="ToolRendererRegistry._copyToClipboard(this)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
          </div>
          <div class="tool-terminal-output" data-raw-content="${this._escapeHtml(output || '')}">
            ${parsedOutput || '<span class="empty-output">(no output)</span>'}
          </div>
          ${call.error ? `
            <div class="tool-error-output">
              <span class="error-label">⚠️ Error:</span>
              <span class="error-text">${this._escapeHtml(call.error)}</span>
            </div>
          ` : ''}
        </div>
      `;
    },

    /**
     * Auto-collapse logic
     * @param {object} toolCall
     * @returns {boolean}
     */
    shouldAutoCollapse(toolCall: unknown) {
      const call = toolCall as BashToolCall;
      // Don't auto-collapse errors
      if (call.status === 'error') return false;
      
      // Auto-collapse successful commands with long output
      const output = call.output || '';
      const lines = output.split('\n').length;
      return lines > 30;
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

  // Register with registry
  if (typeof window.ToolRendererRegistry !== 'undefined') {
    window.ToolRendererRegistry.register?.('bash', BashRenderer);
    window.ToolRendererRegistry.register?.('shell', BashRenderer);
    window.ToolRendererRegistry.register?.('execute', BashRenderer);
    window.ToolRendererRegistry.register?.('run', BashRenderer);
    window.ToolRendererRegistry.register?.('command', BashRenderer);
  }

  // Global export (backward compatibility)
  window.BashRenderer = BashRenderer;
  
  // ES6 Export
export { BashRenderer };
