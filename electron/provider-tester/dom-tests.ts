/**
 * Provider Tester - DOM Tests
 *
 * Static DOM element existence and visibility checks.
 *
 * @module electron/provider-tester/dom-tests
 */

import type { ProviderTestResult } from "../../src/types/provider.ts";
import type { TestContext, SelectorCheckResult } from "./types.ts";

/**
 * Run all DOM tests
 */
export async function runDOMTests(ctx: TestContext): Promise<ProviderTestResult[]> {
  const results: ProviderTestResult[] = [];

  results.push(await testInputField(ctx));
  results.push(await testAttachButton(ctx));
  results.push(await testFileInput(ctx));
  results.push(await testUploadTarget(ctx));
  results.push(await testCriticalSelectors(ctx));

  return results;
}

export async function testInputField(ctx: TestContext): Promise<ProviderTestResult> {
  return await ctx.testSelector({
    id: "input-field",
    name: "Input Field Accessibility",
    selector: ctx.config.selectors.inputField,
    category: "dom",
    checks: ["exists", "visible", "editable"],
  });
}

export async function testAttachButton(ctx: TestContext): Promise<ProviderTestResult> {
  if (ctx.config.selectors.attachButton === undefined || ctx.config.selectors.attachButton === "") {
    return ctx.createSkipResult(
      "attach-button",
      "Attach Button",
      "dom",
      "No attachButton selector in config"
    );
  }
  return await ctx.testSelector({
    id: "attach-button",
    name: "Attach Button",
    selector: ctx.config.selectors.attachButton,
    category: "dom",
    checks: ["exists", "visible"],
  });
}

export async function testFileInput(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  if (ctx.config.fileInputSelectors.length === 0) {
    return ctx.createSkipResult(
      "file-input",
      "File Input",
      "dom",
      "No fileInputSelectors in config"
    );
  }

  try {
    const checks = await Promise.all(
      ctx.config.fileInputSelectors.map(async (selector) => {
        const exists = (await ctx.executeScript(
          `(function() { return !!document.querySelector(${JSON.stringify(selector)}); })()`
        )) as boolean;
        return { selector, exists };
      })
    );
    const found = checks.find((item) => item.exists);
    if (found !== undefined) {
      return {
        id: "file-input",
        name: "File Input",
        category: "dom",
        status: "pass",
        message: "File input found",
        details: { selector: found.selector },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    return {
      id: "file-input",
      name: "File Input",
      category: "dom",
      status: "fail",
      message: "No file input found",
      details: { selector: ctx.config.fileInputSelectors.join(", ") },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      id: "file-input",
      name: "File Input",
      category: "dom",
      status: "fail",
      message: "File input test failed",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

export async function testUploadTarget(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  if (ctx.config.uploadTargetSelectors.length === 0) {
    return ctx.createSkipResult(
      "upload-target",
      "Upload Target",
      "dom",
      "No uploadTargetSelectors in config"
    );
  }

  try {
    const checks = await Promise.all(
      ctx.config.uploadTargetSelectors.map(async (selector) => {
        const exists = (await ctx.executeScript(
          `(function() { return !!document.querySelector(${JSON.stringify(selector)}); })()`
        )) as boolean;
        return { selector, exists };
      })
    );
    const found = checks.find((item) => item.exists);
    if (found !== undefined) {
      return {
        id: "upload-target",
        name: "Upload Target (Drag & Drop)",
        category: "dom",
        status: "pass",
        message: "Upload target found",
        details: { selector: found.selector },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    return {
      id: "upload-target",
      name: "Upload Target (Drag & Drop)",
      category: "dom",
      status: "warning",
      message: "No upload target found",
      details: { selector: ctx.config.uploadTargetSelectors.join(", ") },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      id: "upload-target",
      name: "Upload Target (Drag & Drop)",
      category: "dom",
      status: "fail",
      message: "Upload target test failed",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

export async function testCriticalSelectors(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  if (ctx.config.criticalSelectors.length === 0) {
    return ctx.createSkipResult(
      "critical-selectors",
      "Critical Selectors",
      "dom",
      "No criticalSelectors in config"
    );
  }

  try {
    const results = await Promise.all(
      ctx.config.criticalSelectors.map(async (selector: string) => {
        const exists = (await ctx.executeScript(
          `(function() { return !!document.querySelector(${JSON.stringify(selector)}); })()`
        )) as boolean;
        return { selector, exists };
      })
    );

    const failed = results.filter((r: SelectorCheckResult) => !r.exists);

    if (failed.length === 0) {
      return {
        id: "critical-selectors",
        name: "Critical Selectors",
        category: "dom",
        status: "pass",
        message: `All ${results.length} critical selectors found`,
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    return {
      id: "critical-selectors",
      name: "Critical Selectors",
      category: "dom",
      status: "warning",
      message: `${failed.length}/${results.length} critical selectors not found`,
      details: { selector: failed.map((f: SelectorCheckResult) => f.selector).join(", ") },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      id: "critical-selectors",
      name: "Critical Selectors",
      category: "dom",
      status: "fail",
      message: "Critical selectors test failed",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}
