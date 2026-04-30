import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderLabWaveformTimeline } from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import { getLabLayoutKind, renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderProjectWorkspaceOverlay } from "../../rooms/laboratory/ui/project-workspace-overlay.ts";
import {
  renderYoutubeImportWorkspace,
  renderYoutubeImportWorkspaceMarkup,
} from "../../rooms/laboratory/ui/youtube-import-workspace.ts";
import { createMockExecutionResult } from "../../rooms/laboratory/runtime/lab-execution-dispatcher.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import {
  getActiveExecutionCandidate,
  getExecutionDispatchCandidate,
  getWaveformTimelineModel,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";
import {
  formatLabExpectedOutputLabel,
  formatLabUserActionDisplayText,
  translateLabRuntimeText,
} from "../../rooms/laboratory/ui/lab-runtime-i18n.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";

class ElementStub {
  innerHTML = "";
  scrollTop = 0;
  dataset: Record<string, string> = {};
  classList = {
    add() {},
    remove() {},
    toggle() {},
  };

  querySelector(): null {
    return null;
  }

  querySelectorAll(): [] {
    return [];
  }

  addEventListener(): void {}

  removeEventListener(): void {}

  replaceChildren(): void {}
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
          delay: Number(delay) || 0,
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
        timer.callback();
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
  mountedQueriesEnabled = false;

  override querySelector(selector: string): MountedQueryElement | null {
    if (this.mountedQueriesEnabled !== true) {
      return null;
    }
    if (selector === ".labx-shell" && this.innerHTML.includes('class="labx-shell"')) {
      return new MountedQueryElement(this, selector);
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

  setAttribute(): void {}

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

function createMountedLaboratoryTransitionEnvironment() {
  const runtimeRoot = new MountedRootElement();
  const listeners = new Map<string, (event: Event) => void>();
  let readyPayload: Record<string, unknown> | null = null;
  let timerId = 1;
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
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      clearTimeout() {},
      localStorage: {
        getItem(key: string) {
          return storage.get(key) ?? null;
        },
        setItem(key: string, value: string) {
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
    },
  });

  return {
    listener(type: string) {
      return listeners.get(type);
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

function createExecutionReadinessTimelineModel(
  overrides: Record<string, unknown> = {}
): Parameters<typeof renderLabWaveformTimeline>[0] {
  return {
    activeSelection: {
      id: "selection-1",
      startMs: 1000,
      endMs: 3000,
      type: "clip",
      intent: "audio",
      createdAt: 1,
    },
    bookmarks: [],
    dualPreviewActive: false,
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

function extractCandidatePanelMarkup(markup: string) {
  const attrIndex = markup.indexOf('data-lab-execution-candidate="true"');
  assert.notEqual(attrIndex, -1);
  const start = markup.lastIndexOf('<div class="lab-execution-candidate"', attrIndex);
  let end = markup.indexOf('<div class="lab-execution-commitment', attrIndex);
  if (end === -1) {
    end = markup.indexOf('<div class="lab-interpretation-panel"', attrIndex);
  }
  if (end === -1) {
    end = markup.indexOf('<div\n            class="labx-timeline__selection', attrIndex);
  }
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

function extractCommitmentPanelMarkup(markup: string) {
  const attrIndex = markup.indexOf('data-lab-execution-commitment="true"');
  assert.notEqual(attrIndex, -1);
  const start = markup.lastIndexOf('<div class="lab-execution-commitment', attrIndex);
  let end = markup.indexOf('<div class="lab-execution-staging"', attrIndex);
  if (end === -1) {
    end = markup.indexOf('<div class="lab-interpretation-panel"', attrIndex);
  }
  if (end === -1) {
    end = markup.indexOf('<div\n            class="labx-timeline__selection', attrIndex);
  }
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

function extractStagingPanelMarkup(markup: string) {
  const attrIndex = markup.indexOf('data-lab-execution-staging="true"');
  assert.notEqual(attrIndex, -1);
  const start = markup.lastIndexOf('<div class="lab-execution-staging"', attrIndex);
  let end = markup.indexOf('<div class="lab-interpretation-panel"', attrIndex);
  if (end === -1) {
    end = markup.indexOf('<div\n            class="labx-timeline__selection', attrIndex);
  }
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

function extractCollapsibleOpeningTag(markup: string, panelId: string) {
  const match = new RegExp(`<details[\\s\\S]*?data-panel-id="${panelId}"[\\s\\S]*?>`).exec(markup);
  assert.notEqual(match, null, `Expected collapsible panel ${panelId}`);
  return match?.[0] ?? "";
}

function extractExecutionDetailsOverlayMarkup(markup: string) {
  const attrIndex = markup.indexOf('data-lab-execution-details-overlay="true"');
  assert.notEqual(attrIndex, -1);
  const start = markup.lastIndexOf('<div class="lab-execution-details-overlay"', attrIndex);
  const end = markup.indexOf('<div\n            class="labx-timeline__selection', attrIndex);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return markup.slice(start, end);
}

function createPassiveExecutionChainFixture() {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };
  const activeReflection = {
    id: `reflection:${activePlan.id}`,
    planId: activePlan.id,
    summary: "This path appears stable as a passive dry-run decision.",
    decision: "proceed" as const,
    reasoning: ["Readiness and simulation signals align with a stable dry-run path."],
    tradeoffs: ["Audio-focused review can expose signal detail while amplifying preview bias."],
    confidence: 0.82,
  };
  const activeAlternatives = {
    id: `alternatives:${activePlan.id}`,
    planId: activePlan.id,
    summary:
      "The selected path appears stable; alternatives mainly trade precision, coverage, or tempo against that stable baseline.",
    alternatives: [
      {
        actionType: "analyze-segment",
        label: "Broader segment review",
        summary: "An alternative approach would evaluate the full selected window.",
        tradeoff: "This path would trade local clarity for higher contextual coverage.",
        relativeAdvantage: "higher-coverage" as const,
      },
    ],
    comparisonNote:
      "Compared to the selected path, these alternatives can expose different evidence at the cost of changing the current balance.",
    confidence: 0.84,
  };
  const activeCandidate = {
    id: `candidate:${activePlan.id}`,
    planId: activePlan.id,
    status: "viable" as const,
    summary: "This path is structurally ready for execution.",
    structuralIntegrity: "complete" as const,
    readinessStatus: "ready" as const,
    reflectionDecision: "proceed" as const,
    notes: ["Payload preview is structurally aligned with the readiness signal."],
    confidence: 0.87,
  };
  const activeCommitment = {
    id: `commitment:${activePlan.id}`,
    planId: activePlan.id,
    status: "committed" as const,
    candidateStatus: "viable" as const,
    summary: "This path has been consciously chosen as the current passive commitment.",
    committedAt: 1,
    notes: activeCandidate.notes,
    uncertainties: ["Alternative paths still trade precision for coverage."],
    confidence: 0.87,
  };
  const activeStaging = {
    id: `staging:${activePlan.id}`,
    planId: activePlan.id,
    status: "staged" as const,
    summary: "This path is prepared and can be staged for execution.",
    commitmentStatus: "committed" as const,
    candidateStatus: "viable" as const,
    readinessStatus: "ready" as const,
    notes: ["Alternative paths remain visible for comparison before staging."],
    warnings: ["Candidate uncertainty: Alternative paths still trade precision for coverage."],
    confidence: 0.88,
  };

  return {
    activeAlternatives,
    activeCandidate,
    activeCommitment,
    activePayload,
    activePlan,
    activeReadiness,
    activeReflection,
    activeSimulation,
    activeStaging,
  };
}

function createCompletedAudioExecutionStore() {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "local",
      storedPath: "/tmp/source.wav",
      metadata: {
        durationSeconds: 4,
      },
    },
  });
  store.dispatch({
    type: "source-probe-completed",
    action: "probe",
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  const activeCandidate = getActiveExecutionCandidate(store.getState());
  assert.ok(activeCandidate);
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: activeCandidate.planId,
  });
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(dispatchCandidate);
  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result: createMockExecutionResult(dispatchCandidate),
  });
  return store;
}

test("laboratory UI shell evaluates under minimal runtime stubs", async () => {
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

test("laboratory boot overlay unlocks from local ready without a room API bridge", async () => {
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
    assert.match(environment.runtimeRoot.innerHTML, /data-overlay="project-workspace"/);
  } finally {
    await buildArtifact.cleanup();
    environment.restore();
  }
});

test("laboratory boot overlay waits for host data when a room API bridge exists", async () => {
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

test("laboratory boot overlay fallback waits for idle before unlocking bridge loads", async () => {
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

test("laboratory shell routes host traffic through lab-root orchestration seams", () => {
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
  assert.match(labRootSource, /renderLabBootOverlay\(copy\)/);
  assert.match(labRootSource, /getLabLayoutKind\(state, \{/);
  assert.match(labRootSource, /currentLayoutKind !== nextLayoutKind/);
  assert.match(labRootSource, /nextLayoutKind === "import-only"/);
  assert.match(labRootSource, /function syncBootOverlay\(/);
  assert.match(labRootSource, /const BOOT_OVERLAY_SETTLE_MS = 450;/);
  assert.match(labRootSource, /const BOOT_OVERLAY_FALLBACK_READY_MS = 8000;/);
  assert.match(labRootSource, /const BOOT_OVERLAY_FAILSAFE_MS = 20000;/);
  assert.match(labRootSource, /let bootBootstrapSeen = false;/);
  assert.match(labRootSource, /function getBootOverlayBootstrapStatus\(state: LabStoreState\)/);
  assert.match(labRootSource, /function hasRoomReadyBridge\(\)/);
  assert.match(labRootSource, /function requestBootOverlayInteractiveUnlock\(\)/);
  assert.match(labRootSource, /requestIdleCallback/);
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

test("laboratory mounted shell swaps chrome across YouTube import mode transitions", async () => {
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
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-drawer"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-process-strip"/);

    environment.runtimeRoot.mountedQueriesEnabled = true;

    const clickListener = environment.listener("click");
    assert.ok(clickListener);
    clickListener({
      target: new MountedActionElement("analysis-prep-group-toggle", "audio-investigation"),
    } as unknown as Event);
    assert.match(environment.runtimeRoot.innerHTML, /data-lab-value="audio-investigation"/);
    assert.match(
      environment.runtimeRoot.innerHTML,
      /data-lab-value="audio-investigation"[\s\S]*aria-expanded="true"/
    );

    clickListener({
      target: new MountedActionElement("analysis-prep-group-toggle", "audio-investigation"),
    } as unknown as Event);
    assert.match(
      environment.runtimeRoot.innerHTML,
      /data-lab-value="audio-investigation"[\s\S]*aria-expanded="false"/
    );

    const changeListener = environment.listener("change");
    assert.ok(changeListener);
    changeListener({
      target: new MountedSelectElement("source.mode", "youtube"),
    } as unknown as Event);

    assert.match(environment.runtimeRoot.innerHTML, /data-layout-kind="import-only"/);
    assert.match(environment.runtimeRoot.innerHTML, /data-ready="true"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-import-workspace"/);
    assert.doesNotMatch(environment.runtimeRoot.innerHTML, /class="labx-top-bar"/);
    assert.doesNotMatch(environment.runtimeRoot.innerHTML, /class="labx-drawer"/);
    assert.doesNotMatch(environment.runtimeRoot.innerHTML, /class="labx-process-strip"/);

    clickListener({
      target: new MountedActionElement("exit-youtube-import-mode"),
    } as unknown as Event);

    assert.match(environment.runtimeRoot.innerHTML, /data-layout-kind="laboratory"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-top-bar"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-drawer"/);
    assert.match(environment.runtimeRoot.innerHTML, /class="labx-process-strip"/);
  } finally {
    environment.restore();
  }
});

test("laboratory YouTube import mode renders as an additive shell override", () => {
  const store = createLabStore();
  store.dispatch({ type: "project-workspace-toggled", open: true });
  store.dispatch({ type: "enter-youtube-import-mode" });
  const state = store.getState();

  const idleMarkup = renderYoutubeImportWorkspaceMarkup(state);
  assert.match(idleMarkup, /class="labx-import-workspace"/);
  assert.match(idleMarkup, /data-import-status="idle"/);
  assert.match(idleMarkup, /data-has-preview="false"/);
  assert.match(idleMarkup, /class="labx-import-title"/);
  assert.match(idleMarkup, /YouTube Import Workspace/);
  assert.match(idleMarkup, /class="labx-import-back"/);
  assert.match(idleMarkup, /data-lab-action="exit-youtube-import-mode"/);
  assert.match(idleMarkup, /data-lab-action="youtube-import-clear"/);
  assert.match(idleMarkup, /class="labx-import-empty"/);
  assert.match(idleMarkup, /Paste YouTube URL to begin/);
  assert.match(idleMarkup, /class="labx-import-url-input"/);
  assert.match(idleMarkup, /type="url"/);
  assert.match(idleMarkup, /data-lab-field="youtube-import\.url"/);
  assert.match(idleMarkup, /placeholder="https:\/\/youtube\.com\/watch\?v=\.\.\."/);
  assert.match(idleMarkup, /Paste a YouTube URL to preview available import options/);
  assert.match(idleMarkup, /class="labx-import-hint"/);
  assert.match(idleMarkup, /Preview video before download/);
  assert.match(idleMarkup, /Control extraction strategy/);
  assert.match(idleMarkup, /Select output formats/);
  assert.doesNotMatch(idleMarkup, /YouTube Preview Area/);
  assert.doesNotMatch(idleMarkup, /URL Input \(placeholder\)/);
  assert.doesNotMatch(idleMarkup, /Basic Options \(placeholder\)/);
  assert.doesNotMatch(idleMarkup, /Advanced Settings \(placeholder\)/);
  assert.doesNotMatch(idleMarkup, /data-lab-action="load-source"/);
  assert.doesNotMatch(idleMarkup, /source-download-youtube/);
  assert.doesNotMatch(idleMarkup, /source-set-mode/);
  assert.doesNotMatch(idleMarkup, /data-lab-field="youtube-import\.format"/);

  store.dispatch({ type: "youtube-import-set-url", url: "https://youtu.be/abc123DEF45" });
  store.dispatch({ type: "youtube-import-parse-start" });
  const parsingMarkup = renderYoutubeImportWorkspaceMarkup(store.getState());
  assert.match(parsingMarkup, /data-import-status="parsing"/);
  assert.match(parsingMarkup, /value="https:\/\/youtu\.be\/abc123DEF45"/);
  assert.match(parsingMarkup, /id="5zfn1x"/);
  assert.match(parsingMarkup, /Analyzing video metadata\.\.\./);
  assert.match(parsingMarkup, /id="jp9w3v"/);
  assert.match(parsingMarkup, /Analyzing video\.\.\./);
  assert.match(parsingMarkup, /Strategy selection appears after metadata is ready/);
  assert.doesNotMatch(parsingMarkup, /<fieldset class="labx-import-control-group" disabled>/);
  assert.doesNotMatch(parsingMarkup, /data-lab-field="youtube-import\.format"/);
  assert.doesNotMatch(parsingMarkup, /Keep audio track/);

  store.dispatch({
    type: "youtube-import-parse-success",
    url: "https://youtu.be/abc123DEF45",
    preview: {
      title: "Sample Video Title",
      duration: 154,
      thumbnail: "https://img.youtube.com/vi/abc123DEF45/hqdefault.jpg",
    },
  });
  const readyMarkup = renderYoutubeImportWorkspaceMarkup(store.getState());
  assert.match(readyMarkup, /data-import-status="ready"/);
  assert.match(readyMarkup, /data-has-preview="true"/);
  assert.match(readyMarkup, /class="labx-import-thumb"/);
  assert.match(readyMarkup, /class="labx-import-meta"/);
  assert.match(readyMarkup, /Sample Video Title/);
  assert.match(readyMarkup, /02:34/);
  assert.match(readyMarkup, /id="0zznv2"/);
  assert.match(readyMarkup, /Format: Best available/);
  assert.match(readyMarkup, /Estimated size: ~14 MB/);
  assert.match(readyMarkup, /Strategy: Maximum resolution and bitrate/);
  assert.match(readyMarkup, /Duration: 2:34/);
  assert.match(readyMarkup, /class="labx-strategy-list"/);
  assert.match(readyMarkup, /data-lab-action="youtube-import-set-strategy"/);
  assert.match(readyMarkup, /data-lab-value="video_best"/);
  assert.match(readyMarkup, /data-lab-value="audio_only"/);
  assert.match(readyMarkup, /data-lab-value="low_size"/);
  assert.match(readyMarkup, /data-lab-value="custom"/);
  assert.match(readyMarkup, /class="strategy-card labx-strategy-card active"/);
  assert.match(readyMarkup, /Best Quality/);
  assert.match(readyMarkup, /Audio Only/);
  assert.match(readyMarkup, /Small Size/);
  assert.match(readyMarkup, /Advanced/);
  assert.doesNotMatch(readyMarkup, /data-lab-field="youtube-import\.format"/);
  assert.doesNotMatch(readyMarkup, /<input type="checkbox" checked \/>/);
  const readyFooterMarkup = readyMarkup.match(
    /<div class="labx-import-footer">[\s\S]*?<\/div>/
  )?.[0];
  assert.ok(readyFooterMarkup);
  assert.match(readyFooterMarkup, /Download \(Best Quality · ~14 MB\)/);
  assert.match(readyFooterMarkup, /Download &amp; Analyze \(Best Quality\)/);
  assert.doesNotMatch(readyFooterMarkup, /data-lab-action/);
  assert.doesNotMatch(readyMarkup, /Paste YouTube URL to begin/);
  assert.doesNotMatch(readyMarkup, /data-lab-action="source-download-youtube"/);
  assert.doesNotMatch(readyMarkup, /data-lab-action="load-source"/);

  store.dispatch({ type: "youtube-import-set-strategy", strategy: "audio_only" });
  const audioOnlyMarkup = renderYoutubeImportWorkspaceMarkup(store.getState());
  assert.match(audioOnlyMarkup, /Format: MP3 \/ AAC/);
  assert.match(audioOnlyMarkup, /Estimated size: ~2 MB/);
  assert.match(audioOnlyMarkup, /Strategy: Extract audio track only/);
  assert.match(audioOnlyMarkup, /Download \(Audio Only · ~2 MB\)/);
  assert.match(audioOnlyMarkup, /Download &amp; Analyze \(Audio Only\)/);

  store.dispatch({ type: "youtube-import-set-strategy", strategy: "low_size" });
  const lowSizeMarkup = renderYoutubeImportWorkspaceMarkup(store.getState());
  assert.match(lowSizeMarkup, /Format: MP4 compressed/);
  assert.match(lowSizeMarkup, /Estimated size: ~5 MB/);
  assert.match(lowSizeMarkup, /Strategy: Compressed for quick use/);
  assert.match(lowSizeMarkup, /Download \(Small Size · ~5 MB\)/);
  assert.match(lowSizeMarkup, /Download &amp; Analyze \(Small Size\)/);

  store.dispatch({ type: "youtube-import-set-strategy", strategy: "custom" });
  store.dispatch({
    type: "youtube-import-custom-updated",
    patch: {
      resolution: "720p",
      format: "webm",
      audioExtraction: true,
    },
  });
  const customMarkup = renderYoutubeImportWorkspaceMarkup(store.getState());
  assert.match(customMarkup, /Format: Manual/);
  assert.match(customMarkup, /Estimated size: Manual/);
  assert.match(customMarkup, /Strategy: Manual control over formats/);
  assert.match(customMarkup, /class="labx-advanced-settings"/);
  assert.match(customMarkup, /data-lab-field="youtube-import\.custom\.resolution"/);
  assert.match(customMarkup, /value="720p" selected/);
  assert.match(customMarkup, /data-lab-field="youtube-import\.custom\.format"/);
  assert.match(customMarkup, /value="webm" selected/);
  assert.match(customMarkup, /data-lab-field="youtube-import\.custom\.audioExtraction" checked/);
  assert.match(customMarkup, /Download \(Advanced · Manual\)/);
  assert.doesNotMatch(customMarkup, /data-lab-field="youtube-import\.format"/);

  store.dispatch({ type: "youtube-import-set-url", url: "https://example.com/watch?v=nope" });
  store.dispatch({ type: "youtube-import-parse-error", reason: "invalid-url" });
  const errorMarkup = renderYoutubeImportWorkspaceMarkup(store.getState());
  assert.match(errorMarkup, /data-import-status="error"/);
  assert.match(errorMarkup, /id="b8nq4m"/);
  assert.match(errorMarkup, /Invalid YouTube URL or network error/);
  assert.match(errorMarkup, /Check the URL and paste a valid YouTube link/);
  assert.doesNotMatch(errorMarkup, /Sample Video Title/);
  assert.doesNotMatch(errorMarkup, /data-lab-field="youtube-import\.format"/);

  const shellMarkup = renderLabLayout(state, { main: idleMarkup, side: "" });
  assert.equal(getLabLayoutKind(state), "import-only");
  assert.match(shellMarkup, /data-layout-kind="import-only"/);
  assert.match(shellMarkup, /data-lab-mode="import-youtube"/);
  assert.match(shellMarkup, /data-drawer-collapsed="true"/);
  assert.match(shellMarkup, /class="labx-import-workspace"/);
  assert.doesNotMatch(shellMarkup, /class="labx-top-bar"/);
  assert.doesNotMatch(shellMarkup, /class="labx-process-strip"/);
  assert.doesNotMatch(shellMarkup, /class="labx-drawer"/);
  assert.doesNotMatch(shellMarkup, /labx-source-intake/);
  assert.doesNotMatch(shellMarkup, /id="lab-workspace-main"/);
  assert.doesNotMatch(shellMarkup, /labx-pw-grid/);

  const overlayMarkup = renderProjectWorkspaceOverlay(state);
  assert.match(overlayMarkup, /id="lab-project-workspace-root" aria-hidden="true"/);
  assert.doesNotMatch(overlayMarkup, /labx-pw-overlay/);
  assert.equal(state.ui.projectWorkspaceOpen, true);

  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  assert.deepEqual(
    Object.keys(enTranslations.mediaAnalysis.source.youtubeImport).sort(),
    Object.keys(trTranslations.mediaAnalysis.source.youtubeImport).sort()
  );

  store.dispatch({ type: "exit-youtube-import-mode" });
  const restoredState = store.getState();
  const restoredMarkup = renderLabLayout(restoredState, {
    main: `<div id="lab-workspace-main"></div>`,
    side: "",
  });
  assert.equal(getLabLayoutKind(restoredState), "laboratory");
  assert.match(restoredMarkup, /data-layout-kind="laboratory"/);
  assert.match(restoredMarkup, /class="labx-top-bar"/);
  assert.match(restoredMarkup, /class="labx-process-strip"/);
});

test("laboratory YouTube import HTMLElement bridge requires an explicit document outside the browser", () => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const store = createLabStore();
  store.dispatch({ type: "enter-youtube-import-mode" });

  try {
    delete (globalThis as { document?: Document }).document;
    assert.throws(function () {
      renderYoutubeImportWorkspace(store.getState());
    }, /requires a browser Document/);
  } finally {
    if (documentDescriptor !== undefined) {
      Object.defineProperty(globalThis, "document", documentDescriptor);
    }
  }
});

test("laboratory shell preserves workspace preview nodes while diffing live panels", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");

  assert.match(labRootSource, /function updateRenderedElement\(/);
  assert.match(labRootSource, /function syncChildNodes\(/);
  assert.match(labRootSource, /function canReuseElement\(/);
  assert.match(
    labRootSource,
    /const preserveKey = readPreservedMediaKey\(currentElement\) \|\| readPreservedMediaKey\(nextElement\);/
  );
  assert.match(labRootSource, /function readPreservedDetailsState\(/);
  assert.match(labRootSource, /element\.hasAttribute\("data-lab-interpretation-panel"\)/);
  assert.match(labRootSource, /element\.hasAttribute\("data-lab-collapsible-panel"\)/);
  assert.match(labRootSource, /currentElement\.open = preservedDetailsState;/);
  assert.match(labRootSource, /currentElement\.scrollTop = scrollTop;/);
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*centerPanel as HTMLElement,\s*renderLabCenterPanel\(surface\),\s*true\s*\);/
  );
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*drawer as HTMLElement,\s*renderLabDrawer\(state, surface, copy\),\s*true\s*\);/
  );
  assert.match(
    labRootSource,
    /updateRenderedElement\(\s*documentRef,\s*processStrip as HTMLElement,\s*renderLabProcessStrip\(state, copy\)\s*\);/
  );
  assert.match(workspaceSurfaceSource, /preserveKey \|\| "workspace-preview"/);
  assert.match(workspaceSurfaceSource, /data-lab-preserve-media="\$\{escapeHtml\(preserveKey\)\}"/);
});

test("laboratory shell persists workspace-facing state and exposes tool lifecycle controls", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const toolOverlaySource = readFileSync("rooms/laboratory/ui/tool-management-overlay.ts", "utf8");
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
  const projectNavigationSource = readFileSync("rooms/laboratory/ui/project-navigation.ts", "utf8");
  const projectWorkspaceSource = readFileSync(
    "rooms/laboratory/ui/project-workspace-overlay.ts",
    "utf8"
  );
  const assetGridSource = readFileSync("rooms/laboratory/ui/asset-grid.ts", "utf8");

  assert.match(labRootSource, /schemaVersion:\s*4,/);
  assert.match(
    labRootSource,
    /analysisPrepExpandedIntentIds:\s*_analysisPrepExpandedIntentIds,\s*\.\.\.workspace/
  );
  assert.match(labRootSource, /workspace,/);
  assert.match(
    labRootSource,
    /state\.run\.state === "running" \|\| state\.run\.state === "queued"/
  );
  assert.match(toolOverlaySource, /mediaAnalysis\.toolManager\.ariaLabel/);
  assert.match(toolOverlaySource, /data-lab-action="tool-update-all"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-install"/);
  assert.match(toolOverlaySource, /data-lab-action="tool-check-updates"/);
  assert.doesNotMatch(drawerSource, /renderSourceIntake\(state, copy\)/);
  assert.doesNotMatch(drawerSource, /renderLabProjectAssetsPanel/);
  assert.doesNotMatch(projectNavigationSource, /renderSourceIntake\(state, copy\)/);
  assert.match(projectWorkspaceSource, /renderProjectSourceImport\(state, copy\)/);
  assert.match(projectWorkspaceSource, /renderProjectImportReview\(state, copy\)/);
  assert.match(assetGridSource, /data-lab-field="workspace\.hypothesis"/);
  assert.match(drawerSource, /data-lab-action="run-deep-analysis"/);
  assert.match(drawerSource, /buildIntentPreviewSentence\(state\)/);
  assert.match(drawerSource, /buildExecutionBridge/);
  assert.match(drawerSource, /data-lab-drawer-alternatives="true"/);
  assert.match(workspaceSurfaceSource, /Source setup controls/);
  assert.doesNotMatch(workspaceSurfaceSource, /renderLabTopbarActions\(state, copy\)/);
  assert.doesNotMatch(workspaceSurfaceSource, /renderGlobalProcessSummary\(state, copy\)/);
});

test("laboratory center workbench attaches media viewport and timeline as one surface", () => {
  const workspaceSurfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );
  const themeSource = readFileSync("rooms/laboratory/ui/lab-theme.css", "utf8");

  assert.match(workspaceSurfaceSource, /class="labx-media-workbench"/);
  assert.match(workspaceSurfaceSource, /class="labx-workspace-stage"/);
  assert.match(workspaceSurfaceSource, /renderWorkspaceInspectorDrawer/);
  assert.match(workspaceSurfaceSource, /data-lab-workspace-inspector="true"/);
  assert.match(workspaceSurfaceSource, /data-lab-action="workspace-controls-drawer-toggle"/);
  assert.match(workspaceSurfaceSource, /data-lab-action="workspace-controls-tab-select"/);
  assert.match(workspaceSurfaceSource, /data-lab-media-workbench="true"/);
  assert.match(
    workspaceSurfaceSource,
    /const controls = options\.controls === true \? "controls" : "";/
  );
  assert.match(workspaceSurfaceSource, /data-lab-selection-roi-controls-reserve="0"/);
  assert.match(timelineSource, /data-lab-action="timeline-toggle-playback"/);
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
  assert.doesNotMatch(workspaceSurfaceSource, /renderWorkspaceBookmarks|workspace-bookmarks/);
  assert.match(
    workspaceSurfaceSource,
    /class="labx-workspace-stage"[\s\S]*class="labx-media-workbench"[\s\S]*class="labx-workspace-preview"[\s\S]*\$\{dualPreviewTransport\}[\s\S]*renderLabWaveformTimeline\(timelineModel\)[\s\S]*\$\{inspectorMarkup\}/
  );
  assert.doesNotMatch(workspaceSurfaceSource, /renderWorkspaceHypothesis/);
  assert.match(
    themeSource,
    /\.labx-media-workbench\s*\{[\s\S]*gap:\s*0;[\s\S]*min-height:\s*0;[\s\S]*border:\s*1px solid rgba\(134, 187, 214, 0\.18\);[\s\S]*border-radius:\s*var\(--labx-radius-tight\);/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-preview\s*\{[\s\S]*min-height:\s*0;[\s\S]*height:\s*100%;[\s\S]*border:\s*0;[\s\S]*border-radius:\s*0;[\s\S]*box-shadow:\s*none;/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-stage\s*\{[\s\S]*position:\s*relative;[\s\S]*flex:\s*1 1 auto;[\s\S]*min-height:\s*0;/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-inspector\s*\{[\s\S]*position:\s*absolute;[\s\S]*right:\s*0\.75rem;[\s\S]*bottom:\s*0\.75rem;/
  );
  assert.match(
    themeSource,
    /\.labx-workspace-inspector\[data-open="false"\]\s*\.labx-workspace-inspector__body\s*\{[\s\S]*display:\s*none;/
  );
  assert.match(
    themeSource,
    /\.labx-media-workbench\s*>\s*\.labx-timeline\s*\{[\s\S]*padding:\s*0 0 0\.45rem;[\s\S]*border-width:\s*0;[\s\S]*border-radius:\s*0;[\s\S]*box-shadow:\s*none;/
  );
  assert.match(themeSource, /\.labx-timeline__track\s*\{[\s\S]*height:\s*3\.5rem;/);
  assert.match(themeSource, /\.labx-timeline__controls\s*\{[\s\S]*flex-wrap:\s*nowrap;/);
  assert.match(themeSource, /\.labx-timeline__transport\s*\{/);
  assert.match(themeSource, /\.labx-timeline__volume\s*\{/);
  assert.match(themeSource, /\.labx-timeline__bookmark\s*\{/);
  assert.match(
    themeSource,
    /\.labx-timeline__pin-popover\s*\{[\s\S]*bottom:\s*calc\(100% \+ 0\.35rem\);/
  );
  assert.match(themeSource, /\.labx-timeline__pin-remove\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-timeline__range-info\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-bookmarks\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-timeline__header\s*\{/);
  assert.doesNotMatch(themeSource, /\.labx-timeline__sync\s*\{/);
  assert.match(
    themeSource,
    /\.labx-dual-preview-transport\s*\{[\s\S]*border:\s*0;[\s\S]*border-top:\s*1px solid rgba\(122, 162, 255, 0\.18\);[\s\S]*border-radius:\s*0;/
  );
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
    /\.labx-preview-filter-wrap\s*>\s*\.labx-preview-media--workspace-video\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*height:\s*100%;[\s\S]*object-fit:\s*contain;/
  );
});

test("laboratory process strip owns heartbeat and expanded runtime detail rendering", () => {
  const labRootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
  const themeSource = readFileSync("rooms/laboratory/ui/lab-theme.css", "utf8");

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
    /\.labx-shell\[data-process-view="expanded"\]\s*\{[\s\S]*grid-template-rows:\s*48px minmax\(0, 1fr\) 236px;/
  );
  assert.match(
    themeSource,
    /\.labx-process-strip\s*\{[\s\S]*flex-direction:\s*column;[\s\S]*height:\s*100%;/
  );
  assert.match(
    themeSource,
    /\.labx-strip-expanded\s*\{[\s\S]*display:\s*grid;[\s\S]*background:\s*var\(--labx-bg-main\);/
  );
  assert.match(
    themeSource,
    /\.labx-strip-expanded section\s*\{[\s\S]*background:\s*rgba\(4, 11, 19, 0\.88\);/
  );
  assert.match(
    themeSource,
    /\.labx-strip-expanded__list li,[\s\S]*\.labx-strip-expanded__log li\s*\{[\s\S]*background:\s*rgba\(14, 28, 43, 0\.92\);/
  );
});

test("laboratory theme defines the v2 shell grid and drawer layout contract", () => {
  const themeSource = readFileSync("rooms/laboratory/ui/lab-theme.css", "utf8");
  const projectWorkspaceSource = readFileSync(
    "rooms/laboratory/ui/styles/project-workspace.css",
    "utf8"
  );

  assert.match(
    themeSource,
    /\.labx-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 22rem;[\s\S]*grid-template-rows:\s*48px minmax\(0, 1fr\) 56px;/
  );
  assert.match(
    themeSource,
    /\.labx-shell\s*\{[\s\S]*grid-template-areas:\s*"topbar topbar"\s*"center drawer"\s*"strip\s+strip";/
  );
  assert.match(
    themeSource,
    /\.labx-shell\[data-drawer-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*grid-template-areas:\s*"topbar"\s*"center"\s*"strip";/
  );
  assert.doesNotMatch(themeSource, /\.labx-drawer--collapsed/);
  assert.doesNotMatch(themeSource, /\.labx-drawer__expand-btn/);
  assert.match(themeSource, /\.labx-center-skeleton__label\s*\{/);
  assert.match(themeSource, /\.labx-boot-overlay\s*\{[\s\S]*pointer-events:\s*auto;/);
  assert.match(themeSource, /\.labx-boot-panel\s*\{[\s\S]*border-radius:\s*0\.5rem;/);
  assert.match(themeSource, /@keyframes labx-skeleton-breathe/);
  assert.doesNotMatch(themeSource, /\.labx-shell\[data-ready="false"\]::after/);
  assert.doesNotMatch(themeSource, /\.labx-shell\[data-ready="false"\]\s+\.labx-center-panel/);
  assert.doesNotMatch(themeSource, /labx-boot-breathe/);
  assert.match(
    themeSource,
    /\.labx-top-bar\s*\{\s*grid-area:\s*topbar;\s*\}[\s\S]*\.labx-drawer\s*\{\s*grid-area:\s*drawer;\s*\}[\s\S]*\.labx-process-strip\s*\{\s*grid-area:\s*strip;\s*\}/
  );
  assert.match(
    themeSource,
    /\.labx-shell\[data-layout-kind="import-only"\]\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\);[\s\S]*grid-template-areas:\s*"center";/
  );
  assert.match(
    projectWorkspaceSource,
    /\.labx-import-body\s*\{[\s\S]*grid-template-columns:\s*1\.4fr 1fr;/
  );
  assert.match(
    projectWorkspaceSource,
    /\.labx-import-body\[data-has-preview="true"\]\s*\{[\s\S]*grid-template-columns:\s*1\.2fr 1fr;/
  );
  assert.match(projectWorkspaceSource, /\.labx-import-title\s*\{[\s\S]*font-size:\s*14px;/);
  assert.match(projectWorkspaceSource, /\.labx-import-empty\s*\{[\s\S]*gap:\s*16px;/);
  assert.match(projectWorkspaceSource, /\.labx-import-hint\s*\{[\s\S]*font-size:\s*12px;/);
  assert.match(projectWorkspaceSource, /\.labx-import-status\s*\{[\s\S]*font-size:\s*12px;/);
  assert.match(projectWorkspaceSource, /\.labx-import-thumb\s*\{[\s\S]*aspect-ratio:\s*16 \/ 9;/);
  assert.match(projectWorkspaceSource, /\.labx-strategy-list\s*\{[\s\S]*display:\s*grid;/);
  assert.match(projectWorkspaceSource, /\.labx-strategy-list\s*\{[\s\S]*gap:\s*10px;/);
  assert.match(
    projectWorkspaceSource,
    /\.labx-strategy-list \.strategy-card\.active\s*\{[\s\S]*border:\s*2px solid var\(--labx-accent\);[\s\S]*background:\s*var\(--labx-accent-soft\);/
  );
  assert.match(projectWorkspaceSource, /\.labx-advanced-settings\s*\{[\s\S]*display:\s*grid;/);
});

test("laboratory micro inspection UI exposes roi focus precedence and lens affordances in the preview shell", () => {
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
  assert.match(overlaySource, /data-lab-selection-roi-focus-toggle="true"/);
  assert.match(overlaySource, /data-lab-selection-roi-capture="true"/);
  assert.match(surfaceSource, /data-lab-preview-inspection-stage="true"/);
  assert.match(surfaceSource, /data-lab-preview-inspection-content="true"/);
  assert.match(timelineSelectionSource, /Selection micro zoom/);
  assert.match(timelineSelectionSource, /model\.selectionMicroZoomOpen !== true/);
  assert.match(timelineSelectionSource, /id="lab-audio-viz-inspection"/);
});

test("laboratory selection preview exposes soft execution intent affordances without run semantics", () => {
  const timelineSelectionSource = readFileSync(
    "rooms/laboratory/ui/timeline/timeline-selection.ts",
    "utf8"
  );

  assert.match(timelineSelectionSource, /Selected action/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-accept=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-dismiss=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-queue=/);
  assert.match(timelineSelectionSource, /data-lab-execution-intent-clear="true"/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.intentSelected/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.wantThis/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.notNow/);
  assert.match(timelineSelectionSource, /mediaAnalysis\.timeline\.queueForLater/);
  assert.doesNotMatch(timelineSelectionSource, />Run</);
});

test("laboratory execution plan UI stays passive and derived from active intent", () => {
  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );

  assert.match(timelineSource, /data-lab-execution-plan="true"/);
  assert.match(timelineSource, /Execution plan/);
  assert.match(timelineSource, /The system would approach this by:/);
  assert.match(timelineSource, /Expected outputs/);
  assert.match(timelineSource, /Planning notes/);
  assert.doesNotMatch(timelineSource, />Run this</);
  assert.doesNotMatch(timelineSource, />Start execution</);
});

test("laboratory execution simulation UI stays passive and derived from active plan", () => {
  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );

  assert.match(timelineSource, /data-lab-execution-simulation="true"/);
  assert.match(timelineSource, /Simulation preview/);
  assert.match(timelineSource, /What would happen/);
  assert.match(timelineSource, /Simulation warnings/);
  assert.match(timelineSource, /If applied, you would observe/);
  assert.doesNotMatch(timelineSource, />Run</);
  assert.doesNotMatch(timelineSource, />Apply</);
  assert.doesNotMatch(timelineSource, />Execute</);
});

test("laboratory execution readiness UI stays passive and owned by active readiness only", () => {
  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );

  assert.match(timelineSource, /data-lab-execution-readiness="true"/);
  assert.match(timelineSource, /Execution readiness/);
  assert.match(timelineSource, /Readiness blockers/);
  assert.match(timelineSource, /Review notes/);
  assert.match(timelineSource, /Execution readiness looks stable/);
  assert.match(timelineSource, /This path needs review before any execution step/);
  assert.match(timelineSource, /This path is not yet execution-ready/);
  assert.match(
    timelineSource,
    /hasSemanticSelection && activeExecutionPlan !== null && activeExecutionSimulation !== null/
  );
  assert.doesNotMatch(timelineSource, />Run</);
  assert.doesNotMatch(timelineSource, />Execute</);
  assert.doesNotMatch(timelineSource, /Start execution/);
});

test("laboratory execution readiness render ownership stays tied to active readiness", () => {
  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-readiness="true"/);

  const queuedOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionIntent: null,
      activeSuggestionPreview: null,
      selectionSuggestions: [
        {
          id: "audio-inspect",
          label: "Inspect audio",
          actionType: "inspect-audio",
          confidence: 0.82,
        },
      ],
    })
  );
  assert.doesNotMatch(queuedOnlyMarkup, /data-lab-execution-readiness="true"/);

  const simulationMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: {
        id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
        suggestionId: "audio-inspect",
        actionType: "inspect-audio",
        title: "Audio inspection plan",
        steps: [
          {
            id: "isolate",
            label: "Isolate",
          },
        ],
        expectedOutputs: ["Spectral profile"],
        confidence: 0.78,
      },
      activeExecutionSimulation: null,
      activeExecutionReadiness: null,
    })
  );
  assert.doesNotMatch(simulationMissingMarkup, /data-lab-execution-readiness="true"/);
});

test("laboratory execution payload preview UI stays passive and technical", () => {
  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );

  assert.match(timelineSource, /data-lab-execution-payload-preview="true"/);
  assert.match(timelineSource, /Execution payload \(preview\)/);
  assert.match(timelineSource, /This is how the system would structure the execution input/);
  assert.match(timelineSource, /No execution is performed/);
  assert.match(timelineSource, /Preview input/);
  assert.match(timelineSource, /Preview parameters/);
  assert.match(timelineSource, /Preview expected outputs/);
  assert.doesNotMatch(timelineSource, /safeToExecute/);
  assert.doesNotMatch(timelineSource, /safe-to-execute/);
  assert.doesNotMatch(timelineSource, />Run</);
  assert.doesNotMatch(timelineSource, />Execute</);
  assert.doesNotMatch(timelineSource, />Apply</);
  assert.doesNotMatch(timelineSource, /Start execution/);
});

test("laboratory execution payload preview render ownership stays tied to active payload", () => {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-payload-preview="true"/);

  const readinessMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: null,
      activeExecutionPayloadPreview: activePayload,
    })
  );
  assert.doesNotMatch(readinessMissingMarkup, /data-lab-execution-payload-preview="true"/);

  const payloadMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
    })
  );
  assert.match(payloadMarkup, /data-lab-execution-payload-preview="true"/);
  assert.match(payloadMarkup, /frequencyClusters/);
  assert.match(payloadMarkup, /bandFocus/);
});

test("laboratory execution reflection UI stays passive and advisory", () => {
  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );

  assert.match(timelineSource, /data-lab-execution-reflection="true"/);
  assert.match(timelineSource, /Execution reflection/);
  assert.match(timelineSource, /This path appears stable/);
  assert.match(timelineSource, /This path may require additional review/);
  assert.match(timelineSource, /This path is not recommended in its current form/);
  assert.match(timelineSource, /Reasoning/);
  assert.match(timelineSource, /Tradeoffs/);
  assert.match(timelineSource, /Alternatives/);
  assert.doesNotMatch(timelineSource, />\s*Run\s*</);
  assert.doesNotMatch(timelineSource, />\s*Execute\s*</);
  assert.doesNotMatch(timelineSource, />\s*Apply\s*</);
  assert.doesNotMatch(timelineSource, /Start execution/);
});

test("laboratory execution reflection render ownership stays tied to active reflection", () => {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };
  const activeReflection = {
    id: `reflection:${activePlan.id}`,
    planId: activePlan.id,
    summary: "This path may require additional review before it is carried further.",
    decision: "review" as const,
    reasoning: ["Payload preview asks for additional review before this path is carried further."],
    tradeoffs: ["Audio-focused review can expose signal detail while amplifying preview bias."],
    alternatives: ["Expand selection range"],
    confidence: 0.72,
  };

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-reflection="true"/);

  const payloadMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: null,
      activeExecutionReflection: activeReflection,
    })
  );
  assert.doesNotMatch(payloadMissingMarkup, /data-lab-execution-reflection="true"/);

  const reflectionMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: activeReflection,
    })
  );
  assert.match(reflectionMarkup, /data-lab-execution-reflection="true"/);
  assert.match(reflectionMarkup, /data-decision="review"/);
  assert.match(reflectionMarkup, /Expand selection range/);
  assert.match(reflectionMarkup, /Payload preview asks for additional review/);
});

test("laboratory execution alternatives UI stays passive and comparative", () => {
  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );

  assert.match(timelineSource, /data-lab-execution-alternatives="true"/);
  assert.match(timelineSource, /Alternative evaluation/);
  assert.match(timelineSource, /An alternative approach would be/);
  assert.match(timelineSource, /lab-execution-alternatives__tradeoff/);
  assert.match(timelineSource, /lab-execution-alternatives__comparison/);
  assert.doesNotMatch(timelineSource, /Try this instead/);
  assert.doesNotMatch(timelineSource, /You should use/);
  assert.doesNotMatch(timelineSource, /Better option/);
  assert.doesNotMatch(timelineSource, /lab-execution-alternatives[\s\S]{0,2400}<button/);
  assert.doesNotMatch(timelineSource, />\s*Run\s*</);
  assert.doesNotMatch(timelineSource, />\s*Execute\s*</);
  assert.doesNotMatch(timelineSource, />\s*Apply\s*</);
  assert.doesNotMatch(timelineSource, /Start execution/);
});

test("laboratory execution alternatives render ownership stays tied to active reflection", () => {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };
  const activeReflection = {
    id: `reflection:${activePlan.id}`,
    planId: activePlan.id,
    summary: "This path appears stable as a passive dry-run decision.",
    decision: "proceed" as const,
    reasoning: ["Readiness and simulation signals align with a stable dry-run path."],
    tradeoffs: ["Audio-focused review can expose signal detail while amplifying preview bias."],
    confidence: 0.82,
  };
  const activeAlternatives = {
    id: `alternatives:${activePlan.id}`,
    planId: activePlan.id,
    summary:
      "The selected path appears stable; alternatives mainly trade precision, coverage, or tempo against that stable baseline.",
    alternatives: [
      {
        actionType: "analyze-segment",
        label: "Broader segment review",
        summary: "An alternative approach would evaluate the full selected window.",
        tradeoff: "This path would trade local clarity for higher contextual coverage.",
        relativeAdvantage: "higher-coverage" as const,
      },
    ],
    comparisonNote:
      "Compared to the selected path, these alternatives can expose different evidence at the cost of changing the current balance.",
    confidence: 0.84,
  };

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-alternatives="true"/);

  const reflectionMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: null,
      activeExecutionAlternatives: activeAlternatives,
    })
  );
  assert.doesNotMatch(reflectionMissingMarkup, /data-lab-execution-alternatives="true"/);

  const alternativesMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: activeReflection,
      activeExecutionAlternatives: activeAlternatives,
    })
  );
  assert.match(alternativesMarkup, /data-lab-execution-alternatives="true"/);
  assert.match(alternativesMarkup, /Broader segment review/);
  assert.match(alternativesMarkup, /This path would trade local clarity/);
  assert.match(alternativesMarkup, /Higher Coverage/);
});

test("laboratory execution candidate UI stays passive and structural", () => {
  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );
  const candidateFunctionStart = timelineSource.indexOf("function renderExecutionCandidate");
  const candidateFunctionEnd = timelineSource.indexOf(
    "function formatCommitmentTimestamp",
    candidateFunctionStart
  );
  assert.notEqual(candidateFunctionStart, -1);
  assert.notEqual(candidateFunctionEnd, -1);
  const candidateFunctionSource = timelineSource.slice(
    candidateFunctionStart,
    candidateFunctionEnd
  );

  assert.match(timelineSource, /data-lab-execution-candidate="true"/);
  assert.match(timelineSource, /Execution candidate/);
  assert.match(timelineSource, /Structural integrity/);
  assert.match(timelineSource, /formatCandidateStatus/);
  assert.match(timelineSource, /formatStructuralIntegrity/);
  assert.doesNotMatch(candidateFunctionSource, /<button/);
  assert.doesNotMatch(candidateFunctionSource, /data-lab-action/);
  assert.doesNotMatch(candidateFunctionSource, /onclick/);
});

test("laboratory execution candidate render ownership stays tied to complete candidate chain", () => {
  const activePlan = {
    id: "plan:audio-inspect:inspect-audio:audio:audio:clip:audio:1000:3000:noroi",
    suggestionId: "audio-inspect",
    actionType: "inspect-audio" as const,
    title: "Audio inspection plan",
    steps: [
      {
        id: "isolate",
        label: "Isolate",
      },
    ],
    expectedOutputs: ["Spectral profile"],
    confidence: 0.78,
  };
  const activeSimulation = {
    id: `simulation:${activePlan.id}`,
    planId: activePlan.id,
    summary: "If applied, the preview would emphasize spectral behavior.",
    predictedEffects: ["Frequency bands would read as more distinct."],
    metrics: {
      intensity: "medium" as const,
      risk: "low" as const,
      confidence: 0.78,
    },
  };
  const activeReadiness = {
    id: `readiness:${activePlan.id}`,
    planId: activePlan.id,
    status: "ready" as const,
    summary: "This looks ready to carry forward as a preview-only execution candidate.",
    confidence: 0.81,
  };
  const activePayload = {
    id: `payload:${activePlan.id}`,
    planId: activePlan.id,
    actionType: "inspect-audio",
    summary: "The dry-run bridge would describe the selected audio window.",
    dryRunShape: {
      previewInput: {
        audioWindow: {
          startMs: 1000,
          endMs: 3000,
          sourceKind: "audio",
        },
      },
      previewParameters: {
        bandFocus: "full-spectrum",
        transientScan: "enabled",
      },
      previewExpectedOutputs: ["frequencyClusters", "transientPeaks"],
    },
    readinessStatus: "ready" as const,
    readinessPassesPreview: true,
  };
  const activeReflection = {
    id: `reflection:${activePlan.id}`,
    planId: activePlan.id,
    summary: "This path appears stable as a passive dry-run decision.",
    decision: "proceed" as const,
    reasoning: ["Readiness and simulation signals align with a stable dry-run path."],
    tradeoffs: ["Audio-focused review can expose signal detail while amplifying preview bias."],
    confidence: 0.82,
  };
  const activeAlternatives = {
    id: `alternatives:${activePlan.id}`,
    planId: activePlan.id,
    summary:
      "The selected path appears stable; alternatives mainly trade precision, coverage, or tempo against that stable baseline.",
    alternatives: [
      {
        actionType: "analyze-segment",
        label: "Broader segment review",
        summary: "An alternative approach would evaluate the full selected window.",
        tradeoff: "This path would trade local clarity for higher contextual coverage.",
        relativeAdvantage: "higher-coverage" as const,
      },
    ],
    comparisonNote:
      "Compared to the selected path, these alternatives can expose different evidence at the cost of changing the current balance.",
    confidence: 0.84,
  };
  const activeCandidate = {
    id: `candidate:${activePlan.id}`,
    planId: activePlan.id,
    status: "viable" as const,
    summary: "This path is structurally ready for execution.",
    structuralIntegrity: "complete" as const,
    readinessStatus: "ready" as const,
    reflectionDecision: "proceed" as const,
    notes: ["Payload preview is structurally aligned with the readiness signal."],
    confidence: 0.87,
  };

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
      activeExecutionCandidate: activeCandidate,
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-candidate="true"/);

  const reflectionMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: null,
      activeExecutionAlternatives: activeAlternatives,
      activeExecutionCandidate: activeCandidate,
    })
  );
  assert.doesNotMatch(reflectionMissingMarkup, /data-lab-execution-candidate="true"/);

  const alternativesMissingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: activeReflection,
      activeExecutionAlternatives: null,
      activeExecutionCandidate: activeCandidate,
    })
  );
  assert.doesNotMatch(alternativesMissingMarkup, /data-lab-execution-candidate="true"/);

  const candidateMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: activePlan,
      activeExecutionSimulation: activeSimulation,
      activeExecutionReadiness: activeReadiness,
      activeExecutionPayloadPreview: activePayload,
      activeExecutionReflection: activeReflection,
      activeExecutionAlternatives: activeAlternatives,
      activeExecutionCandidate: activeCandidate,
    })
  );
  const candidatePanel = extractCandidatePanelMarkup(candidateMarkup);

  assert.match(candidatePanel, /data-lab-execution-candidate="true"/);
  assert.match(candidatePanel, /Viable/);
  assert.match(candidatePanel, /Complete/);
  assert.match(candidatePanel, /Readiness/);
  assert.match(candidatePanel, /Reflection/);
  assert.match(candidatePanel, /87% confidence/);
  assert.doesNotMatch(candidatePanel, /<button/);
  assert.doesNotMatch(candidatePanel, /onclick/);
  assert.doesNotMatch(candidatePanel, /data-lab-action/);
  assert.doesNotMatch(candidatePanel, />\s*(Run|Execute|Apply|Start|Commit)\s*</);
  assert.doesNotMatch(candidatePanel, /\bCommit\b/);
});

test("laboratory timeline renders selector-fed execution feedback after completion", () => {
  const store = createCompletedAudioExecutionStore();
  const markup = renderLabWaveformTimeline(getWaveformTimelineModel(store.getState()));
  const candidatePanel = extractCandidatePanelMarkup(markup);

  assert.match(markup, /Result partially aligns with simulated expectations/);
  assert.match(markup, /Audio goal remains inconclusive for the current result/);
  assert.match(markup, /Execution feedback is mixed/);
  assert.match(markup, /mixed execution signal/);
  assert.match(candidatePanel, /98% confidence/);
  assert.doesNotMatch(markup, /data-lab-action="execution/);
  assert.doesNotMatch(candidatePanel, />\s*(Run|Execute|Apply|Start|Commit)\s*</);
});

test("laboratory execution commitment UI is explicit, passive, and candidate-gated", () => {
  const fixture = createPassiveExecutionChainFixture();

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-commitment="true"/);
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-commitment-set=/);

  const choiceMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: null,
    })
  );
  const candidatePanel = extractCandidatePanelMarkup(choiceMarkup);
  assert.match(choiceMarkup, /data-lab-execution-commitment-control="true"/);
  assert.match(choiceMarkup, /data-lab-execution-commitment-set=/);
  assert.match(choiceMarkup, /Choose this path/);
  assert.doesNotMatch(choiceMarkup, /data-lab-execution-commitment="true"/);
  assert.doesNotMatch(candidatePanel, /<button/);

  const committedMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
    })
  );
  const commitmentPanel = extractCommitmentPanelMarkup(committedMarkup);
  assert.match(commitmentPanel, /data-lab-execution-commitment="true"/);
  assert.match(commitmentPanel, /Committed/);
  assert.match(commitmentPanel, /Candidate: Viable/);
  assert.match(commitmentPanel, /Chosen recently/);
  assert.match(commitmentPanel, /Payload preview is structurally aligned/);
  assert.match(commitmentPanel, /Alternative paths still trade precision/);
  assert.match(commitmentPanel, /87% confidence/);
  assert.match(commitmentPanel, /data-lab-execution-commitment-revoke="true"/);
  assert.match(commitmentPanel, /Revoke choice/);
  assert.doesNotMatch(commitmentPanel, />\s*(Run|Execute|Apply|Start|Commit)\s*</);
});

test("laboratory execution commitment controls avoid not-viable candidates and execution dispatch", () => {
  const fixture = createPassiveExecutionChainFixture();
  const blockedCandidate = {
    ...fixture.activeCandidate,
    id: `candidate:${fixture.activePlan.id}:blocked`,
    status: "not-viable" as const,
    structuralIntegrity: "insufficient" as const,
    readinessStatus: "blocked" as const,
    reflectionDecision: "avoid" as const,
    summary: "This path is not structurally suitable for execution.",
  };
  const blockedMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: blockedCandidate,
      activeExecutionCommitment: null,
    })
  );

  assert.match(blockedMarkup, /data-lab-execution-commitment-control="true"/);
  assert.match(blockedMarkup, /not structurally suitable for a user choice yet/);
  assert.doesNotMatch(blockedMarkup, /data-lab-execution-commitment-set=/);

  const binderSource = readFileSync(
    "rooms/laboratory/ui/lab-selection-suggestion-binder.ts",
    "utf8"
  );
  assert.match(binderSource, /data-lab-execution-commitment-set/);
  assert.match(binderSource, /workspace-execution-commitment-set/);
  assert.match(binderSource, /data-lab-execution-commitment-revoke/);
  assert.match(binderSource, /workspace-execution-commitment-revoked/);
  assert.doesNotMatch(binderSource, /lab-run-controller|run-started|asset-added/);
});

test("laboratory execution staging UI renders only after a chosen candidate chain", () => {
  const fixture = createPassiveExecutionChainFixture();

  const previewOnlyMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeSuggestionPreview: {
        suggestionId: "audio-inspect",
        title: "Audio preview",
        steps: ["Step 1"],
        expectedOutputs: ["Output"],
      },
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  assert.doesNotMatch(previewOnlyMarkup, /data-lab-execution-staging="true"/);

  const missingChoiceMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: null,
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  assert.doesNotMatch(missingChoiceMarkup, /data-lab-execution-staging="true"/);

  const stagingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  const stagingPanel = extractStagingPanelMarkup(stagingMarkup);
  assert.match(stagingPanel, /data-lab-execution-staging="true"/);
  assert.match(stagingPanel, /Staged/);
  assert.match(stagingPanel, /User choice/);
  assert.match(stagingPanel, /Chosen/);
  assert.match(stagingPanel, /Candidate/);
  assert.match(stagingPanel, /Readiness/);
  assert.match(stagingPanel, /prepared and can be staged/);
  assert.match(stagingPanel, /Alternative paths remain visible/);
  assert.match(stagingPanel, /Candidate uncertainty/);
  assert.match(stagingPanel, /88% confidence/);
});

test("laboratory execution staging UI stays passive and avoids action language", () => {
  const fixture = createPassiveExecutionChainFixture();
  const stagingMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  const stagingPanel = extractStagingPanelMarkup(stagingMarkup);

  assert.doesNotMatch(stagingPanel, /<button/);
  assert.doesNotMatch(stagingPanel, /onclick/);
  assert.doesNotMatch(stagingPanel, /data-lab-action/);
  assert.doesNotMatch(stagingPanel, /data-lab-execution-commitment/);
  assert.doesNotMatch(stagingPanel, /\b(Run|Execute|Apply|Start|Commit|Queue)\b/);
  assert.doesNotMatch(stagingPanel, /commitmentStatus|committed|commitment/i);

  const timelineSource = readFileSync(
    "rooms/laboratory/ui/lab-waveform-timeline-render.ts",
    "utf8"
  );
  assert.match(timelineSource, /data-lab-execution-staging="true"/);
  assert.match(timelineSource, /function renderExecutionStaging/);
  assert.doesNotMatch(timelineSource, /workspace-execution-staging/);
});

test("laboratory execution panels are collapse-first with a non-persistent details overlay", () => {
  const fixture = createPassiveExecutionChainFixture();
  const collapsedMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
    })
  );

  assert.match(collapsedMarkup, /data-lab-collapsible-panel="true"/);
  assert.match(collapsedMarkup, /data-panel-id="simulation"/);
  assert.match(collapsedMarkup, /data-panel-id="payload"/);
  assert.match(collapsedMarkup, /data-panel-id="reflection"/);
  assert.match(collapsedMarkup, /data-panel-id="alternatives"/);
  assert.doesNotMatch(collapsedMarkup, /data-panel-id="plan"/);
  assert.doesNotMatch(collapsedMarkup, /data-panel-id="readiness"/);
  ["simulation", "payload", "reflection", "alternatives"].forEach(function (panelId) {
    assert.doesNotMatch(extractCollapsibleOpeningTag(collapsedMarkup, panelId), /\sopen\b/);
  });
  ["candidate", "commitment", "staging"].forEach(function (panelId) {
    assert.match(extractCollapsibleOpeningTag(collapsedMarkup, panelId), /\sopen\b/);
  });
  assert.doesNotMatch(collapsedMarkup, /data-lab-execution-details-overlay="true"/);

  const overlayMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeOverlay: "execution-details",
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
    })
  );
  assert.match(overlayMarkup, /data-lab-execution-details-overlay="true"/);
  assert.match(overlayMarkup, /data-lab-execution-details-close="true"/);
  const detailsOverlay = extractExecutionDetailsOverlayMarkup(overlayMarkup);
  assert.match(detailsOverlay, /data-lab-execution-plan="true"/);
  assert.match(detailsOverlay, /data-lab-execution-simulation="true"/);
  assert.match(detailsOverlay, /data-lab-execution-readiness="true"/);
  assert.match(detailsOverlay, /data-lab-execution-reflection="true"/);
  assert.match(detailsOverlay, /data-lab-execution-alternatives="true"/);
  assert.doesNotMatch(detailsOverlay, /data-lab-execution-payload-preview="true"/);

  const rootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  assert.match(rootSource, /data-lab-execution-details-open/);
  assert.match(rootSource, /activeOverlay: LabWaveformTimelineModel\["activeOverlay"\]/);
  assert.doesNotMatch(rootSource, /processPanelCollapsedSections/);
  assert.doesNotMatch(rootSource, /workspace-process-section-toggled/);
});

test("laboratory phase 4.95 renders room-local i18n labels in English and Turkish", () => {
  const fixture = createPassiveExecutionChainFixture();
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
  const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });

  const enMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeOverlay: "execution-details",
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
      copy: enCopy,
    })
  );
  const trMarkup = renderLabWaveformTimeline(
    createExecutionReadinessTimelineModel({
      activeOverlay: "execution-details",
      activeExecutionPlan: fixture.activePlan,
      activeExecutionSimulation: fixture.activeSimulation,
      activeExecutionReadiness: fixture.activeReadiness,
      activeExecutionPayloadPreview: fixture.activePayload,
      activeExecutionReflection: fixture.activeReflection,
      activeExecutionAlternatives: fixture.activeAlternatives,
      activeExecutionCandidate: fixture.activeCandidate,
      activeExecutionCommitment: fixture.activeCommitment,
      activeExecutionStaging: fixture.activeStaging,
      copy: trCopy,
    })
  );

  assert.match(enMarkup, /View details/);
  assert.match(enMarkup, /Execution details/);
  assert.match(enMarkup, /Selection/);
  assert.match(enMarkup, /Type/);
  assert.match(enMarkup, /Simulation preview/);
  assert.match(enMarkup, /Execution candidate/);
  assert.match(trMarkup, /Detaylari gor/);
  assert.match(trMarkup, /Calistirma detaylari/);
  assert.match(trMarkup, /Secim/);
  assert.match(trMarkup, /Tip/);
  assert.match(trMarkup, /Simulasyon onizlemesi/);
  assert.match(trMarkup, /Calistirma adayi/);
});

test("laboratory runtime status copy resolves through room-local i18n catalogs", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const enCopy = createLabI18n({ locale: "en", translations: enTranslations });
  const trCopy = createLabI18n({ locale: "tr", translations: trTranslations });

  assert.equal(
    translateLabRuntimeText("Kaynak henüz hazır değil.", enCopy),
    "Source is not ready yet."
  );
  assert.equal(translateLabRuntimeText("Eksik araç: ffmpeg", enCopy), "Missing tool: ffmpeg");
  assert.equal(translateLabRuntimeText("Eksik araç: ffmpeg", trCopy), "Eksik araç: ffmpeg");
  assert.equal(
    formatLabExpectedOutputLabel(
      { intentId: "audio-investigation", label: "Ses çıktısı", assetTypes: ["audio"] },
      enCopy
    ),
    "Audio output"
  );
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

test("laboratory phase 4.95 i18n keys keep English and Turkish catalog parity", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const phaseKeys = [
    "mediaAnalysis.processSummary",
    "mediaAnalysis.rightContext",
    "mediaAnalysis.executionDetails",
    "mediaAnalysis.executionPanels",
    "mediaAnalysis.timeline",
    "mediaAnalysis.topBar",
    "mediaAnalysis.projectWorkspace",
  ];

  function readPath(record: Record<string, unknown>, key: string): unknown {
    return key.split(".").reduce<unknown>(function (current, part) {
      return current && typeof current === "object"
        ? (current as Record<string, unknown>)[part]
        : undefined;
    }, record);
  }

  function collectKeys(value: unknown, prefix = ""): string[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
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

test("laboratory process layer is single-source and old right panel is retired", () => {
  const surfaceSource = readFileSync("rooms/laboratory/ui/workspace-surface.ts", "utf8");
  const drawerSource = readFileSync("rooms/laboratory/ui/lab-drawer.ts", "utf8");
  const processStripSource = readFileSync("rooms/laboratory/ui/lab-process-strip.ts", "utf8");
  const themeSource = readFileSync("rooms/laboratory/ui/lab-theme.css", "utf8");

  assert.doesNotMatch(surfaceSource, /data-lab-global-process="true"/);
  assert.doesNotMatch(surfaceSource, /renderWorkspaceProcessPanel/);
  assert.equal(existsSync("rooms/laboratory/ui/workspace-process-panel.ts"), false);
  assert.match(drawerSource, /getLaboratoryRightPanelContext/);
  assert.match(processStripSource, /getLaboratoryProcessSummary/);
  assert.doesNotMatch(drawerSource, /labx-process-panel/);
  assert.doesNotMatch(themeSource, /labx-process-panel|labx-intent-map|labx-output-trace/);
});
