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
      globalScope.window = originalWindow;
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
    scheduled.push({ fn: () => fn(), delay: delay ?? 0 });
    return scheduled.length as unknown as ReturnType<typeof setTimeout>;
  }) as TimeoutFn;

  globalThis.clearTimeout = (() => {}) as ClearTimeoutFn;

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
}

test("auto sync schedules retry when scraped messages are empty", async () => {
  const windowMock = installWindowMock();
  const timerMock = installTimerMock();
  const originalSyncConversation = ConversationSyncer.syncConversation;
  const originalRefresh = ConversationListManager.refresh;

  resetSyncerState();

  ConversationSyncer.syncConversation = async () => ({
    success: true,
    count: 0,
    messages: [],
    commands: [],
    webUrl: "https://chatgpt.com/c/abc",
  });
  ConversationListManager.refresh = async () => {};

  try {
    await ConversationSyncer.syncProvider("ai1", { from: "auto" });
    assert.equal(timerMock.scheduled.length > 0, true);
  } finally {
    ConversationSyncer.syncConversation = originalSyncConversation;
    ConversationListManager.refresh = originalRefresh;
    timerMock.restore();
    windowMock.restore();
  }
});

test("auto sync does not schedule retry when last message is assistant", async () => {
  const windowMock = installWindowMock();
  const timerMock = installTimerMock();
  const originalSyncConversation = ConversationSyncer.syncConversation;
  const originalRefresh = ConversationListManager.refresh;

  resetSyncerState();

  ConversationSyncer.syncConversation = async () => ({
    success: true,
    count: 2,
    messages: [
      { role: "user", text: "hello" },
      { role: "assistant", text: "hi" },
    ],
    commands: [],
    webUrl: "https://chatgpt.com/c/abc",
  });
  ConversationListManager.refresh = async () => {};

  try {
    await ConversationSyncer.syncProvider("ai1", { from: "auto" });
    assert.equal(timerMock.scheduled.length, 0);
  } finally {
    ConversationSyncer.syncConversation = originalSyncConversation;
    ConversationListManager.refresh = originalRefresh;
    timerMock.restore();
    windowMock.restore();
  }
});

test("ai0 sync returns latest assistant message without DB persistence", async () => {
  const globalScope = globalThis as unknown as {
    window?: {
      electronAPI?: {
        dbSyncMessages?: (...args: unknown[]) => Promise<unknown>;
        dbGetMessages?: (...args: unknown[]) => Promise<unknown>;
      };
    };
  };

  const originalWindow = globalScope.window;
  const originalGetProvider = AppState.getProviderIdForSlot;
  const originalGetAccount = AppState.getAccountForSlot;

  let dbSyncCallCount = 0;

  globalScope.window = {
    electronAPI: {
      dbSyncMessages: async () => {
        dbSyncCallCount += 1;
        return { success: true, conversationId: "c1", added: 0, total: 0 };
      },
      dbGetMessages: async () => ({ data: [] }),
    },
  };

  AppState.getProviderIdForSlot = (() => "opencode") as typeof AppState.getProviderIdForSlot;
  AppState.getAccountForSlot = (() => ({
    id: "opencode_opencode_at_opencode_com",
    provider: "opencode",
  })) as typeof AppState.getAccountForSlot;

  const mockWebview = {
    getURL: () => "https://opencode.local/chat",
    isLoading: () => false,
    executeJavaScript: async () => [
      { role: "user", text: "hello" },
      { role: "assistant", text: "latest assistant reply" },
    ],
  };

  try {
    const result = await ConversationSyncer.syncConversation("ai0", mockWebview as never, {});
    assert.equal(result.success, true);
    assert.equal(Array.isArray(result.messages), true);
    assert.equal((result.messages ?? []).length, 1);
    assert.equal((result.messages ?? [])[0]?.role, "assistant");
    assert.equal((result.messages ?? [])[0]?.text, "latest assistant reply");
    assert.equal(dbSyncCallCount, 0);
  } finally {
    AppState.getProviderIdForSlot = originalGetProvider;
    AppState.getAccountForSlot = originalGetAccount;
    globalScope.window = originalWindow;
  }
});
