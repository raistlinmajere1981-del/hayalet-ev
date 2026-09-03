import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const providerSource = readFileSync(
  "rooms/game-room/main-functions/fate-knots/host/provider-asset-materializer.ts",
  "utf8"
);
const ai0LocalSource = readFileSync(
  "rooms/game-room/main-functions/fate-knots/host/ai0-local-asset-materializer.ts",
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

void test("Fate Knots AI1 forge art stays on SlotBridge generated-image archives", () => {
  assert.match(providerSource, /action:\s*"message\.sendWait"/);
  assert.match(providerSource, /toSlot:\s*"ai1"/);
  assert.match(providerSource, /kind !== "generated-image"/);
  assert.match(providerSource, /openFateKnotsAi1Session/);
  assert.doesNotMatch(providerSource, /fate-knots-ai0-call/);
  assert.doesNotMatch(providerSource, /fate-knots-ai0-image-generate/);
});

void test("Fate Knots AI0 Local forge art uses the isolated file-producing room tool", () => {
  assert.match(ai0LocalSource, /fate-knots-ai0-image-generate/);
  assert.match(ai0LocalSource, /callFateKnotsAi0ImageRoomTool/);
  assert.doesNotMatch(ai0LocalSource, /dispatchBridge/);
  assert.doesNotMatch(ai0LocalSource, /fate-knots-ai0-call/);
  assert.match(ai0LocalSource, /readFateKnotsLocalFileBase64/);
  assert.match(ai0LocalSource, /writeFateKnotsManagedImageFile/);
});

void test("Fate Knots sheet materialization uses canonical crop geometry and managed image writes", () => {
  assert.match(providerSource, /getFateKnotsImageSheetCropRect\(job\.sheet, cell\.slotId\)/);
  assert.match(providerSource, /canvas\.toDataURL\(FATE_KNOTS_CROP_MIME_TYPE\)/);
  assert.match(ai0LocalSource, /getFateKnotsImageSheetCropRect\(job\.sheet, cell\.slotId\)/);
  assert.match(ai0LocalSource, /canvas\.toDataURL\(FATE_KNOTS_AI0_IMAGE_MIME_TYPE\)/);
  assert.match(providerSource, /fileId:\s*cell\.outputAssetId/);
  assert.match(ai0LocalSource, /fileId:\s*cell\.outputAssetId/);
  assert.match(providerSource, /sourceArtifact:/);
  assert.match(ai0LocalSource, /sourceArtifact:/);
});

void test("Fate Knots managed storage promotion stays below the assets root and writes real base64", () => {
  assert.match(storageSource, /joinRuntimePath\(paths\.rootDir, "assets"\)/);
  assert.match(storageSource, /encoding:\s*"base64"/);
  assert.match(storageSource, /readFateKnotsLocalFileBase64/);
  assert.match(storageSource, /writeFateKnotsManagedImageFile/);
});

void test("Fate Knots host activation owns both materializer registrations for one lifetime", () => {
  assert.match(
    extensionSource,
    /registerFateKnotsAssetMaterializerForProvider\(\s*"ai1",\s*createFateKnotsProviderAssetMaterializer\(transportApi\)\s*\)/
  );
  assert.match(
    extensionSource,
    /registerFateKnotsAssetMaterializerForProvider\(\s*"ai0-local",\s*createFateKnotsAi0LocalAssetMaterializer\(transportApi\)\s*\)/
  );
  assert.match(extensionSource, /function unregisterMaterializers\(\)/);
  assert.match(extensionSource, /registerFateKnotsAssetMaterializerForProvider\("ai1", null\)/);
  assert.match(
    extensionSource,
    /registerFateKnotsAssetMaterializerForProvider\("ai0-local", null\)/
  );
  assert.equal(Array.from(extensionSource.matchAll(/unregisterMaterializers\(\);/g)).length, 2);
});
