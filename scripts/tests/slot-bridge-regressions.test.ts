import assert from "node:assert/strict";
import test from "node:test";

const { slotBridgeHandler, slotBridgeRuntime } =
  await import("../../src/js/modules/commands/slot-bridge.ts");
const { RoomCommandRegistry } = await import("../../src/js/modules/rooms/room-command-registry.ts");
const { SlotController } = await import("../../src/js/modules/slot-controller.ts");
const { AppState } = await import("../../src/js/modules/app-state.ts");
const { AssistantProviderRegistry } =
  await import("../../src/js/pages/assistant/provider-registry.ts");
const { SettingsManager } = await import("../../src/js/modules/settings-manager.ts");
const { TrafficManager } = await import("../../src/js/modules/traffic-manager.ts");

type ElectronApiMock = {
  us1SendMessage?: (params: Record<string, unknown>) => Promise<unknown>;
  us1SyncMessages?: (params?: Record<string, unknown>) => Promise<unknown>;
  dbGetMessages?: (query: Record<string, unknown>) => Promise<unknown>;
  dbGetAttachments?: (query: Record<string, unknown>) => Promise<unknown>;
};

type TestWindow = {
  electronAPI?: ElectronApiMock;
  location?: {
    href: string;
    origin: string;
    protocol: string;
  };
  setTimeout?: typeof setTimeout;
};

type SendBatchPayload = {
  targets?: string[];
  text?: string;
  page?: string;
  attachments?: Array<{ name: string; path: string }>;
  waitForCompletion?: boolean;
  clientRequestId?: string;
  brokerMessageId?: string;
};

type SendMessagePayload = {
  provider?: string;
  text?: string;
  page?: string;
  waitForCompletion?: boolean;
  clientRequestId?: string;
  brokerMessageId?: string;
};

type SlotBridgeAttachmentRef = {
  kind: "attachment-ref";
  name: string;
  ref: string;
};

type SlotBridgeFileSystemAttachment = {
  kind: "filesystem";
  name: string;
  path: string;
};

function makeReadyTrafficState(lastHref: string) {
  return {
    status: { loading: "idle", thinking: "idle", send: "idle" },
    lastHref,
    lastSendSeen: 0,
    loadingActive: false,
    loadingFromDefaultTransition: false,
    loadingStartTime: 0,
    loadingScrollAppeared: false,
    lastScrollChange: 0,
    lastAutoScrollAt: 0,
    loadingJustEnded: false,
    loadingEndedAt: 0,
    stopButtonLastSeen: 0,
    stopButtonDisappearedAt: 0,
    thinkingJustEnded: false,
    thinkingEndedAt: 0,
    polling: false,
    readyState: "ready",
    sendState: "enabled",
    thinkingState: "idle",
  };
}

type SlotBridgeHarness = {
  appState: {
    getAccountForSlot: (slot: string) => { id: string; provider: string; email: string } | null;
    getArchiveAccountIdForProvider: (provider: string) => string | null;
    getProviderIdForSlot: (slot: string) => string | null;
    hasUs1Identity: () => boolean;
    isAssistantToolsReady: () => boolean;
    isAssigned: (slot: string) => boolean;
    isConnected: (slot: string) => boolean;
    isUs1Connected: () => boolean;
    setAssistantToolsReady: (ready: boolean) => void;
  };
  conversationListManager: {
    entries: Array<Record<string, unknown>>;
    refresh: (options?: Record<string, unknown>) => Promise<void>;
    updateSelection: (
      conversationId: string,
      options?: { provider?: string; silent?: boolean }
    ) => boolean;
  };
  coreEngine: {
    ensureReady: () => Promise<void>;
    setActiveTargets: (targets?: string[]) => void;
    sendBatchInternal: (
      payload?: SendBatchPayload
    ) => Promise<{ success: boolean; message?: string }>;
    sendMessageInternal: (
      payload: SendMessagePayload | null
    ) => Promise<{ success: boolean; message?: string }>;
    setConnection: (
      provider: string,
      connected: boolean,
      opts?: { force?: boolean; url?: string }
    ) => Promise<{ success: boolean; message?: string }>;
  };
  restore: () => void;
  runtime: {
    getConversationListManager: () => Promise<SlotBridgeHarness["conversationListManager"]>;
    getCoreEngine: () => Promise<SlotBridgeHarness["coreEngine"]>;
    getWebviewManager: () => Promise<SlotBridgeHarness["webviewManager"]>;
  };
  slotController: {
    connect: (
      slot: string,
      options?: { force?: boolean; url?: string }
    ) => Promise<{ success: boolean; message?: string }>;
    getState: (slot: string) => unknown;
    isConnected: (slot: string) => boolean;
    navigate: (slot: string, url: string | null) => void;
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
  const originalTrafficStates = {
    ai0: TrafficManager.state["ai0"],
    ai1: TrafficManager.state["ai1"],
    ai2: TrafficManager.state["ai2"],
    us1: TrafficManager.state["us1"],
  };

  const coreEngine: SlotBridgeHarness["coreEngine"] = {
    ensureReady: async () => {},
    setActiveTargets: async () => {},
    sendBatchInternal: async () => await Promise.resolve({ success: true }),
    sendMessageInternal: async () => await Promise.resolve({ success: true }),
    setConnection: async () => await Promise.resolve({ success: true }),
  };
  const webviewManager: SlotBridgeHarness["webviewManager"] = {
    syncProvider: async () => await Promise.resolve(null),
  };
  const conversationListManager: SlotBridgeHarness["conversationListManager"] = {
    entries: [],
    refresh: async () => {},
    updateSelection: () => true,
  };
  const slotController = SlotController as unknown as SlotBridgeHarness["slotController"];
  const appState = AppState as unknown as SlotBridgeHarness["appState"];
  const runtime = slotBridgeRuntime as unknown as SlotBridgeHarness["runtime"];

  const originalGetConversationListManager = runtime.getConversationListManager;
  const originalGetCoreEngine = runtime.getCoreEngine;
  const originalGetWebviewManager = runtime.getWebviewManager;
  const originalGetState = slotController.getState;
  const originalIsConnected = slotController.isConnected;
  const originalConnect = slotController.connect;
  const originalNavigate = slotController.navigate;
  const originalGetAccountForSlot = appState.getAccountForSlot;
  const originalGetArchiveAccountIdForProvider = appState.getArchiveAccountIdForProvider;
  const originalGetProviderIdForSlot = appState.getProviderIdForSlot;
  const originalHasUs1Identity = appState.hasUs1Identity;
  const originalIsAssistantToolsReady = appState.isAssistantToolsReady;
  const originalIsAssigned = appState.isAssigned;
  const originalAppStateIsConnected = appState.isConnected;
  const originalAppStateIsUs1Connected = appState.isUs1Connected;
  const originalSetAssistantToolsReady = appState.setAssistantToolsReady;

  let now = 0;
  const immediateSetTimeout = ((callback: TimerHandler, _delay?: number, ...args: unknown[]) => {
    if (typeof callback === "function") {
      (callback as (...args: unknown[]) => void)(...args);
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  globalWithWindow.window = {
    electronAPI: {},
    location: {
      href: "http://localhost:5174/",
      origin: "http://localhost:5174",
      protocol: "http:",
    },
    setTimeout: options.immediateTimers === true ? immediateSetTimeout : setTimeout,
  };

  if (options.immediateTimers === true) {
    Date.now = () => {
      now += options.nowStepMs ?? 100;
      return now;
    };
  }

  runtime.getConversationListManager = async () => await Promise.resolve(conversationListManager);
  runtime.getCoreEngine = async () => await Promise.resolve(coreEngine);
  runtime.getWebviewManager = async () => await Promise.resolve(webviewManager);
  slotController.getState = () => ({
    state: "connected",
    domReady: true,
    urlExcluded: false,
  });
  slotController.isConnected = () => true;
  slotController.connect = async () => await Promise.resolve({ success: true });
  slotController.navigate = () => {};
  appState.getAccountForSlot = (slot: string) => ({
    id: `acct-${slot}`,
    provider: slot,
    email: `${slot}@example.test`,
  });
  appState.getArchiveAccountIdForProvider = () => "acct-1";
  appState.getProviderIdForSlot = (slot: string) => slot;
  appState.hasUs1Identity = () => true;
  appState.isAssistantToolsReady = () => true;
  appState.isAssigned = () => true;
  appState.isConnected = () => true;
  appState.isUs1Connected = () => true;
  appState.setAssistantToolsReady = () => {};

  TrafficManager.state["ai0"] = makeReadyTrafficState("https://chatgpt.com/ai0");
  TrafficManager.state["ai1"] = makeReadyTrafficState("https://chatgpt.com/ai1");
  TrafficManager.state["ai2"] = makeReadyTrafficState("https://chatgpt.com/ai2");
  TrafficManager.state["us1"] = makeReadyTrafficState("https://mail.example.test/us1");

  return {
    appState,
    conversationListManager,
    coreEngine,
    restore: () => {
      runtime.getConversationListManager = originalGetConversationListManager;
      runtime.getCoreEngine = originalGetCoreEngine;
      runtime.getWebviewManager = originalGetWebviewManager;
      slotController.getState = originalGetState;
      slotController.isConnected = originalIsConnected;
      slotController.connect = originalConnect;
      slotController.navigate = originalNavigate;
      appState.getAccountForSlot = originalGetAccountForSlot;
      appState.getArchiveAccountIdForProvider = originalGetArchiveAccountIdForProvider;
      appState.getProviderIdForSlot = originalGetProviderIdForSlot;
      appState.hasUs1Identity = originalHasUs1Identity;
      appState.isAssistantToolsReady = originalIsAssistantToolsReady;
      appState.isAssigned = originalIsAssigned;
      appState.isConnected = originalAppStateIsConnected;
      appState.isUs1Connected = originalAppStateIsUs1Connected;
      appState.setAssistantToolsReady = originalSetAssistantToolsReady;
      TrafficManager.state["ai0"] = originalTrafficStates["ai0"]!;
      TrafficManager.state["ai1"] = originalTrafficStates["ai1"]!;
      TrafficManager.state["ai2"] = originalTrafficStates["ai2"]!;
      TrafficManager.state["us1"] = originalTrafficStates["us1"]!;
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

describe("SlotBridge sendWait and auto-connect", () => {
