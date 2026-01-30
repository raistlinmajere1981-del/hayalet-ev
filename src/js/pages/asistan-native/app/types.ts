/**
 * Types - OpenCodeApp interfaces and event data
 */

export interface SSEEventData {
  sessionId?: string;
  status?: string;
  data?: Record<string, unknown>;
  attempt?: number;
  maxAttempts?: number;
  [key: string]: unknown;
}

export interface PermissionRequestData {
  id?: string;
  partId?: string;
  messageId?: string;
  permission?: { id: string; type?: string; path?: string; command?: string };
  permissionId?: string;
  toolName?: string;
  description?: string;
  risk?: string;
}

export interface QuestionData {
  id?: string;
  questionId?: string;
  question?: string;
  options?: Array<{ label: string; value: string }>;
  allowFreeform?: boolean;
}

export interface SessionRecord {
  id: string;
  title?: string;
  status?: string;
  messageIds?: string[];
  updatedAt?: number;
}

export interface InstanceInfo {
  id: string;
  folder: string;
  name: string;
  status?: string;
  url?: string;
}

export interface ModelInfo {
  model?: {
    id: string;
    name?: string;
    providerId: string;
  };
  provider?: string;
}

/**
 * AppContext - Type for the OpenCodeApp singleton instance
 * Includes all public methods and properties accessible from modular components
 */
export interface AppContext {
  // State properties
  _initialized: boolean;
  _serverUrl: string;
  _workspace: string | null;
  _status: string;
  _statusText: string;
  _isProcessing: boolean;
  _eventAbortController: AbortController | null;

  // Modal state
  _pendingRenameSessionId: string | null;
  _pendingDeleteSessionId: string | null;
  _pendingPermissionId: string | null;
  _pendingPermission: unknown;
  _pendingQuestionId: string | null;
  _pendingQuestion: unknown;

  // Message retry cache
  _messageRetryCache: { sessionId: string; content: string } | null;

  // Timeouts
  _tokenUpdateTimeout: NodeJS.Timeout | null;
  _statusPanelInterval: NodeJS.Timeout | null;

  // Helper methods
  _showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  _formatSessionTime: (timestamp: number) => string;
  _escapeHtml: (text: string) => string;
  _formatNumber: (num: number) => string;
  _formatTokenCount: (count: number) => string;
  _handleAttachFile: () => void;
  _togglePromptExpand: () => void;
  _closeAllDropdowns: () => void;
  _toggleCommandPalette: () => void;

  // Initialization methods
  _parseUrlParams: () => void;
  _checkWorkspace: () => void;
  _loadActiveProjects: () => Promise<void>;
  _initComponents: () => void;
  _showApp: () => void;
  _subscribeToSessionStore: () => void;
  _initSessionBadgeTracking: () => void;

  // Event listeners
  _setupEventListeners: () => void;
  _setupModalListeners: () => void;
  _destroy: () => void;

  // SSE Connection
  _connectSSE: () => Promise<void>;
  _connectToOpenCode: () => Promise<void>;

  // Event handlers
  _handleConnectionChange: (data: SSEEventData) => void;
  _handleSessionStarted: (data: SSEEventData) => void;
  _handleSessionStopped: (data: SSEEventData) => void;
  _handleStatusChange: (data: SSEEventData) => void;
  _handleError: (data: SSEEventData) => void;
  _handlePermissionRequest: (data: PermissionRequestData) => void;
  _handlePermissionResponse: (partId: string, approved: boolean) => Promise<void>;
  _handleQuestion: (data: QuestionData) => void;
  _selectOption: (value: string) => void;
  _handleQuestionResponse: (questionId: string, answer: string) => Promise<void>;

  // Message actions
  _handleSendMessage: () => Promise<void>;
  _retryMessage: () => Promise<void>;
  _handleNewSession: () => void;

  // Instance management
  _createInstance: (data: { folder: string; name?: string }) => Promise<void>;
  _closeInstance: (instanceId: string) => Promise<void>;
  switchInstance: (instanceId: string) => Promise<void>;
  _onInstanceSelect: (instanceId: string) => void;
  _onInstanceClose: (instanceId: string) => void;
  _onInstanceNew: () => void;
  _onInstanceActivated: (data: { id: string }) => void;
  _updateInstanceUI: () => void;
  _initInstanceTabs: () => void;
  _ensureInstanceExists: () => void;

  // UI Components
  _initSidebars: () => void;
  _switchRightPanel: (panelName: string) => void;
  _executeQuickAction: (action: string) => void;
  _clearTrash: () => Promise<void>;
  _initCommandPalette: () => void;
  _initCollapsibleSections: () => void;
  _updateConnectionStatus: (status: string, text: string) => void;
  _updateAgentSelectorButton: () => void;
  _updateModelSelectorButton: () => void;
  _openAgentDropdown: () => void;
  _openModelDropdown: () => void;

  // Session list
  _updateSessionList: () => Promise<void>;
  _renderSessionList: (sessions: SessionRecord[]) => void;
  _switchSession: (sessionId: string) => Promise<void>;
  _renameSession: (sessionId: string) => Promise<void>;
  _forkSession: (sessionId: string) => Promise<void>;
  _compactSession: (sessionId: string) => Promise<void>;
  _deleteSession: (sessionId: string) => Promise<void>;
  _updateSessionBadge: (sessionId: string, count: number) => void;

  // Session modals
  showRenameModal: (sessionId: string, currentTitle: string) => void;
  hideRenameModal: () => void;
  confirmRename: () => Promise<void>;
  showDeleteModal: (sessionId: string) => void;
  hideDeleteModal: () => void;
  confirmDelete: () => Promise<void>;
  showShellOutputModal: (output: string) => void;
  hideShellOutputModal: () => void;

  // Token display
  _subscribeToSessionTokens: () => void;
  _updateTokenDisplay: () => void;
  _updateTokenStats: () => void;

  // Status panel
  _updateStatusPanel: () => void;
  _updateMCPServers: () => Promise<void>;
  _updateBackgroundShells: () => Promise<void>;
  _updatePlugins: () => Promise<void>;
  _updateStatus: (status: string, text: string) => void;
  _getServerUrl: () => string;

  // Main methods
  init: () => Promise<void>;
  destroy: () => void;
}
