import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deliveryModulePath = "src/js/modules/assistant-delivery.ts";
const assistantIndexPath = "src/js/pages/assistant/assistant.ts";

test("shared delivery module navigates to assistant before delegating the send flow", () => {
  const content = readFileSync(deliveryModulePath, "utf8");

  assert.match(content, /showPage\("assistant"\)/);
  assert.match(content, /registerAssistantDeliveryHandler/);
  assert.match(content, /activeAssistantDeliveryHandler/);
});

test("assistant controller registers a delivery handler and reuses the real connect plus send flow", () => {
  const content = readFileSync(assistantIndexPath, "utf8");

  assert.match(
    content,
    /registerAssistantDeliveryHandler\(this\._handleDeliveryRequest\.bind\(this\)\)/
  );
  assert.match(content, /await this\._ensureReadyForDelivery\(\)/);
  assert.match(content, /await this\._toggleConnection\(\)/);
  assert.match(content, /WebviewManager\.send\(\{\s*provider: "ai0"/s);
  assert.match(content, /nextState\.domReady === true/);
});
