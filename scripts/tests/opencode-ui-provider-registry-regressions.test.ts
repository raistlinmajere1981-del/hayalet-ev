import assert from "node:assert/strict";
import test from "node:test";

import { getProvider } from "../../src/js/modules/webview/provider-factory.ts";
import { ProviderRegistry } from "../../src/js/modules/webview/provider-registry.ts";

test("provider-registry includes opencode-ui in asistan provider ids", () => {
  const asistanIds = ProviderRegistry.getAsistanIds();

  assert.ok(asistanIds.includes("opencode-ui"));
  assert.ok(ProviderRegistry.getAllAnyIds().includes("opencode-ui"));

  const providerConfig = ProviderRegistry.getAsistan("opencode-ui");

  assert.ok(providerConfig, "Expected opencode-ui provider config to be registered");
  assert.equal(providerConfig.id, "opencode-ui");
  assert.equal(providerConfig.isAsistan, true);
});

test("provider-factory exposes opencode-ui module with send methods", () => {
  const providerModule = getProvider("opencode-ui");

  assert.ok(providerModule, "Expected opencode-ui provider module to be registered");
  assert.equal(typeof providerModule.sendMessage, "function");
  assert.equal(typeof providerModule.sendMessage_xdotools, "function");
  assert.equal(typeof providerModule.attachFiles_injection, "function");
});
