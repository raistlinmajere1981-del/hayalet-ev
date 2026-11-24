import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRepoFile(relativePath: string): Promise<string> {
  return await readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

void test("Fate Knots uses only the shared AI0 host and the user-installed image tool", async () => {
  const [types, ipc, adapter, host, image, main] = await Promise.all([
    readRepoFile("src/types/room-tools.ts"),
    readRepoFile("electron/handlers/ipc-room-tools.ts"),
    readRepoFile("electron/ai0/fate-knots-adapter.ts"),
    readRepoFile("electron/ai0/runtime-host.ts"),
    readRepoFile("electron/ai0/native-image-service.ts"),
    readRepoFile("electron/main.ts"),
  ]);
  assert.match(types, /"fate-knots-ai0-image-status"/);
  assert.match(types, /"fate-knots-ai0-image-generate"/);
  assert.match(ipc, /fateKnotsSharedImageStatus\(\)/);
  assert.match(ipc, /generateFateKnotsSharedImage\(request\)/);
  assert.match(adapter, /ai0RuntimeHost\.generateImage/);
  assert.match(adapter, /ai0RuntimeHost\.chat/);
  assert.match(image, /IMAGE_TOOL = "gpt_imagegen"/);
  assert.match(host, /Call gpt_imagegen exactly once/);
  assert.match(host, /Never use other tools/);
  assert.match(image, /validatePng/);
  assert.match(image, /sha256/);
  assert.match(main, /await ai0RuntimeHost\.shutdown\(\)/);
  for (const name of ["runtime-service", "image-worker-service", "image-service", "active-model"]) {
    await assert.rejects(readRepoFile("electron/fate-knots-ai0-" + name + ".ts"), {
      code: "ENOENT",
    });
  }
});

void test("Fate Knots AI0 image adapter promotes staging bytes through canonical storage and crop", async () => {
  const [adapter, bridge, extension, forgeExtension, forgeControls] = await Promise.all([
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/ai0-local-asset-materializer.ts"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/host/electron-bridge.ts"),
    readRepoFile("rooms/game-room/host/fate-knots-materializer-extension.ts"),
    readRepoFile("rooms/game-room/host/fate-knots-forge-extension.ts"),
    readRepoFile("rooms/game-room/main-functions/fate-knots/ui/forge-controls.js"),
  ]);

  assert.match(bridge, /readFateKnotsAi0ImageCapabilityStatus/);
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
  assert.match(forgeExtension, /ai0Status\?\.available === true/);
  assert.match(forgeExtension, /readFateKnotsAi0ImageCapabilityStatus/);
  assert.match(forgeControls, /readinessMessage/);
  assert.doesNotMatch(forgeControls, /image skill/);
  assert.match(forgeControls, /AI0 görsel üretimi hazır değil/);
});
