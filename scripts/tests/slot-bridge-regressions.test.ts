import assert from "node:assert/strict";
import test from "node:test";

const { slotBridgeHandler, slotBridgeRuntime } = await import(
  "../../src/js/modules/commands/slot-bridge.ts"
);
const { RoomCommandRegistry } = await import("../../src/js/modules/rooms/room-command-registry.ts");
const { SlotController } = await import("../../src/js/modules/slot-controller.ts");
const { AppState } = await import("../../src/js/modules/app-state.ts");

type ElectronApiMock = {
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
  };
  coreEngine: {
    sendBatch: (payload?: {
      targets?: string[];
      text?: string;
      page?: string;
      attachments?: Array<{ name: string; path: string }>;
    }) => Promise<{ success: boolean; message?: string }>;
    sendMessage: (payload: {
      provider?: string;
      text?: string;
      page?: string;
    } | null) => Promise<{ success: boolean; message?: string }>;
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

function createHarness(options: { immediateTimers?: boolean } = {}): SlotBridgeHarness {
  const globalWithWindow = globalThis as { window?: TestWindow };
  const originalWindow = globalWithWindow.window;
  const originalDateNow = Date.now;

  const coreEngine: SlotBridgeHarness["coreEngine"] = {
    sendBatch: async () => ({ success: true }),
    sendMessage: async () => ({ success: true }),
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
      now += 600;
      return now;
    };
  }

  runtime.getCoreEngine = async () => coreEngine;
  runtime.getWebviewManager = async () => webviewManager;
  slotController.isConnected = () => true;
  appState.getArchiveAccountIdForProvider = () => "acct-1";
  appState.getProviderIdForSlot = (slot: string) => slot;

  return {
    appState,
    coreEngine,
    restore: () => {
      runtime.getCoreEngine = originalGetCoreEngine;
      runtime.getWebviewManager = originalGetWebviewManager;
      slotController.isConnected = originalIsConnected;
      appState.getArchiveAccountIdForProvider = originalGetArchiveAccountIdForProvider;
      appState.getProviderIdForSlot = originalGetProviderIdForSlot;
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
      harness.coreEngine.sendBatch = async () => {
        throw new Error("sendBatch should not run for text-only sendWait");
      };
      harness.coreEngine.sendMessage = async (payload) => {
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
  "SlotBridge sendWait forwards replies back to replyToSlot for cross-slot AI routing",
  { concurrency: false },
  async () => {
    const harness = createHarness();
    let sent = false;
    const sendMessageCalls: Array<{ provider?: string; text?: string; page?: string }> = [];

    try {
      harness.coreEngine.sendBatch = async () => {
        throw new Error("sendBatch should not run for text-only reply forwarding");
      };
      harness.coreEngine.sendMessage = async (payload) => {
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
      harness.coreEngine.sendBatch = async () => {
        throw new Error("sendBatch should not run for text-only sendWait");
      };
      harness.coreEngine.sendMessage = async () => ({ success: true });
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
  "SlotBridge file.send resolves archive attachment refs and rejects raw AI filesystem paths",
  { concurrency: false },
  async () => {
    const harness = createHarness();
    let batchAttachments: Array<{ name: string; path: string }> = [];

    try {
      harness.coreEngine.sendBatch = async (payload) => {
        batchAttachments = payload?.attachments ?? [];
        return { success: true };
      };
      harness.coreEngine.sendMessage = async () => {
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

      assert.equal(okResult.success, true);
      assert.deepEqual(batchAttachments, [{ name: "archive-image.png", path: "/tmp/archive-image.png" }]);

      const blockedResult = await slotBridgeHandler({
        action: "file.send",
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
