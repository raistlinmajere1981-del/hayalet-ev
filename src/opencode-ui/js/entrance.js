/**
 * OpenCode UI - Entrance Page
 * 
 * Workspace seçim sayfası JavaScript
 */

const EntranceApp = {
  // State
  _recentFolders: [],
  _selectedIndex: 0,
  _configLoaded: false,
  _pendingRequests: new Map(), // postMessage request tracking
  _requestId: 0,

  /**
   * Initialize the entrance app
   */
  async init() {
    console.log('[Entrance] Initializing...');
    
    // Setup postMessage bridge for host communication
    this._setupHostBridge();
    
    // Load settings and recent folders (async)
    await this._loadConfig();
    
    // Setup event listeners
    this._setupEventListeners();
    this._setupKeyboardNavigation();
    
    // Render initial state
    this._renderFolderList();
    this._updateUI();
    
    // Hide loading overlay and show app
    this._showApp();
    
    console.log('[Entrance] Initialized');
  },

  /**
   * Loading overlay'i kaldır ve app'i göster
   */
  _showApp() {
    const overlay = document.getElementById('loading-overlay');
    const app = document.getElementById('app');
    
    if (overlay) {
      overlay.classList.add('hidden');
    }
    
    if (app) {
      app.classList.add('ready');
    }
    
    console.log('[Entrance] App ready');
  },

  /**
   * Setup postMessage bridge for Electron API access via host
   */
  _setupHostBridge() {
    // Listen for responses from host
    window.addEventListener('message', (event) => {
      // Validate origin - accept same origin or parent
      if (event.data && event.data.type === 'electron-api-response') {
        const { requestId, result, error } = event.data;
        const pending = this._pendingRequests.get(requestId);
        if (pending) {
          this._pendingRequests.delete(requestId);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(result);
          }
        }
      }
    });
    
    console.log('[Entrance] Host bridge initialized');
  },

  /**
   * Call Electron API via host postMessage bridge
   */
  _callHostAPI(method, ...args) {
    return new Promise((resolve, reject) => {
      const requestId = ++this._requestId;
      
      // Store pending request
      this._pendingRequests.set(requestId, { resolve, reject });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this._pendingRequests.has(requestId)) {
          this._pendingRequests.delete(requestId);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 10000);
      
      // Send to parent/host
      const message = {
        type: 'electron-api-request',
        requestId,
        method,
        args
      };
      
      // Try parent window first (if in iframe), then use postMessage to self for webview
      if (window.parent !== window) {
        window.parent.postMessage(message, '*');
      } else {
        // In webview - use ipcRenderer.sendToHost if available, otherwise postMessage
        if (window.electronAPI?.sendToHost) {
          window.electronAPI.sendToHost('electron-api-request', message);
        } else {
          // Fallback - try native postMessage (won't work in webview without preload)
          window.postMessage(message, '*');
        }
      }
    });
  },

  /**
   * Load config from Electron API (with localStorage fallback)
   */
  async _loadConfig() {
    try {
      // Try direct Electron API first
      if (window.electronAPI?.loadOpencodeConfig) {
        const config = await window.electronAPI.loadOpencodeConfig();
        console.log('[Entrance] Loaded config from Electron API:', config);
        this._applyConfig(config);
        return;
      }
      
      // Try host bridge (for webview context)
      try {
        const config = await this._callHostAPI('loadOpencodeConfig');
        console.log('[Entrance] Loaded config via host bridge:', config);
        this._applyConfig(config);
        return;
      } catch (bridgeError) {
        console.warn('[Entrance] Host bridge not available:', bridgeError.message);
      }
    } catch (e) {
      console.warn('[Entrance] Failed to load Electron config:', e);
    }
    
    // Fallback to localStorage
    this._loadRecentFolders();
  },

  /**
   * Apply loaded config to state
   */
  _applyConfig(config) {
    if (!config) return;
    
    this._configLoaded = true;
    
    // Load recent folders
    this._recentFolders = (config.recentFolders || []).map(f => ({
      name: f.name,
      path: f.path,
      lastUsed: f.lastAccessed || Date.now(),
    }));
    

  },





  /**
   * Load recent folders from localStorage
   */
  _loadRecentFolders() {
    try {
      const saved = localStorage.getItem('opencode-recent-folders');
      if (saved) {
        this._recentFolders = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[Entrance] Failed to load recent folders:', e);
    }
    // Note: No demo folders - empty state handled by _renderFolderList()
  },

  /**
   * Save recent folders to localStorage
   */
  _saveRecentFolders() {
    try {
      localStorage.setItem('opencode-recent-folders', JSON.stringify(this._recentFolders));
    } catch (e) {
      console.warn('[Entrance] Failed to save recent folders:', e);
    }
  },

  /**
   * Add folder to recent list
   */
  async addRecentFolder(path, name) {
    const folderName = name || path.split('/').pop() || path.split('\\').pop() || 'Workspace';
    
    // Try direct Electron API first
    if (this._configLoaded && window.electronAPI?.opcAddRecentFolder) {
      try {
        const config = await window.electronAPI.opcAddRecentFolder(path, folderName);
        console.log('[Entrance] Folder added via Electron API:', path);
        this._applyConfig(config);
        this._renderFolderList();
        return;
      } catch (e) {
        console.warn('[Entrance] Direct API add folder error:', e);
      }
    }
    
    // Try host bridge
    if (this._configLoaded) {
      try {
        const config = await this._callHostAPI('opcAddRecentFolder', path, folderName);
        console.log('[Entrance] Folder added via host bridge:', path);
        this._applyConfig(config);
        this._renderFolderList();
        return;
      } catch (bridgeError) {
        console.warn('[Entrance] Host bridge add folder error:', bridgeError.message);
      }
    }
    
    // Fallback to localStorage
    this._recentFolders = this._recentFolders.filter(f => f.path !== path);
    this._recentFolders.unshift({
      name: folderName,
      path,
      lastUsed: Date.now(),
    });
    this._recentFolders = this._recentFolders.slice(0, 10);
    this._saveRecentFolders();
    this._renderFolderList();
  },

  /**
   * Remove folder from recent list
   */
  async removeRecentFolder(path) {
    // Try Electron API first
    if (this._configLoaded && window.electronAPI?.opcRemoveRecentFolder) {
      try {
        const config = await window.electronAPI.opcRemoveRecentFolder(path);
        console.log('[Entrance] Folder removed via Electron API:', path);
        
        if (config && config.recentFolders) {
          this._recentFolders = config.recentFolders.map(f => ({
            name: f.name,
            path: f.path,
            lastUsed: f.lastAccessed || Date.now(),
          }));
        }
        this._renderFolderList();
        return;
      } catch (e) {
        console.warn('[Entrance] Failed to remove folder via Electron:', e);
      }
    }
    
    // Fallback to localStorage
    this._recentFolders = this._recentFolders.filter(f => f.path !== path);
    this._saveRecentFolders();
    this._renderFolderList();
  },

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Browse button
    const browseBtn = document.getElementById('btn-browse');
    if (browseBtn) {
      browseBtn.addEventListener('click', () => this._handleBrowse());
    }
    
    // Terminal button
    const terminalBtn = document.getElementById('btn-terminal');
    if (terminalBtn) {
      terminalBtn.addEventListener('click', () => this._handleOpenTerminal());
    }
    
    
    // Folder list click delegation
    const folderList = document.getElementById('folder-list');
    if (folderList) {
      folderList.addEventListener('click', (e) => {
        const folderItem = e.target.closest('.folder-item');
        if (!folderItem) return;
        
        const path = folderItem.dataset.path;
        
        // Check if action button clicked
        const actionBtn = e.target.closest('.folder-actions button');
        if (actionBtn) {
          if (actionBtn.title === 'Listeden Kaldır') {
            this.removeRecentFolder(path);
          } else if (actionBtn.title === 'Terminal\'de Aç') {
            this._openInTerminal(path);
          }
          return;
        }
        
        // Select folder
        this._selectFolder(path);
      });
    }
  },

  /**
   * Setup keyboard navigation
   */
  _setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+N - Browse
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this._handleBrowse();
        return;
      }
      
      // Arrow keys - Navigate folder list
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._navigateList(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._navigateList(1);
      }
      
      // Enter - Select folder
      if (e.key === 'Enter' && this._recentFolders.length > 0) {
        e.preventDefault();
        const folder = this._recentFolders[this._selectedIndex];
        if (folder) {
          this._selectFolder(folder.path);
        }
      }
      
      // Delete - Remove selected folder
      if (e.key === 'Delete' && this._recentFolders.length > 0) {
        e.preventDefault();
        const folder = this._recentFolders[this._selectedIndex];
        if (folder) {
          this.removeRecentFolder(folder.path);
        }
      }
    });
  },

  /**
   * Navigate folder list with arrow keys
   */
  _navigateList(direction) {
    if (this._recentFolders.length === 0) return;
    
    this._selectedIndex += direction;
    
    // Wrap around
    if (this._selectedIndex < 0) {
      this._selectedIndex = this._recentFolders.length - 1;
    } else if (this._selectedIndex >= this._recentFolders.length) {
      this._selectedIndex = 0;
    }
    
    this._updateSelection();
  },

  /**
   * Update visual selection
   */
  _updateSelection() {
    const items = document.querySelectorAll('.folder-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this._selectedIndex);
    });
  },

  /**
   * Render folder list
   */
  _renderFolderList() {
    const folderList = document.getElementById('folder-list');
    const folderCount = document.getElementById('folder-count');
    
    if (!folderList) return;
    
    // Update count
    if (folderCount) {
      const count = this._recentFolders.length;
      folderCount.textContent = `${count} folder${count !== 1 ? 's' : ''} available`;
    }
    
    // Render folders
    if (this._recentFolders.length === 0) {
      folderList.innerHTML = `
        <div class="folder-list-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>No recent folders</p>
          <p>Use "Browse Folders" to select a workspace</p>
        </div>
      `;
      return;
    }
    
    folderList.innerHTML = this._recentFolders.map((folder, index) => `
      <div class="folder-item${index === this._selectedIndex ? ' selected' : ''}" data-path="${this._escapeHtml(folder.path)}">
        <div class="folder-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="folder-info">
          <span class="folder-name">${this._escapeHtml(folder.name)}</span>
          <span class="folder-path">${this._escapeHtml(folder.path)}</span>
          <span class="folder-time">${this._formatTime(folder.lastUsed)}</span>
        </div>
        <div class="folder-actions">
          <button class="btn btn-icon btn-sm" title="Terminal'de Aç">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
          </button>
          <button class="btn btn-icon btn-sm" title="Listeden Kaldır">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  },

  /**
   * Update UI elements
   */
  _updateUI() {
    // Any additional UI updates
  },

  /**
   * Handle browse button click
   * Uses native Electron dialog, custom directory browser, or file input fallback
   */
  async _handleBrowse() {
    console.log('[Entrance] Browse clicked');
    
    // Try native Electron folder dialog first (best UX)
    if (window.electronAPI?.opcOpenFolderDialog) {
      try {
        const defaultPath = this._recentFolders[0]?.path || undefined;
        const selectedPath = await window.electronAPI.opcOpenFolderDialog({
          title: 'Workspace Klasörü Seçin',
          defaultPath,
          buttonLabel: 'Seç',
        });
        
        if (selectedPath) {
          console.log('[Entrance] Native dialog selected:', selectedPath);
          this._handleFolderSelected(selectedPath);
          return;
        }
        // User cancelled - do nothing
        return;
      } catch (e) {
        console.warn('[Entrance] Native folder dialog error:', e);
      }
    }
    
    // Try legacy showOpenDialog (backward compatibility)
    if (window.electronAPI?.showOpenDialog) {
      try {
        const result = await window.electronAPI.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Workspace Klasörü Seçin',
          buttonLabel: 'Seç'
        });
        console.log('[Entrance] Dialog result (legacy):', result);
        this._handleBrowseResult(result);
        return;
      } catch (e) {
        console.warn('[Entrance] Legacy dialog error:', e);
      }
    }
    
    // Try host bridge (for webview context)
    try {
      const result = await this._callHostAPI('showOpenDialog', {
        properties: ['openDirectory'],
        title: 'Workspace Klasörü Seçin',
        buttonLabel: 'Seç'
      });
      console.log('[Entrance] Dialog result (bridge):', result);
      this._handleBrowseResult(result);
      return;
    } catch (bridgeError) {
      console.warn('[Entrance] Host bridge dialog error:', bridgeError.message);
    }
    
    // Fallback: Custom directory browser dialog
    if (window.DirectoryBrowser) {
      console.log('[Entrance] Opening custom directory browser');
      window.DirectoryBrowser.open({
        title: 'Workspace Klasörü Seçin',
        description: 'AI ile kodlamaya başlamak için bir klasör seçin',
        defaultPath: this._recentFolders[0]?.path,
        onSelect: (path) => {
          console.log('[Entrance] Directory browser selected:', path);
          this._handleFolderSelected(path);
        },
      });
      return;
    }
    
    // Last resort: webkitdirectory input
    this._handleBrowseFallback();
  },
  
  /**
   * Handle folder selection (from any source)
   */
  _handleFolderSelected(selectedPath) {
    if (!selectedPath) return;
    
    const folderName = selectedPath.split('/').pop() || selectedPath.split('\\').pop() || 'Workspace';
    console.log('[Entrance] Folder selected:', selectedPath, folderName);
    
    // Add to recent folders
    this.addRecentFolder(selectedPath, folderName);
    
    // Auto-connect
    this._selectFolder(selectedPath);
  },

  /**
   * Handle browse result from dialog
   */
  _handleBrowseResult(result) {
    if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      const folderName = selectedPath.split('/').pop() || selectedPath.split('\\').pop() || 'Workspace';
      
      console.log('[Entrance] Selected folder:', selectedPath, folderName);
      
      // Add to recent folders and re-render
      this.addRecentFolder(selectedPath, folderName);
      this._renderFolderList();
      
      // Auto-connect
      this._selectFolder(selectedPath);
    }
  },

  /**
   * Fallback browse using webkitdirectory input
   */
  _handleBrowseFallback() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.style.display = 'none';
    
    input.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        // webkitRelativePath contains the folder name
        const relativePath = files[0].webkitRelativePath;
        const folderName = relativePath.split('/')[0];
        // Note: Browser security limits us to just the folder name, not full path
        // In production, this would need backend support
        const path = folderName;
        this.addRecentFolder(path, folderName);
        this._renderFolderList();
        this._selectFolder(path);
      }
      input.remove();
    });
    
    document.body.appendChild(input);
    input.click();
  },

  /**
   * Handle terminal button click
   */
  async _handleOpenTerminal() {
    console.log('[Entrance] Terminal clicked');
    
    // Get current selected folder or use default
    const selectedFolder = this._recentFolders[this._selectedIndex];
    const path = selectedFolder?.path || process.cwd?.() || '.';
    
    if (window.electronAPI?.openTerminal) {
      try {
        await window.electronAPI.openTerminal(path);
      } catch (e) {
        console.error('[Entrance] Terminal error:', e);
        alert('Terminal açılamadı: ' + e.message);
      }
    } else if (window.electronAPI?.shellOpenPath) {
      // Alternative: Open folder in file manager
      try {
        await window.electronAPI.shellOpenPath(path);
      } catch (e) {
        console.error('[Entrance] Shell open error:', e);
      }
    } else {
      alert(`Terminal: ${path}\n\nBu özellik Electron ortamında çalışır.`);
    }
  },

  /**
   * Select folder and navigate to chat
   */
  _selectFolder(path) {
    console.log('[Entrance] Selecting folder:', path);
    
    // Show loading overlay immediately
    const overlay = document.getElementById('loading-overlay');
    const app = document.getElementById('app');
    if (overlay) {
      overlay.classList.remove('hidden');
      const loadingText = overlay.querySelector('.loading-text');
      if (loadingText) {
        loadingText.textContent = 'Workspace yükleniyor...';
      }
    }
    if (app) {
      app.style.opacity = '0.5';
      app.style.pointerEvents = 'none';
    }
    
    // Update last used time
    const folder = this._recentFolders.find(f => f.path === path);
    if (folder) {
      folder.lastUsed = Date.now();
      this._saveRecentFolders();
    }
    
    // Store selected folder
    sessionStorage.setItem('opencode-workspace', path);
    
    // Small delay to ensure overlay is visible before navigation
    requestAnimationFrame(() => {
      window.location.href = 'index.html?workspace=' + encodeURIComponent(path);
    });
  },

  /**
   * Open folder in terminal
   */
  _openInTerminal(path) {
    console.log('[Entrance] Opening in terminal:', path);
    
    if (window.electronAPI?.openTerminal) {
      window.electronAPI.openTerminal(path);
    } else {
      alert(`Would open terminal at: ${path}`);
    }
  },

  /**
   * Format time ago
   */
  _formatTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  },

  /**
   * Escape HTML
   */
  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  EntranceApp.init();
});

// Export for external use
window.EntranceApp = EntranceApp;
