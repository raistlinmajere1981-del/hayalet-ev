/**
 * Global Type Declarations
 * Window.electronAPI ve diğer global type tanımları
 */

import type { ProviderConfig } from "./types/provider.js";
import type {
  MessageRecord,
  MessagePart,
  MessageUpsertInput,
  PartUpdateInput,
  StoreEvent,
  PermissionEntry,
  QuestionEntry,
  OptimisticMessageResult,
} from "./modules/asistan/stores/message/types.js";
import type {
  ToolRendererConfig,
  ToolCallData,
  HookType,
  HookCallback,
  RegistryListener,
  RegistryEvent,
} from "./modules/asistan/tool-renderers/registry/types.js";

export {};

type AttachmentType = "file" | "image" | "text" | "agent";

type AttachmentRecord = {
  id: string;
  type: AttachmentType;
  name: string;
  path?: string | null;
  content?: string | null;
  dataUrl?: string | null;
  mimeType?: string;
  size?: number;
  createdAt: number;
};

type AttachmentInput = {
  type: AttachmentType;
  name?: string;
  path?: string;
  content?: string;
  dataUrl?: string;
  mimeType?: string;
  size?: number;
};

type SessionRecord = {
  id: string;
  title?: string;
  messageIds?: string[];
  status?: string;
  createdAt?: number;
  updatedAt?: number;
  instanceId?: string;
  [key: string]: unknown;
};

type SessionInfo = {
  agent?: string;
  providerId?: string;
  modelId?: string;
  [key: string]: unknown;
};

type SessionUsage = {
  tokens: number;
  cost: number;
};

type InstanceRecord = {
  id: string;
  folder: string;
  name?: string;
  status: "connecting" | "connected" | "disconnected" | "error" | string;
  url?: string;
  createdAt: number;
  updatedAt: number;
  currentSessionId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type InstanceStoreEvent = {
  type: string;
  instanceId?: string | null;
  [key: string]: unknown;
};

type SessionStoreEvent = {
  type: string;
  sessionId?: string | null;
  instanceId?: string | null;
  [key: string]: unknown;
};

type AttachmentStoreEvent = {
  type: string;
  sessionId?: string;
  instanceId?: string;
  attachment?: AttachmentRecord;
  attachmentId?: string;
};

type ToolRegistry = {
  register: (toolName: string, config: ToolRendererConfig) => unknown;
  registerRenderer: (toolName: string, config: ToolRendererConfig) => unknown;
  unregister: (toolName: string) => unknown;
  unregisterRenderer: (toolName: string) => unknown;
  addHook: (toolName: string, hookType: HookType, callback: HookCallback) => unknown;
  removeHook: (toolName: string, hookType: HookType, callback: HookCallback) => unknown;
  subscribe: (listener: RegistryListener) => (() => void) | void;
  getRegisteredTools: () => string[];
  setDefault: (config: ToolRendererConfig) => void;
  renderToolCard: (toolCall: ToolCallData) => string;
  updateStatus: (toolCall: ToolCallData, newStatus: string) => void;
  renderInput: (toolCall: ToolCallData) => string;
  renderOutput: (toolCall: ToolCallData) => string;
  shouldAutoCollapse: (toolCall: ToolCallData) => boolean;
  get: (toolName: string) => ToolRendererConfig | undefined;
  has: (toolName: string) => boolean;
  _copyToClipboard: (btn: HTMLElement) => void;
  _executeHooks: (toolName: string, hookType: HookType, data: unknown) => void;
};

declare global {
  interface Window {
    /**
     * Electron preload tarafından expose edilen API
     * @see electron/preload.cjs
     */
    electronAPI?: ElectronAPI;

    // Global Helper Functions (app.js'de tanımlı)
    updateChatListOnNewEntry?: (
      provider: string,
      selectedId: string,
      options?: { scroll?: boolean }
    ) => Promise<void>;
    refreshAnalyzeMessages?: (provider: string) => Promise<void>;

    // Custom Properties
    __hayalet_settings_unsub?: () => void;
    __hayalet_provider_config?: ProviderConfig;

    // =========================================================================
    // OpenCode/Asistan Global Exports
    // =========================================================================

    // OpenCode Config
    OpenCodeConfig?: {
      serverUrl: string;
      getServerUrl: () => string;
      setServerUrl: (url: string) => void;
      get: (key: string, defaultValue?: unknown) => unknown;
      isEnabled: (feature: string) => boolean;
      getStatusText: (status: string) => string;
      getAnsiColor: (code: number) => string | null;
      maxHistoryItems: number;
      commands: Array<{ name: string; description: string }>;
      [key: string]: unknown;
    };

    // API Client
      listFileSystem?: (path: string, options?: Record<string, unknown>) => Promise<unknown>;

    APIClient?: {
      listAgents?: () => Promise<unknown>;
      listProviders?: () => Promise<unknown>;
      listFileSystem?: (path: string, options?: Record<string, unknown>) => Promise<unknown>;
      updateSessionAgent?: (sessionId: string, agentName: string) => Promise<unknown>;
      updateSessionModel?: (sessionId: string, providerId: string, modelId: string) => Promise<unknown>;
      retry?: (sessionId?: string) => Promise<unknown>;
      connect?: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
      sendMessage?: (sessionId: string, message: string) => Promise<{ success?: boolean; error?: string }>;
      createSession?: (title: string) => Promise<{ sessionId?: string }>;
      cancel?: () => Promise<unknown>;
      respondToPermission?: (permissionId: string, approved: boolean) => Promise<unknown>;
      respondToQuestion?: (questionId: string, answer: string) => Promise<unknown>;
      compact?: () => Promise<unknown>;
      getSessions?: () => Promise<{ sessions: unknown[] }>;
      getSessionMessages?: (sessionId: string) => Promise<{ messages: unknown[] }>;
      renameSession?: (sessionId: string, title: string) => Promise<unknown>;
      deleteSession?: (sessionId: string) => Promise<unknown>;
      revertConversation?: (messageId: string) => Promise<{ success: boolean; error?: string }>;
      forkConversation?: (messageId: string) => Promise<unknown>;
      searchFiles?: (query: string, limit: number) => Promise<{ files: unknown[] }>;
      listSessions?: () => Promise<unknown[]>;
      getMCPServers?: () => Promise<{ servers: unknown[] }>;
      getPlugins?: () => Promise<{ plugins: unknown[] }>;
      getBackgroundShells?: () => Promise<{ shells: unknown[] }>;
      status?: () => Promise<unknown>;
      setServerUrl?: (url: string) => void;
      cancelAllRequests?: () => void;
      [key: string]: unknown;
    };

    // SSE Client
    SSEClient?: {
      connect?: () => Promise<unknown>;
      disconnect?: () => void;
      on?: (event: string, handler: (data: unknown) => void) => void;
      [key: string]: unknown;
    };

    // Message Store
    MessageStore?: {
      createMessage?: (data: MessageUpsertInput) => MessageRecord;
      updateMessage?: (id: string, data: Partial<MessageRecord>) => void;
      getMessage?: (id: string) => MessageRecord | undefined;
      getSessionMessages?: (sessionId: string) => MessageRecord[];
      hasMessage?: (id: string) => boolean;
      upsertMessage?: (data: MessageUpsertInput) => MessageRecord;
      updateMessageStatus?: (id: string, status: string) => void;
      updateTextPart?: (messageId: string, content: string, append: boolean) => void;
      addOrUpdatePart?: (data: PartUpdateInput) => MessagePart;
      getMessageContent?: (id: string) => string;
      getMessageParts?: (id: string) => MessagePart[];
      removeMessage?: (id: string) => void;
      clearSession?: (sessionId: string) => void;
      markMessageSent?: (id: string) => void;
      markMessageFailed?: (id: string, error: unknown) => void;
      retryMessage?: (id: string) => boolean;
      replaceMessageId?: (data: { oldId: string; newId: string }) => void;
      createOptimisticMessage?: (data: unknown) => OptimisticMessageResult;
      upsertPermission?: (data: PermissionEntry) => PermissionEntry | null;
      removePermission?: (id: string) => void;
      getPermissionQueue?: () => PermissionEntry[];
      upsertQuestion?: (data: QuestionEntry) => QuestionEntry | null;
      removeQuestion?: (id: string) => void;
      getQuestionQueue?: () => QuestionEntry[];
      subscribe?: (callback: (event: StoreEvent) => void) => (() => void);
      createId?: (prefix: string) => string;
      [key: string]: unknown;
    };

    // Session Store
    SessionStore?: {
      getCurrentSessionId?: () => string | null;
      getActiveSession?: () => SessionRecord | null;
      addSession?: (session: SessionRecord) => void;
      setActiveSession?: (sessionId: string) => void;
      createSession?: () => SessionRecord;
      getSessionInfo?: (sessionId: string) => SessionInfo | undefined;
      getSessionUsage?: (sessionId: string) => SessionUsage | undefined;
      getTotalUsage?: () => SessionUsage;
      renameSession?: (sessionId: string, title: string) => Promise<boolean>;
      deleteSession?: (sessionId: string) => Promise<void>;
      setCurrentSession?: (sessionId: string) => void;
      upsertSession?: (sessionId: string, data: Partial<SessionRecord>) => SessionRecord;
      getAllSessions?: () => SessionRecord[];
      getSession?: (sessionId: string) => SessionRecord | undefined;
      getCurrentSession?: () => SessionRecord | null;
      removeSession?: (sessionId: string) => void;
      updateStatus?: (status: string) => void;
      updateSessionUsage?: (sessionId: string, usage: SessionUsage) => void;
      updateSessionInfo?: (sessionId: string, info: SessionInfo) => void;
      syncFromActiveInstance?: () => void;
      clearInstance?: (instanceId: string) => void;
      clear?: () => void;
      subscribe?: (callback: (event: SessionStoreEvent) => void) => (() => void);
      [key: string]: unknown;
    };

    // Instance Store
    InstanceStore?: {
      getActiveInstanceId?: () => string | null;
      getActiveInstance?: () => InstanceRecord | null;
      setActiveInstance?: (id: string | null) => void;
      createInstance?: (data: { folder: string; name?: string; url?: string }) => InstanceRecord;
      removeInstance?: (id: string) => void;
      getInstance?: (id: string) => InstanceRecord | undefined;
      getInstancesArray?: () => InstanceRecord[];
      getInstanceCount?: () => number;
      setInstanceStatus?: (id: string, status: string, reason?: string | null) => void;
      findByFolder?: (folder: string) => InstanceRecord | null;
      getActiveInstancePath?: () => string | null;
      getActiveInstanceSessionId?: () => string | null;
      getActiveInstanceUrl?: () => string | null;
      getActiveInstanceName?: () => string | null;
      getActiveInstanceStatus?: () => string;
      isActiveInstanceConnected?: () => boolean;
      getActiveInstanceProperty?: (property: string, defaultValue?: unknown) => unknown;
      hasInstances?: () => boolean;
      getDisconnectionReason?: (instanceId: string) => string | null;
      nextInstance?: () => string | null;
      prevInstance?: () => string | null;
      switchToIndex?: (index: number) => string | null;
      subscribe?: (callback: (event: InstanceStoreEvent) => void) => (() => void);
      [key: string]: unknown;
    };

    // Attachment Store
    AttachmentStore?: {
      getAttachments?: (sessionId: string, instanceId?: string) => AttachmentRecord[];
      addAttachment?: (sessionId: string, attachment: AttachmentInput, instanceId?: string) => AttachmentRecord | null;
      addFileAttachment?: (sessionId: string, file: File, instanceId?: string) => Promise<AttachmentRecord | null>;
      addImageAttachment?: (sessionId: string, imageData: File | Blob, instanceId?: string) => Promise<AttachmentRecord | null>;
      addTextAttachment?: (sessionId: string, content: string, name?: string, instanceId?: string) => AttachmentRecord | null;
      removeAttachment?: (sessionId: string, attachmentId: string, instanceId?: string) => boolean;
      clearAttachments?: (sessionId: string, instanceId?: string) => void;
      getAttachmentsForAPI?: (sessionId: string, instanceId?: string) => Array<Record<string, unknown>>;
      handlePaste?: (event: ClipboardEvent, sessionId: string, instanceId?: string) => Promise<AttachmentRecord[]>;
      handleDrop?: (event: DragEvent, sessionId: string, instanceId?: string) => Promise<AttachmentRecord[]>;
      subscribe?: (callback: (event: AttachmentStoreEvent) => void) => (() => void);
      [key: string]: unknown;
    };

    // Store Bridge
    StoreBridge?: {
      handleEvent?: (eventType: string, data: unknown, instanceId?: string | null) => void;
      setLastUserMessage?: (message: string, instanceId?: string) => void;
      addOptimisticUserMessage?: (sessionId: string, content: string, messageId?: string) => string;
      markUserMessageSent?: (messageId: string) => void;
      markUserMessageFailed?: (messageId: string, errorInfo?: unknown) => void;
      retryMessage?: (messageId: string) => boolean;
      replaceMessageId?: (tempId: string, realId: string) => void;
      getPendingMessageContent?: (messageId: string) => string | null;
      hasPendingMessages?: () => boolean;
      getCurrentMessageId?: () => string | null;
      clear?: () => void;
      setDebug?: (enabled: boolean) => void;
      [key: string]: unknown;
    };

    // Part Normalizer
    PartNormalizer?: {
      normalize?: (part: unknown) => unknown;
      normalizeAll?: (parts: unknown[]) => unknown[];
      decodeHtml?: (text: string) => string;
      needsNormalization?: (part: unknown) => boolean;
      [key: string]: unknown;
    };

    // UI Components
    PermissionModal?: {
      show?: (data: unknown) => void;
      hide?: () => void;
      [key: string]: unknown;
    };

    QuestionModal?: {
      show?: (data: unknown) => void;
      hide?: () => void;
      [key: string]: unknown;
    };

    MessageRenderer?: {
      render?: (message: unknown) => HTMLElement;
      [key: string]: unknown;
    };

    PromptHandler?: {
      setProcessing?: (processing: boolean) => void;
      clearValue?: () => void;
      focus?: () => void;
      getValue?: () => string;
      [key: string]: unknown;
    };

    ToolRenderer?: {
      createToolCard?: (toolCall: unknown) => HTMLElement;
      updateToolCard?: (toolId: string, update: unknown) => void;
      appendOutput?: (toolId: string, delta: string) => void;
      toggleCollapse?: (toolId: string) => void;
      clear?: () => void;
      addDiffViewer?: (toolId: string, diff: unknown) => void;
      _parseAnsi?: (text: string) => string;
      _copySection?: (btn: HTMLElement) => void;
      [key: string]: unknown;
    };

    AgentModelSelector?: {
      show?: () => void;
      hide?: () => void;
      update?: () => void;
      initialize?: () => Promise<void>;
      getCurrentAgent?: () => unknown;
      getCurrentModel?: () => unknown;
      getAvailableAgents?: () => unknown[];
      getFlatModels?: () => unknown[];
      selectAgent?: (agentName: string) => Promise<void>;
      selectModel?: (providerId: string, modelId: string) => Promise<void>;
      setFromSession?: (info: unknown) => void;
      setFolderPath?: (folderPath: string) => void;
      _loadSavedPreference?: () => Promise<unknown>;
      subscribe?: (callback: (event: unknown) => void) => (() => void);
      _currentAgent?: string;
      _currentModel?: unknown;
      _providers?: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }>;
      [key: string]: unknown;
    };

    InstanceTabs?: {
      [key: string]: unknown;
    };

    // Tool Renderers
    ToolRendererRegistry?: ToolRegistry;

    BashRenderer?: {
      render?: (data: unknown) => HTMLElement;
      [key: string]: unknown;
    };

    ReadRenderer?: {
      render?: (data: unknown) => HTMLElement;
      [key: string]: unknown;
    };

    WriteRenderer?: {
      render?: (data: unknown) => HTMLElement;
      [key: string]: unknown;
    };

    // OpenCode App
    OpenCodeApp?: {
      init: () => Promise<void>;
      destroy: () => void;
      _showToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
      _createInstance?: (data: { folder: string; name?: string }) => Promise<void>;
      _closeInstance?: (instanceId: string) => Promise<void>;
      switchInstance?: (instanceId: string) => Promise<void>;
      [key: string]: unknown;
    };

    // OpenCode Manager
    OpenCodeManager?: {
      getMCPServers?: () => Array<{ id?: string; name: string; port: number; status: string }>;
      getBackgroundShells?: () => Array<{ id?: string; name: string; path: string; status?: string }>;
      getPlugins?: () => Array<{ id?: string; name: string; version: string; enabled: boolean }>;
      [key: string]: unknown;
    };


    // DOMPurify (external library)
    DOMPurify?: {
      sanitize: (dirty: string, config?: unknown) => string;
      [key: string]: unknown;
    };
  }

  const MessageStore: Window['MessageStore'];
  const SessionStore: Window['SessionStore'];
  const InstanceStore: Window['InstanceStore'];
  const ToolRendererRegistry: Window['ToolRendererRegistry'];
  const APIClient: Window['APIClient'];
  const OpenCodeApp: Window['OpenCodeApp'];

  /**
   * Generic IPC Result type
   */
  interface IPCResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    [key: string]: unknown;
  }

  /**
   * Electron IPC API Interface
   * Preload script tarafından expose edilen tüm metodlar
   */
  // OpenCode Config Types
  interface OpenCodeRecentFolder {
    path: string;
    name: string;
    lastAccessed: number;
  }

  interface OpenCodeBinary {
    path: string;
    version?: string;
    lastUsed: number;
  }

  interface OpenCodePreferences {
    defaultPort: number;
    autoConnect: boolean;
    showThinkingBlocks: boolean;
    diffViewMode: "split" | "unified";
    toolOutputExpansion: "expanded" | "collapsed";
  }

  interface OpenCodeConfig {
    recentFolders: OpenCodeRecentFolder[];
    opencodeBinaries: OpenCodeBinary[];
    preferences: OpenCodePreferences;
    lastUsedBinary?: string;
    lastWorkspace?: string;
  }

  // Workspace Types (Multi-Instance Support)
  interface WorkspaceDescriptor {
    id: string;
    name: string;
    path: string;
    status: 'starting' | 'ready' | 'stopped' | 'error';
    port?: number;
    pid?: number;
    proxyPath: string;
    error?: string;
    createdAt: string;
    updatedAt: string;
  }

  interface ElectronAPI {
    // Settings
    loadSettings: () => Promise<Record<string, unknown>>;
    saveSettings: (settings: Record<string, unknown>) => Promise<boolean>;

    // OpenCode Config
    loadOpencodeConfig: () => Promise<OpenCodeConfig>;
    saveOpencodeConfig: (config: OpenCodeConfig) => Promise<boolean>;
    opcAddRecentFolder: (path: string, name?: string) => Promise<OpenCodeConfig>;
    opcRemoveRecentFolder: (path: string) => Promise<OpenCodeConfig>;
    opcAddBinary: (path: string, version?: string) => Promise<OpenCodeConfig>;
    opcRemoveBinary: (path: string) => Promise<OpenCodeConfig>;
    opcUpdatePreferences: (updates: Partial<OpenCodePreferences>) => Promise<OpenCodeConfig>;
    opcRecordWorkspaceLaunch: (folderPath: string, binaryPath?: string) => Promise<OpenCodeConfig>;
    
    // OpenCode Agent/Model Preference Persistence
    opcListModels: () => Promise<Array<{ id: string; name: string; providerId: string }>>;
    opcListAgents: () => Promise<Array<{ name: string; description?: string }>>;
    opcGetAgentModelPreference: (folderPath?: string) => Promise<{ agent?: string; providerId?: string; modelId?: string; lastUpdated?: number } | null>;
    opcSaveAgentModelPreference: (preference: Record<string, unknown>, folderPath?: string) => Promise<boolean>;
    opcSaveAgentPreference: (agent: string, folderPath?: string) => Promise<boolean>;
    opcSaveModelPreference: (providerId: string, modelId: string, folderPath?: string) => Promise<boolean>;
    
    // OpenCode Active Projects Management
    opcGetActiveProjects: () => Promise<string[]>;
    opcAddActiveProject: (projectPath: string) => Promise<string[]>;
    opcRemoveActiveProject: (projectPath: string) => Promise<string[]>;

    // File Operations
    readFile: (path: string) => Promise<string | null>;
    readDirectoryFiles: (dirPath: string) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
    showOpenDialog: (options: Record<string, unknown>) => Promise<{ canceled: boolean; filePaths: string[] }>;
    openTerminal: (path: string) => Promise<{ success: boolean; error?: string }>;
    shellOpenPath: (path: string) => Promise<string>;
    showMessageBox: (options: Record<string, unknown>) => Promise<{ response: number; checkboxChecked: boolean }>;
    copyToAssets: (srcPath: string, role: string, accountInfo?: Record<string, unknown> | null) => Promise<{ path: string } | null>;
    deleteAsset: (assetPath: string) => Promise<IPCResult>;
    copyFileTo: (srcPath: string, destDir: string) => Promise<IPCResult & { path?: string }>;
    openPath: (path: string) => Promise<IPCResult>;

    // File Manager
    fmEnsureDirs: (scope: string) => Promise<IPCResult & { paths: Record<string, string> }>;
    fmTempPath: (prefix: string, ext: string) => Promise<{ path: string }>;
    fmWriteFileAtomic: (payload: Record<string, unknown>) => Promise<IPCResult & { path?: string }>;
    fmArchiveWrite: (meta: Record<string, unknown>, files: Array<Record<string, unknown>>) => Promise<IPCResult | void>;

    // Commands
    commandInit: () => Promise<{ jobs: Array<Record<string, unknown>> }>;
    commandWrite: (item: Record<string, unknown>) => Promise<IPCResult>;
    commandMove: (id: string, status: string, reason?: string) => Promise<IPCResult>;
    commandPaths: () => Promise<Record<string, string>>;
    commandStageAttachments: (payload: Record<string, unknown>) => Promise<IPCResult & { staged: Array<Record<string, unknown>>; temp: string[]; commandDir: string }>;
    commandStageTemp: (payload: Record<string, unknown>) => Promise<IPCResult & { staged: string[] }>;
    commandCleanupTemp: (payload: Record<string, unknown>) => Promise<IPCResult>;
    commandMoveFailed: (payload: Record<string, unknown>) => Promise<IPCResult>;
    commandArchiveCopy: (payload: Record<string, unknown>) => Promise<IPCResult & { path?: string }>;
    commandCleanupJob: (payload: Record<string, unknown>) => Promise<IPCResult>;

    // Database
    dbGetConversations: (payload: Record<string, unknown>) => Promise<IPCResult & { data?: Array<Record<string, unknown>> }>;
    dbUpdateConversation: (conversation: Record<string, unknown>) => Promise<IPCResult>;
    dbDeleteConversation: (payload: Record<string, unknown>) => Promise<IPCResult>;
    dbGetMessages: (payload: Record<string, unknown>) => Promise<IPCResult & { data?: Array<Record<string, unknown>> }>;
    dbSyncMessages: (payload: Record<string, unknown>) => Promise<IPCResult & { count?: number; added?: number; total?: number; conversationId?: string }>;
    dbSearchMessages: (payload: Record<string, unknown>) => Promise<IPCResult & { data?: Array<Record<string, unknown>> }>;
    dbSaveAttachment: (payload: Record<string, unknown>) => Promise<IPCResult>;

    // Archives
    archiveSync: (payload: Record<string, unknown>) => Promise<IPCResult>;
    readArchivesIndex: () => Promise<Array<Record<string, unknown>>>;
    writeArchivesIndex: (index: Array<Record<string, unknown>>) => Promise<IPCResult>;
    removeArchive: (folderName: string) => Promise<void>;

    // Screenshots
    screenshot: (options?: Record<string, unknown>) => Promise<IPCResult & { path?: string; base64?: string }>;
    screenshotCapture: (options?: Record<string, unknown> | string) => Promise<IPCResult & { path?: string; base64?: string; data?: string }>;
    capturePage: (type?: string, region?: unknown) => Promise<IPCResult & { data?: string }>;

    // Device Control
    deviceAction: (action: string, payload?: Record<string, unknown> | unknown) => Promise<IPCResult>;

    // Whisper
    whisperLoad: (params?: Record<string, unknown>, extra?: unknown) => Promise<IPCResult & { text?: string }>;
    whisperSave: (accountId: string, data: unknown) => Promise<IPCResult>;

    // Google Drive
    googledriveStartAuth: () => Promise<IPCResult & { authUrl?: string }>;
    googledriveExchangeCode: (code: string) => Promise<IPCResult>;
    googledriveUpload: (payload: Record<string, unknown>) => Promise<IPCResult & { url?: string; uploadedLinks?: string[]; uploaded?: number; errors?: string[] }>;
    googledriveDisconnect: () => Promise<IPCResult>;

    // Upload Services
    catboxUpload: (payload: Record<string, unknown>) => Promise<IPCResult & { url?: string }>;
    uguuUpload: (payload: Record<string, unknown>) => Promise<IPCResult & { url?: string }>;

    // Window Management
    windowMinimize: () => void;
    windowToggleFullscreen: () => void;
    windowClose: () => void;
    windowMinimizeToTray: () => void;
    appRestart: () => Promise<void>;

    // Logging
    logWrite: (payload: Record<string, unknown>) => Promise<IPCResult>;
    getSessionId: () => Promise<string>;
    getEarlyLogs: () => Promise<Array<{ level: string; source: string; message: string; timestamp: string; visibility: 1 | 2 | 3 }>>;
    onConsoleLogForward: (callback: (data: { level: string; source?: string; message?: string; context?: unknown; args?: unknown[]; visibility?: 1 | 2 | 3 }) => void) => () => void;

    // Webview
    setupWebviewLogger: (webContentsId: number, ...args: unknown[]) => Promise<IPCResult>;
    getPreloadPath: (type: string) => Promise<string>;
    getProviderConfig: (providerId: string) => Promise<Record<string, unknown>>;

    // Provider/Tree
    generateTree: (basePath: string, options?: Record<string, unknown>) => Promise<IPCResult & { path?: string; fileName?: string; lines?: number }>;

    // OpenCode/Assistant
    opencodeStart: (options?: Record<string, unknown>) => Promise<IPCResult>;
    opencodeStop: () => Promise<IPCResult>;
    opencodeStatus: () => Promise<{ running: boolean; port?: number }>;

    // OpenCode SSE Server
    opencodeSSEStart: (config?: { port?: number; host?: string; corsOrigin?: string }) => Promise<{ success: boolean; url?: string; workspace?: string; error?: string }>;
    opencodeSSEStop: () => Promise<{ success: boolean }>;
    opencodeSSEStatus: () => Promise<{ running: boolean; url: string | null; clients: number; openCodeConnected: boolean }>;
    opencodeSSESession: () => Promise<{ session: unknown | null }>;
    opencodeSSEStartSession: () => Promise<unknown>;
    opencodeSSEEndSession: () => Promise<void>;
    opencodeSSEConnect: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
    opencodeSSEDisconnect: () => Promise<void>;
    assistantConnect: (provider: string, options?: Record<string, unknown>) => Promise<IPCResult>;
    assistantDisconnect: () => Promise<IPCResult>;
    assistantStatus: () => Promise<{ connected: boolean }>;
    assistantGetConfig: (providerId: string) => Promise<Record<string, unknown>>;
    onAssistantDisconnected: (callback: () => void) => () => void;

    // Meta Commands
    metaCommand: (command: string, args?: Record<string, unknown>) => Promise<IPCResult & { command?: string }>;

    // Workspace API (Multi-Instance Support)
    workspaceList: () => Promise<IPCResult & { data?: WorkspaceDescriptor[] }>;
    workspaceCreate: (options: { path: string; name?: string }) => Promise<IPCResult & { data?: WorkspaceDescriptor }>;
    workspaceDelete: (id: string) => Promise<IPCResult & { data?: WorkspaceDescriptor }>;
    workspaceGet: (id: string) => Promise<IPCResult & { data?: WorkspaceDescriptor }>;
    workspaceGetAuth: (id: string) => Promise<IPCResult & { data?: { authorization: string } }>;

    // Index signature for any other methods not explicitly defined
    [key: string]: ((...args: unknown[]) => unknown) | undefined;
  }

  // Webview Element Extensions
  interface HTMLElement {
    getWebContentsId?(): number;
    send?(channel: string, ...args: unknown[]): void;
    executeJavaScript?(code: string): Promise<unknown>;
  }
}
