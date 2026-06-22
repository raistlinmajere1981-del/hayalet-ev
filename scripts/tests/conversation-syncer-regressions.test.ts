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
