/**
 * shared/timeouts.ts
 *
 * Proje geneli merkezi timeout/interval/delay sabitleri.
 * Tüm katmanlar (renderer, electron, mcp-server, ghost-agent) bu dosyadan import eder.
 *
 * Import:
 *   import { TIMEOUTS, DELAYS, CDP_TIMEOUTS } from "@timeouts";
 *
 * Tüm değerler milisaniye (ms) cinsindendir.
 */

// ============================================================
// RENDERER — UI / Webview Timeout'ları
// ============================================================

export const TIMEOUTS = {
  /** DOM hazır olana kadar bekleme (Asistan bağlantısı) */
  DOM_READY: 30_000,
  /** Slot bağlantı timeout */
  CONNECTION: 30_000,
  /** AI yanıt bekleme süresi */
  RESPONSE_WAIT: 120_000,
  /** Send butonu etkinleşmesi için bekleme */
  SEND_ENABLED: 4_000,
  /** Thinking cooldown süresi */
  THINKING_COOLDOWN: 5_000,
  /** Thinking deadline */
  THINKING_DEADLINE: 45_000,
  /** Webview yüklenme timeout */
  WEBVIEW_LOAD: 10_000,
  /** İnaktif webview temizleme aralığı (10 dakika) */
  CLEANUP_INTERVAL: 10 * 60 * 1_000,
} as const;

export const INTERVALS = {
  /** Standart polling aralığı */
  POLL: 1_000,
  /** Hızlı polling aralığı */
  POLL_FAST: 100,
  /** Minimum polling aralığı */
  POLL_MIN: 250,
  /** State snapshot aralığı */
  STATE_SNAPSHOT: 60_000,
  /** Otomatik scroll kontrol aralığı */
  AUTO_SCROLL: 300,
  /** Backoff maksimum değeri */
  BACKOFF_MAX: 16_000,
  /** Thinking state polling aralığı */
  THINKING_TICK: 400,
} as const;

export const DELAYS = {
  /** İlk bekleme süresi */
  INITIAL_WAIT: 1_500,
  /** Yeniden deneme gecikmesi */
  RETRY: 500,
  /** UI güncelleme gecikmesi */
  UI_UPDATE: 100,
  /** Debounce gecikmesi */
  DEBOUNCE: 300,
  /** Loading/thinking just-ended state temizleme gecikmesi */
  STATE_CLEAR: 1_500,
} as const;

// ============================================================
// GHOST AGENT — Provider Readiness Timeout'ları
// ============================================================

export const GHOST_TIMEOUTS = {
  /** Provider hazır olana kadar maksimum bekleme */
  PROVIDER_READY: 90_000,
  /** Provider readiness polling aralığı */
  PROVIDER_READY_POLL: 200,
  /** Stable URL bekleme süresi */
  PROVIDER_READY_STABLE_URL: 1_500,
  /** Ghost-agent kapanış öncesi bekleme */
  EXIT_WAIT: 500,
  /** Log duplikasyon penceresi */
  LOG_DUPLICATE_WINDOW: 400,
} as const;

// ============================================================
// ELECTRON — Server Manager / Provider Tester
// ============================================================

export const SERVER_TIMEOUTS = {
  /** Server başlatma sonrası stabilizasyon bekleme */
  STARTUP_SETTLE: 200,
  /** OpenCode binary --version probe timeout */
  BINARY_PROBE: 8_000,
} as const;

export const PROVIDER_TEST_TIMEOUTS = {
  /** DOM test timeout */
  DOM_TEST: 3_000,
  /** Mesaj gönderme timeout */
  SEND_MESSAGE: 8_000,
  /** Yanıt bekleme timeout */
  RESPONSE_WAIT: 15_000,
  /** Stop butonu timeout */
  STOP_BUTTON: 500,
  /** Toplam test timeout */
  TOTAL: 60_000,
  /** Yeniden deneme gecikmesi */
  RETRY_DELAY: 500,
} as const;

// ============================================================
// ASISTAN — Connect Flow / Overlay Timeout'ları
// ============================================================

export const ASISTAN_TIMEOUTS = {
  /** Overlay aşaması geçiş gecikmesi (kısa) */
  STAGE_TRANSITION_SHORT: 800,
  /** Overlay aşaması geçiş gecikmesi (orta) */
  STAGE_TRANSITION_MID: 1_000,
  /** Overlay aşaması geçiş gecikmesi (uzun) */
  STAGE_TRANSITION_LONG: 1_500,
  /** Conversation-syncer bekle */
  CONVERSATION_SYNC: 2_000,
  /** Lifecycle-manager navigate bekleme */
  NAVIGATE_SETTLE: 100,
  /** Loading tracker debounce */
  LOADING_TRACKER_DEBOUNCE: 10,
  /** Conversation list mikro-gecikme */
  CONVERSATION_LIST_MICRO: 0,
} as const;

export const WHISPER_TIMEOUTS = {
  /** Whisper kontrol aralığı (60 saniye) */
  CHECK_INTERVAL: 60 * 1_000,
} as const;

// ============================================================
// MCP SERVER — CDP (Chrome DevTools Protocol)
// ============================================================

export const CDP_TIMEOUTS = {
  /** Target discovery için HTTP fetch timeout */
  TARGET_DISCOVERY: 10_000,
  /** WebSocket bağlantı kurma timeout */
  WEBSOCKET_CONNECT: 10_000,
  /** CDP komut varsayılan timeout */
  COMMAND_DEFAULT: 15_000,
  /** Page.enable, Runtime.enable gibi hızlı komutlar */
  COMMAND_FAST: 10_000,
  /** Screenshot alma */
  SCREENSHOT: 15_000,
  /** DOM yapısı alma */
  DOM_STRUCTURE: 15_000,
  /** Element bulma ve tıklama */
  ELEMENT_INTERACTION: 10_000,
  /** Sayfa scroll */
  SCROLL: 10_000,
  /** Klavye input */
  KEYBOARD: 10_000,
} as const;

// ============================================================
// MCP SERVER — Web Tools
// ============================================================

export const WEB_TIMEOUTS = {
  /** SearXNG API arama timeout */
  SEARCH_API: 15_000,
  /** Web sayfası fetch timeout */
  PAGE_FETCH: 15_000,
  /** URL erişilebilirlik kontrolü */
  URL_CHECK: 10_000,
} as const;

// ============================================================
// MCP SERVER — Filesystem Tools
// ============================================================

export const FS_TIMEOUTS = {
  /** Bash komutu varsayılan timeout */
  BASH_DEFAULT: 10_000,
  /** Bash heredoc ile dosya yazma */
  BASH_HEREDOC: 30_000,
} as const;

// ============================================================
// MCP SERVER — Dev Tools
// ============================================================

export const DEV_TIMEOUTS = {
  /** ESLint çalıştırma */
  LINT: 120_000,
  /** ESLint batch fix */
  LINT_BATCH_FIX: 900_000,
  /** Test çalıştırma (vitest/jest) */
  TEST: 120_000,
  /** Git diff alma */
  GIT_DIFF: 30_000,
  /** Proje analizi */
  ANALYZE: 60_000,
  /** TypeScript check */
  TYPESCRIPT_CHECK: 60_000,
} as const;

// ============================================================
// MCP SERVER — Electron Tools
// ============================================================

export const ELECTRON_TIMEOUTS = {
  /** Electron test varsayılan süre */
  TEST_DEFAULT: 10_000,
} as const;

// ============================================================
// Yardımcı Fonksiyonlar
// ============================================================

/**
 * Timeout değerini insan-okunabilir formata çevir
 * @example formatTimeout(90000) => "1m 30s"
 */
export function formatTimeout(ms: number): string {
  if (ms >= 60_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = (ms % 60_000) / 1_000;
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${ms / 1_000}s`;
}
