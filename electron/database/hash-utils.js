/**
 * Hash Utils - Mesaj içerik hash'i oluşturma
 * 
 * Incremental sync için content hash karşılaştırması yapılır.
 * djb2 algoritması kullanılır - hızlı ve collision oranı düşük.
 */

/**
 * String'den hash oluştur (djb2 algoritması)
 * @param {string} str - Hash'lenecek string
 * @returns {string} - Hex formatında hash
 */
export function hashString(str) {
  if (!str) return "0";
  
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  return hash.toString(16);
}

/**
 * Mesaj için benzersiz ID oluştur
 * @param {string} prefix - ID prefix'i (conv, msg, att)
 * @returns {string} - Benzersiz ID
 */
export function generateId(prefix = "id") {
  const timestamp = Date.now();
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Conversation ID oluştur
 * @param {number} sequence - Sıra numarası
 * @returns {string}
 */
export function generateConversationId(sequence) {
  const padded = String(sequence).padStart(4, "0");
  return `conv-${padded}`;
}

/**
 * Message ID oluştur
 * @returns {string}
 */
export function generateMessageId() {
  return generateId("msg");
}

/**
 * Attachment ID oluştur
 * @returns {string}
 */
export function generateAttachmentId() {
  return generateId("att");
}
