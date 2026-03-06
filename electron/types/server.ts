/**
 * Server Manager Type Definitions
 *
 * OpenCode server manager için ortak tip tanımları.
 *
 * @module electron/types/server
 */

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
  /** Mevcut çalışan sunucuya bağlanıldıysa true */
  alreadyRunning?: boolean;
}

export interface ServerBinaryInfo {
  available: boolean;
  command: string;
  version?: string;
  resolvedPath?: string;
  error?: string;
}
