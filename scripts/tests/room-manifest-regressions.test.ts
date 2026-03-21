import test from "node:test";
import assert from "node:assert/strict";
import {
  ROOM_SCHEMA_VERSION,
  isValidRoomCommandName,
  isValidRoomId,
  normalizeRoomRelativePath,
  validateRoomManifest,
} from "../../src/types/rooms.ts";

test("validateRoomManifest accepts a minimal valid room manifest", () => {
  const result = validateRoomManifest({
    schemaVersion: ROOM_SCHEMA_VERSION,
    id: "game-room",
    name: "Game Room",
    version: "2.1.0",
    menu: {
      label: "Game Room",
      icon: "GM",
    },
    runtime: {
      uiEntry: "ui/index.html",
      hostEntry: "host/index.js",
    },
    defaultFeatureId: "xox",
    features: [
      {
        id: "xox",
        name: "XOX",
        commandSpecs: [{ name: "GameRoomXoxAiMove", scope: "ai-slots" }],
        protocolSpecs: [
          {
            key: "game-room-xox-user-start",
            room: "game-room",
            scenario: "xox-user-start",
            title: "[START][GAME-ROOM][XOX][USER-FIRST]",
            editable: true,
          },
        ],
        scene: {
          hotspot: {
            id: "game-room-xox",
            rect: { leftPx: 100, topPx: 200, widthPx: 180, heightPx: 120 },
            label: { text: "XOX" },
          },
          view: {
            id: "xox-closeup",
            backgroundSrc: "assets/xox-view.webp",
          },
        },
      },
    ],
    scene: {
      referenceSize: { width: 1600, height: 900 },
      roomBackgroundSrc: "assets/room-background.webp",
      roomsHotspot: {
        id: "game-room-door",
        rect: { leftPx: 700, topPx: 240, widthPx: 160, heightPx: 300 },
      },
      backHotspot: {
        id: "game-room-back",
        rect: { leftPx: 70, topPx: 180, widthPx: 120, heightPx: 240 },
      },
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest?.id, "game-room");
  assert.equal(result.manifest?.runtime.uiEntry, "ui/index.html");
  assert.equal(result.manifest?.defaultFeatureId, "xox");
});

test("validateRoomManifest rejects invalid ids, commands, and unsafe paths", () => {
  const result = validateRoomManifest({
    schemaVersion: ROOM_SCHEMA_VERSION,
    id: "Game Room",
    name: "Bad Room",
    version: "1.0",
    menu: {
      label: "Bad",
    },
    runtime: {
      uiEntry: "../ui/index.html",
      hostEntry: "/host/index.js",
    },
    defaultFeatureId: "broken",
    features: [
      {
        id: "broken",
        name: "Broken",
        commandSpecs: [{ name: "Game.Room" }],
      },
    ],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /id must match/);
  assert.match(result.errors.join("\n"), /version must look like semver/);
  assert.match(result.errors.join("\n"), /runtime\.uiEntry must be a safe relative path/);
  assert.match(result.errors.join("\n"), /runtime\.hostEntry must be a safe relative path/);
  assert.match(result.errors.join("\n"), /commandSpecs\[0\]\.name must match/);
});

test("normalizeRoomRelativePath blocks traversal and preserves safe paths", () => {
  assert.equal(normalizeRoomRelativePath("ui/index.html"), "ui/index.html");
  assert.equal(normalizeRoomRelativePath("ui\\index.html"), "ui/index.html");
  assert.equal(normalizeRoomRelativePath("../escape.js"), null);
  assert.equal(normalizeRoomRelativePath("/absolute/file.js"), null);
});

test("room id and command validators match project rules", () => {
  assert.equal(isValidRoomId("game-room"), true);
  assert.equal(isValidRoomId("game_room"), false);
  assert.equal(isValidRoomCommandName("GameRoomStartMatch"), true);
  assert.equal(isValidRoomCommandName("Game.Room"), false);
});
