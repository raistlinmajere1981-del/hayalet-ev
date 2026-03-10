import type { SlotId, ProviderId, AllProviderId, AssistantProviderId } from "./common.js";
import type { AppLanguage } from "./i18n.js";
export type { AppLanguage } from "./i18n.js";

export const ASSISTANT_SLOT_SETTINGS_KEY = "assistantSlot";
export const ASSISTANT_ACCOUNTS_SETTINGS_KEY = "assistantAccounts";

function matchesSettingsPath(path: string, key: string): boolean {
  return path === key || path.startsWith(`${key}.`);
}

export function isAssistantSlotSettingsPath(path: string): boolean {
  return matchesSettingsPath(path, ASSISTANT_SLOT_SETTINGS_KEY);
}

export function isAssistantAccountsSettingsPath(path: string): boolean {
  return matchesSettingsPath(path, ASSISTANT_ACCOUNTS_SETTINGS_KEY);
}

export interface Account {
  id: string;
  provider: AllProviderId;
  email: string;
  dbPath?: string | null;
  name?: string;
  nickname?: string;
  avatar?: string;
  avatarPath?: string;
  createdAt?: number;
  lastUsedAt?: number;
  lastSessionUrl?: string | null;
}

export interface SlotAssignment {
  slot: SlotId;
  accountId: string | null;
}

export interface SlotSettings {
  accountId: string | null;
  provider?: ProviderId | null;
  url?: string;
  path?: string;
  messageMethod?: MessageMethod;
  fileMethod?: UploadMethod;
  catchCommands?: boolean;
  disabledCommands?: string[];
  resumeLastSession?: boolean;
  rememberConnectionStatus?: boolean;
  lastConnectionState?: "connected" | "disconnected" | null;
}

export type UploadMethod = "catbox" | "uguu" | "tmpfile" | "googledrive" | "dragdrop" | "injection";

export type MessageMethod = "injection" | "xdotools";

export interface GeneralSettings {
  theme?: "light" | "dark" | "system";
  language?: AppLanguage;
  startMinimized?: boolean;
  closeToTray?: boolean;
  autoUpdate?: boolean;
}

export interface UploadSettings {
  preferredMethod: UploadMethod;
  fallbackMethod?: UploadMethod;
  maxFileSize?: number;
  allowedTypes?: string[];
}

export interface GoogleDriveSettings {
  connected: boolean;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface OpencodeUiModelPreferences {
  hiddenProviders?: string[];
  hiddenModels?: string[];
  favoriteModels?: string[];
  defaultModelKey?: string | null;
  lastSelectedModelKey?: string | null;
}

export interface AppSettings {
  version?: string;
  general?: GeneralSettings;
  user?: {
    nickname?: string;
    avatarPath?: string;
  };
  integrations?: {
    googledrive?: GoogleDriveSettings;
  };
  slots: {
    ai1: SlotSettings;
    ai2: SlotSettings;
    [key: string]: SlotSettings;
  };
  assistantSlot?: SlotSettings;
  accounts: Account[];
  assistantAccounts?: Account[];
  upload?: UploadSettings;
  googleDrive?: GoogleDriveSettings;
  assistants?: {
    preferred?: AssistantProviderId;
    lastConnected?: AssistantProviderId | null;
    resumeLastSession?: boolean;
    keepServersOnAppClose?: boolean;
    lastOpencodeUrl?: string | null;
    lastOpencodeUiSessionId?: string | null;
    lastActiveRelay?: string | null;
    disabledMcpServers?: string[];
    opencode?: {
      // NOTE: Empty or null uses the PATH "opencode" binary.
      binaryPath?: string | null;
      defaultPort?: number;
      version?: string | null;
    };
    opencodeUi?: OpencodeUiModelPreferences;
  };
  logging?: {
    level?: string;
    verboseModules?: string[];
    silentModules?: string[];
    persistLevel?: string;
    maxMemoryLogs?: number;
    enableStateSnapshots?: boolean;
    snapshotInterval?: number;
  };
  [key: string]: unknown;
}

export interface SettingsChangeEvent {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export type SettingsListener = (event: SettingsChangeEvent) => void;
