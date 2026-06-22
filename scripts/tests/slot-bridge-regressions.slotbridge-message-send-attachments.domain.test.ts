import assert from "node:assert/strict";
import test from "node:test";

describe("SlotBridge message send attachments", () => {
  void test(
    "SlotBridge message.send resolves archive attachment refs and hard-rejects retired attachment actions",
    { concurrency: false },
    async () => {
      const harness = createHarness();
      let batchAttachments: Array<{ name: string; path: string }> = [];

      try {
        harness.coreEngine.sendBatchInternal = async (payload) => {
          batchAttachments = payload?.attachments ?? [];
          return { success: true };
        };
        harness.coreEngine.sendMessageInternal = async () => {
          throw new Error("sendMessage should not run for file.send");
        };
        harness.webviewManager.syncProvider = async () => ({ conversationId: "conv-archive" });
        harness.windowRef.electronAPI = {
          dbGetAttachments: async () => ({
            data: [
              {
                message_id: "msg-archive",
                original_name: "archive-image.png",
                mime_type: "image/png",
                stored_path: "/tmp/archive-image.png",
              },
            ],
          }),
          dbGetMessages: async () => ({ data: [] }),
        };

        const okResult = await slotBridgeHandler({
          action: "message.send",
          attachments: [
            {
              kind: "attachment-ref",
              name: "archive-image.png",
              ref: "archive:ai1:conv-archive:msg-archive:archive-image.png",
            } as SlotBridgeAttachmentRef,
          ],
          fromSlot: "ai1",
          toSlot: "ai2",
        });

        assert.equal(okResult.success, true);
        assert.deepEqual(batchAttachments, [
          { name: "archive-image.png", path: "/tmp/archive-image.png" },
        ]);

        const blockedResult = await slotBridgeHandler({
          action: "message.send",
          attachments: [
            {
              kind: "filesystem",
              name: "raw-local.txt",
              path: "/tmp/raw-local.txt",
            } as SlotBridgeFileSystemAttachment,
          ],
          fromSlot: "ai1",
          toSlot: "ai2",
        });

        assert.equal(blockedResult.success, false);
        assert.equal(blockedResult.code, "ATTACHMENT_REFERENCE_REQUIRED");
        assert.match(String(blockedResult.message), /Attachment reference required/i);

        const retiredResult = await slotBridgeHandler({
          action: "file.send",
          attachments: [
            {
              kind: "attachment-ref",
              name: "archive-image.png",
              ref: "archive:ai1:conv-archive:msg-archive:archive-image.png",
            } as SlotBridgeAttachmentRef,
          ],
          fromSlot: "ai1",
          toSlot: "ai2",
        });

        assert.equal(retiredResult.success, false);
        assert.equal(retiredResult.code, "ACTION_RETIRED");
        assert.match(String(retiredResult.message), /file\.send was removed/i);

        const retiredAttachmentResult = await slotBridgeHandler({
          action: "message.sendWithAttachments",
          attachments: [
            {
              kind: "attachment-ref",
              name: "archive-image.png",
              ref: "archive:ai1:conv-archive:msg-archive:archive-image.png",
            } as SlotBridgeAttachmentRef,
          ],
          fromSlot: "ai1",
          toSlot: "ai2",
        });

        assert.equal(retiredAttachmentResult.success, false);
        assert.equal(retiredAttachmentResult.code, "ACTION_RETIRED");
        assert.match(
          String(retiredAttachmentResult.message),
          /message\.sendWithAttachments was removed/i
        );
      } finally {
        harness.restore();
      }
    }
  );
});
