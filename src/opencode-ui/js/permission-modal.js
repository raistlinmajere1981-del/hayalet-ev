/**
 * OpenCode UI - Permission Modal
 * 
 * Queue-based permission handling UI
 * Adapted from CodeNomad's permission system
 */

const PermissionModal = {
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

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize permission modal
   */
  init() {
    this._createModal();
    
    // Subscribe to permission store changes
    if (typeof MessageStore !== 'undefined') {
      this._unsubscribe = MessageStore.subscribe((event) => {
        if (event.type?.startsWith('permission:')) {
          this._onPermissionChange();
        }
      });
    }
    
    console.log('[PermissionModal] Initialized');
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
    this._overlay.className = 'permission-overlay';
    this._overlay.onclick = () => this._handleDeny();
    
    // Modal
    this._modal = document.createElement('div');
    this._modal.className = 'permission-modal';
    this._modal.innerHTML = `
      <div class="permission-header">
        <div class="permission-icon">🔐</div>
        <h3 class="permission-title">İzin Gerekli</h3>
        <span class="permission-queue-badge" style="display: none;"></span>
      </div>
      <div class="permission-body">
        <div class="permission-type"></div>
        <div class="permission-description"></div>
        <div class="permission-details"></div>
      </div>
      <div class="permission-footer">
        <button class="permission-btn permission-btn-deny">
          <span class="btn-icon">✕</span>
          Reddet
        </button>
        <button class="permission-btn permission-btn-approve">
          <span class="btn-icon">✓</span>
          Onayla
        </button>
      </div>
    `;

    // Event listeners
    const denyBtn = this._modal.querySelector('.permission-btn-deny');
    const approveBtn = this._modal.querySelector('.permission-btn-approve');
    
    denyBtn?.addEventListener('click', () => this._handleDeny());
    approveBtn?.addEventListener('click', () => this._handleApprove());

    // Keyboard handler
    document.addEventListener('keydown', (e) => this._handleKeydown(e));

    // Add to DOM but hidden
    document.body.appendChild(this._overlay);
    document.body.appendChild(this._modal);
  },

  // ===========================================================================
  // Permission Handling
  // ===========================================================================

  /**
   * Handle permission store change
   */
  _onPermissionChange() {
    if (typeof MessageStore === 'undefined') return;

    const active = MessageStore.getActivePermission();
    const queue = MessageStore.getPermissionQueue();

    if (active) {
      this._showPermission(active, queue.length);
    } else {
      this._hide();
    }
  },

  /**
   * Show permission request
   * @param {Object} entry - Permission entry
   * @param {number} queueLength - Total items in queue
   */
  _showPermission(entry, queueLength) {
    if (!this._modal) return;

    const { permission } = entry;
    
    // Update content
    const typeEl = this._modal.querySelector('.permission-type');
    const descEl = this._modal.querySelector('.permission-description');
    const detailsEl = this._modal.querySelector('.permission-details');
    const queueBadge = this._modal.querySelector('.permission-queue-badge');

    if (typeEl) {
      typeEl.innerHTML = `
        <span class="type-icon">${this._getTypeIcon(permission.type)}</span>
        <span class="type-label">${this._escapeHtml(permission.title || permission.type)}</span>
      `;
    }

    if (descEl) {
      descEl.textContent = permission.description || 'Bu işlem için onayınız gerekiyor.';
    }

    if (detailsEl && permission.metadata) {
      detailsEl.innerHTML = this._renderMetadata(permission.metadata);
      detailsEl.style.display = 'block';
    } else if (detailsEl) {
      detailsEl.style.display = 'none';
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

    // Store current permission ID
    this._modal.setAttribute('data-permission-id', permission.id);

    this._show();
  },

  /**
   * Get icon for permission type
   * @param {string} type
   * @returns {string}
   */
  _getTypeIcon(type) {
    const icons = {
      'file_write': '📝',
      'file_delete': '🗑️',
      'command_execute': '⚡',
      'shell_command': '💻',
      'network_request': '🌐',
      'database_write': '💾',
      'tool_execute': '🔧',
    };
    return icons[type] || '❓';
  },

  /**
   * Render metadata details
   * @param {Object} metadata
   * @returns {string}
   */
  _renderMetadata(metadata) {
    const entries = Object.entries(metadata);
    if (entries.length === 0) return '';

    const items = entries.map(([key, value]) => {
      const label = this._formatLabel(key);
      const displayValue = typeof value === 'object' 
        ? JSON.stringify(value, null, 2)
        : String(value);
      
      return `
        <div class="detail-item">
          <span class="detail-label">${label}:</span>
          <span class="detail-value">${this._escapeHtml(displayValue)}</span>
        </div>
      `;
    });

    return items.join('');
  },

  /**
   * Format label from camelCase
   * @param {string} key
   * @returns {string}
   */
  _formatLabel(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  },

  // ===========================================================================
  // Actions
  // ===========================================================================

  /**
   * Handle approve action
   */
  _handleApprove() {
    const permissionId = this._modal?.getAttribute('data-permission-id');
    if (!permissionId) return;

    console.log('[PermissionModal] Approved:', permissionId);
    
    // Emit event for SSE server
    this._emitResponse(permissionId, true);
    
    // Remove from store
    if (typeof MessageStore !== 'undefined') {
      MessageStore.removePermission(permissionId);
    }
  },

  /**
   * Handle deny action
   */
  _handleDeny() {
    const permissionId = this._modal?.getAttribute('data-permission-id');
    if (!permissionId) return;

    console.log('[PermissionModal] Denied:', permissionId);
    
    // Emit event for SSE server
    this._emitResponse(permissionId, false);
    
    // Remove from store
    if (typeof MessageStore !== 'undefined') {
      MessageStore.removePermission(permissionId);
    }
  },

  /**
   * Emit permission response event
   * @param {string} permissionId
   * @param {boolean} approved
   */
  _emitResponse(permissionId, approved) {
    // Dispatch custom event for app.js to handle
    const event = new CustomEvent('permission:response', {
      detail: { permissionId, approved }
    });
    document.dispatchEvent(event);
  },

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e
   */
  _handleKeydown(e) {
    if (!this._isVisible) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      this._handleApprove();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._handleDeny();
    }
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
    
    // Focus approve button
    setTimeout(() => {
      this._modal?.querySelector('.permission-btn-approve')?.focus();
    }, 100);
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
   * Manually show a permission (for testing or direct calls)
   * @param {Object} permission
   */
  showPermission(permission) {
    if (typeof MessageStore !== 'undefined') {
      MessageStore.upsertPermission({
        id: permission.id,
        messageId: '',
        partId: '',
        permission,
        status: 'pending',
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
window.PermissionModal = PermissionModal;
