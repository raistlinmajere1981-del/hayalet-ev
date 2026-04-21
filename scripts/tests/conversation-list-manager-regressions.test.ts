import assert from "node:assert/strict";
import test from "node:test";

import { ConversationListManager } from "../../src/js/modules/conversation-list-manager.ts";
import { SettingsManager } from "../../src/js/modules/settings-manager.ts";
import { SlotController, SlotEvent } from "../../src/js/modules/slot-controller.ts";

test("slot account change triggers conversation list refresh", async () => {
  let settingsListener: ((event: { changedPaths: string[] }) => void) | null = null;
  let refreshCallCount = 0;
  let renderAllCallCount = 0;

  const originalSubscribe = SettingsManager.subscribe.bind(SettingsManager);
  const originalSlotOn = SlotController.on.bind(SlotController);
  const originalRefresh = ConversationListManager.refresh.bind(ConversationListManager);
  const originalRenderAll = ConversationListManager.renderAll.bind(ConversationListManager);

  SettingsManager.subscribe = (
    listener: (event: { settings: unknown; changedPaths: string[] }) => void
  ): (() => void) => {
    settingsListener = (event: { changedPaths: string[] }) => {
      listener({ settings: null, changedPaths: event.changedPaths });
    };
    return (): void => {};
  };

  SlotController.on = (
    _event: SlotEvent,
    _listener: (payload: { event?: string; slot?: string; data?: { isDefaultPage?: boolean } }) => void
  ): (() => void) => {
    return (): void => {};
  };

  ConversationListManager.refresh = async (): Promise<void> => {
    refreshCallCount += 1;
  };

  ConversationListManager.renderAll = (): void => {
    renderAllCallCount += 1;
  };

  try {
    ConversationListManager.subscribeToSettings();

    assert.ok(settingsListener !== null, "settings listener should be registered");

    settingsListener({ changedPaths: ["slots.ai1.accountId"] });

    assert.equal(
      refreshCallCount,
      1,
      "slot account change must refresh conversation data for topbar lists"
    );
    assert.equal(renderAllCallCount, 0, "slot account change should not use stale render-only path");
  } finally {
    SettingsManager.subscribe = originalSubscribe;
    SlotController.on = originalSlotOn;
    ConversationListManager.refresh = originalRefresh;
    ConversationListManager.renderAll = originalRenderAll;
    ConversationListManager.destroy();
  }
});

test("ai0 session change refreshes topbar with stored selection instead of stale DOM value", async () => {
  let settingsListener: ((event: { changedPaths: string[] }) => void) | null = null;
  const refreshCalls: Array<{
    silent?: boolean;
    forceSelectId?: string;
    skipNotify?: boolean;
    provider?: string;
  }> = [];

  const originalSubscribe = SettingsManager.subscribe.bind(SettingsManager);
  const originalSlotOn = SlotController.on.bind(SlotController);
  const originalRefresh = ConversationListManager.refresh.bind(ConversationListManager);
  const originalSyncAi0SelectionFromSettings =
    ConversationListManager._syncAi0SelectionFromSettings.bind(ConversationListManager);

  SettingsManager.subscribe = (
    listener: (event: { settings: unknown; changedPaths: string[] }) => void
  ): (() => void) => {
    settingsListener = (event: { changedPaths: string[] }) => {
      listener({ settings: null, changedPaths: event.changedPaths });
    };
    return (): void => {};
  };

  SlotController.on = (
    _event: SlotEvent,
    _listener: (payload: { event?: string; slot?: string; data?: { isDefaultPage?: boolean } }) => void
  ): (() => void) => {
    return (): void => {};
  };

  ConversationListManager.refresh = async (options = {}): Promise<void> => {
    refreshCalls.push(options);
  };

  ConversationListManager._syncAi0SelectionFromSettings = (): void => {};

  try {
    ConversationListManager.subscribeToSettings();

    assert.ok(settingsListener !== null, "settings listener should be registered");

    settingsListener({ changedPaths: ["assistants.lastOpencodeUiSessionId"] });

    assert.deepEqual(refreshCalls, [
      {
        silent: false,
        skipNotify: true,
        provider: "ai0",
      },
    ]);
  } finally {
    SettingsManager.subscribe = originalSubscribe;
    SlotController.on = originalSlotOn;
    ConversationListManager.refresh = originalRefresh;
    ConversationListManager._syncAi0SelectionFromSettings = originalSyncAi0SelectionFromSettings;
    ConversationListManager.destroy();
  }
});
