import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/game-room/main-functions/fate-knots/assets/fate-knots-view.webp",
  "rooms/game-room/main-functions/fate-knots/data/asset-import.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/runtime-assets.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/runtime-content.module.js",
  "rooms/game-room/main-functions/fate-knots/data/selections.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/map.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/scenarios/intro.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/combat/cards.manifest.json",
  "rooms/game-room/main-functions/fate-knots/data/combat/config.manifest.json",
  "rooms/game-room/main-functions/fate-knots/host/runtime.js",
  "rooms/game-room/main-functions/fate-knots/host/state.js",
  "rooms/game-room/main-functions/fate-knots/ui/module.js",
  "rooms/game-room/main-functions/fate-knots/styles.css",
  "rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-ai-decision.md",
  "rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-ai-combat.md",
  "rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-us1-transport.md",
  "scripts/rooms/sync-game-room-fate-knots-assets.mjs",
];

test("game-room workspace keeps the required Fate Knots package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room manifest exposes Fate Knots as a scene-ready third feature", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  const feature = validation.manifest?.features.find((entry) => entry.id === "fate-knots");

  assert.ok(feature);
  assert.equal(feature?.scene?.hotspot.id, "game-room-fate-knots");
  assert.equal(feature?.scene?.view.id, "fate-knots-closeup");
  assert.equal(
    feature?.scene?.view.backgroundSrc,
    "main-functions/fate-knots/assets/fate-knots-view.webp"
  );
  assert.deepEqual(
    feature?.protocolSpecs?.map((entry) => entry.key),
    [
      "game-room-fate-knots-ai-decision",
      "game-room-fate-knots-ai-combat",
      "game-room-fate-knots-us1-transport",
    ]
  );
  assert.deepEqual(
    feature?.commandSpecs?.map((entry) => entry.name),
    [
      "GameRoomFateKnotsStart",
      "GameRoomFateKnotsReset",
      "GameRoomFateKnotsReady",
      "GameRoomFateKnotsCharacterSelect",
      "GameRoomFateKnotsChoice",
      "GameRoomFateKnotsCombatAction",
      "GameRoomFateKnotsSync",
      "GameRoomFateKnotsEnd",
      "GameRoomFateKnotsAiChoice",
      "GameRoomFateKnotsAiCombatAction",
      "GameRoomFateKnotsRemoteChoice",
      "GameRoomFateKnotsRemoteCombatAction",
    ]
  );
});

test("game-room Fate Knots shell wiring is present in UI and host entrypoints", () => {
  const uiSource = readFileSync("rooms/game-room/ui/index.js", "utf8");
  const indexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const hostSource = readFileSync("rooms/game-room/host/index.js", "utf8");
  const teamTetrisRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/host/runtime.js",
    "utf8"
  );
  const xoxRuntimeSource = readFileSync("rooms/game-room/main-functions/xox/host/runtime.js", "utf8");
  const fateKnotsAssetRegistrySource = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/asset-registry.js",
    "utf8"
  );
  const fateKnotsContentLoaderSource = readFileSync(
    "rooms/game-room/main-functions/fate-knots/host/content-loader.js",
    "utf8"
  );

  assert.match(indexHtmlSource, /main-functions\/fate-knots\/ui\/module\.js/);
  assert.match(uiSource, /message\.type === "fate-knots-state"/);
  assert.match(uiSource, /getActiveFeatureId\(\) === FATE_KNOTS_FEATURE_ID/);
  assert.match(hostSource, /FATE_KNOTS_COMMAND_NAMES\.start/);
  assert.match(hostSource, /FATE_KNOTS_COMMAND_NAMES\.aiChoice/);
  assert.match(teamTetrisRuntimeSource, /FATE_KNOTS_FEATURE_ID/);
  assert.match(teamTetrisRuntimeSource, /pushFateKnotsState/);
  assert.match(xoxRuntimeSource, /fateKnotsSyncFromContext/);
  assert.doesNotMatch(fateKnotsAssetRegistrySource, /from "node:/);
  assert.doesNotMatch(fateKnotsAssetRegistrySource, /import\.meta\.url/);
  assert.doesNotMatch(fateKnotsContentLoaderSource, /from "node:/);
  assert.doesNotMatch(fateKnotsContentLoaderSource, /import\.meta\.url/);
});
