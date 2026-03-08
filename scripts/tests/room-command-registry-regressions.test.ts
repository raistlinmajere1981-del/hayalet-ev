import test from "node:test";
import assert from "node:assert/strict";
import type { InstalledRoomRecord } from "../../src/types/rooms.ts";
import { RoomCommandRegistry } from "../../src/js/modules/rooms/room-command-registry.ts";

const room: InstalledRoomRecord = {
  id: "xox",
  name: "XOX Room",
  version: "1.0.0",
  installedDir: "/workspace/data/rooms/xox",
  sourceDir: "/workspace/rooms/xox",
  manifestPath: "/workspace/data/rooms/xox/manifest.json",
  runtimeEntryPath: "/workspace/data/rooms/xox/ui/index.html",
  hostEntryPath: "/workspace/data/rooms/xox/host/index.js",
  commandSpecs: [
    {
      name: "XOXUserMove",
      description: "Apply user move from room UI",
      scope: "room-ui",
    },
    {
      name: "XOXAIMove",
      description: "Apply AI move from slot response",
      scope: "ai-slots",
    },
  ],
  installedAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T00:00:00.000Z",
};

test("RoomCommandRegistry syncs manifest command metadata into catalog", () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  assert.equal(RoomCommandRegistry.has("XOXUserMove"), true);
  assert.equal(RoomCommandRegistry.getMetadata("XOXUserMove")?.roomId, "xox");
  assert.deepEqual(RoomCommandRegistry.listCommands("ai1-ai2"), ["XOXAIMove", "XOXUserMove"]);
});

test("RoomCommandRegistry runs room-ui commands with structured payloads", async () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  RoomCommandRegistry.registerHandler("xox", "XOXUserMove", async (payload) => payload.roomArgs);

  const result = await RoomCommandRegistry.run("XOXUserMove", {
    provider: "room-ui",
    roomPayload: { cell: 4, symbol: "X" },
  });

  assert.deepEqual(result, { cell: 4, symbol: "X" });
});

test("RoomCommandRegistry parses AI args and enforces scope rules", async () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  RoomCommandRegistry.registerHandler("xox", "XOXAIMove", async (payload) => payload.roomArgs);
  RoomCommandRegistry.registerHandler("xox", "XOXUserMove", async (payload) => payload.roomArgs);

  const allowed = await RoomCommandRegistry.run("XOXAIMove", {
    provider: "ai1",
    args: '{"cell":8,"symbol":"O"}',
  });
  const blocked = (await RoomCommandRegistry.run("XOXUserMove", {
    provider: "ai1",
    args: '{"cell":2}',
  })) as { success?: boolean; message?: string };

  assert.deepEqual(allowed, { cell: 8, symbol: "O" });
  assert.equal(blocked.success, false);
  assert.match(blocked.message ?? "", /kapsam/i);
});
