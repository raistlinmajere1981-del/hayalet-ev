import assert from "node:assert/strict";
import test from "node:test";

const { slotBridgeHandler, slotBridgeRuntime } = await import(
  "../../src/js/modules/commands/slot-bridge.ts"
);
const { RoomCommandRegistry } = await import("../../src/js/modules/rooms/room-command-registry.ts");
const { SlotController } = await import("../../src/js/modules/slot-controller.ts");
const { AppState } = await import("../../src/js/modules/app-state.ts");

type ElectronApiMock = {
  us1SendMessage?: (params: Record<string, unknown>) => Promise<unknown>;
  us1SyncMessages?: (params?: Record<string, unknown>) => Promise<unknown>;
  dbGetMessages?: (query: Record<string, unknown>) => Promise<unknown>;
  dbGetAttachments?: (query: Record<string, unknown>) => Promise<unknown>;
};

type TestWindow = {
  electronAPI?: ElectronApiMock;
  setTimeout?: typeof setTimeout;
};

type SlotBridgeHarness = {
  appState: {
    getArchiveAccountIdForProvider: (provider: string) => string | null;
    getProviderIdForSlot: (slot: string) => string | null;
    isConnected: (slot: string) => boolean;
    isUs1Connected: () => boolean;
  };
  coreEngine: {
    ensureReady: () => Promise<void>;
    setActiveTargets: (targets?: string[]) => void;
    sendBatchInternal: (payload?: {
      targets?: string[];
      text?: string;
      page?: string;
      attachments?: Array<{ name: string; path: string }>;
    }) => Promise<{ success: boolean; message?: string }>;
    sendMessageInternal: (payload: {
      provider?: string;
      text?: string;
      page?: string;
    } | null) => Promise<{ success: boolean; message?: string }>;
    setConnection: (
      provider: string,
      connected: boolean,
      opts?: { force?: boolean; url?: string }
    ) => Promise<{ success: boolean; message?: string }>;
  };
  restore: () => void;
  runtime: {
    getCoreEngine: () => Promise<SlotBridgeHarness["coreEngine"]>;
    getWebviewManager: () => Promise<SlotBridgeHarness["webviewManager"]>;
  };
  slotController: {
    isConnected: (slot: string) => boolean;
  };
  webviewManager: {
    syncProvider: (provider: string, opts?: Record<string, unknown>) => Promise<unknown>;
  };
  windowRef: TestWindow;
};

function createHarness(
  options: { immediateTimers?: boolean; nowStepMs?: number } = {}
): SlotBridgeHarness {
  const globalWithWindow = globalThis as { window?: TestWindow };
  const originalWindow = globalWithWindow.window;
  const originalDateNow = Date.now;

  const coreEngine: SlotBridgeHarness["coreEngine"] = {
    ensureReady: async () => {},
    setActiveTargets: () => {},
    sendBatchInternal: async () => ({ success: true }),
    sendMessageInternal: async () => ({ success: true }),
    setConnection: async () => ({ success: true }),
  };
  const webviewManager: SlotBridgeHarness["webviewManager"] = {
    syncProvider: async () => null,
  };
  const slotController = SlotController as unknown as SlotBridgeHarness["slotController"];
  const appState = AppState as unknown as SlotBridgeHarness["appState"];
  const runtime = slotBridgeRuntime as unknown as SlotBridgeHarness["runtime"];

  const originalGetCoreEngine = runtime.getCoreEngine;
  const originalGetWebviewManager = runtime.getWebviewManager;
  const originalIsConnected = slotController.isConnected;
  const originalGetArchiveAccountIdForProvider = appState.getArchiveAccountIdForProvider;
  const originalGetProviderIdForSlot = appState.getProviderIdForSlot;
  const originalAppStateIsConnected = appState.isConnected;
  const originalAppStateIsUs1Connected = appState.isUs1Connected;

  let now = 0;
  const immediateSetTimeout = ((callback: TimerHandler, _delay?: number, ...args: unknown[]) => {
    if (typeof callback === "function") {
      callback(...args);
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  globalWithWindow.window = {
    electronAPI: {},
    setTimeout: options.immediateTimers === true ? immediateSetTimeout : setTimeout,
  };

  if (options.immediateTimers === true) {
    Date.now = () => {
      now += options.nowStepMs ?? 100;
      return now;
    };
  }

  runtime.getCoreEngine = async () => coreEngine;
  runtime.getWebviewManager = async () => webviewManager;
  slotController.isConnected = () => true;
  appState.getArchiveAccountIdForProvider = () => "acct-1";
  appState.getProviderIdForSlot = (slot: string) => slot;
  appState.isConnected = () => true;
  appState.isUs1Connected = () => true;

  return {
    appState,
    coreEngine,
    restore: () => {
      runtime.getCoreEngine = originalGetCoreEngine;
      runtime.getWebviewManager = originalGetWebviewManager;
      slotController.isConnected = originalIsConnected;
      appState.getArchiveAccountIdForProvider = originalGetArchiveAccountIdForProvider;
      appState.getProviderIdForSlot = originalGetProviderIdForSlot;
      appState.isConnected = originalAppStateIsConnected;
      appState.isUs1Connected = originalAppStateIsUs1Connected;
      Date.now = originalDateNow;

      if (originalWindow === undefined) {
        delete globalWithWindow.window;
      } else {
        globalWithWindow.window = originalWindow;
      }
    },
    runtime,
    slotController,
    webviewManager,
    windowRef: globalWithWindow.window,
  };
}

test(
  "SlotBridge sendWait returns archived generated-image replies after full sync",
  { concurrency: false },
  async () => {
    const harness = createHarness();
    let sent = false;
    let sentText = "";

    try {
      harness.coreEngine.sendBatchInternal = async () => {
        throw new Error("sendBatch should not run for text-only sendWait");
      };
      harness.coreEngine.sendMessageInternal = async (payload) => {
        sent = true;
        sentText = payload?.text ?? "";
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
      assert.equal(sentText.includes("<!-- hev-req:req-sendwait-image -->"), true);
      assert.equal(result.reply?.text, "latest reply");
      assert.equal(result.reply?.attachments?.[0]?.kind, "generated-image");
      assert.equal(result.reply?.attachments?.[0]?.path, "/tmp/reply-image.png");
      assert.equal(result.artifacts?.[0]?.mimeType, "image/png");
    } finally {
      harness.restore();
    }
  }
);

test(
  "SlotBridge sendWait succeeds when the awaited archived reply only contains attachments",
  { concurrency: false },
  async () => {
    const harness = createHarness({ immediateTimers: true });
    const sendBatchCalls: Array<{
      attachments?: Array<{ name: string; path: string }>;
      page?: string;
      targets?: string[];
      text?: string;
    }> = [];
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
      assert.equal(result.reply?.attachments?.[0]?.path, "/tmp/only-attachment.png");
      assert.equal(result.artifacts?.[0]?.name, "only-attachment.png");
      assert.equal(sendBatchCalls.length, 1);
      assert.deepEqual(sendBatchCalls[0]?.targets, ["ai0"]);
      assert.equal(sendBatchCalls[0]?.page, "slot-bridge:reply:ai1");
      assert.equal(sendBatchCalls[0]?.text?.includes("<!-- hev-sender:ai1 -->"), true);
      assert.deepEqual(sendBatchCalls[0]?.attachments, [
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

test(
  "SlotBridge sendWait reads ai0 replies directly from sync results when archive DB is empty",
  { concurrency: false },
  async () => {
    const harness = createHarness({ immediateTimers: true });
    let targetSent = false;
    let sentText = "";

    try {
      harness.coreEngine.sendBatchInternal = async () => {
        throw new Error("sendBatch should not run for text-only sendWait");
      };
      harness.coreEngine.sendMessageInternal = async (payload) => {
        if (payload?.provider === "ai0") {
          targetSent = true;
          sentText = payload.text ?? "";
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
      assert.equal(sentText.includes("<!-- hev-req:req-sendwait-ai0-live-reply -->"), true);
      assert.equal(result.reply?.text, "fresh ai0 reply");
      assert.equal(result.reply?.conversationId, "conv-ai0");
    } finally {
      harness.restore();
    }
  }
);

test(
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
      assert.equal(sendMessageCalls[1]?.text?.includes("<!-- hev-sender:ai2 -->"), true);
      assert.deepEqual(result.data, {
        replyForwardSlot: "ai1",
        replyForwarded: true,
      });
    } finally {
      harness.restore();
    }
  }
);

test(
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

test(
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
          },
        ],
        fromSlot: "ai1",
        toSlot: "ai2",
      });

      assert.equal(okResult.success, true);
      assert.deepEqual(batchAttachments, [{ name: "archive-image.png", path: "/tmp/archive-image.png" }]);

      const blockedResult = await slotBridgeHandler({
        action: "message.send",
        attachments: [
          {
            kind: "filesystem",
            name: "raw-local.txt",
            path: "/tmp/raw-local.txt",
          },
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
          },
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
          },
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

test(
  "SlotBridge session.sync returns US1 mailbox data through the canonical bridge action",
  { concurrency: false },
  async () => {
    const harness = createHarness();

    try {
      harness.windowRef.electronAPI = {
        us1SyncMessages: async (payload = {}) => {
          assert.equal(payload.localSessionId, "us1-session-1");
          assert.equal(payload.consumeRoomCommands, true);
          return {
            success: true,
            localSessionId: "us1-session-2",
            conversationId: "conv-us1-2",
            fetchedCount: 2,
            processedCount: 1,
            roomEvents: [{ eventType: "invite" }],
            roomCommands: [{ commandName: "GameRoomXoxRemoteMove" }],
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
      assert.equal(result.session?.conversationId, "conv-us1-2");
      assert.equal(data["fetchedCount"], 2);
      assert.equal(data["processedCount"], 1);
      assert.deepEqual(data["roomEvents"], [{ eventType: "invite" }]);
      assert.deepEqual(data["roomCommands"], [{ commandName: "GameRoomXoxRemoteMove" }]);
      assert.deepEqual(data["roomInviteInbox"], [{ inviteId: "invite-1" }]);
    } finally {
      harness.restore();
    }
  }
);

test(
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
          assert.equal(query.conversationId, "conv-us1-2");
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
        ((cachedResult.data as Record<string, unknown>)["messages"] as Array<Record<string, unknown>>)[0]?.[
          "text"
        ],
        "mail reply"
      );
    } finally {
      harness.restore();
    }
  }
);

test(
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
        args: '{"matchId":"xox_1","turnIndex":0,"boardHashBeforeMove":".........","cell":1}',
        payload: {
          commandName: "GameRoomXoxRemoteMove",
          roomId: "game-room",
          matchId: "xox_1",
          turnIndex: 0,
          boardHashBeforeMove: ".........",
          cell: 1,
        },
      });

      assert.equal(result.success, true);
      assert.equal(runCalls.length, 1);
      assert.equal(runCalls[0]?.commandName, "GameRoomXoxRemoteMove");
      assert.deepEqual(runCalls[0]?.payload.roomPayload, {
        roomId: "game-room",
        matchId: "xox_1",
        turnIndex: 0,
        boardHashBeforeMove: ".........",
        cell: 1,
      });
      assert.equal(
        runCalls[0]?.payload.args,
        '{"matchId":"xox_1","turnIndex":0,"boardHashBeforeMove":".........","cell":1}'
      );
      assert.deepEqual(result.data, { success: true, handled: true });
    } finally {
      registry.run = originalRun;
    }
  }
);

test(
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
          commandName: "GameRoomXoxRemoteMove",
          roomId: "game-room",
          matchId: "xox_1",
          turnIndex: 0,
          boardHashBeforeMove: ".........",
          cell: 1,
        },
      });

      assert.equal(result.success, true);
      assert.equal(runCalls.length, 1);
      assert.equal(runCalls[0]?.commandName, "GameRoomXoxRemoteMove");
      assert.equal(runCalls[0]?.payload.remoteUserId, "raistlin.majere.1981@gmail.com");
      assert.equal(runCalls[0]?.payload.localSessionId, "us1-session-1");
      assert.equal(runCalls[0]?.payload.transportMessageId, "<remote-move@example.test>");
      assert.deepEqual(runCalls[0]?.payload.roomPayload, {
        roomId: "game-room",
        matchId: "xox_1",
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
