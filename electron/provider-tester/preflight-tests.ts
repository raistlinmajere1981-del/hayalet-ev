/**
 * Provider Tester - Preflight Tests
 *
 * Navigation and URL validation before running actual tests.
 *
 * @module electron/provider-tester/preflight-tests
 */

import type { ProviderTestResult } from "../../src/types/provider.ts";
import type { TestContext } from "./types.ts";
/**
 * Check if current URL is in excluded list (login/auth pages)
 */
export function testExcludedUrl(ctx: TestContext): ProviderTestResult {
  const start = Date.now();
  const currentUrl = ctx.webview.getURL();

  const isExcluded = ctx.config.excludedUrls.some((pattern: string) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(currentUrl);
    }
    return currentUrl.startsWith(pattern);
  });

  if (isExcluded) {
    return {
      id: "excluded-url-check",
      name: "Excluded URL Check",
      category: "preflight",
      status: "fail",
      message: `Current page is excluded (login/auth page)`,
      details: { selector: currentUrl, error: "URL in excludedUrls list" },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }

  return {
    id: "excluded-url-check",
    name: "Excluded URL Check",
    category: "preflight",
    status: "pass",
    message: "Page is valid for testing",
    details: { selector: currentUrl },
    duration: Date.now() - start,
    timestamp: Date.now(),
  };
}
