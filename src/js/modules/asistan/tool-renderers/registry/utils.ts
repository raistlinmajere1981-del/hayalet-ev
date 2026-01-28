/**
 * Utility Helpers
 * HTML escape, clipboard operations
 */

function escapeHtml(text: string): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(btn: HTMLElement) {
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
}

export { escapeHtml, copyToClipboard };
