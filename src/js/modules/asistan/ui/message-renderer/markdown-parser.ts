/**
 * Markdown Parser & Renderer
 * Basit Markdown render (XSS sanitization ile)
 */

/**
 * Sanitize HTML output with DOMPurify
 */
function sanitizeHtml(html: string): string {
  // Use DOMPurify if available
  if (typeof window.DOMPurify !== 'undefined') {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'div', 'span', 'button'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'onclick'],
      ALLOW_DATA_ATTR: false,
    });
  }
  // Fallback - already escaped, return as-is
  return html;
}

/**
 * Sanitize URL to prevent javascript: and other XSS vectors
 */
function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  const trimmedUrl = url.trim().toLowerCase();
  // Block dangerous protocols
  if (trimmedUrl.startsWith('javascript:') ||
    trimmedUrl.startsWith('data:') ||
    trimmedUrl.startsWith('vbscript:')) {
    console.warn('[MessageRenderer] Blocked dangerous URL:', url);
    return null;
  }
  return url;
}

/**
 * HTML escape
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize language identifier for code blocks
 */
function sanitizeLanguage(lang: string): string {
  if (!lang) return '';
  // Only allow alphanumeric and common chars
  return lang.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Basit Markdown render (XSS sanitization ile)
 */
function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = escapeHtml(text);

  // Code blocks (```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = sanitizeLanguage(lang) || 'plaintext';
    return `
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-block-lang">${language}</span>
          <button class="code-block-copy" onclick="MessageRenderer._copyCode(this)">Kopyala</button>
        </div>
        <pre><code class="language-${language}">${code.trim()}</code></pre>
      </div>
    `;
  });

  // Inline code (`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold (**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic (*)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links [text](url) - with URL sanitization
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return text; // Invalid URL - just show text
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  // Paragraphs (double line breaks)
  html = html.replace(/<br><br>/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, '');

  // Final sanitization with DOMPurify (if available)
  return sanitizeHtml(html);
}

export { renderMarkdown, sanitizeHtml, sanitizeUrl, escapeHtml, sanitizeLanguage };
