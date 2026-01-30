/**
 * Prompt Handler Manager (Main singleton)
 *
 * Input alanını yönetir.
 * Keyboard shortcuts, history, auto-resize, @ mention, / commands, ! shell mode içerir.
 * CodeNomad prompt-input.tsx pattern'i referans alınmıştır.
 */

import type { PromptHandlerOptions, MentionResult, CommandResult, AttachmentItem } from './types.js';
import { createKeyboardHandlers } from './keyboard-handler.js';
import { createPickerApi } from './picker-api.js';
import { escapeHtml, renderAttachmentChip, showImagePreview } from './attachment-handler.js';
import { executeCommand, toggleShellMode } from './shell-mode.js';
import { autoResize, getValue, setValue, focus } from './input-utils.js';
import { saveHistory, loadHistory, saveDraft, loadDraft } from './storage.js';

const PromptHandler = {
  _input: null as HTMLTextAreaElement | null,
  _sendButton: null as HTMLButtonElement | null,
  _history: [] as string[],
  _historyIndexRef: { value: -1 },
  _currentDraftRef: { value: '' },
  _isProcessing: false,
  _onSend: null as ((content: string) => void) | null,
  _onShellCommand: null as ((command: string) => void) | null,

  // Shell Mode & Picker State
  _shellMode: false,
  _activePicker: 'none' as 'none' | 'mention' | 'command',
  _pickerIndexRef: { value: 0 },
  _pickerQuery: '',
  _mentionResults: [] as MentionResult[],
  _commandResults: [] as CommandResult[],
  _attachments: [] as string[],
  _draftSaveTimeout: null as ReturnType<typeof setTimeout> | null,
  _maxTextareaHeight: 300,
  _keyboardHandlers: null as ReturnType<typeof createKeyboardHandlers> | null,
  _pickerApi: null as ReturnType<typeof createPickerApi> | null,

  /**
   * Prompt handler'ı başlat
   */
  init(options: PromptHandlerOptions = {}) {
    this._input = options.input || null;
    this._sendButton = (options.sendButton as HTMLButtonElement | null) || null;
    this._onSend = options.onSend || null;
    this._onShellCommand = options.onShellCommand || null;

    if (this._input) {
      this._input.addEventListener('input', () => this._handleInput());
      this._input.addEventListener('keydown', (e: KeyboardEvent) => this._handleKeyDown(e));
      this._input.addEventListener('paste', (e: ClipboardEvent) => this._handlePaste(e));
      this._input.addEventListener('dragover', (e: DragEvent) => this._handleDragOver(e));
      this._input.addEventListener('dragleave', (e: DragEvent) => this._handleDragLeave(e));
      this._input.addEventListener('drop', (e: DragEvent) => this._handleDrop(e));
    }

    // Subscribe to AttachmentStore
    if (typeof window.AttachmentStore !== 'undefined') {
      (window.AttachmentStore).subscribe((event: unknown) => {
        const e = event as { type?: string };
        if (
          e.type === 'attachment:added' ||
          e.type === 'attachment:removed' ||
          e.type === 'attachments:cleared'
        ) {
          this._renderAttachments();
        }
      });
    }

    if (this._sendButton) {
      this._sendButton.addEventListener('click', () => this._send());
    }

    this._createPickerDropdowns();
    this._history = loadHistory();
    const draft = loadDraft();
    if (draft && this._input) {
      this._input.value = draft;
      autoResize(this._input, this._maxTextareaHeight);
    }
  },

  // =========================================================================
  // Public API
  // =========================================================================

  getValue() {
    return getValue(this._input);
  },

  setValue(value: string) {
    setValue(this._input, value, () => autoResize(this._input, this._maxTextareaHeight));
    this._historyIndexRef.value = -1;
  },

  clear() {
    this.setValue('');
    this._historyIndexRef.value = -1;
    this._currentDraftRef.value = '';
  },

  focus() {
    focus(this._input);
  },

  setProcessing(isProcessing: boolean) {
    this._isProcessing = isProcessing;

    if (this._input) {
      this._input.disabled = isProcessing;
    }

    if (this._sendButton) {
      this._sendButton.disabled = isProcessing;
    }
  },

  addToHistory(message: string) {
    if (!message.trim()) return;

    if (this._history[0] === message) return;

    this._history.unshift(message);

    const maxHistory =
      typeof window.OpenCodeConfig !== 'undefined'
        ? (window.OpenCodeConfig).maxHistoryItems
        : 50;
    if (this._history.length > maxHistory) {
      this._history = this._history.slice(0, maxHistory);
    }

    saveHistory(this._history);
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  _handleInput() {
    autoResize(this._input, this._maxTextareaHeight);
    this._historyIndexRef.value = -1;

    const value = this._input?.value || '';
    const _cursorPos = this._input?.selectionStart || 0;

    // Shell mode check
    if (value.startsWith('!') && !this._shellMode) {
      this._toggleShellMode(true);
    } else if (!value.startsWith('!') && this._shellMode) {
      this._toggleShellMode(false);
    }

    // Command picker trigger check
    if (value.startsWith('/')) {
      const query = value.slice(1);
      if (!this._pickerApi) {
        this._initPickerApi();
      }
      this._pickerQuery = query;
      this._openCommandPicker(query);
    } else if (this._activePicker === 'command') {
      this._closePicker();
    }

    this._saveDraftDebounced();
  },

  _initPickerApi() {
    if (!this._pickerApi) {
      this._pickerApi = createPickerApi(
        this._input,
        () => this.getValue(),
        () => this.getAttachments(),
        (item) => this._addAttachment(item),
        () => this._closePicker(),
        () => this.clear(),
        () => this._renderAttachments()
      );
    }
  },

  async _openMentionPicker(query: string) {
    this._activePicker = 'mention';
    this._pickerIndexRef.value = 0;

    if (!this._pickerApi) {
      this._initPickerApi();
    }

    if (!this._pickerApi) throw new Error('Picker API not initialized');
    this._mentionResults = await this._pickerApi.openMentionPicker(query);
    this._renderMentionDropdown();
  },

  _openCommandPicker(query: string) {
    this._activePicker = 'command';
    this._pickerIndexRef.value = 0;

    if (!this._pickerApi) {
      this._initPickerApi();
    }

    if (!this._pickerApi) throw new Error('Picker API not initialized');
    this._commandResults = this._pickerApi.openCommandPicker(query);
    this._renderCommandDropdown();
  },

  _handleKeyDown(e: KeyboardEvent) {
    if (!this._keyboardHandlers) {
      this._keyboardHandlers = createKeyboardHandlers(
        this._input,
        this._history,
        this._historyIndexRef,
        this._currentDraftRef,
        this._activePicker,
        this._pickerIndexRef,
        this._mentionResults,
        this._commandResults,
        (value) => this.setValue(value),
        () => autoResize(this._input, this._maxTextareaHeight),
        () => this._closePicker(),
        () => this._selectPickerItem(),
        (enabled) => this._toggleShellMode(enabled),
        () => this._send()
      );
    }

    this._keyboardHandlers.handleKeyDown(e);
  },

  _send() {
    if (this._isProcessing) return;

    const message = this.getValue();
    if (!message) return;

    this.addToHistory(message);

    if (this._shellMode && message.startsWith('!')) {
      const shellCommand = message.slice(1).trim();
      if (shellCommand) {
        this._sendShellCommand(shellCommand);
        this.clear();
        this._toggleShellMode(false);
        return;
      }
    }

    if (this._onSend) {
      this._onSend(message);
    }

    this.clear();
  },

  async _sendShellCommand(command: string) {
    console.log('[PromptHandler] Sending shell command:', command);

    const shellPrompt = `Lütfen aşağıdaki shell komutunu çalıştır:\n\n\`\`\`bash\n${command}\n\`\`\``;

    if (this._onShellCommand) {
      this._onShellCommand(command);
      return;
    }

    if (this._onSend) {
      this._onSend(shellPrompt);
    }
  },

  _toggleShellMode(enabled: boolean) {
    this._shellMode = enabled;
    toggleShellMode(enabled, this._input);
  },

  _createPickerDropdowns() {
    const wrapper = this._input?.closest('.prompt-wrapper');
    if (!wrapper) return;

    if (!document.getElementById('mention-dropdown')) {
      const mentionDropdown = document.createElement('div');
      mentionDropdown.id = 'mention-dropdown';
      mentionDropdown.className = 'mention-dropdown hidden';
      wrapper.appendChild(mentionDropdown);
    }

    if (!document.getElementById('command-dropdown')) {
      const commandDropdown = document.createElement('div');
      commandDropdown.id = 'command-dropdown';
      commandDropdown.className = 'command-dropdown hidden';
      wrapper.appendChild(commandDropdown);
    }
  },

  _renderMentionDropdown() {
    const dropdown = document.getElementById('mention-dropdown');
    if (!dropdown) return;

    if (this._mentionResults.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }

    dropdown.innerHTML = this._mentionResults
      .map((item: MentionResult, i: number) => {
        const icon = item.type === 'folder' ? '📁' : item.type === 'agent' ? '🤖' : '📄';
        const selectedClass = i === this._pickerIndexRef.value ? 'selected' : '';
        return `
        <div class="mention-item ${selectedClass}" data-index="${i}">
          <span class="file-icon">${icon}</span>
          <span class="file-name">${item.name}</span>
          ${item.path ? `<span class="file-path">${item.path}</span>` : ''}
        </div>
      `;
      })
      .join('');

    dropdown.querySelectorAll<HTMLElement>('.mention-item').forEach((el) => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index || '0');
        this._pickerIndexRef.value = index;
        this._selectPickerItem();
      });
    });

    dropdown.classList.remove('hidden');
  },

  _renderCommandDropdown() {
    const dropdown = document.getElementById('command-dropdown');
    if (!dropdown) return;

    if (this._commandResults.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }

    dropdown.innerHTML = this._commandResults
      .map((cmd: CommandResult, i: number) => {
        const selectedClass = i === this._pickerIndexRef.value ? 'selected' : '';
        return `
        <div class="command-item ${selectedClass}" data-index="${i}">
          <span class="command-name">/${cmd.name}</span>
          <span class="command-desc">${cmd.description}</span>
        </div>
      `;
      })
      .join('');

    dropdown.querySelectorAll<HTMLElement>('.command-item').forEach((el) => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index || '0');
        this._pickerIndexRef.value = index;
        this._selectPickerItem();
      });
    });

    dropdown.classList.remove('hidden');
  },

  _selectPickerItem() {
    if (this._activePicker === 'mention') {
      const item = this._mentionResults[this._pickerIndexRef.value];
      if (item && this._pickerApi) {
        this._pickerApi.insertMention(item);
      }
    } else if (this._activePicker === 'command') {
      const cmd = this._commandResults[this._pickerIndexRef.value];
      if (cmd) {
        executeCommand(cmd.name, () => this.clear());
      }
    }

    this._closePicker();
  },

  _closePicker() {
    this._activePicker = 'none';
    this._pickerIndexRef.value = 0;
    this._pickerQuery = '';

    document.getElementById('mention-dropdown')?.classList.add('hidden');
    document.getElementById('command-dropdown')?.classList.add('hidden');
  },

  _addAttachment(item: MentionResult) {
    const key = item.path || item.name;
    if (this._attachments.includes(key)) return;

    this._attachments.push(key);
    this._renderAttachments();
  },

  _removeAttachmentById(attachmentId: string) {
    const sessionId = this._getCurrentSessionId();

    if (typeof window.AttachmentStore !== 'undefined') {
      (window.AttachmentStore).removeAttachment(sessionId, attachmentId);
    } else {
      this._attachments = this._attachments.filter((p: string) => p !== attachmentId);
      this._renderAttachments();
    }
  },

  _renderAttachments() {
    let container = document.getElementById('prompt-attachments');
    const sessionId = this._getCurrentSessionId();

    let attachments = [];
    if (typeof window.AttachmentStore !== 'undefined') {
      attachments = (window.AttachmentStore).getAttachments(sessionId) || [];
    } else {
      attachments = this._attachments.map((path: string) => ({
        id: path,
        type: 'file',
        name: path.split('/').pop(),
        path,
      }));
    }

    if (attachments.length === 0) {
      if (container) {
        container.innerHTML = '';
        container.classList.remove('has-attachments');
      }
      return;
    }

    if (!container) {
      const wrapper = this._input?.closest('.prompt-wrapper');
      if (!wrapper) return;

      container = document.createElement('div');
      container.id = 'prompt-attachments';
      container.className = 'prompt-attachments';

      const inputWrapper = wrapper.querySelector('.prompt-input-wrapper');
      if (inputWrapper) {
        wrapper.insertBefore(container, inputWrapper);
      }
    }

    container.classList.add('has-attachments');
    container.innerHTML = attachments.map((att: AttachmentItem) => renderAttachmentChip(att)).join('');

    container.querySelectorAll('.remove-attachment').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chip = btn.closest('.attachment-chip') as HTMLElement | null;
        const attId = chip?.dataset.attachmentId;
        if (attId) this._removeAttachmentById(attId);
      });
    });

    container.querySelectorAll<HTMLElement>('.attachment-preview').forEach((preview) => {
      preview.addEventListener('click', (e) => {
        e.stopPropagation();
        const dataUrl = preview.dataset.fullImage;
        if (dataUrl) showImagePreview(dataUrl);
      });
    });
  },

  async _handlePaste(e: ClipboardEvent) {
    setTimeout(() => autoResize(this._input, this._maxTextareaHeight), 0);

    if (typeof window.AttachmentStore !== 'undefined') {
      const sessionId = this._getCurrentSessionId();
      const attachments = await (window.AttachmentStore).handlePaste(e, sessionId);

      if (attachments.length > 0) {
        console.log('[PromptHandler] Pasted attachments:', attachments.length);
        const hasOnlyImages = attachments.every((a: { type?: string }) => a.type === 'image');
        if (hasOnlyImages) {
          e.preventDefault();
        }
      }
    }
  },

  _handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }

    const wrapper = this._input?.closest('.prompt-input-wrapper');
    if (wrapper && !wrapper.classList.contains('drag-over')) {
      wrapper.classList.add('drag-over');
    }
  },

  _handleDragLeave(e: DragEvent) {
    e.preventDefault();

    const wrapper = this._input?.closest('.prompt-input-wrapper');
    if (wrapper && !wrapper.contains(e.relatedTarget as Node | null)) {
      wrapper.classList.remove('drag-over');
    }
  },

  async _handleDrop(e: DragEvent) {
    e.preventDefault();
    this._input?.closest('.prompt-input-wrapper')?.classList.remove('drag-over');

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    if (typeof window.AttachmentStore !== 'undefined') {
      const sessionId = this._getCurrentSessionId();
      const attachments = await (window.AttachmentStore).handleDrop(e, sessionId);
      console.log('[PromptHandler] Dropped attachments:', attachments.length);
    } else {
      Array.from(files as FileList).forEach((file) => {
        this._addAttachment({
          name: file.name,
          path: file.name,
          type: 'file',
        });
      });
    }
  },

  _saveDraftDebounced() {
    if (this._draftSaveTimeout) {
      clearTimeout(this._draftSaveTimeout);
    }

    this._draftSaveTimeout = setTimeout(() => {
      saveDraft(this._input?.value || '');
    }, 500);
  },

  _getCurrentSessionId(): string {
    if (typeof window.SessionStore !== 'undefined') {
      return (window.SessionStore).getCurrentSessionId?.() || 'default';
    }
    return 'default';
  },

  getAttachments() {
    const sessionId = this._getCurrentSessionId();

    if (typeof window.AttachmentStore !== 'undefined') {
      return (window.AttachmentStore).getAttachmentsForAPI(sessionId);
    }

    return this._attachments.map((path: string) => ({
      type: 'file',
      name: path.split('/').pop(),
      path,
    }));
  },

  clearAttachments() {
    const sessionId = this._getCurrentSessionId();

    if (typeof window.AttachmentStore !== 'undefined') {
      (window.AttachmentStore).clearAttachments(sessionId);
    } else {
      this._attachments = [];
      this._renderAttachments();
    }
  },
};

// Global export
(window).PromptHandler = PromptHandler;

export { PromptHandler };
