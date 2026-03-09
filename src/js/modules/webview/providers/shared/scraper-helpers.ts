/**
 * Scraper Helper Functions
 *
 * Shared helper functions for scrapers.
 * Because scrapers are injected into the webview via `toString()`,
 * these functions must be defined inline inside each scraper.
 *
 * This file is used as the single source of truth:
 * - scrapers copy these functions into their own body
 * - when changes are needed, update this file and propagate them to the scrapers
 *
 * Note: these functions are not imported directly; they are used as references.
 * Due to webview injection constraints, each scraper must keep its own copy.
 */

/**
 * Normalize text for hash consistency.
 *
 * @param str - Text to normalize
 * @returns Normalized text
 *
 * Operations:
 * - Windows line endings (\r\n) → Unix (\n)
 * - Old Mac line endings (\r) → Unix (\n)
 * - Multiple spaces/tabs → single space
 * - Spaces around newlines → just newline
 * - 3+ newlines → 2 newlines
 * - Leading/trailing whitespace trim
 */
export function normalizeText(str: string): string {
  if (str === "") return "";
  return str
    .replace(/\r\n/g, "\n") // Windows line endings → Unix
    .replace(/\r/g, "\n") // Old Mac line endings → Unix
    .replace(/[\t ]+/g, " ") // Multiple spaces/tabs → single space
    .replace(/ *\n */g, "\n") // Spaces around newlines → just newline
    .replace(/\n{3,}/g, "\n\n") // 3+ newlines → 2 newlines
    .trim(); // Leading/trailing whitespace
}

/**
 * Hash function (djb2 algorithm)
 *
 * @param str - Text to hash
 * @returns Hexadecimal hash string
 *
 * Note: normalizeText is called inside the function.
 * This preserves hash consistency so equivalent content with different
 * whitespace still yields the same hash.
 */
export function hashString(str: string): string {
  if (str === "") return "0";
  const normalized = normalizeText(str);
  if (normalized === "") return "0";
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) + hash + normalized.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit integer
  }
  return hash.toString(16);
}
