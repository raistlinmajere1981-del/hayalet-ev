/**
 * Provider Test Suite - End-to-end DOM selector testing
 *
 * Orchestrates preflight, DOM, interactive, scraping, and advanced tests
 * for AI provider webview pages.
 *
 * @module electron/provider-tester
 */

import type {
  ProviderConfig,
  ProviderTestSuite,
  ProviderTestResult,
} from "../../src/types/provider.ts";

import type { WebviewTag, TestContext } from "./types.ts";
import {
  createExecuteScript,
  createClickElement,
  createIsElementVisible,
  waitForCondition,
  createSkipResult,
  createTestSelector,
} from "./utils.ts";
import { testExcludedUrl } from "./preflight-tests.ts";
import { runDOMTests } from "./dom-tests.ts";
import { runInteractiveTests } from "./interactive-tests.ts";
import { runScrapingTests, runAdvancedTests } from "./scraping-tests.ts";

export class ProviderTester {
  private webview: WebviewTag;
  private config: ProviderConfig;
  private slot: "ai1" | "ai2";
  private results: ProviderTestResult[] = [];
  private startTime: number = 0;
  private aborted: boolean = false;
  private ctx: TestContext;

  constructor(webview: WebviewTag, config: ProviderConfig, slot: "ai1" | "ai2") {
    this.webview = webview;
    this.config = config;
    this.slot = slot;

    // Build shared test context
    const executeScript = createExecuteScript(webview);
    this.ctx = {
      webview,
      config,
      executeScript,
      clickElement: createClickElement(executeScript),
      isElementVisible: createIsElementVisible(executeScript),
      waitForCondition,
      createSkipResult,
      testSelector: createTestSelector(executeScript),
    };
  }

  async runTestSuite(): Promise<ProviderTestSuite> {
    this.startTime = Date.now();
    this.results = [];
    this.aborted = false;

    const preflightOk = this.runPreflightChecks();
    if (!preflightOk) {
      return this.generateReport(true);
    }

    // DOM tests
    const domResults = await runDOMTests(this.ctx);
    this.results.push(...domResults);

    // Interactive tests
    const interactiveResult = await runInteractiveTests(this.ctx);
    this.results.push(...interactiveResult.results);
    if (interactiveResult.aborted) {
      this.aborted = true;
    }

    // Scraping/Response tests
    if (!this.aborted) {
      const scrapingResults = await runScrapingTests(this.ctx);
      this.results.push(...scrapingResults);
    }

    // Advanced tests
    if (!this.aborted) {
      const advancedResults = await runAdvancedTests(this.ctx);
      this.results.push(...advancedResults);
    }

    return this.generateReport(false);
  }

  private runPreflightChecks(): boolean {
    const urlCheckResult = testExcludedUrl(this.ctx);
    this.results.push(urlCheckResult);
    if (urlCheckResult.status === "fail") {
      this.aborted = true;
      return false;
    }

    return true;
  }

  private generateReport(aborted: boolean): ProviderTestSuite {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.status === "pass").length;
    const failed = this.results.filter((r) => r.status === "fail").length;
    const skipped = this.results.filter((r) => r.status === "skip").length;
    const warnings = this.results.filter((r) => r.status === "warning").length;
    const firstFailureMessage = this.results.find((r) => r.status === "fail")?.message;

    return {
      providerId: this.config.id,
      providerName: this.config.name,
      slot: this.slot,
      url: this.webview.getURL(),
      timestamp: this.startTime,
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      warnings,
      totalDuration,
      results: this.results,
      aborted,
      ...(aborted && firstFailureMessage !== undefined ? { abortReason: firstFailureMessage } : {}),
    };
  }
}
