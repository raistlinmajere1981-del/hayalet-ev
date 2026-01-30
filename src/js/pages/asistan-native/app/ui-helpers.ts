/**
 * UI Helpers - Generic helper methods
 */

export function setupUIHelpers(context: unknown) {
  return {
    init() {
      // Empty initialization
    },
  };
}

// Re-export utilities for external use
export const UIHelpers = {
  showToast(message: string, type: string = 'info'): void {
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

  formatTokenCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return `${count}`;
    }
  },

  async handleAttachFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log('[OpenCode] File selected:', file.name);
        if (typeof window.PromptHandler !== 'undefined') {
          window.PromptHandler.attachFile?.(file);
        }
      }
    };
    input.click();
  },

  togglePromptExpand(): void {
    const promptContainer = document.getElementById('prompt-container');
    if (promptContainer) {
      promptContainer.classList.toggle('expanded');
    }
  },

  closeAllDropdowns(): void {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach((d) => d.remove());
  },

  toggleCommandPalette(): void {
    const palette = document.getElementById('command-palette');
    if (palette) {
      palette.classList.toggle('active');
      const input = palette.querySelector('#palette-input') as HTMLInputElement | null;
      if (input && palette.classList.contains('active')) {
        input.focus();
      }
    }
  },
};
