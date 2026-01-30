/**
 * OpenCode UI - Instance Tabs
 * 
 * Tab bar bileşeni - birden fazla workspace/instance yönetimi.
 * Her tab bir OpenCode instance'ını temsil eder.
 * 
 * Adapted from CodeNomad's instance-tabs.tsx
 */

interface TabCallbacks {
  onSelect: ((id: string) => void) | null;
  onClose: ((id: string) => void) | null;
  onNew: (() => void) | null;
}

const InstanceTabs = {
  _container: null as HTMLElement | null,

  _unsubscribe: null as (() => void) | null,

  _callbacks: {
    onSelect: null,
    onClose: null,
    onNew: null,
  } as TabCallbacks,

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize instance tabs
   * @param {HTMLElement} container - Container element
   * @param {Object} callbacks
   * @param {Function} callbacks.onSelect - Called when tab is selected
   * @param {Function} callbacks.onClose - Called when tab close is clicked
   * @param {Function} callbacks.onNew - Called when new tab is clicked
   */
  init(container: HTMLElement, callbacks: { onSelect?: (id: string) => void; onClose?: (id: string) => void; onNew?: () => void } = {}) {
    this._container = container;
    this._callbacks = {
      onSelect: callbacks.onSelect || (() => {}),
      onClose: callbacks.onClose || (() => {}),
      onNew: callbacks.onNew || (() => {}),
    };

    // Subscribe to InstanceStore
    if (typeof InstanceStore !== 'undefined' && InstanceStore?.subscribe) {
      this._unsubscribe = InstanceStore.subscribe((event: unknown) => this._onStoreChange(event as { type: string }));
    }

    // Initial render
    this.render();

    // Setup keyboard shortcuts
    this._setupKeyboardShortcuts();

    console.log('[InstanceTabs] Initialized');
  },

  /**
   * Cleanup
   */
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
  },

  // ===========================================================================
  // Rendering
  // ===========================================================================

  /**
   * Render tabs
   */
  render() {
    if (!this._container) return;

    const instances = (typeof InstanceStore !== 'undefined' && InstanceStore?.getInstancesArray
      ? InstanceStore.getInstancesArray() 
      : []) as Array<{ id: string; name: string; folder: string; status?: string }>;
    const activeId = typeof InstanceStore !== 'undefined' && InstanceStore?.getActiveInstanceId
      ? InstanceStore.getActiveInstanceId() 
      : null;

    // Build tabs HTML
    const tabsHtml = instances.map(instance => this._renderTab(instance, instance.id === activeId)).join('');

    // Keyboard hints (show when multiple instances)
    const keyboardHints = instances.length > 1 ? `
      <div class="instance-tabs-hints">
        <span class="hint"><kbd>Ctrl</kbd>+<kbd>←</kbd><kbd>→</kbd></span>
      </div>
    ` : '';

    this._container.innerHTML = `
      <div class="instance-tabs-bar">
        <div class="instance-tabs-scroll">
          <div class="instance-tabs-strip">
            ${tabsHtml}
            <button class="instance-tab-new" onclick="InstanceTabs._handleNew()" title="Yeni Instance (Ctrl+N)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
        ${keyboardHints}
      </div>
    `;
  },

  /**
   * Render single tab
   * @param {Object} instance
   * @param {boolean} isActive
   * @returns {string}
   */
  _renderTab(instance: { status?: string; name?: string; folder?: string; id?: string }, isActive: boolean) {
    const statusClass = instance.status || 'disconnected';
    const activeClass = isActive ? 'active' : '';
    const name = this._escapeHtml(instance.name || instance.folder || 'Instance');
    
    // Status indicator
    const statusIcon = this._getStatusIcon(instance.status ?? 'disconnected');
    
    return `
      <div class="instance-tab ${activeClass} ${statusClass}" 
           data-instance-id="${instance.id}"
           onclick="InstanceTabs._handleSelect('${instance.id}')"
           title="${this._escapeHtml(instance.folder || '')}">
        <span class="instance-tab-status">${statusIcon}</span>
        <span class="instance-tab-name">${name}</span>
        <button class="instance-tab-close" 
                onclick="event.stopPropagation(); InstanceTabs._handleClose('${instance.id}')"
                title="Kapat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  },

  /**
   * Get status icon
   * @param {string} status
   * @returns {string}
   */
  _getStatusIcon(status: string) {
    switch (status) {
      case 'connected':
        return '<span class="status-dot connected"></span>';
      case 'connecting':
        return '<span class="status-dot connecting"></span>';
      case 'error':
        return '<span class="status-dot error"></span>';
      default:
        return '<span class="status-dot disconnected"></span>';
    }
  },

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  /**
   * Handle store change
   * @param {Object} event
   */
  _onStoreChange(event: { type: string }) {
    // Re-render on any instance change
    if (event.type.startsWith('instance:')) {
      this.render();
    }
  },

  /**
   * Handle tab selection
   * @param {string} instanceId
   */
  _handleSelect(instanceId: string) {
    if (typeof InstanceStore !== 'undefined' && InstanceStore?.setActiveInstance) {
      InstanceStore.setActiveInstance(instanceId);
    }
    this._callbacks.onSelect?.(instanceId);
  },

  /**
   * Handle tab close
   * @param {string} instanceId
   */
  _handleClose(instanceId: string) {
    // Son tab'u kapatmaya çalışırsa uyarı göster
    if (typeof InstanceStore !== 'undefined' && InstanceStore?.getInstanceCount) {
      const instanceCount = InstanceStore.getInstanceCount();
      
      if (instanceCount <= 1) {
        // Son tab - kapatmayı engelle ve bilgilendir
        this._showLastTabWarning();
        return;
      }
    }
    
    // Confirm dialog
    const instance = typeof InstanceStore !== 'undefined' && InstanceStore?.getInstance
      ? InstanceStore.getInstance(instanceId) 
      : null;
    const instanceName = instance?.name || instance?.folder || 'Instance';
    
    if (confirm(`"${instanceName}" kapatılsın mı?`)) {
      this._callbacks.onClose?.(instanceId);
    }
  },

  /**
   * Son tab uyarısı göster
   */
  _showLastTabWarning() {
    // Toast mesajı göster (OpenCodeApp varsa)
    if (typeof OpenCodeApp !== 'undefined' && OpenCodeApp._showToast) {
      OpenCodeApp._showToast('Son instance kapatılamaz', 'warning');
    } else {
      console.log('[InstanceTabs] Cannot close last instance');
    }
  },

  /**
   * Handle new tab
   */
  _handleNew() {
    // Workspace seçme dialog'u göster
    this._showWorkspaceSelector();
  },

  /**
   * Workspace seçme dialog'u göster
   */
  _showWorkspaceSelector() {
    // Electron API varsa native folder dialog kullan
    if (window.electronAPI?.showOpenDialog) {
      window.electronAPI.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Workspace Seçin',
        buttonLabel: 'Seç'
      }).then(result => {
        if (result && !result.canceled && result.filePaths?.length > 0) {
          const folderPath = result.filePaths[0];
          if (folderPath) {
            this._createInstanceFromFolder(folderPath);
          }
        }
      }).catch(err => {
        console.error('[InstanceTabs] Folder dialog error:', err);
      });
    } else {
      // Fallback: callback'i çağır (harici handling için)
      this._callbacks.onNew?.();
    }
  },

  /**
   * Klasörden yeni instance oluştur
   * @param {string} folderPath
   */
  async _createInstanceFromFolder(folderPath: string) {
    if (typeof InstanceStore === 'undefined') {
      console.error('[InstanceTabs] InstanceStore not available');
      return;
    }

    const folderName = folderPath.split('/').pop() || folderPath.split('\\').pop() || 'Workspace';
    
    // Instance oluştur
    if (!InstanceStore?.createInstance) {
      console.error('[InstanceTabs] InstanceStore.createInstance not available');
      return;
    }
    const instance = InstanceStore.createInstance({
      folder: folderPath,
      name: folderName,
    });

    console.log('[InstanceTabs] Created instance:', instance.id, folderName);

    // SSE bağlantısı kur (OpenCodeApp üzerinden)
    if (typeof OpenCodeApp !== 'undefined' && OpenCodeApp?.createInstance) {
      await OpenCodeApp.createInstance({
        folder: folderPath,
        name: folderName,
      });
    }

    // Yeni instance'a geç
    if (InstanceStore?.setActiveInstance) {
      InstanceStore.setActiveInstance(instance.id);
    }
    this._callbacks.onSelect?.(instance.id);
  },

  // ===========================================================================
  // Keyboard Shortcuts
  // ===========================================================================

  _keydownHandler: null as ((e: KeyboardEvent) => void) | null,

  /**
   * Setup keyboard shortcuts
   */
  _setupKeyboardShortcuts() {
    this._keydownHandler = (e: KeyboardEvent) => {
      // Ignore if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl+N - New instance
      if (ctrlOrMeta && e.key === 'n') {
        e.preventDefault();
        this._handleNew();
        return;
      }

      // Ctrl+Tab or Ctrl+Right - Next instance
      if (ctrlOrMeta && (e.key === 'Tab' && !e.shiftKey || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (typeof InstanceStore !== 'undefined' && InstanceStore?.nextInstance) {
          const newId = InstanceStore.nextInstance();
          if (newId) this._callbacks.onSelect?.(newId);
        }
        return;
      }

      // Ctrl+Shift+Tab or Ctrl+Left - Previous instance
      if (ctrlOrMeta && (e.key === 'Tab' && e.shiftKey || e.key === 'ArrowLeft')) {
        e.preventDefault();
        if (typeof InstanceStore !== 'undefined' && InstanceStore?.prevInstance) {
          const newId = InstanceStore.prevInstance();
          if (newId) this._callbacks.onSelect?.(newId);
        }
        return;
      }

      // Ctrl+1-9 - Switch to instance by index
      if (ctrlOrMeta && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key, 10);
        if (typeof InstanceStore !== 'undefined' && InstanceStore?.switchToIndex) {
          const newId = InstanceStore.switchToIndex(index);
          if (newId) this._callbacks.onSelect?.(newId);
        }
        return;
      }

      // Ctrl+W - Close current instance
      if (ctrlOrMeta && e.key === 'w') {
        e.preventDefault();
        if (typeof InstanceStore !== 'undefined' && InstanceStore?.getActiveInstanceId) {
          const activeId = InstanceStore.getActiveInstanceId();
          if (activeId) this._handleClose(activeId);
        }
        return;
      }
    };

    document.addEventListener('keydown', this._keydownHandler);
  },

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Escape HTML
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text: string) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

// ES6 Export
export { InstanceTabs };

// Global export (backward compatibility)
window.InstanceTabs = InstanceTabs;
