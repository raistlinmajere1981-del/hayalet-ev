/**
 * Shared Limit Constants
 *
 * Merkezi limit/boyut sabitleri — tüm katmanlar (renderer, electron, mcp) buradan import eder.
 * @limits alias ile erişilir.
 */

/** Slot state machine geçmiş (history) maksimum kayıt sayısı */
export const MAX_HISTORY_SIZE = 50;

/** Entrance report log paneli maksimum log satır sayısı (terminal/genel) */
export const MAX_LOGS_TERMINAL = 100;

/** Entrance live overlay maksimum log satır sayısı (server log akışı) */
export const MAX_LOGS_SERVER = 50;

/** Analyze sayfası sanal liste — aynı anda görüntülenen mesaj sayısı */
export const VISIBLE_MESSAGE_COUNT = 50;

/** Analyze sayfası sanal liste — mesaj yükseklik tahmini (px) */
export const MESSAGE_HEIGHT_ESTIMATE = 80;

/** Log writer — chunk başına maksimum satır sayısı */
export const MAX_CHUNK_LINES = 10000;
