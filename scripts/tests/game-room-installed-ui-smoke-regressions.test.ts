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
    String(element.dataset["fkRole"] ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .includes(role)
  );
}

function findByScreen(root: FakeElement, screen: string): FakeElement | null {
  return findFirst(root, (element) => element.dataset["fkScreen"] === screen);
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
      windowObject["scrollX"] = Number.isFinite(x) ? x : 0;
      windowObject["scrollY"] = Number.isFinite(y) ? y : 0;
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
    getComputedStyle() {
      return {
        getPropertyValue() {
          return "";
        },
      };
    },
  };

  [
    `${roomRoot}/ui/context-runtime.js`,
    `${roomRoot}/shared/ui/feature-contract.js`,
    `${roomRoot}/shared/ui/scroll-runtime.js`,
    `${roomRoot}/main-functions/backgammon/ui/state-runtime.js`,
    `${roomRoot}/main-functions/backgammon/ui/backgammon-stage-runtime.js`,
    `${roomRoot}/main-functions/backgammon/ui/render-runtime.js`,
    `${roomRoot}/main-functions/backgammon/ui/module.js`,
    `${roomRoot}/main-functions/team-tetris/ui/draft-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/state-shape-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/state-view-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/state-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/module-card-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/module-shell-runtime.js`,
    `${roomRoot}/main-functions/team-tetris/ui/module.js`,
    `${roomRoot}/main-functions/fate-knots/ui/module.js`,
    `${roomRoot}/ui/game-room-ui-bootstrap.js`,
    `${roomRoot}/ui/game-room-ui-state-message-runtime.js`,
    `${roomRoot}/ui/game-room-ui-runtime.js`,
    `${roomRoot}/ui/index.js`,
  ].forEach((filePath) => {
    vm.runInNewContext(readFileSync(filePath, "utf8"), context);
  });

  return {
    document,
    emitHostMessage(message: Record<string, unknown>) {
      hostMessageHandler?.(message);
    },
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
      { id: "backgammon", name: "Tavla" },
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
      ai1: { slotId: "ai1", nickname: "Atlas", assigned: true, connected: true, ready: true },
      ai2: { slotId: "ai2", nickname: "Nova", assigned: true, connected: false, ready: false },
      us1: { slotId: "us1", nickname: "Remote Ghost", assigned: true, connected: false },
    },
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

void test("game-room installed UI renders the Fate Knots blank placeholder", async () => {
  const installedCopy = await createRoomInstalledCopy("game-room");

  try {
    const runtime = createInstalledUiRuntime(installedCopy.rootDir);
    const translations = JSON.parse(
      readFileSync(`${installedCopy.rootDir}/i18n/en.json`, "utf8")
    ) as Record<string, unknown>;

    runtime.emitHostMessage(buildHostContext(translations));
    emitFateKnotsState(runtime, {
      active: false,
      phase: "blank-slate",
      revision: 0,
    });

    assert.ok(findByScreen(runtime.document.body, "blank-slate"));
    assert.ok(findByRole(runtime.document.body, "surface-shell"));
    assert.ok(findByRole(runtime.document.body, "status"));
    assert.ok(findByRole(runtime.document.body, "action-zone"));
    assert.match(readElementText(runtime.document.body), /Fate Knots/);
    assert.match(readElementText(runtime.document.body), /No legacy run is loaded/);

    [
      `${installedCopy.rootDir}/main-functions/fate-knots/ui/module.js`,
      `${installedCopy.rootDir}/main-functions/fate-knots/styles.css`,
      `${installedCopy.rootDir}/main-functions/fate-knots/assets/fate-knots-view.webp`,
    ].forEach((filePath) => {
      assert.equal(existsSync(filePath), true, filePath);
    });
  } finally {
    await installedCopy.cleanup();
  }
});
