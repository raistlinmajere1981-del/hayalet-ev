import test from "node:test";
import assert from "node:assert/strict";
import type { InstalledRoomRecord } from "../../src/types/rooms.ts";
import { RoomCommandRegistry } from "../../src/js/modules/rooms/room-command-registry.ts";

const room: InstalledRoomRecord = {
  id: "game-room",
  name: "Game Room",
  version: "2.2.0",
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
  commandSpecs: [
    {
      name: "GameRoomXoxUserMove",
      description: "Apply the user move from room UI",
      scope: "room-ui",
    },
    {
      name: "GameRoomXoxAiMove",
      description: "Apply AI move from slot response",
      scope: "ai-slots",
    },
    {
      name: "GameRoomXoxRemoteMove",
      description: "Apply remote user move from US1",
      scope: "us1",
    },
    {
      name: "GameRoomTeamTetrisStart",
      description: "Start Team Tetris from room UI",
      scope: "room-ui",
    },
    {
      name: "GameRoomTeamTetrisAiMove",
      description: "Apply Team Tetris AI move from slot response",
      scope: "ai-slots",
    },
    {
      name: "GameRoomTeamTetrisRemoteMove",
      description: "Apply Team Tetris remote move from US1",
      scope: "us1",
    },
    {
      name: "GameRoomFateKnotsStart",
      description: "Start Fate Knots from room UI",
      scope: "room-ui",
    },
    {
      name: "GameRoomFateKnotsAiChoice",
      description: "Apply Fate Knots AI decision vote",
      scope: "ai-slots",
    },
    {
      name: "GameRoomFateKnotsRemoteChoice",
      description: "Apply Fate Knots remote decision vote",
      scope: "us1",
    },
  ],
  installedAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T00:00:00.000Z",
};

test("RoomCommandRegistry syncs manifest command metadata into catalog", () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  assert.equal(RoomCommandRegistry.has("GameRoomXoxUserMove"), true);
  assert.equal(RoomCommandRegistry.getMetadata("GameRoomXoxUserMove")?.roomId, "game-room");
  assert.deepEqual(RoomCommandRegistry.listCommands("ai1-ai2"), [
    "GameRoomFateKnotsAiChoice",
    "GameRoomFateKnotsStart",
    "GameRoomTeamTetrisAiMove",
    "GameRoomTeamTetrisStart",
    "GameRoomXoxAiMove",
    "GameRoomXoxUserMove",
  ]);
  assert.deepEqual(RoomCommandRegistry.listCommands("us1"), [
    "GameRoomFateKnotsRemoteChoice",
    "GameRoomTeamTetrisRemoteMove",
    "GameRoomXoxRemoteMove",
  ]);
});

test("RoomCommandRegistry runs room-ui commands with structured payloads", async () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  RoomCommandRegistry.registerHandler("game-room", "GameRoomXoxUserMove", async (payload) => payload.roomArgs);

  const result = await RoomCommandRegistry.run("GameRoomXoxUserMove", {
    provider: "room-ui",
    roomPayload: { cell: 4, symbol: "X" },
  });

  assert.deepEqual(result, { cell: 4, symbol: "X" });
});

test("RoomCommandRegistry parses AI args and enforces scope rules", async () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  RoomCommandRegistry.registerHandler("game-room", "GameRoomXoxAiMove", async (payload) => payload.roomArgs);
  RoomCommandRegistry.registerHandler(
    "game-room",
    "GameRoomFateKnotsAiChoice",
    async (payload) => payload.roomArgs
  );
  RoomCommandRegistry.registerHandler("game-room", "GameRoomXoxUserMove", async (payload) => payload.roomArgs);
  RoomCommandRegistry.registerHandler(
    "game-room",
    "GameRoomXoxRemoteMove",
    async (payload) => payload.roomArgs
  );

  const allowed = await RoomCommandRegistry.run("GameRoomXoxAiMove", {
    provider: "ai1",
    args: '{"cell":8,"symbol":"O"}',
  });
  const blocked = (await RoomCommandRegistry.run("GameRoomXoxUserMove", {
    provider: "ai1",
    args: '{"cell":2}',
  })) as { success?: boolean; message?: string };
  const fateKnotsAllowed = await RoomCommandRegistry.run("GameRoomFateKnotsAiChoice", {
    provider: "ai1",
    args: '{"sessionId":"fk-1","stepId":"gate-arrival","choiceId":"follow-lantern"}',
  });
  const us1Allowed = await RoomCommandRegistry.run("GameRoomXoxRemoteMove", {
    provider: "us1",
    args: '{"inviteId":"invite-1","cell":4}',
  });
  const us1Blocked = (await RoomCommandRegistry.run("GameRoomXoxUserMove", {
    provider: "us1",
    args: '{"cell":2}',
  })) as { success?: boolean; message?: string };

  assert.deepEqual(allowed, { cell: 8, symbol: "O" });
  assert.equal(blocked.success, false);
  assert.match(blocked.message ?? "", /scope|kapsam/i);
  assert.deepEqual(fateKnotsAllowed, {
    sessionId: "fk-1",
    stepId: "gate-arrival",
    choiceId: "follow-lantern",
  });
  assert.deepEqual(us1Allowed, { inviteId: "invite-1", cell: 4 });
  assert.equal(us1Blocked.success, false);
  assert.match(us1Blocked.message ?? "", /scope|kapsam/i);
});
