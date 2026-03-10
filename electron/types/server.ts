export interface ServerOptions {
  port?: number;
  cors?: string[];
  binaryPath?: string;
}

export interface ServerInfo {
  running: boolean;
  port?: number;
  url?: string;
  pid?: number;
  startTime?: number;
  alreadyRunning?: boolean;
  source?: "existing" | "started";
}

export interface ServerBinaryInfo {
  available: boolean;
  command: string;
  version?: string;
  resolvedPath?: string;
  error?: string;
}
