import type {
  ProviderConfig,
  ProviderTestProgressEvent,
  ProviderTestSuite,
} from "@shared/provider.js";
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
} from "./modules/asistan/tool-renderers/registry/types.js";

export {};

type AttachmentType = "file" | "image" | "text" | "agent";

type IPCResult = {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
};

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
  status: "connecting" | "connected" | "disconnected" | "error";
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
  subscribe: (listener: RegistryListener) => (() => void) | undefined;
  getRegisteredTools: () => string[];
  setDefault: (config: ToolRendererConfig) => void;
  renderToolCard: (toolCall: ToolCallData) => string;
  updateStatus: (toolCall: ToolCallData, newStatus: string) => void;
  renderInput: (toolCall: ToolCallData) => string;
  renderOutput: (toolCall: ToolCallData) => string;
  shouldAutoCollapse: (toolCall: ToolCallData) => boolean;
  get: (toolName: string) => unknown;
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

    updateChatListOnNewEntry?: (
      provider: string,
      selectedId: string,
      options?: { scroll?: boolean }
    ) => Promise<void>;
    refreshAnalyzeMessages?: (provider: string) => Promise<void>;

    __hayalet_settings_unsub?: () => void;
    __hayalet_provider_config?: ProviderConfig;

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

    listFileSystem?: (path: string, options?: Record<string, unknown>) => Promise<unknown>;

    APIClient?: {
      listAgents?: () => Promise<unknown>;
      listProviders?: () => Promise<unknown>;
      listFileSystem?: (path: string, options?: Record<string, unknown>) => Promise<unknown>;
      updateSessionAgent?: (sessionId: string, agentName: string) => Promise<unknown>;
      updateSessionModel?: (
        sessionId: string,
        providerId: string,
        modelId: string
      ) => Promise<unknown>;
      retry?: (sessionId?: string) => Promise<unknown>;
      connect?: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
      sendMessage?: (
        sessionId: string,
        message: string
      ) => Promise<{ success?: boolean; error?: string }>;
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

    SSEClient?: {
      connect?: (serverUrl?: string, authToken?: string) => Promise<unknown>;
      disconnect?: () => void;
      on?: (event: string, handler: (data: unknown) => unknown) => void;
      [key: string]: unknown;
    };

    MessageStore?: {
      createMessage?: (data: MessageUpsertInput) => MessageRecord;
      updateMessage?: (id: string, data: Partial<MessageRecord>) => void;
      getMessage?: (id: string) => unknown;
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
      upsertPermission?: (data: PermissionEntry) => unknown;
      removePermission?: (id: string) => void;
      getPermissionQueue?: () => PermissionEntry[];
      upsertQuestion?: (data: QuestionEntry) => unknown;
      removeQuestion?: (id: string) => void;
      getQuestionQueue?: () => QuestionEntry[];
      subscribe?: (callback: (event: StoreEvent) => void) => () => void;
      createId?: (prefix: string) => string;
      [key: string]: unknown;
    };

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
      subscribe?: (callback: (event: SessionStoreEvent) => void) => () => void;
      [key: string]: unknown;
    };

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
      getAuthorizationHeader?: (instanceId: string) => Promise<string | null>;
      createWorkspace?: (data: { folder: string; name?: string }) => Promise<InstanceRecord | null>;
      clear?: () => void;
      getActiveInstanceStatus?: () => string;
      isActiveInstanceConnected?: () => boolean;
      getActiveInstanceProperty?: (property: string, defaultValue?: unknown) => unknown;
      hasInstances?: () => boolean;
      getDisconnectionReason?: (instanceId: string) => string | null;
      nextInstance?: () => string | null;
      prevInstance?: () => string | null;
      switchToIndex?: (index: number) => string | null;
      subscribe?: (callback: (event: InstanceStoreEvent) => void) => () => void;
      [key: string]: unknown;
    };

    AttachmentStore?: {
      getAttachments?: (sessionId: string, instanceId?: string) => AttachmentRecord[];
      addAttachment?: (
        sessionId: string,
        attachment: AttachmentInput,
        instanceId?: string
      ) => AttachmentRecord | null;
      addFileAttachment?: (
        sessionId: string,
        file: File,
        instanceId?: string
      ) => Promise<AttachmentRecord | null>;
      addImageAttachment?: (
        sessionId: string,
        imageData: File | Blob,
        instanceId?: string
      ) => Promise<AttachmentRecord | null>;
      addTextAttachment?: (
        sessionId: string,
        content: string,
        name?: string,
        instanceId?: string
      ) => AttachmentRecord | null;
      removeAttachment?: (sessionId: string, attachmentId: string, instanceId?: string) => boolean;
      clearAttachments?: (sessionId: string, instanceId?: string) => void;
      getAttachmentsForAPI?: (
        sessionId: string,
        instanceId?: string
      ) => Array<Record<string, unknown>>;
      handlePaste?: (
        event: ClipboardEvent,
        sessionId: string,
        instanceId?: string
      ) => Promise<AttachmentRecord[]>;
      handleDrop?: (
        event: DragEvent,
        sessionId: string,
        instanceId?: string
      ) => Promise<AttachmentRecord[]>;
      subscribe?: (callback: (event: AttachmentStoreEvent) => void) => () => void;
      [key: string]: unknown;
    };

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

    PartNormalizer?: {
      normalize?: (part: unknown) => unknown;
      normalizeAll?: (parts: unknown[]) => unknown[];
      decodeHtml?: (text: string) => string;
      needsNormalization?: (part: unknown) => boolean;
      [key: string]: unknown;
    };

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
      subscribe?: (callback: (event: unknown) => void) => () => void;
      _currentAgent?: string;
      _currentModel?: unknown;
      _providers?: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }>;
      [key: string]: unknown;
    };

    InstanceTabs?: {
      init?: (
        container: HTMLElement,
        callbacks?: {
          onSelect?: (id: string) => void;
          onClose?: (id: string) => void;
          onNew?: () => void;
        }
      ) => void;
      render?: () => void;
      destroy?: () => void;
      [key: string]: unknown;
    };

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

    OpenCodeApp?: {
      init: () => Promise<void>;
      destroy: () => void;
      _showToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
      _createInstance?: (data: { folder: string; name?: string }) => Promise<void>;
      _closeInstance?: (instanceId: string) => Promise<void>;
    };

    // Theme Manager (window extension for HMR)
    __ThemeManager?: unknown;

    // MCP server management
    __setDisabledMcpServers?: (list: string[]) => void;
    __lastMcpServers?: Record<string, string>;

    // Chat page utilities
    copyCodeBlock?: (btn: HTMLElement) => void;
  }

  interface ElectronAPI {
    getStartupFlags: () => { startPage: string | null; autoConnect: boolean };
    loadSettings: () => Promise<Record<string, unknown>>;
    saveSettings: (settings: Record<string, unknown>) => Promise<boolean>;

    readFile: (path: string) => Promise<string | null>;
    loadProtocols: () => Promise<{
      success: boolean;
      protocols?: Record<string, string>;
      message?: string;
    }>;
    saveProtocol: (key: string, content: string) => Promise<{ success: boolean; message?: string }>;
    readDirectoryFiles: (
      dirPath: string
    ) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
    showOpenDialog: (
      options: Record<string, unknown>
    ) => Promise<{ canceled: boolean; filePaths: string[] }>;
    openTerminal: (path: string) => Promise<{ success: boolean; error?: string }>;
    assistantRuntimeRead: () => Promise<{
      success: boolean;
      state?: {
        workflowSessionId: string;
        desiredMode: "terminal" | "soft" | "ghost-agent";
        phase: "idle" | "preparing-handoff" | "in-ghost" | "returning";
        updatedAt: string;
      };
    }>;
    assistantRuntimeWrite: (payload: Record<string, unknown>) => Promise<{
      success: boolean;
      state?: {
        workflowSessionId: string;
        desiredMode: "terminal" | "soft" | "ghost-agent";
        phase: "idle" | "preparing-handoff" | "in-ghost" | "returning";
        updatedAt: string;
      };
    }>;
    shellOpenPath: (path: string) => Promise<string>;
    showMessageBox: (
      options: Record<string, unknown>
    ) => Promise<{ response: number; checkboxChecked: boolean }>;
    copyToAssets: (
      srcPath: string,
      role: string,
      accountInfo?: Record<string, unknown> | null
    ) => Promise<{ path: string } | null>;
    deleteAsset: (assetPath: string) => Promise<IPCResult>;
    copyFileTo: (srcPath: string, destDir: string) => Promise<IPCResult & { path?: string }>;
    openPath: (path: string) => Promise<IPCResult>;

    fmEnsureDirs: (scope: string) => Promise<IPCResult & { paths: Record<string, string> }>;
    fmTempPath: (prefix: string, ext: string) => Promise<{ path: string }>;
    fmWriteFileAtomic: (payload: Record<string, unknown>) => Promise<IPCResult & { path?: string }>;
    fmArchiveWrite: (
      meta: Record<string, unknown>,
      files: Array<Record<string, unknown>>
    ) => Promise<IPCResult | undefined>;

    testProvider: (params: { slot: "ai0" | "ai1" | "ai2" }) => Promise<ProviderTestSuite>;
    onProviderTestProgress: (callback: (event: ProviderTestProgressEvent) => void) => void;
    offProviderTestProgress: (callback: (event: ProviderTestProgressEvent) => void) => void;

    commandInit: () => Promise<{ jobs: Array<Record<string, unknown>> }>;
    commandWrite: (item: Record<string, unknown>) => Promise<IPCResult>;
    commandMove: (id: string, status: string, reason?: string) => Promise<IPCResult>;
    commandPaths: () => Promise<Record<string, string>>;
    commandStageAttachments: (
      payload: Record<string, unknown>
    ) => Promise<
      IPCResult & { staged: Array<Record<string, unknown>>; temp: string[]; commandDir: string }
    >;
    commandStageTemp: (
      payload: Record<string, unknown>
    ) => Promise<IPCResult & { staged: string[] }>;
    commandCleanupTemp: (payload: Record<string, unknown>) => Promise<IPCResult>;
    commandMoveFailed: (payload: Record<string, unknown>) => Promise<IPCResult>;
    commandArchiveCopy: (
      payload: Record<string, unknown>
    ) => Promise<IPCResult & { path?: string }>;
    commandCleanupJob: (payload: Record<string, unknown>) => Promise<IPCResult>;

    dbGetConversations: (
      payload: Record<string, unknown>
    ) => Promise<IPCResult & { data?: Array<Record<string, unknown>> }>;
    dbUpdateConversation: (conversation: Record<string, unknown>) => Promise<IPCResult>;
    dbDeleteConversation: (payload: Record<string, unknown>) => Promise<IPCResult>;
    dbGetMessages: (
      payload: Record<string, unknown>
    ) => Promise<IPCResult & { data?: Array<Record<string, unknown>> }>;
    dbSyncMessages: (
      payload: Record<string, unknown>
    ) => Promise<
      IPCResult & { count?: number; added?: number; total?: number; conversationId?: string }
    >;
    dbSearchMessages: (
      payload: Record<string, unknown>
    ) => Promise<IPCResult & { data?: Array<Record<string, unknown>> }>;
    dbSaveAttachment: (payload: Record<string, unknown>) => Promise<IPCResult>;

    archiveSync: (payload: Record<string, unknown>) => Promise<IPCResult>;
    readArchivesIndex: () => Promise<Array<Record<string, unknown>>>;
    writeArchivesIndex: (index: Array<Record<string, unknown>>) => Promise<IPCResult>;
    removeArchive: (folderName: string) => Promise<void>;

    screenshot: (
      options?: Record<string, unknown>
    ) => Promise<IPCResult & { path?: string; base64?: string }>;
    screenshotCapture: (
      options?: Record<string, unknown> | string
    ) => Promise<IPCResult & { path?: string; base64?: string; data?: string }>;
    capturePage: (type?: string, region?: unknown) => Promise<IPCResult & { data?: string }>;

    deviceAction: (action: string, payload?: unknown) => Promise<IPCResult>;

    whisperLoad: (
      params?: Record<string, unknown>,
      extra?: unknown
    ) => Promise<IPCResult & { text?: string }>;
    whisperSave: (
      params: { accountId: string; payload?: unknown } | string,
      data?: unknown
    ) => Promise<IPCResult>;

    googledriveStartAuth: () => Promise<IPCResult & { authUrl?: string }>;
    googledriveExchangeCode: (code: string) => Promise<IPCResult>;
    googledriveUpload: (
      payload: Record<string, unknown>
    ) => Promise<
      IPCResult & { url?: string; uploadedLinks?: string[]; uploaded?: number; errors?: string[] }
    >;
    googledriveDisconnect: () => Promise<IPCResult>;

    catboxUpload: (payload: Record<string, unknown>) => Promise<IPCResult & { url?: string }>;
    uguuUpload: (payload: Record<string, unknown>) => Promise<IPCResult & { url?: string }>;

    windowMinimize: () => void;
    windowToggleFullscreen: () => void;
    windowClose: () => void;
    windowMinimizeToTray: () => void;
    appRestart: (options?: {
      forceFullRestart?: boolean;
    }) => Promise<{ success: boolean; message?: string }>;

    logger: {
      appendBatch: (entries: unknown[]) => Promise<{ success: boolean; error?: string }>;
      getSessionId: () => Promise<string>;
      getEarlyLogs: () => Promise<
        Array<{
          level: string;
          source: string;
          message: string;
          timestamp: string;
          visibility: 1 | 2 | 3;
        }>
      >;
      readAllLogs: (sessionId?: string | null) => Promise<unknown>;
      queryLogs: (query: Record<string, unknown>) => Promise<unknown>;
      listSessions: () => Promise<unknown>;
      getAppState: () => Promise<unknown>;
      writeStateSnapshot: () => Promise<{ success: boolean }>;
      setupWebviewLogger: (
        webviewId: number,
        slot: string,
        provider: string
      ) => Promise<{ success: boolean; error?: string }>;
      generateCorrelationId: (prefix: string) => Promise<string>;
      readConsoleLogs: (tail: number) => Promise<unknown>;
      readErrorLogs: (tail: number) => Promise<unknown>;
      getLogPaths: () => Promise<{
        console: string;
        error: string;
        sessionDir: string;
        logDir: string;
      }>;
      onConsoleLogForward: (
        callback: (data: {
          level: string;
          source?: string;
          message?: string;
          context?: unknown;
          args?: unknown[];
          visibility?: 1 | 2 | 3;
        }) => void
      ) => () => void;
    };

    // Legacy Logging API (backward compatibility)
    logWrite: (payload: Record<string, unknown>) => Promise<IPCResult>;
    getSessionId: () => Promise<string>;
    getEarlyLogs: () => Promise<
      Array<{
        level: string;
        source: string;
        message: string;
        timestamp: string;
        visibility: 1 | 2 | 3;
      }>
    >;
    onConsoleLogForward: (
      callback: (data: {
        level: string;
        source?: string;
        message?: string;
        context?: unknown;
        args?: unknown[];
        visibility?: 1 | 2 | 3;
      }) => void
    ) => () => void;

    ipcRenderer: {
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
    };

    setupWebviewLogger: (webContentsId: number, ...args: unknown[]) => Promise<IPCResult>;
    getPreloadPath: (type: string) => Promise<string>;
    getProviderConfig: (providerId: string) => Promise<Record<string, unknown>>;
    sendToHost?: (channel: string, data?: unknown) => void;

    generateTree: (
      basePath: string,
      options?: Record<string, unknown>
    ) => Promise<IPCResult & { path?: string; fileName?: string; lines?: number }>;

    opencodeStart: (options?: Record<string, unknown>) => Promise<IPCResult>;
    opencodeStop: () => Promise<IPCResult>;
    opencodeStatus: () => Promise<{ running: boolean; port?: number }>;

    assistantConnect: (provider: string, options?: Record<string, unknown>) => Promise<IPCResult>;
    assistantDisconnect: () => Promise<IPCResult>;
    assistantStatus: () => Promise<{ connected: boolean }>;
    assistantGetConfig: (providerId: string) => Promise<Record<string, unknown>>;
    onAssistantDisconnected: (callback: () => void) => () => void;

    metaCommand: (
      command: string,
      args?: Record<string, unknown>
    ) => Promise<IPCResult & { command?: string }>;

    opencodeServeStart: (options?: {
      port?: number;
      cors?: string[];
      binaryPath?: string;
    }) => Promise<{
      success: boolean;
      port?: number;
      url?: string;
      pid?: number;
      startTime?: number;
      alreadyRunning?: boolean;
      error?: string;
    }>;
    opencodeServeStop: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    opencodeServeStatus: () => Promise<{
      running: boolean;
      port?: number;
      url?: string;
      pid?: number;
      startTime?: number;
    }>;
    opencodeServeFindPort: (
      start?: number,
      end?: number
    ) => Promise<{
      port?: number;
      error?: string;
    }>;
    opencodeServeFindRunning: (
      start?: number,
      end?: number
    ) => Promise<{
      running: boolean;
      port?: number;
      url?: string;
      error?: string;
    }>;
    opencodeServeDoctor: (options?: { binaryPath?: string }) => Promise<{
      success: boolean;
      available: boolean;
      command: string;
      version?: string;
      resolvedPath?: string;
      error?: string;
    }>;
    opencodeCheckUpdates: (installedVersion: string) => Promise<{
      success: boolean;
      installedVersion: string;
      latestVersion?: string;
      updateAvailable?: boolean;
      releaseUrl?: string;
      error?: string;
    }>;
    opencodeLaunchInstall: () => Promise<{
      success: boolean;
      command: string;
      installUrl: string;
      fallbackToBrowser?: boolean;
      error?: string;
    }>;

    opencodeUiApiProxy: (options: { url: string; method: string; body?: string }) => Promise<{
      success: boolean;
      data?: Record<string, unknown>;
      error?: string;
      status?: number;
    }>;

    // OpenCode UI filesystem (session ensure/read/list)
    opencodeUiFsEnsureSession: (
      sessionId: string,
      title?: string,
      dbPath?: string
    ) => Promise<{
      success: boolean;
      created?: boolean;
      error?: string;
    }>;
    opencodeUiFsListSessions: (dbPath?: string) => Promise<{
      success: boolean;
      sessions?: Array<{
        id: string;
        title: string;
        workspace_path: string;
        updated_at: number;
        created_at: number;
        archived_at: number | null;
      }>;
      error?: string;
    }>;
    opencodeUiFsArchiveSession: (
      sessionId: string,
      archived?: boolean,
      dbPath?: string
    ) => Promise<{
      success: boolean;
      archived?: boolean;
      error?: string;
    }>;
    opencodeUiFsReadSession: (
      sessionId: string,
      dbPath?: string
    ) => Promise<{
      success: boolean;
      session?: {
        id: string;
        title: string;
        workspace_path: string;
        usage: Record<string, unknown>;
        messages: Array<{
          role: "user" | "assistant";
          text: string;
          files?: Array<{ name: string; media_type: string }>;
          toolCalls?: Array<{ name: string; args?: string; result?: string }>;
        }>;
      };
      error?: string;
    }>;

    opencodeUiSessionWatchStart: (
      sessionId: string,
      dbPath?: string
    ) => Promise<{ success: boolean }>;
    opencodeUiSessionWatchStop: () => Promise<{ success: boolean }>;
    opencodeUiOnSessionUpdated: (callback: (payload: { sessionId: string }) => void) => void;
    opencodeUiOffSessionUpdated: (callback: (payload: { sessionId: string }) => void) => void;

    opencodeUiHevTools: () => Promise<{
      success: boolean;
      total: number;
      generatedAt: string;
      categories: Array<{
        name: string;
        count: number;
        tools: Array<{ name: string; description: string }>;
      }>;
      toolNames: string[];
      error?: string;
    }>;
    opencodeUiQuickPromptsRead: () => Promise<{
      success: boolean;
      prompts: Array<{
        id: string;
        name: string;
        content: string;
        createdAt: number;
      }>;
      path: string;
      error?: string;
    }>;
    opencodeUiQuickPromptsWrite: (
      prompts: Array<{
        id: string;
        name: string;
        content: string;
        createdAt: number;
      }>
    ) => Promise<{
      success: boolean;
      prompts: Array<{
        id: string;
        name: string;
        content: string;
        createdAt: number;
      }>;
      path: string;
      error?: string;
    }>;

    toggleCodeBlock?: (btn: HTMLElement) => void;
    runCodeBlock?: (btn: HTMLElement) => void;
    [key: string]: ((...args: unknown[]) => unknown) | undefined;
  }

  interface HTMLElement {
    getWebContentsId?(): number;
    send?(channel: string, ...args: unknown[]): void;
    executeJavaScript?(code: string): Promise<unknown>;
  }
}
