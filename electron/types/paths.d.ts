export interface PathConfig {
  projectRoot: string;
  dataDir: string;
  configDir: string;
  logsDir: string;
  commandsDir: string;
  assetsDir: string;
  isPackaged: boolean;
}

export interface PathResolver {
  getProjectRoot(): string;
  getDataDir(): string;
  getConfigDir(): string;
  getLogsDir(): string;
  getCommandsDir(): string;
  getAssetsDir(): string;
  getRoomsWorkspaceDir(): string;
  getInstalledRoomsDir(): string;
  getRoomsRegistryPath(): string;
  getInstalledRoomDir(roomId: string): string;

  getAccountDir(accountId: string): string;
  getAccountDbPath(accountId: string): string;
  getWhispersPath(): string;

  getPreloadPath(filename: string): string;
  getPreloadFileUrl(filename: string): string;
  getIconPath(): string;
  getHtmlEntryPath(): string;

  getProviderConfigPath(providerId: string): string;

  getProtocolsPath(): string;

  isPackaged(): boolean;
  sanitizeAccountId(accountId: string): string;
}
