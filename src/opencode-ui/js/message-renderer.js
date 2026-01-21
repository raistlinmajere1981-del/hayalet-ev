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
    
    // Agent/Model info for assistant messages
    const metaInfo = message.role === 'assistant' ? `
      <div class="message-meta">
        <span class="agent-info">Agent: Sisyphus</span> • 
        <span class="model-info">Model: opencode/glm-4.7-free</span>
      </div>
    ` : '';
    
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
   * Handle Revert action
   * @param {string} messageId
   */
  _handleRevert(messageId) {
    console.log('[MessageRenderer] Revert:', messageId);
    // TODO: Implement revert functionality
  },
  
  /**
   * Handle Fork action
   * @param {string} messageId
   */
  _handleFork(messageId) {
    console.log('[MessageRenderer] Fork:', messageId);
    // TODO: Implement fork functionality
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
   * Basit Markdown render
   * @param {string} text
   * @returns {string}
   */
  _renderMarkdown(text) {
    if (!text) return '';

    let html = this._escapeHtml(text);

    // Code blocks (```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'plaintext';
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

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Paragraphs (double line breaks)
    html = html.replace(/<br><br>/g, '</p><p>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p><\/p>/g, '');

    return html;
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
  }
};

// Global'e ekle
window.MessageRenderer = MessageRenderer;
