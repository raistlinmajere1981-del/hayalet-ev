/**
 * OpenCode UI - Entrance Page
 * 
 * Workspace seçim sayfası JavaScript
 */

const EntranceApp = {
  // State
  _recentFolders: [],
  _selectedIndex: 0,
  _settings: {
    opencodePath: '',
    defaultPort: 4096,
    autoConnect: true,
  },

  /**
   * Initialize the entrance app
   */
  init() {
    console.log('[Entrance] Initializing...');
    
    // Load settings and recent folders
    this._loadSettings();
    this._loadRecentFolders();
    
    // Setup event listeners
    this._setupEventListeners();
    this._setupKeyboardNavigation();
    
    // Render initial state
    this._renderFolderList();
    this._updateUI();
    
    console.log('[Entrance] Initialized');
  },

  /**
   * Load settings from localStorage or defaults
   */
  _loadSettings() {
    try {
      const saved = localStorage.getItem('opencode-entrance-settings');
      if (saved) {
        this._settings = { ...this._settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[Entrance] Failed to load settings:', e);
    }
    
    // Update UI with settings
    const pathInput = document.getElementById('opencode-path');
    const portInput = document.getElementById('default-port');
    const autoConnectInput = document.getElementById('auto-connect');
    
    if (pathInput) pathInput.value = this._settings.opencodePath || this._detectOpencodePath();
    if (portInput) portInput.value = this._settings.defaultPort;
    if (autoConnectInput) autoConnectInput.checked = this._settings.autoConnect;
  },

  /**
   * Detect opencode binary path
   */
  _detectOpencodePath() {
    // This would ideally come from the main process
    return '/usr/bin/opencode';
  },

  /**
   * Save settings to localStorage
   */
  _saveSettings() {
    try {
      localStorage.setItem('opencode-entrance-settings', JSON.stringify(this._settings));
    } catch (e) {
      console.warn('[Entrance] Failed to save settings:', e);
    }
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
    
    // Add demo folder if empty
    if (this._recentFolders.length === 0) {
      this._recentFolders = [
        {
          name: 'hayalet-ev',
          path: '/home/raistlin/hayalet-ev',
          lastUsed: Date.now() - 120000, // 2 minutes ago
        }
      ];
    }
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
  addRecentFolder(path, name) {
    // Remove if exists
    this._recentFolders = this._recentFolders.filter(f => f.path !== path);
    
    // Add to top
    this._recentFolders.unshift({
      name: name || path.split('/').pop(),
      path,
      lastUsed: Date.now(),
    });
    
    // Keep only last 10
    this._recentFolders = this._recentFolders.slice(0, 10);
    
    this._saveRecentFolders();
    this._renderFolderList();
  },

  /**
   * Remove folder from recent list
   */
  removeRecentFolder(path) {
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
    
    // Advanced settings toggle
    const advancedToggle = document.getElementById('advanced-toggle');
    const advancedSection = advancedToggle?.closest('.entrance-section');
    if (advancedToggle && advancedSection) {
      advancedToggle.addEventListener('click', () => {
        advancedSection.classList.toggle('collapsed');
      });
      // Start collapsed
      advancedSection.classList.add('collapsed');
    }
    
    // Settings inputs
    const portInput = document.getElementById('default-port');
    if (portInput) {
      portInput.addEventListener('change', (e) => {
        this._settings.defaultPort = parseInt(e.target.value) || 4096;
        this._saveSettings();
      });
    }
    
    const autoConnectInput = document.getElementById('auto-connect');
    if (autoConnectInput) {
      autoConnectInput.addEventListener('change', (e) => {
        this._settings.autoConnect = e.target.checked;
        this._saveSettings();
      });
    }
    
    // Change path button
    const changePathBtn = document.getElementById('btn-change-path');
    if (changePathBtn) {
      changePathBtn.addEventListener('click', () => this._handleChangePath());
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
   */
  async _handleBrowse() {
    console.log('[Entrance] Browse clicked');
    
    // In Electron context, this would open a folder dialog
    // For now, show an alert
    if (window.electronAPI?.selectFolder) {
      try {
        const result = await window.electronAPI.selectFolder();
        if (result && result.path) {
          this.addRecentFolder(result.path, result.name);
          if (this._settings.autoConnect) {
            this._selectFolder(result.path);
          }
        }
      } catch (e) {
        console.error('[Entrance] Browse error:', e);
      }
    } else {
      // Demo mode - prompt for path
      const path = prompt('Enter folder path:');
      if (path) {
        this.addRecentFolder(path);
        if (this._settings.autoConnect) {
          this._selectFolder(path);
        }
      }
    }
  },

  /**
   * Handle change path button click
   */
  async _handleChangePath() {
    if (window.electronAPI?.selectFile) {
      try {
        const result = await window.electronAPI.selectFile({
          filters: [{ name: 'Executables', extensions: ['*'] }]
        });
        if (result && result.path) {
          this._settings.opencodePath = result.path;
          this._saveSettings();
          document.getElementById('opencode-path').value = result.path;
        }
      } catch (e) {
        console.error('[Entrance] Change path error:', e);
      }
    } else {
      const path = prompt('Enter OpenCode binary path:', this._settings.opencodePath);
      if (path) {
        this._settings.opencodePath = path;
        this._saveSettings();
        document.getElementById('opencode-path').value = path;
      }
    }
  },

  /**
   * Select folder and navigate to chat
   */
  _selectFolder(path) {
    console.log('[Entrance] Selecting folder:', path);
    
    // Update last used time
    const folder = this._recentFolders.find(f => f.path === path);
    if (folder) {
      folder.lastUsed = Date.now();
      this._saveRecentFolders();
    }
    
    // Store selected folder
    sessionStorage.setItem('opencode-workspace', path);
    
    // Navigate to chat page
    window.location.href = 'index.html?workspace=' + encodeURIComponent(path);
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
