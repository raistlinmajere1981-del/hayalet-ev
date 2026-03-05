/**
 * Path System Types
 *
 * Centralized type definitions for the path management system.
 */

export interface PathConfig {
  /** Project root directory (auto-detected) */
  projectRoot: string;
  /** Data directory for persistent storage */
  dataDir: string;
  /** Config directory for settings */
  configDir: string;
  /** Logs directory for session logs */
  logsDir: string;
  /** Commands directory for job queue */
  commandsDir: string;
  /** Assets directory for static files */
  assetsDir: string;
  /** Is running in packaged mode (production) */
  isPackaged: boolean;
}

export interface PathResolver {
  /** Get base directories */
  getProjectRoot(): string;
  getDataDir(): string;
  getConfigDir(): string;
  getLogsDir(): string;
  getCommandsDir(): string;
  getAssetsDir(): string;

  /** Account-specific paths */
  getAccountDir(accountId: string): string;
  getAccountDbPath(accountId: string): string;
  getWhispersPath(): string;

  /** Electron-specific paths */
  getPreloadPath(filename: string): string;
  getPreloadFileUrl(filename: string): string;
  getIconPath(): string;
  getHtmlEntryPath(): string;

  /** Provider paths */
  getProviderConfigPath(providerId: string): string;

  /** External tool paths */
  /** Protocol paths */
  getProtocolsPath(): string;

  /** Utility methods */
  isPackaged(): boolean;
  sanitizeAccountId(accountId: string): string;
}
