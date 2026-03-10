/**
 * Provider Tester - Scraping & Response Tests
 *
 * Tests for message scraping, stop button during response,
 * and message container validation.
 *
 * @module electron/provider-tester/scraping-tests
 */

import type { ProviderTestResult } from "../../src/types/provider.ts";
import type { TestContext, MessageScrapingResult } from "./types.ts";
import { PROVIDER_TEST } from "./types.ts";

/**
 * Run all response/scraping tests
 */
export async function runScrapingTests(ctx: TestContext): Promise<ProviderTestResult[]> {
  const results: ProviderTestResult[] = [];

  results.push(await testStopButton(ctx));
  results.push(await testAssistantMessageScraping(ctx));
  results.push(await testMessageContainer(ctx));

  return results;
}

/**
 * Run advanced tests (voice button, etc.)
 */
export async function runAdvancedTests(ctx: TestContext): Promise<ProviderTestResult[]> {
  const results: ProviderTestResult[] = [];

  if (ctx.config.selectors.voiceButton !== undefined && ctx.config.selectors.voiceButton !== "") {
    results.push(await testVoiceButton(ctx));
  }

  return results;
}

export async function testStopButton(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  try {
    const visible = await ctx.waitForCondition(async () => {
      return await ctx.isElementVisible(ctx.config.selectors.stopButton);
    }, PROVIDER_TEST.TIMEOUT_STOP_BUTTON);

    if (visible) {
      return {
        id: "stop-button",
        name: await ctx.t("scraping.stopButton.name"),
        category: "scraping",
        status: "pass",
        message: await ctx.t("scraping.stopButton.visible"),
        details: { selector: ctx.config.selectors.stopButton },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    return {
      id: "stop-button",
      name: await ctx.t("scraping.stopButton.name"),
      category: "scraping",
      status: "skip",
      message: await ctx.t("scraping.stopButton.skippedFastResponse"),
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      id: "stop-button",
      name: await ctx.t("scraping.stopButton.name"),
      category: "scraping",
      status: "warning",
      message: await ctx.t("scraping.stopButton.notDetected"),
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

export async function testAssistantMessageScraping(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  try {
    const selector =
      ctx.config.scrapeSelectors.assistantWrapper ?? ctx.config.scrapeSelectors.preferred;
    const hasResponse = await ctx.waitForCondition(async () => {
      const count = (await ctx.executeScript(
        "(function() {" +
          "  const selector = " +
          JSON.stringify(selector) +
          ";" +
          "  return document.querySelectorAll(selector).length;" +
          "})()"
      )) as number;
      return count > 0;
    }, PROVIDER_TEST.TIMEOUT_RESPONSE_WAIT);

    if (!hasResponse) throw new Error(await ctx.t("scraping.assistantMessage.noResponse"));

    const script =
      "(function() {" +
      "  const assistantSelector = " +
      JSON.stringify(selector) +
      ";" +
      "  const messages = Array.from(document.querySelectorAll(assistantSelector));" +
      "  const lastMessage = messages[messages.length - 1];" +
      "  if (!lastMessage) throw new Error(" +
      JSON.stringify(await ctx.t("scraping.assistantMessage.noAssistantMessage")) +
      ");" +
      '  const text = lastMessage.textContent || lastMessage.innerText || "";' +
      "  return { found: true, text: text.trim().slice(0, 100) };" +
      "})()";

    const result = (await ctx.executeScript(script)) as MessageScrapingResult;

    if (result.found === true && result.text !== undefined && result.text.length > 0) {
      return {
        id: "assistant-message-scraping",
        name: await ctx.t("scraping.assistantMessage.name"),
        category: "scraping",
        status: "pass",
        message: await ctx.t("scraping.assistantMessage.scraped"),
        details: {
          ...(ctx.config.scrapeSelectors.assistantWrapper !== undefined &&
          ctx.config.scrapeSelectors.assistantWrapper !== ""
            ? { selector: ctx.config.scrapeSelectors.assistantWrapper }
            : {}),
          element: { tagName: "div", visible: true, enabled: true, textContent: result.text },
        },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    throw new Error(await ctx.t("scraping.assistantMessage.empty"));
  } catch (error) {
    return {
      id: "assistant-message-scraping",
      name: await ctx.t("scraping.assistantMessage.name"),
      category: "scraping",
      status: "fail",
      message: await ctx.t("scraping.assistantMessage.failed"),
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

export async function testMessageContainer(ctx: TestContext): Promise<ProviderTestResult> {
  return await ctx.testSelector({
    id: "message-container",
    name: await ctx.t("scraping.messageContainer.name"),
    selector: ctx.config.selectors.messageContainer,
    category: "scraping",
    checks: ["exists", "visible"],
  });
}

export async function testVoiceButton(ctx: TestContext): Promise<ProviderTestResult> {
  if (ctx.config.selectors.voiceButton === undefined || ctx.config.selectors.voiceButton === "") {
    return ctx.createSkipResult(
      "voice-button",
      await ctx.t("scraping.voiceButton.name"),
      "advanced",
      await ctx.t("scraping.voiceButton.selectorMissing")
    );
  }
  return await ctx.testSelector({
    id: "voice-button",
    name: await ctx.t("scraping.voiceButton.name"),
    selector: ctx.config.selectors.voiceButton,
    category: "advanced",
    checks: ["exists", "visible"],
  });
}
