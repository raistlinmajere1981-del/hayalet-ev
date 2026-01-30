/**
 * Session Modals - Rename, delete, shell output
 */

import type { AppContext } from './types';

export function setupSessionModals(context: AppContext) {
  return {
    showRenameModal(sessionId: string) {
      const modal = document.getElementById('session-rename-modal');
      const input = document.getElementById('session-rename-input') as HTMLInputElement | null;

      if (modal && input) {
        context._pendingRenameSessionId = sessionId;

        const session = typeof window.SessionStore !== 'undefined' ? ((window.SessionStore)?.getAllSessions?.() || []).find((s: unknown) => s.id === sessionId) : null;
        if (session) {
          input.value = session.title || '';
        }

        input.focus();
        input.select();
        modal.classList.add('active');
      }
    },

    hideRenameModal() {
      const modal = document.getElementById('session-rename-modal');
      if (modal) {
        modal.classList.remove('active');
        context._pendingRenameSessionId = null;
      }
    },

    confirmRename() {
      const input = document.getElementById('session-rename-input') as HTMLInputElement | null;
      const newTitle = input?.value || '';

      if (context._pendingRenameSessionId && newTitle.trim()) {
        context._renameSession?.(context._pendingRenameSessionId);
        context.hideRenameModal();
      }
    },

    showDeleteModal(sessionId: string) {
      const modal = document.getElementById('session-delete-modal');
      if (modal) {
        context._pendingDeleteSessionId = sessionId;

        const session = typeof window.SessionStore !== 'undefined' ? ((window.SessionStore)?.getAllSessions?.() || []).find((s: unknown) => s.id === sessionId) : null;
        const titleEl = modal.querySelector('.delete-title');
        if (titleEl && session) {
          titleEl.textContent = `"${session.title || 'Adsız Oturum'}" silinecek mi?`;
        }

        modal.classList.add('active');
      }
    },

    hideDeleteModal() {
      const modal = document.getElementById('session-delete-modal');
      if (modal) {
        modal.classList.remove('active');
        context._pendingDeleteSessionId = null;
      }
    },

    confirmDelete() {
      if (context._pendingDeleteSessionId) {
        context._deleteSession(context._pendingDeleteSessionId);
        context.hideDeleteModal();
      }
    },

    showShellOutputModal(title: string, output: string) {
      const modal = document.getElementById('shell-output-modal');
      if (modal) {
        const titleEl = modal.querySelector('.shell-title');
        const outputEl = modal.querySelector('.shell-output');

        if (titleEl) {
          titleEl.textContent = title || 'Komut Çıktısı';
        }
        if (outputEl) {
          outputEl.textContent = output || '';
        }

        modal.classList.add('active');
      }
    },

    hideShellOutputModal() {
      const modal = document.getElementById('shell-output-modal');
      if (modal) {
        modal.classList.remove('active');
      }
    },
  };
}
