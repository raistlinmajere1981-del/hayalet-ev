import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

export {
  assert,
  createRoomInstalledCopy,
  pathToFileURL,
  readFileSync,
  resolve,
  test,
};

export class FakeElement {
  readonly tagName: string;
  readonly ownerDocument: FakeDocument;
  readonly classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    contains: (token: string) => boolean;
  };
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  dataset: Record<string, string> = {};
  className = "";
  checked = false;
  disabled = false;
  textContent = "";
  innerHTML = "";
  id = "";
  type = "";
  placeholder = "";
  value = "";
  eventListeners = new Map<string, Array<(event?: Record<string, unknown>) => void>>();

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toLowerCase();
    this.ownerDocument = ownerDocument;
    this.classList = {
      add: (...tokens: string[]) => {
        const next = new Set(this.className.split(/\s+/).filter(Boolean));
        tokens.forEach((token) => {
          if (token.trim() !== "") {
            next.add(token);
          }
        });
        this.className = Array.from(next).join(" ");
      },
      remove: (...tokens: string[]) => {
        const blocked = new Set(tokens);
        this.className = this.className
          .split(/\s+/)
          .filter((token) => token !== "" && !blocked.has(token))
          .join(" ");
      },
      contains: (token: string) => this.className.split(/\s+/).filter(Boolean).includes(token),
    };
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  insertBefore(child: FakeElement, referenceChild: FakeElement | null): void {
    child.parentElement = this;
    if (referenceChild === null) {
      this.children.push(child);
      return;
    }
    const index = this.children.indexOf(referenceChild);
    if (index === -1) {
      this.children.push(child);
      return;
    }
    this.children.splice(index, 0, child);
  }

  replaceChild(nextChild: FakeElement, previousChild: FakeElement): void {
    const index = this.children.indexOf(previousChild);
    if (index === -1) {
      nextChild.parentElement = this;
      this.children.push(nextChild);
      return;
    }
    nextChild.parentElement = this;
    previousChild.parentElement = null;
    this.children.splice(index, 1, nextChild);
  }

  remove(): void {
    if (this.parentElement === null) {
      return;
    }
    const index = this.parentElement.children.indexOf(this);
    if (index !== -1) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
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

  querySelector(selector: string): FakeElement | null {
    return findFirst(this, (element) => matchesSelector(element, selector));
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];
    walk(this, (element) => {
      if (matchesSelector(element, selector)) {
        matches.push(element);
      }
    });
    return matches;
  }
}

export class FakeDocument {
  documentElement = {
    dataset: {} as Record<string, string>,
    lang: "en",
  };
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

export function walk(root: FakeElement, visit: (element: FakeElement) => void): void {
  visit(root);
  for (const child of root.children) {
    walk(child, visit);
  }
}

export function findFirst(
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

export function matchesSelector(element: FakeElement, selector: string): boolean {
  const panelMatch = selector.match(/^\[data-forge-panel=['"]([^'"]+)['"]\]$/);
  if (panelMatch) {
    return element.dataset["forgePanel"] === panelMatch[1];
  }

  const dataMatch = selector.match(/^\[data-([a-z0-9-]+)(?:=['"]([^'"]+)['"])?\]$/i);
  if (dataMatch) {
    const datasetKey = (dataMatch[1] ?? "").replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    if ((dataMatch[2] ?? "") === "") {
      return datasetKey in element.dataset;
    }
    return element.dataset[datasetKey] === dataMatch[2];
  }

  if (selector.startsWith("#")) {
    return element.id === selector.slice(1);
  }

  return false;
}

export function findElementsByClass(root: FakeElement, className: string): FakeElement[] {
  const matches: FakeElement[] = [];
  walk(root, (element) => {
    const classNames = element.className.split(/\s+/).filter(Boolean);
    if (classNames.includes(className)) {
      matches.push(element);
    }
  });
  return matches;
}

export function readTreeText(root: FakeElement): string {
  const parts: string[] = [];
  walk(root, (element) => {
    if (element.textContent.trim() !== "") {
      parts.push(element.textContent.trim());
    }
  });
  return parts.join(" ");
}

export function fireEvent(element: FakeElement, type: string): void {
  const handlers = element.eventListeners.get(type) ?? [];
  handlers.forEach((handler) => handler({ target: element }));
}

export function loadTranslations(locale: "en" | "tr"): Record<string, unknown> {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `rooms/forge-room/i18n/${locale}.json`), "utf8")
  ) as Record<string, unknown>;
}

export function createMinimalForgeUiEnvironment() {
  const document = new FakeDocument();
  const app = document.createElement("div");
  app.id = "app";
  document.body.append(app);

  const sentCommands: string[] = [];
  const sentEvents: Array<{ command: string; payload: Record<string, unknown> }> = [];
  let hostMessageHandler: ((message: Record<string, unknown>) => void) | null = null;
  let readyPayload: Record<string, unknown> | null = null;

  const descriptors = {
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      language: "en-US",
    },
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: document,
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      document,
      roomAPI: {
        onHostMessage(handler: (message: Record<string, unknown>) => void) {
          hostMessageHandler = handler;
        },
        ready(payload: Record<string, unknown>) {
          readyPayload = payload;
        },
        sendCommand(command: string, payload: Record<string, unknown> = {}) {
          sentCommands.push(command);
           sentEvents.push({ command, payload });
          return true;
        },
      },
    },
  });

  return {
    app,
    emitHostMessage(message: Record<string, unknown>) {
      hostMessageHandler?.(message);
    },
    readyPayload() {
      return readyPayload;
    },
    restore() {
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      });
    },
    sentEvents,
    sentCommands,
  };
}
