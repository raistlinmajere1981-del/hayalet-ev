/**
 * URL Utilities - Merkezi URL işleme fonksiyonları
 *
 * Bu modül daha önce farklı dosyalarda (slot-controller, webview-manager, traffic-manager, app.js)
 * tekrarlanan URL fonksiyonlarını tek bir yerde toplar.
 *
 * NOT: isSlotUrlExcluded fonksiyonu slot-aware URL kontrolü için merkezi çözümdür.
 * Tüm modüller kendi wrapper metodları yerine bu fonksiyonu kullanmalıdır.
 */

import { ProviderRegistry } from "../../provider-registry.js";
import { AppState } from "../../../app-state.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * URL'i normalize et (query string ve hash kaldır, trailing slash temizle)
 * @param {string} url - Normalize edilecek URL
 * @returns {string} - Normalize edilmiş URL
 */
export function normalizeUrl(url: string): string {
  if (url === "") return "";
  const parts = url.split("?");
  const beforeQuery = parts[0];
  if (beforeQuery === undefined || beforeQuery === "") return "";
  const hashParts = beforeQuery.split("#");
  const beforeHash = hashParts[0];
  if (beforeHash === undefined || beforeHash === "") return "";
  return beforeHash.replace(/\/+$/, "");
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
  if (url === "" || providerId === "") return false;

  const config = ProviderRegistry.get(providerId);
  if (!isRecord(config)) return false;
  const baseUrl = typeof config["baseUrl"] === "string" ? config["baseUrl"] : "";
  if (baseUrl === "") return false;

  const normalizedUrl = normalizeUrl(url);
  const normalizedBase = normalizeUrl(baseUrl);

  if (normalizedUrl === normalizedBase) return true;

  const configWithPaths = config as { defaultPaths?: string[]; baseUrl: string };
  if (configWithPaths.defaultPaths) {
    for (const path of configWithPaths.defaultPaths) {
      const fullPath = normalizeUrl(`${String(config["baseUrl"])}${path}`);
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
export function isUrlExcluded(url: string, excludedUrls: string[]): boolean {
  if (url === "" || excludedUrls.length === 0) return false;

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

/**
 * Slot-aware URL exclusion kontrolü (MERKEZİ FONKSİYON)
 *
 * Bu fonksiyon tüm modüllerde tekrar eden isUrlExcluded wrapper metodlarının
 * yerine kullanılmalıdır. Provider config'i otomatik olarak çözer.
 *
 * @param {string} providerSlot - Slot ID (ai0, ai1, ai2)
 * @param {string} url - Kontrol edilecek URL
 * @returns {boolean} - URL excluded mı?
 *
 * @example
 * // Eski kullanım (her modülde tekrar):
 * // const providerId = AppState.getProviderIdForSlot(slot);
 * // const cfg = ProviderRegistry.get(providerId);
 * // return checkUrlExcluded(url, cfg.excludedUrls);
 *
 * // Yeni kullanım (merkezi):
 * import { isSlotUrlExcluded } from "./url-utils.js";
 * if (isSlotUrlExcluded("ai1", currentUrl)) return;
 */
export function isSlotUrlExcluded(providerSlot: string, url: string): boolean {
  if (providerSlot === "" || url === "") return false;

  const providerId = AppState.getProviderIdForSlot(providerSlot);
  if (providerId === null || providerId === "") return false;

  const cfg = ProviderRegistry.get(providerId);
  if (!isRecord(cfg)) return false;
  const excludedUrls = cfg["excludedUrls"];
  if (!Array.isArray(excludedUrls) || excludedUrls.length === 0) return false;

  return isUrlExcluded(url, excludedUrls as string[]);
}
