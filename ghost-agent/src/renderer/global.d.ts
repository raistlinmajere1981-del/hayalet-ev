type GhostProvider = "opencode";

type GhostLaunchTarget = {
  provider: GhostProvider;
  targetUrl: string;
  details: string;
};

type GhostProviderServerState = {
  provider: GhostProvider;
  running: boolean;
  port?: number;
  url?: string;
  alreadyRunning?: boolean;
  source?: "existing" | "started";
};

type GhostExitAction = "close" | "return-main";

interface GhostElectronAPI {
  ghostBootstrap: () => Promise<{
    success: boolean;
    target?: GhostLaunchTarget;
    error?: string;
  }>;
  ghostProviderDetect?: (provider: GhostProvider) => Promise<{
    success: boolean;
    provider?: GhostProvider;
    server?: GhostProviderServerState;
    error?: string;
  }>;
  ghostProviderConnect?: (payload: { provider: GhostProvider; autoStart?: boolean }) => Promise<{
    success: boolean;
    target?: GhostLaunchTarget;
    server?: GhostProviderServerState;
    error?: string;
  }>;
  ghostProviderStop?: (provider: GhostProvider) => Promise<{
    success: boolean;
    provider?: GhostProvider;
    server?: GhostProviderServerState;
    error?: string;
  }>;
  ghostProviderSetPreferred?: (provider: GhostProvider) => Promise<{
    success: boolean;
    provider?: GhostProvider;
    error?: string;
  }>;
  ghostOpenTarget: (target: GhostLaunchTarget) => Promise<{ success: boolean; error?: string }>;
  ghostExitAction: (action: GhostExitAction) => Promise<{ success: boolean; error?: string }>;
  showOpenDialog?: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  fmTempPath?: (
    prefix: string,
    ext: string
  ) => Promise<{ success: boolean; path?: string; message?: string }>;
  fmWriteFileAtomic?: (payload: {
    path: string;
    data: string;
    encoding?: BufferEncoding | "base64";
  }) => Promise<{ success: boolean; message?: string }>;
  ghostLog?: (payload: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    context?: Record<string, unknown>;
  }) => Promise<{ success: boolean; error?: string }>;
  sendToHost?: (channel: string, data: unknown) => void;
}

declare global {
  interface Window {
    electronAPI?: GhostElectronAPI;
  }
}

export {};
