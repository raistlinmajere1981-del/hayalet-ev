import test from "node:test";
import assert from "node:assert/strict";
import type { InstalledRoomRecord } from "../../src/types/rooms.ts";
import { RoomProtocolRegistry } from "../../src/js/modules/rooms/room-protocol-registry.ts";

const room: InstalledRoomRecord = {
  id: "xox",
  name: "XOX Room",
  version: "1.0.0",
  installedDir: "/workspace/data/rooms/xox",
  sourceDir: "/workspace/rooms/xox",
  manifestPath: "/workspace/data/rooms/xox/manifest.json",
  runtimeEntryPath: "/workspace/data/rooms/xox/ui/index.html",
  hostEntryPath: "/workspace/data/rooms/xox/host/index.js",
  protocolSpecs: [
    {
      key: "xox-start",
      room: "xox",
      scenario: "start",
      title: "[START][XOX]",
      editable: true,
    },
  ],
  installedAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T00:00:00.000Z",
};

test("RoomProtocolRegistry resolves manifest protocol metadata", async () => {
  RoomProtocolRegistry.reset();
  await RoomProtocolRegistry.syncInstalledRooms([room]);

  const resolved = RoomProtocolRegistry.resolve("xox", "start");

  assert.equal(resolved?.key, "xox-start");
  assert.equal(resolved?.title, "[START][XOX]");
  assert.deepEqual(RoomProtocolRegistry.listKnownKeys(), ["xox-start"]);
});

test("RoomProtocolRegistry merges runtime and saved protocol bodies", async () => {
  RoomProtocolRegistry.reset();
  await RoomProtocolRegistry.syncInstalledRooms([room]);
  RoomProtocolRegistry.registerRuntimeProtocols("xox", {
    "xox-start": "You are playing XOX against the user.",
  });

  const merged = RoomProtocolRegistry.mergeProtocolMap({
    "xox-start": "Saved override body",
  });

  assert.equal(merged["xox-start"], "Saved override body");
});
