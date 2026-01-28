/**
 * Storage Helpers
 * History and draft persistence
 */

function saveHistory(history: string[]) {
  try {
    localStorage.setItem('opencode-prompt-history', JSON.stringify(history));
  } catch {
    // Storage hatası - yoksay
  }
}

function loadHistory(): string[] {
  try {
    const saved = localStorage.getItem('opencode-prompt-history');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveDraft(value: string) {
  try {
    if (value.trim()) {
      localStorage.setItem('opencode-prompt-draft', value);
    } else {
      localStorage.removeItem('opencode-prompt-draft');
    }
  } catch {
    // Storage hatası
  }
}

function loadDraft(): string {
  try {
    return localStorage.getItem('opencode-prompt-draft') || '';
  } catch {
    return '';
  }
}

export { saveHistory, loadHistory, saveDraft, loadDraft };
