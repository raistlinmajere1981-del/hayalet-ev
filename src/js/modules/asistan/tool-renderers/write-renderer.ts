/**
 * OpenCode UI - Write Tool Renderer
 * 
 * File yazma tool'u için özel renderer.
 * Diff viewer ile değişiklikleri gösterir.
 */

interface WriteInput {
  file_path?: string;
  path?: string;
  filePath?: string;
  content?: string;
  text?: string;
  create?: boolean;
  isNew?: boolean;
}

interface WriteToolCall {
  status?: string;
  output?: string;
  input?: WriteInput;
  [key: string]: unknown;
}

interface DiffLine {
  type: string;
  content: string;
  oldNum?: number;
  newNum?: number;
}

type WriteLangMapKey = 'js' | 'ts' | 'tsx' | 'jsx' | 'py' | 'rb' | 'go' | 'rs' | 'java' | 'json' | 'yaml' | 'yml' | 'md' | 'html' | 'css' | 'sh';
const WriteRenderer = {
  name: 'write',
  icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>`,
  label: 'Write File',
  /**
   * Custom input renderer - dosya yolu ve işlem tipi
   * @param {object} input
   * @returns {string}
   */
  renderInput(input: unknown) {
    if (!input) return '';

    const writeInput = input as WriteInput;
    const filePath = writeInput.file_path || writeInput.path || writeInput.filePath || '';
    const isCreate = writeInput.create || writeInput.isNew;
    const mode = isCreate ? 'Create' : 'Edit';
    const modeClass = isCreate ? 'create' : 'edit';

    return `
      <div class="tool-file-header">
        <span class="tool-file-icon">✏️</span>
        <span class="tool-file-path">${this._escapeHtml(filePath)}</span>
        <span class="tool-file-mode ${modeClass}">${mode}</span>
      </div>
    `;
  },

  /**
   * Custom output renderer - diff view
   * @param {string} output
   * @param {object} toolCall
   * @returns {string}
  renderOutput(output: string, toolCall: ToolCallData) {
    const call = toolCall as WriteToolCall;
    if (!output) return '';

    const hasDiff = output.includes('@@') || output.includes('+++') || output.includes('---');

    if (hasDiff) {
      return this._renderDiffOutput(output, call);
    }

    const content = call.input?.content || call.input?.text;
    if (content) {
      return this._renderNewContent(content, call);
    }

    return `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-label">RESULT</span>
        </div>
        <div class="tool-output">${this._escapeHtml(output)}</div>
      </div>
    `;
  },
    }
    
    // Default: show output as-is
    return `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-label">RESULT</span>
        </div>
        <div class="tool-output">${this._escapeHtml(output)}</div>
      </div>
    `;
  },

  /**
   * Render diff output
   * @param {string} output
   * @param {object} toolCall
   * @returns {string}
   */
  _renderDiffOutput(output: string, _toolCall: WriteToolCall) {
    const lines = this._parseDiff(output);
    const stats = this._calculateDiffStats(lines);
    
    return `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-label">CHANGES</span>
          <span class="tool-section-meta">
            <span class="diff-stat-added">+${stats.added}</span>
            <span class="diff-stat-removed">-${stats.removed}</span>
          </span>
          <button class="tool-section-toggle" onclick="WriteRenderer._toggleDiffMode(this)" title="Toggle view mode">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>
          <button class="tool-section-copy" onclick="ToolRendererRegistry._copyToClipboard(this)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
        <div class="tool-diff-output" data-raw-content="${this._escapeHtml(output)}">
          ${lines.map((line: DiffLine) => this._renderDiffLine(line)).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Render new file content
   * @param {string} content
   * @param {object} toolCall
   * @returns {string}
   */
  _renderNewContent(content: string, toolCall: WriteToolCall) {
    const lines = content.split('\n');
    const language = this._detectLanguage(toolCall.input?.file_path || '');
    
    return `
      <div class="tool-section">
        <div class="tool-section-header">
          <span class="tool-section-label">NEW CONTENT</span>
          <span class="tool-section-meta">${lines.length} lines • ${language}</span>
        </div>
        <div class="tool-code-output new-file">
          ${lines.map((line: string, i: number) => `
            <div class="code-line added">
              <span class="line-number">${i + 1}</span>
              <span class="line-content">${this._escapeHtml(line) || ' '}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Parse diff output into structured lines
   * @param {string} diff
   * @returns {Array<{type: string, content: string, oldNum?: number, newNum?: number}>}
   */
  _parseDiff(diff: string): DiffLine[] {
    const lines = diff.split('\n');
    const result: DiffLine[] = [];
    let oldLine = 0;
    let newLine = 0;
    
    for (const line of lines) {
      // Skip diff headers
      if (line.startsWith('diff ') || line.startsWith('index ')) {
        continue;
      }
      
      // Hunk header
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        result.push({ type: 'hunk', content: line });
        continue;
      }
      
      // File headers
      if (line.startsWith('---') || line.startsWith('+++')) {
        result.push({ type: 'header', content: line });
        continue;
      }
      
      // Added line
      if (line.startsWith('+')) {
        result.push({ type: 'added', content: line.slice(1), newNum: newLine++ });
        continue;
      }
      
      // Removed line
      if (line.startsWith('-')) {
        result.push({ type: 'removed', content: line.slice(1), oldNum: oldLine++ });
        continue;
      }
      
      // Context line
      result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line, oldNum: oldLine++, newNum: newLine++ });
    }
    
    return result;
  },

  /**
   * Calculate diff statistics
   * @param {Array} lines
   * @returns {{added: number, removed: number}}
   */
  _calculateDiffStats(lines: DiffLine[]) {
    let added = 0;
    let removed = 0;
    
    for (const line of lines) {
      if (line.type === 'added') added++;
      else if (line.type === 'removed') removed++;
    }
    
    return { added, removed };
  },

  /**
   * Render a single diff line
   * @param {{type: string, content: string, oldNum?: number, newNum?: number}} line
   * @returns {string}
   */
  _renderDiffLine(line: DiffLine) {
    if (line.type === 'hunk') {
      return `<div class="diff-line hunk"><span class="diff-hunk-text">${this._escapeHtml(line.content)}</span></div>`;
    }
    
    if (line.type === 'header') {
      return `<div class="diff-line header">${this._escapeHtml(line.content)}</div>`;
    }
    
    const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
    const oldNum = line.oldNum !== undefined ? line.oldNum : '';
    const newNum = line.newNum !== undefined ? line.newNum : '';
    
    return `
      <div class="diff-line ${line.type}">
        <span class="diff-line-num old">${oldNum}</span>
        <span class="diff-line-num new">${newNum}</span>
        <span class="diff-line-prefix">${prefix}</span>
        <span class="diff-line-content">${this._escapeHtml(line.content)}</span>
      </div>
    `;
  },

  /**
   * Toggle diff view mode (unified/split)
   * @param {HTMLElement} btn
   */
  _toggleDiffMode(btn: HTMLElement) {
    const section = btn.closest('.tool-section');
    const diffOutput = section?.querySelector('.tool-diff-output');
    if (diffOutput) {
      diffOutput.classList.toggle('split-mode');
    }
  },

  /**
   * Detect language from file extension
   * @param {string} filePath
   * @returns {string}
   */
  _detectLanguage(filePath: string) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap = {
      'js': 'JavaScript', 'ts': 'TypeScript', 'tsx': 'TypeScript', 'jsx': 'JavaScript',
      'py': 'Python', 'rb': 'Ruby', 'go': 'Go', 'rs': 'Rust', 'java': 'Java',
      'json': 'JSON', 'yaml': 'YAML', 'yml': 'YAML', 'md': 'Markdown',
      'html': 'HTML', 'css': 'CSS', 'sh': 'Shell',
    };
    return langMap[ext as WriteLangMapKey] || ext.toUpperCase() || 'Text';
  },

  /**
   * HTML escape
   * @param {string} text
  shouldAutoCollapse(toolCall: ToolCallData) {
    const call = toolCall as WriteToolCall;
    return call.status === 'success';
  },
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Auto-collapse for successful writes
   */
  shouldAutoCollapse(toolCall: WriteToolCall) {
    return toolCall.status === 'success';
  },
};

// Register with registry
if (typeof window.ToolRendererRegistry !== 'undefined') {
  window.ToolRendererRegistry.register?.('write', WriteRenderer);
  window.ToolRendererRegistry.register?.('file_write', WriteRenderer);
  window.ToolRendererRegistry.register?.('writeFile', WriteRenderer);
  window.ToolRendererRegistry.register?.('edit', WriteRenderer);
}

// Global export (backward compatibility)
window.WriteRenderer = WriteRenderer;

