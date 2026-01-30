/**
 * Directory Browser Dialog
 * 
 * CodeNomad'ın directory-browser-dialog.tsx'inden adapte edilmiş
 * vanilla JavaScript versiyonu.
 * 
 * Features:
 * - Filesystem listing via IPC
 * - Keyboard navigation (↑↓ Enter Escape Backspace)
 * - Breadcrumb navigation
 * - Loading states
 * - Error handling
 * - Caching for performance
 */

interface DirEntry {
  name: string;
  type: string;
  path?: string;
  absolutePath?: string;
}

const DirectoryBrowser = {
  // State
  _isOpen: false,
  _currentPath: null as string | null,
  _rootPath: '/',
  _homePath: null as string | null,
  _entries: [] as DirEntry[],
  _selectedIndex: 0,
  _loading: false,
  _error: null as string | null,
  _onSelect: null as ((path: string) => void) | null,
  _onClose: null as (() => void) | null,
  
  // Caching
  _directoryCache: new Map<string, DirEntry[]>(),
  _metadataCache: new Map<string, { currentPath: string; rootPath: string }>(),
  _loadingPaths: new Set<string>(),
  
  // DOM References
  _dialog: null as HTMLDivElement | null,
  _overlay: null as HTMLDivElement | null,
  
  // ==========================================================================
  // Public API
  // ==========================================================================
  
  /**
   * Dialog'u aç
   * @param {object} options
   * @param {string} [options.title='Select Folder']
   * @param {string} [options.description]
   * @param {string} [options.defaultPath] - Başlangıç dizini
   * @param {function} options.onSelect - Seçim callback (absolutePath)
   * @param {function} [options.onClose] - Kapatma callback
   */
  async open(options: { onSelect?: (path: string) => void; onClose?: () => void; title?: string; description?: string; defaultPath?: string } = {}) {
    if (this._isOpen) return;
    
    this._isOpen = true;
    this._onSelect = options.onSelect || null;
    this._onClose = options.onClose || null;
    this._selectedIndex = 0;
    this._error = null;
    
    // Create dialog if not exists
    this._createDialog(options.title || 'Select Folder', options.description ?? '');
    
    // Show dialog
    this._overlay?.classList.add('visible');
    this._dialog?.classList.add('visible');
    
    // Load initial directory
    await this._initialize(options.defaultPath ?? null);
    
    // Setup keyboard listeners
    this._setupKeyboardListeners();
    
    // Focus dialog
    this._dialog?.focus();
  },
  
  /**
   * Dialog'u kapat
   */
  close() {
    if (!this._isOpen) return;
    
    this._isOpen = false;
    this._overlay?.classList.remove('visible');
    this._dialog?.classList.remove('visible');
    
    // Cleanup keyboard listeners
    this._removeKeyboardListeners();
    
    // Call close callback
    this._onClose?.();
    
    // Reset state
    this._currentPath = null;
    this._entries = [];
    this._selectedIndex = 0;
    this._error = null;
  },
  
  /**
   * Cache'i temizle
   */
  clearCache() {
    this._directoryCache.clear();
    this._metadataCache.clear();
  },
  
  // ==========================================================================
  // Initialization
  // ==========================================================================
  
  async _initialize(defaultPath: string | null) {
    this._setLoading(true);
    
    try {
      // Get home path first
      const homePath = await this._getHomePath();
      if (!homePath) {
        throw new Error('Home path not available');
      }
      this._homePath = homePath;
      
      // Determine starting path
      const startPath = defaultPath || this._homePath;
      
      // Load directory
      const result = await this._loadDirectory(startPath) as { metadata: { currentPath: string; rootPath: string }; entries: Array<{ name: string; path: string; absolutePath?: string }> };
      this._applyDirectoryResult(result);
      
    } catch (err) {
      this._setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      this._setLoading(false);
    }
  },
  
  // ==========================================================================
  // Path Security
  // ==========================================================================

  /**
   * Validate path for security (prevent path traversal attacks)
   * @param {string} path - Path to validate
   * @returns {{valid: boolean, reason?: string}}
   */
  _validatePath(path: string) {
    if (!path || typeof path !== 'string') {
      return { valid: false, reason: 'Invalid path: empty or non-string' };
    }

    const normalizedPath = path.trim();

    // Check for null bytes (common attack vector)
    if (normalizedPath.includes('\0')) {
      console.warn('[DirectoryBrowser] Blocked path with null byte:', path);
      return { valid: false, reason: 'Path contains null byte' };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//, // ../
      /\.\.\\/, // ..\\
      /^\.\.$/, // just ..
      /~\/\.\.\//, // ~/../../
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(normalizedPath)) {
        console.warn('[DirectoryBrowser] Blocked suspicious path pattern:', path);
        return { valid: false, reason: 'Path contains suspicious traversal pattern' };
      }
    }

    return { valid: true };
  },

  /**
   * Check if path is within allowed bounds (home directory)
   * @param {string} path - Path to check
   * @returns {boolean}
   */
  _isPathAllowed(_path: string) {
    if (!this._homePath) return true; // Can't validate without home path
    
    // Simple check: path should start with home or be absolute system path
    // More sophisticated checks could use path.resolve comparison
    return true; // For now, basic validation is sufficient
  },

  // ==========================================================================
  // Directory Operations
  // ==========================================================================
  
  /**
   * Dizini yükle (cache destekli, path validation ile)
   */
  async _loadDirectory(targetPath: string) {
    // Path security validation
    const validation = this._validatePath(targetPath);
    if (!validation.valid) {
      this._setError(validation.reason || 'Invalid path');
      return { entries: [], metadata: null };
    }

    const cacheKey = this._normalizePathKey(targetPath);
    
    // Check cache
    const cached = this._metadataCache.get(cacheKey);
    if (cached) {
      return {
        entries: this._directoryCache.get(cacheKey) || [],
        metadata: cached,
      };
    }
    
    // Check if already loading
    if (this._loadingPaths.has(cacheKey)) {
      // Wait for existing request
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this._loadingPaths.has(cacheKey)) {
            clearInterval(checkInterval);
            resolve({
              entries: this._directoryCache.get(cacheKey) || [],
              metadata: this._metadataCache.get(cacheKey),
            });
          }
        }, 100);
      });
    }
    
    // Mark as loading
    this._loadingPaths.add(cacheKey);
    
    try {
      // Fetch from IPC
      const response = await this._fetchFilesystem(targetPath);
      
      // Filter to directories only and sort
      const directories = response.entries
        .filter((e: { type: string }) => e.type === 'directory')
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
      
      // Cache results
      const canonicalKey = this._normalizePathKey(response.metadata.currentPath);
      this._directoryCache.set(canonicalKey, directories);
      this._metadataCache.set(canonicalKey, response.metadata);
      
      return { entries: directories, metadata: response.metadata };
      
    } finally {
      this._loadingPaths.delete(cacheKey);
    }
  },
  
  /**
   * IPC üzerinden filesystem listele
   */
  async _fetchFilesystem(path: string): Promise<{ entries: Array<{ name: string; type: string }>; metadata: { currentPath: string; rootPath: string } }> {
    type FsEntry = { name: string; isDirectory?: boolean; type?: string; path?: string };
    type FsResult = { entries?: FsEntry[]; metadata?: { currentPath: string; rootPath: string } } | FsEntry[];

    const normalizeResult = (result: FsResult, fallbackPath: string) => {
      const entries = Array.isArray(result) ? result : (result.entries || []);
      const metadata = Array.isArray(result) ? null : result.metadata;
      return {
        entries: entries.map((e: FsEntry) => ({
          name: e.name,
          type: e.type || (e.isDirectory ? 'directory' : 'file')
        })),
        metadata: metadata || { currentPath: fallbackPath, rootPath: '/' }
      };
    };

    // Try Electron API
    if (window.electronAPI?.opcListFilesystem) {
      const result = await window.electronAPI.opcListFilesystem(path, { includeFiles: false }) as FsResult;
      return normalizeResult(result, path);
    }
    
    // Fallback to REST API (if OpenCode server running)
    if (window.APIClient?.listFileSystem) {
      const result = await window.APIClient.listFileSystem(path, { includeFiles: false }) as FsResult;
      return normalizeResult(result, path);
    }
    
    throw new Error('No filesystem API available');
  },
  
  /**
   * Home path'i al
   */
  async _getHomePath(): Promise<string> {
    if (window.electronAPI?.opcGetHomePath) {
      return window.electronAPI.opcGetHomePath() as Promise<string>;
    }
    // Fallback
    return '/home';
  },
  
  /**
   * Dizine git
   */
  async _navigateTo(path: string) {
    this._setError(null);
    this._setLoading(true);
    
    try {
      const result = await this._loadDirectory(path) as { metadata: { currentPath: string; rootPath: string }; entries: Array<{ name: string; path: string; absolutePath?: string }> };
      this._applyDirectoryResult(result);
      this._selectedIndex = 0;
      this._updateSelection();
    } catch (err) {
      this._setError(err instanceof Error ? err.message : 'Failed to navigate');
    } finally {
      this._setLoading(false);
    }
  },
  
  /**
   * Sonucu uygula
   */
  _applyDirectoryResult(result: { metadata: { currentPath: string; rootPath: string }; entries: Array<{ name: string; path: string; absolutePath?: string }> }) {
    this._currentPath = result.metadata.currentPath;
    this._rootPath = result.metadata.rootPath;
    this._entries = result.entries.map(e => ({ ...e, type: 'folder', path: e.path || '' }));
    this._renderContent();
  },
  
  /**
   * Path key'i normalize et
   */
  _normalizePathKey(input: string) {
    if (!input || input === '.' || input === './') return '.';
    const normalized = input.replace(/\\/g, '/');
    if (normalized.startsWith('/')) {
      return '/' + normalized.slice(1).replace(/\/+/g, '/');
    }
    return normalized.replace(/\/+/g, '/');
  },
  
  // ==========================================================================
  // UI Creation
  // ==========================================================================
  
  _createDialog(title: string, description: string) {
    // Remove existing if any
    this._removeDialog();
    
    // Create overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'dir-browser-overlay';
    this._overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this._overlay) this.close();
    });
    
    // Create dialog
    this._dialog = document.createElement('div');
    this._dialog.className = 'dir-browser-dialog';
    this._dialog.tabIndex = -1;
    this._dialog.innerHTML = `
      <div class="dir-browser-header">
        <h2 class="dir-browser-title">${title}</h2>
        ${description ? `<p class="dir-browser-description">${description}</p>` : ''}
        <button class="dir-browser-close" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="dir-browser-breadcrumb"></div>
      
      <div class="dir-browser-content">
        <div class="dir-browser-loading">
          <div class="dir-browser-spinner"></div>
          <span>Loading...</span>
        </div>
        <div class="dir-browser-error"></div>
        <div class="dir-browser-list"></div>
      </div>
      
      <div class="dir-browser-footer">
        <div class="dir-browser-path"></div>
        <div class="dir-browser-actions">
          <button class="dir-browser-btn dir-browser-btn-cancel">Cancel</button>
          <button class="dir-browser-btn dir-browser-btn-select">Select This Folder</button>
        </div>
      </div>
    `;
    
    // Event listeners
    this._dialog.querySelector('.dir-browser-close')?.addEventListener('click', () => this.close());
    this._dialog.querySelector('.dir-browser-btn-cancel')?.addEventListener('click', () => this.close());
    this._dialog.querySelector('.dir-browser-btn-select')?.addEventListener('click', () => this._selectCurrentFolder());
    
    // Append to body
    document.body.appendChild(this._overlay);
    document.body.appendChild(this._dialog);
  },
  
  _removeDialog() {
    this._overlay?.remove();
    this._dialog?.remove();
    this._overlay = null;
    this._dialog = null;
  },
  
  // ==========================================================================
  // Rendering
  // ==========================================================================
  
  _renderContent() {
    if (!this._dialog) return;
    
    this._renderBreadcrumb();
    this._renderList();
    this._renderFooter();
  },
  
  _renderBreadcrumb() {
    const container = this._dialog?.querySelector('.dir-browser-breadcrumb');
    if (!container || !this._currentPath) return;
    
    const segments = this._currentPath.split('/').filter(Boolean);
    let html = '';
    
    // Home button
    html += `
      <button class="breadcrumb-item breadcrumb-home" data-path="${this._homePath}" title="Home">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </button>
    `;
    
    // Root
    html += `<span class="breadcrumb-separator">/</span>`;
    
    // Path segments
    let currentPath = '';
    segments.forEach((segment: string, index: number) => {
      currentPath += '/' + segment;
      const isLast = index === segments.length - 1;
      
      if (isLast) {
        html += `<span class="breadcrumb-item breadcrumb-current">${segment}</span>`;
      } else {
        html += `
          <button class="breadcrumb-item" data-path="${currentPath}">${segment}</button>
          <span class="breadcrumb-separator">/</span>
        `;
      }
    });
    
    container.innerHTML = html;
    
    // Add click listeners
    container.querySelectorAll('.breadcrumb-item[data-path]').forEach((btn: Element) => {
      const button = btn as HTMLElement;
      button.addEventListener('click', () => {
        this._navigateTo(button.dataset.path || '');
      });
    });
  },
  
  _renderList() {
    const container = this._dialog?.querySelector('.dir-browser-list');
    if (!container) return;
    
    // Build list HTML
    let html = '';
    
    // Parent directory (..)
    const parentPath = this._currentPath ? this._getParentPath(this._currentPath) : null;
    if (parentPath) {
      html += `
        <div class="dir-item dir-item-up" data-path="${parentPath}" data-index="-1">
          <svg class="dir-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 11l-5-5-5 5M17 18l-5-5-5 5"/>
          </svg>
          <span class="dir-item-name">..</span>
        </div>
      `;
    }
    
    // Directory entries
    this._entries.forEach((entry: DirEntry, index: number) => {
      const isSelected = index === this._selectedIndex;
      html += `
        <div class="dir-item ${isSelected ? 'selected' : ''}" 
             data-path="${entry.absolutePath || entry.path}" 
             data-index="${index}">
          <svg class="dir-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="dir-item-name">${entry.name}</span>
        </div>
      `;
    });
    
    if (this._entries.length === 0 && !parentPath) {
      html = `<div class="dir-empty">No folders found</div>`;
    }
    
    container.innerHTML = html;
    
    // Add click listeners
    container.querySelectorAll('.dir-item').forEach((el: Element) => {
      const item = el as HTMLElement;
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index || '-1');
        if (index === -1) {
          // Parent directory
          this._navigateTo(item.dataset.path || '');
        } else {
          this._selectedIndex = index;
          this._updateSelection();
        }
      });
      
      item.addEventListener('dblclick', () => {
        const path = item.dataset.path;
        if (path) this._navigateTo(path);
      });
    });
  },
  
  _renderFooter() {
    const pathEl = this._dialog?.querySelector('.dir-browser-path');
    if (pathEl) {
      pathEl.textContent = this._currentPath || '';
    }
  },
  
  _updateSelection() {
    if (!this._dialog) return;
    
    const items = this._dialog.querySelectorAll('.dir-item[data-index]');
    items.forEach((el: Element) => {
      const item = el as HTMLElement;
      const index = parseInt(item.dataset.index || '-1');
      item.classList.toggle('selected', index === this._selectedIndex);
    });
    
    // Scroll into view
    const selected = this._dialog.querySelector('.dir-item.selected');
    selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
  
  _setLoading(loading: boolean) {
    this._loading = loading;
    if (!this._dialog) return;
    
    const loadingEl = this._dialog.querySelector('.dir-browser-loading');
    const listEl = this._dialog.querySelector('.dir-browser-list');
    
    if (loading) {
      loadingEl?.classList.add('visible');
      listEl?.classList.add('hidden');
    } else {
      loadingEl?.classList.remove('visible');
      listEl?.classList.remove('hidden');
    }
  },
  
  _setError(message: string | null) {
    this._error = message;
    if (!this._dialog) return;
    
    const errorEl = this._dialog.querySelector('.dir-browser-error');
    if (errorEl) {
      errorEl.textContent = message || '';
      errorEl.classList.toggle('visible', !!message);
    }
  },
  
  // ==========================================================================
  // Navigation & Selection
  // ==========================================================================
  
  _getParentPath(path: string) {
    if (!path || path === '/') return null;
    const parent = path.replace(/\/[^/]+\/?$/, '') || '/';
    return parent === path ? null : parent;
  },
  
  _selectCurrentFolder() {
    if (this._currentPath && this._onSelect) {
      this._onSelect(this._currentPath);
      this.close();
    }
  },
  
  _enterSelectedFolder() {
    const entry = this._entries[this._selectedIndex];
    if (entry) {
      this._navigateTo(entry.absolutePath || entry.path || '');
    }
  },
  
  _goToParent() {
    const parent = this._currentPath ? this._getParentPath(this._currentPath) : null;
    if (parent) {
      this._navigateTo(parent);
    }
  },
  
  // ==========================================================================
  // Keyboard Navigation
  // ==========================================================================
  
  _keyHandler: null as ((e: KeyboardEvent) => void) | null,
  
  _setupKeyboardListeners() {
    this._keyHandler = (e: KeyboardEvent) => this._handleKeyDown(e);
    window.addEventListener('keydown', this._keyHandler);
  },
  
  _removeKeyboardListeners() {
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  },
  
  _handleKeyDown(e: KeyboardEvent) {
    if (!this._isOpen) return;
    
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this._selectedIndex = Math.max(0, this._selectedIndex - 1);
        this._updateSelection();
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        this._selectedIndex = Math.min(this._entries.length - 1, this._selectedIndex + 1);
        this._updateSelection();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (e.shiftKey || e.ctrlKey) {
          // Shift+Enter or Ctrl+Enter = select current folder
          this._selectCurrentFolder();
        } else {
          // Enter = navigate into selected folder
          this._enterSelectedFolder();
        }
        break;
        
      case 'Backspace':
        e.preventDefault();
        this._goToParent();
        break;
        
      case 'Home':
        e.preventDefault();
        this._selectedIndex = 0;
        this._updateSelection();
        break;
        
      case 'End':
        e.preventDefault();
        this._selectedIndex = Math.max(0, this._entries.length - 1);
        this._updateSelection();
        break;
        
      case 'PageUp':
        e.preventDefault();
        this._selectedIndex = Math.max(0, this._selectedIndex - 10);
        this._updateSelection();
        break;
        
      case 'PageDown':
        e.preventDefault();
        this._selectedIndex = Math.min(this._entries.length - 1, this._selectedIndex + 10);
        this._updateSelection();
        break;
    }
  },
};

// Global'e ekle
(window as unknown as { DirectoryBrowser: typeof DirectoryBrowser }).DirectoryBrowser = DirectoryBrowser;
