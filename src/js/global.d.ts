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
      openPath: (path: string) => Promise<void>;
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
      commandMoveFailed: (payload: { jobId: string; tempPaths: string[] }) => Promise<void>;
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
      windowToggleFullscreen: () => void;
      windowClose: () => void;
      // app control
      appRestart: () => void;
      // device control
      deviceAction: (action: string, payload?: any) => Promise<any>;
      // file manager
      fmEnsureDirs: (scope: string) => Promise<void>;
      fmTempPath: (prefix: string, ext: string) => Promise<string>;
      fmWriteFileAtomic: (payload: any) => Promise<any>;
      fmArchiveWrite: (meta: any, files: any) => Promise<any>;
      // logging
      appendLog: (payload: any) => Promise<void>;
      // misc
      getPreloadPath: (provider: string) => Promise<string>;
      generateTree: (
        scope: string,
        options: any
      ) => Promise<{ success: boolean; path?: string; content?: string }>;
      // upload services
      fetchUrl: (url: string, options: any) => Promise<any>;
      catboxUpload: (options: any) => Promise<any>;
      uguuUpload: (options: any) => Promise<any>;
      googledriveUpload: (options: any) => Promise<any>;
      googledriveStartAuth: () => Promise<any>;
      googledriveExchangeCode: (code: string) => Promise<any>;
      googledriveDisconnect: () => Promise<any>;
      // database
      dbGetConversations: (accountId: string, options?: any) => Promise<any[]>;
      dbUpdateConversation: (accountId: string, conversation: any) => Promise<any>;
      dbDeleteConversation: (accountId: string, conversationId: string) => Promise<any>;
      dbGetMessages: (accountId: string, conversationId: string) => Promise<any[]>;
      dbSyncMessages: (accountId: string, conversationId: string, messages: any[]) => Promise<any>;
      dbSearchMessages: (accountId: string, query: string, options?: any) => Promise<any[]>;
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
