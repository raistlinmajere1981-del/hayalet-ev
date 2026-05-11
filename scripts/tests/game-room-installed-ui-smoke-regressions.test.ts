import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

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
  return findFirst(root, (element) =>
    String(element.dataset.fkRole || "")
      .split(/\s+/)
      .filter(Boolean)
      .includes(role)
  );
}

function findBySeat(root: FakeElement, seatId: string): FakeElement | null {
  return findFirst(root, (element) => element.dataset.seatId === seatId);
}

function findByPhase(root: FakeElement, phase: string): FakeElement | null {
  return findFirst(root, (element) => element.dataset.fkPhase === phase);
}

function findByScreen(root: FakeElement, screen: string): FakeElement | null {
  return findFirst(root, (element) => element.dataset.fkScreen === screen);
}

function createInstalledUiRuntime(roomRoot: string) {
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
    `${roomRoot}/ui/context-runtime.js`,
    `${roomRoot}/shared/ui/feature-contract.js`,
    `${roomRoot}/shared/ui/scroll-runtime.js`,
    `${roomRoot}/main-functions/xox/ui/state-runtime.js`,
    `${roomRoot}/main-functions/xox/ui/backgammon-stage-runtime.js`,
    `${roomRoot}/main-functions/xox/ui/render-runtime.js`,
    `${roomRoot}/main-functions/xox/ui/module.js`,
    `${roomRoot}/main-functions/team-tetris/ui/draft-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/state-shape-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/state-view-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/state-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/module-card-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/module-shell-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/module.js`,
    `${roomRoot}/main-functions/fate-knots/ui/state-defaults-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/state-sanitize-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/state-support-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/state-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/surface-assets-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/surface-primitives-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/surface-map-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/surface-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/chrome-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/journey-overview-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/journey-creation-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/journey-stage-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/stage-support-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/stage-narrative-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/stage-combat-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/stage-runtime.js`,
    `${roomRoot}/main-functions/fate-knots/ui/module.js`,
    `${roomRoot}/ui/game-room-ui-bootstrap.js`,
    `${roomRoot}/ui/game-room-ui-state-message-runtime.js`,
    `${roomRoot}/ui/game-room-ui-runtime.js`,
    `${roomRoot}/ui/index.js`,
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

function createUiAssetRecord(assetId: string, uiSrc: string) {
  return {
    id: assetId,
    assetId,
    kind: assetId === "fate-knots-view" ? "feature-view" : "ui-runtime",
    uiSrc,
    src: uiSrc,
  };
}

const UI_ASSET_IDS = [
  "fate-knots-view",
  "active_glow_panel",
  "choice_button",
  "dark_panel",
  "default_panel",
  "disabled_panel",
  "primary_button",
  "secondary_button",
  "button_plate",
  "card_slot_frame",
  "log_panel_frame",
  "main_scene_frame",
  "side_panel_frame",
  "top_status_bar",
  "avatar_card_template",
  "class_card_template",
  "creature_card_template",
  "item_card_template",
  "location_card_template",
  "card_disabled",
  "card_focus_border",
  "card_hover_glow",
  "card_selected",
  "log_panel",
  "notification_banner",
  "system_message_box",
  "target_ring",
  "dice_badge",
  "target_marker",
  "active_marker",
  "hover_ring",
  "map_marker",
  "map_ui_crest",
  "path_segment",
  "selection_glow",
  "corner_ornament",
  "fog_patch",
  "light_glow_patch",
  "parchment_stain",
  "subtle_rune_overlay",
  "vignette_patch",
  "turn_badge",
];

function createUiAssetsState() {
  const byId = Object.fromEntries(
    UI_ASSET_IDS.map((assetId) => [assetId, createUiAssetRecord(assetId, `ui/${assetId}.webp`)])
  );
  return {
    byId,
    featureView: byId["fate-knots-view"],
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

function createParticipant(options: {
  seatId: string;
  nickname: string;
  ready?: boolean;
  selection?: Record<string, unknown>;
}) {
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

function createBaseState() {
  return {
    active: false,
    phase: "idle",
    sessionId: "fk-installed-session-1",
    participants: [
      createParticipant({
        seatId: "user",
        nickname: "Raistlin",
        selection: createSelection({ locked: false }),
      }),
      createParticipant({
        seatId: "ai1",
        nickname: "Atlas",
        selection: createSelection({ locked: true, autoAssigned: true }),
      }),
      createParticipant({
        seatId: "ai2",
        nickname: "Nova",
        selection: createSelection({ locked: true, autoAssigned: true }),
      }),
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
    uiAssets: createUiAssetsState(),
  };
}

function emitFateKnotsState(
  runtime: ReturnType<typeof createInstalledUiRuntime>,
  state: Record<string, unknown>
) {
  runtime.emitHostMessage({
    type: "fate-knots-state",
    payload: { state },
  });
}

test("game-room installed UI renders Fate Knots overview landmarks with portable assets", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    const runtime = createInstalledUiRuntime(installedCopy.rootDir);
    const translations = JSON.parse(
      readFileSync(`${installedCopy.rootDir}/i18n/en.json`, "utf8")
    ) as Record<string, unknown>;
    const state = createBaseState();

    runtime.emitHostMessage(buildHostContext(translations));
    emitFateKnotsState(runtime, state);

    assert.ok(findByPhase(runtime.document.body, "idle"));
    assert.ok(findByScreen(runtime.document.body, "overview"));
    assert.ok(findByRole(runtime.document.body, "surface-shell"));
    assert.ok(findByRole(runtime.document.body, "main-scene"));
    assert.ok(findByRole(runtime.document.body, "support-rail"));
    assert.ok(findByRole(runtime.document.body, "action-zone"));
    assert.ok(findByRole(runtime.document.body, "log"));
    assert.ok(findBySeat(runtime.document.body, "us1"));
    assert.notEqual(findBySeat(runtime.document.body, "us1")?.tagName, "button");
    assert.match(readElementText(runtime.document.body), /Fate Knots/);

    [
      `${installedCopy.rootDir}/ui/index.js`,
      `${installedCopy.rootDir}/ui/game-room-ui-runtime.js`,
      `${installedCopy.rootDir}/shared/ui/feature-contract.js`,
      `${installedCopy.rootDir}/shared/ui/scroll-runtime.js`,
      `${installedCopy.rootDir}/main-functions/xox/ui/state-runtime.js`,
      `${installedCopy.rootDir}/main-functions/xox/ui/backgammon-stage-runtime.js`,
      `${installedCopy.rootDir}/main-functions/xox/ui/render-runtime.js`,
      `${installedCopy.rootDir}/main-functions/xox/ui/module.js`,
      `${installedCopy.rootDir}/main-functions/team-tetris/styles.css`,
      `${installedCopy.rootDir}/main-functions/team-tetris/styles/layout.css`,
      `${installedCopy.rootDir}/main-functions/team-tetris/styles/board.css`,
      `${installedCopy.rootDir}/main-functions/team-tetris/styles/presentation.css`,
      `${installedCopy.rootDir}/main-functions/team-tetris/ui/draft-runtime.js`,
      `${installedCopy.rootDir}/main-functions/team-tetris/ui/state-shape-runtime.js`,
      `${installedCopy.rootDir}/main-functions/team-tetris/ui/state-view-runtime.js`,
      `${installedCopy.rootDir}/main-functions/team-tetris/ui/state-runtime.js`,
      `${installedCopy.rootDir}/main-functions/team-tetris/ui/module-card-runtime.js`,
      `${installedCopy.rootDir}/main-functions/team-tetris/ui/module-shell-runtime.js`,
      `${installedCopy.rootDir}/main-functions/team-tetris/ui/module.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/state-defaults-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/state-sanitize-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/state-support-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/state-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/surface-assets-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/surface-primitives-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/surface-map-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/surface-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/chrome-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/journey-overview-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/journey-creation-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/journey-stage-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/stage-support-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/stage-narrative-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/stage-combat-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/stage-runtime.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/module.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/styles.css`,
      `${installedCopy.rootDir}/main-functions/fate-knots/styles/shell.css`,
      `${installedCopy.rootDir}/main-functions/fate-knots/styles/layout.css`,
      `${installedCopy.rootDir}/main-functions/fate-knots/styles/components.css`,
      `${installedCopy.rootDir}/main-functions/fate-knots/styles/presentation.css`,
      `${installedCopy.rootDir}/main-functions/fate-knots/assets/ui/frames/main_scene_frame.webp`,
      `${installedCopy.rootDir}/main-functions/fate-knots/assets/ui/buttons/primary_button.webp`,
      `${installedCopy.rootDir}/main-functions/fate-knots/assets/ui/cards/avatar_card_template.webp`,
    ].forEach((filePath) => {
      assert.equal(existsSync(filePath), true, filePath);
    });
  } finally {
    await installedCopy.cleanup();
  }
});

test("game-room installed UI keeps creation landmarks and renderer-only dummy seats", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    const runtime = createInstalledUiRuntime(installedCopy.rootDir);
    const translations = JSON.parse(
      readFileSync(`${installedCopy.rootDir}/i18n/en.json`, "utf8")
    ) as Record<string, unknown>;
    const state = createBaseState();
    state.phase = "character-creation";
    state.active = true;

    runtime.emitHostMessage(buildHostContext(translations));
    emitFateKnotsState(runtime, state);

    assert.ok(findByPhase(runtime.document.body, "character-creation"));
    assert.ok(findByRole(runtime.document.body, "selection-zone"));
    assert.ok(findByRole(runtime.document.body, "support-rail"));
    assert.ok(findByRole(runtime.document.body, "summary-status"));
    assert.ok(findByRole(runtime.document.body, "action-zone"));
    assert.ok(findByRole(runtime.document.body, "log"));
    assert.ok(findByRole(runtime.document.body, "narration"));
    assert.ok(findBySeat(runtime.document.body, "us1"));
    assert.match(readElementText(runtime.document.body), /Build Summary/);
  } finally {
    await installedCopy.cleanup();
  }
});
