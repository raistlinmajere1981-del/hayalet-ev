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
  assert.doesNotMatch(sceneSource, /yahtzee-stage-deck-slab/);
  assert.match(sceneSource, /TABLE_FOOTPRINT_SCALE = 0\.9/);
  assert.match(sceneSource, /DIE_SCALE = 0\.86/);
  assert.match(sceneSource, /if \(model\.held\) \{\s*model\.roll = null;\s*return;/);
  assert.match(sceneSource, /yahtzee-game-table-foot-contact/);
  assert.match(sceneSource, /getDiceAnimationState/);
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

void test("Yahtzee camera presets stay cinematic without leaving the match composition", () => {
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

  assert.ok(showcase.radius >= match.radius);
  assert.ok(showcase.radius - match.radius <= 0.8);
  assert.ok(Math.abs(roll.radius - match.radius) <= 0.4);
  assert.ok(Math.abs(roll.beta - match.beta) <= 0.04);
  assert.ok(Math.abs(turnLeft.alpha - match.alpha) <= 0.02);
  assert.ok(Math.abs(turnRight.alpha - match.alpha) <= 0.02);
  assert.ok(Math.abs(turnLeft.radius - match.radius) <= 0.1);
  assert.ok(Math.abs(turnRight.radius - match.radius) <= 0.1);
  assert.ok(Math.abs(turnLeft.target[0] || 0) <= 0.2);
  assert.ok(Math.abs(turnRight.target[0] || 0) <= 0.2);
  assert.ok(Math.max(match.ease, roll.ease, turnLeft.ease, turnRight.ease) <= 3);
});
