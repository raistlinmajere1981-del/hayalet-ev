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
 * @param {Object} slots - Slot state'leri { ai1: {...}, ai2: {...} }
 * @param {Object} settings - Yeni settings objesi
 * @param {string[]} changedPaths - Değişen path'ler
 * @param {Function} syncSlotFn - Slot sync fonksiyonu
 */
export function handleSettingsChange(slots, settings, changedPaths, syncSlotFn) {
  if (!settings) return;

  ["ai1", "ai2"].forEach((slot) => {
    const slotPath = `slots.${slot}.accountId`;
    const accountChanged = changedPaths.includes("*") || 
                          changedPaths.some((p) => p === slotPath || p.startsWith("accounts"));

    if (accountChanged) {
      syncSlotFn(slot, settings);
    }
  });
}

/**
 * Tüm slotları settings ile senkronize et
 * @param {Object} slots - Slot state'leri
 * @param {Object} settings - Settings objesi
 * @param {Function} syncSlotFn - Slot sync fonksiyonu
 */
export function syncWithSettings(slots, settings, syncSlotFn) {
  if (!settings) return;
  ["ai1", "ai2"].forEach((slot) => {
    syncSlotFn(slot, settings);
  });
}

/**
 * Tek bir slot'u settings ile senkronize et
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID (ai1/ai2)
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
  const slotSettings = settings?.slots?.[slot];
  const newAccountId = slotSettings?.accountId || null;
  const oldAccountId = slotState.accountId;

  // Account değişikliği yoksa skip
  if (newAccountId === oldAccountId) return;

  logFn(slot, "info", `Account changed: ${oldAccountId} -> ${newAccountId}`);

  // Account kaldırıldı
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

  // Yeni account atandı veya değişti
  const account = settings.accounts?.find((a) => a.id === newAccountId);
  const providerId = account?.provider || null;
  const providerConfig = providerId ? ProviderRegistry.get(providerId) : null;

  slotState.accountId = newAccountId;
  slotState.providerId = providerId;
  slotState.providerConfig = providerConfig;

  // Eğer connected ise yeni account için reconnect gerekebilir
  if (slotState.state === states.CONNECTED) {
    logFn(slot, "info", "Account changed while connected - will navigate to new provider");
    navigateFn(slot);
  } else if (slotState.state === states.EMPTY) {
    transitionFn(slot, states.ASSIGNED);
  }

  emitFn(slot, events.ACCOUNT_ASSIGNED, { accountId: newAccountId, providerId });
}
