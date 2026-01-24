/**
 * OpenCode UI - Message Renderer
 * 
 * Mesaj kartlarını render eder.
 * Markdown parsing ve syntax highlighting içerir.
 */

const MessageRenderer = {
  /** @type {HTMLElement | null} */
  _container: null,

  /** @type {Map<string, HTMLElement>} */
  _messageElements: new Map(),

  /** @type {string | null} */
  _streamingMessageId: null,

  /** @type {Function | null} Store unsubscribe function */
  _unsubscribe: null,

  /** @type {Map<string, number>} Message revision cache for change detection */
  _revisionCache: new Map(),

  /** @type {boolean} Enable store-based reactive rendering */
  _reactiveMode: false,

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Message renderer'ı başlat
   * @param {HTMLElement} container - Mesajların eklenmeceği container
   * @param {Object} [options] - Configuration options
   * @param {boolean} [options.reactive=false] - Enable store-based reactive rendering
   */
  init(container, options = {}) {
    this._container = container;
    this._messageElements.clear();
    this._revisionCache = new Map();
    this._streamingMessageId = null;
    this._reactiveMode = options.reactive ?? false;

    // Subscribe to stores if reactive mode enabled
    if (this._reactiveMode) {
      if (typeof MessageStore !== 'undefined') {
        this._unsubscribeMessage = MessageStore.subscribe((event) => this._onStoreChange(event));
      }
      if (typeof SessionStore !== 'undefined') {
        this._unsubscribeSession = SessionStore.subscribe((event) => this._onSessionChange(event));
      }
      console.log('[MessageRenderer] Reactive mode enabled - subscribed to MessageStore and SessionStore');
    }
  },

  /**
   * Handle session store change
   * @param {Object} event
   */
  _onSessionChange(event) {
    if (!this._reactiveMode) return;

    // When session changes, re-render with new session's messages
    if (event.type === 'session:changed' || event.type === 'status:changed') {
      const sessionId = SessionStore.getCurrentSessionId();
      if (sessionId) {
        console.log('[MessageRenderer] Session changed, re-rendering:', sessionId);
        this._clearRenderedMessages();
        this._reconcileFromStore(sessionId);
      }
    }
  },

  /**
   * Clear all rendered message elements (without touching store)
   */
  _clearRenderedMessages() {
    this._messageElements.forEach((el) => el.remove());
    this._messageElements.clear();
    this._revisionCache.clear();
  },

  /**
   * Cleanup subscriptions
   */
  destroy() {
    if (this._unsubscribeMessage) {
      this._unsubscribeMessage();
      this._unsubscribeMessage = null;
    }
    if (this._unsubscribeSession) {
      this._unsubscribeSession();
      this._unsubscribeSession = null;
    }
  },

  /**
   * Handle store change event
   * @param {Object} event - Store event
   */
  _onStoreChange(event) {
    if (!this._reactiveMode) return;

    const sessionId = typeof SessionStore !== 'undefined' ? SessionStore.getCurrentSessionId() : null;
    if (!sessionId) return;

    // Only react to relevant events
    if (event.type === 'session:changed' && event.sessionId !== sessionId) {
      return;
    }

    // Reconcile UI with store state
    this._reconcileFromStore(sessionId);
  },

  /**
   * Reconcile DOM with store state (reactive rendering)
   * @param {string} sessionId
   */
  _reconcileFromStore(sessionId) {
    if (!this._container || !sessionId) return;
    if (typeof MessageStore === 'undefined') return;

    const messages = MessageStore.getSessionMessages(sessionId);
    const currentIds = new Set(messages.map(m => m.id));
    const renderedIds = new Set(this._messageElements.keys());

    // Remove messages no longer in store
    for (const id of renderedIds) {
      if (!currentIds.has(id)) {
        const el = this._messageElements.get(id);
        el?.remove();
        this._messageElements.delete(id);
        this._revisionCache.delete(id);
      }
    }

    // Add/update messages from store
    messages.forEach((record) => {
      const existingEl = this._messageElements.get(record.id);
      const cachedRevision = this._revisionCache.get(record.id);

      if (!existingEl) {
        // New message - create element with status for optimistic updates
        this._hideWelcome();
        const content = MessageStore.getMessageContent(record.id);
        const element = this._createMessageElement({
          id: record.id,
          role: record.role,
          content: content,
          timestamp: record.createdAt,
        }, record.status); // Pass status for styling
        this._messageElements.set(record.id, element);
        this._revisionCache.set(record.id, record.revision);
        this._container.appendChild(element);
      } else if (cachedRevision !== record.revision) {
        // Message updated - reconcile content and status
        this._updateMessageFromStore(existingEl, record);
        this._revisionCache.set(record.id, record.revision);
      }
    });

    this._scrollToBottom();
  },

  /**
   * Update existing message element from store record
   * @param {HTMLElement} element
   * @param {Object} record - MessageRecord from store
   */
  _updateMessageFromStore(element, record) {
    if (typeof MessageStore === 'undefined') return;
    
    const body = element.querySelector('.message-body');
    if (!body) return;

    const content = MessageStore.getMessageContent(record.id);
    const isStreaming = record.status === 'streaming';
    const previousStatus = element.getAttribute('data-status');

    // Update status class if changed
    if (previousStatus !== record.status) {
      // Remove old status class
      element.classList.remove('sending', 'streaming', 'complete', 'error');
      // Add new status class
      element.classList.add(record.status);
      element.setAttribute('data-status', record.status);
      
      // Update status indicator in header
      this._updateStatusIndicator(element, record.status);
    }

    // Update content - use text container to preserve tool cards
    body.setAttribute('data-raw-content', content);
    
    // Get or create text content container
    let textContainer = body.querySelector('.message-text-content');
    if (!textContainer) {
      textContainer = document.createElement('div');
      textContainer.className = 'message-text-content';
      // Insert at beginning, before any tool cards
      body.insertBefore(textContainer, body.firstChild);
    }
    
    // Update only text content (preserves tool cards)
    if (isStreaming) {
      textContainer.innerHTML = this._renderMarkdown(content) + this._createStreamingIndicator();
    } else {
      textContainer.innerHTML = this._renderMarkdown(content);
    }

    // Handle thinking parts (insert before text content)
    const parts = MessageStore.getMessageParts(record.id);
    const thinkingPart = parts.find(p => p.type === 'thinking');
    if (thinkingPart) {
      this._updateThinkingFromStore(element, thinkingPart, textContainer);
    }

    // Handle tool parts via ToolRenderer (append after text)
    const toolParts = parts.filter(p => p.type === 'tool');
    toolParts.forEach(part => {
      if (part.toolCall && typeof ToolRenderer !== 'undefined') {
        let toolEl = body.querySelector(`[data-tool-id="${part.toolCall.toolId}"]`);
        if (!toolEl) {
          toolEl = ToolRenderer.createToolCard(part.toolCall);
          body.appendChild(toolEl);
        } else {
          ToolRenderer.updateToolCard(part.toolCall.toolId, part.toolCall);
        }
      }
    });

    // Handle step parts (token tracking cards)
    const stepParts = parts.filter(p => p.type === 'step');
    stepParts.forEach(part => {
      if (part.step) {
        this._updateStepCard(body, part);
      }
    });

    // Handle retry button for error state (append at end)
    if (record.status === 'error') {
      let retryBtn = body.querySelector('.message-retry-btn');
      if (!retryBtn) {
        retryBtn = this._createRetryButton(record.id);
        body.appendChild(retryBtn);
      }
    } else {
      const retryBtn = body.querySelector('.message-retry-btn');
      if (retryBtn) retryBtn.remove();
    }
  },

  /**
   * Update status indicator in message header
   * @param {HTMLElement} element
   * @param {import('./stores/types.js').MessageStatus} status
   */
  _updateStatusIndicator(element, status) {
    const header = element.querySelector('.message-header');
    if (!header) return;

    // Remove existing status indicator
    const existingStatus = header.querySelector('.message-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    // Add new status indicator if needed
    const indicatorHtml = this._createStatusIndicator(status);
    if (indicatorHtml) {
      header.insertAdjacentHTML('beforeend', indicatorHtml);
    }
  },


  // =========================================================================
  // Step Card Rendering (Token Tracking - FAZ 4)
  // =========================================================================

  /**
   * Update or create step card
   * @param {HTMLElement} body - Message body element
   * @param {Object} part - Step part from store
   */
  _updateStepCard(body, part) {
    const step = part.step;
    if (!step || !step.stepId) return;

    let stepCard = body.querySelector(`[data-step-id="${step.stepId}"]`);

    if (!stepCard) {
      // Create new step card
      stepCard = document.createElement('div');
      stepCard.className = 'step-card';
      stepCard.setAttribute('data-step-id', step.stepId);
      stepCard.setAttribute('data-expanded', 'false');
      body.appendChild(stepCard);
    }

    // Update step card content based on status
    if (step.status === 'start') {
      stepCard.innerHTML = this._renderStepCardStart(step);
      stepCard.classList.remove('completed');
      stepCard.classList.add('running');
    } else if (step.status === 'finish') {
      stepCard.innerHTML = this._renderStepCardFinish(step);
      stepCard.classList.remove('running');
      stepCard.classList.add('completed');
    }
  },

  /**
   * Render step card for start status (running)
   * @param {Object} step
   * @returns {string}
   */
  _renderStepCardStart(step) {
    return `
      <div class="step-card-header" onclick="MessageRenderer._toggleStepCard(this)">
        <div class="step-card-icon running">
          <div class="step-spinner"></div>
        </div>
        <span class="step-card-title">Step çalışıyor...</span>
        <span class="step-card-toggle">▶</span>
      </div>
      <div class="step-card-content" style="display: none;">
        <div class="step-meta">
          <span class="step-meta-item">ID: ${this._escapeHtml(step.stepId)}</span>
          <span class="step-meta-item">Başlangıç: ${this._formatTime(step.startedAt)}</span>
        </div>
      </div>
    `;
  },

  /**
   * Render step card for finish status (completed with tokens)
   * @param {Object} step
   * @returns {string}
   */
  _renderStepCardFinish(step) {
    const inputTokens = step.inputTokens || 0;
    const outputTokens = step.outputTokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const cost = step.cost || 0;
    const duration = step.finishedAt && step.startedAt 
      ? ((step.finishedAt - step.startedAt) / 1000).toFixed(1) 
      : '?';
    const startTime = this._formatTime(step.startedAt);
    const endTime = this._formatTime(step.finishedAt);

    // Tooltip data for badges
    const tokenTooltip = `Input: ${inputTokens.toLocaleString()} | Output: ${outputTokens.toLocaleString()}`;
    const costTooltip = `Tahmini maliyet: $${cost.toFixed(6)}`;
    const durationTooltip = `${startTime} - ${endTime}`;

    return `
      <div class="step-card-header" onclick="MessageRenderer._toggleStepCard(this)">
        <div class="step-card-icon completed">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span class="step-card-title">Step tamamlandı</span>
        <span class="step-card-summary">
          <span class="token-badge" title="${tokenTooltip}">${this._formatTokenCount(totalTokens)} tokens</span>
          <span class="cost-badge" title="${costTooltip}">$${cost.toFixed(4)}</span>
          <span class="duration-badge" title="${durationTooltip}">${duration}s</span>
        </span>
        <span class="step-card-toggle">▶</span>
      </div>
      <div class="step-card-content">
        <div class="step-token-breakdown">
          <div class="token-row">
            <span class="token-label">Input tokens:</span>
            <span class="token-value input">${inputTokens.toLocaleString()}</span>
          </div>
          <div class="token-row">
            <span class="token-label">Output tokens:</span>
            <span class="token-value output">${outputTokens.toLocaleString()}</span>
          </div>
          <div class="token-row total">
            <span class="token-label">Toplam:</span>
            <span class="token-value">${totalTokens.toLocaleString()}</span>
          </div>
          <div class="token-row cost">
            <span class="token-label">Maliyet:</span>
            <span class="token-value">$${cost.toFixed(6)}</span>
          </div>
        </div>
        <div class="step-actions">
          <button class="step-copy-btn" onclick="MessageRenderer._copyStepStats(event, ${inputTokens}, ${outputTokens}, ${cost})" title="İstatistikleri kopyala">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Kopyala
          </button>
        </div>
        <div class="step-meta">
          <span class="step-meta-item">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${duration}s
          </span>
          <span class="step-meta-item">${startTime} → ${endTime}</span>
        </div>
      </div>
    `;
  },

  /**
   * Copy step statistics to clipboard
   * @param {Event} event
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @param {number} cost
   */
  _copyStepStats(event, inputTokens, outputTokens, cost) {
    event.stopPropagation();
    
    const stats = `Token Kullanımı:\n- Input: ${inputTokens.toLocaleString()}\n- Output: ${outputTokens.toLocaleString()}\n- Toplam: ${(inputTokens + outputTokens).toLocaleString()}\n- Maliyet: $${cost.toFixed(6)}`;
    
    navigator.clipboard.writeText(stats).then(() => {
      const btn = event.currentTarget;
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Kopyalandı!
      `;
      btn.classList.add('copied');
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('copied');
      }, 1500);
    });
  },

  /**
   * Toggle step card expand/collapse with smooth animation
   * @param {HTMLElement} header
   */
  _toggleStepCard(header) {
    const card = header.closest('.step-card');
    if (!card) return;

    const isExpanded = card.getAttribute('data-expanded') === 'true';

    // Toggle state - CSS handles the animation via max-height/opacity
    card.setAttribute('data-expanded', isExpanded ? 'false' : 'true');
  },

  /**
   * Format token count (1.5K, 12K, etc)
   * @param {number} count
   * @returns {string}
   */
  _formatTokenCount(count) {
    if (!count || count === 0) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  },

  /**
   * Format timestamp to time string
   * @param {number} timestamp
   * @returns {string}
   */
  _formatTime(timestamp) {
    if (!timestamp) return '?';
    return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  // =========================================================================
  // Thinking Block Rendering
  // =========================================================================

  /**
   * Update thinking block from store part
   * @param {HTMLElement} messageEl
   * @param {Object} thinkingPart
   * @param {HTMLElement} [insertBefore] - Element to insert thinking block before
   */
  _updateThinkingFromStore(messageEl, thinkingPart, insertBefore) {
    let thinkingBlock = messageEl.querySelector('.thinking-block');
    const body = messageEl.querySelector('.message-body');
    if (!body) return;

    if (!thinkingBlock) {
      thinkingBlock = document.createElement('div');
      thinkingBlock.className = 'thinking-block';
      thinkingBlock.setAttribute('data-expanded', 'false');
      thinkingBlock.innerHTML = `
        <div class="thinking-header" onclick="MessageRenderer._toggleThinking(this)">
          <span class="thinking-icon">💭</span>
          <span class="thinking-title">Düşünüyor...</span>
          <span class="thinking-toggle">▶</span>
        </div>
        <div class="thinking-content" style="display: none;"></div>
      `;
      // Insert before the text container if provided, otherwise at beginning
      if (insertBefore) {
        body.insertBefore(thinkingBlock, insertBefore);
      } else {
        body.insertBefore(thinkingBlock, body.firstChild);
      }
    }

    const thinkingContent = thinkingBlock.querySelector('.thinking-content');
    const title = thinkingBlock.querySelector('.thinking-title');

    if (thinkingContent && thinkingPart.thinking) {
      thinkingContent.innerHTML = this._renderMarkdown(thinkingPart.thinking.content || '');
    }

    if (thinkingPart.thinking?.isComplete) {
      thinkingBlock.classList.add('completed');
      if (title) title.textContent = 'Düşünme tamamlandı';
    }
  },

  // =========================================================================
  // Public API (Legacy - kept for backwards compatibility)
  // In reactive mode, these are not needed - UI updates automatically from store
  // =========================================================================

  /**
   * Yeni mesaj ekle
   * @deprecated Use MessageStore.upsertMessage() in reactive mode
   * @param {object} message - Mesaj objesi
   * @param {string} message.id - Mesaj ID
   * @param {'user' | 'assistant'} message.role - Rol
   * @param {string} message.content - İçerik
   * @param {number} [message.timestamp] - Zaman damgası
   */
  addMessage(message) {
    // In reactive mode, skip - store subscription handles UI
    if (this._reactiveMode) {
      console.log('[MessageRenderer] addMessage skipped in reactive mode - use MessageStore');
      return;
    }
    if (!this._container) return;

    // Welcome message'u gizle
    this._hideWelcome();

    const element = this._createMessageElement(message);
    this._messageElements.set(message.id, element);
    this._container.appendChild(element);
    this._scrollToBottom();
  },

  /**
   * Streaming mesaj başlat
   * @deprecated Use StoreBridge.handleEvent('message.start') in reactive mode
   * @param {string} messageId - Mesaj ID
   * @param {'user' | 'assistant'} role - Rol
   */
  startStreaming(messageId, role) {
    if (this._reactiveMode) return;
    this._streamingMessageId = messageId;
    
    this.addMessage({
      id: messageId,
      role,
      content: '',
      timestamp: Date.now()
    });

    // Streaming indicator ekle
    const element = this._messageElements.get(messageId);
    if (element) {
      const body = element.querySelector('.message-body');
      if (body) {
        body.innerHTML = this._createStreamingIndicator();
      }
    }
  },

  /**
   * Streaming mesaja delta ekle
   * @param {string} messageId - Mesaj ID
   * @param {string} delta - Eklenecek metin
   */
  appendDelta(messageId, delta) {
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const body = element.querySelector('.message-body');
    if (!body) return;

    // İlk delta ise streaming indicator'ı kaldır
    const indicator = body.querySelector('.streaming-indicator');
    if (indicator) {
      indicator.remove();
    }

    // Mevcut içeriğe ekle
    const currentContent = body.getAttribute('data-raw-content') || '';
    const newContent = currentContent + delta;
    body.setAttribute('data-raw-content', newContent);
    
    // Render et (basit markdown)
    body.innerHTML = this._renderMarkdown(newContent) + this._createStreamingIndicator();
    
    this._scrollToBottom();
  },

  /**
   * Streaming mesajı bitir
   * @param {string} messageId - Mesaj ID
   * @param {string} [finalContent] - Son içerik
   */
  endStreaming(messageId, finalContent) {
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const body = element.querySelector('.message-body');
    if (!body) return;

    // Streaming indicator'ı kaldır
    const indicator = body.querySelector('.streaming-indicator');
    if (indicator) {
      indicator.remove();
    }

    // Final content varsa güncelle
    if (finalContent) {
      body.setAttribute('data-raw-content', finalContent);
      body.innerHTML = this._renderMarkdown(finalContent);
    }

    this._streamingMessageId = null;
  },

  /**
   * Mesaja tool card ekle
   * @deprecated Use StoreBridge.handleEvent('tool.start') in reactive mode
   * @param {string} messageId - Mesaj ID
   * @param {object} toolCall - Tool call objesi
   */
  addToolCall(messageId, toolCall) {
    if (this._reactiveMode) return;
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const body = element.querySelector('.message-body');
    if (!body) return;

    const toolElement = ToolRenderer.createToolCard(toolCall);
    body.appendChild(toolElement);
    
    this._scrollToBottom();
  },

  /**
   * Tool call güncelle
   * @param {string} toolId - Tool ID
   * @param {object} update - Güncelleme
   */
  updateToolCall(toolId, update) {
    ToolRenderer.updateToolCard(toolId, update);
  },

  /**
   * Tüm mesajları temizle
   */
  clear() {
    if (this._container) {
      // Welcome message hariç hepsini kaldır
      const messages = this._container.querySelectorAll('.message-card');
      messages.forEach(el => el.remove());
    }
    this._messageElements.clear();
    this._revisionCache.clear();
    this._streamingMessageId = null;
    this._showWelcome();
  },

  /**
   * Belirli bir mesajı al
   * @param {string} messageId
   * @returns {HTMLElement | undefined}
   */
  getMessage(messageId) {
    return this._messageElements.get(messageId);
  },

  // =========================================================================
  // Thinking/Reasoning Support
  // =========================================================================

  /**
   * Thinking bloğu başlat
   * @param {string} messageId - Mesaj ID
   */
  startThinking(messageId) {
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const body = element.querySelector('.message-body');
    if (!body) return;

    // Thinking bloğu oluştur
    const thinkingBlock = document.createElement('div');
    thinkingBlock.className = 'thinking-block';
    thinkingBlock.setAttribute('data-expanded', 'false');
    thinkingBlock.innerHTML = `
      <div class="thinking-header" onclick="MessageRenderer._toggleThinking(this)">
        <span class="thinking-icon">💭</span>
        <span class="thinking-title">Düşünüyor...</span>
        <span class="thinking-toggle">▶</span>
      </div>
      <div class="thinking-content" style="display: none;"></div>
    `;

    // Body'nin başına ekle
    body.insertBefore(thinkingBlock, body.firstChild);
  },

  /**
   * Thinking içeriğine delta ekle
   * @param {string} messageId - Mesaj ID
   * @param {string} content - Eklenecek içerik
   */
  appendThinking(messageId, content) {
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const thinkingContent = element.querySelector('.thinking-content');
    if (!thinkingContent) return;

    const currentContent = thinkingContent.getAttribute('data-raw') || '';
    const newContent = currentContent + content;
    thinkingContent.setAttribute('data-raw', newContent);
    thinkingContent.innerHTML = this._renderMarkdown(newContent);
  },

  /**
   * Thinking bloğunu bitir
   * @deprecated Use StoreBridge.handleEvent('thinking.end') in reactive mode
   * @param {string} messageId - Mesaj ID
   */
  endThinking(messageId) {
    if (this._reactiveMode) return;
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const thinkingBlock = element.querySelector('.thinking-block');
    if (!thinkingBlock) return;

    const title = thinkingBlock.querySelector('.thinking-title');
    if (title) {
      title.textContent = 'Düşünme tamamlandı';
    }

    // Tamamlandı class'ı ekle
    thinkingBlock.classList.add('completed');
  },

  /**
   * Thinking bloğunu aç/kapat
   * @param {HTMLElement} header - Header elementi
   */
  _toggleThinking(header) {
    const block = header.closest('.thinking-block');
    if (!block) return;

    const content = block.querySelector('.thinking-content');
    const toggle = block.querySelector('.thinking-toggle');
    const isExpanded = block.getAttribute('data-expanded') === 'true';

    if (isExpanded) {
      content.style.display = 'none';
      toggle.textContent = '▶';
      block.setAttribute('data-expanded', 'false');
    } else {
      content.style.display = 'block';
      toggle.textContent = '▼';
      block.setAttribute('data-expanded', 'true');
    }
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Mesaj elementi oluştur
   * @param {object} message
   * @param {import('./stores/types.js').MessageStatus} [status] - Message status for optimistic updates
   * @returns {HTMLElement}
   */
  _createMessageElement(message, status) {
    const div = document.createElement('div');
    
    // Add status class for optimistic updates styling
    const statusClass = status ? ` ${status}` : '';
    div.className = `message-card ${message.role}${statusClass}`;
    div.setAttribute('data-message-id', message.id);
    div.setAttribute('data-status', status || 'complete');

    const avatarInitial = message.role === 'user' ? 'U' : 'AI';
    const authorName = message.role === 'user' ? 'You' : 'OpenCode';
    const time = message.timestamp ? this._formatTime(message.timestamp) : '';
    
    // Status indicator HTML
    const statusIndicator = this._createStatusIndicator(status);
    
    // Agent/Model info for assistant messages (dynamic from AgentModelSelector)
    const metaInfo = message.role === 'assistant' ? this._getAgentModelMetaHtml() : '';
    
    // Action buttons (CodeNomad style) - different for user vs assistant
    const actionButtons = message.role === 'user' ? `
      <div class="message-actions">
        <button class="message-action-btn" title="Revert" onclick="MessageRenderer._handleRevert('${message.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Revert
        </button>
        <button class="message-action-btn" title="Fork" onclick="MessageRenderer._handleFork('${message.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="18" r="3"></circle>
            <circle cx="6" cy="6" r="3"></circle>
            <circle cx="18" cy="6" r="3"></circle>
            <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path>
            <path d="M12 12v3"></path>
          </svg>
          Fork
        </button>
        <button class="message-action-btn" title="Copy" onclick="MessageRenderer._handleCopy('${message.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        ${time ? `<span class="message-time">${time}</span>` : ''}
      </div>
    ` : `
      <div class="message-actions">
        <button class="message-action-btn" title="Copy" onclick="MessageRenderer._handleCopy('${message.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        ${time ? `<span class="message-time">${time}</span>` : ''}
      </div>
    `;

    // Use text container for content to preserve tool cards on updates
    div.innerHTML = `
      <div class="message-avatar">${avatarInitial}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-author">${authorName}</span>
          ${statusIndicator}
        </div>
        <div class="message-body" data-raw-content="${this._escapeHtml(message.content)}">
          <div class="message-text-content">
            ${this._renderMarkdown(message.content)}
          </div>
        </div>
        ${metaInfo}
      </div>
      ${actionButtons}
    `;

    // Add retry button for error state
    if (status === 'error') {
      const retryBtn = this._createRetryButton(message.id);
      div.querySelector('.message-body')?.appendChild(retryBtn);
    }

    return div;
  },
  
  /**
   * Handle Revert action - Reverts conversation to this message and resends
   * Backend-first approach: API call first, then local state update
   * @param {string} messageId
   */
  async _handleRevert(messageId) {
    console.log('[MessageRenderer] Revert:', messageId);
    
    if (typeof MessageStore === 'undefined' || typeof SessionStore === 'undefined') {
      console.error('[MessageRenderer] Stores not available for revert');
      return;
    }

    const sessionId = SessionStore.getCurrentSessionId();
    if (!sessionId) return;

    // Get the message to revert to
    const message = MessageStore.getMessage(messageId);
    if (!message || message.role !== 'user') {
      console.warn('[MessageRenderer] Can only revert to user messages');
      return;
    }

    // Get the content BEFORE any modifications
    const content = MessageStore.getMessageContent(messageId);
    if (!content) {
      console.warn('[MessageRenderer] No content to revert');
      return;
    }

    // Backend-first: Call API to revert conversation
    if (typeof APIClient !== 'undefined' && APIClient.revertConversation) {
      try {
        const result = await APIClient.revertConversation(messageId);
        if (!result.success) {
          console.error('[MessageRenderer] Backend revert failed:', result.error);
          this._showNotification('Revert işlemi başarısız oldu', 'error');
          return;
        }
        console.log('[MessageRenderer] Backend revert successful');
      } catch (err) {
        console.error('[MessageRenderer] Backend revert error:', err);
        this._showNotification('Revert işlemi başarısız: ' + err.message, 'error');
        return;
      }
    }

    // Local state update: Remove messages after this one
    const messages = MessageStore.getSessionMessages(sessionId);
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) return;

    // Remove all messages after this one
    const messagesToRemove = messages.slice(messageIndex + 1);
    messagesToRemove.forEach(m => {
      MessageStore.removeMessage(m.id);
    });

    // Remove the original message (it will be re-added when resent)
    MessageStore.removeMessage(messageId);

    // Resend the message
    if (typeof OpenCodeApp !== 'undefined' && OpenCodeApp._handleSendMessage) {
      OpenCodeApp._handleSendMessage(content);
    }
  },
  
  /**
   * Handle Fork action - Creates a new conversation branch from this point
   * Backend-first approach: Get server-generated session ID
   * @param {string} messageId
   */
  async _handleFork(messageId) {
    console.log('[MessageRenderer] Fork:', messageId);
    
    if (typeof MessageStore === 'undefined' || typeof SessionStore === 'undefined') {
      console.error('[MessageRenderer] Stores not available for fork');
      return;
    }

    const sessionId = SessionStore.getCurrentSessionId();
    if (!sessionId) return;

    // Get the message
    const message = MessageStore.getMessage(messageId);
    if (!message) return;

    let forkSessionId = null;

    // Backend-first: Get server-generated session ID
    if (typeof APIClient !== 'undefined' && APIClient.forkConversation) {
      try {
        const result = await APIClient.forkConversation(messageId);
        if (!result.success) {
          console.error('[MessageRenderer] Backend fork failed:', result.error);
          this._showNotification('Fork işlemi başarısız oldu', 'error');
          return;
        }
        // Use server-generated session ID
        forkSessionId = result.sessionId;
        console.log('[MessageRenderer] Backend fork successful, new session:', forkSessionId);
      } catch (err) {
        console.error('[MessageRenderer] Backend fork error:', err);
        this._showNotification('Fork işlemi başarısız: ' + err.message, 'error');
        return;
      }
    } else {
      // Fallback: Generate local ID if no API available
      forkSessionId = `ses_fork_${Date.now()}`;
      console.warn('[MessageRenderer] No API available, using local fork ID:', forkSessionId);
    }

    // Get messages to copy
    const messages = MessageStore.getSessionMessages(sessionId);
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) return;

    const messagesToCopy = messages.slice(0, messageIndex + 1);
    
    // Create new session with parent reference
    SessionStore.upsertSession(forkSessionId, {
      title: `Fork from ${sessionId.substring(0, 8)}`,
      parentId: sessionId,
    });

    // Copy messages to new session
    messagesToCopy.forEach((m, i) => {
      const content = MessageStore.getMessageContent(m.id);
      const newId = `${forkSessionId}_msg_${i}`;
      
      MessageStore.upsertMessage({
        id: newId,
        sessionId: forkSessionId,
        role: m.role,
        status: 'complete',
        parts: [{ type: 'text', text: content }],
        createdAt: m.createdAt,
      });
    });

    // Switch to the new session
    SessionStore.setCurrentSession(forkSessionId);
    
    this._showNotification('Yeni dal oluşturuldu', 'success');
    console.log('[MessageRenderer] Forked to new session:', forkSessionId);
  },
  
  /**
   * Handle Copy action
   * @param {string} messageId
   */
  _handleCopy(messageId) {
    const element = this._messageElements.get(messageId);
    if (!element) return;
    
    const body = element.querySelector('.message-body');
    const content = body?.getAttribute('data-raw-content') || body?.textContent || '';
    
    navigator.clipboard.writeText(content).then(() => {
      // Show brief feedback
      const btn = element.querySelector('.message-action-btn[title="Copy"]');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 1500);
      }
    }).catch(err => {
      console.error('[MessageRenderer] Copy failed:', err);
    });
  },

  /**
   * Handle retry message - son mesajı tekrar gönder
   * @param {string} messageId
   */
  async _handleRetry(messageId) {
    const currentSessionId = window.SessionStore?.getCurrentSessionId();
    if (!currentSessionId) {
      console.warn('[MessageRenderer] No active session for retry');
      return;
    }
    
    try {
      // API üzerinden retry yap
      const result = await window.APIClient?.retry(currentSessionId);
      if (result?.success) {
        window.OpenCodeApp?._showToast?.('Mesaj tekrar gönderildi', 'success');
      } else {
        window.OpenCodeApp?._showToast?.('Retry başarısız', 'error');
      }
    } catch (err) {
      console.error('[MessageRenderer] Retry failed:', err);
      window.OpenCodeApp?._showToast?.('Retry hatası', 'error');
    }
  },

  /**
   * Create status indicator HTML
   * @param {import('./stores/types.js').MessageStatus} [status]
   * @returns {string}
   */
  _createStatusIndicator(status) {
    if (!status || status === 'complete') return '';
    
    switch (status) {
      case 'sending':
        return `
          <span class="message-status status-sending" aria-busy="true" title="Gönderiliyor...">
            <span class="status-spinner"></span>
          </span>
        `;
      case 'sent':
        return `
          <span class="message-status status-sent" title="Gönderildi, yanıt bekleniyor...">
            <span class="status-icon">✓</span>
          </span>
        `;
      case 'streaming':
        return `
          <span class="message-status status-streaming" title="Yanıt alınıyor...">
            <span class="status-dot"></span>
          </span>
        `;
      case 'error':
        return `
          <span class="message-status status-error" role="alert" title="Gönderilemedi">
            <span class="status-icon">⚠️</span>
          </span>
        `;
      default:
        return '';
    }
  },

  /**
   * Create retry button for failed messages
   * @param {string} messageId
   * @returns {HTMLElement}
   */
  _createRetryButton(messageId) {
    const btn = document.createElement('button');
    btn.className = 'message-retry-btn';
    btn.innerHTML = '🔄 Tekrar Dene';
    btn.setAttribute('data-message-id', messageId);
    btn.onclick = () => this._handleRetry(messageId);
    return btn;
  },

  /**
   * Handle retry button click
   * @param {string} messageId
   */
  _handleRetry(messageId) {
    if (typeof StoreBridge !== 'undefined') {
      const content = StoreBridge.getPendingMessageContent(messageId);
      if (content && StoreBridge.retryMessage(messageId)) {
        // Retry initiated - API call should be triggered by app.js
        if (typeof OpenCodeApp !== 'undefined' && OpenCodeApp._retryMessage) {
          OpenCodeApp._retryMessage(messageId, content);
        }
      }
    }
  },

  /**
   * Streaming indicator HTML'i
   * @returns {string}
   */
  _createStreamingIndicator() {
    return `
      <span class="streaming-indicator">
        <span class="streaming-dot"></span>
        <span class="streaming-dot"></span>
        <span class="streaming-dot"></span>
      </span>
    `;
  },

  /**
   * Basit Markdown render (XSS sanitization ile)
   * @param {string} text
   * @returns {string}
   */
  _renderMarkdown(text) {
    if (!text) return '';

    let html = this._escapeHtml(text);

    // Code blocks (```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = this._sanitizeLanguage(lang) || 'plaintext';
      return `
        <div class="code-block">
          <div class="code-block-header">
            <span class="code-block-lang">${language}</span>
            <button class="code-block-copy" onclick="MessageRenderer._copyCode(this)">Kopyala</button>
          </div>
          <pre><code class="language-${language}">${code.trim()}</code></pre>
        </div>
      `;
    });

    // Inline code (`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic (*)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links [text](url) - with URL sanitization
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const safeUrl = this._sanitizeUrl(url);
      if (!safeUrl) return text; // Invalid URL - just show text
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Paragraphs (double line breaks)
    html = html.replace(/<br><br>/g, '</p><p>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p><\/p>/g, '');

    // Final sanitization with DOMPurify (if available)
    return this._sanitizeHtml(html);
  },

  /**
   * Sanitize HTML output with DOMPurify
   * @param {string} html
   * @returns {string}
   */
  _sanitizeHtml(html) {
    // Use DOMPurify if available
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'div', 'span', 'button'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'onclick'],
        ALLOW_DATA_ATTR: false,
      });
    }
    // Fallback - already escaped, return as-is
    return html;
  },

  /**
   * Sanitize URL to prevent javascript: and other XSS vectors
   * @param {string} url
   * @returns {string | null}
   */
  _sanitizeUrl(url) {
    if (!url) return null;
    const trimmedUrl = url.trim().toLowerCase();
    // Block dangerous protocols
    if (trimmedUrl.startsWith('javascript:') || 
        trimmedUrl.startsWith('data:') || 
        trimmedUrl.startsWith('vbscript:')) {
      console.warn('[MessageRenderer] Blocked dangerous URL:', url);
      return null;
    }
    return url;
  },

  /**
   * Sanitize language identifier for code blocks
   * @param {string} lang
   * @returns {string}
   */
  _sanitizeLanguage(lang) {
    if (!lang) return '';
    // Only allow alphanumeric and common chars
    return lang.replace(/[^a-zA-Z0-9_-]/g, '');
  },

  /**
   * HTML escape
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Zaman formatı
   * @param {number} timestamp
   * @returns {string}
   */
  _formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  },

  /**
   * En alta scroll et
   */
  _scrollToBottom() {
    if (this._container) {
      const scrollContainer = this._container.closest('.messages-container');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  },

  /**
   * Welcome message'ı gizle
   */
  _hideWelcome() {
    const welcome = document.getElementById('welcome-message');
    if (welcome) {
      welcome.classList.add('hidden');
    }
  },

  /**
   * Welcome message'ı göster
   */
  _showWelcome() {
    const welcome = document.getElementById('welcome-message');
    if (welcome) {
      welcome.classList.remove('hidden');
    }
  },

  /**
   * Kod kopyalama
   * @param {HTMLElement} button
   */
  _copyCode(button) {
    const codeBlock = button.closest('.code-block');
    const code = codeBlock?.querySelector('code')?.textContent || '';
    
    navigator.clipboard.writeText(code).then(() => {
      const originalText = button.textContent;
      button.textContent = 'Kopyalandı!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Kopyalama hatası:', err);
    });
  },
  
  /**
   * Get dynamic Agent/Model meta HTML for assistant messages
   * @returns {string}
   */
  _getAgentModelMetaHtml() {
    // Try to get from AgentModelSelector (dynamic)
    if (window.AgentModelSelector) {
      const agent = window.AgentModelSelector.getCurrentAgent();
      const modelInfo = window.AgentModelSelector.getCurrentModel();
      
      const agentName = agent?.name || 'coder';
      const modelName = modelInfo?.model?.name || modelInfo?.model?.id || 'default';
      const modelKey = modelInfo?.model 
        ? `${modelInfo.model.providerId}/${modelInfo.model.id}` 
        : '';
      
      return `
        <div class="message-meta">
          <span class="agent-info" title="Current Agent">Agent: ${this._escapeHtml(agentName)}</span> • 
          <span class="model-info" title="${this._escapeHtml(modelKey)}">Model: ${this._escapeHtml(modelName)}</span>
        </div>
      `;
    }
    
    // Fallback - try to get from session info
    const session = window.SessionStore?.getCurrentSession?.();
    if (session?.agent || session?.model) {
      const agentName = session.agent || 'coder';
      const modelName = session.model || 'default';
      
      return `
        <div class="message-meta">
          <span class="agent-info">Agent: ${this._escapeHtml(agentName)}</span> • 
          <span class="model-info">Model: ${this._escapeHtml(modelName)}</span>
        </div>
      `;
    }
    
    // Last resort - minimal display
    return `
      <div class="message-meta">
        <span class="agent-info">Agent: coder</span>
      </div>
    `;
  },
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Show notification toast
   * @param {string} message
   * @param {'success' | 'error' | 'info'} type
   */
  _showNotification(message, type = 'info') {
    // Try OpenCodeApp toast first
    if (typeof OpenCodeApp !== 'undefined' && OpenCodeApp._showToast) {
      OpenCodeApp._showToast(message, type);
      return;
    }
    // Fallback to console
    const logFn = type === 'error' ? console.error : type === 'success' ? console.log : console.info;
    logFn(`[MessageRenderer] ${type.toUpperCase()}: ${message}`);
  },

  // =========================================================================
  // Smart Scroll Management
  // =========================================================================

  /** @type {boolean} Auto-scroll enabled */
  _autoScrollEnabled: true,

  /** @type {number} Timestamp when user last scrolled */
  _userScrollIntentUntil: 0,

  /** @type {IntersectionObserver | null} */
  _scrollObserver: null,

  /** @type {HTMLElement | null} */
  _scrollSentinel: null,

  /**
   * Initialize smart scroll management
   * @param {HTMLElement} container - Messages container
   */
  initSmartScroll(container) {
    if (!container) return;

    // Create bottom sentinel element
    this._scrollSentinel = document.createElement('div');
    this._scrollSentinel.className = 'scroll-sentinel';
    this._scrollSentinel.style.height = '1px';
    container.appendChild(this._scrollSentinel);

    // Create IntersectionObserver to detect if user is at bottom
    this._scrollObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // If sentinel is visible, user is at bottom - enable auto-scroll
        if (entry.isIntersecting) {
          this._autoScrollEnabled = true;
        }
      },
      {
        root: container,
        threshold: 0.1,
      }
    );

    this._scrollObserver.observe(this._scrollSentinel);

    // Detect user scroll intent
    container.addEventListener('wheel', () => this._handleUserScrollIntent(), { passive: true });
    container.addEventListener('touchmove', () => this._handleUserScrollIntent(), { passive: true });
    container.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home'].includes(e.key)) {
        this._handleUserScrollIntent();
      }
    });

    console.log('[MessageRenderer] Smart scroll initialized');
  },

  /**
   * Handle user scroll intent - disable auto-scroll temporarily
   */
  _handleUserScrollIntent() {
    this._autoScrollEnabled = false;
    this._userScrollIntentUntil = Date.now() + 3000; // Disable for 3 seconds
  },

  /**
   * Scroll to bottom if auto-scroll is enabled
   * @param {HTMLElement} container
   * @param {boolean} [force=false] - Force scroll even if auto-scroll disabled
   */
  scrollToBottomIfEnabled(container, force = false) {
    if (!container) return;

    // Check if user scroll intent has expired
    if (Date.now() > this._userScrollIntentUntil) {
      this._autoScrollEnabled = true;
    }

    if (force || this._autoScrollEnabled) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  },

  /**
   * Force scroll to bottom (for new messages from user)
   * @param {HTMLElement} container
   */
  scrollToBottom(container) {
    this.scrollToBottomIfEnabled(container, true);
    this._autoScrollEnabled = true;
  },

  /**
   * Check if auto-scroll is currently enabled
   * @returns {boolean}
   */
  isAutoScrollEnabled() {
    return this._autoScrollEnabled;
  },

  /**
   * Cleanup scroll observer
   */
  destroySmartScroll() {
    if (this._scrollObserver) {
      this._scrollObserver.disconnect();
      this._scrollObserver = null;
    }
    if (this._scrollSentinel) {
      this._scrollSentinel.remove();
      this._scrollSentinel = null;
    }
  }
};

// Global'e ekle
window.MessageRenderer = MessageRenderer;
