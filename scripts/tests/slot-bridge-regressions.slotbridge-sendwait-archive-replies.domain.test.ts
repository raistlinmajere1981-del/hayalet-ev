import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge sendWait archive replies", () => {
  void test(
    "SlotBridge sendWait succeeds when the awaited archived reply only contains attachments",
    { concurrency: false },
    async () => {
      const harness = createHarness({ immediateTimers: true });
      const sendBatchCalls: SendBatchPayload[] = [];
      let sent = false;

      try {
        harness.coreEngine.sendBatchInternal = async (payload) => {
          sendBatchCalls.push(payload ?? {});
          return { success: true };
        };
        harness.coreEngine.sendMessageInternal = async () => {
          sent = true;
          return { success: true };
        };
        harness.webviewManager.syncProvider = async () => ({
          conversationId: "conv-attachment-only",
          generatedImagePendingCount: 0,
        });
        harness.windowRef.electronAPI = {
          dbGetAttachments: async () => ({
            data: sent
              ? [
                  {
                    message_id: "assistant-new",
                    original_name: "only-attachment.png",
                    mime_type: "image/png",
                    stored_path: "/tmp/only-attachment.png",
                    size: 512,
                  },
                ]
              : [],
          }),
          dbGetMessages: async () => ({
            data: sent
              ? [
                  { id: "assistant-old", role: "assistant", text: "previous" },
                  { id: "assistant-new", role: "assistant", text: "" },
                ]
              : [{ id: "assistant-old", role: "assistant", text: "previous" }],
          }),
        };

        const result = await slotBridgeHandler({
          action: "message.sendWait",
          fromSlot: "ai0",
          payload: { text: "Need artifact" },
          reqId: "req-sendwait-attachment-only",
          timeoutMs: 2000,
          toSlot: "ai1",
        });

        assert.equal(result.success, true);
        assert.equal(result.reply?.text, "");
        assert.equal(result.reply.attachments?.[0]?.path, "/tmp/only-attachment.png");
        assert.equal(result.artifacts?.[0]?.name, "only-attachment.png");
        assert.equal(sendBatchCalls.length, 1);
        assert.deepEqual(sendBatchCalls[0]?.targets, ["ai0"]);
        assert.equal(sendBatchCalls[0].page, "slot-bridge:reply:ai1");
        assert.equal(sendBatchCalls[0].text?.includes("<!-- hev-sender:ai1 -->"), true);
        assert.deepEqual(sendBatchCalls[0].attachments, [
          {
            name: "only-attachment.png",
            path: "/tmp/only-attachment.png",
          },
        ]);
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge sendWait reads ai0 replies directly from sync results when archive DB is empty",
    { concurrency: false },
    async () => {
      const harness = createHarness({ immediateTimers: true });
      let targetSent = false;
      let sentText = "";
      let sentClientRequestId = "";
      let sentWaitForCompletion = false;

      try {
        harness.coreEngine.sendBatchInternal = async () => {
          throw new Error("sendBatch should not run for text-only sendWait");
        };
        harness.coreEngine.sendMessageInternal = async (payload) => {
          if (payload?.provider === "ai0") {
            targetSent = true;
            sentText = payload.text ?? "";
            sentClientRequestId = payload.clientRequestId ?? "";
            sentWaitForCompletion = payload.waitForCompletion === true;
          }
          return { success: true };
        };
        harness.webviewManager.syncProvider = async () => ({
          conversationId: "conv-ai0",
          generatedImagePendingCount: 0,
          messages: targetSent
            ? [{ id: "assistant-new", role: "assistant", text: "fresh ai0 reply" }]
            : [{ id: "assistant-old", role: "assistant", text: "previous ai0 reply" }],
        });
        harness.windowRef.electronAPI = {
          dbGetAttachments: async () => ({ data: [] }),
          dbGetMessages: async () => ({ data: [] }),
        };

        const result = await slotBridgeHandler({
          action: "message.sendWait",
          fromSlot: "ai1",
          payload: { text: "Ping ai0" },
          reqId: "req-sendwait-ai0-live-reply",
          timeoutMs: 10000,
          toSlot: "ai0",
        });

        assert.equal(result.success, true);
        assert.equal(sentText.includes("<!-- hev-req:req-sendwait-ai0-live-reply -->"), false);
        assert.equal(sentClientRequestId.startsWith("slotbridge-implicit:"), true);
        assert.equal(sentWaitForCompletion, true);
        assert.equal(result.reply?.text, "fresh ai0 reply");
        assert.equal(result.reply.conversationId, "conv-ai0");
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge sendWait forwards replies back to replyToSlot for cross-slot AI routing",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      let sent = false;
      const sendMessageCalls: Array<{ provider?: string; text?: string; page?: string }> = [];

      try {
        harness.coreEngine.sendBatchInternal = async () => {
          throw new Error("sendBatch should not run for text-only reply forwarding");
        };
        harness.coreEngine.sendMessageInternal = async (payload) => {
          sendMessageCalls.push(payload ?? {});
          if (payload?.provider === "ai2") {
            sent = true;
          }
          return { success: true };
        };
        harness.webviewManager.syncProvider = async () => ({
          conversationId: "conv-bridge-forward",
          generatedImagePendingCount: 0,
        });
        harness.windowRef.electronAPI = {
          dbGetAttachments: async () => ({ data: [] }),
          dbGetMessages: async () => ({
            data: sent
              ? [
                  { id: "assistant-old", role: "assistant", text: "old" },
                  { id: "assistant-new", role: "assistant", text: "reply for ai1" },
                ]
              : [{ id: "assistant-old", role: "assistant", text: "old" }],
          }),
        };

        const result = await slotBridgeHandler({
          action: "message.sendWait",
          fromSlot: "ai1",
          payload: { text: "Relay to ai2" },
          replyToSlot: "ai1",
          reqId: "req-forward",
          timeoutMs: 2000,
          toSlot: "ai2",
        });

        assert.equal(result.success, true);
        assert.equal(sendMessageCalls.length, 2);
        assert.equal(sendMessageCalls[0]?.provider, "ai2");
        assert.equal(sendMessageCalls[1]?.provider, "ai1");
        assert.equal(sendMessageCalls[1].text?.includes("<!-- hev-sender:ai2 -->"), true);
        assert.deepEqual(result.data, {
          replyForwardSlot: "ai1",
          replyForwarded: true,
        });
      } finally {
        harness.restore();
      }
    }
  );
  void test(
    "SlotBridge sendWait returns TARGET_TIMEOUT when no new archived reply arrives",
    { concurrency: false },
    async () => {
      const harness = createHarness({ immediateTimers: true });

      try {
        harness.coreEngine.sendBatchInternal = async () => {
          throw new Error("sendBatch should not run for text-only sendWait");
        };
        harness.coreEngine.sendMessageInternal = async () => ({ success: true });
        harness.webviewManager.syncProvider = async () => ({
          conversationId: "conv-timeout",
          generatedImagePendingCount: 0,
        });
        harness.windowRef.electronAPI = {
          dbGetAttachments: async () => ({ data: [] }),
          dbGetMessages: async () => ({
            data: [{ id: "assistant-old", role: "assistant", text: "stale reply" }],
          }),
        };

        const result = await slotBridgeHandler({
          action: "message.sendWait",
          fromSlot: "ai0",
          payload: { text: "Still waiting" },
          reqId: "req-timeout",
          timeoutMs: 1000,
          toSlot: "ai1",
        });

        assert.equal(result.success, false);
        assert.equal(result.code, "TARGET_TIMEOUT");
      } finally {
        harness.restore();
      }
    }
  );
});
