/**
 * Scraper Helper Functions
 * 
 * Bu modül scraper'lar için ortak yardımcı fonksiyonları içerir.
 * Scraper'lar webview'a toString() ile inject edildiği için,
 * bu fonksiyonlar her scraper içinde inline olarak tanımlanmalıdır.
 * 
 * Bu dosya "tek kaynak" (single source of truth) olarak kullanılır:
 * - Scraper'lar bu fonksiyonları kopyalayıp kendi içlerinde tanımlar
 * - Değişiklik gerektiğinde sadece bu dosya güncellenir ve scraper'lara kopyalanır
 * 
 * NOT: Bu fonksiyonlar doğrudan import edilmez, referans olarak kullanılır.
 * Webview injection sınırlaması nedeniyle her scraper kendi kopyasını içermelidir.
 */

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Metin normalizasyonu - hash tutarlılığı için
 * 
 * @param str - Normalize edilecek metin
 * @returns Normalize edilmiş metin
 * 
 * İşlemler:
 * - Windows line endings (\r\n) → Unix (\n)
 * - Old Mac line endings (\r) → Unix (\n)
 * - Multiple spaces/tabs → single space
 * - Spaces around newlines → just newline
 * - 3+ newlines → 2 newlines
 * - Leading/trailing whitespace trim
 */
export function normalizeText(str: string): string {
  if (!str) return "";
  return str
    .replace(/\r\n/g, "\n")           // Windows line endings → Unix
    .replace(/\r/g, "\n")             // Old Mac line endings → Unix
    .replace(/[\t ]+/g, " ")          // Multiple spaces/tabs → single space
    .replace(/ *\n */g, "\n")         // Spaces around newlines → just newline
    .replace(/\n{3,}/g, "\n\n")       // 3+ newlines → 2 newlines
    .trim();                          // Leading/trailing whitespace
}

// ============================================================================
// Hash Function (djb2 algorithm)
// ============================================================================

/**
 * Hash fonksiyonu (djb2 algoritması)
 * 
 * @param str - Hash'lenecek metin
 * @returns Hexadecimal hash string
 * 
 * NOT: Fonksiyon içinde normalizeText çağrılır.
 * Bu, hash tutarlılığı için gereklidir - aynı içerik
 * farklı whitespace ile geldiğinde aynı hash'i üretir.
 */
export function hashString(str: string): string {
  if (!str) return "0";
  // Normalize before hashing for consistency
  const normalized = normalizeText(str);
  if (!normalized) return "0";
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit integer
  }
  return hash.toString(16);
}
