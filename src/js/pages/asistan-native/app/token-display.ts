/**
 * Token Display & Status
 */

import type { AppContext } from './types';
export function setupTokenDisplay(context: AppContext) {
  return {
    subscribeToSessionStore() {
      if (typeof window.SessionStore === 'undefined') {
        console.warn('[OpenCode] SessionStore not available for token subscription');
        return;
      }

      window.SessionStore?.subscribe?.((event) => {
        if (event.type === 'session:changed' || event.type === 'session:usage:updated' || event.type === 'session:info:updated') {
          context._updateTokenDisplay();
        }
      });

      if (typeof window.MessageStore !== 'undefined') {
        window.MessageStore?.subscribe?.((event) => {
          if (event.type === 'part:updated' || event.type === 'message:updated') {
            if (context._tokenUpdateTimeout) {
              clearTimeout(context._tokenUpdateTimeout);
            }
            context._tokenUpdateTimeout = setTimeout(() => {
              context._updateTokenDisplay();
            }, 100);
          }
        });
      }

      context._updateTokenDisplay();
    },

    updateTokenDisplay() {
      const activeSession = typeof window.SessionStore !== 'undefined' ? window.SessionStore.getActiveSession?.() : null;

      if (!activeSession) {
        const container = document.getElementById('token-display');
        if (container) {
          container.innerHTML = '';
        }
        return;
      }

      const container = document.getElementById('token-display');
      if (!container) return;

      const usage = (activeSession)?.usage as { inputTokens?: number; outputTokens?: number } || {};
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;
      const totalTokens = inputTokens + outputTokens;

      container.innerHTML = `
        <div class="token-stat">
          <span class="label">Giriş:</span>
          <span class="value">${context._formatTokenCount(inputTokens)}</span>
        </div>
        <div class="token-stat">
          <span class="label">Çıkış:</span>
          <span class="value">${context._formatTokenCount(outputTokens)}</span>
        </div>
        <div class="token-stat total">
          <span class="label">Toplam:</span>
          <span class="value">${context._formatTokenCount(totalTokens)}</span>
        </div>
      `;
    },

    formatTokenCount(count: number): string {
      if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
      } else if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
      } else {
        return `${count}`;
      }
    },

    updateTokenStats() {
      const activeSession = typeof window.SessionStore !== 'undefined' ? window.SessionStore.getActiveSession?.() : null;

      if (activeSession && typeof window.MessageStore !== 'undefined') {
        const messages = window.MessageStore?.getSessionMessages?.(activeSession.id) || [];
        const totalChars = messages.reduce((sum: number, msg) => sum + ((msg as { content?: string }).content?.length ?? 0), 0);


        const statsEl = document.getElementById('token-stats');
        if (statsEl) {
          statsEl.innerHTML = `
            <div>Mesaj Sayısı: ${messages.length}</div>
            <div>Toplam Karakter: ${context._formatNumber(totalChars)}</div>
          `;
        }
      }
    },
  };
}
