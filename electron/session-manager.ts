/**
 * Session Manager - Electron session/cache yönetimi
 *
 * Uygulama açılışında cache temizliği yapar.
 * Login bilgilerini (cookies, localStorage) korur.
 *
 * @module electron/session-manager
 */

import { session } from "electron";

interface ClearResult {
  success: boolean;
  cleared: string[];
  error?: string;
}

interface ClearAllResult {
  success: boolean;
  error?: string;
}

// Yönetilen partition'lar
const PARTITIONS = {
  MAIN: "persist:main", // AI1 + AI2 paylaşımlı
  ASISTAN: "persist:ai0", // Asistan - izole
} as const;

// Temizlenecek storage türleri (login bilgileri HARİÇ)
const CLEARABLE_STORAGES: ("cachestorage" | "serviceworkers")[] = [
  "cachestorage", // Service worker cache (~100-300 MB)
  "serviceworkers", // SW registrations
];

/**
 * Belirli bir partition için cache temizliği yapar.
 * Cookies ve localStorage'a DOKUNMAZ.
 */
async function clearPartitionCache(partitionName: string): Promise<ClearResult> {
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
    console.error(`[session-manager] Cache temizleme hatası (${partitionName}):`, (error as Error).message);

    return {
      success: false,
      cleared: [],
      error: (error as Error).message,
    };
  }
}

/**
 * Tüm partition'lar için startup cache temizliği yapar.
 * Uygulama açılışında çağrılır.
 */
export async function clearStartupCache(): Promise<{ main: ClearResult; asistan: ClearResult }> {
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
 */
async function _clearAllSessionData(partitionName: string): Promise<ClearAllResult> {
  try {
    const ses = session.fromPartition(partitionName);

    // Tüm storage'ları temizle (cookies dahil)
    await ses.clearStorageData();
    await ses.clearCache();
    await ses.clearAuthCache();

    console.log(`[session-manager] Tüm session verisi silindi: ${partitionName}`);

    return { success: true };
  } catch (error) {
    console.error(`[session-manager] Session silme hatası (${partitionName}):`, (error as Error).message);

    return { success: false, error: (error as Error).message };
  }
}

/**
 * Session Manager'ı export et
 */
export const SessionManager = {
  PARTITIONS,
  clearStartupCache,
  clearPartitionCache,
};
