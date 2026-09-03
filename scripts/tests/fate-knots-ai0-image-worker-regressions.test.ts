import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRepoFile(relativePath: string): Promise<string> {
  return await readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

void test("Fate Knots AI0 image worker has a dedicated room-tool and isolated server range", async () => {
  const [types, ipc, imageService, runtimeService] = await Promise.all([
    readRepoFile("src/types/room-tools.ts"),
    readRepoFile("electron/handlers/ipc-room-tools.ts"),
    readRepoFile("electron/fate-knots-ai0-image-service.ts"),
    readRepoFile("electron/fate-knots-ai0-runtime-service.ts"),
  ]);

  assert.match(types, /"fate-knots-ai0-image-generate"/);
  assert.match(types, /RoomToolFateKnotsAi0ImageGenerateRequest/);
  assert.match(types, /RoomToolFateKnotsAi0ImageResult/);
  assert.match(ipc, /fateKnotsAi0ImageService\.generate\(request\)/);
  assert.match(ipc, /isFateKnotsAi0ImageGenerateRequest/);

  assert.match(imageService, /FATE_KNOTS_AI0_IMAGE_PORT_START = 4135/);
  assert.match(imageService, /FATE_KNOTS_AI0_IMAGE_PORT_END = 4149/);
  assert.match(runtimeService, /FATE_KNOTS_AI0_PORT_START = 4120/);
  assert.match(runtimeService, /FATE_KNOTS_AI0_PORT_END = 4134/);
  assert.doesNotMatch(imageService, /fateKnotsAi0RuntimeService/);
});

void test("Fate Knots AI0 image worker pins one image plugin and stages only real PNG output", async () => {
  const imageService = await readRepoFile("electron/fate-knots-ai0-image-service.ts");

  assert.match(imageService, /opencode-image-generation@0\.5\.0/);
  assert.match(imageService, /FATE_KNOTS_AI0_IMAGE_TOOL_ID = "image_generate"/);
  assert.match(imageService, /OPENCODE_IMAGE_GENERATION_DIR:\s*stagingRoot/);
  assert.match(imageService, /"ai0-image-worker"/);
  assert.match(imageService, /"workspace"/);
  assert.match(imageService, /"staging"/);
  assert.match(imageService, /`jobs\/\$\{jobSegment\}\/source\.png`/);
  assert.match(imageService, /"result\.json"/);
  assert.match(imageService, /function isPng/);
  assert.match(imageService, /staging file is not a valid PNG payload/);
  assert.match(imageService, /\/experimental\/tool\/ids/);
  assert.match(imageService, /method: "DELETE"/);
});

void test("Fate Knots AI0 image adapter promotes staging bytes through canonical storage and crop", async () => {
  const [adapter, bridge, extension] = await Promise.all([
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/ai0-local-asset-materializer.ts"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/electron-bridge.ts"),
    readRepoFile("rooms/game-room/host/fate-knots-materializer-extension.ts"),
  ]);

  assert.match(bridge, /callFateKnotsAi0ImageRoomTool/);
  assert.match(adapter, /callFateKnotsAi0ImageRoomTool/);
  assert.match(adapter, /readFateKnotsLocalFileBase64/);
  assert.match(adapter, /writeFateKnotsManagedImageFile/);
  assert.match(adapter, /getFateKnotsImageSheetCropRect/);
  assert.doesNotMatch(adapter, /dispatchBridge/);
  assert.doesNotMatch(adapter, /fate-knots-ai0-call/);

  assert.match(
    extension,
    /registerFateKnotsAssetMaterializerForProvider\(\s*"ai0-local",\s*createFateKnotsAi0LocalAssetMaterializer\(transportApi\)\s*\)/
  );
});
