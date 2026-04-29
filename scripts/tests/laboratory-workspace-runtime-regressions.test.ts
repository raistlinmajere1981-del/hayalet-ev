import {
  assert,
  createDualPreviewSnapshot,
  createLabEventBus,
  createLabRunController,
  createLabStore,
  FakeActionElement,
  FakeControllerDocument,
  FakeDualPreviewDocument,
  FakeHtmlInputElement,
  FakeHtmlSelectElement,
  FakeHtmlTextAreaElement,
  FakeMediaElement,
  FakeRangeElement,
  FakeTextElement,
  getActiveExecutionIntent,
  getIntentDirtyMap,
  getReportFreshness,
  getRunSnapshotSummary,
  getWorkspaceDiff,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";

function createReadySourceStore(reportStatus: "ready" | "stale" | null = null) {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      featureId: "media-analysis",
      ready: true,
      activeProjectId: "project-1",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [{ id: "project-1", name: "lab-demo.mp4", hasSource: true }],
      },
      activeProject: {
        id: "project-1",
        name: "lab-demo.mp4",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/lab-demo.mp4",
          storedFileName: "lab-demo.mp4",
          previewUrl: "file:///tmp/lab-demo.mp4",
          metadata: {
            durationSeconds: 12,
          },
        },
        edit: {},
        profile: {
          preflight: {},
        },
        process: {
          records: {},
        },
        report: {
          records:
            reportStatus === null
              ? {}
              : {
                  "media-analysis": {
                    status: reportStatus,
                  },
                },
        },
        assets: [],
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      sourceProbeStatus: "completed",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
    },
  });
  return store;
}

test("laboratory drawer mode forces setup when source is removed despite old reports", () => {
  const store = createLabStore();
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };
  state.run = {
    id: "run-old-report",
    state: "completed",
    startedAt: Date.now() - 2000,
    endedAt: Date.now() - 1000,
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: 100,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };
  state.reports.user = {
    summary: "Old report",
    confidence: "high",
    topFindings: [],
    suspiciousFrames: [],
    hypothesisResult: null,
    elapsedSeconds: 1,
    moduleSummary: [],
  };

  assert.equal(resolveDrawerMode(store.getState()), "setup");
});

test("laboratory drawer mode routes empty completed runs without reports to explore", () => {
  const store = createReadySourceStore();
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };
  state.run = {
    id: "run-empty",
    state: "completed",
    startedAt: Date.now() - 2000,
    endedAt: Date.now() - 1000,
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: 100,
    emptyReason: "Raporlanabilir bulgu oluşmadı.",
    analysisScope: null,
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  assert.equal(resolveDrawerMode(store.getState()), "explore");
});

test("laboratory report freshness treats feature report records as report payloads", () => {
  const readyStore = createReadySourceStore("ready");
  const readyState = readyStore.getState() as ReturnType<typeof readyStore.getState> & {
    run: Record<string, unknown>;
  };
  readyState.run = {
    id: "run-feature-report",
    state: "completed",
    startedAt: Date.now() - 2000,
    endedAt: Date.now() - 1000,
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: 100,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  assert.deepEqual(getReportFreshness(readyStore.getState()), {
    state: "current",
    workspaceDirty: false,
  });
  assert.equal(resolveDrawerMode(readyStore.getState()), "result");

  const staleStore = createReadySourceStore("stale");
  const staleState = staleStore.getState() as ReturnType<typeof staleStore.getState> & {
    run: Record<string, unknown>;
  };
  staleState.run = {
    ...readyState.run,
    id: "run-stale-report",
    state: "failed",
    error: "Analysis failed",
  };

  assert.deepEqual(getReportFreshness(staleStore.getState()), {
    state: "stale",
    workspaceDirty: false,
  });
  assert.equal(resolveDrawerMode(staleStore.getState()), "explore");
});

test("laboratory store resets semantic and primitive selection state on source changes", () => {
  const store = createLabStore();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "local",
      storedPath: "/tmp/source.wav",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1500,
    endMs: 3600,
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "extract-clip",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "extract-clip",
  });

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      storedPath: "/tmp/new-source.mp4",
    },
  });

  assert.equal(store.getState().ui.workspace.timelineStartMs, null);
  assert.equal(store.getState().ui.workspace.timelineEndMs, null);
  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);
});

test("laboratory store clears semantic and primitive selection state when the active project changes", () => {
  const store = createLabStore();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      storedPath: "/tmp/original.mp4",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1800,
    endMs: 4200,
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "extract-clip",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "extract-clip",
  });

  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(0),
  });

  assert.equal(store.getState().ui.workspace.timelineStartMs, null);
  assert.equal(store.getState().ui.workspace.timelineEndMs, null);
  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);
});

test("laboratory run controller accepts numeric timeline input edits and normalizes invalid ranges", () => {
  const originalInput = Object.getOwnPropertyDescriptor(globalThis, "HTMLInputElement");
  const originalSelect = Object.getOwnPropertyDescriptor(globalThis, "HTMLSelectElement");
  const originalTextArea = Object.getOwnPropertyDescriptor(globalThis, "HTMLTextAreaElement");
  const preview = new FakeMediaElement();
  preview.duration = 10;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([['video[data-lab-preserve-media="workspace-preview"]', preview]]),
    [preview]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "HTMLInputElement", {
    configurable: true,
    value: FakeHtmlInputElement,
  });
  Object.defineProperty(globalThis, "HTMLSelectElement", {
    configurable: true,
    value: FakeHtmlSelectElement,
  });
  Object.defineProperty(globalThis, "HTMLTextAreaElement", {
    configurable: true,
    value: FakeHtmlTextAreaElement,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });

    controller.attach();
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const inputListener = documentRef.listeners.get("input");
    assert.ok(inputListener);

    const startInput = new FakeHtmlInputElement("workspace.timelineStartMs", "1500");
    startInput.type = "number";
    inputListener?.({ target: startInput } as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 3000);
    assert.equal(preview.currentTime, 1.5);

    const validEndInput = new FakeHtmlInputElement("workspace.timelineEndMs", "4200");
    validEndInput.type = "number";
    inputListener?.({ target: validEndInput } as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 4200);
    assert.equal(preview.currentTime, 4.2);

    const invalidEndInput = new FakeHtmlInputElement("workspace.timelineEndMs", "1400");
    invalidEndInput.type = "number";
    inputListener?.({ target: invalidEndInput } as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(preview.currentTime, 4.2);

    const endInput = new FakeHtmlInputElement("workspace.timelineEndMs", "");
    endInput.type = "number";
    inputListener?.({ target: endInput } as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(preview.currentTime, 4.2);
  } finally {
    if (originalInput) {
      Object.defineProperty(globalThis, "HTMLInputElement", originalInput);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLInputElement;
    }
    if (originalSelect) {
      Object.defineProperty(globalThis, "HTMLSelectElement", originalSelect);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLSelectElement;
    }
    if (originalTextArea) {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", originalTextArea);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLTextAreaElement;
    }
  }
});

test("laboratory run controller keeps invalid scope time ranges out of the analysis draft", () => {
  const originalInput = Object.getOwnPropertyDescriptor(globalThis, "HTMLInputElement");
  const originalSelect = Object.getOwnPropertyDescriptor(globalThis, "HTMLSelectElement");
  const originalTextArea = Object.getOwnPropertyDescriptor(globalThis, "HTMLTextAreaElement");
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "HTMLInputElement", {
    configurable: true,
    value: FakeHtmlInputElement,
  });
  Object.defineProperty(globalThis, "HTMLSelectElement", {
    configurable: true,
    value: FakeHtmlSelectElement,
  });
  Object.defineProperty(globalThis, "HTMLTextAreaElement", {
    configurable: true,
    value: FakeHtmlTextAreaElement,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });

    controller.attach();

    const inputListener = documentRef.listeners.get("input");
    assert.ok(inputListener);

    const scopeStart = new FakeHtmlInputElement("scope.timeStartMs", "2500");
    scopeStart.type = "number";
    inputListener?.({ target: scopeStart } as Event);

    const scopeEnd = new FakeHtmlInputElement("scope.timeEndMs", "2000");
    scopeEnd.type = "number";
    inputListener?.({ target: scopeEnd } as Event);

    const analysisScope = (store.getState().workbench["analysisScope"] || {}) as Record<
      string,
      unknown
    >;
    assert.equal((analysisScope["timeRange"] as Record<string, unknown> | undefined) ?? null, null);
  } finally {
    if (originalInput) {
      Object.defineProperty(globalThis, "HTMLInputElement", originalInput);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLInputElement;
    }
    if (originalSelect) {
      Object.defineProperty(globalThis, "HTMLSelectElement", originalSelect);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLSelectElement;
    }
    if (originalTextArea) {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", originalTextArea);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLTextAreaElement;
    }
  }
});

test("laboratory run controller keeps dual preview media in sync and timeline seeks honor audio offset", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  const progress = new FakeRangeElement("0", "6000");
  const volume = new FakeRangeElement("1", "1");
  const playLabel = new FakeTextElement("▶");
  const timeLabel = new FakeTextElement("00:00 / 00:06");
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
      ['[data-lab-role="dual-preview-progress"]', progress],
      ['[data-lab-role="dual-preview-volume"]', volume],
      ['[data-lab-role="dual-preview-play-label"]', playLabel],
      ['[data-lab-role="dual-preview-time"]', timeLabel],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    master.duration = 6;
    slave.duration = 8;

    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(250),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    await Promise.resolve();

    assert.equal(master.muted, true);
    assert.equal(slave.volume, 1);
    assert.equal(slave.currentTime, 0.25);

    master.currentTime = 1;
    await master.play();
    assert.equal(slave.playCalls > 0, true);
    assert.equal(slave.currentTime, 1.25);

    store.dispatch({
      type: "workspace-dual-preview-volume-updated",
      volume: 0.4,
    });
    assert.equal(slave.volume, 0.4);

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener?.({ target: new TestElement("timeline-seek", "2000") } as Event);

    assert.equal(master.currentTime, 2);
    assert.equal(slave.currentTime, 2.25);
    assert.equal(progress.value, "2000");
    assert.match(timeLabel.textContent || "", /00:02 \/ 00:06/);

    master.pause();
    assert.equal(slave.pauseCalls > 0, true);
    assert.equal(playLabel.textContent, "▶");
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller fences legacy timeline seek fallback while dual preview is active", () => {
  const originalElement = globalThis.Element;
  const standaloneMedia = new FakeMediaElement();
  const documentRef = new FakeDualPreviewDocument(new Map<string, unknown>(), [standaloneMedia]);
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("timeline-seek", "2000") } as Event);

    assert.equal(standaloneMedia.currentTime, 0);
    assert.equal(
      store
        .getState()
        .activityFeed.some((entry) => entry.message.includes("Dual preview seek is unavailable")),
      true
    );
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller waits for slave metadata before applying dual preview seeks", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  slave.readyState = 0;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    master.duration = 6;
    slave.duration = 8;

    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(500),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    master.currentTime = 2;
    master.dispatch("seeked");
    assert.equal(slave.currentTime, 0);

    slave.readyState = 1;
    slave.dispatch("loadedmetadata");
    await Promise.resolve();

    assert.equal(slave.currentTime, 2.5);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller pauses the master if the dual preview slave ends early", () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeActionElement,
  });

  try {
    master.duration = 6;
    slave.duration = 3;

    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    master.paused = false;
    slave.dispatch("ended");

    assert.equal(master.pauseCalls > 0, true);
    assert.equal(master.paused, true);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller does not spam slave autoplay retries after a blocked attempt", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  slave.failPlay = true;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeActionElement,
  });

  try {
    master.duration = 6;
    slave.duration = 6;

    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    await master.play();
    await Promise.resolve();
    const firstPlayCalls = slave.playCalls;

    master.dispatch("timeupdate");
    await Promise.resolve();
    assert.equal(slave.playCalls, firstPlayCalls);

    slave.failPlay = false;
    master.pause();
    await master.play();
    await Promise.resolve();
    assert.equal(slave.playCalls > firstPlayCalls, true);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory store wires live findings and preview artifacts from custom runtime events", () => {
  const store = createLabStore();
  const eventTimestamp = Date.now();
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-scope",
      kind: "analysis-scope-updated",
      severity: "info",
      message: "Analysis scope locked",
      detail: "Visual ROI active",
      timestamp: eventTimestamp,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
      analysisScope: {
        focus: "visual",
        hypothesis: "gorunmeyen obje olabilir",
        region: {
          x: 12,
          y: 18,
          width: 160,
          height: 90,
        },
      },
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-live",
      kind: "live-finding",
      severity: "warning",
      message: "Live finding emitted",
      detail: "Edge cluster batched",
      timestamp: eventTimestamp + 1,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
      finding: {
        id: "finding-live-1",
        moduleId: "motion",
        title: "Edge cluster anomaly",
        detail: "Contrast window exposed a hidden contour.",
        level: "medium",
        confidence: "medium",
        kind: "derived",
        evidenceCount: 3,
        artifactIds: ["preview-live-1"],
        frameRange: {
          startFrame: 12,
          endFrame: 24,
        },
      },
      moduleTrace: {
        id: "trace-live-1",
        moduleId: "motion",
        stage: "process",
        status: "finding",
        timestamp: new Date(eventTimestamp + 1).toISOString(),
        message: "Live finding emitted",
        detail: "Edge cluster batched",
      },
      throttleWindow: "motion-module-batch",
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-preview",
      kind: "preview-artifact",
      severity: "info",
      message: "Preview artifact ready",
      detail: "Frame preview",
      timestamp: eventTimestamp + 2,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
      artifact: {
        id: "preview-live-1",
        moduleId: "motion",
        kind: "frame-preview",
        label: "Frame preview",
        path: "/tmp/frame-preview.png",
        fileName: "frame-preview.png",
        previewUrl: "file:///tmp/frame-preview.png",
        createdAt: new Date(eventTimestamp + 2).toISOString(),
        active: true,
      },
    },
  });

  const state = store.getState();
  assert.equal(state.run?.analysisScope?.focus, "visual");
  assert.equal(state.run?.analysisScope?.hypothesis, "gorunmeyen obje olabilir");
  assert.equal(state.run?.liveFindings[0]?.id, "finding-live-1");
  assert.equal(state.run?.liveFindings[0]?.windowKey, "motion-module-batch");
  assert.equal(state.run?.previewArtifacts[0]?.id, "preview-live-1");
  assert.equal(state.ui.activePreviewArtifactId, "preview-live-1");
  assert.equal(
    state.run?.moduleTrace.some(function (entry) {
      return entry.id === "trace-live-1";
    }),
    true
  );
});

test("laboratory store hydration normalizes live runs into safe persisted summaries", () => {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor yok.",
      },
      activityFeed: [],
      lastRun: {
        id: "run-1",
        state: "running",
        startedAt: Date.now() - 1000,
        modules: {
          motion: {
            id: "motion",
            status: "running",
            progress: null,
            progressMode: "none",
            message: "Analiz suruyor",
          },
        },
        moduleOrder: ["motion"],
        events: [
          {
            id: "evt-persisted",
            kind: "activity",
            severity: "info",
            message: "Analiz basladi",
            detail: null,
            timestamp: Date.now() - 900,
            source: "host",
            action: "process-run",
            stage: "running",
            scope: "run",
            moduleId: null,
            rawLine: null,
          },
          {
            id: "evt-raw",
            kind: "raw-log",
            severity: "info",
            message: "frame= 24",
            detail: null,
            timestamp: Date.now() - 800,
            source: "host",
            action: "process-run",
            stage: "stdout",
            scope: "run",
            moduleId: "motion",
            rawLine: "frame= 24",
          },
        ],
        rawLog: [
          {
            id: "evt-raw",
            kind: "raw-log",
            severity: "info",
            message: "frame= 24",
            detail: null,
            timestamp: Date.now() - 800,
            source: "host",
            action: "process-run",
            stage: "stdout",
            scope: "run",
            moduleId: "motion",
            rawLine: "frame= 24",
          },
        ],
        artifacts: [],
        findings: [],
        liveFindings: [
          {
            id: "live-1",
            moduleId: "motion",
            title: "Scope-local anomaly",
            detail: "Frame window highlighted an unstable edge cluster.",
            level: "medium",
            severity: "warning",
            confidence: "medium",
            kind: "derived",
            evidenceCount: 2,
            artifactIds: [],
            emittedAt: Date.now() - 850,
            windowKey: "frame-window-1",
            streamId: "media-analysis",
            frameRange: {
              startFrame: 24,
              endFrame: 48,
            },
          },
        ],
        warnings: [],
        error: null,
        targetLabel: null,
        progress: null,
        emptyReason: null,
        analysisScope: {
          frameRange: {
            startFrame: 24,
            endFrame: 48,
          },
          focus: "visual",
          hypothesis: "Gorunmeyen obje olabilir",
        },
        previewArtifacts: [
          {
            id: "preview-1",
            moduleId: "motion",
            kind: "frame-preview",
            label: "Frame preview",
            path: "/tmp/frame-preview.png",
            fileName: "frame-preview.png",
            previewUrl: "file:///tmp/frame-preview.png",
            createdAt: new Date(Date.now() - 750).toISOString(),
            status: "ready",
            active: true,
            region: {
              x: 10,
              y: 20,
              width: 120,
              height: 90,
            },
          },
        ],
        confidence: "medium",
        moduleTrace: [
          {
            id: "trace-1",
            moduleId: "motion",
            stage: "process",
            status: "running",
            timestamp: new Date(Date.now() - 950).toISOString(),
            message: "Frame batch analyzed",
            detail: "Window aggregation active",
            eventId: "evt-persisted",
          },
        ],
        comparisonVariants: [
          {
            id: "variant-1",
            kind: "gamma-scan",
            label: "Gamma Scan",
            status: "ready",
            summary: "Mid-band emphasis",
            artifactIds: ["preview-1"],
          },
        ],
        hypothesisSummary: "Gorunmeyen obje olabilir",
      },
    },
  });

  const state = store.getState();
  assert.equal(state.run?.state, "cancelled");
  assert.equal(state.run?.modules["motion"]?.status, "cancelled");
  assert.equal(state.run?.events.length, 1);
  assert.equal(state.run?.events[0]?.kind, "activity");
  assert.equal(state.run?.rawLog.length, 1);
  assert.equal(state.run?.analysisScope?.focus, "visual");
  assert.equal(state.run?.analysisScope?.lifecycle?.mutable, false);
  assert.equal(state.run?.liveFindings[0]?.windowKey, "frame-window-1");
  assert.equal(state.run?.previewArtifacts[0]?.kind, "frame-preview");
  assert.equal(state.run?.comparisonVariants[0]?.kind, "gamma-scan");
  assert.equal(state.run?.hypothesisSummary, "Gorunmeyen obje olabilir");
});

test("laboratory selectors expose frozen snapshot summary and live workspace drift separately", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "completed",
      workspace: {
        ...baseWorkspace,
        timelineStartMs: 2400,
        timelineEndMs: 5600,
        hypothesis: "live workspace clue",
        selectedIntents: ["visual-inspection"],
      },
      reports: {
        user: {
          summary: "ready",
          confidence: "medium",
          topFindings: [],
          suspiciousFrames: [],
          hypothesisResult: "frozen clue",
          elapsedSeconds: 5,
          moduleSummary: [],
        },
        ai: null,
        emptyReason: null,
      },
      activityFeed: [],
      lastRun: {
        id: "run-1",
        state: "completed",
        startedAt: Date.now() - 5000,
        endedAt: Date.now() - 1000,
        modules: {},
        moduleOrder: [],
        events: [],
        rawLog: [],
        artifacts: [],
        findings: [],
        liveFindings: [],
        warnings: [],
        error: null,
        targetLabel: null,
        progress: 100,
        emptyReason: null,
        analysisScope: {
          focus: "visual",
          timeRange: {
            startMs: 1200,
            endMs: 5400,
          },
          hypothesis: "frozen clue",
          intentIds: ["visual-inspection", "anomaly-detection"],
        },
        previewArtifacts: [],
        confidence: "medium",
        moduleTrace: [],
        comparisonVariants: [],
        hypothesisSummary: "frozen clue",
      },
    },
  });

  const state = store.getState();
  assert.deepEqual(getRunSnapshotSummary(state), {
    focus: "visual",
    timelineStartMs: 1200,
    timelineEndMs: 5400,
    hypothesis: "frozen clue",
    intentIds: ["visual-inspection", "anomaly-detection"],
  });
  assert.deepEqual(getIntentDirtyMap(state), {
    "visual-inspection": {
      intentId: "visual-inspection",
      inSnapshot: true,
      inWorkspace: true,
      dirty: true,
      changedKeys: ["timeline", "hypothesis"],
    },
    "anomaly-detection": {
      intentId: "anomaly-detection",
      inSnapshot: true,
      inWorkspace: false,
      dirty: true,
      changedKeys: ["selection", "timeline", "hypothesis"],
    },
  });
  assert.deepEqual(getWorkspaceDiff(state), {
    timelineChanged: true,
    hypothesisChanged: true,
    intentsChanged: true,
    workspaceDirty: true,
    changedKeys: ["timeline", "hypothesis", "intents"],
  });
  assert.deepEqual(getReportFreshness(state), {
    state: "current",
    workspaceDirty: true,
  });
  assert.deepEqual(state.run?.analysisScope?.intentIds, ["visual-inspection", "anomaly-detection"]);
  assert.deepEqual(state.ui.workspace.selectedIntents, ["visual-inspection"]);
});
