/**
 * Keyboard Event Handlers
 * KeyDown, history navigation, picker navigation
 */

import type { MentionResult, CommandResult } from './types.js';

function createKeyboardHandlers(
  inputEl: HTMLTextAreaElement | null,
  historyItems: string[],
  historyIndexRef: { value: number },
  currentDraftRef: { value: string },
  activePicker: string,
  pickerIndexRef: { value: number },
  mentionResults: MentionResult[],
  commandResults: CommandResult[],
  setInputValueFn: (value: string) => void,
  autoResizeFn: () => void,
  closerPickerFn: () => void,
  selectPickerItemFn: () => void,
  toggleShellModeFn: (enabled: boolean) => void,
  sendFn: () => void
) {
  function isAtStart(): boolean {
    if (!inputEl) return false;
    return inputEl.selectionStart === 0 && inputEl.selectionEnd === 0;
  }

  function isAtEnd(): boolean {
    if (!inputEl) return false;
    const len = inputEl.value.length;
    return inputEl.selectionStart === len && inputEl.selectionEnd === len;
  }

  function navigateHistory(direction: number) {
    if (historyItems.length === 0) return;

    // İlk gezinme - mevcut değeri sakla
    if (historyIndexRef.value === -1 && direction === -1) {
      currentDraftRef.value = inputEl?.value.trim() || '';
    }

    // direction === -1 (yukarı ok) → history'de GERİ git (index ARTMALI)
    // direction === 1 (aşağı ok) → history'de İLERİ git (index AZALMALI)
    const newIndex = historyIndexRef.value - direction;

    if (newIndex < -1 || newIndex >= historyItems.length) {
      return;
    }

    historyIndexRef.value = newIndex;

    if (historyIndexRef.value === -1) {
      // Draft'a dön
      setInputValueFn(currentDraftRef.value);
    } else {
      // History'den al
      setInputValueFn(historyItems[historyIndexRef.value]);
    }

    // Cursor'u sona taşı
    if (inputEl) {
      inputEl.selectionStart = inputEl.value.length;
      inputEl.selectionEnd = inputEl.value.length;
    }
  }

  function handlePickerKeyDown(e: KeyboardEvent): boolean {
    const results = activePicker === 'mention' ? mentionResults : commandResults;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      pickerIndexRef.value = Math.max(0, pickerIndexRef.value - 1);
      updatePickerSelection();
      return true;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      pickerIndexRef.value = Math.min(results.length - 1, pickerIndexRef.value + 1);
      updatePickerSelection();
      return true;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectPickerItemFn();
      return true;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closerPickerFn();
      return true;
    }

    return false;
  }

  function updatePickerSelection() {
    const dropdownId = activePicker === 'mention' ? 'mention-dropdown' : 'command-dropdown';
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    dropdown.querySelectorAll('.mention-item, .command-item').forEach((el, i) => {
      el.classList.toggle('selected', i === pickerIndexRef.value);
    });

    const selected = dropdown.querySelector('.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Picker aktifse picker navigation
    if (activePicker !== 'none') {
      if (handlePickerKeyDown(e)) return;
    }

    // Ctrl+Enter - Gönder
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendFn();
      return;
    }

    // Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      if (activePicker !== 'none') {
        closerPickerFn();
      } else if ((window as any).PromptHandler?._shellMode) {
        toggleShellModeFn(false);
      } else {
        setInputValueFn('');
        historyIndexRef.value = -1;
        currentDraftRef.value = '';
      }
      return;
    }

    // Arrow Up
    if (e.key === 'ArrowUp') {
      if (activePicker !== 'none') {
        return;
      }
      if (isAtStart()) {
        e.preventDefault();
        navigateHistory(-1);
      }
      return;
    }

    // Arrow Down
    if (e.key === 'ArrowDown') {
      if (activePicker !== 'none') {
        return;
      }
      if (isAtEnd()) {
        e.preventDefault();
        navigateHistory(1);
      }
      return;
    }

    // Tab
    if (e.key === 'Tab' && activePicker !== 'none') {
      e.preventDefault();
      selectPickerItemFn();
      return;
    }
  }

  return { handleKeyDown };
}

export { createKeyboardHandlers };
