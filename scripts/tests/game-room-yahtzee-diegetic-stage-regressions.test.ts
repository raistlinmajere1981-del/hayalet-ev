import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

void test("Yahtzee hybrid stage uses the 3D table as the primary game interface", () => {
  const indexHtml = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const bridgeSource = readFileSync(
    "rooms/game-room/main-functions/yahtzee/ui/stage-template-bridge.js",
    "utf8"
  );
  const sceneSource = readFileSync(
    "rooms/game-room/main-functions/yahtzee/ui/babylon-scene.js",
    "utf8"
  );
  const vendorEntrySource = readFileSync(
    "rooms/game-room/main-functions/yahtzee/vendor/babylon-runtime-entry.js",
    "utf8"
  );
  const diegeticStyles = readFileSync(
    "rooms/game-room/main-functions/yahtzee/diegetic-stage.css",
    "utf8"
  );

  assert.match(indexHtml, /main-functions\/yahtzee\/diegetic-stage\.css/);

  assert.match(bridgeSource, /GameRoomYahtzeeStageActions/);
  assert.match(bridgeSource, /yahtzee-stage-interface/);
  assert.match(bridgeSource, /yahtzee-stage-roll-button/);
  assert.match(bridgeSource, /yahtzee-stage-status-dock/);
  assert.match(bridgeSource, /yahtzee-score-stack/);
  assert.match(bridgeSource, /dicePanel\.hidden = true/);
  assert.match(bridgeSource, /Number\(turn\.rollCount\) > 0/);

  assert.match(sceneSource, /cube\.isPickable = true/);
  assert.match(sceneSource, /yahtzeeDieIndex/);
  assert.match(sceneSource, /scene\.onPointerDown/);
  assert.match(sceneSource, /scene\.constantlyUpdateMeshUnderPointer = true/);
  assert.match(sceneSource, /GameRoomYahtzeeStageActions/);
  assert.match(sceneSource, /width: 7\.82, height: 0\.04, depth: 4\.48/);
  assert.doesNotMatch(sceneSource, /camera\.attachControl/);
  assert.match(vendorEntrySource, /@babylonjs\/core\/Culling\/ray\.js/);

  assert.match(diegeticStyles, /\.yahtzee-stage-interface/);
  assert.match(diegeticStyles, /\.yahtzee-stage-action-bar/);
  assert.match(diegeticStyles, /\.yahtzee-stage-roll-button/);
  assert.match(diegeticStyles, /data-player-count="2"/);
  assert.match(diegeticStyles, /pointer-events: auto/);
  assert.match(diegeticStyles, /justify-self: stretch/);
  assert.match(diegeticStyles, /left: clamp\(220px, 14\.5vw, 290px\)/);
  assert.match(diegeticStyles, /right: clamp\(220px, 14\.5vw, 290px\)/);
});

void test("Yahtzee Babylon runtime registers ray picking for interactive dice", async () => {
  await import("../../rooms/game-room/main-functions/yahtzee/vendor/babylon-runtime-entry.js");
  const runtime = globalThis as typeof globalThis & {
    BABYLON?: {
      Scene?: { prototype?: { pick?: unknown } };
      Texture?: unknown;
    };
  };
  const pickSource = String(runtime.BABYLON?.Scene?.prototype?.pick || "");

  assert.match(pickSource, /Pick\(/);
  assert.doesNotMatch(pickSource, /_WarnImport/);
  assert.equal(typeof runtime.BABYLON?.Texture, "function");
});
