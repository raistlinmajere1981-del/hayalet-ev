/**
 * URL Utilities - centralized URL processing helpers
 *
 * Collects URL helpers that were previously duplicated across
 * slot-controller, webview-manager, traffic-manager, and app.js.
 *
 * Note: isSlotUrlExcluded is the central solution for slot-aware URL checks.
 * Modules should use it instead of local wrapper helpers.
 */

import { ProviderRegistry } from "../../provider-registry.js";
import { AppState } from "../../../app-state.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Normalize a URL by removing the query string, hash, and trailing slash.
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
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
 * Check whether the URL is the provider's default page.
 * Default page = same as baseUrl, optionally with a trailing slash.
 * Examples: chatgpt.com, chatgpt.com/, grok.com, gemini.google.com
 * @param {string} url - URL to check
 * @param {string} providerId - Provider ID (chatgpt, grok, gemini)
 * @returns {boolean} - Whether the URL is a default page
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
 * Check whether the URL appears in the exclusion list.
 * @param {string} url - URL to check
 * @param {string[]} excludedUrls - Excluded URL list (supports wildcards)
 * @returns {boolean} - Whether the URL is excluded
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
 * Slot-aware URL exclusion check (central function)
 *
 * Use this instead of repeated isUrlExcluded wrappers across modules.
 * It resolves the provider config automatically.
 *
 * @param {string} providerSlot - Slot ID (ai0, ai1, ai2)
 * @param {string} url - URL to check
 * @returns {boolean} - Whether the URL is excluded
 *
 * @example
 * // Old usage (repeated in each module):
 * // const providerId = AppState.getProviderIdForSlot(slot);
 * // const cfg = ProviderRegistry.get(providerId);
 * // return checkUrlExcluded(url, cfg.excludedUrls);
 *
 * // New usage (centralized):
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
