import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge session open and switch", () => {
  void test(
    "SlotBridge session.open honors connectPolicy never without forcing auto-connect",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const connectionCalls: string[] = [];

      try {
        harness.slotController.getState = () => ({
          state: "assigned",
          domReady: false,
          urlExcluded: false,
        });
        harness.slotController.isConnected = () => false;
        harness.appState.isAssigned = () => true;
        harness.appState.isConnected = () => false;
        harness.coreEngine.setConnection = async (provider, nextConnected) => {
          connectionCalls.push(`${provider}:${String(nextConnected)}`);
          return { success: true };
        };

        const result = await slotBridgeHandler({
          action: "session.open",
          connectPolicy: "never",
          payload: { title: "Strict session" },
          toSlot: "ai1",
        });

        assert.equal(result.success, false);
        assert.equal(result.code, "TARGET_UNREACHABLE");
        assert.deepEqual(connectionCalls, []);
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge session.switch honors connectPolicy require-ready without forcing auto-connect",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const connectionCalls: string[] = [];

      try {
        harness.slotController.getState = () => ({
          state: "assigned",
          domReady: false,
          urlExcluded: false,
        });
        harness.slotController.isConnected = () => false;
        harness.appState.isAssigned = () => true;
        harness.appState.isConnected = () => false;
        harness.coreEngine.setConnection = async (provider, nextConnected) => {
          connectionCalls.push(`${provider}:${String(nextConnected)}`);
          return { success: true };
        };
        harness.conversationListManager.refresh = async () => {
          throw new Error("refresh should not run when require-ready fails");
        };

        const result = await slotBridgeHandler({
          action: "session.switch",
          connectPolicy: "require-ready",
          sessionRef: { conversationId: "conv-ai1-strict" },
          toSlot: "ai1",
        });

        assert.equal(result.success, false);
        assert.equal(result.code, "TARGET_NOT_READY");
        assert.deepEqual(connectionCalls, []);
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge session.switch supports US1 targets and resolves local session ids after refresh",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const refreshCalls: Array<Record<string, unknown>> = [];
      const selectionCalls: Array<{ conversationId: string; provider?: string; silent?: boolean }> =
        [];

      try {
        harness.appState.hasUs1Identity = () => true;
        harness.appState.isUs1Connected = () => true;
        harness.conversationListManager.refresh = async (options = {}) => {
          refreshCalls.push(options);
          harness.conversationListManager.entries = [
            {
              id: "conv-us1-1",
              localSessionId: "us1-local-1",
              provider: "us1",
            },
          ];
        };
        harness.conversationListManager.updateSelection = (conversationId, options = {}) => {
          selectionCalls.push({
            conversationId,
            ...(options.provider !== undefined ? { provider: options.provider } : {}),
            ...(options.silent !== undefined ? { silent: options.silent } : {}),
          });
          return conversationId === "conv-us1-1";
        };

        const result = await slotBridgeHandler({
          action: "session.switch",
          sessionRef: {
            id: "us1-local-1",
          },
          toSlot: "us1",
        });

        assert.equal(result.success, true);
        assert.deepEqual(refreshCalls, [{ provider: "us1", silent: true }]);
        assert.deepEqual(selectionCalls, [
          {
            conversationId: "conv-us1-1",
            provider: "us1",
            silent: false,
          },
        ]);
        assert.equal(result.session?.id, "us1-local-1");
        assert.equal(result.session.conversationId, "conv-us1-1");
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge session.open creates local LLM session URLs for AI slots",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const navigations: Array<{ slot: string; url: string | null }> = [];

      try {
        harness.appState.getProviderIdForSlot = (slot: string) => (slot === "ai1" ? "llm" : slot);
        harness.slotController.navigate = (slot, url) => {
          navigations.push({ slot, url });
        };

        const result = await slotBridgeHandler({
          action: "session.open",
          sessionRef: {
            id: "llm-session-1",
          },
          toSlot: "ai1",
        });

        assert.equal(result.success, true);
        assert.equal(result.session?.id, "llm-session-1");
        assert.deepEqual(navigations, [
          {
            slot: "ai1",
            url: "http://127.0.0.1:9876/?session=llm-session-1",
          },
        ]);
      } finally {
        harness.restore();
      }
    }
  );
});
