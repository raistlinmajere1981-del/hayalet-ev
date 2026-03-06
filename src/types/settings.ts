/**
 * Settings Types - Ayar yapılandırma tipleri
 *
 * @module src/js/types/settings
 */

import type { SlotId, ProviderId, AllProviderId, AsistanProviderId } from "./common.js";

// Account Types

/** Hesap bilgisi */
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

/** Slot-Account eşleştirmesi */
export interface SlotAssignment {
  slot: SlotId;
  accountId: string | null;
}

// Settings Schema Types

/** Slot ayarları */
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

/** Upload method tercihi */
export type UploadMethod = "catbox" | "uguu" | "tmpfile" | "googledrive" | "dragdrop" | "injection";

/** Message method tercihi */
export type MessageMethod = "injection" | "xdotools";

/** Genel ayarlar */
export interface GeneralSettings {
  theme?: "light" | "dark" | "system";
  language?: string;
  startMinimized?: boolean;
  closeToTray?: boolean;
  autoUpdate?: boolean;
}

/** Upload ayarları */
export interface UploadSettings {
  preferredMethod: UploadMethod;
  fallbackMethod?: UploadMethod;
  maxFileSize?: number;
  allowedTypes?: string[];
}

/** Google Drive ayarları */
export interface GoogleDriveSettings {
  connected: boolean;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/** Ana ayar şeması */
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
  asistanSlot?: SlotSettings; // AI0 slot
  accounts: Account[];
  asistanAccounts?: Account[]; // AI0 accounts
  upload?: UploadSettings;
  googleDrive?: GoogleDriveSettings;
  assistants?: {
    preferred?: AsistanProviderId;
    lastConnected?: AsistanProviderId | null;
    resumeLastSession?: boolean;
    keepServersOnAppClose?: boolean;
    lastOpencodeUrl?: string | null;
    lastOpencodeUiSessionId?: string | null;
    lastActiveRelay?: string | null;
    /** Kullanıcının pasif yaptığı MCP sunucu isimleri */
    disabledMcpServers?: string[];
    /** OpenCode server çalışma tercihleri */
    opencode?: {
      /** Boş/null ise PATH'teki `opencode` komutu kullanılır */
      binaryPath?: string | null;
      /** Server için tercih edilen başlangıç portu */
      defaultPort?: number;
      /** Son başarılı binary kontrolden bulunan sürüm */
      version?: string | null;
    };
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
  [key: string]: unknown; // Ek alanlar için
}

// Settings Events

/** Ayar değişiklik event'i */
export interface SettingsChangeEvent {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

/** Ayar listener callback */
export type SettingsListener = (event: SettingsChangeEvent) => void;
