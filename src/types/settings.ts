/**
 * Settings Types
 *
 * @module src/js/types/settings
 */

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

// Account Types

/** Account metadata. */
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

/** Slot-to-account mapping. */
export interface SlotAssignment {
  slot: SlotId;
  accountId: string | null;
}

// Settings Schema Types

/** Slot settings. */
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

/** Preferred upload method. */
export type UploadMethod = "catbox" | "uguu" | "tmpfile" | "googledrive" | "dragdrop" | "injection";

/** Preferred message injection method. */
export type MessageMethod = "injection" | "xdotools";

/** Global application settings. */
export interface GeneralSettings {
  theme?: "light" | "dark" | "system";
  language?: AppLanguage;
  startMinimized?: boolean;
  closeToTray?: boolean;
  autoUpdate?: boolean;
}

/** Upload settings. */
export interface UploadSettings {
  preferredMethod: UploadMethod;
  fallbackMethod?: UploadMethod;
  maxFileSize?: number;
  allowedTypes?: string[];
}

/** Google Drive settings. */
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

/** Root application settings schema. */
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
    [key: string]: SlotSettings; // Dynamic slot access
  };
  assistantSlot?: SlotSettings; // AI0 slot
  accounts: Account[];
  assistantAccounts?: Account[]; // AI0 accounts
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
    /** MCP servers disabled by the user. */
    disabledMcpServers?: string[];
    /** OpenCode server startup preferences. */
    opencode?: {
      /** Uses the PATH `opencode` binary when empty or null. */
      binaryPath?: string | null;
      /** Preferred starting port for the server. */
      defaultPort?: number;
      /** Version resolved from the last successful binary probe. */
      version?: string | null;
    };
    /** OpenCode UI model selection preferences. */
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
  [key: string]: unknown; // Additional forward-compatible fields
}

// Settings Events

/** Settings change event. */
export interface SettingsChangeEvent {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

/** Settings listener callback. */
export type SettingsListener = (event: SettingsChangeEvent) => void;
