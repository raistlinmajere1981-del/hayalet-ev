/**
 * Settings Types - Ayar yapılandırma tipleri
 * 
 * @module src/js/types/settings
 */

import type { SlotId, ProviderId } from "./common.js";

// ============================================================================
// Account Types
// ============================================================================

/** Hesap bilgisi */
export interface Account {
  id: string;
  provider: ProviderId;
  email: string;
  name?: string;
  avatar?: string;
  createdAt?: number;
  lastUsedAt?: number;
}

/** Slot-Account eşleştirmesi */
export interface SlotAssignment {
  slot: SlotId;
  accountId: string | null;
}

// ============================================================================
// Settings Schema Types
// ============================================================================

/** Slot ayarları */
export interface SlotSettings {
  accountId: string | null;
  provider: ProviderId | null;
  url?: string;
  path?: string;
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
  slots: {
    ai1: SlotSettings;
    ai2: SlotSettings;
  };
  accounts: Account[];
  upload?: UploadSettings;
  googleDrive?: GoogleDriveSettings;
  [key: string]: unknown; // Ek alanlar için
}

// ============================================================================
// Settings Events
// ============================================================================

/** Ayar değişiklik event'i */
export interface SettingsChangeEvent {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

/** Ayar listener callback */
export type SettingsListener = (event: SettingsChangeEvent) => void;
