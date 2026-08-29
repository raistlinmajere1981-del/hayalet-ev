import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

type CameraShot = {
  alpha: number;
  beta: number;
  radius: number;
  target: number[];
  ease: number;
};

void test("Yahtzee presentation v2 renders the stage directly without the legacy promotion bridge", () => {
  const indexHtml = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const runtimeSource = readFileSync(
    "rooms/game-room/main-functions/yahtzee/ui/runtime.js",
    "utf8"
  );
  const sceneSource = readFileSync(
    "rooms/game-room/main-functions/yahtzee/ui/babylon-scene.js",
    "utf8"
  );
  const stylesSource = readFileSync(
    "rooms/game-room/main-functions/yahtzee/styles.css",
    "utf8"
  );
  const vendorEntrySource = readFileSync(
    "rooms/game-room/main-functions/yahtzee/vendor/babylon-runtime-entry.js",
    "utf8"
  );

  assert.match(indexHtml, /main-functions\/yahtzee\/styles\.css/);
  assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/multiplayer\.css/);
  assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/hybrid-stage\.css/);
  assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/diegetic-stage\.css/);
  assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/ui\/hybrid-stage\.js/);
  assert.doesNotMatch(indexHtml, /main-functions\/yahtzee\/ui\/stage-template-bridge\.js/);

  assert.match(runtimeSource, /GameRoomYahtzeeStageActions/);
  assert.match(runtimeSource, /yahtzee-player-panel/);
  assert.match(runtimeSource, /yahtzee-player-portrait/);
  assert.match(runtimeSource, /previewScore/);
  assert.match(runtimeSource, /GameRoomYahtzeeScore/);
  assert.match(runtimeSource, /GameRoomYahtzeeToggleHold/);
  assert.match(runtimeSource, /babylonHandle\.update\(state/);
  assert.doesNotMatch(runtimeSource, /overlay\.innerHTML/);

  assert.match(sceneSource, /RACK_LAYOUT/);
  assert.match(sceneSource, /yahtzee-game-table-hold-well/);
  assert.match(sceneSource, /targetPosition/);
  assert.match(sceneSource, /scene\.constantlyUpdateMeshUnderPointer = false/);
  assert.match(sceneSource, /targetFps = hasRollingDice\(\) \? 45 : latestState\.active === true \? 30 : 15/);
  assert.match(sceneSource, /engine\.setHardwareScalingLevel\(Math\.max\(1\.15/);
  assert.match(sceneSource, /cube\.isPickable = true/);
  assert.match(sceneSource, /scene\.onPointerDown/);
  assert.doesNotMatch(sceneSource, /camera\.attachControl/);
  assert.match(vendorEntrySource, /@babylonjs\/core\/Culling\/ray\.js/);

  assert.match(stylesSource, /\.yahtzee-player-portrait/);
  assert.match(stylesSource, /\.yahtzee-score-row\.is-preview/);
  assert.match(stylesSource, /\.yahtzee-center-dock/);
  assert.doesNotMatch(stylesSource, /backdrop-filter/);
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

void test("Yahtzee camera presets create a visible roll shot while keeping player turns controlled", () => {
  const source = readFileSync(
    "rooms/game-room/main-functions/yahtzee/ui/theme-pirate-deck.js",
    "utf8"
  );
  const sandbox = { window: {} } as {
    window: { GameRoomYahtzeePirateDeckTheme?: { shots?: Record<string, CameraShot> } };
  };
  runInNewContext(source, sandbox);
  const shots = sandbox.window.GameRoomYahtzeePirateDeckTheme?.shots;
  assert.ok(shots);

  const showcase = shots["showcase"];
  const match = shots["match"];
  const roll = shots["roll"];
  const turnLeft = shots["turnLeft"];
  const turnRight = shots["turnRight"];
  assert.ok(showcase && match && roll && turnLeft && turnRight);

  assert.ok(showcase.radius > match.radius);
  assert.ok(match.radius - roll.radius >= 0.9);
  assert.ok(match.beta - roll.beta >= 0.05);
  assert.ok(Math.abs(turnLeft.alpha - match.alpha) <= 0.05);
  assert.ok(Math.abs(turnRight.alpha - match.alpha) <= 0.05);
  assert.ok(Math.abs(turnLeft.target[0] || 0) <= 0.35);
  assert.ok(Math.abs(turnRight.target[0] || 0) <= 0.35);
  assert.ok(roll.ease > match.ease);
});
