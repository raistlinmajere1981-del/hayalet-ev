import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge session data and restore", () => {
  void test(
    "SlotBridge session.sync runs manual webview sync for AI slots",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const syncCalls: Array<{ provider: string; opts?: Record<string, unknown> }> = [];

      try {
        harness.appState.getProviderIdForSlot = (slot: string) => (slot === "ai1" ? "llm" : slot);
        harness.webviewManager.syncProvider = async (provider, opts) => {
          syncCalls.push({ provider, ...(opts !== undefined ? { opts } : {}) });
          return {
            success: true,
            conversationId: "conv-llm-1",
            count: 2,
            webUrl: "http://127.0.0.1:9876/?session=llm-session-1",
          };
        };
        harness.windowRef.electronAPI = {
          dbGetMessages: async (query = {}) => {
            assert.equal(query["conversationId"], "conv-llm-1");
            return {
              data: [{ id: "assistant-1", role: "assistant", text: "local reply" }],
            };
          },
        };

        const result = await slotBridgeHandler({
          action: "session.sync",
          payload: {
            includeMessages: true,
          },
          sessionRef: {
            id: "llm-session-1",
          },
          toSlot: "ai1",
        });

        const data = result.data as Record<string, unknown>;

        assert.equal(result.success, true);
        assert.deepEqual(syncCalls, [{ provider: "ai1", opts: { from: "manual" } }]);
        assert.equal(result.session?.id, "llm-session-1");
        assert.equal(result.session.conversationId, "conv-llm-1");
        assert.equal(data["localSessionId"], "llm-session-1");
        assert.equal(
          (data["messages"] as Array<Record<string, unknown>>)[0]?.["text"],
          "local reply"
        );
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge session.sync stores project AI session bindings from synced session data",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const originalGetSnapshot = SettingsManager.getSnapshot;
      const originalPatch = SettingsManager.patch;
      let settings: Record<string, unknown> = { projectAiSessions: [] };

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
        harness.webviewManager.syncProvider = async () => ({
          success: true,
          conversationId: "conv-grok-1",
          webUrl: "https://grok.example/chat?session=grok-local-1",
        });

        const result = await slotBridgeHandler({
          action: "session.sync",
          toSlot: "ai2",
          projectRef: {
            roomId: "repair-room",
            projectId: "repair-session-1",
          },
        });

        const bindings = settings["projectAiSessions"] as Array<Record<string, unknown>>;
        const binding = bindings[0] ?? {};
        const sessionRef = binding["sessionRef"] as Record<string, unknown>;
        const data = result.data as Record<string, unknown>;
        const projectSession = data["projectSession"] as Record<string, unknown>;

        assert.equal(result.success, true);
        assert.equal(result.session?.id, "grok-local-1");
        assert.equal(result.session.conversationId, "conv-grok-1");
        assert.equal(bindings.length, 1);
        assert.equal(binding["projectId"], "repair-session-1");
        assert.equal(binding["roomId"], "repair-room");
        assert.equal(binding["slot"], "ai2");
        assert.equal(binding["accountId"], "acct-grok");
        assert.equal(binding["providerId"], "grok");
        assert.equal(binding["webUrl"], "https://grok.example/chat?session=grok-local-1");
        assert.equal(sessionRef["id"], "grok-local-1");
        assert.equal(sessionRef["conversationId"], "conv-grok-1");
        assert.equal(
          (projectSession["binding"] as Record<string, unknown>)["accountId"],
          "acct-grok"
        );
      } finally {
        SettingsManager.getSnapshot = originalGetSnapshot;
        SettingsManager.patch = originalPatch;
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge session.switch restores a saved project session when the selected account matches",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      const originalGetSnapshot = SettingsManager.getSnapshot;
      const originalPatch = SettingsManager.patch;
      let selectedConversationId = "";
      let refreshProvider = "";
      let settings: Record<string, unknown> = {
        projectAiSessions: [
          {
            projectId: "repair-session-2",
            roomId: "repair-room",
            slot: "ai2",
            accountId: "acct-grok",
            providerId: "grok",
            sessionRef: { conversationId: "conv-saved-2" },
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
        harness.conversationListManager.refresh = async (options = {}) => {
          refreshProvider = (options["provider"] as string | undefined) ?? "";
        };
        harness.conversationListManager.updateSelection = (conversationId) => {
          selectedConversationId = conversationId;
          return true;
        };

        const result = await slotBridgeHandler({
          action: "session.switch",
          toSlot: "ai2",
          projectRef: {
            roomId: "repair-room",
            projectId: "repair-session-2",
          },
        });

        const projectSession = (result.data as Record<string, unknown>)["projectSession"] as Record<
          string,
          unknown
        >;

        assert.equal(result.success, true);
        assert.equal(refreshProvider, "ai2");
        assert.equal(selectedConversationId, "conv-saved-2");
        assert.equal(result.session?.conversationId, "conv-saved-2");
        assert.equal(projectSession["restored"], true);
      } finally {
        SettingsManager.getSnapshot = originalGetSnapshot;
        SettingsManager.patch = originalPatch;
        harness.restore();
      }
    }
  );
});
