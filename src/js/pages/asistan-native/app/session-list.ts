/**
 * Session List & UI - Session rendering and management
 */

import type { SessionRecord, AppContext } from './types';

// Import global types
import '../../../global.d.ts';

export function setupSessionList(context: AppContext) {
  return {
    async updateSessionList() {
      if (typeof window.SessionStore === 'undefined') {
        console.warn('[OpenCode] SessionStore not available');
        return;
      }

      const getSessions = window.SessionStore?.getSessions;
      const sessions = (typeof getSessions === 'function' ? getSessions() : []) as SessionRecord[];
      const getActive = window.SessionStore?.getActiveSession;
      const active = typeof getActive === 'function' ? getActive() : null;
      context._renderSessionList?.(sessions);
      if (!active && sessions.length > 0) {
        const setActive = window.SessionStore?.setActiveSession;
        if (typeof setActive === 'function') {
          setActive((sessions[0] as SessionRecord).id);
        }
      }
    },

    renderSessionList(sessions: SessionRecord[]) {
      const container = document.getElementById('sessions-list');
      if (!container) return;

      container.innerHTML = '';

      if (!sessions || sessions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Oturum yok';
        container.appendChild(empty);
        return;
      }

      sessions.forEach((session: SessionRecord) => {
        const item = document.createElement('div');
        item.className = `session-item ${session.id === (window.SessionStore?.getActiveSession?.() as SessionRecord | null)?.id ? 'active' : ''}`;
        item.setAttribute('data-session-id', session.id);

        const titleEl = document.createElement('div');
        titleEl.className = 'session-title';
        titleEl.textContent = session.title || 'Adsız Oturum';

        const timeEl = document.createElement('div');
        timeEl.className = 'session-time';
        timeEl.textContent = session.updatedAt ? (context._formatSessionTime?.(session.updatedAt) || '') : '';

        const badgeEl = document.createElement('div');
        badgeEl.className = 'session-badge';
        badgeEl.textContent = `${(session.messageIds || []).length} msg`;

        const controlsEl = document.createElement('div');
        controlsEl.className = 'session-controls';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'control-btn rename-btn';
        renameBtn.title = 'Yeniden Adlandır';
        renameBtn.innerHTML = '✎';
        renameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          context.showRenameModal?.(session.id, session.title || 'Oturum');
        });

        const forkBtn = document.createElement('button');
        forkBtn.className = 'control-btn fork-btn';
        forkBtn.title = 'Dallandır';
        forkBtn.innerHTML = '⎇';
        forkBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          context._forkSession?.(session.id);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'control-btn delete-btn';
        deleteBtn.title = 'Sil';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          context.showDeleteModal?.(session.id);
        });

        controlsEl.appendChild(renameBtn);
        controlsEl.appendChild(forkBtn);
        controlsEl.appendChild(deleteBtn);

        item.appendChild(titleEl);
        item.appendChild(timeEl);
        item.appendChild(badgeEl);
        item.appendChild(controlsEl);

        item.addEventListener('click', () => context._switchSession(session.id));

        container.appendChild(item);
      });
    },

    switchSession(sessionId: string) {
      if (typeof window.SessionStore === 'undefined') return;

      (window.SessionStore)?.setActiveSession?.(sessionId);
      context._updateTokenDisplay();
      context._updateSessionList?.();

      const messagesList = document.getElementById('messages-list');
      if (messagesList && typeof window.MessageRenderer !== 'undefined') {
        window.MessageRenderer?.render?.(sessionId);
      }

      window.PromptHandler?.focus?.();
      console.log('[OpenCode] Switched to session:', sessionId);
    },

    async renameSession(sessionId: string, newTitle: string) {
      if (typeof window.SessionStore === 'undefined') return;

      if (!newTitle || !newTitle.trim()) {
        context._showToast('Başlık boş olamaz', 'warning');
        return;
      }

      try {
        await window.APIClient?.renameSession?.(sessionId, newTitle);
        (window.SessionStore)?.updateSessionInfo?.(sessionId, { title: newTitle });
        context._updateSessionList?.();
        context._showToast('Oturum yeniden adlandırıldı', 'success');
        console.log('[OpenCode] Session renamed:', sessionId, newTitle);
      } catch (err) {
        console.error('[OpenCode] Rename failed:', err);
        context._showToast(`Yeniden adlandırma hatası: ${err}`, 'error');
      }
    },

    async forkSession(sessionId: string) {
      if (typeof window.SessionStore === 'undefined' || typeof window.APIClient === 'undefined') {
        return;
      }

      try {
        const original = ((window.SessionStore)?.getAllSessions?.() || []).find((s: SessionRecord) => s.id === sessionId);
        if (!original) return;

        const forkTitle = `${original.title || 'Oturum'} (kopyası)`;

        const response = await (window.APIClient)?.forkConversation?.(sessionId) || {};

        if (response.sessionId) {
          const forkedSession = {
            ...original,
            id: response.sessionId,
            title: forkTitle,
            updatedAt: Date.now(),
          };

          const addSession = window.SessionStore?.addSession;
          if (typeof addSession === 'function') {
            addSession(forkedSession);
          }
          const setActive = window.SessionStore?.setActiveSession;
          if (typeof setActive === 'function') {
            setActive(response.sessionId);
          }
          context._updateSessionList?.();
          context._showToast('Oturum dallandırıldı', 'success');
          console.log('[OpenCode] Session forked:', response.sessionId);
        }
      } catch (err) {
        console.error('[OpenCode] Fork failed:', err);
        context._showToast(`Dallandırma hatası: ${err}`, 'error');
      }
    },

    async compactSession(sessionId: string) {
      if (typeof window.APIClient === 'undefined') return;

      try {
        console.log('[OpenCode] Compacting session:', sessionId);
        await (window.APIClient)?.compact?.();
        context._showToast('Oturum sıkıştırıldı', 'success');
      } catch (err) {
        console.error('[OpenCode] Compact failed:', err);
        context._showToast(`Sıkıştırma hatası: ${err}`, 'error');
      }
    },

    async deleteSession(sessionId: string) {
      if (typeof window.SessionStore === 'undefined') return;

      try {
        const trashSession = window.SessionStore?.trashSession;
        if (typeof trashSession === 'function') {
          await trashSession(sessionId);
        }
        context._updateSessionList?.();
        context._showToast('Oturum çöp kutusu\'na taşındı', 'success');
        console.log('[OpenCode] Session trashed:', sessionId);
      } catch (err) {
        console.error('[OpenCode] Delete failed:', err);
        context._showToast(`Silme hatası: ${err}`, 'error');
      }
    },

    updateSessionBadge() {
      if (typeof window.SessionStore === 'undefined') return;

      const getActive = window.SessionStore?.getActiveSession;
      const activeSession = typeof getActive === 'function' ? getActive() : null;
      const messageCount = (activeSession?.messageIds || []).length;

      const badge = document.querySelector('.session-badge.active');
      if (badge) {
        badge.textContent = `${messageCount} msg`;
      }
    }
  };
}
