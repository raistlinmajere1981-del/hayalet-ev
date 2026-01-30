/**
 * UI Components - Sidebars, panels, command palette
 */

import type { AppContext } from './types';

export function setupUIComponents(context: AppContext) {
  return {
    initSidebars() {
      const rightPanelBtns = document.querySelectorAll('.panel-btn');
      rightPanelBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const panelName = btn.getAttribute('data-panel');
          if (panelName) {
            context._switchRightPanel(panelName);
          }
        });
      });

      console.log('[OpenCode] Sidebars initialized');
    },

    switchRightPanel(panelName: string) {
      const panels = document.querySelectorAll('.right-panel');
      const buttons = document.querySelectorAll('.panel-btn');

      panels.forEach((p) => {
        p.classList.remove('active');
      });

      buttons.forEach((b) => {
        b.classList.remove('active');
      });

      if (panelName === 'status') {
        const panel = document.getElementById('status-panel');
        if (panel) panel.classList.add('active');
        const btn = document.querySelector('[data-panel="status"]');
        if (btn) btn.classList.add('active');
        context._updateStatusPanel();
      } else if (panelName === 'actions') {
        const panel = document.getElementById('actions-panel');
        if (panel) panel.classList.add('active');
        const btn = document.querySelector('[data-panel="actions"]');
        if (btn) btn.classList.add('active');
      } else if (panelName === 'trash') {
        const panel = document.getElementById('trash-panel');
        if (panel) panel.classList.add('active');
        const btn = document.querySelector('[data-panel="trash"]');
        if (btn) btn.classList.add('active');
      }
    },

    executeQuickAction(action: string) {
      const actionHandlers: Record<string, () => void> = {
        'new-session': () => context._handleNewSession(),
        'clear-trash': () => context._clearTrash(),
        'copy-session-id': () => {
          const sessionId = typeof window.SessionStore !== 'undefined' ? (window.SessionStore.getActiveSession?.() as { id?: string } | undefined)?.id : null;
          if (sessionId) {
            navigator.clipboard.writeText(sessionId).catch(console.error);
            context._showToast('Oturum ID\'si kopyalandı', 'success');
          }
        },
      };

      const handler = actionHandlers[action];
      if (handler) {
        handler();
      }
    },

    async clearTrash() {
      if (typeof window.SessionStore === 'undefined') return;

      const trashSessions = (window.SessionStore.getTrashedSessions?.() || []) as Array<{ id: string }>;
      if (trashSessions.length === 0) {
        context._showToast('Çöp kutusu boş', 'info');
        return;
      }

      if (confirm(`${trashSessions.length} oturum kalıcı olarak silinecek. Emin misiniz?`)) {
        trashSessions.forEach((session: any) => {
          window.SessionStore?.deleteSession?.(session.id);
        });
        context._showToast('Çöp kutusu temizlendi', 'success');
      }
    },

    initCommandPalette() {
      const palette = document.getElementById('command-palette');
      const paletteInput = document.getElementById('palette-input');
      const paletteResults = document.getElementById('palette-results');

      if (!palette || !paletteInput || !paletteResults) return;

      (paletteInput as HTMLInputElement).addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const commands = [
          { label: 'Yeni Oturum', action: 'new-session', category: 'session' },
          { label: 'Çöp Kutusu Temizle', action: 'clear-trash', category: 'session' },
          { label: 'Oturum Şanyla Değiştir', action: 'open-rename', category: 'session' },
          { label: 'Oturumu Sil', action: 'open-delete', category: 'session' },
          { label: 'Model Seç', action: 'open-model-selector', category: 'settings' },
          { label: 'Ajant Seç', action: 'open-agent-selector', category: 'settings' },
        ];

        const filtered = commands.filter((cmd) => cmd.label.toLowerCase().includes(query));

        paletteResults.innerHTML = '';
        filtered.forEach((cmd) => {
          const item = document.createElement('div');
          item.className = 'palette-item';
          item.innerHTML = `<span>${cmd.label}</span><span class="category">${cmd.category}</span>`;
          item.addEventListener('click', () => {
            context._executeQuickAction(cmd.action);
            palette.classList.remove('active');
            (paletteInput as HTMLInputElement).value = '';
          });
          paletteResults.appendChild(item);
        });
      });

      console.log('[OpenCode] Command palette initialized');
    },

    initCollapsibleSections() {
      const headers = document.querySelectorAll('.section-header');
      headers.forEach((header) => {
        header.addEventListener('click', () => {
          const section = header.closest('.collapsible-section');
          if (section) {
            section.classList.toggle('collapsed');
          }
        });
      });

      console.log('[OpenCode] Collapsible sections initialized');
    },

    togglePromptExpand() {
      const promptContainer = document.getElementById('prompt-container');
      if (promptContainer) {
        promptContainer.classList.toggle('expanded');
      }
    },

    updateConnectionStatus() {
      const statusEl = document.getElementById('connection-status');
      if (statusEl) {
        statusEl.className = `status-${context._status}`;
        statusEl.textContent = context._statusText;
      }
    },

    updateAgentSelectorButton() {
      const btn = document.getElementById('agent-selector');
      if (btn && typeof window.AgentModelSelector !== 'undefined') {
        const agent = window.AgentModelSelector.getCurrentAgent?.() as { name?: string; id?: string } | undefined;
        if (agent) {
          btn.textContent = `🤖 ${agent.name || agent.id}`;
        }
      }
    },

    updateModelSelectorButton() {
      const btn = document.getElementById('model-selector');
      if (btn && typeof window.AgentModelSelector !== 'undefined') {
        const model = window.AgentModelSelector.getCurrentModel?.() as { name?: string; id?: string } | undefined;
        if (model) {
          btn.textContent = `🔧 ${model.name || model.id}`;
        }
      }
    },

    openAgentDropdown(button: HTMLElement) {
      if (typeof window.AgentModelSelector === 'undefined') return;

      context._closeAllDropdowns();

      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown-menu';

      const agents = (window.AgentModelSelector.getAvailableAgents?.() || []) as Array<{ id: string; name?: string }>;
      agents.forEach((agent) => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = agent.name || agent.id;
        item.addEventListener('click', () => {
          (window.AgentModelSelector as any)?.setAgent?.(agent.id);
          context._updateAgentSelectorButton();
          dropdown.remove();
        });
        dropdown.appendChild(item);
      });

      button.parentElement?.appendChild(dropdown);
    },

    openModelDropdown(button: HTMLElement) {
      if (typeof window.AgentModelSelector === 'undefined') return;

      context._closeAllDropdowns();

      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown-menu';

      const models = (window.AgentModelSelector.getFlatModels?.() || []) as Array<{ id: string; name?: string; providerId: string }>;
      models.forEach((model: { id: string; name?: string; providerId: string }) => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = model.name || model.id;
        item.addEventListener('click', () => {
          (window.AgentModelSelector as any)?.selectModel?.(model.providerId, model.id);
          context._updateModelSelectorButton();
          dropdown.remove();
        });
        dropdown.appendChild(item);
      });

      button.parentElement?.appendChild(dropdown);
    },

    closeAllDropdowns() {
      const dropdowns = document.querySelectorAll('.dropdown-menu');
      dropdowns.forEach((d) => d.remove());
    },
  };
}
