/**
 * TimeoutHandler - Slot timeout ve hata yönetimi
 * 
 * Bu modül slot işlemlerinin timeout ve hata durumlarını yönetir:
 * - Timeout başlatma/temizleme
 * - Bağlantı hatası yönetimi
 * - Hata sonrası temizlik
 */

/**
 * Timeout'ları saklamak için map
 */
const timeouts = {};

/**
 * Timeout başlat
 * @param {string} slot - Slot ID
 * @param {string} operation - İşlem adı (connect, etc.)
 * @param {number} ms - Timeout süresi (ms)
 * @param {Function} callback - Timeout olduğunda çağrılacak fonksiyon
 */
export function startTimeout(slot, operation, ms, callback) {
  const key = `${slot}-${operation}`;
  clearTimeout(slot, operation);
  timeouts[key] = setTimeout(callback, ms);
}

/**
 * Timeout'u temizle
 * @param {string} slot - Slot ID
 * @param {string} operation - İşlem adı
 */
export function clearTimeout(slot, operation) {
  const key = `${slot}-${operation}`;
  if (timeouts[key]) {
    globalThis.clearTimeout(timeouts[key]);
    delete timeouts[key];
  }
}

/**
 * Bağlantı timeout'unu işle
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID
 * @param {string} correlationId - İşlem correlation ID
 * @param {string} errorState - ERROR state değeri
 * @param {Function} logFn - Log fonksiyonu
 * @param {Function} emitFn - Event emit fonksiyonu
 * @param {Function} transitionFn - State transition fonksiyonu
 * @param {string} connectFailedEvent - CONNECT_FAILED event adı
 * @param {Function} cleanupFn - Cleanup fonksiyonu
 */
export function handleConnectTimeout(
  slotState,
  slot,
  correlationId,
  errorState,
  logFn,
  emitFn,
  transitionFn,
  connectFailedEvent,
  cleanupFn
) {
  logFn(slot, "error", "Connection timeout", { correlationId });
  
  slotState.error = new Error("Connection timeout");
  emitFn(slot, connectFailedEvent, { correlationId, error: "timeout" });
  
  cleanupFn(slot, correlationId);
  transitionFn(slot, errorState);
}

/**
 * Bağlantı hatasını işle
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID
 * @param {string} correlationId - İşlem correlation ID
 * @param {Error} error - Hata objesi
 * @param {string} errorState - ERROR state değeri
 * @param {Function} logFn - Log fonksiyonu
 * @param {Function} emitFn - Event emit fonksiyonu
 * @param {Function} transitionFn - State transition fonksiyonu
 * @param {string} connectFailedEvent - CONNECT_FAILED event adı
 * @param {Function} cleanupFn - Cleanup fonksiyonu
 * @returns {{ success: boolean, message: string, correlationId: string }}
 */
export function handleConnectError(
  slotState,
  slot,
  correlationId,
  error,
  errorState,
  logFn,
  emitFn,
  transitionFn,
  connectFailedEvent,
  cleanupFn
) {
  logFn(slot, "error", `Connection failed: ${error.message}`, { correlationId });
  
  slotState.error = error;
  emitFn(slot, connectFailedEvent, { correlationId, error: error.message });
  
  cleanupFn(slot, correlationId);
  transitionFn(slot, errorState);
  
  return { success: false, message: error.message, correlationId };
}

/**
 * Hata sonrası temizlik yap
 * @param {Object} slotState - Slot state objesi
 * @param {string} slot - Slot ID
 * @param {string} correlationId - İşlem correlation ID
 * @param {Function} logFn - Log fonksiyonu
 * @param {Function} clearUrlChangeHandlerFn - URL change handler temizleme fonksiyonu
 * @param {Function} clearDomReadyHandlerFn - DOM ready handler temizleme fonksiyonu
 * @param {Function} stopTrafficFn - Traffic durdurma fonksiyonu
 * @param {Function} detachWebviewFn - Webview detach fonksiyonu
 */
export async function cleanupAfterError(
  slotState,
  slot,
  correlationId,
  logFn,
  clearUrlChangeHandlerFn,
  clearDomReadyHandlerFn,
  stopTrafficFn,
  detachWebviewFn
) {
  try {
    clearUrlChangeHandlerFn(slot);
    clearDomReadyHandlerFn(slot);
    
    if (slotState.trafficStarted) {
      await stopTrafficFn(slot, correlationId);
    }
    
    if (slotState.webview) {
      await detachWebviewFn(slot, correlationId);
    }
    
    slotState.domReady = false;
    slotState.trafficStarted = false;
  } catch (err) {
    logFn(slot, "warning", `Cleanup warning: ${err.message}`, { correlationId });
  }
}
