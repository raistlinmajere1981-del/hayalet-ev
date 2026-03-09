import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

async function loadProviderConfig(providerId: string): Promise<Record<string, unknown>> {
  const moduleUrl = new URL(
    `../../src/js/modules/webview/providers/${providerId}/config.ts`,
    import.meta.url
  ).href;
  const mod = (await import(moduleUrl)) as { config?: Record<string, unknown> };
  assert.ok(mod.config, `provider config should exist for ${providerId}`);
  return mod.config;
}

test("provider configs declare ui language strategies", async () => {
  const providers = ["chatgpt", "gemini", "grok", "opencode", "opencode-ui"];

  for (const providerId of providers) {
    const config = await loadProviderConfig(providerId);
    const strategy = config["uiLanguage"] as Record<string, unknown> | undefined;

    assert.ok(strategy, `${providerId} should expose uiLanguage metadata`);
    assert.match(String(strategy?.["support"] ?? ""), /^(supported|partial|unsupported)$/);
    assert.match(String(strategy?.["syncMode"] ?? ""), /^(automatic|manual|not-applicable)$/);
    assert.ok(Array.isArray(strategy?.["supportedLocales"]));
  }
});

test("selector locale consumers use shared resolveSelectorLanguage helper", () => {
  const files = [
    "src/js/modules/webview/message-sender.ts",
    "src/js/modules/traffic/probe-script-builder.ts",
    "src/js/modules/webview/methods/shared/runtime-selectors.ts",
    "electron/provider-tester/selector-evidence.ts",
  ];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    assert.match(source, /resolveSelectorLanguage/);
  }
});

test("app bootstrap initializes renderer i18n from settings", () => {
  const source = readFileSync("src/js/app/index.ts", "utf8");

  assert.match(source, /await AppI18n\.bootstrap\(SettingsManager\)/);
  assert.match(source, /AppI18n\.t\("app\.startup\.loadingSettings"\)/);
});
