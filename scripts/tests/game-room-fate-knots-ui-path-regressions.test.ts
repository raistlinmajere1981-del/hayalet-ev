import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  value = "";
  placeholder = "";
  rows = 0;
  disabled = false;
  scrollTop = 0;
  scrollLeft = 0;
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readElementText(element: FakeElement): string {
  return [element.textContent, ...element.children.map(readElementText)]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function findFirst(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement | null {
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

function findButtonByText(root: FakeElement, text: string): FakeElement | null {
  return findFirst(root, (element) => element.tagName === "button" && readElementText(element) === text);
}

function findButtonContainingText(root: FakeElement, text: string): FakeElement | null {
  return findFirst(
    root,
    (element) => element.tagName === "button" && readElementText(element).includes(text)
  );
}

function trigger(element: FakeElement | null, type: string): void {
  assert.ok(element, `Missing element for ${type}`);
  const handlers = element.eventListeners.get(type) ?? [];
  handlers.forEach((handler) => {
    handler({
      currentTarget: element,
      preventDefault() {
        return undefined;
      },
    });
  });
}

function createUiRuntime() {
  const document = new FakeDocument();
  const app = document.createElement("div");
  app.id = "app";
  document.body.append(app);

  const sentCommands: Array<{ command: string; payload: Record<string, unknown> }> = [];
  let hostMessageHandler: ((message: Record<string, unknown>) => void) | null = null;

  const windowObject: Record<string, unknown> = {
    scrollX: 0,
    scrollY: 0,
    scrollTo(x: number, y: number) {
      windowObject.scrollX = Number.isFinite(x) ? x : 0;
      windowObject.scrollY = Number.isFinite(y) ? y : 0;
    },
    roomAPI: {
      sendCommand(command: string, payload: Record<string, unknown>) {
        sentCommands.push({ command, payload });
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
    "rooms/game-room/ui/context-runtime.js",
    "rooms/game-room/main-functions/xox/ui/module.js",
    "rooms/game-room/main-functions/team-tetris/ui/module.js",
    "rooms/game-room/main-functions/fate-knots/ui/module.js",
    "rooms/game-room/ui/index.js",
  ].forEach((filePath) => {
    vm.runInNewContext(readFileSync(filePath, "utf8"), context);
  });

  return {
    app,
    document,
    windowObject,
    sentCommands,
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
    avatar: cloneJson(avatarEntry),
    class: cloneJson(classEntry),
    background: cloneJson(backgroundEntry),
    ...overrides,
  };
}

function createParticipant(options: {
  seatId: string;
  nickname: string;
  type?: string;
  ready?: boolean;
  selection?: Record<string, unknown>;
  combat?: Record<string, unknown> | null;
}) {
  return {
    seatId: options.seatId,
    provider: options.seatId,
    type: options.type ?? (options.seatId === "user" ? "local-user" : "ai"),
    nickname: options.nickname,
    ready: options.ready ?? true,
    connected: true,
    active: true,
    selection: options.selection ?? createSelection(),
    decisionChoiceId: null,
    combat: options.combat ?? null,
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
      ai1: {
        slotId: "ai1",
        nickname: "Atlas",
        assigned: true,
        connected: true,
        ready: true,
        state: "connected",
      },
      ai2: {
        slotId: "ai2",
        nickname: "Nova",
        assigned: true,
        connected: false,
        ready: false,
        state: "assigned",
      },
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

function createBaseFateKnotsState() {
  return {
    roomId: "game-room",
    featureId: "fate-knots",
    schemaVersion: 1,
    active: true,
    phase: "idle",
    statusKey: "idle",
    status: "Prepare a run.",
    compatibility: {
      mode: "fresh",
      reason: "",
    },
    sessionId: "fk-session-1",
    participantMode: "user-plus-ready-ai",
    rosterLocked: false,
    participants: [
      createParticipant({
        seatId: "user",
        nickname: "Raistlin",
        ready: false,
        selection: createSelection({ locked: false }),
      }),
      createParticipant({
        seatId: "ai1",
        nickname: "Atlas",
        ready: true,
        selection: createSelection({ locked: true, autoAssigned: true }),
      }),
    ],
    excludedSeats: [],
    waiting: {
      mode: "idle",
      reason: "",
      pendingSeatIds: [],
      deadlineAt: null,
    },
    map: {
      mapAsset: createAssetLink("map_scenario_01", "route-map.webp"),
      nodes: [],
      currentLocationId: "village-gate",
    },
    currentStep: null,
    decision: null,
    combat: null,
    result: {
      outcome: "idle",
      title: "",
      summary: "",
      continueHint: "",
    },
    dmNarration: null,
    npcBanter: null,
    profile: {
      avatarId: "ranger_avatar",
      classId: "ranger",
      backgroundId: "scholar",
      updatedAt: Date.now(),
    },
    history: [
      {
        sessionId: "previous-run",
        outcome: "victory",
        title: "Well Secured",
        summary: "The first knot held and the village steadied.",
        locationId: "village-gate",
        timestamp: Date.now() - 1000,
        roster: [
          { seatId: "user", nickname: "Raistlin", type: "local-user" },
          { seatId: "ai1", nickname: "Atlas", type: "ai" },
        ],
      },
    ],
    saveSlot: {
      hasResumeData: false,
      lastCompletedSessionId: "previous-run",
      lastOutcome: "victory",
      updatedAt: Date.now(),
    },
    scenarioLog: [],
    catalogs: {
      avatars: [cloneJson(avatarEntry)],
      classes: [cloneJson(classEntry)],
      backgrounds: [cloneJson(backgroundEntry)],
    },
    assetCoverage: {
      avatars: 1,
      classes: 1,
      backgrounds: 1,
      npcs: 1,
      items: 1,
      creatures: 1,
      locations: 1,
      maps: 1,
      scenes: 1,
    },
    contentErrors: [],
    contentSummary: {
      assetErrors: 0,
      sourceErrors: 0,
    },
    user: {
      nickname: "Raistlin",
    },
    transport: {
      localSessionId: "fk-session-1",
      remoteUserId: "remote@example.com",
    },
    uiAssets: {
      featureView: createAssetLink("fate-knots-view", "fate-knots-view.webp"),
    },
  };
}

function emitFateKnotsState(runtime: ReturnType<typeof createUiRuntime>, state: Record<string, unknown>) {
  runtime.emitHostMessage({
    type: "fate-knots-state",
    payload: {
      state,
    },
  });
}

test("Fate Knots UI renders the overview surface and dispatches start and reset commands", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const state = createBaseFateKnotsState();
  state.active = false;
  state.phase = "idle";

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  assert.match(readElementText(runtime.document.body), /Fate Knots/);
  assert.ok(findByPhase(runtime.document.body, "overview"));
  assert.ok(findByRole(runtime.document.body, "surface-shell"));
  assert.ok(findByRole(runtime.document.body, "ritual-header"));
  assert.ok(findByRole(runtime.document.body, "map-shell"));
  assert.ok(findByRole(runtime.document.body, "right-rail"));
  assert.ok(findByRole(runtime.document.body, "start-zone"));
  assert.ok(findByRole(runtime.document.body, "history-rail"));
  assert.ok(findBySeat(runtime.document.body, "us1"));
  assert.notEqual(findBySeat(runtime.document.body, "us1")?.tagName, "button");

  trigger(findButtonByText(runtime.document.body, "Start Run"), "click");
  trigger(findButtonByText(runtime.document.body, "Reset Run"), "click");

  assert.equal(runtime.sentCommands[0]?.command, "GameRoomFateKnotsStart");
  assert.deepEqual(cloneJson(runtime.sentCommands[0]?.payload), {});
  assert.equal(runtime.sentCommands[1]?.command, "GameRoomFateKnotsReset");
  assert.deepEqual(cloneJson(runtime.sentCommands[1]?.payload), {});
});

test("Fate Knots UI renders Turkish overview copy while keeping dummy seats non-interactive", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/tr.json", "utf8")) as Record<string, unknown>;
  const state = createBaseFateKnotsState();
  state.active = false;
  state.phase = "idle";

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  assert.match(readElementText(runtime.document.body), /Fate Knots/);
  assert.match(readElementText(runtime.document.body), /Hazir Koltuklar/);
  const dummySeat = findBySeat(runtime.document.body, "us1");
  assert.equal(dummySeat?.tagName, "article");

  trigger(dummySeat, "click");

  assert.equal(runtime.sentCommands.length, 0);
});

test("Fate Knots UI renders remembered build and DM/NPC additive packets without breaking landmarks", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const state = createBaseFateKnotsState();
  state.phase = "scenario";
  state.dmNarration = {
    kind: "dm",
    seatId: "ai1",
    phase: "scenario",
    text: "The knot shivers, but the lanterns still hold.",
    stepId: "gate-arrival",
    encounterId: null,
    turnId: null,
    updatedAt: Date.now(),
  };
  state.npcBanter = {
    kind: "npc",
    seatId: "ai1",
    phase: "scenario",
    text: "Stay close. The square is listening.",
    stepId: "gate-arrival",
    encounterId: null,
    turnId: null,
    updatedAt: Date.now(),
  };
  state.currentStep = {
    id: "gate-arrival",
    title: "Gate Arrival",
    body: "Lantern light wavers over the square.",
    speaker: "Traveling Stranger",
    location: { id: "village-gate", label: "Village Gate" },
    sceneAsset: createAssetLink("scene_village_gate", "scene-village-gate.webp"),
    npcs: [],
    items: [],
    creatures: [],
    choices: [
      {
        id: "follow-lantern",
        label: "Follow the lantern trail",
        summary: "Move before the glow fades.",
        nextStepId: "well-approach",
        encounterId: null,
      },
    ],
  };
  state.decision = {
    stepId: "gate-arrival",
    choiceIds: ["follow-lantern"],
    votes: {},
    participantIds: ["user", "ai1"],
    resolvedChoiceId: null,
    conflict: false,
    pendingSeatIds: ["user"],
    deadlineAt: null,
  };

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  assert.match(readElementText(runtime.document.body), /The knot shivers, but the lanterns still hold/);
  assert.match(readElementText(runtime.document.body), /Stay close\. The square is listening/);
  assert.ok(findByRole(runtime.document.body, "narration-panel"));
});

test("Fate Knots UI sends character selection updates and a ready command from the creation stage", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const state = createBaseFateKnotsState();
  state.phase = "character-creation";
  state.active = true;

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  assert.ok(findByPhase(runtime.document.body, "character-creation"));
  assert.ok(findByRole(runtime.document.body, "ritual-header"));
  assert.ok(findByRole(runtime.document.body, "selection-table"));
  assert.ok(findByRole(runtime.document.body, "dossier-rail"));
  assert.ok(findByRole(runtime.document.body, "lock-zone"));
  assert.ok(findBySeat(runtime.document.body, "us1"));

  trigger(findButtonContainingText(runtime.document.body, "Scout Portrait"), "click");
  trigger(findButtonByText(runtime.document.body, "Lock Build"), "click");

  assert.equal(runtime.sentCommands[0]?.command, "GameRoomFateKnotsCharacterSelect");
  assert.deepEqual(cloneJson(runtime.sentCommands[0]?.payload), { avatarId: "ranger_avatar" });
  assert.equal(runtime.sentCommands[1]?.command, "GameRoomFateKnotsReady");
  assert.deepEqual(cloneJson(runtime.sentCommands[1]?.payload), { sessionId: "fk-session-1" });
});

test("Fate Knots UI sends the unanimous story choice payload from the scenario stage", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const state = createBaseFateKnotsState();
  state.phase = "scenario";
  state.currentStep = {
    id: "gate-arrival",
    title: "Gate Arrival",
    body: "Lantern light wavers over the square.",
    speaker: "Traveling Stranger",
    location: { id: "village-gate", label: "Village Gate" },
    sceneAsset: createAssetLink("scene_village_gate", "scene-village-gate.webp"),
    npcs: [createAssetLink("traveling_stranger", "traveling-stranger.webp")],
    items: [createAssetLink("broken_lantern", "broken-lantern.webp")],
    creatures: [],
    choices: [
      {
        id: "follow-lantern",
        label: "Follow the lantern trail",
        summary: "Move before the glow fades.",
        nextStepId: "well-approach",
        encounterId: null,
      },
      {
        id: "question-stranger",
        label: "Question the stranger",
        summary: "Ask for one more clue.",
        nextStepId: "inn-briefing",
        encounterId: null,
      },
    ],
  };
  state.decision = {
    stepId: "gate-arrival",
    choiceIds: ["follow-lantern", "question-stranger"],
    votes: {},
    participantIds: ["user", "ai1"],
    resolvedChoiceId: null,
    conflict: false,
    pendingSeatIds: ["ai1"],
    deadlineAt: null,
  };
  state.scenarioLog = ["The village keeps listening."];

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  const decisionButton = findButtonContainingText(runtime.document.body, "Follow the lantern trail");
  assert.ok(findByPhase(runtime.document.body, "scenario"));
  assert.ok(findByRole(runtime.document.body, "scene-shell"));
  assert.ok(findByRole(runtime.document.body, "story-feed"));
  assert.ok(findByRole(runtime.document.body, "decision-surface"));
  assert.ok(findBySeat(runtime.document.body, "us1"));
  assert.match(readElementText(decisionButton as FakeElement), /0\/2/);

  trigger(decisionButton, "click");

  assert.equal(runtime.sentCommands.length, 1);
  assert.equal(runtime.sentCommands[0]?.command, "GameRoomFateKnotsChoice");
  assert.deepEqual(cloneJson(runtime.sentCommands[0]?.payload), {
    sessionId: "fk-session-1",
    stepId: "gate-arrival",
    choiceId: "follow-lantern",
  });
});

test("Fate Knots UI sends the current combat action payload from the combat stage", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const state = createBaseFateKnotsState();
  state.phase = "combat";
  state.participants = [
    createParticipant({
      seatId: "user",
      nickname: "Raistlin",
      selection: createSelection({ locked: true }),
      combat: { hp: 18, maxHp: 18, energy: 4, maxEnergy: 4 },
    }),
    createParticipant({
      seatId: "ai1",
      nickname: "Atlas",
      selection: createSelection({ locked: true, autoAssigned: true }),
      combat: { hp: 24, maxHp: 24, energy: 3, maxEnergy: 3 },
    }),
  ];
  state.combat = {
    encounterId: "well-entity",
    outcome: "pending",
    round: 1,
    turn: { seatId: "user", side: "party" },
    turnId: "well-entity:1:0:user",
    party: [
      {
        seatId: "user",
        nickname: "Raistlin",
        hp: 18,
        maxHp: 18,
        energy: 4,
        maxEnergy: 4,
        selection: createSelection({ locked: true }),
      },
      {
        seatId: "ai1",
        nickname: "Atlas",
        hp: 24,
        maxHp: 24,
        energy: 3,
        maxEnergy: 3,
        selection: createSelection({ locked: true, autoAssigned: true }),
      },
    ],
    enemy: {
      label: "Well-Dwelling Entity",
      hp: 30,
      maxHp: 36,
      asset: createAssetLink("well_dwelling_entity", "well-entity.webp"),
    },
    recentLog: ["The pale thing lashes at the stones."],
    availableActions: [
      {
        id: "quick-strike",
        label: "Quick Strike",
        type: "attack",
        cost: 1,
        description: "Lighter hit that keeps initiative moving.",
        available: true,
      },
    ],
  };

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  assert.ok(findByPhase(runtime.document.body, "combat"));
  assert.ok(findByRole(runtime.document.body, "combat-arena"));
  assert.ok(findByRole(runtime.document.body, "combat-status"));
  assert.ok(findByRole(runtime.document.body, "combat-hand"));

  trigger(findButtonContainingText(runtime.document.body, "Quick Strike"), "click");

  assert.equal(runtime.sentCommands.length, 1);
  assert.equal(runtime.sentCommands[0]?.command, "GameRoomFateKnotsCombatAction");
  assert.deepEqual(cloneJson(runtime.sentCommands[0]?.payload), {
    sessionId: "fk-session-1",
    encounterId: "well-entity",
    turnId: "well-entity:1:0:user",
    actionId: "quick-strike",
  });
});

test("Fate Knots UI sends the end-run command from the result stage", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const state = createBaseFateKnotsState();
  state.phase = "result";
  state.active = false;
  state.result = {
    outcome: "victory",
    title: "Well Secured",
    summary: "The first Fate Knots encounter closes cleanly.",
    continueHint: "Additional scenario depth arrives after V1.",
  };
  state.scenarioLog = ["The iron grate finally stops shaking."];

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, state);

  assert.ok(findFirst(runtime.document.body, (element) => readElementText(element) === "Well Secured"));
  assert.ok(findByPhase(runtime.document.body, "result"));
  assert.ok(findByRole(runtime.document.body, "result-shell"));
  trigger(findButtonByText(runtime.document.body, "End Run"), "click");

  assert.equal(runtime.sentCommands.length, 1);
  assert.equal(runtime.sentCommands[0]?.command, "GameRoomFateKnotsEnd");
  assert.deepEqual(cloneJson(runtime.sentCommands[0]?.payload), { sessionId: "fk-session-1" });
});

test("Fate Knots UI preserves room scroll position across host-driven rerenders", () => {
  const runtime = createUiRuntime();
  const translations = JSON.parse(readFileSync("rooms/game-room/i18n/en.json", "utf8")) as Record<
    string,
    unknown
  >;
  const initialState = createBaseFateKnotsState();
  const nextState = createBaseFateKnotsState();
  nextState.phase = "character-creation";

  runtime.emitHostMessage(buildHostContext(translations));
  emitFateKnotsState(runtime, initialState);

  runtime.app.scrollTop = 640;
  runtime.app.scrollLeft = 24;
  runtime.document.body.scrollTop = 420;
  runtime.document.body.scrollLeft = 18;
  runtime.document.documentElement.scrollTop = 420;
  runtime.document.documentElement.scrollLeft = 18;
  runtime.windowObject.scrollTo(18, 420);

  emitFateKnotsState(runtime, nextState);

  assert.equal(runtime.app.scrollTop, 640);
  assert.equal(runtime.app.scrollLeft, 24);
  assert.equal(runtime.document.body.scrollTop, 420);
  assert.equal(runtime.document.body.scrollLeft, 18);
  assert.equal(runtime.document.documentElement.scrollTop, 420);
  assert.equal(runtime.document.documentElement.scrollLeft, 18);
  assert.equal(runtime.windowObject.scrollX, 18);
  assert.equal(runtime.windowObject.scrollY, 420);
});
