// Tell TypeScript that we're augmenting the global Window interface
export {};

declare global {
  interface Window {
    // This is the API exposed by electron/preload.cjs
    electronAPI?: {
      // settings
      loadSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<boolean>;
      createAccount: (accountData: any) => Promise<any>;
      assignAccountToSlot: (slot: string, accountId: string) => Promise<any>;
      // files
      readFile: (path: string) => Promise<string | null>; // returns base64
      readFilesMulti: (paths: string[]) => Promise<Array<{ path: string; data: string | null }>>;
      showOpenDialog: (options: any) => Promise<any>;
      copyToAssets: (sourcePath: string, roleName: string, accountInfo?: any) => Promise<{ path: string } | null>;
      // archives
      archiveSync: (payload: any) => Promise<any>;
      readArchivesIndex: () => Promise<any[]>;
      writeArchivesIndex: (index: any[]) => Promise<{ success: boolean }>;
      removeArchive: (folderName: string) => Promise<void>;
      openPath: (path: string) => Promise<{ success: boolean; message?: string }>;
      // commands
      commandInit: () => Promise<any>;
      commandWrite: (job: any) => Promise<any>;
      commandMove: (jobId: string, state: 'done' | 'failed') => Promise<any>;
      commandStageAttachments: (payload: {
        jobId: string;
        files: string[];
      }) => Promise<{ staged: any[]; temp: string[]; commandDir: string }>;
      commandArchiveCopy: (payload: { jobId: string; targetDir: string }) => Promise<any>;
      commandCleanupJob: (payload: { jobId: string; tempPaths: string[] }) => Promise<void>;
      commandMoveFailed: (payload: { jobId: string; tempPaths: string[] }) => Promise<{ success?: boolean; message?: string }>;
      // whispers
      whisperLoad: (provider: string) => Promise<{ pending: any[]; done: any[] }>;
      whisperSave: (provider: string, data: any) => Promise<{ success: boolean }>;
      // screenshots
      capturePage: (
        type: 'region' | 'full' | 'window',
        payload: any
      ) => Promise<{ success: boolean; data?: string }>;
      screenshotCapture: (options: any) => Promise<{ success: boolean; path?: string }>;
      // window controls
      windowMinimize: () => void;
      windowMinimizeToTray: () => void;
      windowToggleFullscreen: () => void;
      windowClose: () => void;
      // app control
      appRestart: () => void;
      // opencode server
      opencodeStart: (params?: any) => Promise<{ success: boolean; url?: string; message?: string; error?: any; alreadyRunning?: boolean; existingServer?: any }>;
      opencodeStop: () => Promise<{ success: boolean; message?: string }>;
      // device control
      deviceAction: (action: string, payload?: any) => Promise<any>;
      // file manager
      fmEnsureDirs: (scope: string) => Promise<{ success: boolean; paths: Record<string, string> }>;
      fmTempPath: (prefix: string, ext: string) => Promise<{ path: string }>;
      fmWriteFileAtomic: (payload: any) => Promise<any>;
      fmArchiveWrite: (meta: any, files: any) => Promise<any>;
      // logging
      appendLog: (payload: any) => Promise<void>;
      // misc
      getPreloadPath: (provider: string) => Promise<string>;
      generateTree: (
        scope: string,
        options: any
      ) => Promise<{ success: boolean; path?: string; content?: string; message?: string; fileName?: string; lines?: number }>;
      // meta commands
      metaListCommands: () => Promise<{ success: boolean; commands?: Record<string, any>; message?: string }>;
      metaDefineCommand: (params: { name: string; description: string; code: string; createdBy: string }) => Promise<{ success: boolean; command?: any; message?: string }>;
      metaDeleteCommand: (params: { name: string }) => Promise<{ success: boolean; message?: string }>;
      // upload services
      fetchUrl: (url: string, options: any) => Promise<any>;
      catboxUpload: (options: any) => Promise<any>;
      uguuUpload: (options: any) => Promise<any>;
      googledriveUpload: (options: any) => Promise<any>;
      googledriveStartAuth: () => Promise<any>;
      googledriveExchangeCode: (code: string) => Promise<any>;
      googledriveDisconnect: () => Promise<any>;
      // database
      dbGetConversations: (params: { accountId: string }) => Promise<any[]>;
      dbUpdateConversation: (params: { accountId: string; conversationId: string; [key: string]: any }) => Promise<any>;
      dbDeleteConversation: (params: { accountId: string; conversationId: string }) => Promise<any>;
      dbGetMessages: (params: { accountId: string; conversationId: string }) => Promise<any[]>;
      dbSyncMessages: (params: { accountId: string; webUrl: string; messages: any[]; authors?: any }) => Promise<any>;
      dbSearchMessages: (params: { accountId: string; query: string; limit?: number }) => Promise<any[]>;
      dbSearchAllAccounts: (params: { query: string; limit?: number }) => Promise<any[]>;
      dbSearchAttachments: (params: { accountId?: string; query: string; limit?: number }) => Promise<any[]>;
      // logging
      getSessionId: () => Promise<string>;
      onConsoleLogForward: (callback: (data: any) => void) => () => void;
      setupWebviewLogger: (webContentsId: number, provider: string, providerId: string) => Promise<{ success: boolean }>;
      // database extras
      dbSaveAttachment: (params: any) => Promise<any>;
      dbGetAttachments: (params: { conversationId: string; accountId?: string }) => Promise<any[]>;
      dbInitAccount: (params: { accountId: string }) => Promise<any>;
      // dialog
      showMessageBox: (options: any) => Promise<any>;
      // upload services extra
      tmpfileUpload: (options: any) => Promise<any>;
      // file manager extra
      fmEnsureDirs: (scope: string) => Promise<{ success: boolean; paths: Record<string, string>; message?: string }>;
      commandStageAttachments: (payload: { jobId: string; files: string[] }) => Promise<{ success?: boolean; staged: any[]; temp: string[]; commandDir: string; message?: string }>;
      fmArchiveWrite: (meta: any, files: any) => Promise<{ success: boolean; message?: string } | void>;
    };

    // Global helper functions attached in app.js
    updateChatListOnNewEntry?: (provider: string, selectedId: string, options?: any) => Promise<void>;
    refreshAnalyzeMessages?: (provider: string) => Promise<void>;
    
    // Custom properties
    __hayalet_settings_unsub?: () => void;
    __hayalet_provider_config?: any;
  }
  
  // Extend HTMLElement for webview
  interface HTMLElement {
    getWebContentsId?(): number;
    send?(channel: string, ...args: any[]): void;
    executeJavaScript?(code: string): Promise<any>;
  }
}
