import assert from "node:assert/strict";
import test from "node:test";

import { ConversationSyncer } from "../../src/js/modules/webview/conversation-syncer.ts";
import { AppState } from "../../src/js/modules/app-state.ts";

type TimeoutFn = typeof globalThis.setTimeout;
type ClearTimeoutFn = typeof globalThis.clearTimeout;

function installWindowMock(): {
  restore: () => void;
} {
  const globalScope = globalThis as unknown as {
    window?: { dispatchEvent: (event: Event) => boolean };
  };
  const originalWindow = globalScope.window;
  globalScope.window = { dispatchEvent: () => true };
  return {
    restore: () => {
      globalScope.window = originalWindow as Window;
    },
  };
}

function installTimerMock(): {
  scheduled: Array<{ fn: () => void; delay: number }>;
  restore: () => void;
} {
  const originalSetTimeout: TimeoutFn = globalThis.setTimeout;
  const originalClearTimeout: ClearTimeoutFn = globalThis.clearTimeout;
  const scheduled: Array<{ fn: () => void; delay: number }> = [];

  globalThis.setTimeout = ((fn: (...args: unknown[]) => void, delay?: number) => {
    scheduled.push({ fn: () => { fn(); }, delay: delay ?? 0 });
    return scheduled.length as unknown as ReturnType<typeof setTimeout>;
  }) as TimeoutFn;

  globalThis.clearTimeout = (() => {});

  return {
    scheduled,
    restore: () => {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

function resetSyncerState(): void {
  ConversationSyncer._syncRetryTimers = {};
  ConversationSyncer._syncRetryCounts = {};
  ConversationSyncer._syncInProgress = {};
  ConversationSyncer._lastSyncResult = {};
  ConversationSyncer._lastThinkingEndedAt = { ai1: 0, ai2: 0 };
}


describe("syncConversation prefers webcontents capture fallback and isolates image save fa", () => {
void test("syncConversation prefers webcontents capture fallback and isolates image save failures", async () => {
  const globalScope = globalThis as unknown as {
    window?: {
      electronAPI?: {
        dbSyncMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetAttachments?: (...args: unknown[]) => Promise<unknown>;
        dbSaveAttachmentContent?: (...args: unknown[]) => Promise<unknown>;
        captureWebContentsPage?: (...args: unknown[]) => Promise<unknown>;
        capturePage?: (...args: unknown[]) => Promise<unknown>;
      };
    };
  };

  const originalWindow = globalScope.window;
  const originalGetProvider = AppState.getProviderIdForSlot;
  const originalGetAccount = AppState.getAccountForSlot;
  const originalGetRelay = AppState.getAssistantRelay;
  const originalGetNickname = AppState.getNickname;
  const saveCalls: Array<Record<string, unknown>> = [];
  let guestCaptureCalls = 0;
  let windowCaptureCalls = 0;
  let executeCount = 0;

  globalScope.window = {
    electronAPI: {
      dbSyncMessages: async () => ({ success: true, conversationId: "c1", added: 1, total: 1 }),
      dbGetMessages: async () => ({
        data: [
          {
            id: "db-assistant-1",
            role: "assistant",
            content: "[image]",
            dom_index: 0,
            content_hash: "h1",
            created_at: 123,
          },
        ],
      }),
      dbGetAttachments: async () => ({ success: true, data: [] }),
      dbSaveAttachmentContent: ((payload: Record<string, unknown>) => {
        saveCalls.push(payload);
        if (saveCalls.length === 1) {
          return { success: false, error: "first-failed" };
        }
        return {
          success: true,
          data: { attachmentId: "att-2", storedPath: "/tmp/generated-2.png" },
        };
      }) as unknown as (...args: unknown[]) => Promise<unknown>,
      captureWebContentsPage: async () => {
        guestCaptureCalls += 1;
        return { success: true, dataUrl: "data:image/png;base64,Q0FQVFVSRTI=" };
      },
      capturePage: async () => {
        windowCaptureCalls += 1;
        return { success: true, dataUrl: "data:image/png;base64,V0lORE9X" };
      },
    },
  };

  AppState.getProviderIdForSlot = (() => "chatgpt");
  AppState.getAccountForSlot = (() => ({
    id: "account-1",
    provider: "chatgpt",
  })) as unknown as typeof AppState.getAccountForSlot;
  AppState.getAssistantRelay = (() => ({
    active: false,
    sourceSlot: null,
  }));
  AppState.getNickname = ((slot: string) => slot);

  const mockWebview = {
    getURL: () => "https://chatgpt.com/c/generated-image",
    getWebContentsId: () => 42,
    executeJavaScript: () => {
      executeCount += 1;
      if (executeCount === 1) {
        return [
          {
            role: "assistant",
            text: "[image]",
            index: 0,
            domIndex: 0,
            contentHash: "h1",
            generatedImages: [
              {
                stableKey: "stable-1",
                currentSrc: "https://cdn.example.test/first.png",
                mimeType: "image/png",
                originalName: "generated-image-ai1-01-stable-1.png",
                imageIndex: 0,
              },
              {
                stableKey: "stable-2",
                currentSrc: "https://cdn.example.test/second.png",
                mimeType: "image/png",
                originalName: "generated-image-ai1-02-stable-2.png",
                imageIndex: 1,
              },
            ],
          },
        ];
      }

      return {
        success: false,
        base64: "",
        mimeType: "image/png",
        rect: { x: 5, y: 8, width: 120, height: 90 },
      };
    },
  };

  try {
    const result = await ConversationSyncer.syncConversation("ai1", mockWebview as any, {});
    assert.equal(result.success, true);
    assert.equal(result["generatedImageSavedCount"], 1);
    assert.equal(result["generatedImagePendingCount"], 1);
    assert.equal(guestCaptureCalls, 2);
    assert.equal(windowCaptureCalls, 0);
  } finally {
    AppState.getProviderIdForSlot = originalGetProvider;
    AppState.getAccountForSlot = originalGetAccount;
    AppState.getAssistantRelay = originalGetRelay;
    AppState.getNickname = originalGetNickname;
    globalScope.window = originalWindow as any;
  }
});
});
