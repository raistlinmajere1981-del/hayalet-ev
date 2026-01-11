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
