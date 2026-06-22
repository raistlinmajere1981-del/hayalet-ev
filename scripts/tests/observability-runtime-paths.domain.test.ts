import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderLabWaveformTimeline } from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import { getLabLayoutKind, renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import {
  buildLabDecisionSnapshot,
  deriveLabDecisionSignals,
  deriveLabDecisionSignalsFromState,
  readLabDecisionActiveBlocks,
  resolveLabDecisionIntent,
  resolveLabDecisionState,
} from "../../rooms/laboratory/ui/lab-decision-layer.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import {
  formatLabUserActionDisplayText,
  translateLabRuntimeText,
} from "../../rooms/laboratory/ui/lab-runtime-i18n.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";
import { readCssWithImports } from "./helpers/css-imports.ts";
import { importLabRootModuleWithDomStub } from "./laboratory-runtime-truth.helpers.ts";
import type { LabDecisionSnapshot, LabRun } from "../../rooms/laboratory/domain/lab-types.ts";
import type { LabWaveformTimelineModel } from "../../rooms/laboratory/ui/lab-waveform-timeline-types.ts";

function readLabThemeSource() {
  return readCssWithImports("rooms/laboratory/ui/lab-theme.css");
}

function readLabWaveformTimelineSource() {
  return [
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "rooms/laboratory/ui/lab-waveform-timeline-panels.ts",
  ]
    .map(function (filePath) {
      return readFileSync(filePath, "utf8");
    })
    .join("\n");
}

class ElementStub {
  private innerHtmlValue = "";
  scrollTop = 0;
  dataset: Record<string, string> = {};
  classList = {
    add() {},
    remove() {},
    toggle() {},
  };

  get innerHTML(): string {
    return this.innerHtmlValue;
  }

  set innerHTML(value: string) {
    this.innerHtmlValue = value;
  }

  querySelector(_selector?: string): null {
    return null;
  }

  querySelectorAll(_selector?: string): [] {
    return [];
  }

  addEventListener(): void {}

  removeEventListener(): void {}

  replaceChildren(): void {}
}

function captureDebugLogs(run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(console, "info");
  const logs: unknown[][] = [];
  Object.defineProperty(console, "info", {
    configurable: true,
    value(...args: unknown[]) {
      logs.push(args);
    },
  });
  try {
    run();
  } finally {
    if (descriptor) {
      Object.defineProperty(console, "info", descriptor);
    } else {
      Reflect.deleteProperty(console, "info");
    }
  }
  return logs;
}

function createObservabilityShell(input: {
  debug: boolean;
  drawerMode?: string;
  existingPanel?: boolean;
  pipelineBlocks?: number;
  regions?: number;
}) {
  let panelRemoved = false;
  let insertedHtml = "";
  const panelAttributes = new Map<string, string>();
  const panel = {
    innerHTML: "",
    remove() {
      panelRemoved = true;
    },
    setAttribute(name: string, value: string) {
      panelAttributes.set(name, value);
    },
  };
  const contextPanel = {
    getAttribute(name: string) {
      return name === "data-drawer-mode" ? (input.drawerMode ?? "setup") : null;
    },
  };
  return {
    get insertedHtml() {
      return insertedHtml;
    },
    get panelAttributes() {
      return panelAttributes;
    },
    get panelInnerHtml() {
      return panel.innerHTML;
    },
    get panelRemoved() {
      return panelRemoved;
    },
    getAttribute(name: string) {
      return name === "data-lab-debug-regions" && input.debug ? "true" : null;
    },
    insertAdjacentHTML(_position: InsertPosition, html: string) {
      insertedHtml = html;
    },
    querySelector(selector: string) {
      if (selector === '[data-lab-debug-panel="true"]') {
        return input.existingPanel === true ? panel : null;
      }
      if (selector === '[data-lab-region="context-panel"], .labx-drawer') {
        return contextPanel;
      }
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector === "[data-lab-region]") {
        return Array.from({ length: input.regions ?? 0 });
      }
      if (selector === ".labx-pipeline-block") {
        return Array.from({ length: input.pipelineBlocks ?? 0 });
      }
      return [];
    },
  };
}

type MinimalLaboratoryUiEnvironmentOptions = {
  fakeTimers?: boolean;
  roomApi?: "full" | "none";
};

function createMinimalLaboratoryUiEnvironment(options: MinimalLaboratoryUiEnvironmentOptions = {}) {
  const runtimeRoot = new ElementStub();
  let readyPayload: Record<string, unknown> | null = null;
  let timerId = 1;
  const queuedTimers: Array<{ callback: () => void; delay: number; id: number }> = [];

  const descriptors = {
    clearTimeout: Object.getOwnPropertyDescriptor(globalThis, "clearTimeout"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    setTimeout: Object.getOwnPropertyDescriptor(globalThis, "setTimeout"),
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    HTMLElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLElement"),
  };

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: ElementStub,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      language: "en-US",
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        dataset: {},
        lang: "en",
        style: {
          setProperty() {},
        },
      },
      body: Object.assign(new ElementStub(), {
        style: {
          setProperty() {},
        },
      }),
      addEventListener() {},
      removeEventListener() {},
      getElementById(id: string) {
        return id === "app" ? runtimeRoot : null;
      },
      querySelector() {
        return null;
      },
    },
  });
  if (options.fakeTimers === true) {
    Object.defineProperty(globalThis, "setTimeout", {
      configurable: true,
      value(callback: (...args: unknown[]) => void, delay = 0, ...args: unknown[]) {
        const id = timerId;
        timerId += 1;
        queuedTimers.push({
          callback() {
            callback(...args);
          },
          delay: isNaN(Number(delay)) ? 0 : Number(delay),
          id,
        });
        return id;
      },
    });
    Object.defineProperty(globalThis, "clearTimeout", {
      configurable: true,
      value(id: number) {
        const timerIndex = queuedTimers.findIndex(function (timer) {
          return timer.id === id;
        });
        if (timerIndex >= 0) {
          queuedTimers.splice(timerIndex, 1);
        }
      },
    });
  }
  const windowStub: Record<string, unknown> = {
    addEventListener() {},
    removeEventListener() {},
  };
  if (options.roomApi !== "none") {
    windowStub["roomAPI"] = {
      onHostMessage() {},
      ready(payload: Record<string, unknown>) {
        readyPayload = payload;
      },
      sendEvent() {},
    };
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowStub,
  });

  return {
    flushTimers(maxDelay = Number.POSITIVE_INFINITY) {
      let nextIndex = queuedTimers.findIndex(function (timer) {
        return timer.delay <= maxDelay;
      });
      while (nextIndex >= 0) {
        const [timer] = queuedTimers.splice(nextIndex, 1);
        (timer as NonNullable<typeof timer>).callback();
        nextIndex = queuedTimers.findIndex(function (candidate) {
          return candidate.delay <= maxDelay;
        });
      }
    },
    readyPayload: () => readyPayload,
    restore() {
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      });
    },
    runtimeRoot,
  };
}

class MountedRootElement extends ElementStub {
  layoutWrites: string[] = [];
  mountedQueriesEnabled = false;
  private mountedInnerHtmlValue = "";

  override get innerHTML(): string {
    return this.mountedInnerHtmlValue;
  }

  override set innerHTML(value: string) {
    this.layoutWrites.push(value);
    this.mountedInnerHtmlValue = value;
  }

  clearLayoutWrites(): void {
    this.layoutWrites = [];
  }

  setShellAttribute(name: string, value: string): void {
    const shellMatch = this.mountedInnerHtmlValue.match(/<div class="labx-shell"([^>]*)>/);
    if (!shellMatch) {
      return;
    }
    const shellTag = shellMatch[0];
    const attributePattern = new RegExp(`${name}="[^"]*"`);
    const nextTag = attributePattern.test(shellTag)
      ? shellTag.replace(attributePattern, `${name}="${value}"`)
      : shellTag.replace(/>$/, ` ${name}="${value}">`);
    this.mountedInnerHtmlValue = this.mountedInnerHtmlValue.replace(shellTag, nextTag);
  }

  override querySelector(selector?: string): null {
    if (this.mountedQueriesEnabled !== true) {
      return null;
    }
    if (selector === ".labx-shell" && this.innerHTML.includes('class="labx-shell"')) {
      return new MountedQueryElement(this, selector) as unknown as null;
    }
    return null;
  }
}

class MountedQueryElement extends ElementStub {
  constructor(
    private readonly root: MountedRootElement,
    private readonly selector: string
  ) {
    super();
  }

  getAttribute(name: string): string | null {
    if (this.selector !== ".labx-shell") {
      return null;
    }
    const shellMatch = this.root.innerHTML.match(/<div class="labx-shell"([^>]*)>/);
    const shellAttributes = shellMatch?.[1] ?? "";
    const attributeMatch = shellAttributes.match(new RegExp(`${name}="([^"]*)"`));
    return attributeMatch?.[1] ?? null;
  }

  removeAttribute(): void {}

  hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }

  getAttributeNames(): string[] {
    return [];
  }

  insertAdjacentHTML(_position: InsertPosition, html: string): void {
    this.root.innerHTML += html;
  }

  setAttribute(name: string, value: string): void {
    if (this.selector === ".labx-shell") {
      this.root.setShellAttribute(name, value);
    }
  }
}

class MountedActionElement extends ElementStub {
  constructor(action: string, value?: string) {
    super();
    this.dataset["labAction"] = action;
    if (value !== undefined) {
      this.dataset["labValue"] = value;
    }
  }

  closest(selector: string): MountedActionElement | null {
    return selector === "[data-lab-action]" ? this : null;
  }
}

class MountedSelectElement extends ElementStub {
  type = "select-one";

  constructor(
    field: string,
    public value: string
  ) {
    super();
    this.dataset["labField"] = field;
  }
}

function createMountedLaboratoryTransitionEnvironment(options: { animationFrame?: boolean } = {}) {
  const runtimeRoot = new MountedRootElement();
  const listeners = new Map<string, (event: Event) => void>();
  let readyPayload: Record<string, unknown> | null = null;
  let timerId = 1;
  let animationFrameId = 1;
  let storageWriteCount = 0;
  const queuedAnimationFrames: Array<{ callback: (timestamp: number) => void; id: number }> = [];
  const storage = new Map<string, string>();
  storage.set(
    "hayalet-ev:laboratory-refactor:v4",
    JSON.stringify({
      schemaVersion: 4,
      sourceProbeStatus: "completed",
      source: {
        kind: "video",
        mode: "local",
        previewUrl: "file:///tmp/mounted-transition.mp4",
        status: "ready",
        storedFileName: "mounted-transition.mp4",
        storedPath: "/tmp/mounted-transition.mp4",
      },
    })
  );

  const descriptors = {
    clearTimeout: Object.getOwnPropertyDescriptor(globalThis, "clearTimeout"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    Element: Object.getOwnPropertyDescriptor(globalThis, "Element"),
    HTMLElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLElement"),
    HTMLInputElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLInputElement"),
    HTMLSelectElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLSelectElement"),
    HTMLTextAreaElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLTextAreaElement"),
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    setTimeout: Object.getOwnPropertyDescriptor(globalThis, "setTimeout"),
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
  };

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: ElementStub,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: ElementStub,
  });
  Object.defineProperty(globalThis, "HTMLInputElement", {
    configurable: true,
    value: ElementStub,
  });
  Object.defineProperty(globalThis, "HTMLSelectElement", {
    configurable: true,
    value: MountedSelectElement,
  });
  Object.defineProperty(globalThis, "HTMLTextAreaElement", {
    configurable: true,
    value: ElementStub,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      language: "en-US",
    },
  });
  Object.defineProperty(globalThis, "setTimeout", {
    configurable: true,
    value() {
      const id = timerId;
      timerId += 1;
      return id;
    },
  });
  Object.defineProperty(globalThis, "clearTimeout", {
    configurable: true,
    value() {},
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        dataset: {},
        lang: "en",
        style: {
          setProperty() {},
        },
      },
      body: Object.assign(new ElementStub(), {
        style: {
          setProperty() {},
        },
      }),
      addEventListener(type: string, listener: (event: Event) => void) {
        listeners.set(type, listener);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      },
      getElementById(id: string) {
        return id === "app" ? runtimeRoot : null;
      },
      querySelector() {
        return null;
      },
    },
  });
  const windowStub: Record<string, unknown> = {
    addEventListener() {},
    clearTimeout() {},
    localStorage: {
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storageWriteCount += 1;
        storage.set(key, value);
      },
    },
    removeEventListener() {},
    roomAPI: {
      onHostMessage() {},
      ready(payload: Record<string, unknown>) {
        readyPayload = payload;
      },
      sendEvent() {},
    },
    setTimeout() {
      const id = timerId;
      timerId += 1;
      return id;
    },
  };
  if (options.animationFrame === true) {
    windowStub["cancelAnimationFrame"] = function (id: number) {
      const frameIndex = queuedAnimationFrames.findIndex(function (frame) {
        return frame.id === id;
      });
      if (frameIndex >= 0) {
        queuedAnimationFrames.splice(frameIndex, 1);
      }
    };
    windowStub["requestAnimationFrame"] = function (callback: (timestamp: number) => void) {
      const id = animationFrameId;
      animationFrameId += 1;
      queuedAnimationFrames.push({ callback, id });
      return id;
    };
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowStub,
  });

  return {
    animationFrameCount() {
      return queuedAnimationFrames.length;
    },
    flushAnimationFrames() {
      const pendingFrames = queuedAnimationFrames.splice(0);
      pendingFrames.forEach(function (frame) {
        frame.callback(Date.now());
      });
    },
    listener(type: string) {
      return listeners.get(type);
    },
    readyPayload: () => readyPayload,
    resetStorageWriteCount() {
      storageWriteCount = 0;
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
    storageWriteCount() {
      return storageWriteCount;
    },
    runtimeRoot,
  };
}

function createExecutionReadinessTimelineModel(
  overrides: Record<string, unknown> = {}
): LabWaveformTimelineModel {
  return {
    activeSelection: {
      id: "selection-1",
      startMs: 1000,
      endMs: 3000,
      type: "clip",
      createdAt: 1,
    },
    bookmarks: [],
    durationMs: 4000,
    endMs: 3000,
    startMs: 1000,
    waveformSourceLabel: "Embedded audio",
    waveformSyncLabel: "Preview and waveform share the same master axis.",
    waveformWindowDurationMs: 4000,
    waveformWindowStartMs: 0,
    ...overrides,
  };
}

describe("observability runtime paths", () => {
  void test("laboratory observability runtime paths log region fallback and overlay health without replacing shell", async () => {
    class RuntimeHarnessElement extends ElementStub {
      appendedChildren: RuntimeHarnessElement[] = [];
      attributes = new Map<string, string>();
      childNodes: RuntimeHarnessElement[] = [];
      className = "";
      outerHtmlWrites: string[] = [];
      parentElement: RuntimeHarnessElement | null = null;
      private readonly queries = new Map<string, RuntimeHarnessElement | null>();

      constructor(
        readonly tagName = "DIV",
        attributes: Record<string, string> = {}
      ) {
        super();
        Object.entries(attributes).forEach(([key, value]) => {
          this.setAttribute(key, value);
        });
        this.className = attributes["class"] ?? "";
      }

      appendChild(child: RuntimeHarnessElement): RuntimeHarnessElement {
        child.parentElement = this;
        this.appendedChildren.push(child);
        this.childNodes.push(child);
        return child;
      }

      cloneNode(): RuntimeHarnessElement {
        return new RuntimeHarnessElement(this.tagName, Object.fromEntries(this.attributes));
      }

      get outerHTML(): string {
        return this.innerHTML;
      }

      set outerHTML(value: string) {
        this.outerHtmlWrites.push(value);
        this.innerHTML = value;
      }

      getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null;
      }

      getAttributeNames(): string[] {
        return Array.from(this.attributes.keys());
      }

      hasAttribute(name: string): boolean {
        return this.attributes.has(name);
      }

      override querySelector(selector?: string): null {
        if (selector == null || selector === "") return null;
        return (this.queries.get(selector) as unknown as null) ?? null;
      }

      remove(): void {
        this.parentElement?.childNodes.splice(this.parentElement.childNodes.indexOf(this), 1);
      }

      removeAttribute(name: string): void {
        this.attributes.delete(name);
      }

      replaceWith(next: RuntimeHarnessElement): void {
        this.outerHtmlWrites.push(next.outerHTML);
      }

      setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
        if (name === "class") {
          this.className = value;
        }
      }

      setQuery(selector: string, element: RuntimeHarnessElement | null): void {
        this.queries.set(selector, element);
      }
    }

    class RuntimeHarnessTemplate {
      content: { firstElementChild: RuntimeHarnessElement | null } = {
        firstElementChild: null,
      };

      set innerHTML(markup: string) {
        const trimmed = markup.trim();
        const tag = /^<([a-z0-9-]+)/i.exec(trimmed)?.[1]?.toUpperCase() ?? "";
        if (tag === "") {
          this.content.firstElementChild = null;
          return;
        }
        const className = /\sclass="([^"]*)"/.exec(trimmed)?.[1] ?? "";
        this.content.firstElementChild = new RuntimeHarnessElement(tag, { class: className });
        this.content.firstElementChild.innerHTML = trimmed;
      }
    }

    type LabRootObservabilityRuntime = {
      __testOnlyLabRootObservability: {
        queryRegion: (root: ParentNode, selectors: readonly string[]) => HTMLElement | null;
        shouldFallback: (regionsFound: number) => boolean;
        syncOverlayRoot: (
          documentRef: Document,
          root: HTMLElement,
          overlayKey: "report" | "tools",
          selector: string,
          render: () => string,
          debugShell?: Element | null
        ) => boolean;
        syncRegion: (input: {
          debugShell?: Element | null;
          documentRef: Document;
          preserveScroll?: boolean;
          regionKey?:
            | "contextPanel"
            | "inspectorPanel"
            | "leftRail"
            | "mainStage"
            | "processStrip"
            | "topBar";
          render: () => string;
          root: ParentNode;
          selectors: readonly string[];
        }) => boolean;
      };
    };

    const labRootModule = await importLabRootModuleWithDomStub<LabRootObservabilityRuntime>();
    const observability = labRootModule.__testOnlyLabRootObservability;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
    const documentRef = {
      createElement(tagName: string) {
        if (tagName === "template") {
          return new RuntimeHarnessTemplate();
        }
        return new RuntimeHarnessElement(tagName.toUpperCase());
      },
    } as unknown as Document;

    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: RuntimeHarnessElement,
    });
    try {
      const root = new RuntimeHarnessElement("DIV");
      const debugShell = new RuntimeHarnessElement("DIV", {
        "data-lab-debug-regions": "true",
      });
      const topbar = new RuntimeHarnessElement("SECTION", {
        class: "labx-top-bar",
        "data-lab-region": "topbar",
      });
      topbar.scrollTop = 17;
      topbar.parentElement = root;
      root.setQuery('[data-lab-region="topbar"]', topbar);

      const regionLogs = captureDebugLogs(function () {
        const updated = observability.syncRegion({
          debugShell: debugShell as unknown as Element,
          documentRef,
          preserveScroll: true,
          regionKey: "topBar",
          render() {
            return '<article class="labx-top-bar">updated</article>';
          },
          root: root as unknown as ParentNode,
          selectors: ['[data-lab-region="topbar"]', ".labx-top-bar"],
        });
        const missing = observability.syncRegion({
          debugShell: debugShell as unknown as Element,
          documentRef,
          regionKey: "inspectorPanel",
          render() {
            return '<aside class="labx-workspace-inspector">missing</aside>';
          },
          root: root as unknown as ParentNode,
          selectors: ['[data-lab-region="inspector-panel"]', ".labx-workspace-inspector"],
        });

        assert.equal(updated, true);
        assert.equal(missing, false);
      });

      assert.equal(
        observability.queryRegion(root as unknown as ParentNode, ['[data-lab-region="topbar"]']),
        topbar
      );
      assert.equal(topbar.outerHtmlWrites.length, 1);
      assert.match(topbar.outerHtmlWrites[0] ?? "", /class="labx-top-bar"/);
      assert.deepEqual(
        regionLogs.map(function (entry) {
          return entry[0];
        }),
        ["[lab][region] topbar -> updated", "[lab][region] inspector -> missing"]
      );

      assert.equal(observability.shouldFallback(2), true);
      assert.equal(observability.shouldFallback(3), false);

      const overlayRoot = new RuntimeHarnessElement("DIV");
      const existingOverlay = new RuntimeHarnessElement("DIV", { class: "labx-overlay-root" });
      existingOverlay.parentElement = overlayRoot;
      overlayRoot.setQuery(".labx-overlay-root", existingOverlay);

      const overlayLogs = captureDebugLogs(function () {
        const updatedOverlay = observability.syncOverlayRoot(
          documentRef,
          overlayRoot as unknown as HTMLElement,
          "tools",
          ".labx-overlay-root",
          function () {
            return '<aside class="labx-overlay-root">updated</aside>';
          },
          debugShell as unknown as Element
        );
        const invalidOverlay = observability.syncOverlayRoot(
          documentRef,
          overlayRoot as unknown as HTMLElement,
          "report",
          "#lab-report-overlay-root",
          function () {
            return "";
          },
          debugShell as unknown as Element
        );

        assert.equal(updatedOverlay, true);
        assert.equal(invalidOverlay, false);
      });

      assert.equal(existingOverlay.outerHtmlWrites.length, 1);
      assert.equal(overlayRoot.outerHtmlWrites.length, 0);
      assert.equal(overlayRoot.appendedChildren.length, 0);
      assert.deepEqual(
        overlayLogs.map(function (entry) {
          return entry[0];
        }),
        ["[lab][overlay] report -> missing", "[lab][overlay] report -> invalid"]
      );

      const quietShell = new RuntimeHarnessElement("DIV");
      const quietLogs = captureDebugLogs(function () {
        observability.syncRegion({
          debugShell: quietShell as unknown as Element,
          documentRef,
          regionKey: "processStrip",
          render() {
            return '<div class="labx-process-strip"></div>';
          },
          root: root as unknown as ParentNode,
          selectors: ['[data-lab-region="process-strip"]'],
        });
        observability.syncOverlayRoot(
          documentRef,
          overlayRoot as unknown as HTMLElement,
          "report",
          "#lab-report-overlay-root",
          function () {
            return "";
          },
          quietShell as unknown as Element
        );
      });
      assert.equal(quietLogs.length, 0);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "HTMLElement", descriptor);
      } else {
        Reflect.deleteProperty(globalThis, "HTMLElement");
      }
    }
  });
});
