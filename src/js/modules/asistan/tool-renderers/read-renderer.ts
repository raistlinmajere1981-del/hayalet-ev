/**
 * OpenCode UI - Read Tool Renderer
 * 
 * File okuma tool'u için özel renderer.
 * Syntax highlighting ve satır numaraları ile dosya içeriği gösterir.
 */

interface ReadInput {
  file_path?: string;
  path?: string;
  filePath?: string;
  start_line?: number;
  startLine?: number;
  end_line?: number;
  endLine?: number;
}

interface ReadToolCall {
  status?: string;
  output?: string;
  input?: ReadInput;
  [key: string]: unknown;
}

type LangMapKey = 'js' | 'ts' | 'tsx' | 'jsx' | 'py' | 'rb' | 'go' | 'rs' | 'java' | 'kt' | 'swift' | 'c' | 'cpp' | 'h' | 'cs' | 'php' | 'html' | 'css' | 'scss' | 'less' | 'json' | 'yaml' | 'yml' | 'xml' | 'md' | 'sql' | 'sh' | 'bash' | 'zsh' | 'ps1' | 'dockerfile' | 'toml' | 'ini' | 'env';

(() => {
  const ReadRenderer = {
    name: 'read',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>`,
    label: 'Read File',

    /**
     * Custom input renderer - dosya yolu ve satır aralığı göster
     * @param {object} input
     * @returns {string}
     */
    renderInput(input: unknown) {
      if (!input) return '';
      
      const readInput = input as ReadInput;
      const filePath = readInput.file_path || readInput.path || readInput.filePath || '';
      const startLine = readInput.start_line || readInput.startLine;
      const endLine = readInput.end_line || readInput.endLine;
      
      let rangeText = '';
      if (startLine !== undefined || endLine !== undefined) {
        rangeText = ` (lines ${startLine || 1}-${endLine || 'end'})`;
      }
      
      return `
        <div class="tool-file-header">
          <span class="tool-file-icon">📄</span>
          <span class="tool-file-path">${this._escapeHtml(filePath)}${rangeText}</span>
        </div>
      `;
    },

    /**
     * Custom output renderer - satır numaralı kod görünümü
     * @param {string} output
     * @param {object} toolCall
     * @returns {string}
     */
    renderOutput(output: string, toolCall: unknown) {
      const call = toolCall as ReadToolCall;
      if (!output) return '';
      
      const lines = output.split('\n');
      const startLine = call.input?.start_line || call.input?.startLine || 1;
      const language = this._detectLanguage(call.input?.file_path || call.input?.path || '');
      
      const lineNumberWidth = String(startLine + lines.length).length;
      
      const linesHtml = lines.map((line: string, i: number) => {
        const lineNum = startLine + i;
        const paddedNum = String(lineNum).padStart(lineNumberWidth, ' ');
        return `<div class="code-line">
          <span class="line-number">${paddedNum}</span>
          <span class="line-content">${this._escapeHtml(line) || ' '}</span>
        </div>`;
      }).join('');
      
      return `
        <div class="tool-section">
          <div class="tool-section-header">
            <span class="tool-section-label">CONTENT</span>
            <span class="tool-section-meta">${lines.length} lines • ${language}</span>
            <button class="tool-section-copy" onclick="ToolRendererRegistry._copyToClipboard(this)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
          </div>
          <div class="tool-code-output" data-raw-content="${this._escapeHtml(output)}" data-language="${language}">
            ${linesHtml}
          </div>
        </div>
      `;
    },

    /**
     * Auto-collapse for large files
     * @param {object} toolCall
     * @returns {boolean}
     */
    shouldAutoCollapse(toolCall: unknown) {
      const call = toolCall as ReadToolCall;
      const output = call.output || '';
      const lines = output.split('\n').length;
      return call.status === 'success' && lines > 50;
    },

    /**
     * Detect language from file extension
     * @param {string} filePath
     * @returns {string}
     */
    _detectLanguage(filePath: string) {
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const langMap = {
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'tsx': 'TypeScript',
        'jsx': 'JavaScript',
        'py': 'Python',
        'rb': 'Ruby',
        'go': 'Go',
        'rs': 'Rust',
        'java': 'Java',
        'kt': 'Kotlin',
        'swift': 'Swift',
        'c': 'C',
        'cpp': 'C++',
        'h': 'C Header',
        'cs': 'C#',
        'php': 'PHP',
        'html': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'less': 'LESS',
        'json': 'JSON',
        'yaml': 'YAML',
        'yml': 'YAML',
        'xml': 'XML',
        'md': 'Markdown',
        'sql': 'SQL',
        'sh': 'Shell',
        'bash': 'Bash',
        'zsh': 'Zsh',
        'ps1': 'PowerShell',
        'dockerfile': 'Dockerfile',
        'toml': 'TOML',
        'ini': 'INI',
        'env': 'Environment',
      };
      return langMap[ext as LangMapKey] || ext.toUpperCase() || 'Text';
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
    window.ToolRendererRegistry.register?.('read', ReadRenderer);
    window.ToolRendererRegistry.register?.('file_read', ReadRenderer);
    window.ToolRendererRegistry.register?.('readFile', ReadRenderer);
  }

  // Global export (backward compatibility)
  window.ReadRenderer = ReadRenderer;
  
  // ES6 Export
  export { ReadRenderer };
})();
