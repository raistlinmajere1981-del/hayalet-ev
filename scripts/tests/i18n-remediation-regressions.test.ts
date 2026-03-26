import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

import { getBuiltInLanguagePack } from "../../shared/i18n/bundled-languages.ts";
import type { TranslationCatalog } from "../../src/types/i18n.ts";

function getCatalogString(
  catalog: TranslationCatalog | null | undefined,
  path: string[]
): string | undefined {
  let current: string | TranslationCatalog | undefined = catalog ?? undefined;

  for (const segment of path) {
    if (current === undefined || typeof current === "string") {
      return undefined;
    }

    current = current[segment];
  }

  return typeof current === "string" ? current : undefined;
}

function listCatalogLeafPaths(
  catalog: TranslationCatalog | null | undefined,
  prefix: string[] = []
): string[] {
  if (catalog === null || catalog === undefined) {
    return [];
  }

  return Object.entries(catalog).flatMap(([key, value]) => {
    const path = [...prefix, key];
    if (typeof value === "string") {
      return [path.join(".")];
    }
    if (value && typeof value === "object" && Array.isArray(value) === false) {
      return listCatalogLeafPaths(value, path);
    }
    return [];
  });
}

function readRoomCatalog(locale: "en" | "tr"): TranslationCatalog {
  return JSON.parse(readFileSync(`rooms/game-room/i18n/${locale}.json`, "utf8")) as TranslationCatalog;
}

test("whisper shell bindings resolve through the entrance namespace", () => {
  const indexHtml = readFileSync("src/index.html", "utf8");
  const whisperHtml = readFileSync("src/pages/whisper.html", "utf8");

  assert.match(indexHtml, /data-shell-i18n-title="entrance\.panels\.whisper"/);
  assert.match(indexHtml, /data-shell-i18n-aria-label="entrance\.panels\.whisper"/);
  assert.match(whisperHtml, /data-shell-i18n-text="entrance\.panels\.whisper"/);
  assert.doesNotMatch(indexHtml, /data-shell-i18n-(?:title|aria-label)="panels\.whisper"/);
  assert.doesNotMatch(whisperHtml, /data-shell-i18n-text="panels\.whisper"/);
});

test("catalog cleanup removes stale built-in keys and preserves translated replacements", () => {
  const enPack = getBuiltInLanguagePack("en");
  const trPack = getBuiltInLanguagePack("tr");

  assert.equal(getCatalogString(enPack?.catalog, ["app", "startup", "loadingSettings"]), undefined);
  assert.equal(getCatalogString(trPack?.catalog, ["app", "startup", "loadingSettings"]), undefined);
  assert.equal(
    getCatalogString(enPack?.catalog, ["entrance", "user", "language", "restartHint"]),
    undefined
  );
  assert.equal(
    getCatalogString(trPack?.catalog, ["entrance", "user", "language", "restartHint"]),
    undefined
  );

  const translatedPairs = [
    {
      path: ["shell", "assistant", "memoryOverlay", "title"],
      tr: "Bellek Görüntüleyici",
    },
    {
      path: ["entrance", "user", "googleDrive", "authCodePlaceholder"],
      tr: "Yetki kodu",
    },
    {
      path: ["entrance", "us1", "remote", "sectionTitle"],
      tr: "Uzak kullanıcı el sıkışması",
    },
    {
      path: ["opencodeUi", "chat", "clearLabel"],
      tr: "🗑 Temizle",
    },
    {
      path: ["opencodeUi", "panel", "serverTitle"],
      tr: "OpenCode Sunucusu",
    },
  ];

  for (const entry of translatedPairs) {
    const enValue = getCatalogString(enPack?.catalog, entry.path);
    const trValue = getCatalogString(trPack?.catalog, entry.path);

    assert.ok(enValue, `${entry.path.join(".")} should exist in EN catalog`);
    assert.equal(trValue, entry.tr);
    assert.notEqual(enValue, trValue, `${entry.path.join(".")} should differ between EN/TR`);
  }
});

test("game-room room catalogs stay structurally aligned across EN and TR", () => {
  const enCatalog = readRoomCatalog("en");
  const trCatalog = readRoomCatalog("tr");

  assert.deepEqual(listCatalogLeafPaths(trCatalog).sort(), listCatalogLeafPaths(enCatalog).sort());
});

test("room runtime locale bridge refreshes game-room UI and host copy", () => {
  const roomPageSource = readFileSync("src/js/pages/room-page.ts", "utf8");
  const roomHostRuntimeSource = readFileSync("src/js/modules/rooms/room-host-runtime.ts", "utf8");
  const gameRoomUiSource = readFileSync("rooms/game-room/ui/index.js", "utf8");
  const gameRoomXoxUiSource = readFileSync("rooms/game-room/main-functions/xox/ui/module.js", "utf8");
  const gameRoomTeamTetrisUiSource = readFileSync(
    "rooms/game-room/main-functions/team-tetris/ui/module.js",
    "utf8"
  );
  const gameRoomHostSource = readFileSync("rooms/game-room/host/index.js", "utf8");

  assert.match(roomPageSource, /syncRuntimeContext\("locale-change"\)/);
  assert.match(roomPageSource, /buildRuntimeContextPayload\(reason: string\)/);
  assert.match(roomPageSource, /nickname:\s*AppState\.getNickname\("user"\)/);
  assert.match(roomPageSource, /ai1:\s*this\.buildSlotContext\("ai1"\)/);
  assert.match(roomPageSource, /SlotController\.on\(eventName/);
  assert.match(roomHostRuntimeSource, /getLocale:\s*\(\): string => AppI18n\.getLocale\(\)/);
  assert.match(gameRoomUiSource, /message\.type === "host-context"/);
  assert.match(gameRoomUiSource, /state\.translations = message\.translations/);
  assert.match(gameRoomUiSource, /message\.type === "xox-state"/);
  assert.match(gameRoomUiSource, /message\.type === "team-tetris-state"/);
  assert.match(gameRoomUiSource, /xoxUi\.renderBootstrap\(root\)/);
  assert.match(gameRoomXoxUiSource, /function renderBootstrap\(root\)/);
  assert.match(gameRoomXoxUiSource, /GameRoomXoxStart/);
  assert.match(gameRoomTeamTetrisUiSource, /GameRoomTeamTetrisStart/);
  assert.match(gameRoomHostSource, /onRoomEvent: function onRoomEvent\(payload\)/);
  assert.match(gameRoomHostSource, /payload\.type === "host-context"/);
  assert.match(gameRoomHostSource, /GameRoomXoxAiMove/);
  assert.match(gameRoomHostSource, /GameRoomTeamTetrisAiMove/);
});

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
  style = {};
  eventListeners = new Map<string, Array<(...args: unknown[]) => void>>();

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

  addEventListener(type: string, handler: (...args: unknown[]) => void): void {
    const handlers = this.eventListeners.get(type) ?? [];
    handlers.push(handler);
    this.eventListeners.set(type, handlers);
  }
}

class FakeDocument {
  documentElement = { lang: "und" };
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

function findAll(root: FakeElement, predicate: (element: FakeElement) => boolean): FakeElement[] {
  const matches: FakeElement[] = [];
  if (predicate(root)) {
    matches.push(root);
  }

  for (const child of root.children) {
    matches.push(...findAll(child, predicate));
  }

  return matches;
}

function createGameRoomUiRuntime(initialLanguage = "en-US"): {
  document: FakeDocument;
  emitHostMessage: (message: Record<string, unknown>) => void;
  readyPayload: Record<string, unknown> | null;
} {
  const document = new FakeDocument();
  const app = document.createElement("div");
  app.id = "app";
  document.body.append(app);

  let hostMessageHandler: ((message: Record<string, unknown>) => void) | null = null;
  let readyPayload: Record<string, unknown> | null = null;
  const roomAPI = {
    sendCommand: () => true,
    onHostMessage(handler: (message: Record<string, unknown>) => void): void {
      hostMessageHandler = handler;
    },
    ready(payload: Record<string, unknown>): void {
      readyPayload = payload;
    },
  };

  const context = {
    window: { roomAPI },
    document,
    navigator: { language: initialLanguage },
    console,
  };
  [
    "rooms/game-room/main-functions/xox/ui/module.js",
    "rooms/game-room/main-functions/team-tetris/ui/module.js",
    "rooms/game-room/ui/index.js",
  ].forEach((filePath) => {
    vm.runInNewContext(readFileSync(filePath, "utf8"), context);
  });

  return {
    document,
    emitHostMessage(message: Record<string, unknown>): void {
      hostMessageHandler?.(message);
    },
    readyPayload,
  };
}

test("game-room UI smoke test reflects runtime locale updates", () => {
  const runtime = createGameRoomUiRuntime("en-US");
  const root = runtime.document.body;
  const trCatalog = readRoomCatalog("tr");

  assert.equal(runtime.readyPayload?.["stage"], "ui-ready");
  assert.equal(runtime.readyPayload?.["room"], "game-room");
  assert.equal(runtime.readyPayload?.["feature"], "xox");
  assert.equal(findFirst(root, (element) => element.tagName === "h1")?.textContent, "Loading Game Room");
  assert.equal(runtime.document.documentElement.lang, "en");

  runtime.emitHostMessage({
    type: "host-context",
    locale: "tr",
    translations: trCatalog,
    room: {
      id: "game-room",
      name: "Oyun Odasi",
    },
    user: {
      nickname: "Kullanici",
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
        assigned: false,
        connected: false,
        ready: false,
        state: "empty",
      },
    },
  });
  runtime.emitHostMessage({
    type: "xox-state",
    payload: {
      state: {
        board: ["X", "", "O", "", "X", "", "", "", ""],
        boardAscii: "X | 1 | O\n---------\n3 | X | 5\n---------\n6 | 7 | 8",
        availableCells: [1, 3, 5, 6, 7, 8],
        active: true,
        awaitingMoveFrom: "ai",
        result: "pending",
        selectedTarget: "ai1",
        starter: "user",
        userSymbol: "X",
        aiSymbol: "O",
        status: "AI cevabi bekleniyor.",
        blockedReason: "",
        protocolDelivered: true,
        opponentReady: true,
        opponent: {
          slotId: "ai1",
          nickname: "Atlas",
          assigned: true,
          connected: true,
          ready: true,
          state: "connected",
        },
        user: {
          nickname: "Kullanici",
        },
      },
    },
  });

  assert.equal(runtime.document.documentElement.lang, "tr");
  assert.equal(findFirst(root, (element) => element.textContent === "XOX Mac Masasi"), null);
  assert.equal(runtime.document.title, "Oyun Odasi - XOX");
  assert.equal(findAll(root, (element) => element.dataset.index !== undefined).length, 9);
  assert.ok(findAll(root, (element) => element.textContent === "Atlas").length > 0);
  assert.ok(findAll(root, (element) => element.textContent === "Devam Ediyor").length > 0);
  assert.ok(findAll(root, (element) => element.textContent === "AI cevabi bekleniyor.").length > 0);
});

test("game-room UI smoke test renders the Team Tetris bootstrap from active feature context", () => {
  const runtime = createGameRoomUiRuntime("en-US");
  const root = runtime.document.body;
  const trCatalog = readRoomCatalog("tr");

  runtime.emitHostMessage({
    type: "host-context",
    locale: "tr",
    translations: trCatalog,
    room: {
      id: "game-room",
      name: "Oyun Odasi",
      defaultFeatureId: "xox",
    },
    features: [
      {
        id: "xox",
        name: "XOX",
      },
      {
        id: "team-tetris",
        name: "Takim Tetris",
      },
    ],
    activeFeature: {
      id: "team-tetris",
      name: "Takim Tetris",
    },
    user: {
      nickname: "Kullanici",
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
        connected: true,
        ready: true,
        state: "connected",
      },
      us1: {
        slotId: "us1",
        nickname: "Uzak",
        assigned: true,
        connected: false,
        ready: false,
        state: "assigned",
      },
    },
  });
  runtime.emitHostMessage({
    type: "team-tetris-state",
    payload: {
      state: {
        hiddenPairs: true,
        canStart: false,
        requiredSlots: {
          ai1: true,
          ai2: true,
          us1: false,
        },
        board: {
          width: 10,
          height: 20,
          seedLabel: "contract-frozen",
        },
        boards: [
          {
            teamId: "team-a",
            label: "Takim A",
            visibility: "private",
            rows: Array.from({ length: 20 }, () => ".........."),
          },
          {
            teamId: "team-b",
            label: "Takim B",
            visibility: "public",
            rows: Array.from({ length: 20 }, () => ".........."),
          },
        ],
        turnLoop: ["team-a-opener", "team-b-opener", "team-a-followup", "team-b-followup"],
        status: "Takim Tetris baslamadan once AI1, AI2 ve US1 bekleniyor.",
      },
    },
  });

  assert.equal(runtime.document.title, "Oyun Odasi - Takim Tetris");
  assert.ok(findAll(root, (element) => element.textContent === "Takim Tetris Masasi").length > 0);
  assert.ok(findAll(root, (element) => element.textContent === "Atlas").length > 0);
  assert.ok(
    findAll(root, (element) => element.textContent === "Takim Tetris baslamadan once AI1, AI2 ve US1 bekleniyor.")
      .length > 0
  );
  assert.equal(findAll(root, (element) => element.className === "tt-board__cell").length, 600);
});
