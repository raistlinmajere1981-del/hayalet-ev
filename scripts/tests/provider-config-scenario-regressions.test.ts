import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { config as chatgptConfig } from "../../src/js/modules/webview/providers/chatgpt/config.ts";
import { config as geminiConfig } from "../../src/js/modules/webview/providers/gemini/config.ts";
import { config as grokConfig } from "../../src/js/modules/webview/providers/grok/config.ts";
import { config as opencodeConfig } from "../../src/js/modules/webview/providers/opencode/config.ts";
import { config as opencodeUiConfig } from "../../src/js/modules/webview/providers/opencode-ui/config.ts";

const configs = [chatgptConfig, geminiConfig, grokConfig, opencodeConfig, opencodeUiConfig];

test("provider configs expose webview-test scenario metadata", () => {
  for (const config of configs) {
    assert.ok(config.scenarios, `${config.id} should define scenarios`);
    assert.ok(config.scenarios.webviewTest, `${config.id} should define webviewTest`);
    assert.equal(config.scenarios.webviewTest.id, "webview-test");
    assert.ok(
      config.scenarios.webviewTest.steps.length >= 5,
      `${config.id} should seed webview-test steps`
    );
  }
});

test("webview-test scenario steps keep stable preset actions", () => {
  const scenario = chatgptConfig.scenarios.webviewTest;

  assert.deepEqual(
    scenario.steps.slice(0, 4).map((step) => [step.id, step.action]),
    [
      ["reset-default-page", "navigate-default"],
      ["disabled-send", "assert-disabled-send"],
      ["drag-drop-surface", "assert-drag-drop-surface"],
      ["inject-message", "inject-prompt"],
    ]
  );
});

test("provider config scenario imports stay compatible with tsconfig typecheck", () => {
  const configFiles = [
    "chatgpt/config.ts",
    "gemini/config.ts",
    "grok/config.ts",
    "opencode/config.ts",
    "opencode-ui/config.ts",
  ];

  for (const file of configFiles) {
    const source = fs.readFileSync(
      new URL(`../../src/js/modules/webview/providers/${file}`, import.meta.url),
      "utf8"
    );

    assert.match(
      source,
      /from "\.\.\/shared\/scenarios\.ts";/,
      `${file} should import shared scenarios with a .ts extension`
    );
  }
});

test("chatgpt, grok, and gemini expose a webview-sync scenario scaffold", () => {
  const syncConfigs = [chatgptConfig, geminiConfig, grokConfig];

  for (const config of syncConfigs) {
    assert.ok(config.scenarios.webviewSync, `${config.id} should define webviewSync`);
    assert.equal(config.scenarios.webviewSync.id, "webview-sync");
    assert.deepEqual(
      config.scenarios.webviewSync.steps.map((step) => step.action),
      ["open-sidebar", "collect-session-urls", "open-session-urls", "report"]
    );
    assert.ok(config.webviewSync, `${config.id} should define webviewSync selectors`);
    assert.ok(config.webviewSync.sidebar.openButtonSelectors.length > 0);
    assert.ok(config.webviewSync.history.itemSelectors.length > 0);
    assert.ok(config.webviewSync.history.titleSelectors.length > 0);
  }
});

test("gemini marks webview-sync DOM selectors as estimated until real captures arrive", () => {
  assert.equal(geminiConfig.webviewSync.readiness, "estimated");
  assert.equal(chatgptConfig.webviewSync.readiness, "verified");
  assert.equal(grokConfig.webviewSync.readiness, "verified");
});
