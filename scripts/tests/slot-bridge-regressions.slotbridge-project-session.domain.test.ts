import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge project session", () => {
  void test(
    "SlotBridge message.send activates a saved project session before dispatch",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const originalGetSnapshot = SettingsManager.getSnapshot;
      const originalPatch = SettingsManager.patch;
      const callOrder: string[] = [];
      let selectedConversationId = "";
      let settings: Record<string, unknown> = {
        projectAiSessions: [
          {
            projectId: "repair-session-activate",
            roomId: "repair-room",
            slot: "ai2",
            accountId: "acct-grok",
            providerId: "grok",
            sessionRef: { conversationId: "conv-activate" },
          },
        ],
      };

      try {
        SettingsManager.getSnapshot = () =>
          settings as ReturnType<typeof SettingsManager.getSnapshot>;
        SettingsManager.patch = async (fnOrPartial) => {
          const next = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
          if (typeof fnOrPartial === "function") {
            fnOrPartial(next);
          } else {
            Object.assign(next, fnOrPartial);
          }
          settings = next;
          return true;
        };
        harness.appState.getAccountForSlot = () => ({
          id: "acct-grok",
          provider: "grok",
          email: "grok@example.test",
        });
        harness.appState.getProviderIdForSlot = () => "grok";
        harness.conversationListManager.updateSelection = (conversationId) => {
          selectedConversationId = conversationId;
          callOrder.push(`switch:${conversationId}`);
          return true;
        };
        harness.coreEngine.sendBatchInternal = async () => {
          throw new Error("sendBatch should not run for single-target text sends");
        };
        harness.coreEngine.sendMessageInternal = async () => {
          callOrder.push(`send:${selectedConversationId}`);
          return { success: true };
        };

        const result = await slotBridgeHandler({
          action: "message.send",
          payload: { text: "Continue project" },
          projectRef: {
            roomId: "repair-room",
            projectId: "repair-session-activate",
          },
          toSlot: "ai2",
        });

        assert.equal(result.success, true);
        assert.deepEqual(callOrder, ["switch:conv-activate", "send:conv-activate"]);
        assert.equal(result.session?.conversationId, "conv-activate");
      } finally {
        SettingsManager.getSnapshot = originalGetSnapshot;
        SettingsManager.patch = originalPatch;
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge project session restore warns without switching when the selected account differs",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const originalGetSnapshot = SettingsManager.getSnapshot;
      const originalPatch = SettingsManager.patch;
      let updateSelectionCalled = false;
      const settings: Record<string, unknown> = {
        projectAiSessions: [
          {
            projectId: "repair-session-3",
            roomId: "repair-room",
            slot: "ai2",
            accountId: "acct-grok",
            providerId: "grok",
            sessionRef: { conversationId: "conv-saved-3" },
          },
        ],
      };

      try {
        SettingsManager.getSnapshot = () =>
          settings as ReturnType<typeof SettingsManager.getSnapshot>;
        SettingsManager.patch = async () => true;
        harness.appState.getAccountForSlot = () => ({
          id: "acct-other",
          provider: "grok",
          email: "other@example.test",
        });
        harness.appState.getProviderIdForSlot = () => "grok";
        harness.conversationListManager.updateSelection = () => {
          updateSelectionCalled = true;
          return true;
        };

        const result = await slotBridgeHandler({
          action: "session.switch",
          toSlot: "ai2",
          projectRef: {
            roomId: "repair-room",
            projectId: "repair-session-3",
          },
        });

        const data = result.data as Record<string, unknown>;
        const projectSession = data["projectSession"] as Record<string, unknown>;
        const warning = projectSession["warning"] as Record<string, unknown>;

        assert.equal(result.success, true);
        assert.equal(data["projectSessionSkipped"], true);
        assert.equal(updateSelectionCalled, false);
        assert.equal(warning["code"], "PROJECT_ACCOUNT_MISMATCH");
        assert.equal(warning["expectedAccountId"], "acct-grok");
        assert.equal(warning["actualAccountId"], "acct-other");
      } finally {
        SettingsManager.getSnapshot = originalGetSnapshot;
        SettingsManager.patch = originalPatch;
        harness.restore();
      }
    }
  );
});
