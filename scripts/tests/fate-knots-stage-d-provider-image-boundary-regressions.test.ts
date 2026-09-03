import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRepoFile(relativePath: string): Promise<string> {
  return await readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

void test("Fate Knots Stage D stays on the host provider image-generation boundary", async () => {
  const [materializer, imageSheet, slotBridge, storageBridge, hostExtension] = await Promise.all([
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/provider-asset-materializer.ts"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/forge/image-sheet.ts"),
    readRepoFile("src/js/modules/commands/slot-bridge.ts"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/storage-bridge.ts"),
    readRepoFile("rooms/game-room/host/fate-knots-materializer-extension.ts"),
  ]);

  assert.match(materializer, /action:\s*"message\.sendWait"/);
  assert.match(materializer, /toSlot:\s*"ai1"/);
  assert.doesNotMatch(materializer, /toSlot:\s*"ai0"/);
  assert.match(materializer, /collectGeneratedImages/);
  assert.match(materializer, /readFateKnotsLocalFileBase64/);
  assert.match(materializer, /writeFateKnotsManagedImageFile/);
  assert.match(materializer, /getFateKnotsImageSheetCropRect/);
  assert.match(materializer, /canvas\.toDataURL\(FATE_KNOTS_CROP_MIME_TYPE\)/);

  assert.match(imageSheet, /safeInsetRatio/);
  assert.match(imageSheet, /getFateKnotsImageSheetCropRect/);
  assert.match(imageSheet, /FATE_KNOTS_IMAGE_SHEET_PROMPT_RULES/);

  assert.match(slotBridge, /function mergeSyncedAndArchivedReply/);
  assert.match(slotBridge, /const archivedReply = await readLatestArchivedReply\(/);
  assert.match(slotBridge, /const reply = mergeSyncedAndArchivedReply\(/);
  assert.match(slotBridge, /archivedAttachments\.length > 0 \? archivedAttachments : syncedAttachments/);

  assert.match(storageBridge, /function matchesImagePayload/);
  assert.match(storageBridge, /function pathMatchesImageMimeType/);
  assert.match(storageBridge, /managed image bytes do not match declared MIME type/);
  assert.match(storageBridge, /Materialized asset bytes do not match its declared MIME type/);

  assert.match(hostExtension, /registerFateKnotsAssetMaterializer/);
  assert.match(hostExtension, /createFateKnotsProviderAssetMaterializer/);
});
