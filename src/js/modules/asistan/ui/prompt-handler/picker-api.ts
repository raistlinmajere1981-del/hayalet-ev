/**
 * Picker API - Mention & Command picker logic
 */

import type { MentionResult, CommandResult } from './types.js';

function createPickerApi(
  inputEl: HTMLTextAreaElement | null,
  getValueFn: () => string,
  getAttachmentsFn: () => unknown[],
  addAttachmentFn: (item: MentionResult) => void,
  _closePickerFn: () => void,
  _clearInputFn: () => void,
  _updateAttachmentsFn: () => void
) {
  function checkTrigger(value: string, cursorPos: number, trigger: string) {
    const beforeCursor = value.slice(0, cursorPos);
    const lastTriggerIndex = beforeCursor.lastIndexOf(trigger);

    if (lastTriggerIndex === -1) return null;

    const afterTrigger = beforeCursor.slice(lastTriggerIndex + 1);

    if (afterTrigger.includes(' ') || afterTrigger.includes('\n')) return null;

    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const atLineStart = lastTriggerIndex === lineStart || lastTriggerIndex === 0;

    return {
      query: afterTrigger,
      atLineStart,
    };
  }

  async function openMentionPicker(query: string): Promise<MentionResult[]> {
    try {
      if (window.APIClient?.searchFiles) {
        const result = (await window.APIClient.searchFiles(query, 10)) as { files: unknown[] };
        if (result.files && result.files.length > 0) {
          return result.files as MentionResult[];
        } else if (query === '') {
          return getDefaultMentionItems();
        }
      } else {
        return query ? [] : getDefaultMentionItems();
      }
    } catch (err) {
      console.warn('[PromptHandler] File search failed:', err);
      return query ? [] : getDefaultMentionItems();
    }
    return [];
  }

  function getDefaultMentionItems(): MentionResult[] {
    const items: MentionResult[] = [];

    if (typeof window.AgentModelSelector !== 'undefined') {
      const agents = (window.AgentModelSelector).getAvailableAgents?.() || [];
      agents.forEach((agent: { name: string }) => {
        items.push({
          name: agent.name,
          path: undefined,
          type: 'agent',
        });
      });
    }

    return items;
  }

  function openCommandPicker(query: string): CommandResult[] {
    const commands = (typeof window.OpenCodeConfig !== 'undefined' && (window.OpenCodeConfig).commands)
      ? (window.OpenCodeConfig).commands
      : [
          { name: 'clear', description: 'Sohbeti temizle' },
          { name: 'new', description: 'Yeni oturum başlat' },
          { name: 'help', description: 'Yardım göster' },
          { name: 'history', description: 'Geçmişi göster' },
          { name: 'compact', description: "Context'i sıkıştır" },
          { name: 'cancel', description: 'İşlemi iptal et' },
          { name: 'retry', description: 'Son mesajı tekrarla' },
        ];

    return commands.filter((cmd: CommandResult) =>
      cmd.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  function insertMention(item: MentionResult) {
    if (!inputEl) return;

    const value = inputEl.value;
    const cursorPos = inputEl.selectionStart || 0;
    const beforeCursor = value.slice(0, cursorPos);
    const afterCursor = value.slice(cursorPos);

    const lastAtIndex = beforeCursor.lastIndexOf('@');
    if (lastAtIndex === -1) return;

    const mention = item.type === 'agent' ? `@${item.name} ` : `@${item.path || item.name} `;
    const newValue = beforeCursor.slice(0, lastAtIndex) + mention + afterCursor;

    inputEl.value = newValue;
    inputEl.selectionStart = lastAtIndex + mention.length;
    inputEl.selectionEnd = lastAtIndex + mention.length;

    if (item.type === 'file' || item.type === 'folder') {
      addAttachmentFn(item);
    }
  }

  return { checkTrigger, openMentionPicker, openCommandPicker, insertMention, getDefaultMentionItems };
}

export { createPickerApi };
