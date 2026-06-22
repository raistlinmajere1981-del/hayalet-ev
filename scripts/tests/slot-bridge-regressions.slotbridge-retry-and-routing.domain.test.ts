import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge retry and routing", () => {
  void test(
    "SlotBridge retry send is idempotent with the same clientRequestId",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      let sendCount = 0;
      let seenBrokerMessageId = "";

      try {
        harness.coreEngine.sendBatchInternal = async () => {
          throw new Error("sendBatch should not run for single-target text sends");
        };
        harness.coreEngine.sendMessageInternal = async (payload) => {
          sendCount += 1;
          seenBrokerMessageId =
            typeof payload?.brokerMessageId === "string" ? payload.brokerMessageId : "";
          return { success: true };
        };

        const first = await slotBridgeHandler({
          action: "message.send",
          clientRequestId: "client-req-1",
          fromSlot: "user",
          payload: { text: "Only once" },
          toSlot: "ai1",
        });
        const second = await slotBridgeHandler({
          action: "message.send",
          clientRequestId: "client-req-1",
          fromSlot: "user",
          payload: { text: "Only once" },
          toSlot: "ai1",
        });

        assert.equal(first.success, true);
        assert.equal(second.success, true);
        assert.equal(sendCount, 1);
        assert.equal(first.clientRequestId, "client-req-1");
        assert.equal(second.clientRequestId, "client-req-1");
        assert.equal(typeof first.brokerMessageId, "string");
        assert.equal(first.brokerMessageId, second.brokerMessageId);
        assert.equal(first.brokerMessageId, seenBrokerMessageId);
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge forwards explicit US1 remote routing to the server without mutating settings",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const originalPatch = SettingsManager.patch;
      const sendCalls: Array<Record<string, unknown>> = [];

      try {
        SettingsManager.patch = async () => {
          throw new Error("Settings patch should not run for US1 remote selection");
        };
        harness.windowRef.electronAPI = {
          us1SendMessage: async (params = {}) => {
            sendCalls.push({ ...params });
            return {
              success: true,
              remoteUserId: "beta@example.com",
              localSessionId: "beta-session",
              conversationId: "conv-beta",
            };
          },
        };

        const result = await slotBridgeHandler({
          action: "message.send",
          fromSlot: "user",
          toSlot: "us1",
          remoteUserId: "beta@example.com",
          payload: { text: "Ping beta" },
        });

        assert.equal(result.success, true);
        assert.equal(sendCalls.length, 1);
        assert.equal(sendCalls[0]?.["remoteUserId"], "beta@example.com");
        assert.match((sendCalls[0]["text"] as string | undefined) ?? "", /Ping beta/);
      } finally {
        SettingsManager.patch = originalPatch;
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge message.send auto-connects AI0 through assistant readiness before dispatch",
    { concurrency: false },
    async () => {
      const harness = createHarness({ immediateTimers: true });
      const originalGetAdapter = AssistantProviderRegistry.getAdapter;
      let connected = false;
      let readyChecks = 0;
      let sentProvider = "";
      let sentText = "";

      try {
        harness.slotController.getState = () => ({
          state: connected ? "connected" : "assigned",
          domReady: connected,
          urlExcluded: false,
        });
        harness.slotController.isConnected = () => connected;
        harness.slotController.connect = async () => {
          connected = true;
          return { success: true };
        };
        harness.appState.getProviderIdForSlot = () => "opencode-ui";
        harness.appState.isAssigned = () => true;
        harness.appState.isConnected = () => connected;
        harness.appState.isAssistantToolsReady = () => {
          readyChecks += 1;
          return connected && readyChecks > 2;
        };
        AssistantProviderRegistry.getAdapter = () =>
          ({
            id: "opencode-ui",
            name: "OpenCode UI",
            getServerStatus: () => ({ running: true }),
            startServer: () => ({
              success: true,
              url: "/pages/opencode-ui.html?port=4096",
            }),
            stopServer: () => ({ success: true }),
            waitForReady: () => true,
          }) as unknown as ReturnType<typeof AssistantProviderRegistry.getAdapter>;
        harness.coreEngine.sendBatchInternal = async () => {
          throw new Error("sendBatch should not run for single-target text sends");
        };
        harness.coreEngine.sendMessageInternal = async (payload) => {
          sentProvider = payload?.provider ?? "";
          sentText = payload?.text ?? "";
          return { success: true };
        };

        const result = await slotBridgeHandler({
          action: "message.send",
          fromSlot: "user",
          payload: { text: "Wake AI0" },
          toSlot: "ai0",
        });

        assert.equal(result.success, true);
        assert.equal(sentProvider, "ai0");
        assert.equal(sentText.startsWith("Wake AI0"), true);
        assert.equal(connected, true);
        assert.equal(readyChecks > 2, true);
      } finally {
        AssistantProviderRegistry.getAdapter = originalGetAdapter;
        harness.restore();
      }
    }
  );
});
