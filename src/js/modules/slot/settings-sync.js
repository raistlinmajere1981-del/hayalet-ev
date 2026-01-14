/**
 * SettingsSync - Slot ayar senkronizasyonu
 * 
 * Bu modül slot'ların settings değişiklikleriyle senkronizasyonunu yönetir:
 * - Account assignment takibi
 * - Provider config güncelleme
 * - Settings değişiklik handling
 */

import { ProviderRegistry } from "../webview/provider-registry.js";

/**
 * Settings değişikliklerini işle
 * @param {Object} slots - Slot state'leri { ai0: {...}, ai1: {...}, ai2: {...} }
 * @param {Object} settings - Yeni settings objesi
 * @param {string[]} changedPaths - Değişen path'ler
 * @param {Function} syncSlotFn - Slot sync fonksiyonu
 */
export function handleSettingsChange(slots, settings, changedPaths, syncSlotFn) {
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
  if (asistanChanged) {
    syncSlotFn("ai0", settings);
  }
}

/**
 * Tüm slotları settings ile senkronize et
 * @param {Object} slots - Slot state'leri
 * @param {Object} settings - Settings objesi
 * @param {Function} syncSlotFn - Slot sync fonksiyonu
 */
export function syncWithSettings(slots, settings, syncSlotFn) {
  if (!settings) return;
  ["ai0", "ai1", "ai2"].forEach((slot) => {
    syncSlotFn(slot, settings);
  });
}

/**
 * Tek bir slot'u settings ile senkronize et
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID (ai0/ai1/ai2)
 * @param {Object} settings - Settings objesi
 * @param {Object} states - State sabitleri { EMPTY, ASSIGNED, CONNECTED, CONNECTING }
 * @param {Object} events - Event sabitleri { ACCOUNT_ASSIGNED, ACCOUNT_REMOVED }
 * @param {Function} logFn - Log fonksiyonu
 * @param {Function} transitionFn - State transition fonksiyonu
 * @param {Function} emitFn - Event emit fonksiyonu
 * @param {Function} disconnectFn - Disconnect fonksiyonu
 * @param {Function} navigateFn - Navigate fonksiyonu
 */
export function syncSlotWithSettings(
  slotState,
  slot,
  settings,
  states,
  events,
  logFn,
  transitionFn,
  emitFn,
  disconnectFn,
  navigateFn
) {
  // AI0 (Asistan) için asistanSlot ve asistanAccounts kullan
  const isAsistan = slot === "ai0";
  const slotSettings = isAsistan ? settings?.asistanSlot : settings?.slots?.[slot];
  const newAccountId = slotSettings?.accountId || null;
  const oldAccountId = slotState.accountId;

  if (newAccountId === oldAccountId) return;

  logFn(slot, "info", `Account changed: ${oldAccountId} -> ${newAccountId}`);

  if (!newAccountId) {
    if (slotState.state === states.CONNECTED || slotState.state === states.CONNECTING) {
      disconnectFn(slot, { force: true });
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
  const providerConfig = providerId ? ProviderRegistry.get(providerId) : null;

  slotState.accountId = newAccountId;
  slotState.providerId = providerId;
  slotState.providerConfig = providerConfig;

  if (slotState.state === states.CONNECTED) {
    logFn(slot, "info", "Account changed while connected - will navigate to new provider");
    navigateFn(slot);
  } else if (slotState.state === states.EMPTY) {
    transitionFn(slot, states.ASSIGNED);
  }

  emitFn(slot, events.ACCOUNT_ASSIGNED, { accountId: newAccountId, providerId });
}
