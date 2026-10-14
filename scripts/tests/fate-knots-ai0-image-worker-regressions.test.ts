import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRepoFile(relativePath: string): Promise<string> {
  return await readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

void test("Fate Knots AI0 image worker has status/generate room-tools and an isolated server range", async () => {
  const [types, ipc, compatibilityService, imageService, runtimeService, electronMain] =
    await Promise.all([
      readRepoFile("src/types/room-tools.ts"),
      readRepoFile("electron/handlers/ipc-room-tools.ts"),
      readRepoFile("electron/fate-knots-ai0-image-service.ts"),
      readRepoFile("electron/fate-knots-ai0-image-worker-service.ts"),
      readRepoFile("electron/fate-knots-ai0-runtime-service.ts"),
      readRepoFile("electron/main.ts"),
    ]);

  assert.match(types, /"fate-knots-ai0-image-status"/);
  assert.match(types, /"fate-knots-ai0-image-generate"/);
  assert.match(types, /RoomToolFateKnotsAi0ImageStatus/);
  assert.match(types, /RoomToolFateKnotsAi0ImageGenerateRequest/);
  assert.match(ipc, /fateKnotsAi0ImageService\.status\(request\)/);
  assert.match(ipc, /fateKnotsAi0ImageService\.generate\(request\)/);
  assert.match(compatibilityService, /fateKnotsAi0ImageWorkerService as fateKnotsAi0ImageService/);

  assert.match(imageService, /FATE_KNOTS_AI0_IMAGE_PORT_START = 4135/);
  assert.match(imageService, /FATE_KNOTS_AI0_IMAGE_PORT_END = 4149/);
  assert.match(runtimeService, /FATE_KNOTS_AI0_PORT_START = 4120/);
  assert.match(runtimeService, /FATE_KNOTS_AI0_PORT_END = 4134/);
  assert.doesNotMatch(imageService, /fateKnotsAi0RuntimeService/);
  assert.match(imageService, /FATE_KNOTS_AI0_IMAGE_HEALTH_PROBE_TIMEOUT_MS = 2_000/);
  assert.match(imageService, /await fetchJson\(\s*url,/);
  assert.match(imageService, /process\.once\("exit", stopOnParentExit\)/);
  assert.match(imageService, /async shutdown\(\): Promise<void>/);
  assert.match(electronMain, /await fateKnotsAi0ImageService\.shutdown\(\)/);
});

void test("Fate Knots never installs or injects an image plugin on the user's behalf", async () => {
  const [imageService, compatibilityService] = await Promise.all([
    readRepoFile("electron/fate-knots-ai0-image-worker-service.ts"),
    readRepoFile("electron/fate-knots-ai0-image-service.ts"),
  ]);

  assert.doesNotMatch(imageService, /opencode-image-generation@/);
  assert.doesNotMatch(compatibilityService, /opencode-image-generation@/);
  assert.doesNotMatch(imageService, /\["plugin"\]|\["plugins"\]/);
  assert.doesNotMatch(imageService, /OPENCODE_CONFIG_CONTENT:\s*JSON\.stringify/);
  assert.match(imageService, /delete childEnv\["OPENCODE_CONFIG_CONTENT"\]/);
  assert.match(imageService, /rm\(join\(workspacePath, "opencode\.json"\), \{ force: true \}\)/);
  assert.match(imageService, /OPENCODE_IMAGE_GENERATION_DIR:\s*stagingRoot/);
});

void test("Fate Knots AI0 image capability uses the active AI0 model and validates a file-producing tool", async () => {
  const [imageService, activeModel, webviewPreload, opencodeUiHandlers] = await Promise.all([
    readRepoFile("electron/fate-knots-ai0-image-worker-service.ts"),
    readRepoFile("electron/fate-knots-ai0-active-model.ts"),
    readRepoFile("electron/webview-preload.cjs"),
    readRepoFile("electron/handlers/ipc-opencode-ui-tools.ts"),
  ]);

  assert.match(activeModel, /"opencode-ui-state\.json"/);
  assert.match(activeModel, /lastSelectedModelKey/);
  assert.match(activeModel, /defaultModelKey/);
  assert.match(webviewPreload, /opencodeUiSharedStateRead/);
  assert.match(webviewPreload, /opencodeUiSharedStateWrite/);
  assert.match(
    opencodeUiHandlers,
    /registerHandler\("opencode-ui-shared-state-write", async \(_event, payload: unknown\)/
  );
  assert.match(imageService, /FATE_KNOTS_AI0_IMAGE_TOOL_ID = "image_generate"/);
  assert.match(imageService, /\/experimental\/tool\/ids/);
  assert.match(imageService, /\/experimental\/tool\?/);
  assert.match(imageService, /toolHasRequiredOutputContract/);
  assert.match(imageService, /propertiesValue\["output_path"\]/);
  assert.match(
    imageService,
    /model:\s*\{ providerID: model\.providerID, modelID: model\.modelID \}/
  );
  assert.match(imageService, /tools:\s*buildToolSelection/);
  assert.match(
    imageService,
    /const args = \["serve", "--port", String\(port\), "--hostname", "127\.0\.0\.1"\]/
  );
  assert.match(imageService, /cwd: workspacePath/);
  assert.doesNotMatch(imageService, /"127\.0\.0\.1", workspacePath/);
});

void test("Fate Knots image skills are discovery-only while staging keeps real PNG verification", async () => {
  const imageService = await readRepoFile("electron/fate-knots-ai0-image-worker-service.ts");

  assert.match(imageService, /skill\.md/i);
  assert.match(imageService, /detectImageSkills/);
  assert.match(imageService, /imageSkillDetected/);
  assert.match(imageService, /exposes no compatible/);
  assert.match(imageService, /`jobs\/\$\{jobSegment\}\/source\.png`/);
  assert.match(imageService, /"result\.json"/);
  assert.match(imageService, /function isPng/);
  assert.match(imageService, /staging file is not a valid PNG payload/);
  assert.match(imageService, /method: "DELETE"/);
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
  assert.match(forgeControls, /formatAi0ImageStatus/);
  assert.match(forgeControls, /AI0 Local hazır/);
  assert.match(forgeControls, /AI0 Local kapalı/);
});
