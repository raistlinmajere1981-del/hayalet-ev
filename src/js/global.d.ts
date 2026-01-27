/**
 * Global Type Declarations
 * Window.electronAPI ve diğer global type tanımları
 */

import type { ProviderConfig } from "./types/provider.js";

export {};

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
      [key: string]: unknown;
    };

    // API Client
    APIClient?: {
      listAgents?: () => Promise<unknown>;
      listProviders?: () => Promise<unknown>;
      updateSessionAgent?: (sessionId: string, agentName: string) => Promise<unknown>;
      updateSessionModel?: (sessionId: string, providerId: string, modelId: string) => Promise<unknown>;
      retry?: (sessionId: string) => Promise<unknown>;
      [key: string]: unknown;
    };

    // SSE Client
    SSEClient?: {
      connect?: () => Promise<unknown>;
      disconnect?: () => void;
      [key: string]: unknown;
    };

    // Message Store
    MessageStore?: {
      createMessage?: (data: unknown) => unknown;
      updateMessage?: (id: string, data: unknown) => void;
      getMessage?: (id: string) => unknown;
      [key: string]: unknown;
    };

    // Session Store
    SessionStore?: {
      getCurrentSessionId?: () => string | null;
      createSession?: () => unknown;
      getSessionInfo?: (sessionId: string) => unknown;
      getSessionUsage?: (sessionId: string) => unknown;
      getTotalUsage?: () => { tokens: number; cost: number };
      renameSession?: (sessionId: string, title: string) => Promise<boolean>;
      deleteSession?: (sessionId: string) => Promise<void>;
      [key: string]: unknown;
    };

    // Instance Store
    InstanceStore?: {
      [key: string]: unknown;
    };

    // Attachment Store
    AttachmentStore?: {
      [key: string]: unknown;
    };

    // Store Bridge
    StoreBridge?: {
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
      [key: string]: unknown;
    };

    ToolRenderer?: {
      [key: string]: unknown;
    };

    AgentModelSelector?: {
      show?: () => void;
      hide?: () => void;
      update?: () => void;
      [key: string]: unknown;
    };

    InstanceTabs?: {
      [key: string]: unknown;
    };

    // Tool Renderers
    ToolRendererRegistry?: {
      register?: (name: string, renderer: unknown) => void;
      get?: (name: string) => unknown;
      [key: string]: unknown;
    };

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
      _showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
      [key: string]: unknown;
    };

    // DOMPurify (external library)
    DOMPurify?: {
      sanitize: (dirty: string, config?: unknown) => string;
      [key: string]: unknown;
    };
  }

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
