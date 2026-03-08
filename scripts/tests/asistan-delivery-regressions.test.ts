import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deliveryModulePath = "src/js/modules/asistan-delivery.ts";
const asistanIndexPath = "src/js/pages/asistan/index.ts";

test("shared delivery module navigates to Asistan before delegating the send flow", () => {
  const content = readFileSync(deliveryModulePath, "utf8");

  assert.match(content, /showPage\("asistan"\)/);
  assert.match(content, /registerAsistanDeliveryHandler/);
  assert.match(content, /activeAsistanDeliveryHandler/);
});

test("Asistan controller registers a delivery handler and reuses the real connect plus send flow", () => {
  const content = readFileSync(asistanIndexPath, "utf8");

  assert.match(
    content,
    /registerAsistanDeliveryHandler\(this\._handleDeliveryRequest\.bind\(this\)\)/
  );
  assert.match(content, /await this\._ensureReadyForDelivery\(\)/);
  assert.match(content, /await this\._toggleConnection\(\)/);
  assert.match(content, /WebviewManager\.send\(\{\s*provider: "ai0"/s);
  assert.match(content, /nextState\.domReady === true/);
});
