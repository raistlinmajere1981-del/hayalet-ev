/**
 * Attachment Handler
 * Attachment rendering, paste, drag & drop
 */

import type { AttachmentItem } from './types.js';

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAttachmentIcon(type: string, mimeType?: string): string {
  if (type === 'image') return '🖼️';
  if (type === 'text') return '📝';
  if (type === 'agent') return '🤖';

  if (mimeType) {
    if (mimeType.includes('javascript') || mimeType.includes('typescript')) return '🟨';
    if (mimeType.includes('python')) return '🐍';
    if (mimeType.includes('json')) return '📋';
    if (mimeType.includes('html')) return '🌐';
    if (mimeType.includes('css')) return '🎨';
    if (mimeType.includes('markdown')) return '📖';
  }

  return '📄';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function truncateName(name: string, maxLen: number): string {
  if (!name || name.length <= maxLen) return name;
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  const baseName = name.slice(0, name.length - ext.length);
  const truncLen = maxLen - ext.length - 3;
  return baseName.slice(0, truncLen) + '...' + ext;
}

function renderAttachmentChip(att: AttachmentItem): string {
  const icon = getAttachmentIcon(att.type, att.mimeType);
  const sizeStr = att.size ? formatFileSize(att.size) : '';

  let previewHtml = '';
  if (att.type === 'image' && att.dataUrl) {
    previewHtml = `
      <div class="attachment-preview" data-full-image="${att.dataUrl}" title="Önizleme için tıkla">
        <img src="${att.dataUrl}" alt="${att.name}" />
      </div>
    `;
  }

  let contentPreview = '';
  if (att.type === 'file' && att.content) {
    const previewLines = att.content.split('\n').slice(0, 10).join('\n');
    const escapedContent = escapeHtml(previewLines);
    const truncated = att.content.split('\n').length > 10 ? '\n...' : '';
    contentPreview = `data-content-preview="${escapedContent}${truncated}"`;
  }

  return `
    <div class="attachment-chip ${att.type}" data-attachment-id="${att.id}" ${contentPreview} title="${att.name}${
    sizeStr ? ' (' + sizeStr + ')' : ''
  }">
      ${
        previewHtml ||
        `<span class="attachment-icon">${icon}</span><span class="attachment-name">${truncateName(
          att.name,
          20
        )}</span>${sizeStr ? `<span class="attachment-size">${sizeStr}</span>` : ''}`
      }
      <button class="remove-attachment" title="Kaldır">×</button>
    </div>
  `;
}

function showImagePreview(dataUrl: string) {
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

  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}

export { escapeHtml, getAttachmentIcon, formatFileSize, truncateName, renderAttachmentChip, showImagePreview };
