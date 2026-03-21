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

test("room runtime locale bridge refreshes xox UI and host copy", () => {
  const roomPageSource = readFileSync("src/js/pages/room-page.ts", "utf8");
  const roomHostRuntimeSource = readFileSync("src/js/modules/rooms/room-host-runtime.ts", "utf8");
  const xoxUiSource = readFileSync("rooms/xox/ui/index.js", "utf8");
  const xoxHostSource = readFileSync("rooms/xox/host/index.js", "utf8");

  assert.match(roomPageSource, /syncRuntimeLocale\("locale-change"\)/);
  assert.match(roomPageSource, /locale:\s*AppI18n\.getLocale\(\)/);
  assert.match(
    roomPageSource,
    /RoomHostRuntime\.handleRuntimeMessage\(this\.room\.id,\s*"room-event",\s*\{/
  );
  assert.match(roomHostRuntimeSource, /getLocale:\s*\(\): string => AppI18n\.getLocale\(\)/);
  assert.match(xoxUiSource, /message\.type === "host-context"/);
  assert.match(xoxUiSource, /document\.documentElement\.lang = activeLocale/);
  assert.match(xoxHostSource, /onRoomEvent:\s*function \(payload\)/);
  assert.match(xoxHostSource, /syncLocalizedState\(api,\s*payload\.locale\)/);
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
  value = "";
  disabled = false;
  htmlFor = "";
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

function hasClass(element: FakeElement, className: string): boolean {
  return element.className.split(/\s+/).includes(className);
}

function createXoxUiRuntime(initialLanguage = "en-US"): {
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

  const source = readFileSync("rooms/xox/ui/index.js", "utf8");
  vm.runInNewContext(source, {
    window: { roomAPI },
    document,
    navigator: { language: initialLanguage },
    console,
  });

  return {
    document,
    emitHostMessage(message: Record<string, unknown>): void {
      hostMessageHandler?.(message);
    },
    readyPayload,
  };
}

test("xox room UI smoke test reflects runtime locale updates", () => {
  const runtime = createXoxUiRuntime("en-US");
  const root = runtime.document.body;

  assert.equal(runtime.readyPayload?.["stage"], "ui-ready");
  assert.equal(runtime.readyPayload?.["room"], "xox");
  assert.equal(runtime.document.title, "XOX Room");
  assert.equal(findFirst(root, (element) => element.tagName === "h1")?.textContent, "XOX Room");
  assert.deepEqual(
    findAll(root, (element) => element.tagName === "h2").map((element) => element.textContent),
    ["Board", "Controls"]
  );
  assert.equal(
    findFirst(root, (element) => hasClass(element, "xox-status"))?.textContent,
    "Open the game with Start and pick the AI slot."
  );
  assert.deepEqual(
    findAll(root, (element) => hasClass(element, "xox-button"))
      .filter((element) => hasClass(element, "xox-button--ghost") === false)
      .map((element) => element.textContent),
    ["Start"]
  );

  runtime.emitHostMessage({ type: "host-context", locale: "tr" });
  runtime.emitHostMessage({
    type: "game-state",
    payload: {
      state: {
        locale: "tr",
        board: ["X", "", "", "", "O", "", "", "", ""],
        target: "ai2",
        active: false,
        awaitingAI: false,
        currentTurn: "X",
        result: "pending",
        winner: "",
        status: "Baslat ile oyunu ac ve AI slotunu sec.",
      },
    },
  });

  assert.equal(runtime.document.documentElement.lang, "tr");
  assert.equal(runtime.document.title, "XOX Odasi");
  assert.equal(findFirst(root, (element) => element.tagName === "h1")?.textContent, "XOX Odasi");
  assert.deepEqual(
    findAll(root, (element) => element.tagName === "h2").map((element) => element.textContent),
    ["Tahta", "Kontroller"]
  );
  assert.equal(
    findFirst(root, (element) => hasClass(element, "xox-status"))?.textContent,
    "Baslat ile oyunu ac ve AI slotunu sec."
  );
  assert.deepEqual(
    findAll(root, (element) => hasClass(element, "xox-stat-label")).map(
      (element) => element.textContent
    ),
    ["Sira", "Sonuc", "AI Slot"]
  );
  assert.deepEqual(
    findAll(root, (element) => hasClass(element, "xox-button")).map((element) => element.textContent),
    ["Baslat", "Sifirla"]
  );
});
