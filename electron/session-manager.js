/**
 * Session Manager - Electron session/cache yönetimi
 *
 * Uygulama açılışında cache temizliği yapar.
 * Login bilgilerini (cookies, localStorage) korur.
 *
 * @module electron/session-manager
 */

import { session } from "electron";

// Yönetilen partition'lar
const PARTITIONS = {
  MAIN: "persist:main", // AI1 + AI2 paylaşımlı
  ASISTAN: "persist:ai0", // Asistan - izole
};

// Temizlenecek storage türleri (login bilgileri HARİÇ)
const CLEARABLE_STORAGES = [
  "cachestorage", // Service worker cache (~100-300 MB)
  "serviceworkers", // SW registrations
];

/**
 * Belirli bir partition için cache temizliği yapar.
 * Cookies ve localStorage'a DOKUNMAZ.
 *
 * @param {string} partitionName - Partition adı (örn: "persist:main")
 * @returns {Promise<{success: boolean, cleared: string[], error?: string}>}
 */
async function clearPartitionCache(partitionName) {
  try {
    const ses = session.fromPartition(partitionName);

    // Storage temizliği (cookies ve localStorage HARİÇ)
    await ses.clearStorageData({
      storages: CLEARABLE_STORAGES,
    });

    // HTTP cache temizliği
    await ses.clearCache();

    console.log(`[session-manager] Cache temizlendi: ${partitionName}`);

    return {
      success: true,
      cleared: [...CLEARABLE_STORAGES, "httpcache"],
    };
  } catch (error) {
    console.error(`[session-manager] Cache temizleme hatası (${partitionName}):`, error.message);

    return {
      success: false,
      cleared: [],
      error: error.message,
    };
  }
}

/**
 * Tüm partition'lar için startup cache temizliği yapar.
 * Uygulama açılışında çağrılır.
 *
 * @returns {Promise<{main: object, asistan: object}>}
 */
export async function clearStartupCache() {
  console.log("[session-manager] Startup cache temizliği başlıyor...");

  const results = {
    main: await clearPartitionCache(PARTITIONS.MAIN),
    asistan: await clearPartitionCache(PARTITIONS.ASISTAN),
  };

  const totalSuccess = results.main.success && results.asistan.success;

  console.log(
    `[session-manager] Startup cache temizliği ${totalSuccess ? "tamamlandı" : "kısmen başarısız"}`
  );

  return results;
}

/**
 * Belirli bir partition'ın tüm verilerini siler (logout için).
 * DİKKAT: Bu fonksiyon cookies dahil HER ŞEYİ siler!
 *
 * @param {string} partitionName - Partition adı
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function clearAllSessionData(partitionName) {
  try {
    const ses = session.fromPartition(partitionName);

    // Tüm storage'ları temizle (cookies dahil)
    await ses.clearStorageData();
    await ses.clearCache();
    await ses.clearAuthCache();

    LogManager.log("session-manager", "info", `Tüm session verisi silindi: ${partitionName}`);

    return { success: true };
  } catch (error) {
    LogManager.log("session-manager", "error", `Session silme hatası: ${partitionName}`, {
      error: error.message,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Session Manager'ı export et
 */
export const SessionManager = {
  PARTITIONS,
  clearStartupCache,
  clearPartitionCache,
  clearAllSessionData,
};
