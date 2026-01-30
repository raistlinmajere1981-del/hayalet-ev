/**
 * OpenCodeApp Manager - Main singleton application
 */

import { setupInitialization } from './initialization';
import { setupEventListeners } from './event-listeners';
import { setupSSEConnection } from './sse-connection';
import { setupEventHandlers } from './event-handlers';
import { setupMessageActions } from './message-actions';
import { setupInstanceManagement } from './instance-management';
import { setupUIComponents } from './ui-components';
import { setupSessionList } from './session-list';
import { setupSessionModals } from './session-modals';
import { setupTokenDisplay } from './token-display';
import { setupStatusPanel } from './status-panel';
import { UIHelpers } from './ui-helpers';

class OpenCodeApp {
  private _initialized = false;
  private _serverUrl = '';
  private _workspace: string | null = null;
  private _status = 'disconnected';
  private _statusText = 'Bağlantı yok';
  private _isProcessing = false;
  private _eventAbortController: AbortController | null = null;

  // Modal state
  private _pendingRenameSessionId: string | null = null;
  private _pendingDeleteSessionId: string | null = null;
  private _pendingPermissionId: string | null = null;
  private _pendingPermission: unknown = null;
  private _pendingQuestionId: string | null = null;
  private _pendingQuestion: unknown = null;

  // Message retry cache
  private _messageRetryCache: { sessionId: string; content: string } | null = null;

  private _tokenUpdateTimeout: NodeJS.Timeout | null = null;
  private _statusPanelInterval: NodeJS.Timeout | null = null;

  // Modular components
  private initialization = setupInitialization(this as unknown as AppContext);
  private eventListeners = setupEventListeners(this as unknown as AppContext);
  private sseConnection = setupSSEConnection(this as unknown as AppContext);
  private eventHandlers = setupEventHandlers(this as unknown as AppContext);
  private messageActions = setupMessageActions(this as unknown as AppContext);
  private instanceManagement = setupInstanceManagement(this as unknown as AppContext);
  private uiComponents = setupUIComponents(this as unknown as AppContext);
  private sessionList = setupSessionList(this as unknown as AppContext);
  private sessionModals = setupSessionModals(this as unknown as AppContext);
  private tokenDisplay = setupTokenDisplay(this as unknown as AppContext);
  private statusPanel = setupStatusPanel(this as unknown as AppContext);

  // Helper methods
  private _showToast = UIHelpers.showToast;
  private _formatSessionTime = UIHelpers.formatSessionTime;
  private _escapeHtml = UIHelpers.escapeHtml;
  private _formatNumber = UIHelpers.formatNumber;
  private _formatTokenCount = UIHelpers.formatTokenCount;
  private _handleAttachFile = UIHelpers.handleAttachFile;
  private _togglePromptExpand = UIHelpers.togglePromptExpand;
  private _closeAllDropdowns = UIHelpers.closeAllDropdowns;
  private _toggleCommandPalette = UIHelpers.toggleCommandPalette;

  // Expose methods
  _parseUrlParams = this.initialization.parseUrlParams;
  _checkWorkspace = this.initialization.checkWorkspace;
  _loadActiveProjects = this.initialization.loadActiveProjects;
  _initComponents = this.initialization.initComponents;
  _showApp = this.initialization.showApp;
  _subscribeToSessionStore = this.initialization.subscribeToSessionStore;
  _initSessionBadgeTracking = this.initialization.initSessionBadgeTracking;

  _setupEventListeners = this.eventListeners.init;
  _setupModalListeners = this.eventListeners.setupModalListeners;
  _destroy = this.eventListeners.destroy;

  _connectSSE = this.sseConnection.connect;
  _connectToOpenCode = this.sseConnection.connectToOpenCode;

  _handleConnectionChange = this.eventHandlers.handleConnectionChange;
  _handleSessionStarted = this.eventHandlers.handleSessionStarted;
  _handleSessionStopped = this.eventHandlers.handleSessionStopped;
  _handleStatusChange = this.eventHandlers.handleStatusChange;
  _handleError = this.eventHandlers.handleError;
  _handlePermissionRequest = this.eventHandlers.handlePermissionRequest;
  _handlePermissionResponse = this.eventHandlers.handlePermissionResponse;
  _handleQuestion = this.eventHandlers.handleQuestion;
  _selectOption = this.eventHandlers.selectOption;
  _handleQuestionResponse = this.eventHandlers.handleQuestionResponse;

  _handleSendMessage = this.messageActions.handleSendMessage;
  _retryMessage = this.messageActions.retryMessage;
  _handleNewSession = this.messageActions.handleNewSession;

  _createInstance = this.instanceManagement.createInstance;
  _closeInstance = this.instanceManagement.closeInstance;
  switchInstance = this.instanceManagement.switchInstance;
  _onInstanceSelect = this.instanceManagement.onInstanceSelect;
  _onInstanceClose = this.instanceManagement.onInstanceClose;
  _onInstanceNew = this.instanceManagement.onInstanceNew;
  _onInstanceActivated = this.instanceManagement.onInstanceActivated;
  _updateInstanceUI = this.instanceManagement.updateInstanceUI;
  _initInstanceTabs = this.instanceManagement.initInstanceTabs;
  _ensureInstanceExists = this.instanceManagement.ensureInstanceExists;

  _initSidebars = this.uiComponents.initSidebars;
  _switchRightPanel = this.uiComponents.switchRightPanel;
  _executeQuickAction = this.uiComponents.executeQuickAction;
  _clearTrash = this.uiComponents.clearTrash;
  _initCommandPalette = this.uiComponents.initCommandPalette;
  _initCollapsibleSections = this.uiComponents.initCollapsibleSections;
  _updateConnectionStatus = this.uiComponents.updateConnectionStatus;
  _updateAgentSelectorButton = this.uiComponents.updateAgentSelectorButton;
  _updateModelSelectorButton = this.uiComponents.updateModelSelectorButton;
  _openAgentDropdown = this.uiComponents.openAgentDropdown;
  _openModelDropdown = this.uiComponents.openModelDropdown;

  _updateSessionList = this.sessionList.updateSessionList;
  _renderSessionList = this.sessionList.renderSessionList;
  _switchSession = this.sessionList.switchSession;
  _renameSession = this.sessionList.renameSession;
  _forkSession = this.sessionList.forkSession;
  _compactSession = this.sessionList.compactSession;
  _deleteSession = this.sessionList.deleteSession;
  _updateSessionBadge = this.sessionList.updateSessionBadge;

  showRenameModal = this.sessionModals.showRenameModal;
  hideRenameModal = this.sessionModals.hideRenameModal;
  confirmRename = this.sessionModals.confirmRename;
  showDeleteModal = this.sessionModals.showDeleteModal;
  hideDeleteModal = this.sessionModals.hideDeleteModal;
  confirmDelete = this.sessionModals.confirmDelete;
  showShellOutputModal = this.sessionModals.showShellOutputModal;
  hideShellOutputModal = this.sessionModals.hideShellOutputModal;

  _subscribeToSessionTokens = this.tokenDisplay.subscribeToSessionStore;
  _updateTokenDisplay = this.tokenDisplay.updateTokenDisplay;
  _updateTokenStats = this.tokenDisplay.updateTokenStats;

  _updateStatusPanel = this.statusPanel.updateStatusPanel;
  _updateMCPServers = this.statusPanel.updateMCPServers;
  _updateBackgroundShells = this.statusPanel.updateBackgroundShells;
  _updatePlugins = this.statusPanel.updatePlugins;
  _updateStatus = this.statusPanel.updateStatus;
  _getServerUrl = this.statusPanel.getServerUrl;

  async init() {
    if (this._initialized) {
      console.warn('[OpenCode] Already initialized');
      return;
    }

    console.log('[OpenCode] Initializing OpenCodeApp...');

    this._parseUrlParams();
    this._checkWorkspace();
    await this._loadActiveProjects();
    this._ensureInstanceExists();

    this._setupEventListeners();
    this._setupModalListeners();

    this._initComponents();
    this._initInstanceTabs();

    await this._connectSSE();

    this._subscribeToSessionStore();
    this._subscribeToSessionTokens();
    this._initSessionBadgeTracking();

    this._showApp();
    this._initialized = true;

    console.log('[OpenCode] Initialization complete');
  }

  destroy() {
    console.log('[OpenCode] Destroying app...');

    this._destroy();

    if (this._tokenUpdateTimeout) {
      clearTimeout(this._tokenUpdateTimeout);
    }

    if (this._statusPanelInterval) {
      clearInterval(this._statusPanelInterval);
    }

    this._initialized = false;
  }
}

export default new OpenCodeApp();
