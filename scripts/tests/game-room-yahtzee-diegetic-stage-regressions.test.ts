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
  dice?: { size?: number; scale?: number; heldScale?: number };
  rack?: { zSlots?: number[]; yawSlots?: number[] };
  performance?: { rollingFps?: number; activeFps?: number; idleFps?: number };
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
  const stylesSource = readFileSync("rooms/game-room/main-functions/yahtzee/styles.css", "utf8");
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
  assert.match(runtimeSource, /aria-live/);
  assert.doesNotMatch(runtimeSource, /overlay\.innerHTML/);

  assert.match(sceneSource, /resolveStageConfig/);
  assert.match(sceneSource, /yahtzee-game-table-hold-well/);
  assert.match(sceneSource, /yahtzee-game-table-inner-rail/);
  assert.match(sceneSource, /CreatePolyhedron/);
  assert.match(sceneSource, /DIE_FACES/);
  assert.match(sceneSource, /B\.Mesh\.MergeMeshes/);
  assert.match(sceneSource, /yahtzee-die-visual-root/);
  assert.match(sceneSource, /model\.visualRoot\.rotation\.set/);
  assert.match(sceneSource, /targetPosition/);
  assert.match(sceneSource, /targetScale/);
  assert.match(sceneSource, /visualRotation/);
  assert.match(sceneSource, /scene\.constantlyUpdateMeshUnderPointer = false/);
  assert.match(sceneSource, /performanceConfig\.rollingFps/);
  assert.match(sceneSource, /performanceConfig\.hardwareScalingFloor/);
  assert.match(sceneSource, /cube\.isPickable = true/);
  assert.match(sceneSource, /scene\.onPointerDown/);
  assert.doesNotMatch(sceneSource, /camera\.attachControl/);
  assert.match(vendorEntrySource, /@babylonjs\/core\/Culling\/ray\.js/);
  assert.match(vendorEntrySource, /@babylonjs\/core\/Meshes\/mesh\.js/);

  assert.match(stylesSource, /\.yahtzee-player-portrait/);
  assert.match(stylesSource, /\.yahtzee-score-row\.is-preview/);
  assert.match(stylesSource, /\.yahtzee-center-dock/);
  assert.match(stylesSource, /\.yahtzee-player-copy/);
  assert.match(stylesSource, /font-variant-numeric: tabular-nums/);
  assert.match(stylesSource, /\.yahtzee-mode-control:focus-visible/);
  assert.doesNotMatch(stylesSource, /backdrop-filter/);
});

void test("Yahtzee Babylon runtime registers ray picking for interactive dice", async () => {
  await import("../../rooms/game-room/main-functions/yahtzee/vendor/babylon-runtime-entry.js");
  const runtime = globalThis as typeof globalThis & {
    BABYLON?: {
      Scene?: { prototype?: { pick?: unknown } };
      Texture?: unknown;
      CreatePolyhedron?: unknown;
      Mesh?: { MergeMeshes?: unknown };
    };
  };
  const pickSource = String(runtime.BABYLON?.Scene?.prototype?.pick || "");

  assert.match(pickSource, /Pick\(/);
  assert.doesNotMatch(pickSource, /_WarnImport/);
  assert.equal(typeof runtime.BABYLON?.Texture, "function");
  assert.equal(typeof runtime.BABYLON?.CreatePolyhedron, "function");
  assert.equal(typeof runtime.BABYLON?.Mesh?.MergeMeshes, "function");
});

void test("Yahtzee camera presets create a visible roll shot while keeping player turns controlled", () => {
  const source = readFileSync(
    "rooms/game-room/main-functions/yahtzee/ui/theme-pirate-deck.js",
    "utf8"
  );
  const sandbox = { window: {} } as {
    window: {
      GameRoomYahtzeePirateDeckTheme?: {
        shots?: Record<string, CameraShot>;
        stageConfig?: StageConfig;
      };
    };
  };
  runInNewContext(source, sandbox);
  const theme = sandbox.window.GameRoomYahtzeePirateDeckTheme;
  const shots = theme?.shots;
  const stageConfig = theme?.stageConfig;
  assert.ok(shots);
  assert.ok(stageConfig);

  const showcase = shots["showcase"];
  const match = shots["match"];
  const roll = shots["roll"];
  const result = shots["result"];
  const turnLeft = shots["turnLeft"];
  const turnRight = shots["turnRight"];
  assert.ok(showcase && match && roll && result && turnLeft && turnRight);

  assert.ok(showcase.radius > match.radius);
  assert.ok(match.radius - roll.radius >= 0.9);
  assert.ok(match.beta - roll.beta >= 0.05);
  assert.ok(Math.abs(turnLeft.alpha - match.alpha) <= 0.05);
  assert.ok(Math.abs(turnRight.alpha - match.alpha) <= 0.05);
  assert.ok(Math.abs(turnLeft.target[0] || 0) <= 0.35);
  assert.ok(Math.abs(turnRight.target[0] || 0) <= 0.35);
  assert.ok(roll.ease > match.ease);
  assert.ok(result.radius > match.radius);

  const dice = stageConfig.dice;
  const rack = stageConfig.rack;
  const performance = stageConfig.performance;
  assert.ok(dice?.size && dice.scale && dice.heldScale);
  assert.ok(rack?.zSlots && rack.yawSlots);
  assert.equal(rack.zSlots.length, 5);
  assert.equal(rack.yawSlots.length, 5);
  assert.ok(dice.heldScale < dice.scale);
  const heldWidth = dice.size * dice.heldScale;
  for (let index = 1; index < rack.zSlots.length; index += 1) {
    const previousSlot = rack.zSlots[index - 1];
    const currentSlot = rack.zSlots[index];
    if (typeof previousSlot !== "number" || typeof currentSlot !== "number") {
      assert.fail("Rack slot positions must be numeric");
    }
    assert.ok(currentSlot - previousSlot > heldWidth);
  }
  assert.equal(performance?.rollingFps, 45);
  assert.equal(performance?.activeFps, 30);
  assert.equal(performance?.idleFps, 15);
});

void test("Yahtzee Babylon mount keeps the lightweight fallback when the runtime is absent", () => {
  const source = readFileSync("rooms/game-room/main-functions/yahtzee/ui/babylon-scene.js", "utf8");
  const sandbox = { window: {}, document: {} } as {
    window: {
      GameRoomYahtzeeBabylonScene?: { mount?: (canvas: object, state: object) => unknown };
    };
    document: object;
  };
  runInNewContext(source, sandbox);

  assert.equal(sandbox.window.GameRoomYahtzeeBabylonScene?.mount?.({}, {}), null);
});
