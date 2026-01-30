/**
 * Default Renderers
 * Default input/output renderers with ANSI support
 */

function createDefaultRenderers(escapeHtmlFn: (text: string) => string) {
  return {
    /**
     * Default input renderer
     */
    defaultRenderInput(input: unknown) {
      if (!input) return '';

      const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);

      return `
        <div class="tool-section">
          <div class="tool-section-header">
            <span class="tool-section-label">INPUT</span>
          </div>
          <div class="tool-input"><pre>${escapeHtmlFn(inputStr)}</pre></div>
        </div>
      `;
    },

    /**
     * Default output renderer with ANSI support
     */
    defaultRenderOutput(output: string) {
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
          <div class="tool-output" data-raw-content="${escapeHtmlFn(output)}">
            ${
              window.ToolRenderer?._parseAnsi
                ? window.ToolRenderer._parseAnsi(escapeHtmlFn(output))
                : escapeHtmlFn(output)
            }
          </div>
        </div>
      `;
    },
  };
}

export { createDefaultRenderers };
