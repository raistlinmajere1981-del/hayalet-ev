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
 * İki URL'in aynı olup olmadığını kontrol et (normalized comparison)
 * @param {string} url1 - İlk URL
 * @param {string} url2 - İkinci URL
 * @returns {boolean} - URL'ler eşit mi?
 */
export function areUrlsEqual(url1, url2) {
  return normalizeUrl(url1) === normalizeUrl(url2);
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

    // Wildcard desteği
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

/**
 * URL'den domain çıkar
 * @param {string} url - URL
 * @returns {string} - Domain (hostname)
 */
export function extractDomain(url) {
  if (!url) return "";
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // URL parse edilemezse basit regex ile dene
    const match = url.match(/^(?:https?:\/\/)?([^/:]+)/);
    return match ? match[1] : "";
  }
}

/**
 * URL'in belirli bir domain'e ait olup olmadığını kontrol et
 * @param {string} url - Kontrol edilecek URL
 * @param {string} domain - Domain
 * @returns {boolean}
 */
export function isUrlFromDomain(url, domain) {
  if (!url || !domain) return false;
  const urlDomain = extractDomain(url);
  return urlDomain === domain || urlDomain.endsWith(`.${domain}`);
}
