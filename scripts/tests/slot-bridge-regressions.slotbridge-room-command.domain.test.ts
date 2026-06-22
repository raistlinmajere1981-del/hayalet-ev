import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge room command", () => {
  void test(
    "SlotBridge room.command keeps explicit payload when args contains raw room args",
    { concurrency: false },
    async () => {
      const registry = RoomCommandRegistry as unknown as {
        run: (commandName: string, payload?: Record<string, unknown>) => Promise<unknown>;
      };
      const originalRun = registry.run;
      const runCalls: Array<{ commandName: string; payload: Record<string, unknown> }> = [];

      try {
        registry.run = async (commandName, payload = {}) => {
          runCalls.push({ commandName, payload });
          return { success: true, handled: true };
        };

        const result = await slotBridgeHandler({
          action: "room.command",
          fromSlot: "us1",
          args: '{"matchId":"backgammon_1","turnIndex":0,"boardHashBeforeMove":".........","cell":1}',
          payload: {
            commandName: "GameRoomBackgammonRemoteMove",
            roomId: "game-room",
            matchId: "backgammon_1",
            turnIndex: 0,
            boardHashBeforeMove: ".........",
            cell: 1,
          },
        });

        assert.equal(result.success, true);
        assert.equal(runCalls.length, 1);
        assert.equal(runCalls[0]?.commandName, "GameRoomBackgammonRemoteMove");
        assert.deepEqual(runCalls[0].payload["roomPayload"], {
          roomId: "game-room",
          matchId: "backgammon_1",
          turnIndex: 0,
          boardHashBeforeMove: ".........",
          cell: 1,
        });
        assert.equal(
          runCalls[0].payload["args"],
          '{"matchId":"backgammon_1","turnIndex":0,"boardHashBeforeMove":".........","cell":1}'
        );
        assert.deepEqual(result.data, { success: true, handled: true });
      } finally {
        registry.run = originalRun;
      }
    }
  );
  void test(
    "SlotBridge room.command forwards US1 transport metadata to room handlers",
    { concurrency: false },
    async () => {
      const registry = RoomCommandRegistry as unknown as {
        run: (commandName: string, payload?: Record<string, unknown>) => Promise<unknown>;
      };
      const originalRun = registry.run;
      const runCalls: Array<{ commandName: string; payload: Record<string, unknown> }> = [];

      try {
        registry.run = async (commandName, payload = {}) => {
          runCalls.push({ commandName, payload });
          return { success: true, handled: true };
        };

        const result = await slotBridgeHandler({
          action: "room.command",
          fromSlot: "us1",
          remoteUserId: "raistlin.majere.1981@gmail.com",
          localSessionId: "us1-session-1",
          transportMessageId: "<remote-move@example.test>",
          payload: {
            commandName: "GameRoomBackgammonRemoteMove",
            roomId: "game-room",
            matchId: "backgammon_1",
            turnIndex: 0,
            boardHashBeforeMove: ".........",
            cell: 1,
          },
        });

        assert.equal(result.success, true);
        assert.equal(runCalls.length, 1);
        assert.equal(runCalls[0]?.commandName, "GameRoomBackgammonRemoteMove");
        assert.equal(runCalls[0].payload["remoteUserId"], "raistlin.majere.1981@gmail.com");
        assert.equal(runCalls[0].payload["localSessionId"], "us1-session-1");
        assert.equal(runCalls[0].payload["transportMessageId"], "<remote-move@example.test>");
        assert.deepEqual(runCalls[0].payload["roomPayload"], {
          roomId: "game-room",
          matchId: "backgammon_1",
          turnIndex: 0,
          boardHashBeforeMove: ".........",
          cell: 1,
        });
        assert.deepEqual(result.data, { success: true, handled: true });
      } finally {
        registry.run = originalRun;
      }
    }
  );
});
