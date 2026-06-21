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

void test("laboratory UI shell evaluates under minimal runtime stubs", async () => {
  const environment = createMinimalLaboratoryUiEnvironment({
    fakeTimers: true,
  });
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    await import(
      `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?smoke=${Date.now()}`
    );

    assert.match(environment.runtimeRoot.innerHTML, /class="labx-shell"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-boot-panel"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-center-skeleton="true"/);
    assert.match(environment.runtimeRoot.innerHTML, /labx-center-skeleton__label/);
    assert.match(environment.runtimeRoot.innerHTML, /labx-drawer-skeleton/);
    assert.deepEqual(environment.readyPayload(), {
      feature: "media-analysis",
      room: "laboratory",
      stage: "ui-ready",
    });
  } finally {
    await buildArtifact.cleanup();
    environment.restore();
  }
});

void test("laboratory boot overlay unlocks from local ready without a room API bridge", async () => {
  const environment = createMinimalLaboratoryUiEnvironment({
    fakeTimers: true,
    roomApi: "none",
  });
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    await import(
      `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?localBoot=${Date.now()}`
    );

    assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
    assert.equal(environment.readyPayload(), null);

    environment.flushTimers(999);

    assert.match(environment.runtimeRoot.innerHTML, /data-ready="true"/);
    assert.doesNotMatch(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-center-skeleton="true"/);
    assert.match(environment.runtimeRoot.innerHTML, /labx-drawer-skeleton/);
    assert.doesNotMatch(environment.runtimeRoot.innerHTML, /lab-project-workspace-root/);
    assert.doesNotMatch(environment.runtimeRoot.innerHTML, /data-overlay="project-workspace"/);
  } finally {
    await buildArtifact.cleanup();
    environment.restore();
  }
});

void test("laboratory boot overlay waits for host data when a room API bridge exists", async () => {
  const environment = createMinimalLaboratoryUiEnvironment({
    fakeTimers: true,
  });
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    await import(
      `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?bridgeBoot=${Date.now()}`
    );

    assert.deepEqual(environment.readyPayload(), {
      feature: "media-analysis",
      room: "laboratory",
      stage: "ui-ready",
    });

    environment.flushTimers(999);

    assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-center-skeleton="true"/);
    assert.match(environment.runtimeRoot.innerHTML, /labx-drawer-skeleton/);
  } finally {
    await buildArtifact.cleanup();
    environment.restore();
  }
});

void test("laboratory boot overlay fallback waits for idle before unlocking bridge loads", async () => {
  const environment = createMinimalLaboratoryUiEnvironment({
    fakeTimers: true,
  });
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    await import(
      `${pathToFileURL(resolve(buildArtifact.rootDir, "ui/index.js")).href}?fallbackBoot=${Date.now()}`
    );

    environment.flushTimers(7999);

    assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);

    environment.flushTimers(8000);

    assert.match(environment.runtimeRoot.innerHTML, /data-ready="true"/);
    assert.doesNotMatch(environment.runtimeRoot.innerHTML, /data-lab-boot-overlay="true"/);
  } finally {
    await buildArtifact.cleanup();
    environment.restore();
  }
});

void test("laboratory shell routes host traffic through lab-root orchestration seams", () => {
  const uiIndexSource = readFileSync("rooms/laboratory/ui/index.ts", "utf8");
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const labLayoutSource = readFileSync("rooms/laboratory/ui/lab-layout.ts", "utf8");
  const hostBridgeSource = readFileSync("rooms/laboratory/runtime/lab-host-bridge.ts", "utf8");

  assert.match(uiIndexSource, /import "\.\/lab-root\.js";/);
  assert.match(labRootSource, /return renderWorkspaceSurface\(state, \{/);
  assert.doesNotMatch(labRootSource, /state\.bootReady && state\.ui\.labMode/);
  assert.match(
    labRootSource,
    /runtimeRoot\.innerHTML = renderLabLayout\(state, surface, copy, \{\s*bootOverlayActive: isBootOverlayActive\(state\),\s*\}\);/
  );
  assert.match(labLayoutSource, /inspectorPanel: ""/);
  assert.match(labRootSource, /renderLabBootOverlay\(copy\)/);
  assert.match(labRootSource, /getLabLayoutKind\(state, \{/);
  assert.match(labRootSource, /currentLayoutKind !== nextLayoutKind/);
  assert.doesNotMatch(labRootSource, /nextLayoutKind === "import-only"/);
  assert.match(labRootSource, /function syncBootOverlay\(/);
  assert.match(labRootSource, /const BOOT_OVERLAY_SETTLE_MS = 450;/);
  assert.match(labRootSource, /const BOOT_OVERLAY_FALLBACK_READY_MS = 8000;/);
  assert.match(labRootSource, /const BOOT_OVERLAY_FAILSAFE_MS = 20000;/);
  assert.match(labRootSource, /let bootBootstrapSeen = false;/);
  assert.match(labRootSource, /function getBootOverlayBootstrapStatus\(state: LabStoreState\)/);
  assert.match(labRootSource, /function hasRoomReadyBridge\(\)/);
  assert.match(labRootSource, /function requestBootOverlayInteractiveUnlock\(\)/);
  assert.match(labRootSource, /requestIdleCallback/);
  assert.match(labRootSource, /function scheduleStoreSideEffects\(state: LabStoreState\)/);
  assert.match(
    labRootSource,
    /requestAnimationFrame\(function \(\) \{\s*storeSideEffectsFrame = null;\s*runStoreSideEffects\(\);/
  );
  assert.match(labRootSource, /function flushStoreSideEffects\(\)/);
  assert.match(labRootSource, /windowRef\.addEventListener\("beforeunload", handleBeforeUnload\);/);
  assert.match(
    labRootSource,
    /store\.subscribe\(function \(state\) \{\s*scheduleStoreSideEffects\(state\);/
  );
  assert.match(labRootSource, /const bootstrapStatus = getBootOverlayBootstrapStatus\(state\);/);
  assert.match(labRootSource, /bootstrapStatus === "ready" \|\| bootstrapStatus === "error"/);
  assert.match(labRootSource, /!hasRoomReadyBridge\(\)/);
  assert.doesNotMatch(labRootSource, /state\.roomReadySent \|\| !hasRoomReadyBridge\(\)/);
  assert.match(
    labRootSource,
    /shell\.dataset\["ready"\] = isBootOverlayActive\(state\) \? "false" : "true";/
  );
  assert.match(labRootSource, /bootBootstrapSeen = true;/);
  assert.match(labRootSource, /scheduleBootOverlayUnlock\(state\);/);
  assert.match(labRootSource, /renderToolManagementOverlay\(state, copy\)/);
  assert.match(labRootSource, /emit:\s*eventBus\.emit,/);
  assert.match(
    labRootSource,
    /roomAPI\.ready\(\{\s*feature:\s*"media-analysis",\s*room:\s*"laboratory",\s*stage:\s*"ui-ready"/
  );
  assert.doesNotMatch(labRootSource, /BOOT_MESSAGES/);
  assert.doesNotMatch(labRootSource, /startBootMessages/);
  assert.doesNotMatch(labRootSource, /stopBootMessages/);
  assert.match(labLayoutSource, /renderToolManagementOverlay\(state, copy\)/);
  assert.match(labLayoutSource, /data-lab-boot-overlay="true"/);
  assert.match(hostBridgeSource, /type === "source-state"/);
  assert.match(hostBridgeSource, /type:\s*"source-snapshot-received"/);
  assert.match(hostBridgeSource, /type === "lab-event"/);
  assert.doesNotMatch(hostBridgeSource, /buildLifecycleEventsFromHostEvent/);
});

void test("laboratory mounted shell keeps chrome when YouTube is selected as a source mode", async () => {
  const environment = createMountedLaboratoryTransitionEnvironment();

  try {
    await import(
      `${pathToFileURL(resolve("rooms/laboratory/ui/lab-root.ts")).href}?mountedImport=${Date.now()}`
    );

    assert.deepEqual(environment.readyPayload(), {
      feature: "media-analysis",
      room: "laboratory",
      stage: "ui-ready",
    });
    assert.match(environment.runtimeRoot.innerHTML, /data-layout-kind="laboratory"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-ready="false"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-top-bar"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-drawer labx-context-panel"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-process-strip"/);

    environment.runtimeRoot.mountedQueriesEnabled = true;

    const clickListener = environment.listener("click");
    assert.ok(clickListener);
    clickListener({
      target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
    } as unknown as Event);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-value="audio-signal"/);
    assert.match(
      environment.runtimeRoot.innerHTML,
      /data-lab-value="audio-signal"[\s\S]*aria-expanded="true"/
    );

    clickListener({
      target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
    } as unknown as Event);
    assert.match(
      environment.runtimeRoot.innerHTML,
      /data-lab-value="audio-signal"[\s\S]*aria-expanded="false"/
    );

    const changeListener = environment.listener("change");
    assert.ok(changeListener);
    changeListener({
      target: new MountedSelectElement("source.mode", "youtube"),
    } as unknown as Event);

    assert.match(environment.runtimeRoot.innerHTML, /data-layout-kind="laboratory"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-top-bar"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-drawer labx-context-panel"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-process-strip"/);
    assert.doesNotMatch(environment.runtimeRoot.innerHTML, /class="labx-import-workspace"/);
    assert.doesNotMatch(
      environment.runtimeRoot.innerHTML,
      /data-lab-action="exit-youtube-import-mode"/
    );
  } finally {
    environment.restore();
  }
});

void test("laboratory mounted shell coalesces store side effects into one animation frame", async () => {
  const environment = createMountedLaboratoryTransitionEnvironment({ animationFrame: true });

  try {
    await import(
      `${pathToFileURL(resolve("rooms/laboratory/ui/lab-root.ts")).href}?rafCoalescing=${Date.now()}`
    );

    environment.flushAnimationFrames();
    environment.resetStorageWriteCount();
    environment.runtimeRoot.mountedQueriesEnabled = true;

    const clickListener = environment.listener("click");
    assert.ok(clickListener);

    clickListener({
      target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
    } as unknown as Event);
    clickListener({
      target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
    } as unknown as Event);

    assert.equal(environment.animationFrameCount(), 1);
    assert.equal(environment.storageWriteCount(), 0);

    environment.flushAnimationFrames();

    assert.equal(environment.animationFrameCount(), 0);
    assert.equal(environment.storageWriteCount(), 1);
  } finally {
    environment.restore();
  }
});

void test("laboratory mounted fallback logs missing region diagnostics before preserving debug replacement", async () => {
  const environment = createMountedLaboratoryTransitionEnvironment();

  try {
    await import(
      `${pathToFileURL(resolve("rooms/laboratory/ui/lab-root.ts")).href}?mountedFallback=${Date.now()}`
    );

    environment.runtimeRoot.mountedQueriesEnabled = true;
    environment.runtimeRoot.setShellAttribute("data-lab-debug-regions", "true");
    environment.runtimeRoot.clearLayoutWrites();

    const clickListener = environment.listener("click");
    assert.ok(clickListener);

    const debugLogs = captureDebugLogs(function () {
      clickListener({
        target: new MountedActionElement("analysis-prep-group-drawer-toggle", "audio-signal"),
      } as unknown as Event);
    });
    const debugMessages = debugLogs.map(function (entry) {
      return entry[0];
    });

    assert.equal(debugMessages[0], "[lab][fallback] triggered -> regionsFound: 0");
    assert.deepEqual(debugLogs[0]?.[1], {
      missing: ["topbar", "left-rail", "main-stage", "context-panel", "inspector", "process-strip"],
      regionsFound: 0,
    });
    assert.deepEqual(
      debugMessages.slice(1, 7).sort(),
      [
        "[lab][region] context-panel -> missing",
        "[lab][region] inspector -> missing",
        "[lab][region] topbar -> missing",
        "[lab][region] left-rail -> missing",
        "[lab][region] main-stage -> missing",
        "[lab][region] process-strip -> missing",
      ].sort()
    );
    assert.ok(
      debugMessages.some(function (message) {
        return typeof message === "string" && message.startsWith("[lab][decision] ");
      })
    );
    assert.ok(environment.runtimeRoot.layoutWrites.length >= 1);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-debug-regions="true"/);
  } finally {
    environment.restore();
  }
});

void test("laboratory YouTube source panel renders checked stream controls without import-only shell", () => {
  const sourcePresets = JSON.parse(
    readFileSync("rooms/laboratory/tools/source-presets.json", "utf8")
  ) as Record<string, unknown>;
  const ytDlpForm = JSON.parse(readFileSync("rooms/laboratory/tools/yt-dlp.form.json", "utf8")) as Record<string, unknown>;
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-1",
      projects: [{ id: "project-1", name: "YouTube Draft", hasSource: false }],
      activeProject: {
        id: "project-1",
        name: "YouTube Draft",
        source: {
          kind: "video",
          mode: "youtube",
          status: "idle",
          drafts: {
            urlInput: "",
            youtubeUrl: "https://youtube.com/watch?v=abc123",
            youtubePreset: "custom",
            youtubeCaptureMode: "video+audio",
            youtubeCustom: {
              mergeOutputFormat: "mp4",
              writeSubtitles: true,
              retries: 12,
            },
          },
        },
        edit: {},
        profile: { preflight: {} },
        process: { records: {} },
        report: { records: {} },
      },
      sourcePresets,
      ytDlpForm,
      toolState: { tools: { "yt-dlp": { installed: true } } },
    },
  });
  store.dispatch({ type: "project-import-method-changed", kind: "video", method: "youtube" });
  store.dispatch({
    type: "project-import-url-check-started",
    url: "https://youtube.com/watch?v=abc123",
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-url-check",
      kind: "request-result",
      severity: "success",
      message: "URL check completed",
      detail: null,
      action: "project-import-check-url",
      stage: "completed",
      timestamp: Date.now(),
      source: "host",
      scope: "global",
      moduleId: null,
      rawLine: null,
      result: {
        url: "https://youtube.com/watch?v=abc123",
        isYoutube: true,
        kind: "video",
        preview: {
          title: "Sample Video Title",
          duration: 154,
          thumbnail: "https://img.youtube.com/vi/abc123/hqdefault.jpg",
        },
        formats: [
          {
            formatId: "137",
            label: "Video 1080p",
            kind: "video",
            extension: "mp4",
          },
          {
            formatId: "140",
            label: "Audio m4a",
            kind: "audio",
            extension: "m4a",
          },
        ],
        selectedVideoFormatId: "137",
        selectedAudioFormatId: "140",
      },
    } as never,
  });
  const state = store.getState();
  const panelMarkup = renderLabSourcePanel(state);
  const shellMarkup = renderLabLayout(state, {
    main: `<div id="lab-workspace-main"></div>`,
    side: "",
  });

  assert.equal(getLabLayoutKind(state), "laboratory");
  assert.match(shellMarkup, /data-layout-kind="laboratory"/);
  assert.match(shellMarkup, /class="labx-top-bar"/);
  assert.match(shellMarkup, /class="labx-process-strip"/);
  assert.doesNotMatch(shellMarkup, /data-layout-kind="import-only"/);
  assert.doesNotMatch(shellMarkup, /class="labx-import-workspace"/);
  assert.match(panelMarkup, /class="labx-project-import__youtube-result"/);
  assert.match(panelMarkup, /Sample Video Title/);
  const actionsIndex = panelMarkup.indexOf('class="labx-sp-url__actions"');
  const progressIndex = panelMarkup.indexOf('class="labx-project-import__progress"');
  const youtubeResultIndex = panelMarkup.indexOf('class="labx-project-import__youtube-result"');
  assert.ok(actionsIndex >= 0);
  assert.ok(progressIndex > actionsIndex);
  assert.ok(youtubeResultIndex > progressIndex);
  assert.match(panelMarkup, /data-lab-field="project-import\.youtubeCaptureMode"/);
  assert.match(panelMarkup, /data-lab-field="project-import\.youtubeVideoFormat"/);
  assert.match(panelMarkup, /data-lab-field="project-import\.youtubeAudioFormat"/);
  assert.match(panelMarkup, /<option value="137" selected>Video 1080p<\/option>/);
  assert.match(panelMarkup, /<option value="140" selected>Audio m4a<\/option>/);
  assert.match(panelMarkup, /data-lab-field="project-import\.youtubeCustom\.mergeOutputFormat"/);
  assert.doesNotMatch(
    panelMarkup,
    /data-lab-field="project-import\.youtubeCustom\.writeSubtitles"/
  );
  assert.doesNotMatch(
    panelMarkup,
    /data-lab-field="project-import\.youtubeCustom\.writeAutoSubtitles"/
  );
  assert.doesNotMatch(panelMarkup, /data-lab-field="project-import\.youtubeCustom\.subtitlesLang"/);
  assert.match(panelMarkup, /data-lab-field="project-import\.youtubeCustom\.retries"/);
  assert.doesNotMatch(panelMarkup, /data-lab-action="youtube-import-set-strategy"/);
  assert.doesNotMatch(panelMarkup, /data-lab-field="youtube-import\.custom/);
  assert.doesNotMatch(panelMarkup, /data-lab-field="project-import\.youtubeCustom\.format"/);
  assert.doesNotMatch(panelMarkup, /class="labx-strategy-list"/);

  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8")) as Record<string, unknown>;
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8")) as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(
      (
        (enTranslations["mediaAnalysis"] as Record<string, unknown>)["source"] as Record<string, unknown>
      )["youtubeImport"] as Record<string, unknown>
    ).sort(),
    Object.keys(
      (
        (trTranslations["mediaAnalysis"] as Record<string, unknown>)["source"] as Record<string, unknown>
      )["youtubeImport"] as Record<string, unknown>
    ).sort()
  );
});

void test("laboratory shell preserves workspace preview nodes while diffing live panels", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const labRootObservabilitySource = readFileSync(
    "rooms/laboratory/ui/lab-root-observability.ts",
    "utf8"
  );
  const labDomSyncSource = readFileSync("rooms/laboratory/ui/lab-dom-sync.ts", "utf8");
  readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const workspaceSourceIntakeSource = readFileSync(
    "rooms/laboratory/ui/workspace-source-intake.ts",
    "utf8"
  );

  assert.match(labDomSyncSource, /function updateRenderedElement\(/);
  assert.match(labDomSyncSource, /function syncChildNodes\(/);
  assert.match(labDomSyncSource, /function canReuseElement\(/);
  assert.match(labRootSource, /from "\.\/lab-root-observability\.js"/);
  assert.match(labRootObservabilitySource, /const LAB_REGION_SELECTORS = \{/);
  assert.match(
    labRootObservabilitySource,
    /topBar: \['\[data-lab-region="topbar"\]', '\[data-lab-region="top-bar"\]', "\.labx-top-bar"\]/
  );
  assert.match(
    labRootObservabilitySource,
    /leftRail: \[\s*'\[data-lab-region="source-panel"\]',\s*'\[data-lab-region="left-rail-source"\]',\s*'\[data-lab-region="left-rail"\]',\s*"\.labx-source-panel",\s*"\.labx-left-rail",\s*\]/
  );
  assert.match(
    labRootObservabilitySource,
    /mainStage: \['\[data-lab-region="main-stage"\]', "\.labx-center-panel"\]/
  );
  assert.match(
    labRootObservabilitySource,
    /contextPanel: \['\[data-lab-region="context-panel"\]', "\.labx-drawer"\]/
  );
  assert.match(
    labRootObservabilitySource,
    /inspectorPanel: \['\[data-lab-region="inspector-panel"\]', "\.labx-workspace-inspector"\]/
  );
  assert.match(
    labRootObservabilitySource,
    /processStrip: \['\[data-lab-region="process-strip"\]', "\.labx-process-strip"\]/
  );
  assert.match(
    labRootObservabilitySource,
    /function queryRegion\(root: ParentNode, selectors: readonly string\[\]\)/
  );
  assert.match(labRootObservabilitySource, /for \(const selector of selectors\)/);
  assert.match(
    labRootSource,
    /element:\s*queryRegion\(runtimeRoot, LAB_REGION_SELECTORS\[descriptor\.key\]\)/
  );
  assert.match(labRootObservabilitySource, /function syncRegion\(input: \{/);
  assert.match(
    labRootObservabilitySource,
    /const currentElement = queryRegion\(input\.root, input\.selectors\);/
  );
  assert.match(labRootObservabilitySource, /return false;/);
  assert.match(labRootObservabilitySource, /function shouldFallback\(regionsFound: number\)/);
  assert.match(labRootObservabilitySource, /return regionsFound < 3;/);
  assert.match(labRootObservabilitySource, /const LAB_OVERLAY_SELECTORS = \{/);
  assert.match(labRootObservabilitySource, /function syncOverlayRoot\(/);
  assert.match(labRootSource, /const regionDescriptors: LabRegionDescriptor\[\] = \[/);
  assert.match(
    labRootSource,
    /key: "topBar"[\s\S]*key: "leftRail"[\s\S]*key: "mainStage"[\s\S]*key: "contextPanel"[\s\S]*key: "inspectorPanel"[\s\S]*key: "processStrip"/
  );
  assert.match(
    labRootSource,
    /key: "inspectorPanel"[\s\S]*render\(\) \{[\s\S]*return surface\.inspector \?\? "";[\s\S]*\}/
  );
  assert.match(labRootSource, /shouldFallback\(regionsFound\)/);
  assert.doesNotMatch(labRootSource, /shouldFallback\(regionsFound\) \|\| !overlayRoot/);
  assert.match(labRootObservabilitySource, /function debugLabRegionLifecycle\(/);
  assert.match(labRootObservabilitySource, /function debugLabFallback\(/);
  assert.match(labRootObservabilitySource, /function debugLabOverlay\(/);
  assert.match(labRootObservabilitySource, /function syncLabDebugPanel\(/);
  assert.match(labRootObservabilitySource, /\[lab\]\[region\]/);
  assert.match(labRootObservabilitySource, /\[lab\]\[fallback\]/);
  assert.match(labRootObservabilitySource, /\[lab\]\[overlay\]/);
  assert.match(labRootSource, /\[lab\]\[decision\]/);
  assert.match(labRootSource, /buildLabDecisionSnapshot\(\{ shell, state \}\)/);
  assert.match(labRootSource, /lastDecisionLogKey = null;/);
  assert.match(
    labRootSource,
    /debugLabFallback\(shell, regionsFound, missingRegions\);[\s\S]*replaceLabLayout\(state, surface, copy\);/
  );
  assert.match(labRootSource, /mountedShell\.setAttribute\("data-lab-debug-regions", "true"\)/);
  assert.doesNotMatch(labRootSource, /\[lab-root\] regions synced/);
  assert.match(
    labDomSyncSource,
    /const preserveKey = readPreservedMediaKey\(currentElement\) \|\| readPreservedMediaKey\(nextElement\);/
  );
  assert.match(labDomSyncSource, /function readPreservedDetailsState\(/);
  assert.match(labDomSyncSource, /element\.hasAttribute\("data-lab-interpretation-panel"\)/);
  assert.match(labDomSyncSource, /element\.hasAttribute\("data-lab-collapsible-panel"\)/);
  assert.match(labDomSyncSource, /currentElement\.open = preservedDetailsState;/);
  assert.match(labDomSyncSource, /currentElement\.scrollTop = scrollTop;/);
  assert.match(
    labRootSource,
    /syncRegion\(\{[\s\S]*debugShell: shell,[\s\S]*documentRef,[\s\S]*regionKey: region\.key,[\s\S]*render: region\.render,[\s\S]*root: runtimeRoot,[\s\S]*selectors: LAB_REGION_SELECTORS\[region\.key\],[\s\S]*\}\);/
  );
  assert.match(workspaceSourceIntakeSource, /preserveKey \|\| "workspace-preview"/);
  assert.match(
    workspaceSourceIntakeSource,
    /data-lab-preserve-media="\$\{escapeHtml\(preserveKey\)\}"/
  );
});

void test("laboratory decision layer maps compact signals into the intent backbone", () => {
  assert.deepEqual(
    deriveLabDecisionSignals({
      hasResult: false,
      hasSelection: false,
      hasSource: false,
      isRunning: false,
    }),
    []
  );
  assert.deepEqual(
    deriveLabDecisionSignals({
      hasResult: true,
      hasSelection: true,
      hasSource: true,
      isRunning: true,
    }),
    ["has-selection", "has-source", "is-running", "has-result"]
  );

  assert.equal(resolveLabDecisionIntent("setup", ["has-selection", "has-source"]), "ready-to-run");
  assert.equal(resolveLabDecisionIntent("setup", ["has-selection"]), "preparing-analysis");
  assert.equal(resolveLabDecisionIntent("running", []), "running-analysis");
  assert.equal(resolveLabDecisionIntent("result", []), "reviewing-results");
  assert.equal(resolveLabDecisionIntent("explore", []), "exploring-alternatives");
  assert.equal(resolveLabDecisionIntent("unknown", []), "idle");

  assert.equal(resolveLabDecisionState("ready-to-run"), "ready");
  assert.equal(resolveLabDecisionState("running-analysis"), "running");
  assert.equal(resolveLabDecisionState("reviewing-results"), "done");
  assert.equal(resolveLabDecisionState("exploring-alternatives"), "done");
  assert.equal(resolveLabDecisionState("preparing-analysis"), "idle");
  assert.equal(resolveLabDecisionState("idle"), "idle");
});

void test("laboratory decision layer reads active pipeline blocks in rendered DOM order", () => {
  const shell = {
    querySelectorAll(selector: string) {
      assert.equal(selector, ".labx-pipeline-block");
      return [
        {
          getAttribute(name: string) {
            return name === "data-block-id" ? "analysis-prep" : null;
          },
        },
        {
          getAttribute() {
            return "";
          },
        },
        {
          getAttribute() {
            return null;
          },
        },
        {
          getAttribute(name: string) {
            return name === "data-block-id" ? "preflight" : null;
          },
        },
        {
          getAttribute(name: string) {
            return name === "data-block-id" ? "analysis-prep" : null;
          },
        },
      ];
    },
  };

  assert.deepEqual(readLabDecisionActiveBlocks(shell as unknown as ParentNode), [
    "analysis-prep",
    "preflight",
    "analysis-prep",
  ]);
});

void test("laboratory decision snapshot mirrors current UI state without driving behavior", () => {
  const store = createLabStore();
  const emptySnapshot = buildLabDecisionSnapshot({
    shell: null,
    state: store.getState(),
    timestamp: 1,
  });
  assert.equal(emptySnapshot.mode, "setup");
  assert.equal(emptySnapshot.intent, "preparing-analysis");
  assert.equal(emptySnapshot.state, "idle");
  assert.deepEqual(emptySnapshot.triggers, []);

  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/source.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });

  const readyShell = {
    querySelectorAll(selector: string) {
      if (selector !== ".labx-pipeline-block") {
        return [];
      }
      return [
        {
          getAttribute(name: string) {
            return name === "data-block-id" ? "analysis-prep" : null;
          },
        },
        {
          getAttribute(name: string) {
            return name === "data-block-id" ? "preflight" : null;
          },
        },
        {
          getAttribute(name: string) {
            return name === "data-block-id" ? "analysis-cta" : null;
          },
        },
      ];
    },
  };
  const readySnapshot = buildLabDecisionSnapshot({
    shell: readyShell as unknown as ParentNode,
    state: store.getState(),
    timestamp: 2,
  });

  assert.equal(readySnapshot.mode, "setup");
  assert.equal(readySnapshot.intent, "ready-to-run");
  assert.equal(readySnapshot.state, "ready");
  assert.deepEqual(readySnapshot.triggers, ["has-selection", "has-source"]);
  assert.deepEqual(readySnapshot.activeBlocks, ["analysis-prep", "preflight", "analysis-cta"]);
});

void test("laboratory decision signals follow UI readiness instead of raw source presence", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      routeLabel: "youtube",
      storedPath: "/tmp/source.mp4",
    },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });

  const snapshot = buildLabDecisionSnapshot({
    state: store.getState(),
    timestamp: 3,
  });

  assert.deepEqual(snapshot.triggers, ["has-selection"]);
  assert.equal(snapshot.intent, "preparing-analysis");
  assert.equal(snapshot.state, "idle");
  assert.deepEqual(deriveLabDecisionSignalsFromState(store.getState()), ["has-selection"]);
});

void test("laboratory decision signals keep explore intent separate from result payload presence", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/source.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({ type: "workspace-timeline-updated", startMs: 1000, endMs: 3000 });

  const state = store.getState();
  state.run = {
    analysisScope: null,
    artifacts: [],
    comparisonVariants: [],
    confidence: null,
    emptyReason: "No reportable findings.",
    endedAt: Date.now() - 1000,
    error: null,
    events: [],
    findings: [],
    hypothesisSummary: null,
    id: "run-empty-result",
    liveFindings: [],
    moduleOrder: [],
    moduleTrace: [],
    modules: {},
    previewArtifacts: [],
    progress: 100,
    rawLog: [],
    startedAt: Date.now() - 2000,
    state: "completed",
    targetLabel: null,
    warnings: [],
  } satisfies LabRun;

  const snapshot = buildLabDecisionSnapshot({
    state,
    timestamp: 4,
  });

  assert.equal(snapshot.mode, "explore");
  assert.equal(snapshot.intent, "exploring-alternatives");
  assert.equal(snapshot.state, "done");
  assert.deepEqual(snapshot.triggers, ["has-selection", "has-source"]);
});

void test("laboratory observability helpers are debug gated and structured", async () => {
  const labRootModule = await importLabRootModuleWithDomStub<{
    __testOnlyLabRootObservability: {
      debugLabFallback: (
        shell: Element | null,
        regionsFound: number,
        missingRegions: string[]
      ) => void;
      debugLabOverlay: (
        shell: Element | null,
        overlayKey: "report" | "tools",
        event: "invalid" | "missing",
        detail?: Record<string, unknown>
      ) => void;
      debugLabRegionLifecycle: (
        shell: Element | null,
        regionKey:
          | "contextPanel"
          | "inspectorPanel"
          | "leftRail"
          | "mainStage"
          | "processStrip"
          | "topBar",
        event: "fallback" | "missing" | "mount" | "update",
        detail?: Record<string, unknown>
      ) => void;
      isLabRegionDebugEnabled: (shell: Element | null) => boolean;
      syncLabDebugPanel: (
        shell: HTMLElement | null,
        decisionSnapshot?: LabDecisionSnapshot | null
      ) => void;
    };
  }>();
  const observability = labRootModule.__testOnlyLabRootObservability;
  const debugShell = createObservabilityShell({
    debug: true,
    drawerMode: "result",
    pipelineBlocks: 4,
    regions: 9,
  });
  const quietShell = createObservabilityShell({ debug: false, existingPanel: true });

  const debugLogs = captureDebugLogs(function () {
    observability.debugLabRegionLifecycle(debugShell as unknown as Element, "topBar", "mount");
    observability.debugLabRegionLifecycle(
      debugShell as unknown as Element,
      "inspectorPanel",
      "update"
    );
    observability.debugLabFallback(debugShell as unknown as Element, 2, [
      "inspector",
      "context-panel",
    ]);
    observability.debugLabOverlay(debugShell as unknown as Element, "tools", "missing", {
      selector: ".labx-overlay-root",
    });
  });

  assert.deepEqual(
    debugLogs.map(function (entry) {
      return entry[0];
    }),
    [
      "[lab][region] topbar -> mounted",
      "[lab][region] inspector -> updated",
      "[lab][fallback] triggered -> regionsFound: 2",
      "[lab][overlay] tools -> missing",
    ]
  );
  assert.deepEqual(debugLogs[2]?.[1], {
    missing: ["inspector", "context-panel"],
    regionsFound: 2,
  });

  const quietLogs = captureDebugLogs(function () {
    observability.debugLabRegionLifecycle(quietShell as unknown as Element, "topBar", "mount");
    observability.debugLabFallback(quietShell as unknown as Element, 2, ["topbar"]);
    observability.debugLabOverlay(quietShell as unknown as Element, "tools", "missing");
  });
  assert.equal(quietLogs.length, 0);
  assert.equal(observability.isLabRegionDebugEnabled(debugShell as unknown as Element), true);
  assert.equal(observability.isLabRegionDebugEnabled(quietShell as unknown as Element), false);

  observability.syncLabDebugPanel(debugShell as unknown as HTMLElement);
  assert.match(debugShell.insertedHtml, /data-lab-debug-panel="true"/);
  assert.match(debugShell.insertedHtml, /data-region-count="9"/);
  assert.match(debugShell.insertedHtml, /data-pipeline-block-count="4"/);
  assert.match(debugShell.insertedHtml, /data-active-block-count="4"/);
  assert.match(debugShell.insertedHtml, /data-drawer-mode="result"/);
  assert.match(debugShell.insertedHtml, /data-decision-intent="idle"/);
  assert.match(debugShell.insertedHtml, /data-decision-state="idle"/);
  assert.match(debugShell.insertedHtml, /<span>mode result<\/span>/);
  assert.match(debugShell.insertedHtml, /<span>intent idle<\/span>/);
  assert.match(debugShell.insertedHtml, /<span>blocks 4<\/span>/);
  assert.match(debugShell.insertedHtml, /<span>state idle<\/span>/);
  assert.doesNotMatch(debugShell.insertedHtml, /triggers|has-selection|has-source/);

  const updateShell = createObservabilityShell({
    debug: true,
    drawerMode: "setup",
    existingPanel: true,
    pipelineBlocks: 4,
    regions: 9,
  });
  observability.syncLabDebugPanel(updateShell as unknown as HTMLElement, {
    activeBlocks: ["analysis-prep", "preflight", "analysis-cta"],
    intent: "ready-to-run",
    mode: "setup",
    state: "ready",
    timestamp: 12,
    triggers: ["has-selection", "has-source"],
  });
  assert.equal(updateShell.panelAttributes.get("data-active-block-count"), "3");
  assert.equal(updateShell.panelAttributes.get("data-decision-intent"), "ready-to-run");
  assert.equal(updateShell.panelAttributes.get("data-decision-state"), "ready");
  assert.match(updateShell.panelInnerHtml, /<span>mode setup<\/span>/);
  assert.match(updateShell.panelInnerHtml, /<span>intent ready-to-run<\/span>/);
  assert.match(updateShell.panelInnerHtml, /<span>blocks 3<\/span>/);
  assert.match(updateShell.panelInnerHtml, /<span>state ready<\/span>/);
  assert.doesNotMatch(updateShell.panelInnerHtml, /triggers|has-selection|has-source/);

  observability.syncLabDebugPanel(quietShell as unknown as HTMLElement);
  assert.equal(quietShell.panelRemoved, true);
});

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

    assert.equal(observability.queryRegion(root as unknown as ParentNode, ['[data-lab-region="topbar"]']), topbar);
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

void test("laboratory shell persists workspace-facing state and exposes tool lifecycle controls", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const toolOverlaySource = readFileSync("rooms/laboratory/ui/tool-management-overlay.ts", "utf8");
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const workspaceSourceIntakeSource = readFileSync(
    "rooms/laboratory/ui/workspace-source-intake.ts",
    "utf8"
  );
  const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
  const drawerResultExploreSource = readFileSync(
    "rooms/laboratory/ui/lab-drawer-result-explore.ts",
    "utf8"
  );
  const sourcePanelSource = readFileSync("rooms/laboratory/ui/lab-source-panel.ts", "utf8");
  const topBarSource = readFileSync("rooms/laboratory/ui/lab-top-bar.ts", "utf8");

  assert.match(labRootSource, /schemaVersion:\s*4,/);
  assert.match(
    labRootSource,
    /analysisPrepExpandedCapabilityIds:\s*_analysisPrepExpandedCapabilityIds,\s*\.\.\.workspace/
  );
  assert.match(labRootSource, /workspace,/);
  assert.match(
    labRootSource,
    /state\.run\.state === "running" \|\| state\.run\.state === "queued"/
  );
  assert.match(toolOverlaySource, /mediaAnalysis\.toolManager\.ariaLabel/);
  assert.match(toolOverlaySource, /data-lab-action="tool-check-all-updates"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-update-selected"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-install-review"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-install-confirm"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-job-cancel"/);
  assert.doesNotMatch(drawerSource, /renderSourceIntake\(state, copy\)/);
  assert.doesNotMatch(drawerSource, /renderLabProjectAssetsPanel/);
  assert.equal(existsSync("rooms/laboratory/ui/lab-project-assets-panel.ts"), false);
  assert.equal(existsSync("rooms/laboratory/ui/project-navigation.ts"), false);
  assert.equal(existsSync("rooms/laboratory/ui/asset-grid.ts"), false);
  assert.equal(existsSync("rooms/laboratory/ui/project-workspace-overlay.ts"), false);
  assert.match(sourcePanelSource, /renderProjectImportProgress\(state, copy\)/);
  assert.match(sourcePanelSource, /data-lab-field="project\.id"/);
  assert.doesNotMatch(labRootSource, /projectWorkspace|renderProjectWorkspaceOverlay/);
  assert.match(topBarSource, /data-lab-field="workspace\.hypothesis"/);
  assert.match(drawerResultExploreSource, /data-lab-action="run-deep-analysis"/);
  assert.match(drawerSource, /buildAnalysisPreviewSentence\(state\)/);
  assert.match(drawerResultExploreSource, /getLaboratoryRightPanelContext/);
  assert.doesNotMatch(
    drawerResultExploreSource,
    /buildExecutionBridge|formatDecisionCoherenceAdvisory|formatExecutionReadinessSignalAdvisory|getActiveExecutionAlternatives|data-lab-drawer-alternatives/
  );
  assert.match(workspaceSourceIntakeSource, /Source setup controls/);
  assert.doesNotMatch(workspaceSurfaceSource, /renderLabTopbarActions\(state, copy\)/);
  assert.doesNotMatch(workspaceSurfaceSource, /renderGlobalProcessSummary\(state, copy\)/);
});

void test("laboratory center workbench attaches media viewport and timeline as one surface", () => {
  const labTypesSource = readFileSync("rooms/laboratory/domain/lab-types.ts", "utf8");
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const workspaceSourceIntakeSource = readFileSync(
    "rooms/laboratory/ui/workspace-source-intake.ts",
    "utf8"
  );
  const laboratoryLayoutSource = readFileSync("rooms/laboratory/ui/laboratory-layout.ts", "utf8");
  const centerPanelSource = readFileSync("rooms/laboratory/ui/lab-center-panel.ts", "utf8");
  const topBarSource = readFileSync("rooms/laboratory/ui/lab-top-bar.ts", "utf8");
  const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
  const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
  const timelineSource = readLabWaveformTimelineSource();
  const themeSource = readLabThemeSource();

  assert.match(labTypesSource, /export type LabPipelineBlock = \{/);
  assert.match(labTypesSource, /type: "section" \| "action" \| "status" \| "output";/);
  assert.match(laboratoryLayoutSource, /export function renderLaboratoryLayout/);
  assert.match(laboratoryLayoutSource, /export function renderMainStage/);
  assert.doesNotMatch(laboratoryLayoutSource, /export function renderLeftRail/);
  assert.match(laboratoryLayoutSource, /export function renderPreviewArea/);
  assert.match(laboratoryLayoutSource, /export function renderTimelineArea/);
  assert.match(laboratoryLayoutSource, /export function renderPipeline/);
  assert.match(laboratoryLayoutSource, /function getPipelineDebugShell\(/);
  assert.match(laboratoryLayoutSource, /\[lab\]\[pipeline\]/);
  assert.match(laboratoryLayoutSource, /data-block-id="\$\{escapeHtml\(block\.id\)\}"/);
  assert.match(laboratoryLayoutSource, /data-block-type="\$\{escapeHtml\(block\.type\)\}"/);
  assert.match(laboratoryLayoutSource, /data-block-mode="\$\{escapeHtml\(mode\)\}"/);
  assert.match(laboratoryLayoutSource, /export function renderContextPanel/);
  assert.match(laboratoryLayoutSource, /export function renderInspectorPanel/);
  assert.match(centerPanelSource, /renderMainStage\(surface\.main\)/);
  assert.match(
    laboratoryLayoutSource,
    /class="labx-center-panel labx-main-stage" data-lab-region="main-stage"/
  );
  assert.match(topBarSource, /class="labx-top-bar" data-lab-region="topbar"/);
  assert.match(topBarSource, /export function renderLabLeftRail/);
  assert.match(topBarSource, /class="labx-top-bar__center labx-top-bar__center--empty"/);
  assert.doesNotMatch(
    topBarSource,
    /class="labx-top-bar__center" data-lab-region="left-rail-source"/
  );
  assert.doesNotMatch(laboratoryLayoutSource, /data-lab-region="left-rail-source"/);
  assert.match(drawerSource, /renderContextPanel/);
  assert.match(drawerSource, /if \(collapsed\) \{[\s\S]*renderContextPanel\(\{[\s\S]*hidden: true/);
  assert.match(
    laboratoryLayoutSource,
    /class="labx-drawer labx-context-panel" data-lab-region="context-panel"/
  );
  assert.match(laboratoryLayoutSource, /data-empty="\$\{empty\}"/);
  assert.match(processStripSource, /data-lab-region="process-strip"/);
  assert.match(workspaceSurfaceSource, /class="labx-media-workbench"/);
  assert.match(workspaceSurfaceSource, /data-lab-region="main-stage-inner"/);
  assert.match(workspaceSurfaceSource, /renderPreviewArea\(/);
  assert.match(
    workspaceSurfaceSource,
    /renderTimelineArea\(durationMs > 0 && !comparisonPreviewActive \? renderLabWaveformTimeline\(timelineModel\) : ""\)/
  );
  assert.match(workspaceSurfaceSource, /renderInspectorPanel\(/);
  assert.match(
    workspaceSurfaceSource,
    /panels\.length === 0[\s\S]*renderInspectorPanel\(\{[\s\S]*empty: true,[\s\S]*hidden: true/
  );
  assert.match(laboratoryLayoutSource, /data-lab-region="preview-area"/);
  assert.match(laboratoryLayoutSource, /data-lab-region="inspector-panel"/);
  assert.match(laboratoryLayoutSource, /data-timeline-empty="true"/);
  assert.match(laboratoryLayoutSource, /hidden aria-hidden="true"/);
  assert.match(workspaceSurfaceSource, /class="labx-workspace-stage"/);
  assert.match(workspaceSurfaceSource, /renderWorkspaceInspectorDrawer/);
  assert.match(laboratoryLayoutSource, /data-lab-workspace-inspector="true"/);
  assert.match(workspaceSurfaceSource, /data-lab-action="workspace-controls-drawer-toggle"/);
  assert.match(workspaceSurfaceSource, /data-lab-action="workspace-controls-tab-select"/);
  assert.doesNotMatch(drawerSource, /renderDrawerWorkspaceControls/);
  assert.doesNotMatch(drawerSource, /data-lab-drawer-workspace-controls="true"/);
  assert.match(workspaceSurfaceSource, /data-lab-media-workbench="true"/);
  assert.doesNotMatch(laboratoryLayoutSource, /data-preview-mode/);
  assert.doesNotMatch(workspaceSurfaceSource, /data-preview-mode/);
  assert.match(workspaceSurfaceSource, /data-lab-workspace-comparison-stage="true"/);
  assert.match(
    workspaceSurfaceSource,
    /data-lab-workspace-comparison-stage="true"[\s\S]*data-lab-selection-roi-stage="true"/
  );
  assert.match(workspaceSurfaceSource, /renderMediaStage\("primary"/);
  assert.match(workspaceSurfaceSource, /renderMediaStage\("reference"/);
  assert.match(workspaceSurfaceSource, /renderComparisonOverlay\(side\)/);
  assert.match(workspaceSurfaceSource, /buildPreviewFilterState\(input\.settings\.primary/);
  assert.match(workspaceSurfaceSource, /buildPreviewFilterState\(input\.settings\.reference/);
  assert.match(workspaceSurfaceSource, /data-lab-comparison-roi-side="\$\{side\}"/);
  assert.match(workspaceSurfaceSource, /data-active="\$\{getActiveFlag\(side\)\}"/);
  assert.match(workspaceSurfaceSource, /data-active-side="\$\{input\.activeSide\}"/);
  assert.match(workspaceSurfaceSource, /data-lab-preserve-media="workspace-comparison-primary"/);
  assert.match(workspaceSurfaceSource, /data-lab-preserve-media="workspace-comparison-reference"/);
  assert.match(
    workspaceSourceIntakeSource,
    /const controls = options\.controls === true \? "controls" : "";/
  );
  assert.match(workspaceSurfaceSource, /data-lab-selection-roi-controls-reserve="0"/);
  assert.match(timelineSource, /data-lab-action="timeline-toggle-playback"/);
  assert.match(
    timelineSource,
    /class="labx-timeline labx-timeline-area\$\{focusClassName\}" id="lab-timeline" data-lab-region="timeline-area"/
  );
  assert.match(timelineSource, /data-lab-role="timeline-volume"/);
  assert.match(timelineSource, /data-lab-role="timeline-bookmark-note"/);
  assert.match(timelineSource, /data-lab-action="timeline-add-bookmark"/);
  assert.match(timelineSource, /data-lab-action="timeline-remove-bookmark"/);
  assert.match(timelineSource, /labx-timeline__pin-popover/);
  assert.match(timelineSource, /transportVolume/);
  assert.doesNotMatch(timelineSource, /labx-timeline__range-info/);
  assert.doesNotMatch(timelineSource, /labx-timeline__numeric/);
  assert.doesNotMatch(timelineSource, /Start \(ms\)|End \(ms\)/);
  assert.doesNotMatch(themeSource, /\.labx-timeline__numeric/);
  assert.match(
    themeSource,
    /\.labx-shell\[data-lab-debug-regions="true"\] \[data-lab-region\]\s*\{/
  );
  assert.match(themeSource, /\.labx-pipeline-block\s*\{\s*display:\s*block;/);
  assert.match(
    themeSource,
    /\.labx-shell\[data-lab-debug-regions="true"\] \.labx-pipeline-block\s*\{[\s\S]*outline:\s*var\(--lab-shell-px-1\) dashed var\(--lab-shell-color-11\);/
  );
  const debugPanelRule =
    themeSource.match(
      /\.labx-shell\[data-lab-debug-regions="true"\] \.labx-debug-panel\s*\{([\s\S]*?)\}/
    )?.[1] ?? "";
  assert.match(debugPanelRule, /position:\s*(absolute|fixed);/);
  assert.match(debugPanelRule, /pointer-events:\s*none;/);
  assert.doesNotMatch(debugPanelRule, /grid-area:/);
  assert.doesNotMatch(debugPanelRule, /margin:/);
  assert.doesNotMatch(themeSource, /^\.labx-pipeline-block\s*\{[^}]*outline:/m);
  assert.match(
    themeSource,
    /\.labx-drawer\[hidden\],[\s\S]*\.labx-workspace-inspector\[hidden\]\s*\{[\s\S]*display:\s*none;/
  );
  assert.match(themeSource, /\[data-lab-region="topbar"\]/);
  assert.match(themeSource, /\[data-lab-region="main-stage-inner"\]/);
  assert.match(themeSource, /\[data-lab-region="process-strip"\]/);
  assert.doesNotMatch(themeSource, /^\[data-lab-region\]\s*\{/m);
  assert.doesNotMatch(workspaceSurfaceSource, /renderWorkspaceBookmarks|workspace-bookmarks/);
  assert.match(
    workspaceSurfaceSource,
    /class="labx-workspace-stage"[\s\S]*class="labx-media-workbench"[\s\S]*renderPreviewArea\(\{ content: previewMarkup, focusClassName: previewFocusClassName \}\)[\s\S]*renderTimelineArea\(durationMs > 0 && !comparisonPreviewActive \? renderLabWaveformTimeline\(timelineModel\) : ""\)/
  );
  assert.match(workspaceSurfaceSource, /renderCapabilityCard\([\s\S]*\{ hideTitle: true \}/);
  assert.doesNotMatch(
    workspaceSurfaceSource,
    /class="labx-workspace-stage"[\s\S]*\$\{inspectorMarkup\}/
  );
  assert.match(
    workspaceSurfaceSource,
    /return \{ inspector: inspectorMarkup, main, side: selectionPanelMarkup \};/
  );
  assert.doesNotMatch(workspaceSurfaceSource, /renderWorkspaceHypothesis/);
  assert.match(
    themeSource,
    /\.labx-media-workbench\s*\{[\s\S]*gap:\s*0;[\s\S]*min-height:\s*0;[\s\S]*border:\s*var\(--lab-workspace-px-1\) solid var\(--lab-border-default\);[\s\S]*border-radius:\s*var\(--lab-radius-lg\);/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-preview\s*\{[\s\S]*min-height:\s*0;[\s\S]*height:\s*100%;[\s\S]*border:\s*var\(--lab-workspace-px-1\) solid transparent;[\s\S]*border-radius:\s*0;[\s\S]*box-shadow:\s*none;/
  );
  assert.match(
    themeSource,
    /\.labx-focus-primary,[\s\S]*\.labx-focus-secondary,[\s\S]*\.labx-focus-passive\s*\{[\s\S]*opacity var\(--lab-duration-base\) var\(--lab-ease-out\),[\s\S]*filter var\(--lab-duration-base\) var\(--lab-ease-out\),[\s\S]*box-shadow var\(--lab-duration-base\) var\(--lab-ease-out\);/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-preview\.labx-focus-primary\s*\{[\s\S]*border:\s*var\(--lab-workspace-px-1\) solid var\(--lab-accent\);[\s\S]*box-shadow:[\s\S]*0 0 0 var\(--lab-workspace-px-1\) var\(--lab-accent-soft\),[\s\S]*var\(--lab-glow-accent\);/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-preview\.labx-focus-passive\s*\{[\s\S]*opacity:\s*0\.85;[\s\S]*filter:\s*brightness\(0\.85\);/
  );
  assert.match(themeSource, /\.labx-timeline\.labx-focus-secondary\s*\{[\s\S]*opacity:\s*1;/);
  assert.match(themeSource, /\.labx-timeline\.labx-focus-passive\s*\{[\s\S]*opacity:\s*0\.7;/);
  assert.match(
    themeSource,
    /\.labx-timeline\[hidden\],[\s\S]*\.labx-timeline-area--empty\s*\{[\s\S]*display:\s*none;/
  );
  assert.match(
    themeSource,
    /\.labx-timeline\[data-timeline-locked="true"\]\.labx-focus-secondary\s*\{[\s\S]*opacity:\s*1;/
  );
  assert.match(
    themeSource,
    /\.labx-timeline\[data-timeline-locked="true"\]\.labx-focus-passive\s*\{[\s\S]*opacity:\s*0\.7;/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-inspector\.labx-focus-secondary\s*\{[\s\S]*opacity:\s*1;/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-inspector\.labx-focus-passive\s*\{[\s\S]*opacity:\s*0\.5;/
  );
  assert.match(
    themeSource,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*transition:\s*none;/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-stage\s*\{[\s\S]*position:\s*relative;[\s\S]*flex:\s*1 1 auto;[\s\S]*min-height:\s*0;/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-inspector\s*\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*1;[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-inspector\[data-open="false"\]\s*\.labx-workspace-inspector__body\s*\{[\s\S]*display:\s*none;/
  );
  assert.doesNotMatch(themeSource, /\.labx-audio-focus__header\s*\{/);
  assert.match(
    themeSource,
    /\.labx-media-workbench\s*>\s*\.labx-timeline\s*\{[\s\S]*padding:\s*0 0 var\(--lab-workspace-rem-0-45\);[\s\S]*border-width:\s*0;[\s\S]*border-radius:\s*0;[\s\S]*box-shadow:\s*none;/
  );
  assert.match(
    themeSource,
    /\.labx-timeline__track\s*\{[\s\S]*height:\s*var\(--lab-workspace-rem-3-5\);/
  );
  assert.match(themeSource, /\.labx-timeline__controls\s*\{[\s\S]*display:\s*grid;/);
  assert.match(themeSource, /\.labx-timeline__controls-row\s*\{[\s\S]*flex-wrap:\s*nowrap;/);
  assert.match(themeSource, /\.labx-timeline__transport\s*\{/);
  assert.match(themeSource, /\.labx-timeline__volume\s*\{/);
  assert.match(themeSource, /\.labx-timeline__speed\s*\{/);
  assert.match(themeSource, /\.labx-timeline__bookmark\s*\{/);
  assert.match(themeSource, /\.labx-timeline__selection-group\s*\{/);
  assert.match(
    themeSource,
    /\.labx-timeline__pin-popover\s*\{[\s\S]*bottom:\s*calc\(100% \+ var\(--lab-timeline-roi-rem-0-35\)\);/
  );
  assert.match(themeSource, /\.labx-timeline__pin-remove\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-timeline__range-info\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-bookmarks\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-timeline__header\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-timeline__sync\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-dual-preview-transport\s*\{/);
  assert.match(
    themeSource,
    /\.labx-media-workbench \.labx-preview-media--workspace-video,[\s\S]*\.labx-media-workbench \.labx-preview-media--workspace-image\s*\{[\s\S]*height:\s*100%;[\s\S]*max-height:\s*100%;/
  );
  assert.match(
    themeSource,
    /\.labx-preview-filter-wrap\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*overflow:\s*hidden;/
  );
  assert.match(
    themeSource,
    /\.labx-channel-filter\s*\{[\s\S]*position:\s*absolute;[\s\S]*width:\s*0;[\s\S]*height:\s*0;[\s\S]*overflow:\s*hidden;[\s\S]*pointer-events:\s*none;/
  );
  assert.match(
    themeSource,
    /\.labx-preview-filter-wrap\s*>\s*\.labx-preview-media--workspace-video\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*height:\s*100%;[\s\S]*object-fit:\s*contain;/
  );
});

void test("laboratory process strip owns heartbeat and expanded runtime detail rendering", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
  const themeSource = readLabThemeSource();

  assert.match(labRootSource, /processStripHeartbeatInterval/);
  assert.match(labRootSource, /setInterval\(function \(\) \{\s*render\(\);/);
  assert.match(labRootSource, /shell\.dataset\["processView"\]/);
  assert.match(processStripSource, /data-lab-process-expanded="true"/);
  assert.match(processStripSource, /class="labx-strip-detail-toggle"/);
  assert.doesNotMatch(processStripSource, /class="labx-strip-expand"/);
  assert.doesNotMatch(processStripSource, /class="labx-strip-cancel"/);
  assert.match(processStripSource, /getUserActions\(state\)\.slice\(0, 5\)/);
  assert.match(processStripSource, /state\.run\?\.rawLog/);
  assert.match(
    themeSource,
    /\.labx-shell\[data-process-view="expanded"\]\s*\{[\s\S]*grid-template-rows:\s*var\(--lab-topbar-height\)\s+minmax\(\s*0,\s*1fr\s*\)\s+var\(--lab-shell-px-200\);/
  );
  assert.match(
    themeSource,
    /\.labx-process-strip\s*\{[\s\S]*flex-direction:\s*column;[\s\S]*height:\s*100%;/
  );
  assert.match(
    themeSource,
    /\.labx-strip-expanded\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0, 35fr\) minmax\(0, 65fr\);[\s\S]*background:\s*var\(--lab-surface-1\);/
  );
  assert.match(
    themeSource,
    /\.labx-strip-expanded section\s*\{[\s\S]*background:\s*var\(--lab-status-shell-color-06\);/
  );
  assert.match(
    themeSource,
    /\.labx-strip-expanded__list li,[\s\S]*\.labx-strip-expanded__log li\s*\{[\s\S]*background:\s*var\(--lab-status-shell-color-08\);/
  );
  assert.match(
    themeSource,
    /\.labx-strip-expanded__log li\s*\{[\s\S]*font-family:\s*var\(--lab-font-mono\);[\s\S]*line-height:\s*var\(--lab-leading-snug\);[\s\S]*white-space:\s*normal;/
  );
});

void test("laboratory theme defines the multi-region shell grid and drawer layout contract", () => {
  const baseSource = readFileSync("rooms/laboratory/ui/styles/base.css", "utf8");
  const themeSource = readLabThemeSource();
  const sourceImportSource = readFileSync(
    "rooms/laboratory/ui/styles/lab-source-import.css",
    "utf8"
  );

  const tokenSource = readFileSync("rooms/laboratory/ui/styles/lab-tokens.css", "utf8");

  assert.match(baseSource, /@import "\.\/lab-tokens\.css";/);
  assert.match(baseSource, /@import "\.\/lab-primitives\.css";/);
  assert.match(tokenSource, /--labx-bg-main:\s*var\(--lab-surface-1\);/);
  assert.match(tokenSource, /--labx-bg-elevated:\s*var\(--lab-surface-2\);/);
  assert.match(tokenSource, /--labx-text-primary:\s*var\(--lab-text-strong\);/);
  assert.match(tokenSource, /--labx-text-muted:\s*var\(--lab-text-dim\);/);
  assert.match(tokenSource, /--labx-danger:\s*var\(--lab-error\);/);
  assert.match(
    themeSource,
    /\.labx-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(var\(--lab-shell-rem-14\), var\(--lab-shell-rem-18\)\)\s+minmax\(\s*0,\s*1fr\s*\)\s+minmax\(var\(--lab-shell-rem-18\), var\(--lab-shell-rem-24\)\);[\s\S]*grid-template-rows:\s*var\(--lab-topbar-height\)\s+minmax\(\s*0,\s*1fr\s*\)\s+var\(--lab-strip-height\);/
  );
  assert.match(
    themeSource,
    /\.labx-shell\s*\{[\s\S]*grid-template-areas:\s*"topbar topbar\s+topbar"\s*"panel\s+center\s+context"\s*"panel\s+strip\s+context";/
  );
  assert.match(
    themeSource,
    /\.labx-shell\[data-source-panel-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*0\s+minmax\(\s*0,\s*1fr\s*\)\s+minmax\(var\(--lab-shell-rem-18\), var\(--lab-shell-rem-24\)\);/
  );
  assert.match(
    themeSource,
    /\.labx-shell\[data-drawer-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(var\(--lab-shell-rem-14\), var\(--lab-shell-rem-18\)\)\s+minmax\(\s*0,\s*1fr\s*\)\s+0;/
  );
  assert.match(
    themeSource,
    /\.labx-shell\[data-source-panel-collapsed="true"\]\[data-drawer-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*0\s+minmax\(\s*0,\s*1fr\s*\)\s+0;/
  );
  assert.doesNotMatch(themeSource, /\.labx-drawer--collapsed/);
  assert.doesNotMatch(themeSource, /\.labx-drawer__expand-btn/);
  assert.match(themeSource, /\.labx-center-skeleton__label\s*\{/);
  assert.match(themeSource, /\.labx-boot-overlay\s*\{[\s\S]*pointer-events:\s*auto;/);
  assert.match(
    themeSource,
    /\.labx-boot-panel\s*\{[\s\S]*border-radius:\s*var\(--lab-radius-lg\);/
  );
  assert.match(themeSource, /@keyframes labx-skeleton-breathe/);
  assert.doesNotMatch(themeSource, /\.labx-shell\[data-ready="false"\]::after/);
  assert.doesNotMatch(themeSource, /\.labx-shell\[data-ready="false"\]\s+\.labx-center-panel/);
  assert.doesNotMatch(themeSource, /labx-boot-breathe/);
  assert.match(
    themeSource,
    /\.labx-top-bar\s*\{\s*grid-area:\s*topbar;\s*\}[\s\S]*\.labx-source-panel\s*\{\s*grid-area:\s*panel;\s*\}[\s\S]*\.labx-center-panel\s*\{\s*grid-area:\s*center;\s*\}[\s\S]*\.labx-drawer\s*\{\s*grid-area:\s*context;\s*\}[\s\S]*\.labx-process-strip\s*\{\s*grid-area:\s*strip;\s*\}/
  );
  assert.doesNotMatch(themeSource, /\.labx-shell\[data-layout-kind="import-only"\]/);
  assert.doesNotMatch(sourceImportSource, /\.labx-import-/);
  assert.doesNotMatch(sourceImportSource, /\.labx-strategy-/);
  assert.doesNotMatch(sourceImportSource, /\.labx-pw-/);
  assert.doesNotMatch(sourceImportSource, /\.labx-import-review/);
  assert.match(
    sourceImportSource,
    /\.labx-project-import__youtube-preview\s*\{[\s\S]*display:\s*grid;/
  );
  assert.match(sourceImportSource, /\.labx-project-import__progress\s*\{[\s\S]*display:\s*grid;/);
  assert.match(
    sourceImportSource,
    /\.labx-project-import__yt-controls\s*\{[\s\S]*display:\s*grid;/
  );
  assert.match(
    sourceImportSource,
    /\.labx-project-import__yt-field\s*\{[\s\S]*grid-template-columns:\s*minmax\(var\(--lab-source-import-rem-7-5\), 0\.42fr\) minmax\(0, 1fr\);/
  );
  assert.doesNotMatch(sourceImportSource, /\.labx-advanced-settings/);
});

void test("laboratory micro inspection UI exposes roi focus precedence and lens affordances in the preview shell", () => {
  const overlaySource = readFileSync("rooms/laboratory/ui/workspace-roi-overlay.ts", "utf8");
  const surfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const timelineSelectionSource = readFileSync(
    "rooms/laboratory/ui/timeline/timeline-selection.ts",
    "utf8"
  );

  assert.match(
    overlaySource,
    /data-lab-selection-roi="true"[\s\S]*data-lab-selection-roi-ignore="true"/
  );
  assert.doesNotMatch(overlaySource, /labx-roi-selection-toolbar/);
  assert.doesNotMatch(overlaySource, /data-lab-selection-inspection-mode=/);
  assert.match(timelineSelectionSource, /data-lab-selection-roi-focus-toggle="true"/);
  assert.match(timelineSelectionSource, /data-lab-selection-roi-capture="true"/);
  assert.match(surfaceSource, /data-lab-preview-inspection-stage="true"/);
  assert.match(surfaceSource, /data-lab-preview-inspection-content="true"/);
  assert.match(timelineSelectionSource, /Selection micro zoom/);
  assert.match(timelineSelectionSource, /model\.selectionMicroZoomOpen !== true/);
  assert.match(timelineSelectionSource, /id="lab-audio-viz-inspection"/);
});

void test("laboratory selection preview exposes soft execution intent affordances without run semantics", () => {
  const timelineSelectionSource = readFileSync(
    "rooms/laboratory/ui/timeline/timeline-selection.ts",
    "utf8"
  );

  assert.match(timelineSelectionSource, /Selected action/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-accept=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-dismiss=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-queue=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-clear="true"/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.actionSelected/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.wantThis/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.notNow/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.queueForLater/);
  assert.doesNotMatch(timelineSelectionSource, />Run</);
});

void test("laboratory execution detail helper panels are removed from the selection timeline surface", () => {
  const timelineSource = readLabWaveformTimelineSource();
  const rootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const binderSource = readFileSync(
    "rooms/laboratory/ui/lab-selection-suggestion-binder.ts",
    "utf8"
  );
  const drawerResultExploreSource = readFileSync(
    "rooms/laboratory/ui/lab-drawer-result-explore.ts",
    "utf8"
  );
  const themeSource = readLabThemeSource();

  const removedTimelinePatterns = [
    /data-lab-execution-plan/,
    /data-lab-execution-simulation/,
    /data-lab-execution-readiness/,
    /data-lab-execution-payload-preview/,
    /data-lab-execution-reflection/,
    /data-lab-execution-alternatives/,
    /data-lab-execution-candidate/,
    /data-lab-execution-commitment/,
    /data-lab-execution-staging/,
    /data-lab-execution-details/,
    /renderExecutionPlan/,
    /renderExecutionSimulation/,
    /renderExecutionReadiness/,
    /renderExecutionPayloadPreview/,
    /renderExecutionReflection/,
    /renderExecutionAlternatives/,
    /renderExecutionCandidate/,
    /renderExecutionCommitment/,
    /renderExecutionStaging/,
    /renderCollapsibleExecutionPanel/,
    /executionPanels/,
    /executionDetails/,
  ];

  removedTimelinePatterns.forEach(function (pattern) {
    assert.doesNotMatch(timelineSource, pattern);
  });

  assert.match(timelineSource, /renderExecutionIntentStrip/);
  assert.match(timelineSource, /renderSuggestionPreview/);
  assert.match(binderSource, /data-lab-execution-intent-accept/);
  assert.match(binderSource, /data-lab-execution-intent-dismiss/);
  assert.match(binderSource, /data-lab-execution-intent-queue/);
  assert.match(binderSource, /data-lab-execution-intent-clear/);
  assert.doesNotMatch(
    binderSource,
    /data-lab-execution-commitment-set|workspace-execution-commitment-set|data-lab-execution-commitment-revoke|workspace-execution-commitment-revoked/
  );
  assert.doesNotMatch(
    rootSource,
    /data-lab-execution-details-open|activeOverlay|collapsedPanels|createLabExecutionDispatcher|getExecutionDispatchCandidate/
  );
  assert.doesNotMatch(
    drawerResultExploreSource,
    /buildExecutionBridge|data-lab-drawer-alternatives|formatDecisionCoherenceAdvisory|formatExecutionReadinessSignalAdvisory|getActiveExecutionAlternatives/
  );
  assert.doesNotMatch(
    themeSource,
    /lab-execution-collapsible|lab-execution-details|lab-execution-plan|lab-execution-simulation|lab-execution-readiness|lab-execution-payload|lab-execution-reflection|lab-execution-candidate|lab-execution-commitment|lab-execution-staging/
  );
});

void test("laboratory accepted selection renders selected action feedback without helper panels", () => {
  const markup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionIntent: {
        id: "audio-inspect",
        label: "Inspect audio",
        actionType: "inspect-audio",
        confidence: 0.82,
      },
      activeSuggestionPreview: null,
      selectionSuggestions: [],
    })
  );

  assert.match(markup, /Selected action/);
  assert.match(markup, /Inspect audio/);
  assert.match(markup, /data-lab-execution-intent-clear="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-plan="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-simulation="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-readiness="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-payload-preview="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-reflection="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-alternatives="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-candidate="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-commitment="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-staging="true"/);
  assert.doesNotMatch(markup, /data-lab-execution-details-overlay="true"/);
  assert.doesNotMatch(markup, /Simulation preview|Execution payload|Execution candidate/);
});

void test("laboratory phase 4.95 renders room-local selection labels without execution detail copy", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8")) as Record<string, unknown>;
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8")) as Record<string, unknown>;
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
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8")) as Record<string, unknown>;
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8")) as Record<string, unknown>;
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
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8")) as Record<string, unknown>;
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8")) as Record<string, unknown>;
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

void test("laboratory process layer is single-source and old right panel is retired", () => {
  const surfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
  const drawerResultExploreSource = readFileSync(
    "rooms/laboratory/ui/lab-drawer-result-explore.ts",
    "utf8"
  );
  const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
  const themeSource = readLabThemeSource();

  assert.doesNotMatch(surfaceSource, /data-lab-global-process="true"/);
  assert.doesNotMatch(surfaceSource, /renderWorkspaceProcessPanel/);
  assert.equal(existsSync("rooms/laboratory/ui/workspace-process-panel.ts"), false);
  assert.match(drawerResultExploreSource, /getLaboratoryRightPanelContext/);
  assert.match(processStripSource, /getLaboratoryProcessSummary/);
  assert.doesNotMatch(drawerSource, /labx-process-panel/);
  assert.doesNotMatch(themeSource, /labx-process-panel|labx-intent-map|labx-output-trace/);
});
