/**
 * Event Handlers - Session & connection event processing
 */

import type { SSEEventData, PermissionRequestData, QuestionData, AppContext } from './types';

// Types are defined in global.d.ts, no need to redeclare

export function setupEventHandlers(context: AppContext) {

  return {
    handleConnectionChange(data: SSEEventData) {
      const status = (data.data?.status || data.sessionId) as string;
      console.log('[OpenCode] Connection status:', status);

      if (status === 'connected') {
        context._updateStatus('connected', 'Bağlı');
      } else if (status === 'disconnected') {
        context._updateStatus('disconnected', 'Bağlantı kesildi');
      }
    },

    handleSessionStarted(data: SSEEventData) {
      const sessionId = (data.sessionId ?? data.data?.sessionId) as string | undefined;
      console.log('[OpenCode] Session started:', sessionId);
      if (sessionId && typeof window.SessionStore !== 'undefined') {
        const updateStatus = window.SessionStore?.updateSessionStatus as ((id: string, status: string) => void) | undefined;
        updateStatus?.(sessionId, 'started');
      }
      context._updateStatus('processing', 'Oturum başladı');
    },

    handleSessionStopped(data: SSEEventData) {
      const sessionId = (data.sessionId ?? data.data?.sessionId) as string | undefined;
      console.log('[OpenCode] Session stopped:', sessionId);

      if (sessionId && typeof window.SessionStore !== 'undefined') {
        const updateStatus = window.SessionStore?.updateSessionStatus as ((id: string, status: string) => void) | undefined;
        updateStatus?.(sessionId, 'stopped');
      }
    },

    handleStatusChange(data: SSEEventData) {
      const status = (data.data?.status || data.sessionId) as string;
      console.log('[OpenCode] Status change:', status);

      const statusText =
        {
          idle: 'Hazır',
          processing: 'İşleniyor',
          error: 'Hata',
          stopped: 'Durduruldu',
        }[status as string] || status || 'Bilinmiyor';

      context._updateStatus('connected', statusText);
    },

    handleError(data: SSEEventData) {
      const error = (data.data?.error ?? data.sessionId) || 'Bilinmeyen hata';
      console.error('[OpenCode] Error:', error);

      context._showToast(`Hata: ${error}`, 'error');
      context._updateStatus('error', `Hata: ${String(error).substring(0, 50)}`);
    },

    handlePermissionRequest(data: PermissionRequestData) {
      const permId = (data.id || data.permissionId) as string;
      const perm = (data.permission || {}) as { type?: string };

      console.log('[OpenCode] Permission request:', permId, perm);

      context._pendingPermissionId = permId;
      context._pendingPermission = perm;

      const modal = document.getElementById('permission-modal');
      if (modal) {
        const msgElement = modal.querySelector('.permission-message');
        if (msgElement) {
          msgElement.textContent = data.description || `İzin talep ediliyor: ${perm.type || 'unknown'}`;
        }

        const riskElement = modal.querySelector('.permission-risk');
        if (riskElement) {
          riskElement.textContent = data.risk ? `Risk seviyesi: ${data.risk}` : '';
        }

        modal.classList.add('active');
      }
    },

    handlePermissionResponse(approved: boolean) {
      const permId = context._pendingPermissionId;
      console.log('[OpenCode] Permission response:', permId, approved);

      if (permId && typeof window.APIClient !== 'undefined') {
        const respondFn = window.APIClient.respondPermission as ((id: string, approved: boolean) => Promise<void>) | undefined;
        respondFn?.(permId, approved)?.catch(console.error);
      }

      const modal = document.getElementById('permission-modal');
      if (modal) {
        modal.classList.remove('active');
      }

      context._pendingPermissionId = null;
      context._pendingPermission = null;
    },

    handleQuestion(data: QuestionData) {
      const qId = data.id || data.questionId;
      console.log('[OpenCode] Question:', qId, data.question);

      context._pendingQuestionId = qId || null;
      context._pendingQuestion = data;

      const modal = document.getElementById('question-modal');
      if (modal) {
        const questionElement = modal.querySelector('.question-text');
        if (questionElement) {
          questionElement.textContent = data.question || 'Soru:';
        }

        const optionsContainer = modal.querySelector('.question-options');
        if (optionsContainer) {
          optionsContainer.innerHTML = '';

          if (data.options && Array.isArray(data.options)) {
            data.options.forEach((opt: { label: string; value: string }) => {
              const button = document.createElement('button');
              button.className = 'option-button';
              button.textContent = opt.label || opt.value;
              button.value = opt.value;
              button.addEventListener('click', () => {
                const selectFn = context._selectOption as ((questionId: string, answer: string) => void) | undefined;
                selectFn?.(qId as string, opt.value);
              });
              optionsContainer.appendChild(button);
            });
          }

          if (data.allowFreeform) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'question-input';
            input.placeholder = 'Cevap giriniz...';
            const submitBtn = document.createElement('button');
            submitBtn.className = 'submit-button';
            submitBtn.textContent = 'Gönder';
            submitBtn.addEventListener('click', () => {
              const answer = input.value;
              if (answer.trim()) {
                context._selectOption?.(answer);
              }
            });
            optionsContainer.appendChild(input);
            optionsContainer.appendChild(submitBtn);
          }
        }

        modal.classList.add('active');
      }
    },

    selectOption(value: string) {
      const qId = context._pendingQuestionId;
      console.log('[OpenCode] Selected option:', qId, value);

      if (qId && typeof window.APIClient !== 'undefined') {
        const answerFn = window.APIClient.answerQuestion as ((id: string, answer: string) => Promise<void>) | undefined;
        answerFn?.(qId, value)?.catch(console.error);
      }

      const modal = document.getElementById('question-modal');
      if (modal) {
        modal.classList.remove('active');
      }

      context._pendingQuestionId = null;
      context._pendingQuestion = null;
    },

    handleQuestionResponse() {
      const modal = document.getElementById('question-modal');
      const input = modal?.querySelector('.question-input') as HTMLInputElement | null;

      if (input && input.value.trim()) {
        context._selectOption(input.value);
      }
    },
  };
}
