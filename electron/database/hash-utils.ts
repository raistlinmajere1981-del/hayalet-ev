/**
 * Hash Utils - Mesaj içerik hash'i oluşturma
 *
 * Incremental sync için content hash karşılaştırması yapılır.
 * djb2 algoritması kullanılır - hızlı ve collision oranı düşük.
 */

/**
 * Text normalization - hash tutarlılığı için
 * Whitespace normalize, line ending fix, trim
 */
export function normalizeText(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/\r\n/g, "\n")           // Windows line endings → Unix
    .replace(/\r/g, "\n")             // Old Mac line endings → Unix
    .replace(/[\t ]+/g, " ")          // Multiple spaces/tabs → single space
    .replace(/ *\n */g, "\n")         // Spaces around newlines → just newline
    .replace(/\n{3,}/g, "\n\n")       // 3+ newlines → 2 newlines
    .trim();                          // Leading/trailing whitespace
}

/**
 * String'den hash oluştur (djb2 algoritması)
 * Text normalize edildikten sonra hash hesaplanır
 */
export function hashString(str: string | null | undefined): string {
  if (!str) return "0";

  // Normalize before hashing for consistency
  const normalized = normalizeText(str);
  if (!normalized) return "0";

  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) + hash + normalized.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  return hash.toString(16);
}

/**
 * Mesaj için benzersiz ID oluştur
 */
export function generateId(prefix: string = "id"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Message ID oluştur
 */
export function generateMessageId(): string {
  return generateId("msg");
}

/**
 * Attachment ID oluştur
 */
export function generateAttachmentId(): string {
  return generateId("att");
}
