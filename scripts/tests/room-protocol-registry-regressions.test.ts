import test from "node:test";
import assert from "node:assert/strict";
import type { InstalledRoomRecord } from "../../src/types/rooms.ts";
import { RoomProtocolRegistry } from "../../src/js/modules/rooms/room-protocol-registry.ts";

const room: InstalledRoomRecord = {
  id: "game-room",
  name: "Game Room",
  version: "2.1.0",
  installedDir: "/workspace/data/rooms/game-room",
  sourceDir: "/workspace/rooms/game-room",
  manifestPath: "/workspace/data/rooms/game-room/manifest.json",
  runtimeEntryPath: "/workspace/data/rooms/game-room/ui/index.html",
  hostEntryPath: "/workspace/data/rooms/game-room/host/index.js",
  defaultFeatureId: "xox",
  features: [
    { id: "xox", name: "XOX" },
    { id: "team-tetris", name: "Team Tetris" },
    { id: "fate-knots", name: "Fate Knots" },
  ],
  protocolSpecs: [
    {
      key: "game-room-xox-user-start",
      room: "game-room",
      scenario: "xox-user-start",
      title: "[START][GAME-ROOM][XOX][USER-FIRST]",
      editable: true,
    },
    {
      key: "game-room-team-tetris-ai-opening",
      room: "game-room",
      scenario: "team-tetris-ai-opening",
      title: "[TURN][GAME-ROOM][TEAM-TETRIS][AI][OPENING]",
      editable: true,
    },
    {
      key: "game-room-fate-knots-ai-decision",
      room: "game-room",
      scenario: "fate-knots-ai-decision",
      title: "[TURN][GAME-ROOM][FATE-KNOTS][AI][DECISION]",
      editable: true,
    },
  ],
  installedAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T00:00:00.000Z",
};

test("RoomProtocolRegistry resolves manifest protocol metadata", async () => {
  RoomProtocolRegistry.reset();
  await RoomProtocolRegistry.syncInstalledRooms([room]);

  const resolved = RoomProtocolRegistry.resolve("game-room", "xox-user-start");
  const teamTetrisResolved = RoomProtocolRegistry.resolve("game-room", "team-tetris-ai-opening");
  const fateKnotsResolved = RoomProtocolRegistry.resolve("game-room", "fate-knots-ai-decision");

  assert.equal(resolved?.key, "game-room-xox-user-start");
  assert.equal(resolved?.title, "[START][GAME-ROOM][XOX][USER-FIRST]");
  assert.equal(teamTetrisResolved?.key, "game-room-team-tetris-ai-opening");
  assert.equal(fateKnotsResolved?.key, "game-room-fate-knots-ai-decision");
  assert.deepEqual(RoomProtocolRegistry.listKnownKeys(), [
    "game-room-fate-knots-ai-decision",
    "game-room-team-tetris-ai-opening",
    "game-room-xox-user-start",
  ]);
});

test("RoomProtocolRegistry merges runtime and saved protocol bodies", async () => {
  RoomProtocolRegistry.reset();
  await RoomProtocolRegistry.syncInstalledRooms([room]);
  RoomProtocolRegistry.registerRuntimeProtocols("game-room", {
    "game-room-xox-user-start": "Prepare the XOX board for the user-first match.",
  });

  const merged = await RoomProtocolRegistry.mergeProtocolMap({
    "game-room-xox-user-start": "Saved override body",
  });

  assert.equal(merged["game-room-xox-user-start"], "Saved override body");
});

test("RoomProtocolRegistry prefers locale-specific bodies and falls back to Turkish", async () => {
  const readFileCalls: string[] = [];
  const electronWindow = {
    electronAPI: {
      readFile: async (filePath: string): Promise<string | null> => {
        readFileCalls.push(filePath);

        if (filePath.endsWith("/protocols/en/game-room-xox-user-start.md")) {
          return "EN localized body";
        }

        if (filePath.endsWith("/protocols/tr/game-room-xox-user-start.md")) {
          return "TR fallback body";
        }

        if (filePath.endsWith("/protocols/game-room-xox-user-start.md")) {
          return "EN base body";
        }

        return null;
      },
    },
  };

  Object.assign(globalThis, { window: electronWindow });

  RoomProtocolRegistry.reset();
  await RoomProtocolRegistry.syncInstalledRooms([room]);

  const mergedTr = await RoomProtocolRegistry.mergeProtocolMap({}, { locale: "tr" });
  const mergedEn = await RoomProtocolRegistry.mergeProtocolMap({}, { locale: "en" });
  const mergedEnUs = await RoomProtocolRegistry.mergeProtocolMap({}, { locale: "en-US" });
  const mergedDe = await RoomProtocolRegistry.mergeProtocolMap({}, { locale: "de" });

  assert.equal(mergedTr["game-room-xox-user-start"], "TR fallback body");
  assert.equal(mergedEn["game-room-xox-user-start"], "EN localized body");
  assert.equal(mergedEnUs["game-room-xox-user-start"], "TR fallback body");
  assert.equal(mergedDe["game-room-xox-user-start"], "TR fallback body");
  assert.ok(
    readFileCalls.some((filePath) => filePath.endsWith("/protocols/en/game-room-xox-user-start.md"))
  );
  assert.ok(
    readFileCalls.some((filePath) => filePath.endsWith("/protocols/tr/game-room-xox-user-start.md"))
  );

  delete (globalThis as { window?: unknown }).window;
});
