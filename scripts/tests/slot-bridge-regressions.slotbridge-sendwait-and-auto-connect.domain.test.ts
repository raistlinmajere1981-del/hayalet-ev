import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge sendWait and auto-connect", () => {
  void test(
    "SlotBridge sendWait returns archived generated-image replies after full sync",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      let sent = false;
      let sentText = "";
      let sentClientRequestId = "";
      let sentWaitForCompletion = false;

      try {
        harness.coreEngine.sendBatchInternal = async () => {
          throw new Error("sendBatch should not run for text-only sendWait");
        };
        harness.coreEngine.sendMessageInternal = async (payload) => {
          sent = true;
          sentText = payload?.text ?? "";
          sentClientRequestId = payload?.clientRequestId ?? "";
          sentWaitForCompletion = payload?.waitForCompletion === true;
          return { success: true };
        };
        harness.webviewManager.syncProvider = async () => ({
          conversationId: "conv-1",
          generatedImagePendingCount: 0,
        });
        harness.windowRef.electronAPI = {
          dbGetAttachments: async () => ({
            data: sent
              ? [
                  {
                    message_id: "assistant-new",
                    original_name: "reply-image.png",
                    mime_type: "image/png",
                    stored_path: "/tmp/reply-image.png",
                    size: 1234,
                  },
                ]
              : [],
          }),
          dbGetMessages: async () => ({
            data: sent
              ? [
                  { id: "assistant-old", role: "assistant", text: "previous reply" },
                  {
                    id: "user-new",
                    role: "user",
                    text: "Ping",
                    client_request_id: sentClientRequestId,
                  },
                  { id: "assistant-new", role: "assistant", text: "latest reply" },
                ]
              : [{ id: "assistant-old", role: "assistant", text: "previous reply" }],
          }),
        };

        const result = await slotBridgeHandler({
          action: "message.sendWait",
          fromSlot: "ai0",
          payload: { text: "Ping" },
          replyToSlot: "ai1",
          reqId: "req-sendwait-image",
          timeoutMs: 2000,
          toSlot: "ai1",
        });

        assert.equal(result.success, true);
        assert.equal(sentText.includes("<!-- hev-req:req-sendwait-image -->"), false);
        assert.equal(sentClientRequestId.startsWith("slotbridge-implicit:"), true);
        assert.equal(sentWaitForCompletion, true);
        assert.equal(result.reply?.text, "latest reply");
        assert.equal(result.reply.attachments?.[0]?.kind, "generated-image");
        assert.equal(result.reply.attachments[0].path, "/tmp/reply-image.png");
        assert.equal(result.artifacts?.[0]?.mimeType, "image/png");
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge message.send auto-connects assigned AI targets before dispatch",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      let connected = false;
      const connectionCalls: string[] = [];
      let sentProvider = "";
      let sentText = "";

      try {
        harness.slotController.getState = () => ({
          state: connected ? "connected" : "assigned",
          domReady: connected,
          urlExcluded: false,
        });
        harness.slotController.isConnected = () => connected;
        harness.appState.isAssigned = () => true;
        harness.appState.isConnected = () => connected;
        harness.coreEngine.setConnection = async (provider, nextConnected) => {
          connectionCalls.push(`${provider}:${String(nextConnected)}`);
          connected = nextConnected === true;
          return { success: true };
        };
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
          payload: { text: "Auto-connect now" },
          toSlot: "ai1",
        });

        assert.equal(result.success, true);
        assert.deepEqual(connectionCalls, ["ai1:true"]);
        assert.equal(sentProvider, "ai1");
        assert.equal(sentText.startsWith("Auto-connect now"), true);
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge message.send rejects connected AI slots until the first traffic probe completes",
    { concurrency: false },
    async () => {
      const harness = createHarness({ immediateTimers: true });
      let sendCalled = false;

      try {
        TrafficManager.state["ai1"] = {
          ...makeReadyTrafficState("https://chatgpt.com/ai1"),
          lastHref: "",
        };
        harness.coreEngine.sendBatchInternal = async () => {
          throw new Error("sendBatch should not run for single-target text sends");
        };
        harness.coreEngine.sendMessageInternal = async () => {
          sendCalled = true;
          return { success: true };
        };

        const result = await slotBridgeHandler({
          action: "message.send",
          fromSlot: "user",
          payload: { text: "Wait for probe" },
          toSlot: "ai1",
        });

        assert.equal(result.success, false);
        assert.equal(result.code, "TARGET_NOT_READY");
        assert.equal(sendCalled, false);
      } finally {
        harness.restore();
      }
    }
  );
});
