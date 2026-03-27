import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

class FakeElement {
  tagName: string;
  ownerDocument: FakeDocument;
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  innerHTML = "";
  type = "";
  id = "";
  disabled = false;
  style: Record<string, string> = {};
  eventListeners = new Map<string, Array<(event?: Record<string, unknown>) => void>>();

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toLowerCase();
    this.ownerDocument = ownerDocument;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children = [];
    this.append(...children);
  }

  addEventListener(type: string, handler: (event?: Record<string, unknown>) => void): void {
    const handlers = this.eventListeners.get(type) ?? [];
    handlers.push(handler);
    this.eventListeners.set(type, handlers);
  }
}

class FakeDocument {
  documentElement = { lang: "und", dataset: {} as Record<string, string> };
  title = "";
  readonly body: FakeElement;

  constructor() {
    this.body = new FakeElement("body", this);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  getElementById(id: string): FakeElement | null {
    return findFirst(this.body, (element) => element.id === id);
  }
}

function readElementText(element: FakeElement): string {
  return [element.textContent, ...element.children.map(readElementText)]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function findFirst(root: FakeElement, predicate: (element: FakeElement) => boolean): FakeElement | null {
  if (predicate(root)) {
    return root;
  }

  for (const child of root.children) {
    const match = findFirst(child, predicate);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

function findByRole(root: FakeElement, role: string): FakeElement | null {
  return findFirst(root, (element) => element.dataset.fkRole === role);
}

function findBySeat(root: FakeElement, seatId: string): FakeElement | null {
  return findFirst(root, (element) => element.dataset.seatId === seatId);
}

function findByPhase(root: FakeElement, phase: string): FakeElement | null {
  return findFirst(root, (element) => element.dataset.fkPhase === phase);
}

function createInstalledUiRuntime() {
  const document = new FakeDocument();
  const app = document.createElement("div");
  app.id = "app";
  document.body.append(app);

  let hostMessageHandler: ((message: Record<string, unknown>) => void) | null = null;

  const windowObject: Record<string, unknown> = {
    scrollX: 0,
    scrollY: 0,
    scrollTo(x: number, y: number) {
      windowObject.scrollX = Number.isFinite(x) ? x : 0;
      windowObject.scrollY = Number.isFinite(y) ? y : 0;
    },
    roomAPI: {
      sendCommand() {
        return true;
      },
      onHostMessage(handler: (message: Record<string, unknown>) => void) {
        hostMessageHandler = handler;
      },
      ready() {
        return undefined;
      },
    },
  };

  const context = {
    window: windowObject,
    document,
    navigator: { language: "en-US" },
    console,
  };

  [
    "data/rooms/game-room/ui/context-runtime.js",
    "data/rooms/game-room/main-functions/xox/ui/module.js",
    "data/rooms/game-room/main-functions/team-tetris/ui/module.js",
    "data/rooms/game-room/main-functions/fate-knots/ui/module.js",
    "data/rooms/game-room/ui/index.js",
  ].forEach((filePath) => {
    vm.runInNewContext(readFileSync(filePath, "utf8"), context);
  });

  return {
    app,
    document,
    emitHostMessage(message: Record<string, unknown>) {
      hostMessageHandler?.(message);
    },
  };
}

function createAssetLink(assetId: string, uiSrc: string) {
  return {
    assetId,
    asset: {
      id: assetId,
      uiSrc,
      src: uiSrc,
    },
    uiSrc,
    src: uiSrc,
  };
}

function createCatalogEntry(options: {
  id: string;
  label: string;
  assetId: string;
  uiSrc: string;
  summary?: string;
  perk?: string;
  stats?: Record<string, number> | null;
  startingDeck?: string[];
}) {
  return {
    id: options.id,
    label: options.label,
    summary: options.summary ?? "",
    description: options.summary ?? "",
    perk: options.perk ?? "",
    stats: options.stats ?? null,
    startingDeck: options.startingDeck ?? [],
    assetId: options.assetId,
    asset: createAssetLink(options.assetId, options.uiSrc),
    uiSrc: options.uiSrc,
    src: options.uiSrc,
  };
}

const avatarEntry = createCatalogEntry({
  id: "ranger_avatar",
  label: "Scout Portrait",
  assetId: "ranger_avatar",
  uiSrc: "ranger-avatar.webp",
  summary: "Fast local hero portrait.",
});
const classEntry = createCatalogEntry({
  id: "ranger",
  label: "Wayfinder",
  assetId: "ranger",
  uiSrc: "ranger-class.webp",
  summary: "Moves first and keeps the deck light.",
  stats: { maxHp: 18, attack: 4, defense: 2, speed: 5, energy: 4 },
  startingDeck: ["quick-strike", "position", "dodge", "risk-strike"],
});
const backgroundEntry = createCatalogEntry({
  id: "scholar",
  label: "Scholar",
  assetId: "scholar",
  uiSrc: "scholar-background.webp",
  summary: "Keeps extra reserves ready.",
  perk: "Start with one extra energy.",
});

function createSelection(overrides: Record<string, unknown> = {}) {
  return {
    avatarId: "ranger_avatar",
    classId: "ranger",
    backgroundId: "scholar",
    locked: false,
    autoAssigned: false,
    avatar: avatarEntry,
    class: classEntry,
    background: backgroundEntry,
    ...overrides,
  };
}

function createParticipant(options: { seatId: string; nickname: string; ready?: boolean; selection?: Record<string, unknown> }) {
  return {
    seatId: options.seatId,
    provider: options.seatId,
    type: options.seatId === "user" ? "local-user" : "ai",
    nickname: options.nickname,
    ready: options.ready ?? true,
    connected: true,
    active: true,
    selection: options.selection ?? createSelection(),
    decisionChoiceId: null,
    combat: null,
  };
}

function buildHostContext(translations: Record<string, unknown>) {
  return {
    type: "host-context",
    locale: "en",
    translations,
    room: {
      id: "game-room",
      name: "Game Room",
    },
    features: [
      { id: "xox", name: "XOX" },
      { id: "team-tetris", name: "Team Tetris" },
      { id: "fate-knots", name: "Fate Knots" },
    ],
    activeFeature: {
      id: "fate-knots",
      name: "Fate Knots",
    },
    user: {
      nickname: "Raistlin",
    },
    slots: {
      ai1: { slotId: "ai1", nickname: "Atlas", assigned: true, connected: true, ready: true, state: "connected" },
      ai2: { slotId: "ai2", nickname: "Nova", assigned: true, connected: false, ready: false, state: "assigned" },
      us1: {
        slotId: "us1",
        nickname: "Remote Ghost",
        assigned: true,
        connected: false,
        ready: false,
        state: "assigned",
        remoteUserId: "remote@example.com",
      },
    },
  };
}

function createBaseState() {
  return {
    active: false,
    phase: "idle",
    sessionId: "fk-installed-session-1",
    participants: [
      createParticipant({ seatId: "user", nickname: "Raistlin", selection: createSelection({ locked: false }) }),
      createParticipant({ seatId: "ai1", nickname: "Atlas", selection: createSelection({ locked: true, autoAssigned: true }) }),
      createParticipant({ seatId: "ai2", nickname: "Nova", selection: createSelection({ locked: true, autoAssigned: true }) }),
    ],
    excludedSeats: [{ seatId: "us1", reason: "v1-remote-deferred" }],
    scenarioLog: [],
    decision: null,
    combat: null,
    result: {
      outcome: "pending",
      title: "",
      summary: "",
      continueHint: "",
    },
    waiting: null,
    compatibility: { mode: "fresh" },
    currentStep: null,
    catalogs: {
      avatars: [avatarEntry],
      classes: [classEntry],
      backgrounds: [backgroundEntry],
    },
    map: {
      mapAsset: createAssetLink("route_map", "route-map.webp"),
      currentLocationId: "village-gate",
      nodes: [
        { id: "village-gate", label: "Village Gate", marker: { xPct: 28, yPct: 36 } },
        { id: "well-square", label: "Well Square", marker: { xPct: 56, yPct: 53 } },
      ],
    },
    assetCoverage: {
      avatars: 1,
      classes: 1,
      backgrounds: 1,
      creatures: 1,
      items: 1,
      locations: 1,
    },
    contentSummary: {
      assetErrors: 0,
      sourceErrors: 0,
    },
    contentErrors: [],
    user: {
      nickname: "Raistlin",
    },
    uiAssets: {
      featureView: createAssetLink("fate-knots-view", "fate-knots-view.webp"),
    },
  };
}

function emitFateKnotsState(runtime: ReturnType<typeof createInstalledUiRuntime>, state: Record<string, unknown>) {
  runtime.emitHostMessage({
    type: "fate-knots-state",
    payload: { state },
  });
}

test("game-room installed UI renders Fate Knots overview landmarks with portable assets", () => {
  const runtime = createInstalledUiRuntime();
  const translations = JSON.parse(readFileSync("data/rooms/game-room/i18n/en.json", "utf8")) as Record<string, unknown>;
  const state = createBaseState();

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  assert.ok(findByPhase(runtime.document.body, "overview"));
  assert.ok(findByRole(runtime.document.body, "surface-shell"));
  assert.ok(findByRole(runtime.document.body, "map-shell"));
  assert.ok(findByRole(runtime.document.body, "right-rail"));
  assert.ok(findByRole(runtime.document.body, "start-zone"));
  assert.ok(findBySeat(runtime.document.body, "us1"));
  assert.notEqual(findBySeat(runtime.document.body, "us1")?.tagName, "button");
  assert.match(readElementText(runtime.document.body), /Fate Knots/);

  [
    "data/rooms/game-room/ui/index.js",
    "data/rooms/game-room/main-functions/fate-knots/ui/module.js",
    "data/rooms/game-room/main-functions/fate-knots/styles.css",
    "data/rooms/game-room/main-functions/fate-knots/assets/ui/frames/main_scene_frame.webp",
    "data/rooms/game-room/main-functions/fate-knots/assets/ui/buttons/primary_button.webp",
    "data/rooms/game-room/main-functions/fate-knots/assets/ui/cards/avatar_card_template.webp",
  ].forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("game-room installed UI keeps creation landmarks and renderer-only dummy seats", () => {
  const runtime = createInstalledUiRuntime();
  const translations = JSON.parse(readFileSync("data/rooms/game-room/i18n/en.json", "utf8")) as Record<string, unknown>;
  const state = createBaseState();
  state.phase = "character-creation";
  state.active = true;

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  assert.ok(findByPhase(runtime.document.body, "character-creation"));
  assert.ok(findByRole(runtime.document.body, "selection-table"));
  assert.ok(findByRole(runtime.document.body, "summary-rail"));
  assert.ok(findByRole(runtime.document.body, "selection-actions"));
  assert.ok(findBySeat(runtime.document.body, "us1"));
  assert.match(readElementText(runtime.document.body), /Build Summary/);
});
