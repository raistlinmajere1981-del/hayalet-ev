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
  features: [{ id: "xox", name: "XOX" }],
  protocolSpecs: [
    {
      key: "game-room-xox-user-start",
      room: "game-room",
      scenario: "xox-user-start",
      title: "[START][GAME-ROOM][XOX][USER-FIRST]",
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

  assert.equal(resolved?.key, "game-room-xox-user-start");
  assert.equal(resolved?.title, "[START][GAME-ROOM][XOX][USER-FIRST]");
  assert.deepEqual(RoomProtocolRegistry.listKnownKeys(), ["game-room-xox-user-start"]);
});

test("RoomProtocolRegistry merges runtime and saved protocol bodies", async () => {
  RoomProtocolRegistry.reset();
  await RoomProtocolRegistry.syncInstalledRooms([room]);
  RoomProtocolRegistry.registerRuntimeProtocols("game-room", {
    "game-room-xox-user-start": "Prepare the XOX board for the user-first match.",
  });

  const merged = RoomProtocolRegistry.mergeProtocolMap({
    "game-room-xox-user-start": "Saved override body",
  });

  assert.equal(merged["game-room-xox-user-start"], "Saved override body");
});
