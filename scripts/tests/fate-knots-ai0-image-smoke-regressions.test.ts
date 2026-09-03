import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FATE_KNOTS_AI0_IMAGE_SMOKE_PROMPT } from "../../rooms/game-room/main-functions/fate-knots/host/ai0-local-image-smoke.js";

async function readRepoFile(relativePath: string): Promise<string> {
  return await readFile(new URL("../../" + relativePath, import.meta.url), "utf8");
}

void test("Fate Knots registers an internal AI0 image smoke command outside World Forge", async () => {
  const [extension, hostIndex] = await Promise.all([
    readRepoFile("rooms/game-room/host/fate-knots-ai0-smoke-extension.ts"),
    readRepoFile("rooms/game-room/host/index.ts"),
  ]);

  assert.match(extension, /GameRoomFateKnotsTestAi0Image/);
  assert.match(extension, /runFateKnotsAi0ImageSmoke/);
  assert.match(extension, /exposure:\s*"internal"/);
  assert.match(extension, /scope:\s*"room-ui"/);
  assert.match(extension, /ai0-image-smoke-busy/);
  assert.match(hostIndex, /extendGameRoomHostRuntimeWithFateKnotsAi0ImageSmoke/);
});

void test("Fate Knots AI0 smoke validates staging files and promotes only a real PNG", async () => {
  const helper = await readRepoFile(
    "rooms/game-room/main-functions/fate-knots/host/ai0-local-image-smoke.ts"
  );

  assert.equal(
    FATE_KNOTS_AI0_IMAGE_SMOKE_PROMPT,
    "An old leather-bound fantasy book resting on a dark wooden table, warm candlelight, no text, painterly dark fantasy concept art."
  );
  assert.match(helper, /readFateKnotsAi0ImageCapabilityStatus/);
  assert.match(helper, /capability\.available !== true/);
  assert.match(helper, /callFateKnotsAi0ImageRoomTool/);
  assert.match(helper, /"source\.png"/);
  assert.match(helper, /"result\.json"/);
  assert.match(helper, /PNG_SIGNATURE/);
  assert.match(helper, /readFateKnotsJsonFile/);
  assert.match(helper, /writeFateKnotsManagedImageFile/);
  assert.match(helper, /verifyFateKnotsManagedAssetFiles/);
  assert.match(helper, /managedBase64 !== sourceBase64/);
  assert.doesNotMatch(helper, /\bai1\b/i);
  assert.doesNotMatch(helper, /placeholder/i);
});

void test("Fate Knots Forge panel exposes AI0 Test only for the selected AI0 Local provider", async () => {
  const controls = await readRepoFile(
    "rooms/game-room/main-functions/fate-knots/ui/forge-controls.js"
  );

  assert.match(controls, /GameRoomFateKnotsTestAi0Image/);
  assert.match(controls, /forgeState\.assetProvider === "ai0-local"/);
  assert.match(controls, /"AI0 Test"/);
  assert.match(controls, /sendCommand\(AI0_TEST_COMMAND, \{\}\)/);
  assert.match(controls, /AI0 test başarılı · managed:/);
  assert.match(controls, /port:/);
  assert.match(controls, /bytes/);
  assert.match(controls, /AI0 test başarısız/);
});
