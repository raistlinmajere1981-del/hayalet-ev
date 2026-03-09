/**
 * Server Manager Type Definitions
 *
 * Shared type definitions for the OpenCode server manager.
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
  /** True when connected to an already running server */
  alreadyRunning?: boolean;
  /** Source of the server: an existing external process or one started in this session */
  source?: "existing" | "started";
}

export interface ServerBinaryInfo {
  available: boolean;
  command: string;
  version?: string;
  resolvedPath?: string;
  error?: string;
}
