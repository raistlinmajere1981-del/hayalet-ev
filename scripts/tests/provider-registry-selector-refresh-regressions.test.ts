import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("provider registry can replace current-session config entries after promotion", () => {
  const source = readFileSync("src/js/modules/webview/provider-registry.ts", "utf8");

  assert.ok(
    source.includes("update(id: string") || source.includes("update(id,"),
    "ProviderRegistry.update should exist for current-session config refresh"
  );
  assert.ok(
    source.includes("allProviders[id as keyof typeof allProviders] = config") ||
      source.includes("allProviders[id] = config") ||
      source.includes("[id] = record") ||
      source.includes("registry.set(id, config)"),
    "ProviderRegistry.update should replace the cached provider config entry"
  );
});

test("provider test refresh path exposes refreshed config metadata to renderer consumers", () => {
  const providerTypes = readFileSync("src/types/provider.ts", "utf8");
  const ipcHandler = readFileSync("electron/handlers/ipc-provider.ts", "utf8");
  const entrancePanel = readFileSync("src/js/pages/entrance/webview-panel.ts", "utf8");
  const assistantIndex = readFileSync("src/js/pages/assistant/assistant.ts", "utf8");

  assert.ok(
    providerTypes.includes("refreshedConfig?: ProviderConfig"),
    "ProviderTestSuite should expose refreshedConfig for current-session refresh"
  );
  assert.ok(
    ipcHandler.includes("refreshedConfig"),
    "test-provider IPC handler should return refreshedConfig after promotion"
  );
  assert.ok(
    entrancePanel.includes("ProviderRegistry.update("),
    "entrance webview panel should update ProviderRegistry after test promotion"
  );
  assert.ok(
    assistantIndex.includes("ProviderRegistry.update("),
    "assistant page should update ProviderRegistry after test promotion"
  );
});
