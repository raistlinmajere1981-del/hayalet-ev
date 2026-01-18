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
  interface ElectronAPI {
    // Settings
    loadSettings: () => Promise<Record<string, unknown>>;
    saveSettings: (settings: Record<string, unknown>) => Promise<boolean>;
    createAccount: (accountData: Record<string, unknown>) => Promise<unknown>;
    assignAccountToSlot: (slot: string, accountId: string) => Promise<IPCResult>;

    // File Operations
    readFile: (path: string) => Promise<string | null>;
    readFilesMulti: (paths: string[]) => Promise<Array<{ path: string; data: string | null }>>;
    readDirectoryFiles: (dirPath: string) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
    showOpenDialog: (options: Record<string, unknown>) => Promise<{ canceled: boolean; filePaths: string[] }>;
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
    dbSaveConversation: (conversation: Record<string, unknown>) => Promise<IPCResult & { id?: string }>;
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
    tmpfileUpload: (payload: Record<string, unknown>) => Promise<IPCResult & { url?: string }>;

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
    opencodeSSEStart: (config?: { port?: number; host?: string; corsOrigin?: string }) => Promise<{ success: boolean; url?: string; error?: string }>;
    opencodeSSEStop: () => Promise<{ success: boolean }>;
    opencodeSSEStatus: () => Promise<{ running: boolean; url: string | null; clients: number }>;
    opencodeSSESession: () => Promise<{ session: unknown | null }>;
    opencodeSSEStartSession: () => Promise<unknown>;
    opencodeSSEEndSession: () => Promise<void>;
    assistantConnect: (provider: string, options?: Record<string, unknown>) => Promise<IPCResult>;
    assistantDisconnect: () => Promise<IPCResult>;
    assistantStatus: () => Promise<{ connected: boolean }>;
    assistantGetConfig: (providerId: string) => Promise<Record<string, unknown>>;
    onAssistantDisconnected: (callback: () => void) => () => void;

    // Meta Commands
    metaCommand: (command: string, args?: Record<string, unknown>) => Promise<IPCResult & { command?: string }>;

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
