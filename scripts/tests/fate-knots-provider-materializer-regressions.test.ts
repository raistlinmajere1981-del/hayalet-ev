import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const providerSource = readFileSync(
  "rooms/game-room/main-functions/fate-knots/host/provider-asset-materializer.ts",
  "utf8"
);
const storageSource = readFileSync(
  "rooms/game-room/main-functions/fate-knots/host/storage-bridge.ts",
  "utf8"
);
const extensionSource = readFileSync(
  "rooms/game-room/host/fate-knots-materializer-extension.ts",
  "utf8"
);

void test("Fate Knots forge art uses AI1 SlotBridge generated-image archives, not AI0", () => {
  assert.match(providerSource, /action:\s*"message\.sendWait"/);
  assert.match(providerSource, /toSlot:\s*"ai1"/);
  assert.match(providerSource, /kind\]\s*!==\s*"generated-image"/);
  assert.match(providerSource, /openFateKnotsAi1Session/);
  assert.doesNotMatch(providerSource, /fate-knots-ai0-call/);
  assert.doesNotMatch(extensionSource, /fate-knots-ai0-call/);
});

void test("Fate Knots sheet materialization uses canonical crop geometry and managed image writes", () => {
  assert.match(providerSource, /getFateKnotsImageSheetCropRect\(job\.sheet, cell\.slotId\)/);
  assert.match(providerSource, /canvas\.toDataURL\(FATE_KNOTS_CROP_MIME_TYPE\)/);
  assert.match(providerSource, /fileId:\s*cell\.outputAssetId/);
  assert.match(providerSource, /sourceArtifact:/);
  assert.match(providerSource, /writeFateKnotsManagedImageFile/);
});

void test("Fate Knots managed storage promotion stays below the assets root and writes real base64", () => {
  assert.match(storageSource, /joinRuntimePath\(paths\.rootDir, "assets"\)/);
  assert.match(storageSource, /encoding:\s*"base64"/);
  assert.match(storageSource, /readFateKnotsLocalFileBase64/);
  assert.match(storageSource, /writeFateKnotsManagedImageFile/);
});

void test("Fate Knots host activation owns materializer registration lifetime", () => {
  assert.match(
    extensionSource,
    /registerFateKnotsAssetMaterializer\(createFateKnotsProviderAssetMaterializer\(transportApi\)\)/
  );
  assert.match(extensionSource, /registerFateKnotsAssetMaterializer\(null\)/);
});
