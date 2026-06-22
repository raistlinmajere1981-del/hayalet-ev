import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderLabWaveformTimeline } from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import {
  formatLabUserActionDisplayText,
  translateLabRuntimeText,
} from "../../rooms/laboratory/ui/lab-runtime-i18n.ts";
import { readCssWithImports } from "./helpers/css-imports.ts";
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

describe("phase 4.95 i18n", () => {
  void test("laboratory phase 4.95 renders room-local selection labels without execution detail copy", () => {
    const enTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/en.json", "utf8")
    ) as Record<string, unknown>;
    const trTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/tr.json", "utf8")
    ) as Record<string, unknown>;
    const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
    const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });

    const enMarkup = renderLabWaveformTimeline(
      createExecutionReadinessTimelineModel({
        activeExecutionIntent: {
          id: "audio-inspect",
          label: "Inspect audio",
          actionType: "inspect-audio",
          confidence: 0.82,
        },
        copy: enCopy,
      })
    );
    const trMarkup = renderLabWaveformTimeline(
      createExecutionReadinessTimelineModel({
        activeExecutionIntent: {
          id: "audio-inspect",
          label: "Ses incele",
          actionType: "inspect-audio",
          confidence: 0.82,
        },
        copy: trCopy,
      })
    );

    assert.match(enMarkup, /Selection/);
    assert.match(enMarkup, /Type/);
    assert.match(enMarkup, /Selected action/);
    assert.match(enMarkup, /Inspect audio/);
    assert.match(trMarkup, /Secim/);
    assert.match(trMarkup, /Tip/);
    assert.match(trMarkup, /Secili aksiyon/);
    assert.match(trMarkup, /Ses incele/);
    assert.doesNotMatch(
      enMarkup,
      /View details|Execution details|Simulation preview|Execution candidate/
    );
    assert.doesNotMatch(
      trMarkup,
      /Detaylari gor|Calistirma detaylari|Simulasyon onizlemesi|Calistirma adayi/
    );
  });

  void test("laboratory runtime status copy resolves through room-local i18n catalogs", () => {
    const enTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/en.json", "utf8")
    ) as Record<string, unknown>;
    const trTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/tr.json", "utf8")
    ) as Record<string, unknown>;
    const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
    const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });

    assert.equal(
      translateLabRuntimeText("Kaynak henüz hazır değil.", enCopy),
      "Source is not ready yet."
    );
    assert.equal(translateLabRuntimeText("Eksik araç: ffmpeg", enCopy), "Missing tool: ffmpeg");
    assert.equal(translateLabRuntimeText("Eksik araç: ffmpeg", trCopy), "Eksik araç: ffmpeg");
    assert.equal(
      formatLabUserActionDisplayText(
        {
          id: "action-1",
          type: "extract-audio",
          label: "Ses çıkarılıyor",
          status: "success",
          startedAt: 1,
          message: "Ses çıkarıldı",
          sourceAction: "export-audio-track",
        },
        enCopy
      ),
      "Audio extracted"
    );
  });

  void test("laboratory phase 4.95 i18n keys keep English and Turkish catalog parity", () => {
    const enTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/en.json", "utf8")
    ) as Record<string, unknown>;
    const trTranslations = JSON.parse(
      readFileSync("rooms/laboratory/i18n/tr.json", "utf8")
    ) as Record<string, unknown>;
    const phaseKeys = [
      "mediaAnalysis.processSummary",
      "mediaAnalysis.rightContext",
      "mediaAnalysis.timeline",
      "mediaAnalysis.topBar",
      "mediaAnalysis.sourcePanel",
      "mediaAnalysis.projectImport",
    ];

    function readPath(record: Record<string, unknown>, key: string): unknown {
      return key.split(".").reduce<unknown>(function (current, part) {
        return current != null && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined;
      }, record);
    }

    function collectKeys(value: unknown, prefix = ""): string[] {
      if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return [prefix];
      }
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .flatMap(function (key) {
          const nextPrefix = prefix === "" ? key : `${prefix}.${key}`;
          return collectKeys((value as Record<string, unknown>)[key], nextPrefix);
        });
    }

    phaseKeys.forEach(function (key) {
      assert.deepEqual(
        collectKeys(readPath(enTranslations, key)),
        collectKeys(readPath(trTranslations, key))
      );
    });
  });
});
