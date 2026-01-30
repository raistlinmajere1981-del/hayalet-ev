/**
 * Message Element Renderers
 * Message card + step card + thinking block rendering
 */

import { renderMarkdown, escapeHtml } from './markdown-parser.js';
import { createStatusIndicator } from './syntax-highlighter.js';
import type { MessageRecord, StepData } from './types.js';

/**
 * Format token count (1.5K, 12K, etc)
 */
function formatTokenCount(count: number): string {
  if (!count || count === 0) return '0';
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}

/**
 * Format timestamp to time string
 */
function formatTime(timestamp: number): string {
  if (!timestamp) return '?';
  return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Render step card for start status (running)
 */
function renderStepCardStart(step: StepData): string {
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
        <span class="step-meta-item">ID: ${escapeHtml(step.id)}</span>
        <span class="step-meta-item">Başlangıç: ${formatTime(step.startedAt || 0)}</span>
      </div>
    </div>
  `;
}

/**
 * Render step card for finish status (completed with tokens)
 */
function renderStepCardFinish(step: StepData): string {
  const inputTokens = step.inputTokens || 0;
  const outputTokens = step.outputTokens || 0;
  const totalTokens = inputTokens + outputTokens;
  const cost = step.cost || 0;
  const duration = step.finishedAt && step.startedAt
    ? ((step.finishedAt - step.startedAt) / 1000).toFixed(1)
    : '?';
  const startTime = formatTime(step.startedAt || 0);
  const endTime = formatTime(step.finishedAt || 0);

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
        <span class="token-badge" title="${tokenTooltip}">${formatTokenCount(totalTokens)} tokens</span>
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
}

/**
 * Create message element
 */
function createMessageElement(message: MessageRecord, status?: string): HTMLElement {
  const div = document.createElement('div');

  // Add status class for optimistic updates styling
  const statusClass = status ? ` ${status}` : '';
  div.className = `message-card ${message.role}${statusClass}`;
  div.setAttribute('data-message-id', message.id);
  div.setAttribute('data-status', status || 'complete');

  const avatarInitial = message.role === 'user' ? 'U' : 'AI';
  const authorName = message.role === 'user' ? 'You' : 'OpenCode';
  const time = message.timestamp ? formatTime(message.timestamp) : '';

  // Status indicator HTML
  const statusIndicator = createStatusIndicator(status);

  // Agent/Model info for assistant messages (dynamic from AgentModelSelector)
  const metaInfo = message.role === 'assistant' ? getAgentModelMetaHtml() : '';

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
      <div class="message-body" data-raw-content="${escapeHtml(message.content || '')}">
        <div class="message-text-content">
          ${renderMarkdown(message.content || '')}
        </div>
      </div>
      ${metaInfo}
    </div>
    ${actionButtons}
  `;

  // Add retry button for error state
  if (status === 'error') {
    const retryBtn = createRetryButton(message.id);
    div.querySelector('.message-body')?.appendChild(retryBtn);
  }

  return div;
}

/**
 * Create retry button for failed messages
 */
function createRetryButton(messageId: string): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'message-retry-btn';
  btn.innerHTML = '🔄 Tekrar Dene';
  btn.setAttribute('data-message-id', messageId);
  btn.onclick = () => {
    // Will be bound to MessageRenderer._handleRetry in manager
  };
  return btn;
}

/**
 * Get dynamic Agent/Model meta HTML for assistant messages
 */
function getAgentModelMetaHtml(): string {
  // Try to get from AgentModelSelector (dynamic)
  if (window.AgentModelSelector?.getCurrentAgent) {
    const agent = window.AgentModelSelector.getCurrentAgent() as { name?: string } | null;
    const modelInfo = (window.AgentModelSelector.getCurrentModel ? window.AgentModelSelector.getCurrentModel() : null) as { model?: { name?: string; id?: string; providerId?: string } } | null;

    const agentName = agent?.name || 'coder';
    const modelName = modelInfo?.model?.name || modelInfo?.model?.id || 'default';
    const modelKey = modelInfo?.model
      ? `${modelInfo.model.providerId}/${modelInfo.model.id}`
      : '';

    return `
      <div class="message-meta">
        <span class="agent-info" title="Current Agent">Agent: ${escapeHtml(agentName)}</span> •
        <span class="model-info" title="${escapeHtml(modelKey)}">Model: ${escapeHtml(modelName)}</span>
      </div>
    `;
  }

  // Fallback - try to get from session info
  const session = window.SessionStore?.getCurrentSession?.() as { agent?: string; model?: string } | undefined;
  if (session?.agent || session?.model) {
    const agentName = session.agent || 'coder';
    const modelName = session.model || 'default';

    return `
      <div class="message-meta">
        <span class="agent-info">Agent: ${escapeHtml(agentName)}</span> •
        <span class="model-info">Model: ${escapeHtml(modelName)}</span>
      </div>
    `;
  }

  // Last resort - minimal display
  return `
    <div class="message-meta">
      <span class="agent-info">Agent: coder</span>
    </div>
  `;
}

export {
  formatTokenCount,
  formatTime,
  renderStepCardStart,
  renderStepCardFinish,
  createMessageElement,
  createRetryButton,
  getAgentModelMetaHtml,
};
