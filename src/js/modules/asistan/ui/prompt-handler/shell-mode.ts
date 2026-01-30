/**
 * Shell Mode Handler
 * Shell mode toggle, command execution
 */

async function executeCommand(commandName: string, clearInputFn: () => void) {
  clearInputFn();

  switch (commandName) {
    case 'clear':
      if (typeof window.MessageRenderer !== 'undefined') {
        (window.MessageRenderer as any)?.clear?.();
      }
      if (typeof window.StoreBridge !== 'undefined') {
        (window.StoreBridge as any)?.clear?.();
      }
      console.log('[PromptHandler] Chat cleared');
      break;

    case 'new':
      if (typeof window.OpenCodeApp !== 'undefined') {
        await (window.OpenCodeApp as any)?._handleNewSession?.();
      }
      break;

    case 'cancel':
      if (typeof window.APIClient !== 'undefined') {
        try {
          await (window.APIClient as any)?.cancel?.();
          console.log('[PromptHandler] Operation cancelled');
        } catch (err) {
          console.error('[PromptHandler] Cancel failed:', err);
        }
      }
      break;

    case 'help':
      if (typeof window.MessageRenderer !== 'undefined') {
        const helpContent = `## Kullanılabilir Komutlar

- **/clear** - Sohbeti temizle
- **/new** - Yeni oturum başlat
- **/cancel** - Mevcut işlemi iptal et
- **/compact** - Context'i sıkıştır
- **/retry** - Son mesajı tekrarla
- **/history** - Komut geçmişini göster

## Kısayollar

- **Ctrl+Enter** - Mesaj gönder
- **@** - Dosya/agent seç
- **/** - Komut çalıştır
- **!** - Shell modu
- **↑↓** - Geçmişte gezin`;
        (window.MessageRenderer as any)?.addMessage?.({
          id: `msg-help-${Date.now()}`,
          role: 'assistant',
          content: helpContent,
          timestamp: Date.now(),
        });
      }
      break;

    case 'compact':
      if (typeof window.APIClient !== 'undefined') {
        try {
          const result = (await (window.APIClient as any)?.compact?.()) as { compactedTokens?: number };
          console.log('[PromptHandler] Compact result:', result);
          if (result.compactedTokens) {
            if (typeof window.MessageRenderer !== 'undefined') {
              (window.MessageRenderer as any)?.addMessage?.({
                id: `msg-compact-${Date.now()}`,
                role: 'assistant',
                content: `✅ Context sıkıştırıldı. Kazanç: ${result.compactedTokens} token`,
                timestamp: Date.now(),
              });
            }
          }
        } catch (err) {
          console.error('[PromptHandler] Compact failed:', err);
        }
      }
      break;

    case 'retry':
      if (typeof window.APIClient !== 'undefined') {
        try {
          await (window.APIClient as any)?.retry?.();
          console.log('[PromptHandler] Retry initiated');
        } catch (err) {
          console.error('[PromptHandler] Retry failed:', err);
        }
      }
      break;

    case 'history':
      // Komut geçmişini göster (will be implemented by PromptHandler)
      break;

    default:
      console.log('[PromptHandler] Unknown command:', commandName);
  }
}

function toggleShellMode(enabled: boolean, inputEl: HTMLTextAreaElement | null) {
  const wrapper = inputEl?.closest('.prompt-input-wrapper');
  if (wrapper) {
    wrapper.classList.toggle('shell-mode', enabled);
  }

  if (inputEl) {
    inputEl.placeholder = enabled
      ? 'Shell komutu yazın... (Escape ile çık)'
      : 'Mesajınızı yazın... (Ctrl+Enter gönder)';
  }
}

export { executeCommand, toggleShellMode };
