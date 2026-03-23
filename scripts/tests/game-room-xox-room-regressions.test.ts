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
  "rooms/game-room/i18n/en.json",
  "rooms/game-room/i18n/tr.json",
  "rooms/game-room/protocols/game-room-xox-user-start.md",
  "rooms/game-room/protocols/game-room-xox-ai-start.md",
  "rooms/game-room/assets/room-background.webp",
  "rooms/game-room/assets/xox-view.webp",
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
  assert.equal(validation.manifest?.features[0]?.id, "xox");
  assert.equal(validation.manifest?.runtime.uiEntry, "ui/index.html");
  assert.equal(validation.manifest?.runtime.hostEntry, "host/index.js");
});

test("game-room XOX UI forwards remote identity with invite actions", () => {
  const uiSource = readFileSync("rooms/game-room/ui/index.js", "utf8");

  assert.match(
    uiSource,
    /sendRoomCommand\("GameRoomXoxAcceptInvite",\s*\{\s*inviteId:\s*inviteId,\s*remoteUserId:\s*remoteUserId,\s*\}\s*\)/
  );
  assert.match(
    uiSource,
    /sendRoomCommand\("GameRoomXoxRejectInvite",\s*\{\s*inviteId:\s*inviteId,\s*remoteUserId:\s*remoteUserId,\s*\}\s*\)/
  );
});
