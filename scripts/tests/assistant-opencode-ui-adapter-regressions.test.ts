import assert from "node:assert/strict";
import test from "node:test";

import { getAdapter, getAdapterIds } from "../../src/js/pages/assistant/provider-registry.ts";

type TestWindow = {
  electronAPI?: Record<string, unknown>;
};

function setWindow(api: Record<string, unknown>): void {
  (globalThis as unknown as { window: TestWindow }).window = {
    electronAPI: api,
  };
}

test("assistant provider-registry registers opencode-ui adapter", () => {
  const adapterIds = getAdapterIds();
  assert.ok(adapterIds.includes("opencode-ui"));
});

test("opencode-ui adapter routes to native opencode-ui page path", async () => {
  let startCalled = 0;
  setWindow({
    opencodeServeFindRunning: async () => ({ running: false }),
    opencodeServeFindPort: async () => ({ port: 4096 }),
    opencodeServeStart: async () => {
      startCalled += 1;
      return { success: true, url: "http://127.0.0.1:4096/", port: 4096 };
    },
  });

  const adapter = getAdapter("opencode-ui");
  assert.ok(adapter, "Expected opencode-ui adapter to be registered");

  const result = await adapter.startServer("auto");
  assert.equal(result.success, true);
  assert.equal(result.url, "/pages/opencode-ui.html?port=4096");
  assert.equal(startCalled, 1);
});
