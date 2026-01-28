/**
 * Message Actions - Send, retry, new session
 */

export function setupMessageActions(context: any) {
  return {
    async handleSendMessage(message: string) {
      if (!message?.trim()) return;

      const activeSessionId = typeof (window as any).SessionStore !== 'undefined' ? (window as any).SessionStore.getActiveSession()?.id : null;

      if (!activeSessionId) {
        context._showToast('Lütfen bir oturum seçiniz', 'warning');
        return;
      }

      console.log('[OpenCode] Sending message:', { sessionId: activeSessionId, message });

      context._isProcessing = true;
      (window as any).PromptHandler.setProcessing(true);

      const messageCache: any = { sessionId: activeSessionId, content: message };

      if (typeof (window as any).StoreBridge !== 'undefined') {
        (window as any).StoreBridge.addOptimisticUserMessage(activeSessionId, message);
      }

      try {
        const response = await (window as any).APIClient.sendMessage(activeSessionId, message);

        if (response.success) {
          (window as any).PromptHandler.clearValue();
          console.log('[OpenCode] Message sent successfully');
        } else {
          console.error('[OpenCode] Send failed:', response.error);
          context._showToast(`Gönderme hatası: ${response.error}`, 'error');
          context._messageRetryCache = messageCache;
        }
      } catch (err) {
        console.error('[OpenCode] Send exception:', err);
        context._showToast(`Hata: ${err}`, 'error');
        context._messageRetryCache = messageCache;
      } finally {
        context._isProcessing = false;
        (window as any).PromptHandler.setProcessing(false);
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
      await context._handleSendMessage(cache.content);
    },

    async handleNewSession() {
      try {
        const sessionTitle = `Oturum ${new Date().toLocaleTimeString('tr-TR')}`;

        if (typeof (window as any).APIClient === 'undefined') {
          console.error('[OpenCode] APIClient not available');
          context._showToast('APIClient hazır değil', 'error');
          return;
        }

        console.log('[OpenCode] Creating new session:', sessionTitle);

        const response = await (window as any).APIClient.createSession(sessionTitle);

        if (response?.sessionId) {
          const newSession = {
            id: response.sessionId,
            title: sessionTitle,
            status: 'idle',
            messageIds: [],
            updatedAt: Date.now(),
          };
          if (typeof (window as any).SessionStore !== 'undefined') {
            window.SessionStore?.addSession?.(newSession as unknown as any);
            window.SessionStore?.setActiveSession?.(newSession.id);
          }

          context._updateSessionList();
          context._updateTokenDisplay();
          (window as any).PromptHandler.focus();

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
