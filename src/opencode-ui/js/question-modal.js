/**
 * OpenCode UI - Question Modal
 * 
 * Queue-based question handling UI for AI questions
 * Supports text input, select, and confirm question types
 */

const QuestionModal = {
  /** @type {HTMLElement | null} */
  _modal: null,

  /** @type {HTMLElement | null} */
  _overlay: null,

  /** @type {Function | null} */
  _unsubscribe: null,

  /** @type {Function | null} Bound keydown handler for cleanup */
  _boundKeydownHandler: null,

  /** @type {boolean} */
  _isVisible: false,

  /** @type {string | null} */
  _currentAnswer: null,

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize question modal
   */
  init() {
    this._createModal();
    
    // Subscribe to question store changes
    if (typeof MessageStore !== 'undefined') {
      this._unsubscribe = MessageStore.subscribe((event) => {
        if (event.type?.startsWith('question:')) {
          this._onQuestionChange();
        }
      });
    }
    
    console.log('[QuestionModal] Initialized');
  },

  /**
   * Cleanup
   */
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    // Remove keyboard event listener to prevent memory leak
    if (this._boundKeydownHandler) {
      document.removeEventListener('keydown', this._boundKeydownHandler);
      this._boundKeydownHandler = null;
    }
    this._modal?.remove();
    this._overlay?.remove();
  },

  // ===========================================================================
  // Modal Creation
  // ===========================================================================

  /**
   * Create modal elements
   */
  _createModal() {
    // Overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'question-overlay';
    
    // Modal
    this._modal = document.createElement('div');
    this._modal.className = 'question-modal';
    this._modal.innerHTML = `
      <div class="question-header">
        <div class="question-icon">❓</div>
        <h3 class="question-title">Soru</h3>
        <span class="question-queue-badge" style="display: none;"></span>
      </div>
      <div class="question-body">
        <div class="question-text"></div>
        <div class="question-input-container"></div>
      </div>
      <div class="question-footer">
        <button class="question-btn question-btn-skip">
          Atla
        </button>
        <button class="question-btn question-btn-submit">
          Gönder
        </button>
      </div>
    `;

    // Event listeners
    const skipBtn = this._modal.querySelector('.question-btn-skip');
    const submitBtn = this._modal.querySelector('.question-btn-submit');
    
    skipBtn?.addEventListener('click', () => this._handleSkip());
    submitBtn?.addEventListener('click', () => this._handleSubmit());

    // Keyboard handler - bound function for cleanup
    this._boundKeydownHandler = (e) => this._handleKeydown(e);
    document.addEventListener('keydown', this._boundKeydownHandler);

    // Add to DOM but hidden
    document.body.appendChild(this._overlay);
    document.body.appendChild(this._modal);
  },

  // ===========================================================================
  // Question Handling
  // ===========================================================================

  /**
   * Handle question store change
   */
  _onQuestionChange() {
    if (typeof MessageStore === 'undefined') return;

    const active = MessageStore.getActiveQuestion();
    const queue = MessageStore.getQuestionQueue();

    if (active) {
      this._showQuestion(active, queue.length);
    } else {
      this._hide();
    }
  },

  /**
   * Show question
   * @param {Object} entry - Question entry
   * @param {number} queueLength - Total items in queue
   */
  _showQuestion(entry, queueLength) {
    if (!this._modal) return;

    const { question } = entry;
    this._currentAnswer = question.default || null;
    
    // Update content
    const textEl = this._modal.querySelector('.question-text');
    const inputContainer = this._modal.querySelector('.question-input-container');
    const queueBadge = this._modal.querySelector('.question-queue-badge');

    if (textEl) {
      textEl.textContent = question.text;
    }

    if (inputContainer) {
      inputContainer.innerHTML = this._renderInput(question);
      this._setupInputListeners(inputContainer, question);
    }

    // Queue badge
    if (queueBadge) {
      if (queueLength > 1) {
        queueBadge.textContent = `+${queueLength - 1} daha`;
        queueBadge.style.display = 'inline-block';
      } else {
        queueBadge.style.display = 'none';
      }
    }

    // Store current question ID
    this._modal.setAttribute('data-question-id', question.id);

    this._show();
  },

  /**
   * Render input based on question type
   * @param {Object} question
   * @returns {string}
   */
  _renderInput(question) {
    switch (question.type) {
      case 'confirm':
        return `
          <div class="question-confirm">
            <button class="confirm-btn confirm-yes ${question.default === 'yes' ? 'selected' : ''}" data-value="yes">
              ✓ Evet
            </button>
            <button class="confirm-btn confirm-no ${question.default === 'no' ? 'selected' : ''}" data-value="no">
              ✕ Hayır
            </button>
          </div>
        `;

      case 'select':
      case 'multi-select':
        const isMulti = question.type === 'multi-select';
        const defaultValues = isMulti ? (question.default || []) : [question.default];
        const options = (question.options || []).map((opt, idx) => `
          <div class="select-option ${defaultValues.includes(opt.value) ? 'selected' : ''}" data-value="${this._escapeHtml(opt.value)}">
            <span class="option-indicator">${isMulti ? '☐' : '○'}</span>
            <span class="option-number">${idx + 1}</span>
            <span class="option-label">${this._escapeHtml(opt.label)}</span>
            ${opt.description ? `<span class="option-desc">${this._escapeHtml(opt.description)}</span>` : ''}
          </div>
        `).join('');
        const hint = isMulti ? '<div class="select-hint">Space veya tıkla: Seç/Bırak • Enter: Gönder • 1-9: Hızlı seçim</div>' : '';
        return `<div class="question-select ${isMulti ? 'multi-select' : ''}">${options}${hint}</div>`;

      case 'text':
      default:
        return `
          <div class="question-text-input">
            <input 
              type="text" 
              class="text-input" 
              placeholder="Cevabınızı yazın..."
              value="${this._escapeHtml(question.default || '')}"
            />
          </div>
        `;
    }
  },

  /**
   * Setup input event listeners
   * @param {HTMLElement} container
   * @param {Object} question
   */
  _setupInputListeners(container, question) {
    switch (question.type) {
      case 'confirm':
        container.querySelectorAll('.confirm-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            container.querySelectorAll('.confirm-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            this._currentAnswer = btn.getAttribute('data-value');
          });
        });
        break;

      case 'select':
        container.querySelectorAll('.select-option').forEach(opt => {
          opt.addEventListener('click', () => {
            container.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            this._currentAnswer = opt.getAttribute('data-value');
          });
        });
        break;

      case 'text':
      default:
        const input = container.querySelector('.text-input');
        if (input) {
          input.addEventListener('input', (e) => {
            this._currentAnswer = e.target.value;
          });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              this._handleSubmit();
            }
          });
          // Focus input
          setTimeout(() => input.focus(), 100);
        }
        break;
    }
  },

  // ===========================================================================
  // Actions
  // ===========================================================================

  /**
   * Handle submit action
   */
  _handleSubmit() {
    const questionId = this._modal?.getAttribute('data-question-id');
    if (!questionId) return;

    console.log('[QuestionModal] Submitted:', questionId, this._currentAnswer);
    
    // Emit event for SSE server
    this._emitResponse(questionId, this._currentAnswer);
    
    // Remove from store
    if (typeof MessageStore !== 'undefined') {
      MessageStore.removeQuestion(questionId);
    }

    this._currentAnswer = null;
  },

  /**
   * Handle skip action
   */
  _handleSkip() {
    const questionId = this._modal?.getAttribute('data-question-id');
    if (!questionId) return;

    console.log('[QuestionModal] Skipped:', questionId);
    
    // Emit event with null answer
    this._emitResponse(questionId, null);
    
    // Remove from store
    if (typeof MessageStore !== 'undefined') {
      MessageStore.removeQuestion(questionId);
    }

    this._currentAnswer = null;
  },

  /**
   * Emit question response event
   * @param {string} questionId
   * @param {string | null} answer
   */
  _emitResponse(questionId, answer) {
    // Dispatch custom event for app.js to handle
    const event = new CustomEvent('question:response', {
      detail: { questionId, answer }
    });
    document.dispatchEvent(event);
  },

  /**
   * Handle keyboard shortcuts
   * CodeNomad pattern: 1-4 for options, Enter to submit, Escape to skip
   * @param {KeyboardEvent} e
   */
  _handleKeydown(e) {
    if (!this._isVisible) return;

    // Escape = Skip
    if (e.key === 'Escape') {
      e.preventDefault();
      this._handleSkip();
      return;
    }

    // Skip number shortcuts if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Number keys 1-9 for option selection
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9) {
      e.preventDefault();
      this._selectOptionByIndex(num - 1);
      return;
    }

    // Enter = Submit (when not in text input)
    if (e.key === 'Enter') {
      e.preventDefault();
      this._handleSubmit();
      return;
    }

    // Arrow keys for navigation
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      this._navigateOptions(e.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    // Space to toggle selection (for multi-select)
    if (e.key === ' ') {
      e.preventDefault();
      this._toggleCurrentSelection();
      return;
    }
  },

  /**
   * Select option by index (0-based)
   * @param {number} index
   */
  _selectOptionByIndex(index) {
    const container = this._modal?.querySelector('.question-input-container');
    if (!container) return;

    // For select type
    const options = container.querySelectorAll('.select-option');
    if (options.length > index) {
      const option = options[index];
      
      // Check if multi-select
      if (container.querySelector('.question-select.multi-select')) {
        option.classList.toggle('selected');
        this._updateMultiSelectAnswer();
      } else {
        options.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this._currentAnswer = option.getAttribute('data-value');
      }
      return;
    }

    // For confirm type
    const confirmBtns = container.querySelectorAll('.confirm-btn');
    if (confirmBtns.length > index) {
      confirmBtns.forEach(b => b.classList.remove('selected'));
      confirmBtns[index].classList.add('selected');
      this._currentAnswer = confirmBtns[index].getAttribute('data-value');
    }
  },

  /**
   * Navigate options with arrow keys
   * @param {number} direction - -1 for up, 1 for down
   */
  _navigateOptions(direction) {
    const container = this._modal?.querySelector('.question-input-container');
    if (!container) return;

    const options = container.querySelectorAll('.select-option, .confirm-btn');
    if (options.length === 0) return;

    // Find currently focused/selected option
    let currentIndex = -1;
    options.forEach((opt, i) => {
      if (opt.classList.contains('focused') || opt.classList.contains('selected')) {
        currentIndex = i;
      }
    });

    // Calculate new index
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 0;

    // Update focus
    options.forEach(o => o.classList.remove('focused'));
    options[newIndex].classList.add('focused');
    options[newIndex].scrollIntoView({ block: 'nearest' });
  },

  /**
   * Toggle selection for focused option (multi-select)
   */
  _toggleCurrentSelection() {
    const container = this._modal?.querySelector('.question-input-container');
    if (!container) return;

    const focused = container.querySelector('.select-option.focused, .confirm-btn.focused');
    if (focused) {
      focused.click();
    }
  },

  /**
   * Update answer for multi-select
   */
  _updateMultiSelectAnswer() {
    const container = this._modal?.querySelector('.question-input-container');
    if (!container) return;

    const selected = container.querySelectorAll('.select-option.selected');
    const values = Array.from(selected).map(el => el.getAttribute('data-value'));
    this._currentAnswer = values;
  },

  // ===========================================================================
  // Visibility
  // ===========================================================================

  /**
   * Show modal
   */
  _show() {
    if (this._isVisible) return;
    
    this._overlay?.classList.add('visible');
    this._modal?.classList.add('visible');
    this._isVisible = true;
  },

  /**
   * Hide modal
   */
  _hide() {
    if (!this._isVisible) return;
    
    this._overlay?.classList.remove('visible');
    this._modal?.classList.remove('visible');
    this._isVisible = false;
  },

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Escape HTML
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Manually show a question (for testing or direct calls)
   * @param {Object} question
   */
  showQuestion(question) {
    if (typeof MessageStore !== 'undefined') {
      MessageStore.upsertQuestion({
        id: question.id,
        messageId: '',
        question,
      });
    }
  },

  /**
   * Check if modal is visible
   * @returns {boolean}
   */
  isVisible() {
    return this._isVisible;
  },
};

// Global export
window.QuestionModal = QuestionModal;
