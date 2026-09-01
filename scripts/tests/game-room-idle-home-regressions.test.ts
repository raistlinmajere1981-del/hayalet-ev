import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

test("Game Room opens without eagerly activating Tavla", () => {
  const pageState = source("src/js/pages/room-page/page-state.ts");
  const featureMeta = source("rooms/game-room/shared/host/feature-meta.ts");
  const contextState = source("rooms/game-room/shared/host/context-state.ts");
  const uiRuntime = source("rooms/game-room/ui/game-room-ui-runtime.ts");

  assert.match(pageState, /room\.id === "game-room"/);
  assert.match(pageState, /return "";/);
  assert.match(featureMeta, /GAME_ROOM_HOME_FEATURE_ID = "game-room-home"/);
  assert.match(contextState, /GAME_ROOM_HOME_FEATURE_ID/);
  assert.match(uiRuntime, /activeFeatureId === gameRoomHomeFeatureId/);
  assert.match(uiRuntime, /renderGameRoomHome\(root\)/);
});

test("Tavla background work is gated and its stage is disposed on feature switches", () => {
  const hostRuntime = source("rooms/game-room/host/runtime.ts");
  const uiIndex = source("rooms/game-room/ui/index.html");
  const lifecycle = source("rooms/game-room/main-functions/backgammon/ui/lifecycle-runtime.js");
  const uiRuntime = source("rooms/game-room/ui/game-room-ui-runtime.ts");
  const yahtzeeBridge = source("rooms/game-room/main-functions/yahtzee/ui/bridge.js");

  assert.match(hostRuntime, /function isBackgammonActive/);
  assert.match(hostRuntime, /if \(!isBackgammonActive\(handlerApi\)\)/);
  assert.match(uiIndex, /backgammon\/ui\/lifecycle-runtime\.js/);
  assert.match(lifecycle, /instance\.destroy\(\)/);
  assert.match(uiRuntime, /disposeBackgammonStage\(\)/);
  assert.match(yahtzeeBridge, /disposeBackgammonStage\(\)/);
});
