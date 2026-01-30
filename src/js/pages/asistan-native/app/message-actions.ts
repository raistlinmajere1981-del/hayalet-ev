/**
 * Message Actions - Send, retry, new session
 */

import type { AppContext, SessionRecord } from './types';

export function setupMessageActions(context: AppContext) {
  return {
    async handleSendMessage(message: string) {
      if (!message?.trim()) return;

      const activeSessionId = typeof window.SessionStore !== 'undefined' ? (window.SessionStore.getActiveSession?.() as SessionRecord | null)?.id : null;

      if (!activeSessionId) {
        context._showToast('Lütfen bir oturum seçiniz', 'warning');
        return;
      }

      console.log('[OpenCode] Sending message:', { sessionId: activeSessionId, message });

      context._isProcessing = true;
      window.PromptHandler?.setProcessing?.(true);

      const messageCache = { sessionId: activeSessionId, content: message };

      if (typeof window.StoreBridge !== 'undefined') {
        window.StoreBridge?.addOptimisticUserMessage?.(activeSessionId, message);
      }

      try {
        const response = (await window.APIClient?.sendMessage?.(activeSessionId, message)) as { success?: boolean; error?: string } | undefined;

        if (response?.success) {
          window.PromptHandler?.clearValue?.();
          console.log('[OpenCode] Message sent successfully');
        } else {
          console.error('[OpenCode] Send failed:', response?.error);
          context._showToast(`Gönderme hatası: ${response?.error}`, 'error');
          context._messageRetryCache = messageCache;
        }
      } catch (err) {
        console.error('[OpenCode] Send exception:', err);
        context._showToast(`Hata: ${err}`, 'error');
        context._messageRetryCache = messageCache;
      } finally {
        context._isProcessing = false;
        window.PromptHandler?.setProcessing?.(false);
      }
    },

    async retryMessage() {
      const cache = context._messageRetryCache;
      if (!cache) {
        context._showToast('Tekrar göndermek için mesaj gerekli', 'warning');
        return;
      }

      console.log('[OpenCode] Retrying message:', cache);
      context._messageRetryCache = null;
      await context._handleSendMessage?.();
    },

    async handleNewSession() {
      try {
        const sessionTitle = `Oturum ${new Date().toLocaleTimeString('tr-TR')}`;

        if (typeof window.APIClient === 'undefined') {
          console.error('[OpenCode] APIClient not available');
          context._showToast('APIClient hazır değil', 'error');
          return;
        }

        console.log('[OpenCode] Creating new session:', sessionTitle);

        const response = (await window.APIClient?.createSession?.(sessionTitle)) as { sessionId?: string } | undefined;

        if (response?.sessionId) {
          const newSession = {
            id: response.sessionId,
            title: sessionTitle,
            status: 'idle',
            messageIds: [],
            updatedAt: Date.now(),
          };
          if (typeof window.SessionStore !== 'undefined') {
            window.SessionStore?.addSession?.(newSession);
            window.SessionStore?.setActiveSession?.(newSession.id);
          }

          context._updateSessionList();
          context._updateTokenDisplay();
          window.PromptHandler?.focus?.();

          context._showToast('Yeni oturum oluşturuldu', 'success');
          console.log('[OpenCode] New session created:', newSession.id);
        } else {
          throw new Error('No sessionId in response');
        }
      } catch (err) {
        console.error('[OpenCode] Failed to create session:', err);
        context._showToast(`Oturum oluşturma hatası: ${err}`, 'error');
      }
    },
  };
}
