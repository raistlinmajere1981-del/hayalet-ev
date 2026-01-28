/**
 * Message Renderer Manager (Main singleton)
 * 
 * Mesaj kartlarını render eder.
 * Markdown parsing ve syntax highlighting içerir.
 * Store-based reactive rendering ile DOM senkronizasyonu.
 */

import { renderMarkdown, escapeHtml } from './markdown-parser.js';
import { createStreamingIndicator, createStatusIndicator, copyCode } from './syntax-highlighter.js';
import {
  formatTokenCount,
  formatTime,
  renderStepCardStart,
  renderStepCardFinish,
  createMessageElement,
  createRetryButton,
  getAgentModelMetaHtml,
} from './renderers.js';
import { SmartScroll } from './smart-scroll.js';
import type { MessageRecord, StoreEvent, MessagePart, MessageRendererOptions } from './types.js';

const MessageRenderer = {
  /** Container element */
  _container: null as HTMLElement | null,

  /** Map of message ID → element */
  _messageElements: new Map() as Map<string, HTMLElement>,

  /** Streaming message ID */
  _streamingMessageId: null as string | null,

  /** Store unsubscribe functions */
  _unsubscribeMessage: null as (() => void) | null,
  _unsubscribeSession: null as (() => void) | null,

  /** Message revision cache for change detection */
  _revisionCache: new Map() as Map<string, number>,

  /** Enable store-based reactive rendering */
  _reactiveMode: false,

  /** Smart scroll manager */
  _smartScroll: new SmartScroll(),

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Message renderer'ı başlat
   */
  init(container: HTMLElement, options: MessageRendererOptions = {}) {
    this._container = container;
    this._messageElements.clear();
    this._revisionCache = new Map();
    this._streamingMessageId = null;
    this._reactiveMode = options.reactive ?? false;

    // Initialize smart scroll
    this._smartScroll.init(container);

    // Subscribe to stores if reactive mode enabled
    if (this._reactiveMode) {
      if (typeof window.MessageStore !== 'undefined') {
        this._unsubscribeMessage = window.MessageStore.subscribe?.((event: unknown) => this._onStoreChange(event as StoreEvent)) || null;
      }
      if (typeof window.SessionStore !== 'undefined') {
        this._unsubscribeSession = window.SessionStore.subscribe?.((event: unknown) => this._onSessionChange(event as StoreEvent)) || null;
      }
      console.log('[MessageRenderer] Reactive mode enabled - subscribed to MessageStore and SessionStore');
    }
  },

  /**
   * Handle session store change
   */
  _onSessionChange(event: StoreEvent) {
    if (!this._reactiveMode) return;

    // When session changes, re-render with new session's messages
    if (event.type === 'session:changed' || event.type === 'status:changed') {
      const sessionId = typeof window.SessionStore !== 'undefined' ? window.SessionStore.getCurrentSessionId?.() : null;
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
    this._smartScroll.destroy();
  },

  /**
   * Initialize smart scroll for a container (wrapper method for compatibility)
   */
  initSmartScroll(container: HTMLElement) {
    if (container) {
      this._smartScroll.init(container);
    }
  },

  /**
   * Handle store change event
   */
  _onStoreChange(event: StoreEvent) {
    if (!this._reactiveMode) return;

    const sessionId = typeof window.SessionStore !== 'undefined' ? window.SessionStore.getCurrentSessionId?.() : null;
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
   */
  _reconcileFromStore(sessionId: string) {
    if (!this._container || !sessionId) return;
    if (typeof window.MessageStore === 'undefined') return;

    const messages = (window.MessageStore.getSessionMessages?.(sessionId) || []) as MessageRecord[];
    const currentIds = new Set(messages.map((m) => m.id));
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
      const messageRecord = record as MessageRecord;
      const existingEl = this._messageElements.get(record.id);
      const cachedRevision = this._revisionCache.get(record.id);

      if (!existingEl) {
        // New message - create element with status for optimistic updates
        this._hideWelcome();
        const content = window.MessageStore.getMessageContent?.(messageRecord.id) || '';
        const element = createMessageElement(
          {
            id: messageRecord.id,
            role: messageRecord.role || '',
            content: content,
            timestamp: (messageRecord.createdAt as number) || 0,
          },
          record.status
        );
        this._messageElements.set(messageRecord.id, element);
        this._revisionCache.set(messageRecord.id, (messageRecord.revision as number) || 0);
        this._container?.appendChild(element);
      } else if (cachedRevision !== messageRecord.revision && this._container) {
        // Message updated - reconcile content and status
        this._updateMessageFromStore(existingEl, messageRecord);
        this._revisionCache.set(messageRecord.id, messageRecord.revision as number);
      }
    });

    this._scrollToBottom();
  },

  /**
   * Update existing message element from store record
   */
  _updateMessageFromStore(element: HTMLElement, record: Partial<MessageRecord>) {
    if (typeof window.MessageStore === 'undefined') return;

    const body = element.querySelector('.message-body');
    if (!body) return;

    const content = window.MessageStore.getMessageContent?.(record.id);
    const isStreaming = record.status === 'streaming';
    const previousStatus = element.getAttribute('data-status');

    // Update status class if changed
    if (previousStatus !== record.status) {
      // Remove old status class
      element.classList.remove('sending', 'streaming', 'complete', 'error');
      // Add new status class
      const status = record.status ?? 'pending';
      element.classList.add(status);
      element.setAttribute('data-status', status);

      // Update status indicator in header
      this._updateStatusIndicator(element, status);
    }

    // Update content - use text container to preserve tool cards
    body.setAttribute('data-raw-content', content || '');

    // Get or create text content container
    let textContainer = body.querySelector('.message-text-content');
    if (!textContainer) {
      textContainer = document.createElement('div');
      textContainer.className = 'message-text-content';
      // Insert at beginning, before any tool cards
      if (body.firstChild) {
        body.insertBefore(textContainer, body.firstChild);
      } else {
        body.appendChild(textContainer);
      }
    }

    // Update only text content (preserves tool cards)
    if (isStreaming) {
      textContainer.innerHTML = renderMarkdown(content || '') + createStreamingIndicator();
    } else {
      textContainer.innerHTML = renderMarkdown(content || '');
    }

    // Handle thinking parts (insert before text content)
    const parts = window.MessageStore.getMessageParts?.(record.id) || [];
    const thinkingPart = parts.find((p: MessagePart) => p.type === 'thinking');
    if (thinkingPart && textContainer) {
      this._updateThinkingFromStore(element, thinkingPart, textContainer as HTMLElement);
    }

    // Handle tool parts via ToolRenderer (append after text)
    const toolParts = parts.filter((p: MessagePart) => p.type === 'tool');
    toolParts.forEach((part: MessagePart) => {
      if (part.toolCall && typeof window.ToolRenderer !== 'undefined') {
        const toolId = part.toolCall.toolId || '';
        const toolEl = toolId ? body.querySelector(`[data-tool-id="${toolId}"]`) : null;
        if (!toolEl && window.ToolRenderer.createToolCard) {
          const newToolEl = window.ToolRenderer.createToolCard(part.toolCall);
          body.appendChild(newToolEl);
        } else if (window.ToolRenderer.updateToolCard) {
          window.ToolRenderer.updateToolCard(toolId, part.toolCall);
        }
      }
    });

    // Handle step parts (token tracking cards)
    const stepParts = parts.filter((p: MessagePart) => p.type === 'step');
    stepParts.forEach((part: MessagePart) => {
      if (part.step) {
        this._updateStepCard(body as HTMLElement, part);
      }
    });

    // Handle retry button for error state (append at end)
    if (record.status === 'error') {
      const existingRetryBtn = body.querySelector('.message-retry-btn');
      if (!existingRetryBtn) {
        const newRetryBtn = createRetryButton(record.id);
        body.appendChild(newRetryBtn);
      }
    } else {
      const retryBtn = body.querySelector('.message-retry-btn');
      if (retryBtn) retryBtn.remove();
    }
  },

  /**
   * Update status indicator in message header
   */
  _updateStatusIndicator(element: HTMLElement, status: string) {
    const header = element.querySelector('.message-header');
    if (!header) return;

    // Remove existing status indicator
    const existingStatus = header.querySelector('.message-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    // Add new status indicator if needed
    const indicatorHtml = createStatusIndicator(status);
    if (indicatorHtml) {
      header.insertAdjacentHTML('beforeend', indicatorHtml);
    }
  },

  // =========================================================================
  // Step Card Management
  // =========================================================================

  /**
   * Update or create step card
   */
  _updateStepCard(body: HTMLElement, part: MessagePart) {
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
      stepCard.innerHTML = renderStepCardStart(step);
      stepCard.classList.remove('completed');
      stepCard.classList.add('running');
    } else if (step.status === 'finish') {
      stepCard.innerHTML = renderStepCardFinish(step);
      stepCard.classList.remove('running');
      stepCard.classList.add('completed');
    }
  },

  /**
   * Toggle step card expand/collapse
   */
  _toggleStepCard(header: HTMLElement) {
    const card = header.closest('.step-card');
    if (!card) return;

    const isExpanded = card.getAttribute('data-expanded') === 'true';
    card.setAttribute('data-expanded', isExpanded ? 'false' : 'true');
  },

  /**
   * Copy step statistics to clipboard
   */
  _copyStepStats(event: Event, inputTokens: number, outputTokens: number, cost: number) {
    event.stopPropagation();

    const stats = `Token Kullanımı:\n- Input: ${inputTokens.toLocaleString()}\n- Output: ${outputTokens.toLocaleString()}\n- Toplam: ${(inputTokens + outputTokens).toLocaleString()}\n- Maliyet: $${cost.toFixed(6)}`;

    navigator.clipboard.writeText(stats).then(() => {
      const btn = event.currentTarget as HTMLElement;
      if (!btn) return;
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

  // =========================================================================
  // Thinking Block Management
  // =========================================================================

  /**
   * Update thinking block from store part
   */
  _updateThinkingFromStore(messageEl: HTMLElement, thinkingPart: MessagePart, insertBefore?: HTMLElement) {
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
      thinkingContent.innerHTML = renderMarkdown(thinkingPart.thinking.content || '');
    }

    if (thinkingPart.thinking?.isComplete) {
      thinkingBlock.classList.add('completed');
      if (title) title.textContent = 'Düşünme tamamlandı';
    }
  },

  /**
   * Toggle thinking block expand/collapse
   */
  _toggleThinking(header: HTMLElement) {
    const block = header.closest('.thinking-block');
    if (!block) return;

    const content = block.querySelector('.thinking-content') as HTMLElement | null;
    const toggle = block.querySelector('.thinking-toggle');
    const isExpanded = block.getAttribute('data-expanded') === 'true';

    if (isExpanded) {
      if (content) content.style.display = 'none';
      if (toggle) toggle.textContent = '▶';
      block.setAttribute('data-expanded', 'false');
    } else {
      if (content) content.style.display = 'block';
      if (toggle) toggle.textContent = '▼';
      block.setAttribute('data-expanded', 'true');
    }
  },

  // =========================================================================
  // Public Legacy API (for backwards compatibility)
  // =========================================================================

  /**
   * Yeni mesaj ekle
   * @deprecated Use MessageStore.upsertMessage() in reactive mode
   */
  addMessage(message: MessageRecord) {
    // In reactive mode, skip - store subscription handles UI
    if (this._reactiveMode) {
      console.log('[MessageRenderer] addMessage skipped in reactive mode - use MessageStore');
      return;
    }
    if (!this._container) return;

    // Welcome message'u gizle
    this._hideWelcome();

    const element = createMessageElement(message);
    this._messageElements.set(message.id, element);
    this._container.appendChild(element);
    this._scrollToBottom();
  },

  /**
   * Streaming mesaj başlat
   * @deprecated Use StoreBridge.handleEvent('message.start') in reactive mode
   */
  startStreaming(messageId: string, role: string) {
    if (this._reactiveMode) return;
    this._streamingMessageId = messageId;

    this.addMessage({
      id: messageId,
      role,
      content: '',
      timestamp: Date.now(),
    });

    // Streaming indicator ekle
    const element = this._messageElements.get(messageId);
    if (element) {
      const body = element.querySelector('.message-body');
      if (body) {
        body.innerHTML = createStreamingIndicator();
      }
    }
  },

  /**
   * Streaming mesaja delta ekle
   */
  appendDelta(messageId: string, delta: string) {
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
    body.innerHTML = renderMarkdown(newContent) + createStreamingIndicator();

    this._scrollToBottom();
  },

  /**
   * Streaming mesajı bitir
   */
  endStreaming(messageId: string, finalContent?: string) {
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
      body.innerHTML = renderMarkdown(finalContent);
    }

    this._streamingMessageId = null;
  },

  /**
   * Mesaja tool card ekle
   * @deprecated Use StoreBridge.handleEvent('tool.start') in reactive mode
   */
  addToolCall(messageId: string, toolCall: unknown) {
    if (this._reactiveMode) return;
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const body = element.querySelector('.message-body');
    if (!body) return;

    const toolElement = window.ToolRenderer?.createToolCard?.(toolCall);
    if (toolElement) {
      body.appendChild(toolElement);
    }

    this._scrollToBottom();
  },

  /**
   * Tool call güncelle
   */
  updateToolCall(toolId: string, update: Record<string, unknown>) {
    window.ToolRenderer?.updateToolCard?.(toolId, update);
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
   */
  getMessage(messageId: string) {
    return this._messageElements.get(messageId);
  },

  // =========================================================================
  // Thinking Block Support (Legacy)
  // =========================================================================

  /**
   * Thinking bloğu başlat
   */
  startThinking(messageId: string) {
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
   */
  appendThinking(messageId: string, content: string) {
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const thinkingContent = element.querySelector('.thinking-content');
    if (!thinkingContent) return;

    const currentContent = thinkingContent.getAttribute('data-raw') || '';
    const newContent = currentContent + content;
    thinkingContent.setAttribute('data-raw', newContent);
    thinkingContent.innerHTML = renderMarkdown(newContent);
  },

  /**
   * Thinking bloğunu bitir
   * @deprecated Use StoreBridge.handleEvent('thinking.end') in reactive mode
   */
  endThinking(messageId: string) {
    if (this._reactiveMode) return;
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const thinkingBlock = element.querySelector('.thinking-block');
    if (!thinkingBlock) return;

    const title = thinkingBlock.querySelector('.thinking-title');
    if (title) {
      title.textContent = 'Düşünme tamamlandı';
    }

    thinkingBlock.classList.add('completed');
  },

  // =========================================================================
  // Action Handlers
  // =========================================================================

  /**
   * Handle Revert action
   */
  async _handleRevert(messageId: string) {
    console.log('[MessageRenderer] Revert:', messageId);

    if (typeof window.MessageStore === 'undefined' || typeof window.SessionStore === 'undefined') {
      console.error('[MessageRenderer] Stores not available for revert');
      return;
    }

    const sessionId = window.SessionStore.getCurrentSessionId?.();
    if (!sessionId) return;

    const message = window.MessageStore.getMessage?.(messageId) as { role?: string } | undefined;
    if (!message || message.role !== 'user') {
      console.warn('[MessageRenderer] Can only revert to user messages');
      return;
    }

    const content = window.MessageStore.getMessageContent?.(messageId);
    if (!content) {
      console.warn('[MessageRenderer] No content to revert');
      return;
    }

    // Backend-first: Call API to revert conversation
    if (typeof window.APIClient !== 'undefined' && window.APIClient.revertConversation) {
      try {
        const result = await window.APIClient.revertConversation(messageId);
        if (!result.success) {
          console.error('[MessageRenderer] Backend revert failed:', result.error);
          this._showNotification('Revert işlemi başarısız oldu', 'error');
          return;
        }
      } catch (err) {
        console.error('[MessageRenderer] Backend revert error:', err);
        this._showNotification('Revert işlemi başarısız: ' + (err instanceof Error ? err.message : String(err)), 'error');
        return;
      }
    }

    // Local state update: Remove messages after this one
    const messages = window.MessageStore.getSessionMessages?.(sessionId) || [];
    const messageIndex = messages.findIndex((m: MessageRecord) => (m as MessageRecord).id === messageId);

    if (messageIndex === -1) return;

    const messagesToRemove = messages.slice(messageIndex + 1);
    if (typeof window.MessageStore !== 'undefined') {
      messagesToRemove.forEach((m: unknown) => {
        window.MessageStore!.removeMessage?.((m as MessageRecord).id);
      });
      window.MessageStore.removeMessage?.(messageId);
    }

    // Resend the message
    if (typeof window.OpenCodeApp !== 'undefined' && window.OpenCodeApp._handleSendMessage) {
      window.OpenCodeApp._handleSendMessage(content);
    }
  },

  /**
   * Handle Fork action
   */
  async _handleFork(messageId: string) {
    console.log('[MessageRenderer] Fork:', messageId);

    if (typeof window.MessageStore === 'undefined' || typeof window.SessionStore === 'undefined') {
      console.error('[MessageRenderer] Stores not available for fork');
      return;
    }

    const sessionId = window.SessionStore.getCurrentSessionId?.();
    if (!sessionId) return;

    const message = window.MessageStore.getMessage?.(messageId);
    if (!message) return;

    let forkSessionId: string | null = null;

    // Backend-first: Get server-generated session ID
    if (typeof window.APIClient !== 'undefined' && window.APIClient.forkConversation) {
      try {
        const result = await window.APIClient.forkConversation(messageId) as { success: boolean; error?: string; sessionId?: string };
        if (!result.success) {
          console.error('[MessageRenderer] Backend fork failed:', result.error);
          this._showNotification('Fork işlemi başarısız oldu', 'error');
          return;
        }
        forkSessionId = result.sessionId || null;
      } catch (err) {
        console.error('[MessageRenderer] Backend fork error:', err);
        this._showNotification('Fork işlemi başarısız: ' + (err instanceof Error ? err.message : String(err)), 'error');
        return;
      }
    } else {
      forkSessionId = `ses_fork_${Date.now()}`;
      console.warn('[MessageRenderer] No API available, using local fork ID:', forkSessionId);
    }

    // Get messages to copy
    const messages = window.MessageStore.getSessionMessages?.(sessionId) || [];
    const messageIndex = messages.findIndex((m: unknown) => (m as MessageRecord).id === messageId);

    if (messageIndex === -1) return;

    const messagesToCopy = messages.slice(0, messageIndex + 1);

    // Create new session with parent reference
    if (!forkSessionId) return;
    window.SessionStore.upsertSession?.(forkSessionId, {
      title: `Fork from ${sessionId.substring(0, 8)}`,
      parentId: sessionId,
    });

    // Copy messages to new session
    if (typeof window.MessageStore !== 'undefined') {
      messagesToCopy.forEach((m: unknown, i: number) => {
        const msg = m as MessageRecord;
        const content = window.MessageStore!.getMessageContent?.(msg.id) || '';
        const newId = `${forkSessionId}_msg_${i}`;

        window.MessageStore!.upsertMessage?.({
          id: newId,
          sessionId: forkSessionId,
          role: msg.role || 'user',
          status: 'complete',
          parts: [{ type: 'text', text: content }],
          createdAt: (msg.createdAt as number) || Date.now(),
        });
      });
    }

    // Switch to the new session
    window.SessionStore.setCurrentSession?.(forkSessionId);

    this._showNotification('Yeni dal oluşturuldu', 'success');
  },

  /**
   * Handle Copy action
   */
  _handleCopy(messageId: string) {
    const element = this._messageElements.get(messageId);
    if (!element) return;

    const body = element.querySelector('.message-body');
    const content = body?.getAttribute('data-raw-content') || body?.textContent || '';

    navigator.clipboard.writeText(content).then(() => {
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
   * Handle retry message
   */
  async _handleRetry(_messageId: string) {
    const currentSessionId = window.SessionStore?.getCurrentSessionId();
    if (!currentSessionId) {
      console.warn('[MessageRenderer] No active session for retry');
      return;
    }

    try {
      const result = await window.APIClient?.retry(currentSessionId) as { success?: boolean } | undefined;
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

  // =========================================================================
  // UI Helpers
  // =========================================================================

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
   * En alta scroll et
   */
  _scrollToBottom() {
    if (this._container) {
      this._smartScroll.scrollToBottom(this._container);
    }
  },

  /**
   * Show notification toast
   */
  _showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    if (typeof window.OpenCodeApp !== 'undefined' && window.OpenCodeApp._showToast) {
      window.OpenCodeApp._showToast(message, type);
      return;
    }
    const logFn = type === 'error' ? console.error : type === 'success' ? console.log : console.info;
    logFn(`[MessageRenderer] ${type.toUpperCase()}: ${message}`);
  },

  /**
   * Copy code handler (public)
   */
  _copyCode(button: HTMLElement) {
    copyCode(button);
  },
};

// Global export (backward compatibility)
(window as any).MessageRenderer = MessageRenderer;

export { MessageRenderer };
