/**
 * URL Utilities - Merkezi URL işleme fonksiyonları
 * 
 * Bu modül daha önce farklı dosyalarda (slot-controller, webview-manager, traffic-manager, app.js)
 * tekrarlanan URL fonksiyonlarını tek bir yerde toplar.
 */

import { ProviderRegistry } from "../../provider-registry.js";

/**
 * URL'i normalize et (query string ve hash kaldır, trailing slash temizle)
 * @param {string} url - Normalize edilecek URL
 * @returns {string} - Normalize edilmiş URL
 */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  return url.split("?")[0].split("#")[0].replace(/\/+$/, "");
}

/**
 * URL'in provider'ın default (ana) sayfası olup olmadığını kontrol et
 * Default page = baseUrl ile aynı veya sadece trailing slash farkı olan URL
 * Örn: chatgpt.com, chatgpt.com/, grok.com, gemini.google.com
 * @param {string} url - Kontrol edilecek URL
 * @param {string} providerId - Provider ID (chatgpt, grok, gemini)
 * @returns {boolean} - URL default page mi?
 */
export function isDefaultPage(url: string, providerId: string): boolean {
  if (!url || !providerId) return false;
  
  const config = ProviderRegistry.get(providerId as "opencode" | "chatgpt" | "grok" | "gemini");
  if (!config?.baseUrl) return false;
  
  const normalizedUrl = normalizeUrl(url);
  const normalizedBase = normalizeUrl(config.baseUrl);
  
  // Tam eşleşme kontrolü
  if (normalizedUrl === normalizedBase) return true;
  
  // Bazı provider'lar /app veya benzeri path kullanabilir
  // Örn: gemini.google.com/app
  const configWithPaths = config as { defaultPaths?: string[]; baseUrl: string };
  if (configWithPaths.defaultPaths) {
    for (const path of configWithPaths.defaultPaths) {
      const fullPath = normalizeUrl(`${config.baseUrl}${path}`);
      if (normalizedUrl === fullPath) return true;
    }
  }
  
  return false;
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

