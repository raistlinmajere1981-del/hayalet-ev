import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

import { validateRoomManifest } from "../../src/types/rooms.ts";
import { loadWorkspaceScriptForVm } from "./helpers/room-workspace-script.ts";

const requiredFiles = [
  "rooms/game-room/manifest.json",
  "rooms/game-room/host/index.ts",
  "rooms/game-room/host/runtime.ts",
  "rooms/game-room/ui/index.html",
  "rooms/game-room/ui/context-runtime.ts",
  "rooms/game-room/ui/index.ts",
  "rooms/game-room/ui/game-room-ui-bootstrap.ts",
  "rooms/game-room/ui/game-room-ui-state-message-runtime.ts",
  "rooms/game-room/ui/game-room-ui-runtime.ts",
  "rooms/game-room/ui/style.css",
  "rooms/game-room/shared/host/feature-meta.ts",
  "rooms/game-room/shared/host/text.ts",
  "rooms/game-room/shared/host/context-state.ts",
  "rooms/game-room/shared/host/activation.ts",
  "rooms/game-room/shared/host/command-registry.ts",
  "rooms/game-room/shared/host/command-args.ts",
  "rooms/game-room/shared/ui/feature-contract.ts",
  "rooms/game-room/shared/ui/scroll-runtime.ts",
  "rooms/game-room/shared/types/room-shell-contracts.ts",
  "rooms/game-room/main-functions/backgammon/host/runtime.ts",
  "rooms/game-room/shared/styles/base.css",
  "rooms/game-room/i18n/en.json",
  "rooms/game-room/i18n/tr.json",
  "rooms/game-room/main-functions/backgammon/protocols/game-room-backgammon-user-start.md",
  "rooms/game-room/main-functions/backgammon/protocols/game-room-backgammon-ai-start.md",
  "rooms/game-room/main-functions/backgammon/host/copy.ts",
  "rooms/game-room/main-functions/backgammon/host/runtime-match.ts",
  "rooms/game-room/main-functions/backgammon/host/runtime-sync.ts",
  "rooms/game-room/main-functions/backgammon/host/state-core.ts",
  "rooms/game-room/main-functions/backgammon/host/state-invites.ts",
  "rooms/game-room/main-functions/backgammon/host/state-room-runtime.ts",
  "rooms/game-room/main-functions/backgammon/host/state.ts",
  "rooms/game-room/main-functions/backgammon/host/us1-invite-runtime.ts",
  "rooms/game-room/main-functions/backgammon/host/us1-sync-runtime.ts",
  "rooms/game-room/main-functions/backgammon/host/us1-runtime.ts",
  "rooms/game-room/main-functions/backgammon/ui/state-runtime.ts",
  "rooms/game-room/main-functions/backgammon/ui/backgammon-stage-runtime.ts",
  "rooms/game-room/main-functions/backgammon/ui/render-runtime.ts",
  "rooms/game-room/main-functions/backgammon/ui/module.ts",
  "rooms/game-room/main-functions/backgammon/styles.css",
  "rooms/game-room/main-functions/backgammon/styles/layout.css",
  "rooms/game-room/main-functions/backgammon/styles/presentation.css",
  "rooms/game-room/main-functions/backgammon/styles/board.css",
  "rooms/game-room/main-functions/backgammon/styles/scene-view.css",
  "rooms/game-room/shared/assets/room-background.webp",
  "rooms/game-room/shared/vendor/konva.min.js",
  "rooms/game-room/main-functions/backgammon/assets/backgammon-view.webp",
];

type BackgammonUiStateHarness = {
  state: {
    game: Record<string, unknown>;
    context: {
      slots: Record<string, Record<string, unknown>>;
      user: {
        nickname: string;
      };
    };
    preferences: {
      target: string;
      starter: string;
      inviteMessage: string;
    };
    lastCommandMessage: string;
    locale: string;
  };
  runtime: {
    createGameState: () => Record<string, unknown>;
    getCurrentStatus: () => string;
    syncPreferencesFromGame: () => void;
  };
};

type ScheduledFrameCallback = (timestamp: number) => void;
type ScheduledTimerCallback = () => void;
type ScheduledTimerHandle = {
  callback: ScheduledTimerCallback;
  cleared: boolean;
};
type GameRoomUiCoalescingHarness = {
  flushFrame: () => void;
  flushTimer: () => void;
  getFrameCount: () => number;
  getRenderAttempts: () => number;
  getTimerCount: () => number;
  runtime: {
    handleHostMessage(message: unknown): void;
  };
  setRenderFailure(enabled: boolean): void;
  setRenderHook(callback: (() => void) | null): void;
  state: {
    game: Record<string, unknown>;
    lastCommandMessage: string;
  };
};

class MinimalFakeElement {
  children: Array<MinimalFakeElement | string> = [];
  alt = "";
  className = "";
  dataset: Record<string, string> = {};
  disabled = false;
  id = "";
  innerHTML = "";
  loading = "";
  placeholder = "";
  readonly listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  replaceChildrenCount = 0;
  rows = 0;
  src = "";
  tagName = "DIV";
  textContent = "";
  title = "";
  type = "";
  value = "";

  constructor(tagName = "div", className = "", textContent = "") {
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.textContent = textContent;
  }

  addEventListener(eventName: string, handler: (...args: unknown[]) => void): void {
    const listeners = this.listeners[eventName] ?? [];
    listeners.push(handler);
    this.listeners[eventName] = listeners;
  }

  append(...children: Array<MinimalFakeElement | string>): void {
    this.children.push(...children);
  }

  click(): void {
    const event = {
      currentTarget: this,
      target: this,
      preventDefault: () => undefined,
    };
    (this.listeners["click"] ?? []).forEach((handler) => handler(event));
  }

  querySelector(selector: string): MinimalFakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): MinimalFakeElement[] {
    const matches: MinimalFakeElement[] = [];
    if (this.matchesSelector(selector)) {
      matches.push(this);
    }
    this.children.forEach((child) => {
      if (typeof child !== "string") {
        matches.push(...child.querySelectorAll(selector));
      }
    });
    return matches;
  }

  replaceChildren(...children: Array<MinimalFakeElement | string>): void {
    this.replaceChildrenCount += 1;
    this.children = [];
    this.append(...children);
  }

  setAttribute(name: string, value: string): void {
    if (name === "class") {
      this.className = value;
      return;
    }
    if (name === "id") {
      this.id = value;
      return;
    }
    this.dataset[name] = value;
  }

  private matchesSelector(selector: string): boolean {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return this.className.split(/\s+/).includes(className);
    }
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
}

class MinimalFakeDocument {
  title = "";
  readonly app = new MinimalFakeElement();

  constructor() {
    this.app.id = "app";
  }

  getElementById(id: string): MinimalFakeElement | null {
    return id === "app" ? this.app : null;
  }

  querySelector(selector: string): MinimalFakeElement | null {
    return this.app.querySelector(selector);
  }

  createElement(tagName: string): MinimalFakeElement {
    return new MinimalFakeElement(tagName);
  }
}

function createBackgammonUiStateHarness(): BackgammonUiStateHarness {
  const windowObject: {
    GameRoomUiFactories?: {
      createBackgammonUiStateRuntime?: (
        deps: Record<string, unknown>
      ) => BackgammonUiStateHarness["runtime"];
    };
  } = {};
  const context = {
    window: windowObject,
    globalThis: windowObject,
  };
  vm.createContext(context);
  vm.runInNewContext(
    loadWorkspaceScriptForVm("rooms/game-room/main-functions/backgammon/ui/state-runtime.ts"),
    context
  );

  const createSlot = (slotId: string) => ({
    slotId,
    nickname: slotId.toUpperCase(),
    assigned: true,
    connected: slotId !== "us1",
    ready: true,
  });
  const state = {
    game: {} as Record<string, unknown>,
    context: {
      slots: {
        ai1: createSlot("ai1"),
        ai2: createSlot("ai2"),
        us1: {
          ...createSlot("us1"),
          connected: false,
        },
      },
      user: {
        nickname: "User",
      },
    },
    preferences: {
      target: "ai1",
      starter: "user",
      inviteMessage: "",
    },
    lastCommandMessage: "",
    locale: "tr",
  };

  const runtimeFactory = windowObject.GameRoomUiFactories?.createBackgammonUiStateRuntime;
  assert.equal(typeof runtimeFactory, "function");
  const runtime = runtimeFactory({
    getState: () => state,
    roomId: "game-room",
    featureId: "backgammon",
    createSlot,
    createInviteEntry: () => ({
      roomId: "game-room",
      featureId: "backgammon",
      inviteId: "",
      remoteUserId: "",
      nickname: "US1",
      senderEmail: "",
      note: "",
      starter: "user",
      localSessionId: "",
      conversationId: "",
      sentAt: null,
    }),
    normalizeSlot: (_candidate: unknown, slotId: string) => createSlot(slotId),
    text: () => "",
    sendRoomCommand: () => undefined,
  });

  state.game = runtime.createGameState();
  return { state, runtime };
}

function createGameRoomUiCoalescingHarness(
  scheduler: "raf" | "timeout" | "raf-timeout" = "raf"
): GameRoomUiCoalescingHarness {
  const document = new MinimalFakeDocument();
  const frames: ScheduledFrameCallback[] = [];
  const timers: ScheduledTimerHandle[] = [];
  let renderAttempts = 0;
  let failRender = false;
  let renderHook: (() => void) | null = null;
  const state = {
    translations: {},
    context: {
      room: {
        name: "Game Room",
      },
    },
    preferences: {
      target: "ai1",
    },
    game: {} as Record<string, unknown>,
    teamTetris: {},
    fateKnots: {},
    lastCommandMessage: "",
  };
  const stateRef = { current: state };
  const windowObject: Record<string, unknown> = {};
  const context: Record<string, unknown> = {
    Date,
    document,
    navigator: { language: "en-US" },
    window: windowObject,
  };
  context["globalThis"] = context;
  if (scheduler === "raf" || scheduler === "raf-timeout") {
    context["requestAnimationFrame"] = (callback: ScheduledFrameCallback) => {
      frames.push(callback);
      return frames.length;
    };
  }
  if (scheduler === "timeout" || scheduler === "raf-timeout") {
    context["setTimeout"] = (callback: ScheduledTimerCallback) => {
      const handle: ScheduledTimerHandle = {
        callback,
        cleared: false,
      };
      timers.push(handle);
      return handle;
    };
    context["clearTimeout"] = (handle: ScheduledTimerHandle) => {
      handle.cleared = true;
    };
  }

  windowObject["GameRoomUiBootstrapRuntime"] = {
    createGameRoomUiBootstrapRuntime() {
      return {
        roomId: "game-room",
        featureId: "backgammon",
        teamTetrisFeatureId: "team-tetris",
        fateKnotsFeatureId: "fate-knots",
        contextRuntime: {
          normalizeContext: () => state.context,
        },
        scrollRuntime: {
          capture: () => ({}),
          restore: () => undefined,
        },
        stateRef,
        getState: () => state,
        backgammonUi: {
          sanitizeGameState: (candidate: unknown) =>
            candidate && typeof candidate === "object" && Array.isArray(candidate) === false
              ? (candidate as Record<string, unknown>)
              : {},
          syncPreferencesFromGame: () => undefined,
          renderBootstrap: () => undefined,
          renderBackgammon: () => {
            renderAttempts += 1;
            renderHook?.();
            if (failRender) {
              throw new Error("render failed");
            }
          },
        },
        teamTetrisUi: {
          getTestBridge: () => ({}),
          sanitizeTeamTetrisState: () => ({}),
          syncTeamTetrisPreferencesFromState: () => undefined,
          syncTeamTetrisDraftFromState: () => undefined,
          renderTeamTetris: () => undefined,
        },
        fateKnotsUi: {
          sanitizeFateKnotsState: () => ({}),
          renderFateKnots: () => undefined,
        },
        bootstrapText: (key: string) => key,
        applyPresentationMode: () => undefined,
        applyLocale: () => undefined,
        getActiveFeatureId: () => "backgammon",
        getFeatureLabel: () => "Tavla",
      };
    },
  };

  vm.createContext(context);
  vm.runInNewContext(
    loadWorkspaceScriptForVm("rooms/game-room/ui/game-room-ui-state-message-runtime.ts"),
    context
  );
  vm.runInNewContext(
    loadWorkspaceScriptForVm("rooms/game-room/ui/game-room-ui-runtime.ts"),
    context
  );

  const runtimeRegistry = windowObject["GameRoomUiRuntime"] as Record<string, unknown> | undefined;
  const createRuntime = runtimeRegistry?.["createGameRoomUiRuntime"];
  assert.equal(typeof createRuntime, "function");
  const runtime = createRuntime() as GameRoomUiCoalescingHarness["runtime"];

  return {
    flushFrame(): void {
      const callback = frames.shift();
      assert.equal(typeof callback, "function");
      callback(16);
    },
    flushTimer(): void {
      let handle = timers.shift();
      while (handle && handle.cleared) {
        handle = timers.shift();
      }
      assert.equal(typeof handle?.callback, "function");
      handle.callback();
    },
    getFrameCount: () => frames.length,
    getRenderAttempts: () => renderAttempts,
    getTimerCount: () => timers.filter((handle) => handle.cleared !== true).length,
    runtime,
    setRenderFailure(enabled: boolean): void {
      failRender = enabled;
    },
    setRenderHook(callback: (() => void) | null): void {
      renderHook = callback;
    },
    state,
  };
}

test("game-room workspace keeps the required Tavla package files", () => {
  requiredFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room manifest validates with the Tavla-first room contract", () => {
  const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.id, "game-room");
  assert.equal(validation.manifest?.defaultFeatureId, "backgammon");
  assert.deepEqual(
    validation.manifest?.features.map((feature) => feature.id),
    ["backgammon", "team-tetris", "fate-knots"]
  );
  assert.equal(validation.manifest?.runtime.uiEntry, "ui/index.html");
  assert.equal(validation.manifest?.runtime.hostEntry, "host/index.js");
  assert.equal(validation.manifest?.scene?.characterRosterPreset, "connected-plus-user");
  assert.equal(validation.manifest?.scene?.characters?.length, 3);
  assert.equal(validation.manifest?.scene?.chrome?.pageShellVariant, "immersive-stage");
});

test("game-room Tavla UI keeps the local idle target selection during snapshot sync", () => {
  const { state, runtime } = createBackgammonUiStateHarness();
  state.preferences.target = "us1";
  state.preferences.starter = "ai";
  Object.assign(state.game, {
    active: false,
    result: "idle",
    pendingInvite: null,
    inviteId: null,
    remoteUserId: null,
    selectedTarget: "ai1",
    starter: "user",
  });

  runtime.syncPreferencesFromGame();

  assert.equal(state.preferences.target, "us1");
  assert.equal(state.preferences.starter, "ai");
});

test("game-room Tavla UI syncs the host target once the match state becomes authoritative", () => {
  const { state, runtime } = createBackgammonUiStateHarness();
  state.preferences.target = "ai1";
  state.preferences.starter = "user";
  Object.assign(state.game, {
    active: true,
    result: "pending",
    pendingInvite: null,
    inviteId: "invite-1",
    remoteUserId: "remote-user-1",
    selectedTarget: "us1",
    starter: "ai",
  });

  runtime.syncPreferencesFromGame();

  assert.equal(state.preferences.target, "us1");
  assert.equal(state.preferences.starter, "ai");
});

test("game-room Tavla UI prioritizes command-result messages over stale game status text", () => {
  const { state, runtime } = createBackgammonUiStateHarness();
  Object.assign(state.game, {
    active: true,
    result: "pending",
    status: "Waiting for the remote move.",
  });
  state.lastCommandMessage = "A duplicate remote move was ignored.";

  assert.equal(runtime.getCurrentStatus(), "A duplicate remote move was ignored.");
});

test("game-room Tavla render keeps the board stage host stable across rail rerenders", () => {
  const document = new MinimalFakeDocument();
  const stageHosts: unknown[] = [];
  const createSlot = (slotId: string) => ({
    slotId,
    nickname: slotId.toUpperCase(),
    assigned: true,
    connected: true,
    ready: true,
    dispatchable: true,
  });
  const state = {
    presentation: {
      mode: "classic",
    },
    lastCommandMessage: "",
    preferences: {
      target: "ai2",
      starter: "user",
      inviteMessage: "",
      invitesTab: "incoming",
    },
    context: {
      room: {
        name: "Game Room",
      },
      user: {
        nickname: "User",
        avatar: null,
      },
      slots: {
        ai1: {
          ...createSlot("ai1"),
          connected: false,
          ready: false,
          dispatchable: false,
        },
        ai2: createSlot("ai2"),
        us1: {
          ...createSlot("us1"),
          connected: false,
          dispatchable: false,
        },
      },
    },
    game: {
      pendingInvite: null,
      inviteInbox: [],
      matchHistory: [],
      active: false,
      blockedReason: "",
      awaitingMoveFrom: null,
      user: {
        nickname: "User",
      },
      board: Array.from({ length: 24 }, (_value, index) => ({
        point: index + 1,
        owner: "",
        count: 0,
      })),
      bar: {
        user: 0,
        ai: 0,
      },
      off: {
        user: 0,
        ai: 0,
      },
      dice: [],
      legalMoves: [],
      result: "idle",
      scorePoints: 1,
    },
  };
  const windowObject: Record<string, unknown> = {
    GameRoomUiFactories: {
      createBackgammonStageRuntime: () => ({
        destroy: () => undefined,
        renderBackgammonStage: (host: unknown) => {
          stageHosts.push(host);
        },
      }),
    },
  };
  const context = {
    document,
    window: windowObject,
    globalThis: windowObject,
  };
  vm.createContext(context);
  vm.runInNewContext(
    loadWorkspaceScriptForVm("rooms/game-room/main-functions/backgammon/ui/render-runtime.ts"),
    context
  );

  const registry = windowObject["GameRoomUiFactories"] as Record<string, unknown>;
  const createRenderRuntime = registry["createBackgammonUiRenderRuntime"];
  assert.equal(typeof createRenderRuntime, "function");
  const renderRuntime = createRenderRuntime({
    getState: () => state,
    featureId: "backgammon",
    bootstrapText: (key: string) => key,
    text: (path: string[]) => path.at(-1) ?? "",
    createElement: (tagName: string, className = "", textContent = "") =>
      new MinimalFakeElement(tagName, className, textContent),
    render: () => undefined,
    isRoomApiAvailable: () => true,
    getFeatureLabel: () => "Tavla",
    stateRuntime: {
      onAcceptInvite: () => undefined,
      onRejectInvite: () => undefined,
      formatInviteMeta: () => "",
      getSelectedTarget: () => state.preferences.target,
      getDisplayOpponent: () => state.context.slots.ai2,
      getSlotOrder: () => [state.context.slots.ai1, state.context.slots.ai2, state.context.slots.us1],
      getSlotStatusLabel: () => "Ready",
      getStarterLabelForCurrentTarget: (starter: string) => starter,
      onStart: () => undefined,
      onReset: () => undefined,
      getCurrentStatus: () => "",
      getTurnLabel: () => "",
      getResultLabel: () => "",
      getDiceLabel: () => "",
      getBearOffLabel: () => "",
      getBarLabel: () => "",
      onLegalMove: () => undefined,
      onCancelOutgoingInvite: () => undefined,
      getMatchHistory: () => [],
      getMatchHistoryResultLabel: () => "",
      getMatchHistoryResultTone: () => "neutral",
      formatMatchHistoryDate: () => "",
    },
  }) as { renderBackgammon(root: MinimalFakeElement): void };

  renderRuntime.renderBackgammon(document.app);
  const rootReplaceCountAfterInitialRender = document.app.replaceChildrenCount;
  const initialSlotCards = document.app.querySelectorAll(".backgammon-slot-card");
  assert.equal(initialSlotCards[0]?.dataset["selected"], "false");
  assert.equal(initialSlotCards[1]?.dataset["selected"], "true");

  initialSlotCards[0]?.click();

  assert.equal(state.preferences.target, "ai1");
  assert.equal(document.app.querySelector(".backgammon-button--primary")?.disabled, false);
  assert.equal(stageHosts.length, 1);
  assert.equal(document.app.replaceChildrenCount, rootReplaceCountAfterInitialRender);

  const updatedSlotCards = document.app.querySelectorAll(".backgammon-slot-card");
  assert.equal(updatedSlotCards[0]?.dataset["selected"], "true");
  assert.equal(updatedSlotCards[1]?.dataset["selected"], "false");

  const starterButtons = document.app.querySelectorAll(".backgammon-choice-button");
  starterButtons[1]?.click();
  assert.equal(state.preferences.starter, "ai");
  assert.equal(stageHosts.length, 1);
  assert.equal(document.app.replaceChildrenCount, rootReplaceCountAfterInitialRender);

  const inviteTabs = document.app.querySelectorAll(".backgammon-tab");
  inviteTabs[1]?.click();
  assert.equal(state.preferences.invitesTab, "outgoing");
  assert.equal(stageHosts.length, 1);
  assert.equal(document.app.replaceChildrenCount, rootReplaceCountAfterInitialRender);

  renderRuntime.renderBackgammon(document.app);

  assert.equal(stageHosts.length, 2);
  assert.equal(stageHosts[0], stageHosts[1]);
});

test("game-room Tavla UI coalesces Tavla state and command-result renders per frame", () => {
  const harness = createGameRoomUiCoalescingHarness("raf");

  harness.runtime.handleHostMessage({
    type: "backgammon-state",
    payload: {
      state: {
        active: true,
      },
    },
  });
  harness.runtime.handleHostMessage({
    type: "command-result",
    command: "GameRoomBackgammonStart",
    result: {
      success: true,
      message: "Match started.",
    },
  });

  assert.equal(harness.getFrameCount(), 1);
  assert.equal(harness.getRenderAttempts(), 0);
  assert.equal(harness.state.lastCommandMessage, "Match started.");

  harness.flushFrame();

  assert.equal(harness.getFrameCount(), 0);
  assert.equal(harness.getRenderAttempts(), 1);
  assert.equal(harness.state.lastCommandMessage, "Match started.");

  harness.runtime.handleHostMessage({
    type: "backgammon-state",
    payload: {
      state: {
        active: false,
      },
    },
  });
  assert.equal(harness.getFrameCount(), 1);
  harness.flushFrame();
  assert.equal(harness.getRenderAttempts(), 2);
  assert.equal(harness.state.lastCommandMessage, "");
});

test("game-room Tavla UI keeps current final-state semantics when Tavla command-result is stale", () => {
  const harness = createGameRoomUiCoalescingHarness("raf");

  harness.runtime.handleHostMessage({
    type: "command-result",
    command: "GameRoomBackgammonUserMove",
    result: {
      success: false,
      message: "Stale move.",
    },
  });
  harness.runtime.handleHostMessage({
    type: "backgammon-state",
    payload: {
      state: {
        active: true,
      },
    },
  });

  assert.equal(harness.getFrameCount(), 1);
  harness.flushFrame();
  assert.equal(harness.getRenderAttempts(), 1);
  assert.equal(harness.state.lastCommandMessage, "");
});

test("game-room Tavla UI schedules a follow-up frame for state received during render", () => {
  const harness = createGameRoomUiCoalescingHarness("raf");
  let injectedStateDuringRender = false;

  harness.setRenderHook(() => {
    if (injectedStateDuringRender) {
      return;
    }
    injectedStateDuringRender = true;
    harness.runtime.handleHostMessage({
      type: "backgammon-state",
      payload: {
        state: {
          active: true,
          dice: [4, 4, 4, 4],
        },
      },
    });
  });

  harness.runtime.handleHostMessage({
    type: "command-result",
    command: "GameRoomBackgammonStart",
    result: {
      success: true,
      message: "Match started.",
    },
  });

  assert.equal(harness.getFrameCount(), 1);
  harness.flushFrame();

  assert.equal(harness.getRenderAttempts(), 1);
  assert.equal(harness.getFrameCount(), 1);
  assert.deepEqual(harness.state.game["dice"], [4, 4, 4, 4]);
  assert.equal(harness.state.lastCommandMessage, "");

  harness.setRenderHook(null);
  harness.flushFrame();
  assert.equal(harness.getRenderAttempts(), 2);
  assert.equal(harness.getFrameCount(), 0);
});

test("game-room Tavla render scheduler falls back when requestAnimationFrame stalls", () => {
  const harness = createGameRoomUiCoalescingHarness("raf-timeout");

  harness.runtime.handleHostMessage({
    type: "backgammon-state",
    payload: {
      state: {
        active: true,
        dice: [6, 4],
      },
    },
  });

  assert.equal(harness.getFrameCount(), 1);
  assert.equal(harness.getTimerCount(), 1);
  assert.equal(harness.getRenderAttempts(), 0);

  harness.flushTimer();

  assert.equal(harness.getRenderAttempts(), 1);
  assert.equal(harness.getTimerCount(), 0);
  assert.equal(harness.getFrameCount(), 1);

  harness.flushFrame();

  assert.equal(harness.getRenderAttempts(), 1);
  assert.equal(harness.getFrameCount(), 0);
});

test("game-room command-result render scheduling stays scoped to Tavla commands", () => {
  const harness = createGameRoomUiCoalescingHarness("raf");

  harness.runtime.handleHostMessage({
    type: "command-result",
    command: "GameRoomTeamTetrisStart",
    result: {
      success: false,
      message: "Team Tetris setup is incomplete.",
    },
  });

  assert.equal(harness.getFrameCount(), 0);
  assert.equal(harness.getRenderAttempts(), 1);
  assert.equal(harness.state.lastCommandMessage, "Team Tetris setup is incomplete.");
});

test("game-room Tavla render scheduler supports timer fallback and clears failures", () => {
  const harness = createGameRoomUiCoalescingHarness("timeout");

  harness.runtime.handleHostMessage({
    type: "backgammon-state",
    payload: {
      state: {
        active: true,
      },
    },
  });
  harness.runtime.handleHostMessage({
    type: "command-result",
    command: "GameRoomBackgammonReset",
    result: {
      success: true,
      message: "Reset.",
    },
  });

  assert.equal(harness.getTimerCount(), 1);
  assert.equal(harness.getRenderAttempts(), 0);
  harness.flushTimer();
  assert.equal(harness.getRenderAttempts(), 1);

  harness.setRenderFailure(true);
  harness.runtime.handleHostMessage({
    type: "backgammon-state",
    payload: {
      state: {
        active: false,
      },
    },
  });
  assert.equal(harness.getTimerCount(), 1);
  assert.throws(() => harness.flushTimer(), /render failed/);
  assert.equal(harness.getRenderAttempts(), 2);

  harness.setRenderFailure(false);
  harness.runtime.handleHostMessage({
    type: "backgammon-state",
    payload: {
      state: {
        active: true,
      },
    },
  });
  assert.equal(harness.getTimerCount(), 1);
  harness.flushTimer();
  assert.equal(harness.getRenderAttempts(), 3);
});

test("game-room Tavla UI forwards remote identity with invite actions", () => {
  const uiModuleSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/ui/module.ts"
  );
  const uiStateRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/ui/state-runtime.ts"
  );
  const backgammonStageRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/ui/backgammon-stage-runtime.ts"
  );
  const uiRenderRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/ui/render-runtime.ts"
  );
  const indexHtmlSource = readFileSync("rooms/game-room/ui/index.html", "utf8");
  const runtimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/runtime.ts"
  );
  const stylesSource = readFileSync("rooms/game-room/main-functions/backgammon/styles.css", "utf8");
  const stateSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/state.ts"
  );
  const stateCoreSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/state-core.ts"
  );
  const stateInvitesSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/state-invites.ts"
  );
  const stateRoomRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/state-room-runtime.ts"
  );
  const runtimeMatchSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/runtime-match.ts"
  );
  const runtimeSyncSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/runtime-sync.ts"
  );
  const us1RuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/us1-runtime.ts"
  );
  const us1InviteRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/us1-invite-runtime.ts"
  );
  const us1SyncRuntimeSource = loadWorkspaceScriptForVm(
    "rooms/game-room/main-functions/backgammon/host/us1-sync-runtime.ts"
  );

  assert.match(indexHtmlSource, /<script src="\.\/context-runtime\.js"><\/script>/);
  assert.match(indexHtmlSource, /shared\/vendor\/konva\.min\.js/);
  assert.match(indexHtmlSource, /main-functions\/backgammon\/ui\/backgammon-stage-runtime\.js/);
  assert.ok(
    indexHtmlSource.indexOf("shared/vendor/konva.min.js") <
      indexHtmlSource.indexOf("main-functions/backgammon/ui/backgammon-stage-runtime.js")
  );
  assert.ok(
    indexHtmlSource.indexOf("main-functions/backgammon/ui/backgammon-stage-runtime.js") <
      indexHtmlSource.indexOf("main-functions/backgammon/ui/render-runtime.js")
  );
  assert.match(indexHtmlSource, /<script src="\.\/game-room-ui-bootstrap\.js"><\/script>/);
  assert.match(
    indexHtmlSource,
    /<script src="\.\/game-room-ui-state-message-runtime\.js"><\/script>/
  );
  assert.match(indexHtmlSource, /main-functions\/backgammon\/ui\/state-runtime\.js/);
  assert.match(indexHtmlSource, /main-functions\/backgammon\/ui\/render-runtime\.js/);
  assert.match(stylesSource, /@import "\.\/styles\/layout\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/presentation\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/board\.css"/);
  assert.match(stylesSource, /@import "\.\/styles\/scene-view\.css"/);
  assert.match(uiModuleSource, /createBackgammonUiStateRuntime/);
  assert.match(uiModuleSource, /createBackgammonUiRenderRuntime/);
  assert.match(backgammonStageRuntimeSource, /createBackgammonStageRuntime/);
  assert.match(backgammonStageRuntimeSource, /renderBackgammonStage/);
  assert.match(backgammonStageRuntimeSource, /function flushStageDraw/);
  assert.match(backgammonStageRuntimeSource, /stageInstance\.draw\(\)/);
  assert.match(backgammonStageRuntimeSource, /flushStageDraw\(stage\)/);
  assert.match(
    backgammonStageRuntimeSource,
    /group\.add\(die\);\s*if \(animate\) \{\s*try \{\s*die\.to/
  );
  assert.match(backgammonStageRuntimeSource, /draggable/);
  assert.match(runtimeSource, /from "\.\/runtime-match\.js"/);
  assert.match(runtimeSource, /from "\.\/runtime-sync\.js"/);
  assert.match(stateSource, /from "\.\/state-core\.js"/);
  assert.match(stateSource, /from "\.\/state-invites\.js"/);
  assert.match(stateSource, /from "\.\/state-room-runtime\.js"/);
  assert.match(us1RuntimeSource, /from "\.\/us1-invite-runtime\.js"/);
  assert.match(us1RuntimeSource, /from "\.\/us1-sync-runtime\.js"/);
  assert.match(runtimeMatchSource, /export async function sendAiTurnUpdate/);
  assert.match(runtimeSyncSource, /export function syncFromContext/);
  assert.match(stateCoreSource, /export function createInitialState/);
  assert.match(stateInvitesSource, /export function normalizeInviteEntry/);
  assert.match(stateRoomRuntimeSource, /export function pushRoomState/);
  assert.match(us1InviteRuntimeSource, /export function createGameRoomBackgammonUs1InviteRuntime/);
  assert.match(us1SyncRuntimeSource, /export function createGameRoomBackgammonUs1SyncRuntime/);
  assert.match(
    uiStateRuntimeSource,
    /sendRoomCommand\("GameRoomBackgammonAcceptInvite",\s*\{\s*(inviteId:\s*inviteId|inviteId),\s*(remoteUserId:\s*remoteUserId|remoteUserId)\s*,?\s*\}\s*\)/
  );
  assert.match(
    uiStateRuntimeSource,
    /sendRoomCommand\("GameRoomBackgammonRejectInvite",\s*\{\s*(inviteId:\s*inviteId|inviteId),\s*(remoteUserId:\s*remoteUserId|remoteUserId)\s*,?\s*\}\s*\)/
  );
  assert.match(uiRenderRuntimeSource, /function renderBootstrap\(root\)/);
  assert.match(runtimeSource, /GameRoomBackgammonStart/);
});
