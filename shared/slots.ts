/**
 * Shared Slot & Session Constants
 *
 * Slot kimlik sabitleri ve Electron session partition isimleri.
 * @slots alias ile erişilir.
 */

/** Renderer AI slot kimlikleri */
export const SLOTS = { AI1: "ai1", AI2: "ai2" } as const;

/** Asistan (AI0) slot kimliği */
export const ASISTAN_SLOT = "ai0";

/** AI-Asistan relay protokol anahtarı */
export const PROTOCOL_KEY = "AI-asistan";

/** Electron persist session partition isimleri */
export const PARTITIONS = {
  MAIN: "persist:main", // AI1 + AI2 paylaşımlı
  ASISTAN: "persist:ai0", // Asistan - izole
} as const;
