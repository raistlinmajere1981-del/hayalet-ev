/**
 * Hash Utils - Mesaj içerik hash'i oluşturma
 *
 * Incremental sync için content hash karşılaştırması yapılır.
 * djb2 algoritması kullanılır - hızlı ve collision oranı düşük.
 */

/**
 * String'den hash oluştur (djb2 algoritması)
 */
export function hashString(str: string | null | undefined): string {
  if (!str) return "0";

  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
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
