/**
 * OpenCode UI - Prompt Handler
 * 
 * Input alanını yönetir.
 * Keyboard shortcuts, history, auto-resize, @ mention, / commands, ! shell mode içerir.
 * CodeNomad prompt-input.tsx pattern'i referans alınmıştır.
 */

const PromptHandler = {
  /** @type {HTMLTextAreaElement | null} */
  _input: null,

  /** @type {HTMLButtonElement | null} */
  _sendButton: null,

  /** @type {string[]} */
  _history: [],

  /** @type {number} */
  _historyIndex: -1,

  /** @type {string} */
  _currentDraft: '',

  /** @type {boolean} */
  _isProcessing: false,

  /** @type {Function | null} */
  _onSend: null,

  // =========================================================================
  // Shell Mode & Picker State
  // =========================================================================

  /** @type {boolean} Shell mode aktif mi */
  _shellMode: false,

  /** @type {'none' | 'mention' | 'command'} Aktif picker türü */
  _activePicker: 'none',

  /** @type {number} Picker'da seçili index */
  _pickerIndex: 0,

  /** @type {string} Picker için arama terimi */
  _pickerQuery: '',

  /** @type {Array<{name: string, path?: string, type: string}>} Mention sonuçları */
  _mentionResults: [],

  /** @type {Array<{name: string, description: string}>} Command sonuçları */
  _commandResults: [],

  /** @type {string[]} Eklenmiş dosya/agent mention'ları */
  _attachments: [],

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Prompt handler'ı başlat
   * @param {object} options
   * @param {HTMLTextAreaElement} options.input - Input element
   * @param {HTMLButtonElement} options.sendButton - Send button
   * @param {Function} options.onSend - Send callback
   * @param {Function} [options.onShellCommand] - Shell command callback
   */
  init(options) {
    this._input = options.input;
    this._sendButton = options.sendButton;
    this._onSend = options.onSend;
    this._onShellCommand = options.onShellCommand || null;

    if (this._input) {
      this._input.addEventListener('input', () => this._handleInput());
      this._input.addEventListener('keydown', (e) => this._handleKeyDown(e));
      this._input.addEventListener('paste', (e) => this._handlePaste(e));
      
      // Drag & drop for file attachments
      this._input.addEventListener('dragover', (e) => this._handleDragOver(e));
      this._input.addEventListener('dragleave', (e) => this._handleDragLeave(e));
      this._input.addEventListener('drop', (e) => this._handleDrop(e));
    }

    // Subscribe to AttachmentStore changes
    if (typeof AttachmentStore !== 'undefined') {
      AttachmentStore.subscribe((event) => {
        if (event.type === 'attachment:added' || 
            event.type === 'attachment:removed' || 
            event.type === 'attachments:cleared') {
          this._renderAttachments();
        }
      });
    }

    if (this._sendButton) {
      this._sendButton.addEventListener('click', () => this._send());
    }

    // Picker dropdown'ları oluştur
    this._createPickerDropdowns();

    // History'yi localStorage'dan yükle
    this._loadHistory();
    
    // Draft'u localStorage'dan yükle
    this._loadDraft();
  },

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Input değerini al
   * @returns {string}
   */
  getValue() {
    return this._input?.value.trim() || '';
  },

  /**
   * Input değerini ayarla
   * @param {string} value
   */
  setValue(value) {
    if (this._input) {
      this._input.value = value;
      this._autoResize();
    }
  },

  /**
   * Input'u temizle
   */
  clear() {
    this.setValue('');
    this._historyIndex = -1;
    this._currentDraft = '';
  },

  /**
   * Input'a focus ver
   */
  focus() {
    this._input?.focus();
  },

  /**
   * Processing durumunu ayarla
   * @param {boolean} isProcessing
   */
  setProcessing(isProcessing) {
    this._isProcessing = isProcessing;
    
    if (this._input) {
      this._input.disabled = isProcessing;
    }
    
    if (this._sendButton) {
      this._sendButton.disabled = isProcessing;
    }
  },

  /**
   * History'ye mesaj ekle
   * @param {string} message
   */
  addToHistory(message) {
    if (!message.trim()) return;
    
    // Aynı mesajı tekrar ekleme
    if (this._history[0] === message) return;
    
    this._history.unshift(message);
    
    // Max history items (config'den al)
    const maxHistory = (typeof OpenCodeConfig !== 'undefined') 
      ? OpenCodeConfig.maxHistoryItems 
      : 50;
    if (this._history.length > maxHistory) {
      this._history = this._history.slice(0, maxHistory);
    }
    
    this._saveHistory();
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Input değişikliği
   */
  _handleInput() {
    this._autoResize();
    this._historyIndex = -1;
    
    const value = this._input?.value || '';
    const cursorPos = this._input?.selectionStart || 0;
    
    // Shell mode check (! ile başlayan)
    if (value.startsWith('!') && !this._shellMode) {
      this._toggleShellMode(true);
    } else if (!value.startsWith('!') && this._shellMode) {
      this._toggleShellMode(false);
    }
    
    // @ mention trigger
    const mentionMatch = this._checkTrigger(value, cursorPos, '@');
    if (mentionMatch) {
      this._pickerQuery = mentionMatch.query;
      this._openMentionPicker(mentionMatch.query);
    } else if (this._activePicker === 'mention') {
      this._closePicker();
    }
    
    // / command trigger (sadece satır başında)
    const commandMatch = this._checkTrigger(value, cursorPos, '/');
    if (commandMatch && commandMatch.atLineStart) {
      this._pickerQuery = commandMatch.query;
      this._openCommandPicker(commandMatch.query);
    } else if (this._activePicker === 'command') {
      this._closePicker();
    }
    
    // Draft'u kaydet (debounced)
    this._saveDraftDebounced();
  },
  
  /**
   * Trigger karakteri kontrolü
   * @param {string} value - Input değeri
   * @param {number} cursorPos - Cursor pozisyonu
   * @param {string} trigger - Trigger karakteri (@ veya /)
   * @returns {{query: string, atLineStart: boolean} | null}
   */
  _checkTrigger(value, cursorPos, trigger) {
    // Cursor'dan geriye doğru trigger ara
    const beforeCursor = value.slice(0, cursorPos);
    const lastTriggerIndex = beforeCursor.lastIndexOf(trigger);
    
    if (lastTriggerIndex === -1) return null;
    
    // Trigger'dan sonraki kısım (query)
    const afterTrigger = beforeCursor.slice(lastTriggerIndex + 1);
    
    // Query içinde space varsa trigger geçersiz
    if (afterTrigger.includes(' ') || afterTrigger.includes('\n')) return null;
    
    // Satır başında mı kontrolü
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const atLineStart = lastTriggerIndex === lineStart || lastTriggerIndex === 0;
    
    return {
      query: afterTrigger,
      atLineStart,
    };
  },

  /**
   * Keyboard event handler
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    // Picker aktifse picker navigation
    if (this._activePicker !== 'none') {
      if (this._handlePickerKeyDown(e)) return;
    }

    // Ctrl+Enter - Gönder (CodeNomad pattern)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this._send();
      return;
    }

    // Enter (tek başına) - Yeni satır (default davranış, engelleme)
    // Shift+Enter da yeni satır

    // Escape - Picker kapat veya temizle
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this._activePicker !== 'none') {
        this._closePicker();
      } else if (this._shellMode) {
        this._toggleShellMode(false);
      } else {
        this.clear();
      }
      return;
    }

    // Arrow Up - Picker'da veya History'de geri git
    if (e.key === 'ArrowUp') {
      if (this._activePicker !== 'none') {
        // Picker navigation handled above
        return;
      }
      if (this._isAtStart()) {
        e.preventDefault();
        this._navigateHistory(-1);
      }
      return;
    }

    // Arrow Down - Picker'da veya History'de ileri git
    if (e.key === 'ArrowDown') {
      if (this._activePicker !== 'none') {
        // Picker navigation handled above
        return;
      }
      if (this._isAtEnd()) {
        e.preventDefault();
        this._navigateHistory(1);
      }
      return;
    }

    // Tab - Picker'da seçim yap
    if (e.key === 'Tab' && this._activePicker !== 'none') {
      e.preventDefault();
      this._selectPickerItem();
      return;
    }
  },

  /**
   * Picker keyboard navigation
   * @param {KeyboardEvent} e
   * @returns {boolean} Event handled
   */
  _handlePickerKeyDown(e) {
    const results = this._activePicker === 'mention' ? this._mentionResults : this._commandResults;
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._pickerIndex = Math.max(0, this._pickerIndex - 1);
      this._updatePickerSelection();
      return true;
    }
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._pickerIndex = Math.min(results.length - 1, this._pickerIndex + 1);
      this._updatePickerSelection();
      return true;
    }
    
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      this._selectPickerItem();
      return true;
    }
    
    if (e.key === 'Escape') {
      e.preventDefault();
      this._closePicker();
      return true;
    }
    
    return false;
  },

  /**
   * Mesaj gönder
   */
  _send() {
    if (this._isProcessing) return;
    
    const message = this.getValue();
    if (!message) return;

    // History'ye ekle
    this.addToHistory(message);

    // Callback çağır
    if (this._onSend) {
      this._onSend(message);
    }

    // Temizle
    this.clear();
  },

  /**
   * History'de gezin
   * @param {number} direction - -1: geri (önceki mesajlar), 1: ileri (yeni mesajlar)
   */
  _navigateHistory(direction) {
    if (this._history.length === 0) return;

    // İlk gezinme - mevcut değeri sakla
    if (this._historyIndex === -1 && direction === -1) {
      this._currentDraft = this.getValue();
    }

    // direction === -1 (yukarı ok) → history'de GERİ git (index ARTMALI)
    // direction === 1 (aşağı ok) → history'de İLERİ git (index AZALMALI)
    const newIndex = this._historyIndex - direction;

    if (newIndex < -1) {
      return; // Başı geçme
    }

    if (newIndex >= this._history.length) {
      return; // Sonu geçme
    }

    this._historyIndex = newIndex;

    if (this._historyIndex === -1) {
      // Draft'a dön
      this.setValue(this._currentDraft);
    } else {
      // History'den al
      this.setValue(this._history[this._historyIndex]);
    }

    // Cursor'u sona taşı
    if (this._input) {
      this._input.selectionStart = this._input.value.length;
      this._input.selectionEnd = this._input.value.length;
    }
  },

  /**
   * Cursor başta mı?
   * @returns {boolean}
   */
  _isAtStart() {
    if (!this._input) return false;
    return this._input.selectionStart === 0 && this._input.selectionEnd === 0;
  },

  /**
   * Cursor sonda mı?
   * @returns {boolean}
   */
  _isAtEnd() {
    if (!this._input) return false;
    const len = this._input.value.length;
    return this._input.selectionStart === len && this._input.selectionEnd === len;
  },

  /**
   * Textarea boyutunu otomatik ayarla
   */
  _autoResize() {
    if (!this._input) return;
    
    this._input.style.height = 'auto';
    const newHeight = Math.min(this._input.scrollHeight, 200);
    this._input.style.height = `${newHeight}px`;
  },

  /**
   * History'yi localStorage'a kaydet
   */
  _saveHistory() {
    try {
      localStorage.setItem('opencode-prompt-history', JSON.stringify(this._history));
    } catch {
      // Storage hatası - yoksay
    }
  },

  /**
   * History'yi localStorage'dan yükle
   */
  _loadHistory() {
    try {
      const saved = localStorage.getItem('opencode-prompt-history');
      if (saved) {
        this._history = JSON.parse(saved);
      }
    } catch {
      this._history = [];
    }
  },

  // =========================================================================
  // Shell Mode
  // =========================================================================

  /**
   * Shell mode toggle
   * @param {boolean} enabled
   */
  _toggleShellMode(enabled) {
    this._shellMode = enabled;
    
    const wrapper = this._input?.closest('.prompt-input-wrapper');
    if (wrapper) {
      wrapper.classList.toggle('shell-mode', enabled);
    }
    
    // Placeholder güncelle
    if (this._input) {
      this._input.placeholder = enabled 
        ? 'Shell komutu yazın... (Escape ile çık)'
        : 'Mesajınızı yazın... (Ctrl+Enter gönder)';
    }
  },

  // =========================================================================
  // Picker Dropdowns
  // =========================================================================

  /**
   * Picker dropdown'ları oluştur
   */
  _createPickerDropdowns() {
    const wrapper = this._input?.closest('.prompt-wrapper');
    if (!wrapper) return;
    
    // Mention dropdown
    if (!document.getElementById('mention-dropdown')) {
      const mentionDropdown = document.createElement('div');
      mentionDropdown.id = 'mention-dropdown';
      mentionDropdown.className = 'mention-dropdown hidden';
      wrapper.appendChild(mentionDropdown);
    }
    
    // Command dropdown
    if (!document.getElementById('command-dropdown')) {
      const commandDropdown = document.createElement('div');
      commandDropdown.id = 'command-dropdown';
      commandDropdown.className = 'command-dropdown hidden';
      wrapper.appendChild(commandDropdown);
    }
  },

  /**
   * Mention picker aç
   * @param {string} query - Arama terimi
   */
  async _openMentionPicker(query) {
    this._activePicker = 'mention';
    this._pickerIndex = 0;
    
    // API'den dosya listesi al
    try {
      if (typeof APIClient !== 'undefined' && APIClient.searchFiles) {
        const result = await APIClient.searchFiles(query, 8);
        if (result.files && result.files.length > 0) {
          this._mentionResults = result.files;
        } else {
          // API sonuç dönmezse fallback
          this._mentionResults = this._getMockMentionResults(query);
        }
      } else {
        this._mentionResults = this._getMockMentionResults(query);
      }
    } catch (err) {
      console.warn('[PromptHandler] File search failed:', err);
      this._mentionResults = this._getMockMentionResults(query);
    }
    
    this._renderMentionDropdown();
  },

  /**
   * Command picker aç
   * @param {string} query - Arama terimi
   */
  _openCommandPicker(query) {
    this._activePicker = 'command';
    this._pickerIndex = 0;
    
    // Commands config'den al (fallback ile)
    const commands = (typeof OpenCodeConfig !== 'undefined' && OpenCodeConfig.commands)
      ? OpenCodeConfig.commands
      : [
          { name: 'clear', description: 'Sohbeti temizle' },
          { name: 'new', description: 'Yeni oturum başlat' },
          { name: 'help', description: 'Yardım göster' },
          { name: 'history', description: 'Geçmişi göster' },
          { name: 'compact', description: 'Context\'i sıkıştır' },
          { name: 'cancel', description: 'İşlemi iptal et' },
          { name: 'retry', description: 'Son mesajı tekrarla' },
        ];
    
    // Query'ye göre filtrele
    this._commandResults = commands.filter(cmd => 
      cmd.name.toLowerCase().includes(query.toLowerCase())
    );
    
    this._renderCommandDropdown();
  },

  /**
   * Mock mention sonuçları (API entegrasyonu yapılacak)
   * @param {string} query
   * @returns {Array<{name: string, path?: string, type: string}>}
   */
  _getMockMentionResults(query) {
    const items = [
      { name: 'package.json', path: './package.json', type: 'file' },
      { name: 'tsconfig.json', path: './tsconfig.json', type: 'file' },
      { name: 'README.md', path: './README.md', type: 'file' },
      { name: 'src/', path: './src', type: 'folder' },
      { name: 'Coder Agent', path: null, type: 'agent' },
      { name: 'Reviewer Agent', path: null, type: 'agent' },
    ];
    
    if (!query) return items.slice(0, 5);
    
    return items.filter(item => 
      item.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  },

  /**
   * Mention dropdown render
   */
  _renderMentionDropdown() {
    const dropdown = document.getElementById('mention-dropdown');
    if (!dropdown) return;
    
    if (this._mentionResults.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }
    
    dropdown.innerHTML = this._mentionResults.map((item, i) => {
      const icon = item.type === 'folder' ? '📁' : item.type === 'agent' ? '🤖' : '📄';
      const selectedClass = i === this._pickerIndex ? 'selected' : '';
      return `
        <div class="mention-item ${selectedClass}" data-index="${i}">
          <span class="file-icon">${icon}</span>
          <span class="file-name">${item.name}</span>
          ${item.path ? `<span class="file-path">${item.path}</span>` : ''}
        </div>
      `;
    }).join('');
    
    // Click handlers
    dropdown.querySelectorAll('.mention-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index || '0');
        this._pickerIndex = index;
        this._selectPickerItem();
      });
    });
    
    dropdown.classList.remove('hidden');
  },

  /**
   * Command dropdown render
   */
  _renderCommandDropdown() {
    const dropdown = document.getElementById('command-dropdown');
    if (!dropdown) return;
    
    if (this._commandResults.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }
    
    dropdown.innerHTML = this._commandResults.map((cmd, i) => {
      const selectedClass = i === this._pickerIndex ? 'selected' : '';
      return `
        <div class="command-item ${selectedClass}" data-index="${i}">
          <span class="command-name">/${cmd.name}</span>
          <span class="command-desc">${cmd.description}</span>
        </div>
      `;
    }).join('');
    
    // Click handlers
    dropdown.querySelectorAll('.command-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index || '0');
        this._pickerIndex = index;
        this._selectPickerItem();
      });
    });
    
    dropdown.classList.remove('hidden');
  },

  /**
   * Picker selection güncelle
   */
  _updatePickerSelection() {
    const dropdownId = this._activePicker === 'mention' ? 'mention-dropdown' : 'command-dropdown';
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    dropdown.querySelectorAll('.mention-item, .command-item').forEach((el, i) => {
      el.classList.toggle('selected', i === this._pickerIndex);
    });
    
    // Scroll into view
    const selected = dropdown.querySelector('.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * Picker item seç
   */
  _selectPickerItem() {
    if (this._activePicker === 'mention') {
      const item = this._mentionResults[this._pickerIndex];
      if (item) {
        this._insertMention(item);
      }
    } else if (this._activePicker === 'command') {
      const cmd = this._commandResults[this._pickerIndex];
      if (cmd) {
        this._executeCommand(cmd.name);
      }
    }
    
    this._closePicker();
  },

  /**
   * Mention ekle
   * @param {{name: string, path?: string, type: string}} item
   */
  _insertMention(item) {
    if (!this._input) return;
    
    const value = this._input.value;
    const cursorPos = this._input.selectionStart || 0;
    const beforeCursor = value.slice(0, cursorPos);
    const afterCursor = value.slice(cursorPos);
    
    // @ karakterinden sonrasını bul ve değiştir
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    if (lastAtIndex === -1) return;
    
    const mention = item.type === 'agent' ? `@${item.name} ` : `@${item.path || item.name} `;
    const newValue = beforeCursor.slice(0, lastAtIndex) + mention + afterCursor;
    
    this._input.value = newValue;
    this._input.selectionStart = lastAtIndex + mention.length;
    this._input.selectionEnd = lastAtIndex + mention.length;
    
    // Attachment olarak ekle (opsiyonel)
    if (item.type === 'file' || item.type === 'folder') {
      this._addAttachment(item);
    }
    
    this._autoResize();
  },

  /**
   * Command çalıştır
   * @param {string} commandName
   */
  async _executeCommand(commandName) {
    // Input'u temizle
    this.clear();
    
    // Command'a göre işlem yap
    switch (commandName) {
      case 'clear':
        if (typeof MessageRenderer !== 'undefined') {
          MessageRenderer.clear();
        }
        if (typeof StoreBridge !== 'undefined') {
          StoreBridge.clear();
        }
        console.log('[PromptHandler] Chat cleared');
        break;
        
      case 'new':
        if (typeof OpenCodeApp !== 'undefined') {
          await OpenCodeApp._handleNewSession();
        }
        break;
        
      case 'cancel':
        if (typeof APIClient !== 'undefined') {
          try {
            await APIClient.cancel();
            console.log('[PromptHandler] Operation cancelled');
          } catch (err) {
            console.error('[PromptHandler] Cancel failed:', err);
          }
        }
        break;
        
      case 'help':
        // Help mesajını göster
        if (typeof MessageRenderer !== 'undefined') {
          const helpContent = `## Kullanılabilir Komutlar

- **/clear** - Sohbeti temizle
- **/new** - Yeni oturum başlat
- **/cancel** - Mevcut işlemi iptal et
- **/compact** - Context'i sıkıştır
- **/retry** - Son mesajı tekrarla
- **/history** - Komut geçmişini göster

## Kısayollar

- **Ctrl+Enter** - Mesaj gönder
- **@** - Dosya/agent seç
- **/** - Komut çalıştır
- **!** - Shell modu
- **↑↓** - Geçmişte gezin`;
          MessageRenderer.addMessage({
            id: `msg-help-${Date.now()}`,
            role: 'assistant',
            content: helpContent,
            timestamp: Date.now(),
          });
        }
        break;
        
      case 'compact':
        if (typeof APIClient !== 'undefined') {
          try {
            const result = await APIClient.compact();
            console.log('[PromptHandler] Compact result:', result);
            if (result.compactedTokens) {
              // Kullanıcıya bilgi ver
              if (typeof MessageRenderer !== 'undefined') {
                MessageRenderer.addMessage({
                  id: `msg-compact-${Date.now()}`,
                  role: 'assistant',
                  content: `✅ Context sıkıştırıldı. Kazanç: ${result.compactedTokens} token`,
                  timestamp: Date.now(),
                });
              }
            }
          } catch (err) {
            console.error('[PromptHandler] Compact failed:', err);
          }
        }
        break;
        
      case 'retry':
        if (typeof APIClient !== 'undefined') {
          try {
            await APIClient.retry();
            console.log('[PromptHandler] Retry initiated');
          } catch (err) {
            console.error('[PromptHandler] Retry failed:', err);
          }
        }
        break;
        
      case 'history':
        // Komut geçmişini göster
        if (this._history.length > 0) {
          const historyList = this._history.slice(0, 10).map((h, i) => `${i + 1}. ${h}`).join('\n');
          if (typeof MessageRenderer !== 'undefined') {
            MessageRenderer.addMessage({
              id: `msg-history-${Date.now()}`,
              role: 'assistant',
              content: `## Son Komutlar\n\n${historyList}`,
              timestamp: Date.now(),
            });
          }
        }
        break;
        
      default:
        console.log('[PromptHandler] Unknown command:', commandName);
    }
  },

  /**
   * Picker kapat
   */
  _closePicker() {
    this._activePicker = 'none';
    this._pickerIndex = 0;
    this._pickerQuery = '';
    
    document.getElementById('mention-dropdown')?.classList.add('hidden');
    document.getElementById('command-dropdown')?.classList.add('hidden');
  },

  // =========================================================================
  // Attachments
  // =========================================================================

  /**
   * Attachment ekle
   * @param {{name: string, path?: string, type: string}} item
   */
  _addAttachment(item) {
    const key = item.path || item.name;
    if (this._attachments.includes(key)) return;
    
    this._attachments.push(key);
    this._renderAttachments();
  },

  /**
   * Attachment kaldır
   * @param {string} key
   */
  _removeAttachment(key) {
    this._attachments = this._attachments.filter(a => a !== key);
    this._renderAttachments();
  },

  /**
   * Attachment'ları render et (AttachmentStore entegrasyonu)
   */
  _renderAttachments() {
    let container = document.getElementById('prompt-attachments');
    const sessionId = this._getCurrentSessionId();
    
    // AttachmentStore'dan attachment'ları al
    let attachments = [];
    if (typeof AttachmentStore !== 'undefined') {
      attachments = AttachmentStore.getAttachments(sessionId);
    } else {
      // Fallback: Eski basit array
      attachments = this._attachments.map(path => ({
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
    
    // Container yoksa oluştur
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
    container.innerHTML = attachments.map(att => this._renderAttachmentChip(att)).join('');
    
    // Remove handlers
    container.querySelectorAll('.remove-attachment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chip = btn.closest('.attachment-chip');
        const attId = chip?.dataset.attachmentId;
        if (attId) this._removeAttachmentById(attId);
      });
    });

    // Image preview handlers
    container.querySelectorAll('.attachment-preview').forEach(preview => {
      preview.addEventListener('click', (e) => {
        e.stopPropagation();
        const dataUrl = preview.dataset.fullImage;
        if (dataUrl) this._showImagePreview(dataUrl);
      });
    });
  },

  /**
   * Tek bir attachment chip'i render et
   * @param {Object} att - Attachment object
   * @returns {string} HTML
   */
  _renderAttachmentChip(att) {
    const icon = this._getAttachmentIcon(att.type, att.mimeType);
    const sizeStr = att.size ? this._formatFileSize(att.size) : '';
    
    // Image preview için thumbnail
    let previewHtml = '';
    if (att.type === 'image' && att.dataUrl) {
      previewHtml = `
        <div class="attachment-preview" data-full-image="${att.dataUrl}" title="Önizleme için tıkla">
          <img src="${att.dataUrl}" alt="${att.name}" />
        </div>
      `;
    }
    
    return `
      <div class="attachment-chip ${att.type}" data-attachment-id="${att.id}" title="${att.name}${sizeStr ? ' (' + sizeStr + ')' : ''}">
        ${previewHtml || `<span class="attachment-icon">${icon}</span>`}
        <span class="attachment-name">${this._truncateName(att.name, 20)}</span>
        ${sizeStr ? `<span class="attachment-size">${sizeStr}</span>` : ''}
        <button class="remove-attachment" title="Kaldır">×</button>
      </div>
    `;
  },

  /**
   * Attachment türüne göre icon
   * @param {string} type
   * @param {string} [mimeType]
   * @returns {string}
   */
  _getAttachmentIcon(type, mimeType) {
    if (type === 'image') return '🖼️';
    if (type === 'text') return '📝';
    if (type === 'agent') return '🤖';
    
    // File type icons based on mime
    if (mimeType) {
      if (mimeType.includes('javascript') || mimeType.includes('typescript')) return '🟨';
      if (mimeType.includes('python')) return '🐍';
      if (mimeType.includes('json')) return '📋';
      if (mimeType.includes('html')) return '🌐';
      if (mimeType.includes('css')) return '🎨';
      if (mimeType.includes('markdown')) return '📖';
    }
    
    return '📄';
  },

  /**
   * Dosya boyutunu formatla
   * @param {number} bytes
   * @returns {string}
   */
  _formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  },

  /**
   * İsim kısaltma
   * @param {string} name
   * @param {number} maxLen
   * @returns {string}
   */
  _truncateName(name, maxLen) {
    if (!name || name.length <= maxLen) return name;
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    const baseName = name.slice(0, name.length - ext.length);
    const truncLen = maxLen - ext.length - 3;
    return baseName.slice(0, truncLen) + '...' + ext;
  },

  /**
   * Attachment'ı ID ile kaldır
   * @param {string} attachmentId
   */
  _removeAttachmentById(attachmentId) {
    const sessionId = this._getCurrentSessionId();
    
    if (typeof AttachmentStore !== 'undefined') {
      AttachmentStore.removeAttachment(sessionId, attachmentId);
    } else {
      // Fallback
      this._attachments = this._attachments.filter(p => p !== attachmentId);
      this._renderAttachments();
    }
  },

  /**
   * Resim önizleme modalı göster
   * @param {string} dataUrl
   */
  _showImagePreview(dataUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
      <div class="image-preview-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="image-preview-content">
        <img src="${dataUrl}" alt="Preview" />
        <button class="image-preview-close" onclick="this.closest('.image-preview-modal').remove()">×</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    // ESC ile kapat
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  },

  /**
   * Tüm attachment'ları al (API formatında)
   * @returns {Array}
   */
  getAttachments() {
    const sessionId = this._getCurrentSessionId();
    
    if (typeof AttachmentStore !== 'undefined') {
      return AttachmentStore.getAttachmentsForAPI(sessionId);
    }
    
    // Fallback
    return this._attachments.map(path => ({
      type: 'file',
      name: path.split('/').pop(),
      path,
    }));
  },

  /**
   * Attachment'ları temizle
   */
  clearAttachments() {
    const sessionId = this._getCurrentSessionId();
    
    if (typeof AttachmentStore !== 'undefined') {
      AttachmentStore.clearAttachments(sessionId);
    } else {
      this._attachments = [];
      this._renderAttachments();
    }
  },

  // =========================================================================
  // Paste, Drag & Drop Handlers (AttachmentStore entegrasyonu)
  // =========================================================================

  /**
   * Paste handler - resim ve dosya yapıştırma desteği
   * @param {ClipboardEvent} e
   */
  async _handlePaste(e) {
    // Auto-resize için timeout
    setTimeout(() => this._autoResize(), 0);

    // AttachmentStore ile paste işleme
    if (typeof AttachmentStore !== 'undefined') {
      const sessionId = this._getCurrentSessionId();
      const attachments = await AttachmentStore.handlePaste(e, sessionId);
      
      if (attachments.length > 0) {
        console.log('[PromptHandler] Pasted attachments:', attachments.length);
        // Eğer sadece resim paste edildiyse, default davranışı engelle
        const hasOnlyImages = attachments.every(a => a.type === 'image');
        if (hasOnlyImages) {
          e.preventDefault();
        }
      }
    }
  },

  /**
   * Drag over handler
   * @param {DragEvent} e
   */
  _handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    const wrapper = this._input?.closest('.prompt-input-wrapper');
    if (wrapper && !wrapper.classList.contains('drag-over')) {
      wrapper.classList.add('drag-over');
    }
  },

  /**
   * Drag leave handler
   * @param {DragEvent} e
   */
  _handleDragLeave(e) {
    e.preventDefault();
    
    // Sadece wrapper'dan çıkıldığında kaldır
    const wrapper = this._input?.closest('.prompt-input-wrapper');
    if (wrapper && !wrapper.contains(e.relatedTarget)) {
      wrapper.classList.remove('drag-over');
    }
  },

  /**
   * Drop handler - AttachmentStore entegrasyonu
   * @param {DragEvent} e
   */
  async _handleDrop(e) {
    e.preventDefault();
    this._input?.closest('.prompt-input-wrapper')?.classList.remove('drag-over');
    
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    // AttachmentStore ile drop işleme
    if (typeof AttachmentStore !== 'undefined') {
      const sessionId = this._getCurrentSessionId();
      const attachments = await AttachmentStore.handleDrop(e, sessionId);
      console.log('[PromptHandler] Dropped attachments:', attachments.length);
    } else {
      // Fallback: Eski basit sistem
      Array.from(files).forEach(file => {
        this._addAttachment({
          name: file.name,
          path: file.name,
          type: 'file',
        });
      });
    }
  },

  /**
   * Mevcut session ID'sini al
   * @returns {string}
   */
  _getCurrentSessionId() {
    if (typeof SessionStore !== 'undefined') {
      return SessionStore.getCurrentSessionId() || 'default';
    }
    return 'default';
  },

  // =========================================================================
  // Draft Persistence
  // =========================================================================

  /** @type {number | null} */
  _draftSaveTimeout: null,

  /**
   * Draft'u kaydet (debounced)
   */
  _saveDraftDebounced() {
    if (this._draftSaveTimeout) {
      clearTimeout(this._draftSaveTimeout);
    }
    
    this._draftSaveTimeout = setTimeout(() => {
      this._saveDraft();
    }, 500);
  },

  /**
   * Draft'u localStorage'a kaydet
   */
  _saveDraft() {
    const value = this._input?.value || '';
    try {
      if (value.trim()) {
        localStorage.setItem('opencode-prompt-draft', value);
      } else {
        localStorage.removeItem('opencode-prompt-draft');
      }
    } catch {
      // Storage hatası
    }
  },

  /**
   * Draft'u localStorage'dan yükle
   */
  _loadDraft() {
    try {
      const draft = localStorage.getItem('opencode-prompt-draft');
      if (draft && this._input) {
        this._input.value = draft;
        this._autoResize();
      }
    } catch {
      // Storage hatası
    }
  }
};

// Global'e ekle
window.PromptHandler = PromptHandler;
