/**
 * MCP Server - Merkezi Timeout Konfigürasyonu
 * 
 * Tüm timeout değerleri milisaniye (ms) cinsindendir.
 * Minimum timeout: 10 saniye (10000ms)
 * 
 * @version 1.0.0
 */

// ============================================
// CDP (Chrome DevTools Protocol) Timeout'ları
// ============================================

export const CDP_TIMEOUTS = {
  /** Target discovery için HTTP fetch timeout */
  TARGET_DISCOVERY: 10_000,
  
  /** WebSocket bağlantı kurma timeout */
  WEBSOCKET_CONNECT: 10_000,
  
  /** CDP komut varsayılan timeout */
  COMMAND_DEFAULT: 15_000,
  
  /** Page.enable, Runtime.enable gibi hızlı komutlar */
  COMMAND_FAST: 10_000,
  
  /** Screenshot alma (büyük sayfalar için daha uzun) */
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

// ============================================
// Web Tools Timeout'ları
// ============================================

export const WEB_TIMEOUTS = {
  /** SearXNG API arama timeout */
  SEARCH_API: 15_000,
  
  /** Web sayfası fetch timeout */
  PAGE_FETCH: 15_000,
  
  /** URL erişilebilirlik kontrolü */
  URL_CHECK: 10_000,
} as const;

// ============================================
// Filesystem Tools Timeout'ları
// ============================================

export const FS_TIMEOUTS = {
  /** Bash komutu varsayılan timeout */
  BASH_DEFAULT: 60_000,
  
  /** Bash heredoc ile dosya yazma */
  BASH_HEREDOC: 30_000,
} as const;

// ============================================
// Dev Tools Timeout'ları
// ============================================

export const DEV_TIMEOUTS = {
  /** ESLint çalıştırma */
  LINT: 120_000,
  
  /** Test çalıştırma (vitest/jest) */
  TEST: 120_000,
  
  /** Git diff alma */
  GIT_DIFF: 30_000,
  
  /** Proje analizi */
  ANALYZE: 60_000,
} as const;

// ============================================
// Electron Tools Timeout'ları
// ============================================

export const ELECTRON_TIMEOUTS = {
  /** Electron test varsayılan süre */
  TEST_DEFAULT: 10_000,
} as const;

// ============================================
// Yardımcı Fonksiyonlar
// ============================================

/**
 * Timeout değerini saniyeye çevir (log/display için)
 */
export function toSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Timeout değerini insan-okunabilir formata çevir
 */
export function formatTimeout(ms: number): string {
  if (ms >= 60_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = (ms % 60_000) / 1000;
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${ms / 1000}s`;
}

/**
 * Tüm timeout'ları listele (debug için)
 */
export function getAllTimeouts(): Record<string, Record<string, number>> {
  return {
    CDP: { ...CDP_TIMEOUTS },
    WEB: { ...WEB_TIMEOUTS },
    FS: { ...FS_TIMEOUTS },
    DEV: { ...DEV_TIMEOUTS },
    ELECTRON: { ...ELECTRON_TIMEOUTS },
  };
}
