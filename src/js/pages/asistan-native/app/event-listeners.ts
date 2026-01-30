/**
 * Event Listeners - User interactions and keyboard shortcuts
 */

import type { AppContext } from './types';

interface PromptHandler {
  setValue(value: string): void;
  focus(): void;
}

interface APIClient {
  cancel(): Promise<void>;
  retry(): Promise<void>;
  cancelAllRequests(): void;
}

interface SSEClient {
  disconnectAll(): void;
}

export function setupEventListeners(context: AppContext) {

  return {
    init() {
      // Quick actions
      const quickActions = document.querySelectorAll('.quick-action');
      quickActions.forEach((btn) => {
        btn.addEventListener('click', () => {
          const prompt = btn.getAttribute('data-prompt');
          if (prompt) {
            window.PromptHandler?.setValue?.(prompt);
            window.PromptHandler?.focus?.();
          }
        });
      });

      // Permission modal buttons
      const approveBtn = document.getElementById('btn-approve');
      const denyBtn = document.getElementById('btn-deny');
      if (approveBtn) {
        approveBtn.addEventListener('click', () => context._handlePermissionResponse(true));
      }
      if (denyBtn) {
        denyBtn.addEventListener('click', () => context._handlePermissionResponse(false));
      }

      // Question modal
      const answerBtn = document.getElementById('btn-answer');
      if (answerBtn) {
        answerBtn.addEventListener('click', () => context._handleQuestionResponse());
      }

      // Stop button
      const stopBtn = document.getElementById('btn-stop');
      if (stopBtn) {
        stopBtn.addEventListener('click', async () => {
          console.log('[OpenCode] Stop clicked');
          try {
            await window.APIClient?.cancel?.();
            context._updateStatus('connected', 'İptal edildi');
            window.PromptHandler?.setProcessing?.(false);
          } catch (err) {
            console.error('[OpenCode] Cancel failed:', err);
          }
        });
      }

      // Play button
      const playBtn = document.getElementById('btn-play');
      if (playBtn) {
        playBtn.addEventListener('click', async () => {
          console.log('[OpenCode] Play/Continue clicked');
          try {
            await window.APIClient?.retry?.();
          } catch (err) {
            console.error('[OpenCode] Retry failed:', err);
          }
        });
      }

      // Attach button
      const attachBtn = document.getElementById('btn-attach');
      if (attachBtn) {
        attachBtn.addEventListener('click', () => {
          context._handleAttachFile?.();
        });
      }

      // Expand button
      const expandBtn = document.getElementById('btn-expand');
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          context._togglePromptExpand?.();
        });
      }

      // New Session button
      const newSessionBtn = document.getElementById('btn-new-session');
      if (newSessionBtn) {
        newSessionBtn.addEventListener('click', () => context._handleNewSession?.());
      }

      // Keyboard shortcuts
      context._eventAbortController = new AbortController();
      const { signal } = context._eventAbortController;

      document.addEventListener(
        'keydown',
        (e) => {
          // Ctrl+N - New session
          if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
            e.preventDefault();
            context._handleNewSession?.();
          }
          // Ctrl+Shift+A - Agent selector
          if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
            e.preventDefault();
            document.getElementById('agent-selector')?.click();
          }
          // Ctrl+Shift+M - Model selector
          if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
            e.preventDefault();
            document.getElementById('model-selector')?.click();
          }
          // Ctrl+Shift+P - Command palette
          if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
            e.preventDefault();
            context._toggleCommandPalette?.();
          }
          // Escape
          if (e.key === 'Escape') {
            if (context._isProcessing) {
              window.APIClient?.cancel?.().catch(console.error);
            }
            context._closeAllDropdowns();
          }
        },
        { signal }
      );
    },

    destroy() {
      console.log('[OpenCode] Destroying app, cleaning up event listeners...');

      if (context._eventAbortController) {
        context._eventAbortController.abort();
        context._eventAbortController = null;
      }

      if (typeof window.SSEClient !== 'undefined') {
        window.SSEClient?.disconnectAll?.();
      }

      if (typeof window.APIClient !== 'undefined') {
        window.APIClient?.cancelAllRequests?.();
      }

      context._initialized = false;
    },

    setupModalListeners() {
      // Rename modal
      document.getElementById('rename-modal-close')?.addEventListener('click', () => context.hideRenameModal());
      document.getElementById('btn-rename-cancel')?.addEventListener('click', () => context.hideRenameModal());
      document.getElementById('btn-rename-confirm')?.addEventListener('click', () => context.confirmRename());
      document.getElementById('session-rename-input')?.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') context.confirmRename();
        if (e.key === 'Escape') context.hideRenameModal();
      });

      // Delete modal
      document.getElementById('delete-modal-close')?.addEventListener('click', () => context.hideDeleteModal());
      document.getElementById('btn-delete-cancel')?.addEventListener('click', () => context.hideDeleteModal());
      document.getElementById('btn-delete-confirm')?.addEventListener('click', () => context.confirmDelete());

      // Shell output modal
      document.getElementById('shell-modal-close')?.addEventListener('click', () => context.hideShellOutputModal());
      document.getElementById('btn-shell-close')?.addEventListener('click', () => context.hideShellOutputModal());

      // Overlay click to close
      document.getElementById('session-rename-modal')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'session-rename-modal') context.hideRenameModal();
      });
      document.getElementById('session-delete-modal')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'session-delete-modal') context.hideDeleteModal();
      });
      document.getElementById('shell-output-modal')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'shell-output-modal') context.hideShellOutputModal();
      });
    },
  };
}
