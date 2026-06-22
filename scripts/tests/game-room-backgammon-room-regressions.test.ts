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
    (this.listeners["click"] ?? []).forEach((handler) => { handler(event); });
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

type FakeStagePoint = { x: number; y: number };

class FakeStageHost {
  children: unknown[] = [];
  clientHeight = 600;
  clientWidth = 980;

  getBoundingClientRect(): { width: number; height: number } {
    return { width: this.clientWidth, height: this.clientHeight };
  }

  replaceChildren(...children: unknown[]): void {
    this.children = children;
  }
}

class FakeKonvaNode {
  children: FakeKonvaNode[] = [];
  destroyed = false;
  destroyChildrenCount = 0;
  drawCount = 0;
  batchDrawCount = 0;
  tweenCount = 0;
  readonly handlers: Record<string, Array<(event: unknown) => void>> = {};
  private parent: FakeKonvaNode | null = null;
  private positionValue: FakeStagePoint;
  private scaleValue: FakeStagePoint;
  private widthValue: number;
  private heightValue: number;

  constructor(config: Record<string, unknown> = {}) {
    this.positionValue = {
      x: typeof config["x"] === "number" ? config["x"] : 0,
      y: typeof config["y"] === "number" ? config["y"] : 0,
    };
    this.scaleValue = {
      x: typeof config["scaleX"] === "number" ? config["scaleX"] : 1,
      y: typeof config["scaleY"] === "number" ? config["scaleY"] : 1,
    };
    this.widthValue = typeof config["width"] === "number" ? config["width"] : 0;
    this.heightValue = typeof config["height"] === "number" ? config["height"] : 0;
  }

  add(...nodes: FakeKonvaNode[]): void {
    nodes.forEach((node) => {
      node.parent = this;
      this.children.push(node);
    });
  }

  batchDraw(): void {
    this.batchDrawCount += 1;
  }

  destroy(): void {
    this.destroyed = true;
  }

  destroyChildren(): void {
    this.destroyChildrenCount += 1;
    this.children = [];
  }

  draw(): void {
    this.drawCount += 1;
  }

  height(): number;
  height(value: number): void;
  height(value?: number): number | void {
    if (value === undefined) {
      return this.heightValue;
    }
    this.heightValue = value;
    return;
  }

  moveToTop(): void {
    if (this.parent === null) {
      return;
    }
    const siblings = this.parent.children;
    const index = siblings.indexOf(this);
    if (index < 0) {
      return;
    }
    siblings.splice(index, 1);
    siblings.push(this);
  }

  on(eventName: string, handler: (event: unknown) => void): void {
    const handlers = this.handlers[eventName] ?? [];
    handlers.push(handler);
    this.handlers[eventName] = handlers;
  }

  position(): FakeStagePoint;
  position(value: FakeStagePoint): void;
  position(value?: FakeStagePoint): FakeStagePoint | void {
    if (value === undefined) {
      return this.positionValue;
    }
    this.positionValue = value;
    return;
  }

  scale(): FakeStagePoint;
  scale(value: FakeStagePoint): void;
  scale(value?: FakeStagePoint): FakeStagePoint | void {
    if (value === undefined) {
      return this.scaleValue;
    }
    this.scaleValue = value;
    return;
  }

  to(): void {
    this.tweenCount += 1;
  }

  trigger(eventName: string): void {
    (this.handlers[eventName] ?? []).forEach((handler) => { handler({ target: this }); });
  }

  width(): number;
  width(value: number): void;
  width(value?: number): number | void {
    if (value === undefined) {
      return this.widthValue;
    }
    this.widthValue = value;
    return;
  }
}

class FakeKonvaStage extends FakeKonvaNode {
  static instances: FakeKonvaStage[] = [];

  constructor(config: { container: FakeStageHost; height: number; width: number }) {
    super(config);
    FakeKonvaStage.instances.push(this);
  }
}

class FakeKonvaLayer extends FakeKonvaNode {
  static instances: FakeKonvaLayer[] = [];

  constructor(config: Record<string, unknown> = {}) {
    super(config);
    FakeKonvaLayer.instances.push(this);
  }
}

class FakeKonvaGroup extends FakeKonvaNode {}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  disconnect(): void {
    return undefined;
  }

  observe(): void {
    return undefined;
  }

  trigger(): void {
    this.callback();
  }
}

function resetFakeKonva(): void {
  FakeKonvaStage.instances = [];
  FakeKonvaLayer.instances = [];
  FakeResizeObserver.instances = [];
}

function findClickableKonvaNodes(node: FakeKonvaNode): FakeKonvaNode[] {
  const matches = node.handlers["click tap"] && node.handlers["click tap"].length > 0 ? [node] : [];
  node.children.forEach((child) => {
    matches.push(...findClickableKonvaNodes(child));
  });
  return matches;
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
  const runtime = (runtimeFactory as (deps: Record<string, unknown>) => BackgammonUiStateHarness["runtime"])({
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
            candidate != null && typeof candidate === "object" && Array.isArray(candidate) === false
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
  const createRuntime = runtimeRegistry?.["createGameRoomUiRuntime"] as (() => GameRoomUiCoalescingHarness["runtime"]) | undefined;
  assert.equal(typeof createRuntime, "function");
  const runtime = (createRuntime as () => GameRoomUiCoalescingHarness["runtime"])();

  return {
    flushFrame(): void {
      const callback = frames.shift();
      assert.equal(typeof callback, "function");
      (callback as (...args: unknown[]) => unknown)(16);
    },
    flushTimer(): void {
      let handle = timers.shift();
      while (handle?.cleared === true) {
        handle = timers.shift();
      }
      assert.equal(typeof handle?.callback, "function");
      (handle as NonNullable<typeof handle>).callback();
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
