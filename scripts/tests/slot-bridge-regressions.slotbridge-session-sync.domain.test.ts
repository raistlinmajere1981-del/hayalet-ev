import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge session sync", () => {
  void test(
    "SlotBridge session.sync returns US1 mailbox data through the canonical bridge action",
    { concurrency: false },
    async () => {
      const harness = createHarness();

      try {
        harness.windowRef.electronAPI = {
          us1SyncMessages: async (payload = {}) => {
            assert.equal(payload["localSessionId"], "us1-session-1");
            assert.equal(payload["consumeRoomCommands"], true);
            return {
              success: true,
              localSessionId: "us1-session-2",
              conversationId: "conv-us1-2",
              fetchedCount: 2,
              processedCount: 1,
              roomEvents: [{ eventType: "invite" }],
              roomCommands: [{ commandName: "GameRoomBackgammonRemoteMove" }],
              roomInviteInbox: [{ inviteId: "invite-1" }],
            };
          },
        };

        const result = await slotBridgeHandler({
          action: "session.sync",
          fromSlot: "room-ui",
          toSlot: "us1",
          sessionRef: {
            id: "us1-session-1",
          },
          payload: {
            consumeRoomCommands: true,
          },
        });

        const data =
          result.data !== null &&
          typeof result.data === "object" &&
          Array.isArray(result.data) === false
            ? (result.data as Record<string, unknown>)
            : {};

        assert.equal(result.success, true);
        assert.equal(result.session?.id, "us1-session-2");
        assert.equal(result.session.conversationId, "conv-us1-2");
        assert.equal(data["fetchedCount"], 2);
        assert.equal(data["processedCount"], 1);
        assert.deepEqual(data["roomEvents"], [{ eventType: "invite" }]);
        assert.deepEqual(data["roomCommands"], [{ commandName: "GameRoomBackgammonRemoteMove" }]);
        assert.deepEqual(data["roomInviteInbox"], [{ inviteId: "invite-1" }]);
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge session.sync can include archived messages without re-running transport sync",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      let syncCalls = 0;

      try {
        harness.windowRef.electronAPI = {
          us1SyncMessages: async () => {
            syncCalls += 1;
            return {
              success: true,
              localSessionId: "us1-session-2",
              conversationId: "conv-us1-2",
            };
          },
          dbGetMessages: async (query = {}) => {
            assert.equal(query["conversationId"], "conv-us1-2");
            return {
              data: [{ id: "assistant-1", role: "assistant", text: "mail reply" }],
            };
          },
        };

        const liveResult = await slotBridgeHandler({
          action: "session.sync",
          payload: {
            includeMessages: true,
          },
          sessionRef: { id: "us1-session-1" },
          toSlot: "us1",
        });
        assert.equal(liveResult.success, true);
        assert.equal(syncCalls, 1);
        assert.equal(Array.isArray((liveResult.data as Record<string, unknown>)["messages"]), true);

        const cachedResult = await slotBridgeHandler({
          action: "session.sync",
          payload: {
            includeMessages: true,
            skipTransportSync: true,
          },
          sessionRef: { conversationId: "conv-us1-2" },
          toSlot: "us1",
        });

        assert.equal(cachedResult.success, true);
        assert.equal(syncCalls, 1);
        assert.equal(
          (
            (cachedResult.data as Record<string, unknown>)["messages"] as Array<
              Record<string, unknown>
            >
          )[0]?.["text"],
          "mail reply"
        );
      } finally {
        harness.restore();
      }
    }
  );
});
