/**
 * Dosya işlemleri için utility fonksiyonları
 */

/**
 * Dosya yolundan extension çıkar
 * @param {string} filePath - Dosya yolu
 * @returns {string} Extension (lowercase, noktasız)
 */
export function getExtension(filePath) {
  if (!filePath) return "";
  return filePath.split(".").pop()?.toLowerCase() || "";
}

/**
 * Dosya yolundan dosya adını çıkar
 * @param {string} filePath - Dosya yolu
 * @returns {string} Dosya adı
 */
export function getFilename(filePath) {
  if (!filePath) return "";
  return filePath.split(/[/\\]/).pop() || "";
}

/**
 * Extension'dan MIME type belirle
 * @param {string} ext - Extension (png, jpg, etc.)
 * @returns {string} MIME type
 */
export function getMimeType(ext) {
  const mimeTypes = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
    pdf: "application/pdf",
    txt: "text/plain",
    json: "application/json",
    js: "text/javascript",
    css: "text/css",
    html: "text/html",
    xml: "application/xml",
    zip: "application/zip",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    wav: "audio/wav",
  };
  return mimeTypes[ext?.toLowerCase()] || "application/octet-stream";
}

/**
 * Dosya yolundan MIME type belirle
 * @param {string} filePath - Dosya yolu
 * @returns {string} MIME type
 */
export function getMimeTypeFromPath(filePath) {
  const ext = getExtension(filePath);
  return getMimeType(ext);
}

/**
 * Benzersiz ID oluştur
 * @param {string} prefix - ID prefix'i (örn: "cmd", "relay", "whisper")
 * @returns {string} Benzersiz ID
 */
export function generateUniqueId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Email adresini dosya/klasör adı için güvenli formata çevir
 * @param {string} email - Email adresi
 * @returns {string} Sanitized email (örn: "user_at_gmail_com")
 */
export function sanitizeEmail(email) {
  if (!email) return "";
  return email
    .toLowerCase()
    .trim()
    .replace(/@/g, "_at_")
    .replace(/\./g, "_");
}

/**
 * Email ve provider'dan deterministik account ID oluştur.
 * Aynı email+provider her zaman aynı ID'yi üretir.
 * @param {string} email - Kullanıcı email adresi
 * @param {string} provider - AI provider (chatgpt, grok, gemini, opencode)
 * @returns {string} Account ID (örn: "chatgpt_user_at_gmail_com")
 */
export function generateAccountId(email, provider) {
  if (!email || !provider) return "";
  return `${provider}_${sanitizeEmail(email)}`;
}

/**
 * Account ID'den data klasör yolunu oluştur.
 * @param {string} accountId - Account ID
 * @returns {string} Klasör yolu (örn: "data/chatgpt_user_at_gmail_com")
 */
export function getAccountDataPath(accountId) {
  if (!accountId) return "";
  return `data/${accountId}`;
}

/**
 * Base64 string'i UTF-8 text'e decode et
 * @param {string} base64 - Base64 encoded string
 * @returns {string} Decoded UTF-8 text
 */
export function decodeBase64(base64) {
  if (!base64) return "";
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  } catch (_err) {
    return "";
  }
}
