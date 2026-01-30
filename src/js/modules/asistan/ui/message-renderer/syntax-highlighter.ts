/**
 * Syntax Highlighting & Code Formatting
 */

/**
 * Kod kopyalama
 */
function copyCode(button: HTMLElement) {
  const codeBlock = button.closest('.code-block');
  const code = codeBlock?.querySelector('code')?.textContent || '';

  navigator.clipboard.writeText(code).then(() => {
    const originalText = button.textContent;
    button.textContent = 'Kopyalandı!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Kopyalama hatası:', err);
  });
}

/**
 * Streaming indicator HTML'i
 */
function createStreamingIndicator(): string {
  return `
    <span class="streaming-indicator">
      <span class="streaming-dot"></span>
      <span class="streaming-dot"></span>
      <span class="streaming-dot"></span>
    </span>
  `;
}

/**
 * Create status indicator HTML
 */
function createStatusIndicator(status?: string): string {
  if (!status || status === 'complete') return '';

  switch (status) {
    case 'sending':
      return `
        <span class="message-status status-sending" aria-busy="true" title="Gönderiliyor...">
          <span class="status-spinner"></span>
        </span>
      `;
    case 'sent':
      return `
        <span class="message-status status-sent" title="Gönderildi, yanıt bekleniyor...">
          <span class="status-icon">✓</span>
        </span>
      `;
    case 'streaming':
      return `
        <span class="message-status status-streaming" title="Yanıt alınıyor...">
          <span class="status-dot"></span>
        </span>
      `;
    case 'error':
      return `
        <span class="message-status status-error" role="alert" title="Gönderilemedi">
          <span class="status-icon">⚠️</span>
        </span>
      `;
    default:
      return '';
  }
}

export { copyCode, createStreamingIndicator, createStatusIndicator };
