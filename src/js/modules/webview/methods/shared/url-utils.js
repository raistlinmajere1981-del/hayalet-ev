/**
 * URL Utilities - Merkezi URL işleme fonksiyonları
 * 
 * Bu modül daha önce farklı dosyalarda (slot-controller, webview-manager, traffic-manager, app.js)
 * tekrarlanan URL fonksiyonlarını tek bir yerde toplar.
 */

/**
 * URL'i normalize et (query string ve hash kaldır, trailing slash temizle)
 * @param {string} url - Normalize edilecek URL
 * @returns {string} - Normalize edilmiş URL
 */
export function normalizeUrl(url) {
  if (!url) return "";
  return url.split("?")[0].split("#")[0].replace(/\/+$/, "");
}

/**
 * URL'in exclude listesinde olup olmadığını kontrol et
 * @param {string} url - Kontrol edilecek URL
 * @param {string[]} excludedUrls - Exclude edilmiş URL listesi (wildcard destekler)
 * @returns {boolean} - URL exclude edilmiş mi?
 */
export function isUrlExcluded(url, excludedUrls) {
  if (!url || !excludedUrls?.length) return false;

  const normalizedUrl = normalizeUrl(url);

  for (const excluded of excludedUrls) {
    const normalizedExcluded = normalizeUrl(excluded);

    if (excluded.includes("*")) {
      const pattern = normalizedExcluded.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(normalizedUrl)) return true;
    } else {
      if (normalizedUrl === normalizedExcluded) return true;
    }
  }

  return false;
}

