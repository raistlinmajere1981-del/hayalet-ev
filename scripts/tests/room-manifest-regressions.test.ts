import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ROOM_SCHEMA_VERSION,
  isValidRoomCommandName,
  isValidRoomId,
  normalizeRoomRelativePath,
  resolveRoomProtocolFilePath,
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

test("protocol specs support explicit safe relative paths", () => {
  const result = validateRoomManifest({
    schemaVersion: ROOM_SCHEMA_VERSION,
    id: "protocol-room",
    name: "Protocol Room",
    version: "1.0.0",
    menu: {
      label: "Protocol Room",
    },
    runtime: {
      uiEntry: "ui/index.html",
      hostEntry: "host/index.js",
    },
    defaultFeatureId: "primary",
    features: [
      {
        id: "primary",
        name: "Primary",
        protocolSpecs: [
          {
            key: "primary-start",
            room: "protocol-room",
            scenario: "primary-start",
            title: "[START][PROTOCOL-ROOM][PRIMARY]",
            path: "main-functions/primary/protocols/primary-start.md",
          },
        ],
      },
    ],
  });

  assert.equal(result.valid, true);
  assert.equal(
    result.manifest?.features[0]?.protocolSpecs?.[0]?.path,
    "main-functions/primary/protocols/primary-start.md"
  );
  assert.equal(
    resolveRoomProtocolFilePath(result.manifest?.features[0]?.protocolSpecs?.[0] ?? {
      key: "",
      room: "",
      scenario: "",
      title: "",
    }),
    "main-functions/primary/protocols/primary-start.md"
  );
});

test("room id and command validators match project rules", () => {
  assert.equal(isValidRoomId("game-room"), true);
  assert.equal(isValidRoomId("game_room"), false);
  assert.equal(isValidRoomCommandName("GameRoomStartMatch"), true);
  assert.equal(isValidRoomCommandName("Game.Room"), false);
});

test("game-room manifest documents the US1 XOX transport contract", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const result = validateRoomManifest(manifest);

  assert.equal(result.valid, true);
  const xoxFeature = result.manifest?.features.find((feature) => feature.id === "xox");
  assert.ok(xoxFeature);
  assert.equal(
    xoxFeature?.protocolSpecs?.some((spec) => spec.key === "game-room-xox-us1-transport"),
    true
  );
});

test("game-room manifest documents the Team Tetris AI and US1 contracts", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const result = validateRoomManifest(manifest);

  assert.equal(result.valid, true);
  const teamTetrisFeature = result.manifest?.features.find((feature) => feature.id === "team-tetris");
  assert.ok(teamTetrisFeature);
  assert.equal(
    teamTetrisFeature?.protocolSpecs?.some((spec) => spec.key === "game-room-team-tetris-ai-opening"),
    true
  );
  assert.equal(
    teamTetrisFeature?.protocolSpecs?.some((spec) => spec.key === "game-room-team-tetris-ai-followup"),
    true
  );
  assert.equal(
    teamTetrisFeature?.protocolSpecs?.some((spec) => spec.key === "game-room-team-tetris-us1-transport"),
    true
  );
});

test("room manifest readers stay split from the main room contract module", () => {
  const roomsSource = readFileSync("src/types/rooms.ts", "utf8");
  const readersSource = readFileSync("src/types/room-manifest-readers.ts", "utf8");
  const sceneReadersSource = readFileSync("src/types/room-scene-readers.ts", "utf8");

  assert.match(roomsSource, /from "\.\/room-manifest-readers\.js"/);
  assert.match(roomsSource, /from "\.\/room-scene-readers\.js"/);
  assert.match(readersSource, /export function readMenuConfig\(/);
  assert.match(readersSource, /export function readRuntimeConfig\(/);
  assert.match(readersSource, /export function readCommandSpecs\(/);
  assert.match(readersSource, /export function readProtocolSpecs\(/);
  assert.match(readersSource, /export function readI18nConfig\(/);
  assert.match(sceneReadersSource, /export function createRoomSceneReaders\(/);
  assert.match(sceneReadersSource, /function readFeatureManifest\(/);
  assert.match(sceneReadersSource, /function readSceneConfig\(/);
});
