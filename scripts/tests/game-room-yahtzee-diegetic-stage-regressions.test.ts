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

type StageConfig = {
  dice?: { heldScale?: number; scale?: number; layout?: unknown[] };
  rack?: { slots?: unknown[] };
  performance?: { idleFps?: number; activeFps?: number; rollFps?: number };
};

void test("Yahtzee presentation renders directly and exposes an art-tuning contract", () => {
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
  const themeSource = readFileSync(
    "rooms/game-room/main-functions/yahtzee/ui/theme-pirate-deck.js",
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

  assert.match(themeSource, /stageConfig:/);
  assert.match(themeSource, /heldScale:/);
  assert.match(themeSource, /slots:/);
  assert.match(themeSource, /idleFps:/);
  assert.match(sceneSource, /readStageConfig/);
  assert.match(sceneSource, /yahtzee-game-table-hold-well/);
  assert.match(sceneSource, /targetPosition/);
  assert.match(sceneSource, /targetRotation/);
  assert.match(sceneSource, /targetScaling/);
  assert.match(sceneSource, /scene\.constantlyUpdateMeshUnderPointer = false/);
  assert.match(sceneSource, /performanceConfig\.rollFps/);
  assert.match(sceneSource, /performanceConfig\.activeFps/);
  assert.match(sceneSource, /performanceConfig\.idleFps/);
  assert.match(sceneSource, /hardwareScalingFloor/);
  assert.match(sceneSource, /cube\.isPickable = true/);
  assert.match(sceneSource, /scene\.onPointerDown/);
  assert.doesNotMatch(sceneSource, /camera\.attachControl/);
  assert.match(vendorEntrySource, /@babylonjs\/core\/Culling\/ray\.js/);

  assert.match(stylesSource, /\.yahtzee-player-portrait/);
  assert.match(stylesSource, /\.yahtzee-score-row\.is-preview/);
  assert.match(stylesSource, /\.yahtzee-center-dock/);
  assert.doesNotMatch(stylesSource, /backdrop-filter/);
});

void test("Yahtzee held-rack tuning keeps five separate slots and reduces held die scale", () => {
  const source = readFileSync(
    "rooms/game-room/main-functions/yahtzee/ui/theme-pirate-deck.js",
    "utf8"
  );
  const sandbox = { window: {} } as {
    window: {
      GameRoomYahtzeePirateDeckTheme?: {
        stageConfig?: StageConfig;
      };
    };
  };
  runInNewContext(source, sandbox);
  const config = sandbox.window.GameRoomYahtzeePirateDeckTheme?.stageConfig;
  assert.ok(config);
  assert.equal(config.rack?.slots?.length, 5);
  assert.equal(config.dice?.layout?.length, 5);
  assert.ok((config.dice?.heldScale ?? 1) < (config.dice?.scale ?? 0));
  assert.equal(config.performance?.idleFps, 15);
  assert.equal(config.performance?.activeFps, 30);
  assert.equal(config.performance?.rollFps, 45);
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
