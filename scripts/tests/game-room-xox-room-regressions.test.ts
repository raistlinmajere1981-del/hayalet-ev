import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredFiles = [
  "rooms/game-room/manifest.json",
  "rooms/game-room/host/index.js",
  "rooms/game-room/ui/index.html",
  "rooms/game-room/ui/index.js",
  "rooms/game-room/ui/style.css",
  "rooms/game-room/shared/host/feature-meta.js",
  "rooms/game-room/shared/host/text.js",
  "rooms/game-room/shared/host/context-state.js",
  "rooms/game-room/shared/styles/base.css",
  "rooms/game-room/i18n/en.json",
  "rooms/game-room/i18n/tr.json",
  "rooms/game-room/main-functions/xox/protocols/game-room-xox-user-start.md",
  "rooms/game-room/main-functions/xox/protocols/game-room-xox-ai-start.md",
  "rooms/game-room/main-functions/xox/host/state.js",
  "rooms/game-room/main-functions/xox/ui/module.js",
  "rooms/game-room/main-functions/xox/styles.css",
  "rooms/game-room/shared/assets/room-background.webp",
  "rooms/game-room/main-functions/xox/assets/xox-view.webp",
];

test("game-room workspace keeps the required XOX package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room manifest validates with the XOX-first room contract", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.id, "game-room");
  assert.equal(validation.manifest?.defaultFeatureId, "xox");
  assert.deepEqual(
    validation.manifest?.features.map((feature) => feature.id),
    ["xox", "team-tetris"]
  );
  assert.equal(validation.manifest?.runtime.uiEntry, "ui/index.html");
  assert.equal(validation.manifest?.runtime.hostEntry, "host/index.js");
  assert.equal(validation.manifest?.scene?.characterRosterPreset, "connected-plus-user");
  assert.equal(validation.manifest?.scene?.characters?.length, 3);
  assert.equal(validation.manifest?.scene?.chrome?.pageShellVariant, "immersive-stage");
});

test("game-room XOX UI forwards remote identity with invite actions", () => {
  const uiSource = readFileSync("rooms/game-room/main-functions/xox/ui/module.js", "utf8");

  assert.match(
    uiSource,
    /sendRoomCommand\("GameRoomXoxAcceptInvite",\s*\{\s*inviteId:\s*inviteId,\s*remoteUserId:\s*remoteUserId,\s*\}\s*\)/
  );
  assert.match(
    uiSource,
    /sendRoomCommand\("GameRoomXoxRejectInvite",\s*\{\s*inviteId:\s*inviteId,\s*remoteUserId:\s*remoteUserId,\s*\}\s*\)/
  );
});
