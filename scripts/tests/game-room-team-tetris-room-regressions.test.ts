import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/game-room/main-functions/team-tetris/protocols/game-room-team-tetris-ai-opening.md",
  "rooms/game-room/main-functions/team-tetris/protocols/game-room-team-tetris-ai-followup.md",
  "rooms/game-room/main-functions/team-tetris/protocols/game-room-team-tetris-us1-transport.md",
  "rooms/game-room/shared/host/command-args.js",
  "rooms/game-room/main-functions/team-tetris/host/state.js",
  "rooms/game-room/main-functions/team-tetris/host/runtime.js",
  "rooms/game-room/main-functions/team-tetris/ui/module.js",
  "rooms/game-room/main-functions/team-tetris/styles.css",
  "rooms/game-room/ui/context-runtime.js",
  "rooms/game-room/main-functions/xox/host/runtime.js",
  "rooms/game-room/main-functions/team-tetris/assets/team-tetris-view.webp",
];

test("game-room workspace keeps the required Team Tetris package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room manifest exposes Team Tetris as a second feature with scene metadata", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  const feature = validation.manifest?.features.find((entry) => entry.id === "team-tetris");

  assert.ok(feature);
  assert.equal(feature?.scene?.hotspot.id, "game-room-team-tetris");
  assert.equal(feature?.scene?.view.id, "team-tetris-closeup");
  assert.equal(
    feature?.scene?.view.backgroundSrc,
    "main-functions/team-tetris/assets/team-tetris-view.webp"
  );
  assert.deepEqual(
    feature?.commandSpecs?.map((entry) => entry.name),
    [
      "GameRoomTeamTetrisStart",
      "GameRoomTeamTetrisReset",
      "GameRoomTeamTetrisUserMove",
      "GameRoomTeamTetrisAiMove",
      "GameRoomTeamTetrisRemoteMove",
    ]
  );
  assert.deepEqual(
    feature?.protocolSpecs?.map((entry) => entry.key),
    [
      "game-room-team-tetris-ai-opening",
      "game-room-team-tetris-ai-followup",
      "game-room-team-tetris-us1-transport",
    ]
  );
});

test("game-room Team Tetris UI and host sources expose the new feature shell", () => {
  const uiSource = readFileSync("rooms/game-room/ui/index.js", "utf8");
  const indexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const teamTetrisUiSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/ui/module.js",
    "utf8"
  );
  const hostSource = readFileSync("rooms/game-room/host/index.js", "utf8");
  const xoxRuntimeSource = readFileSync(
    "rooms/game-room/main-functions/xox/host/runtime.js",
    "utf8"
  );

  assert.match(indexHtmlSource, /<script src="\.\/context-runtime\.js"><\/script>/);
  assert.match(uiSource, /message\.type === "team-tetris-state"/);
  assert.match(uiSource, /getActiveFeatureId\(\) === TEAM_TETRIS_FEATURE_ID/);
  assert.match(teamTetrisUiSource, /GameRoomTeamTetrisStart/);
  assert.match(hostSource, /GameRoomTeamTetrisStart/);
  assert.match(hostSource, /pushActiveFeatureState\(api\)/);
  assert.match(xoxRuntimeSource, /resetTeamTetrisState\(api, "activeFeatureReset"\)/);
});
