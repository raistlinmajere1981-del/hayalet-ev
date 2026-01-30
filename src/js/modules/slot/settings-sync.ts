/**
 * SettingsSync - Slot ayar senkronizasyonu
 * 
 * Bu modül slot'ların settings değişiklikleriyle senkronizasyonunu yönetir:
 * - Account assignment takibi
 * - Provider config güncelleme
 * - Settings değişiklik handling
 */

import { ProviderRegistry } from "../webview/provider-registry.js";
import type { SlotId, LogLevel } from "../../types/index.js";
import type { BaseProviderConfig } from "../../types/provider.js";

// ============================================================================
// Types
// ============================================================================

interface SlotState {
  accountId: string | null;
  providerId: string | null;
  providerConfig: BaseProviderConfig | null;
  state: string;
}

interface SlotSettings {
  accountId?: string;
}

interface Account {
  id: string;
  provider?: string;
}

interface Settings {
  slots?: Record<string, SlotSettings>;
  accounts?: Account[];
  asistanSlot?: SlotSettings;
  asistanAccounts?: Account[];
}

interface SlotStates {
  EMPTY: string;
  ASSIGNED: string;
  CONNECTED: string;
  CONNECTING: string;
}

interface SlotEvents {
  ACCOUNT_ASSIGNED: string;
  ACCOUNT_REMOVED: string;
}

type LogFn = (slot: SlotId | string, level: LogLevel, message: string) => void;
type TransitionFn = (slot: string, state: string) => void;
type EmitFn = (slot: string, event: string, data: Record<string, unknown>) => void;
type DisconnectFn = (slot: string, opts?: { force?: boolean }) => void | Promise<unknown>;
type NavigateFn = (slot: string) => void;
type SyncSlotFn = (slot: string, settings: Settings) => void;

// ============================================================================
// Functions
// ============================================================================

/**
 * Settings değişikliklerini işle
 */
export function handleSettingsChange(
  _slots: Record<string, SlotState>,
  settings: Settings | null,
  changedPaths: string[],
  syncSlotFn: SyncSlotFn
): void {
  if (!settings) return;

  // AI1 ve AI2 için normal slot settings kontrolü
  ["ai1", "ai2"].forEach((slot) => {
    const slotPath = `slots.${slot}.accountId`;
    const accountChanged = changedPaths.includes("*") || 
                          changedPaths.some((p) => p === slotPath || p.startsWith("accounts"));

    if (accountChanged) {
      syncSlotFn(slot, settings);
    }
  });

  // AI0 (Asistan) için asistanSlot kontrolü
  const asistanChanged = changedPaths.includes("*") || 
                         changedPaths.some((p) => p.startsWith("asistanSlot") || p.startsWith("asistanAccounts"));
  if (asistanChanged && settings) {
    syncSlotFn("ai0", settings);
  }
}

/**
 * Tüm slotları settings ile senkronize et
 */
export function syncWithSettings(
  _slots: Record<string, SlotState>,
  settings: Settings | null,
  syncSlotFn: SyncSlotFn
): void {
  if (!settings) return;
  ["ai0", "ai1", "ai2"].forEach((slot) => {
    syncSlotFn(slot, settings);
  });
}

/**
 * Tek bir slot'u settings ile senkronize et
 */
export function syncSlotWithSettings(
  slotState: SlotState,
  slot: string,
  settings: Settings | null,
  states: SlotStates,
  events: SlotEvents,
  logFn: LogFn,
  transitionFn: TransitionFn,
  emitFn: EmitFn,
  disconnectFn: DisconnectFn,
  navigateFn: NavigateFn
): void {
  if (!settings) return;

  // AI0 (Asistan) için asistanSlot ve asistanAccounts kullan
  const isAsistan = slot === "ai0";
  const slotSettings = isAsistan ? settings.asistanSlot : settings.slots?.[slot];
  const newAccountId = slotSettings?.accountId || null;
  const oldAccountId = slotState.accountId;

  if (newAccountId === oldAccountId) return;

  logFn(slot as SlotId, "info", `Account changed: ${oldAccountId} -> ${newAccountId}`);

  if (!newAccountId) {
    // Sadece CONNECTED veya CONNECTING durumunda disconnect çağır
    // ASSIGNED veya EMPTY durumunda disconnect gereksiz ve hata üretir
    if (slotState.state === states.CONNECTED || slotState.state === states.CONNECTING) {
      disconnectFn(slot, { force: true });
    }
    
    // Zaten EMPTY durumundaysa sadece cleanup yap
    if (slotState.state === states.EMPTY) {
      slotState.accountId = null;
      slotState.providerId = null;
      slotState.providerConfig = null;
      return;
    }
    
    slotState.accountId = null;
    slotState.providerId = null;
    slotState.providerConfig = null;
    transitionFn(slot, states.EMPTY);
    emitFn(slot, events.ACCOUNT_REMOVED, { oldAccountId });
    return;
  }

  // Asistan için asistanAccounts, diğerleri için accounts kullan
  const accountList = isAsistan ? settings.asistanAccounts : settings.accounts;
  const account = accountList?.find((a) => a.id === newAccountId);
  const providerId = account?.provider || null;
  const providerConfig = providerId 
    ? ProviderRegistry.get(providerId as "opencode" | "chatgpt" | "grok" | "gemini") as BaseProviderConfig | null
    : null;

  slotState.accountId = newAccountId;
  slotState.providerId = providerId;
  slotState.providerConfig = providerConfig;

  if (slotState.state === states.CONNECTED) {
    logFn(slot as SlotId, "info", "Account changed while connected - will navigate to new provider");
    navigateFn(slot);
  } else if (slotState.state === states.EMPTY) {
    transitionFn(slot, states.ASSIGNED);
  }

  emitFn(slot, events.ACCOUNT_ASSIGNED, { accountId: newAccountId, providerId });
}
