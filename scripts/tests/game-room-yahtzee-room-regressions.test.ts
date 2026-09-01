import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "YAHTZEE.md",
  "rooms/game-room/main-functions/yahtzee/host/engine.ts",
  "rooms/game-room/main-functions/yahtzee/host/state.ts",
  "rooms/game-room/main-functions/yahtzee/host/runtime.ts",
  "rooms/game-room/main-functions/yahtzee/host/protocol.ts",
  "rooms/game-room/main-functions/yahtzee/host/transport.ts",
  "rooms/game-room/main-functions/yahtzee/ui/runtime.js",
  "rooms/game-room/main-functions/yahtzee/ui/bridge.js",
  "rooms/game-room/main-functions/yahtzee/ui/babylon-scene.js",
  "rooms/game-room/main-functions/yahtzee/assets/hybrid/deck-stage-v3.webp",
  "rooms/game-room/main-functions/yahtzee/assets/hybrid/table-mahogany-v2.webp",
  "rooms/game-room/main-functions/yahtzee/assets/hybrid/table-felt-burgundy-v2.webp",
  "rooms/game-room/main-functions/yahtzee/styles.css",
  "rooms/game-room/main-functions/yahtzee/multiplayer.css",
  "rooms/game-room/main-functions/yahtzee/vendor/babylon-runtime-entry.js",
  "rooms/game-room/main-functions/yahtzee/vendor/babylon.min.js",
  "rooms/game-room/main-functions/yahtzee/vendor/LICENSE.babylonjs.md",
  "rooms/game-room/main-functions/yahtzee/vendor/NOTICE.babylonjs.md",
  "rooms/game-room/main-functions/yahtzee/protocols/game-room-yahtzee-ai-turn.md",
  "rooms/game-room/main-functions/yahtzee/protocols/game-room-yahtzee-us1-transport.md",
  "rooms/game-room/scripts/build-babylon-runtime.mjs",
];

void test("Game Room keeps the complete Yahtzee source and room-local Babylon runtime", () => {
  for (const filePath of requiredFiles) {
    assert.equal(existsSync(filePath), true, filePath);
  }
});

void test("Game Room manifest exposes Yahtzee multiplayer commands and protocols", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8")) as Record<
    string,
    unknown
  >;
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(validation.manifest?.version, "2.8.0");

  const feature = validation.manifest?.features.find((entry) => entry.id === "yahtzee");
  assert.ok(feature);
  assert.deepEqual(
    feature.commandSpecs?.map((entry) => entry.name),
    [
      "GameRoomYahtzeeStart",
      "GameRoomYahtzeeReset",
      "GameRoomYahtzeeRoll",
      "GameRoomYahtzeeToggleHold",
      "GameRoomYahtzeeScore",
      "GameRoomYahtzeeAiAction",
      "GameRoomYahtzeeRemoteStart",
      "GameRoomYahtzeeRemoteSync",
      "GameRoomYahtzeeRemoteReset",
    ]
  );
  assert.deepEqual(
    feature.protocolSpecs?.map((entry) => entry.key),
    ["game-room-yahtzee-ai-turn", "game-room-yahtzee-us1-transport"]
  );
  assert.deepEqual(
    feature.protocolSpecs?.map((entry) => entry.path),
    [
      "main-functions/yahtzee/protocols/game-room-yahtzee-ai-turn.md",
      "main-functions/yahtzee/protocols/game-room-yahtzee-us1-transport.md",
    ]
  );
});

void test("Yahtzee browser runtime loads the vendored Babylon subset before the scene adapter", () => {
  const html = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const vendorIndex = html.indexOf("main-functions/yahtzee/vendor/babylon.min.js");
  const sceneIndex = html.indexOf("main-functions/yahtzee/ui/babylon-scene.js");
  const runtimeIndex = html.indexOf("main-functions/yahtzee/ui/runtime.js");

  assert.ok(vendorIndex >= 0, "Babylon vendor script is missing from Game Room UI");
  assert.ok(
    sceneIndex > vendorIndex,
    "Babylon scene adapter must load after Babylon vendor runtime"
  );
  assert.ok(
    runtimeIndex > sceneIndex,
    "Yahtzee UI runtime must load after the Babylon scene adapter"
  );
});

void test("Yahtzee Babylon vendor build stays reproducible and licensed", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.["rooms:vendor:game-room"],
    "node rooms/game-room/scripts/build-babylon-runtime.mjs"
  );
  assert.equal(typeof packageJson.devDependencies?.["@babylonjs/core"], "string");

  const vendorEntry = readFileSync(
    "rooms/game-room/main-functions/yahtzee/vendor/babylon-runtime-entry.js",
    "utf8"
  );
  assert.match(vendorEntry, /@babylonjs\/core\/Engines\/engine\.js/);
  assert.match(vendorEntry, /@babylonjs\/core\/Culling\/ray\.js/);
  assert.match(vendorEntry, /@babylonjs\/core\/Materials\/Textures\/texture\.js/);
  assert.match(vendorEntry, /@babylonjs\/core\/Meshes\/Builders\/polyhedronBuilder\.js/);
  assert.match(vendorEntry, /globalThis\.BABYLON/);

  const bundleHeader = readFileSync(
    "rooms/game-room/main-functions/yahtzee/vendor/babylon.min.js",
    "utf8"
  ).slice(0, 240);
  assert.match(bundleHeader, /Babylon\.js room runtime/);
  assert.match(bundleHeader, /Apache-2\.0/);
});
