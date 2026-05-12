import test from "node:test";
import assert from "node:assert/strict";
import type { InstalledRoomRecord } from "../../src/types/rooms.ts";
import { RoomCommandRegistry } from "../../src/js/modules/rooms/room-command-registry.ts";

const room: InstalledRoomRecord = {
  id: "game-room",
  name: "Game Room",
  version: "2.2.0",
  installedDir: "/workspace/rooms/.build/game-room/runtime",
  sourceDir: "/workspace/rooms/game-room",
  manifestPath: "/workspace/rooms/.build/game-room/runtime/manifest.json",
  runtimeEntryPath: "/workspace/rooms/.build/game-room/runtime/ui/index.html",
  hostEntryPath: "/workspace/rooms/.build/game-room/runtime/host/index.js",
  defaultFeatureId: "backgammon",
  features: [
    { id: "backgammon", name: "Tavla" },
    { id: "team-tetris", name: "Team Tetris" },
    { id: "fate-knots", name: "Fate Knots" },
  ],
  commandSpecs: [
    {
      name: "GameRoomBackgammonUserMove",
      description: "Apply the user move from room UI",
      scope: "room-ui",
    },
    {
      name: "GameRoomBackgammonAiMove",
      description: "Apply AI move from slot response",
      scope: "ai-slots",
    },
    {
      name: "GameRoomBackgammonRemoteMove",
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
    {
      name: "GameRoomInternalBridgeOnly",
      description: "Internal bridge-only action",
      scope: "ai-slots",
      exposure: "internal",
    },
  ],
  installedAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T00:00:00.000Z",
};

const roomWithSharedCommand: InstalledRoomRecord = {
  ...room,
  commandSpecs: [
    ...(room.commandSpecs ?? []),
    {
      name: "SharedRoomAction",
      description: "Shared command name owned by game room",
      scope: "room-ui",
    },
  ],
};

const forgeRoomWithSharedCommand: InstalledRoomRecord = {
  ...room,
  id: "forge-room",
  name: "Forge Room",
  installedDir: "/workspace/rooms/.build/forge-room/runtime",
  sourceDir: "/workspace/rooms/forge-room",
  manifestPath: "/workspace/rooms/.build/forge-room/runtime/manifest.json",
  runtimeEntryPath: "/workspace/rooms/.build/forge-room/runtime/ui/index.html",
  hostEntryPath: "/workspace/rooms/.build/forge-room/runtime/host/index.js",
  commandSpecs: [
    {
      name: "SharedRoomAction",
      description: "Shared command name owned by forge room",
      scope: "room-ui",
    },
  ],
};

test("RoomCommandRegistry syncs manifest command metadata into catalog", () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  assert.equal(RoomCommandRegistry.has("GameRoomBackgammonUserMove"), true);
  assert.equal(RoomCommandRegistry.getMetadata("GameRoomBackgammonUserMove")?.roomId, "game-room");
  assert.deepEqual(RoomCommandRegistry.listCommands("ai1-ai2"), [
    "GameRoomBackgammonAiMove",
    "GameRoomBackgammonUserMove",
    "GameRoomFateKnotsAiChoice",
    "GameRoomFateKnotsStart",
    "GameRoomInternalBridgeOnly",
    "GameRoomTeamTetrisAiMove",
    "GameRoomTeamTetrisStart",
  ]);
  assert.deepEqual(RoomCommandRegistry.listCommands("us1"), [
    "GameRoomBackgammonRemoteMove",
    "GameRoomFateKnotsRemoteChoice",
    "GameRoomTeamTetrisRemoteMove",
  ]);
});

test("RoomCommandRegistry hides internal commands from the public catalog", async () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);
  RoomCommandRegistry.registerHandler(
    "game-room",
    "GameRoomInternalBridgeOnly",
    async (payload) => payload.roomArgs
  );

  const catalog = RoomCommandRegistry.getCatalog("ai1-ai2");
  const directResult = await RoomCommandRegistry.run("GameRoomInternalBridgeOnly", {
    provider: "ai1",
    roomPayload: { cell: 6 },
  });

  assert.equal(
    catalog.some((item) => item.name === "GameRoomInternalBridgeOnly"),
    false
  );
  assert.deepEqual(directResult, { cell: 6 });
});

test("RoomCommandRegistry runs room-ui commands with structured payloads", async () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  RoomCommandRegistry.registerHandler(
    "game-room",
    "GameRoomBackgammonUserMove",
    async (payload) => payload.roomArgs
  );

  const result = await RoomCommandRegistry.run("GameRoomBackgammonUserMove", {
    provider: "room-ui",
    roomPayload: { cell: 4, symbol: "X" },
  });

  assert.deepEqual(result, { cell: 4, symbol: "X" });
});

test("RoomCommandRegistry scopes duplicate command names by room id", async () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([roomWithSharedCommand, forgeRoomWithSharedCommand]);

  RoomCommandRegistry.registerHandler(
    "game-room",
    "SharedRoomAction",
    async (payload) => payload.roomId
  );
  RoomCommandRegistry.registerHandler(
    "forge-room",
    "SharedRoomAction",
    async (payload) => payload.roomId
  );

  const ambiguous = (await RoomCommandRegistry.run("SharedRoomAction", {
    provider: "room-ui",
  })) as { success?: boolean };
  const gameRoomResult = await RoomCommandRegistry.run("SharedRoomAction", {
    provider: "room-ui",
    roomId: "game-room",
  });
  const forgeRoomResult = await RoomCommandRegistry.run("SharedRoomAction", {
    provider: "room-ui",
    roomId: "forge-room",
  });

  assert.equal(RoomCommandRegistry.has("SharedRoomAction"), false);
  assert.equal(RoomCommandRegistry.has("SharedRoomAction", "game-room"), true);
  assert.equal(
    RoomCommandRegistry.getMetadata("SharedRoomAction", "forge-room")?.roomId,
    "forge-room"
  );
  assert.equal(ambiguous.success, false);
  assert.equal(gameRoomResult, "game-room");
  assert.equal(forgeRoomResult, "forge-room");
});

test("RoomCommandRegistry matches room-local transcript voice commands", () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  RoomCommandRegistry.registerVoiceCommands("game-room", {
    GameRoomBackgammonUserMove: ["mark center", "mark center", " "],
    GameRoomBackgammonAiMove: ["ai move"],
    MissingRoomCommand: ["missing"],
  });

  assert.equal(RoomCommandRegistry.matchVoiceCommand("game-room", "mark center"), null);
  RoomCommandRegistry.setVoiceCommandsEnabled("game-room", true);

  assert.deepEqual(RoomCommandRegistry.matchVoiceCommand("game-room", "mark center"), {
    commandName: "GameRoomBackgammonUserMove",
    matchedPhrase: "mark center",
  });
  assert.equal(RoomCommandRegistry.matchVoiceCommand("game-room", "please mark center now"), null);
  assert.equal(RoomCommandRegistry.matchVoiceCommand("game-room", "ai move"), null);
  assert.equal(RoomCommandRegistry.matchVoiceCommand("forge-room", "mark center"), null);
});

test("RoomCommandRegistry parses AI args and enforces scope rules", async () => {
  RoomCommandRegistry.reset();
  RoomCommandRegistry.syncInstalledRooms([room]);

  RoomCommandRegistry.registerHandler(
    "game-room",
    "GameRoomBackgammonAiMove",
    async (payload) => payload.roomArgs
  );
  RoomCommandRegistry.registerHandler(
    "game-room",
    "GameRoomFateKnotsAiChoice",
    async (payload) => payload.roomArgs
  );
  RoomCommandRegistry.registerHandler(
    "game-room",
    "GameRoomBackgammonUserMove",
    async (payload) => payload.roomArgs
  );
  RoomCommandRegistry.registerHandler(
    "game-room",
    "GameRoomBackgammonRemoteMove",
    async (payload) => payload.roomArgs
  );

  const allowed = await RoomCommandRegistry.run("GameRoomBackgammonAiMove", {
    provider: "ai1",
    args: '{"cell":8,"symbol":"O"}',
  });
  const blocked = (await RoomCommandRegistry.run("GameRoomBackgammonUserMove", {
    provider: "ai1",
    args: '{"cell":2}',
  })) as { success?: boolean; message?: string };
  const fateKnotsAllowed = await RoomCommandRegistry.run("GameRoomFateKnotsAiChoice", {
    provider: "ai1",
    args: '{"sessionId":"fk-1","stepId":"gate-arrival","choiceId":"follow-lantern"}',
  });
  const us1Allowed = await RoomCommandRegistry.run("GameRoomBackgammonRemoteMove", {
    provider: "us1",
    args: '{"inviteId":"invite-1","cell":4}',
  });
  const us1Blocked = (await RoomCommandRegistry.run("GameRoomBackgammonUserMove", {
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
