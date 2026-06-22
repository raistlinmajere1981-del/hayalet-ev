import assert from "node:assert/strict";
import test from "node:test";

import { ConversationSyncer } from "../../src/js/modules/webview/conversation-syncer.ts";
import { ConversationListManager } from "../../src/js/modules/conversation-list-manager.ts";
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


describe("_getArchiveStatus reads wrapped conversation payloads from IPC", () => {
void test("_getArchiveStatus reads wrapped conversation payloads from IPC", async () => {
  const globalScope = globalThis as unknown as {
    window?: {
      electronAPI?: {
        dbGetConversations?: (...args: unknown[]) => Promise<unknown>;
      };
    };
  };

  const originalWindow = globalScope.window;
  const originalGetAccount = AppState.getAccountForSlot;

  globalScope.window = {
    electronAPI: {
      dbGetConversations: async () => ({
        success: true,
        data: [
          {
            id: "conversation-1",
            webUrl: "https://chatgpt.com/c/archive-demo",
            messageCount: 7,
          },
        ],
      }),
    },
  };

  AppState.getAccountForSlot = (() => ({
    id: "account-1",
    provider: "chatgpt",
  })) as unknown as typeof AppState.getAccountForSlot;

  try {
    const result = await ConversationSyncer._getArchiveStatus(
      "ai1",
      "https://chatgpt.com/c/archive-demo"
    );

    assert.equal(result.newEntry, false);
    assert.equal(result.prevCount, 7);
    assert.equal(result.existing?.webUrl, "https://chatgpt.com/c/archive-demo");
  } finally {
    AppState.getAccountForSlot = originalGetAccount;
    globalScope.window = originalWindow as any;
  }
});
void test("syncConversation skips generated image save when attachment already exists", async () => {
  const globalScope = globalThis as unknown as {
    window?: {
      electronAPI?: {
        dbSyncMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetAttachments?: (...args: unknown[]) => Promise<unknown>;
        dbSaveAttachmentContent?: (...args: unknown[]) => Promise<unknown>;
      };
    };
  };

  const originalWindow = globalScope.window;
  const originalGetProvider = AppState.getProviderIdForSlot;
  const originalGetAccount = AppState.getAccountForSlot;
  const originalGetRelay = AppState.getAssistantRelay;
  const originalGetNickname = AppState.getNickname;

  let saveCallCount = 0;
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
      dbGetAttachments: async () => ({
        success: true,
        data: [
          {
            message_id: "db-assistant-1",
            original_name: "generated-image-chatgpt-01-img-1.png",
          },
        ],
      }),
      dbSaveAttachmentContent: async () => {
        saveCallCount += 1;
        return { success: true };
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
    executeJavaScript: () => {
      executeCount += 1;
      return [
        {
          role: "assistant",
          text: "[image]",
          index: 0,
          domIndex: 0,
          contentHash: "h1",
          generatedImages: [
            {
              id: "img-1",
              src: "data:image/png;base64,QUJD",
              currentSrc: "data:image/png;base64,QUJD",
              alt: "Generated image",
              mimeType: "image/png",
              originalName: "generated-image-chatgpt-01-img-1.png",
              imageIndex: 0,
            },
          ],
        },
      ];
    },
  };

  try {
    const result = await ConversationSyncer.syncConversation("ai1", mockWebview as any, {});
    assert.equal(result.success, true);
    assert.equal(saveCallCount, 0);
    assert.equal(executeCount, 2);
  } finally {
    AppState.getProviderIdForSlot = originalGetProvider;
    AppState.getAccountForSlot = originalGetAccount;
    AppState.getAssistantRelay = originalGetRelay;
    AppState.getNickname = originalGetNickname;
    globalScope.window = originalWindow as any;
  }
});
void test("syncConversation replaces preview image attachment when final bytes change", async () => {
  const globalScope = globalThis as unknown as {
    window?: {
      electronAPI?: {
        dbSyncMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetAttachments?: (...args: unknown[]) => Promise<unknown>;
        dbSaveAttachmentContent?: (...args: unknown[]) => Promise<unknown>;
        readFile?: (path: string) => Promise<string | null>;
      };
    };
  };

  const originalWindow = globalScope.window;
  const originalGetProvider = AppState.getProviderIdForSlot;
  const originalGetAccount = AppState.getAccountForSlot;
  const originalGetRelay = AppState.getAssistantRelay;
  const originalGetNickname = AppState.getNickname;
  const saveCalls: Array<Record<string, unknown>> = [];
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
      dbGetAttachments: async () => ({
        success: true,
        data: [
          {
            message_id: "db-assistant-1",
            original_name: "generated-image-ai1-01-stable.png",
            stored_path: "/tmp/generated-preview.png",
          },
        ],
      }),
      readFile: async () => "UFJFVklFVw==",
      dbSaveAttachmentContent: ((payload: Record<string, unknown>) => {
        saveCalls.push(payload);
        return {
          success: true,
          data: { attachmentId: "att-1", storedPath: "/tmp/generated-preview.png" },
        };
      }) as unknown as (...args: unknown[]) => Promise<unknown>,
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
                stableKey: "stable",
                src: "https://cdn.example.test/final.png",
                currentSrc: "https://cdn.example.test/final.png",
                mimeType: "image/png",
                originalName: "generated-image-ai1-01-stable.png",
                imageIndex: 0,
              },
            ],
          },
        ];
      }

      return {
        success: true,
        base64: "RklOQUw=",
        mimeType: "image/png",
        rect: null,
      };
    },
  };

  try {
    const result = await ConversationSyncer.syncConversation("ai1", mockWebview as any, {});
    assert.equal(result.success, true);
    assert.equal(saveCalls.length, 1);
    assert.equal(saveCalls[0]?.["originalName"], "generated-image-ai1-01-stable.png");
    assert.equal(saveCalls[0]["base64"], "RklOQUw=");
  } finally {
    AppState.getProviderIdForSlot = originalGetProvider;
    AppState.getAccountForSlot = originalGetAccount;
    AppState.getAssistantRelay = originalGetRelay;
    AppState.getNickname = originalGetNickname;
    globalScope.window = originalWindow as any;
  }
});
void test("syncConversation uses a post-thinking probe to pick up generated images", async () => {
  const globalScope = globalThis as unknown as {
    window?: {
      electronAPI?: {
        dbSyncMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetAttachments?: (...args: unknown[]) => Promise<unknown>;
        dbSaveAttachmentContent?: (...args: unknown[]) => Promise<unknown>;
      };
    };
  };

  const originalWindow = globalScope.window;
  const originalGetProvider = AppState.getProviderIdForSlot;
  const originalGetAccount = AppState.getAccountForSlot;
  const originalGetRelay = AppState.getAssistantRelay;
  const originalGetNickname = AppState.getNickname;
  const originalProbeDelay = ConversationSyncer.postThinkingProbePollMs;
  const originalProbeMaxPolls = ConversationSyncer.postThinkingProbeMaxPolls;

  const saveCalls: Array<Record<string, unknown>> = [];
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
        return { success: true, data: { attachmentId: "att-1", storedPath: "/tmp/generated.png" } };
      }) as unknown as (...args: unknown[]) => Promise<unknown>,
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

  ConversationSyncer.postThinkingProbePollMs = 0;
  ConversationSyncer.postThinkingProbeMaxPolls = 1;
  ConversationSyncer._lastThinkingEndedAt["ai1"] = Date.now();

  const mockWebview = {
    getURL: () => "https://chatgpt.com/c/generated-image",
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
            generatedImages: [],
          },
        ];
      }

      if (executeCount === 2) {
        return [
          {
            role: "assistant",
            text: "[image]",
            index: 0,
            domIndex: 0,
            contentHash: "h1",
            generatedImages: [
              {
                stableKey: "stable",
                currentSrc: "data:image/png;base64,QUJD",
                mimeType: "image/png",
                originalName: "generated-image-ai1-01-stable.png",
                imageIndex: 0,
              },
            ],
          },
        ];
      }

      return {
        success: true,
        base64: "QUJD",
        mimeType: "image/png",
        rect: null,
      };
    },
  };

  try {
    const result = await ConversationSyncer.syncConversation("ai1", mockWebview as any, {
      source: "auto",
    });
    assert.equal(result.success, true);
    assert.equal(saveCalls.length, 1);
  } finally {
    AppState.getProviderIdForSlot = originalGetProvider;
    AppState.getAccountForSlot = originalGetAccount;
    AppState.getAssistantRelay = originalGetRelay;
    AppState.getNickname = originalGetNickname;
    ConversationSyncer.postThinkingProbePollMs = originalProbeDelay;
    ConversationSyncer.postThinkingProbeMaxPolls = originalProbeMaxPolls;
    globalScope.window = originalWindow as any;
  }
});
});
