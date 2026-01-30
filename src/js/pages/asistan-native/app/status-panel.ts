/**
 * Status Panel & Utilities
 */

import type { AppContext } from './types';

export function setupStatusPanel(context: AppContext) {
  return {
    updateStatusPanel() {
      const panel = document.getElementById('status-panel');
      if (!panel) return;

      panel.innerHTML = '';

      // Connection status
      const connSection = document.createElement('div');
      connSection.className = 'status-section';
      connSection.innerHTML = `
        <h3>Bağlantı</h3>
        <div>Durum: <span class="status-value">${context._statusText}</span></div>
        <div>URL: <span class="status-value">${context._serverUrl || 'Bilinmiyor'}</span></div>
      `;
      panel.appendChild(connSection);

      context._updateMCPServers();
      context._updateBackgroundShells();
      context._updatePlugins();
    },

    updateMCPServers() {
      if (typeof window.OpenCodeManager === 'undefined') return;

      const panel = document.getElementById('status-panel');
      if (!panel) return;

      const section = document.createElement('div');
      section.className = 'status-section';
      section.innerHTML = '<h3>MCP Sunucuları</h3>';

      const servers = window.OpenCodeManager.getMCPServers?.() || [];
      if (servers.length === 0) {
        section.innerHTML += '<p>Sunucu yok</p>';
      } else {
        servers.forEach((server: { name: string; port: number; status: string }) => {
          section.innerHTML += `<div>• ${server.name || server.id} (${server.status || 'unknown'})</div>`;
        });
      }

      panel.appendChild(section);
    },

    updateBackgroundShells() {
      if (typeof window.OpenCodeManager === 'undefined') return;

      const panel = document.getElementById('status-panel');
      if (!panel) return;

      const section = document.createElement('div');
      section.className = 'status-section';
      section.innerHTML = '<h3>Arka Plan Kabukları</h3>';

      const shells = window.OpenCodeManager.getBackgroundShells?.() || [];
      if (shells.length === 0) {
        section.innerHTML += '<p>Kabuk yok</p>';
      } else {
        shells.forEach((shell: { name: string; path: string }) => {
          section.innerHTML += `<div>• ${shell.name || shell.id} (${shell.status || 'running'})</div>`;
        });
      }

      panel.appendChild(section);
    },

    updatePlugins() {
      if (typeof window.OpenCodeManager === 'undefined') return;

      const panel = document.getElementById('status-panel');
      if (!panel) return;

      const section = document.createElement('div');
      section.className = 'status-section';
      section.innerHTML = '<h3>Eklentiler</h3>';

      const plugins = window.OpenCodeManager.getPlugins?.() || [];
      if (plugins.length === 0) {
        section.innerHTML += '<p>Eklenti yok</p>';
      } else {
        plugins.forEach((plugin: { name: string; version: string; enabled: boolean }) => {
          section.innerHTML += `<div>• ${plugin.name || plugin.id}</div>`;
        });
      }

      panel.appendChild(section);
    },

    showToast(message: string, type: string = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('show');
      }, 10);

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },

    formatSessionTime(date: Date): string {
      const now = new Date();
      const diff = now.getTime() - date.getTime();

      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'şimdi';
      if (minutes < 60) return `${minutes}d önce`;
      if (hours < 24) return `${hours}s önce`;
      if (days < 7) return `${days}g önce`;

      return date.toLocaleDateString('tr-TR');
    },

    escapeHtml(text: string): string {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return text.replace(/[&<>"']/g, (c) => map[c as keyof typeof map] || c);
    },

    formatNumber(num: number): string {
      return num.toLocaleString('tr-TR');
    },

    async handleAttachFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          console.log('[OpenCode] File selected:', file.name);
          window.PromptHandler.attachFile?.(file);
        }
      };
      input.click();
    },

    updateStatus(status: string, text: string) {
      context._status = status;
      context._statusText = text;
      context._updateConnectionStatus();
    },

    getServerUrl(): string {
      return context._serverUrl || 'http://localhost:3000';
    },
  };
}
