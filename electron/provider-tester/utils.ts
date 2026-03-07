/**
 * Provider Tester - Utility Functions
 *
 * Shared helpers used by all test modules.
 *
 * @module electron/provider-tester/utils
 */

import type { ProviderTestResult, TestCategory } from "../../src/types/provider.ts";

import type { WebviewTag, ElementCheckResult, SelectorTestOptions } from "./types.ts";

/**
 * Execute JavaScript in webview context
 */
export function createExecuteScript(webview: WebviewTag): (script: string) => Promise<unknown> {
  return async (script: string): Promise<unknown> => {
    return await webview.executeJavaScript(script);
  };
}

/**
 * Click an element by selector
 */
export function createClickElement(executeScript: (script: string) => Promise<unknown>) {
  return async (selector: string): Promise<boolean> => {
    const result = await executeScript(
      "(function() {" +
        "  const el = document.querySelector(" +
        JSON.stringify(selector) +
        ");" +
        "  if (!el) return false;" +
        "  el.click();" +
        "  return true;" +
        "})()"
    );
    return result as boolean;
  };
}

/**
 * Check if an element is visible
 */
export function createIsElementVisible(executeScript: (script: string) => Promise<unknown>) {
  return async (selector: string): Promise<boolean> => {
    const result = await executeScript(
      "(function() {" +
        "  const el = document.querySelector(" +
        JSON.stringify(selector) +
        ");" +
        "  if (!el) return false;" +
        "  const styles = window.getComputedStyle(el);" +
        '  return styles.display !== "none" && styles.visibility !== "hidden";' +
        "})()"
    );
    return result as boolean;
  };
}

/**
 * Wait for a condition to become true
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number
): Promise<boolean> {
  const start = Date.now();
  const poll = async (): Promise<boolean> => {
    if (Date.now() - start >= timeout) return false;
    const ok = await condition();
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return await poll();
  };
  return await poll();
}

/**
 * Create a skip result
 */
export function createSkipResult(
  id: string,
  name: string,
  category: TestCategory,
  reason: string
): ProviderTestResult {
  return {
    id,
    name,
    category,
    status: "skip",
    message: reason,
    duration: 0,
    timestamp: Date.now(),
  };
}

/**
 * Generic selector test
 */
export function createTestSelector(executeScript: (script: string) => Promise<unknown>) {
  return async (opts: SelectorTestOptions): Promise<ProviderTestResult> => {
    const start = Date.now();

    const selectors =
      Array.isArray(opts.selectorCandidates) && opts.selectorCandidates.length > 0
        ? opts.selectorCandidates
        : [opts.selector];

    const inspectSelector = async (
      selector: string
    ): Promise<ElementCheckResult & { matchedSelector: string }> => {
      const script =
        "(function() {" +
        "  const el = document.querySelector(" +
        JSON.stringify(selector) +
        ");" +
        "  if (!el) return { exists: false, matchedSelector: " +
        JSON.stringify(selector) +
        " };" +
        "  const styles = window.getComputedStyle(el);" +
        '  const isVisible = styles.display !== "none" && styles.visibility !== "hidden" && styles.opacity !== "0";' +
        '  const isDisabled = el.disabled || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";' +
        '  const isEditable = el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "INPUT";' +
        "  return {" +
        "    exists: true," +
        "    visible: isVisible," +
        "    enabled: !isDisabled," +
        "    disabled: isDisabled," +
        "    editable: isEditable," +
        "    tagName: el.tagName," +
        '    textContent: (el.textContent || "").slice(0, 50),' +
        "    matchedSelector: " +
        JSON.stringify(selector) +
        "  };" +
        "})()";

      return (await executeScript(script)) as ElementCheckResult & { matchedSelector: string };
    };

    const findFirstMatchingSelector = async (
      candidates: string[],
      index = 0
    ): Promise<(ElementCheckResult & { matchedSelector: string }) | null> => {
      const selector = candidates[index];
      if (selector === undefined) {
        return null;
      }

      const candidate = await inspectSelector(selector);
      if (candidate.exists) {
        return candidate;
      }

      return await findFirstMatchingSelector(candidates, index + 1);
    };

    try {
      let result = await findFirstMatchingSelector(selectors);
      if (result === null && selectors.length > 0) {
        const lastSelector = selectors[selectors.length - 1];
        if (lastSelector !== undefined) {
          result = await inspectSelector(lastSelector);
        }
      }

      if (result === null) {
        throw new Error("No selector candidates provided");
      }

      const failedChecks = opts.checks.filter(
        (check) => result[check as keyof ElementCheckResult] !== true
      );

      const details = {
        selector: result.matchedSelector,
        ...(opts.evidence !== undefined
          ? {
              selectorEvidence: {
                ...opts.evidence,
                selector: result.matchedSelector,
              },
            }
          : {}),
        element: result,
      };

      if (failedChecks.length === 0) {
        return {
          id: opts.id,
          name: opts.name,
          category: opts.category,
          status: "pass",
          message: `All checks passed: ${opts.checks.join(", ")}`,
          details,
          duration: Date.now() - start,
          timestamp: Date.now(),
        };
      }

      return {
        id: opts.id,
        name: opts.name,
        category: opts.category,
        status: "fail",
        message: `Failed checks: ${failedChecks.join(", ")}`,
        details,
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        id: opts.id,
        name: opts.name,
        category: opts.category,
        status: "fail",
        message: "Element not found or script error",
        details: { selector: opts.selector, error: (error as Error).message },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }
  };
}
