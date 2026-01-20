/**
 * OpenCode UI - Prompt Handler
 * 
 * Input alanını yönetir.
 * Keyboard shortcuts, history ve auto-resize içerir.
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
  // Initialization
  // =========================================================================

  /**
   * Prompt handler'ı başlat
   * @param {object} options
   * @param {HTMLTextAreaElement} options.input - Input element
   * @param {HTMLButtonElement} options.sendButton - Send button
   * @param {Function} options.onSend - Send callback
   */
  init(options) {
    this._input = options.input;
    this._sendButton = options.sendButton;
    this._onSend = options.onSend;

    if (this._input) {
      this._input.addEventListener('input', () => this._handleInput());
      this._input.addEventListener('keydown', (e) => this._handleKeyDown(e));
      this._input.addEventListener('paste', () => setTimeout(() => this._autoResize(), 0));
    }

    if (this._sendButton) {
      this._sendButton.addEventListener('click', () => this._send());
    }

    // History'yi localStorage'dan yükle
    this._loadHistory();
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
    
    // Max 50 mesaj tut
    if (this._history.length > 50) {
      this._history = this._history.slice(0, 50);
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
  },

  /**
   * Keyboard event handler
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    // Enter - Gönder (Shift+Enter değil)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._send();
      return;
    }

    // Escape - Temizle
    if (e.key === 'Escape') {
      e.preventDefault();
      this.clear();
      return;
    }

    // Arrow Up - History'de geri git
    if (e.key === 'ArrowUp' && this._isAtStart()) {
      e.preventDefault();
      this._navigateHistory(-1);
      return;
    }

    // Arrow Down - History'de ileri git
    if (e.key === 'ArrowDown' && this._isAtEnd()) {
      e.preventDefault();
      this._navigateHistory(1);
      return;
    }
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
  }
};

// Global'e ekle
window.PromptHandler = PromptHandler;
