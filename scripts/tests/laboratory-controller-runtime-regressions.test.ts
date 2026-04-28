import {
  assert,
  bindLabAssetPreviewClicks,
  createDualPreviewSnapshot,
  createLabEventBus,
  createLabRunController,
  createLabStore,
  FakeActionElement,
  FakeControllerDocument,
  FakeDualPreviewDocument,
  FakeMediaElement,
  FakeMouseEvent,
  FakePlayheadElement,
  FakeTextElement,
  FakeTimelineActionElement,
  FakeTimelineRoot,
  FakeTimelineTrack,
  FakeWindowEventTarget,
  getActiveInspectionSnapshot,
  getActiveSelection,
  getInspectionMode,
  getRoiFocusActive,
  getSelectionDuration,
  getSelectionIntent,
  importLabRootModuleWithDomStub,
  installTimerMock,
  isSelectionValid,
  LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";

test("laboratory run controller dismisses successful user actions from the topbar after the success window", () => {
  const timerMock = installTimerMock();

  try {
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });
    createLabRunController({
      documentRef: {} as Document,
      eventBus,
      store,
      windowRef: {} as Window,
    });

    eventBus.emit({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-success",
        type: "export-clip",
        label: "Klip çıkarılıyor",
        status: "running",
        startedAt: Date.now() - 1000,
        dismissedFromHubAt: null,
        projectId: "project-1",
        requestId: "req-export-1",
        sourceAction: "export-timeline-clip",
      },
    });

    assert.equal(timerMock.scheduled.length, 0);

    eventBus.emit({
      type: "user-action-updated",
      id: "user-action-success",
      patch: {
        status: "success",
        finishedAt: Date.now(),
        message: "Klip hazır",
      },
    });

    assert.equal(timerMock.scheduled.length, 1);
    assert.equal(timerMock.scheduled[0]?.delay, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS);
    assert.equal(store.getState().userActions[0]?.dismissedFromHubAt, null);

    timerMock.scheduled[0]?.fn();

    assert.equal(typeof store.getState().userActions[0]?.dismissedFromHubAt, "number");
  } finally {
    timerMock.restore();
  }
});

test("laboratory run controller waits for linked assets before dismissing success chips", () => {
  const timerMock = installTimerMock();

  try {
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });
    createLabRunController({
      documentRef: {} as Document,
      eventBus,
      store,
      windowRef: {} as Window,
    });

    eventBus.emit({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-success-pending-output",
        type: "grab-frame",
        label: "Frame alınıyor",
        status: "success",
        startedAt: Date.now() - 3000,
        finishedAt: Date.now() - 1000,
        message: "Frame alındı",
        requestId: "req-frame-success",
        resultAssetIds: ["asset-frame-result"],
        sourceAction: "export-frame-grab",
      },
    });

    assert.equal(timerMock.scheduled.length, 0);

    eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-frame-result",
        type: "frame",
        name: "frame_01.png",
        localPath: "/tmp/frame_01.png",
        createdAt: Date.now(),
      },
    });

    assert.equal(timerMock.scheduled.length, 1);
    assert.equal(timerMock.scheduled[0]?.delay, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS);
  } finally {
    timerMock.restore();
  }
});

test("laboratory run controller threads frozen run intent ids into tracked export actions", () => {
  const originalElement = globalThis.Element;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const documentRef = new FakeControllerDocument();
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
          sendEvent(eventName: string, payload: Record<string, unknown>) {
            sentEvents.push({ eventName, payload });
          },
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const state = store.getState() as ReturnType<typeof store.getState> & {
      run: Record<string, unknown>;
    };
    state.run = {
      id: "run-controller-intents",
      state: "running",
      startedAt: Date.now() - 1000,
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
      progress: 10,
      emptyReason: null,
      analysisScope: {
        focus: "visual",
        intentIds: ["visual-inspection"],
      },
      previewArtifacts: [],
      confidence: null,
      moduleTrace: [],
      comparisonVariants: [],
      hypothesisSummary: null,
    };
    state.ui.workspace.roiRegions = [
      {
        id: "face",
        label: "Face",
        x: 8,
        y: 12,
        width: 120,
        height: 80,
      },
    ];
    state.ui.workspace.timelineStartMs = 1200;
    state.ui.workspace.timelineEndMs = 2400;

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("workspace-roi-export", "face") } as Event);
    clickListener?.({ target: new TestElement("timeline-export-clip") } as Event);
    clickListener?.({ target: new TestElement("timeline-grab-frame") } as Event);
    clickListener?.({ target: new TestElement("timeline-extract-audio") } as Event);

    const mediaActions = sentEvents.filter(function (entry) {
      return entry.eventName === "media-action";
    });
    assert.equal(mediaActions.length, 4);
    assert.deepEqual(
      mediaActions.map(function (entry) {
        return (entry.payload["action"] as string) || null;
      }),
      ["export-roi-image", "export-timeline-clip", "export-frame-grab", "export-audio-track"]
    );
    mediaActions.forEach(function (entry) {
      const payload = entry.payload["payload"] as Record<string, unknown>;
      assert.deepEqual(payload["intentIds"], ["visual-inspection"]);
    });
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

test("laboratory asset preview binder opens action-linked assets through the room overlay", async () => {
  const originalElement = globalThis.Element;
  const emittedAssetIds: string[] = [];
  const documentRef = new FakeControllerDocument();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    bindLabAssetPreviewClicks({
      documentRef: documentRef as unknown as Document,
      emit(event) {
        if (event.type === "asset-preview-opened") {
          emittedAssetIds.push(event.assetId);
        }
      },
      resolveHref(assetId) {
        return assetId === "asset-frame-result" ? "/tmp/frame_01.png" : null;
      },
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    let prevented = false;
    let stopped = false;
    clickListener?.({
      target: new TestElement("asset-preview", "asset-frame-result"),
      preventDefault() {
        prevented = true;
      },
      stopImmediatePropagation() {
        stopped = true;
      },
    } as Event);
    await Promise.resolve();

    assert.equal(prevented, true);
    assert.equal(stopped, true);
    assert.deepEqual(emittedAssetIds, ["asset-frame-result"]);
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

test("laboratory asset preview binder does not spawn blank windows for room previews", async () => {
  const originalElement = globalThis.Element;
  const emittedAssetIds: string[] = [];
  const documentRef = new FakeControllerDocument();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    bindLabAssetPreviewClicks({
      documentRef: documentRef as unknown as Document,
      emit(event) {
        if (event.type === "asset-preview-opened") {
          emittedAssetIds.push(event.assetId);
        }
      },
      resolveHref(assetId) {
        return assetId === "asset-audio-preview" ? "/tmp/track.wav" : null;
      },
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("asset-preview", "asset-audio-preview") } as Event);
    await Promise.resolve();

    assert.deepEqual(emittedAssetIds, ["asset-audio-preview"]);
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

test("laboratory run controller focuses the source preview through explicit source-preview actions", () => {
  const originalElement = globalThis.Element;
  const previewCalls: string[] = [];
  const previewElement = {
    scrollIntoView() {
      previewCalls.push("scroll");
    },
    focus() {
      previewCalls.push("focus");
    },
  };
  const documentRef = {
    listeners: new Map<string, (event: Event) => void>(),
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.set(
        type,
        typeof listener === "function"
          ? (listener as (event: Event) => void)
          : (event: Event) => listener.handleEvent(event)
      );
    },
    querySelector(selector: string) {
      return selector === "#lab-workspace-preview" ? previewElement : null;
    },
  };
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

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("focus-source-preview", "source-active") } as Event);

    assert.deepEqual(previewCalls, ["scroll", "focus"]);
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

test("laboratory run controller wires v2 shell action buttons into workspace state", () => {
  const originalElement = globalThis.Element;
  const originalInput = globalThis.HTMLInputElement;
  const originalSelect = globalThis.HTMLSelectElement;
  const originalTextarea = globalThis.HTMLTextAreaElement;
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}
  class TestInputElement {}
  class TestSelectElement {}
  class TestTextareaElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });
  Object.defineProperty(globalThis, "HTMLInputElement", {
    configurable: true,
    value: TestInputElement,
  });
  Object.defineProperty(globalThis, "HTMLSelectElement", {
    configurable: true,
    value: TestSelectElement,
  });
  Object.defineProperty(globalThis, "HTMLTextAreaElement", {
    configurable: true,
    value: TestTextareaElement,
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

    const clickListener = documentRef.listeners.get("click");
    const keyListener = documentRef.listeners.get("keydown");
    assert.ok(clickListener);
    assert.ok(keyListener);

    clickListener?.({ target: new TestElement("drawer-collapsed-toggled") } as Event);
    assert.equal(store.getState().ui.workspace.drawerCollapsed, true);

    let prevented = false;
    keyListener?.({
      ctrlKey: true,
      key: "b",
      target: new TestElement("not-a-text-control"),
      preventDefault() {
        prevented = true;
      },
    } as unknown as Event);
    assert.equal(prevented, true);
    assert.equal(store.getState().ui.workspace.drawerCollapsed, false);

    clickListener?.({ target: new TestElement("workspace-intent-toggle", "visual-inspection") } as Event);
    assert.deepEqual(store.getState().ui.workspace.selectedIntents, ["visual-inspection"]);

    clickListener?.({ target: new TestElement("workspace-process-view-toggled") } as Event);
    assert.equal(store.getState().ui.workspace.processViewActive, true);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (originalInput === undefined) {
      delete (globalThis as Record<string, unknown>).HTMLInputElement;
    } else {
      Object.defineProperty(globalThis, "HTMLInputElement", {
        configurable: true,
        value: originalInput,
      });
    }
    if (originalSelect === undefined) {
      delete (globalThis as Record<string, unknown>).HTMLSelectElement;
    } else {
      Object.defineProperty(globalThis, "HTMLSelectElement", {
        configurable: true,
        value: originalSelect,
      });
    }
    if (originalTextarea === undefined) {
      delete (globalThis as Record<string, unknown>).HTMLTextAreaElement;
    } else {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", {
        configurable: true,
        value: originalTextarea,
      });
    }
  }
});

test("laboratory run controller routes topbar pills and cancel through v2 contracts", () => {
  const originalElement = globalThis.Element;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const documentRef = new FakeControllerDocument();
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
          sendEvent(eventName: string, payload: Record<string, unknown>) {
            sentEvents.push({ eventName, payload });
          },
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const state = store.getState() as ReturnType<typeof store.getState> & {
      run: Record<string, unknown>;
      source: Record<string, unknown>;
      sourceProbeStatus: "idle" | "running" | "completed" | "failed";
    };
    state.source = {
      kind: "video",
      mode: "local",
      status: "ready",
      storedPath: "/tmp/lab-demo.mp4",
    };
    state.sourceProbeStatus = "completed";
    state.run = {
      id: "run-v2-shell-actions",
      state: "completed",
      startedAt: Date.now() - 2000,
      completedAt: Date.now() - 1000,
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
        intentIds: ["visual-inspection"],
      },
      previewArtifacts: [],
      confidence: "high",
      moduleTrace: [],
      comparisonVariants: [],
      hypothesisSummary: null,
    };
    state.reports.user = {
      summary: "Report ready",
      confidence: "high",
      topFindings: [],
      suspiciousFrames: [],
      hypothesisResult: null,
      elapsedSeconds: 1,
      moduleSummary: [],
    };

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("drawer-explore-toggled") } as Event);
    assert.equal(resolveDrawerMode(store.getState()), "explore");

    clickListener?.({ target: new TestElement("topbar-pill-results") } as Event);
    assert.equal(store.getState().ui.workspace.drawerModeOverride, "result");
    assert.equal(resolveDrawerMode(store.getState()), "result");

    clickListener?.({ target: new TestElement("topbar-pill-source") } as Event);
    assert.equal(store.getState().ui.workspace.drawerModeOverride, "setup");
    assert.equal(resolveDrawerMode(store.getState()), "setup");

    const runningState = store.getState() as ReturnType<typeof store.getState> & {
      run: Record<string, unknown>;
    };
    runningState.run = {
      ...runningState.run,
      state: "running",
      completedAt: null,
      progress: 42,
    };
    clickListener?.({ target: new TestElement("cancel-analysis") } as Event);

    assert.equal(sentEvents.length, 1);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0]?.payload["action"], "process-cancel");
    assert.equal((sentEvents[0]?.payload["payload"] as Record<string, unknown>)["featureId"], "media-analysis");
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

test("laboratory run controller syncs the unified timeline playhead to the active preview media", async () => {
  const preview = new FakeMediaElement();
  preview.duration = 5;
  preview.currentTime = 1.25;
  const playhead = new FakePlayheadElement();
  const playheadLabel = new FakeTextElement(null);
  const timelineRoot = { dataset: { duration: "5000" } };
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['video[data-lab-preserve-media="workspace-preview"]', preview],
      ['[data-lab-role="timeline-playhead"]', playhead],
      ['[data-lab-role="timeline-playhead-label"]', playheadLabel],
      [".labx-timeline", timelineRoot],
    ]),
    [preview]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

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
  await Promise.resolve();

  assert.equal(playhead.style.left, "25%");
  assert.equal(playhead.attributes.get("data-active"), "true");
  assert.equal(playheadLabel.textContent, "00:01.250");

  preview.currentTime = 2.5;
  preview.dispatch("timeupdate");

  assert.equal(playhead.style.left, "50%");
  assert.equal(playheadLabel.textContent, "00:02.500");
});

test("laboratory run controller rebinds the unified timeline playhead between single preview and dual preview master", async () => {
  const singlePreview = new FakeMediaElement();
  singlePreview.duration = 6;
  singlePreview.currentTime = 1;
  const master = new FakeMediaElement();
  master.duration = 6;
  master.currentTime = 2;
  const slave = new FakeMediaElement();
  slave.duration = 8;
  const playhead = new FakePlayheadElement();
  const playheadLabel = new FakeTextElement(null);
  const timelineRoot = { dataset: { duration: "6000" } };
  const queryMap = new Map<string, unknown>([
    ['video[data-lab-preserve-media="workspace-preview"]', singlePreview],
    ['[data-lab-role="dual-preview-master"]', master],
    ['[data-lab-role="dual-preview-slave"]', slave],
    ['[data-lab-role="timeline-playhead"]', playhead],
    ['[data-lab-role="timeline-playhead-label"]', playheadLabel],
    [".labx-timeline", timelineRoot],
  ]);
  const documentRef = new FakeDualPreviewDocument(queryMap, [singlePreview, master, slave]);
  const eventBus = createLabEventBus();
  const store = createLabStore();

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
  await Promise.resolve();

  assert.equal(playhead.style.left, "16.666666666666664%");
  assert.equal(playheadLabel.textContent, "00:01.000");

  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(),
  });
  store.dispatch({
    type: "workspace-dual-preview-toggled",
    force: true,
    audioAssetId: "asset-audio-linked",
  });
  await Promise.resolve();

  assert.equal(playhead.style.left, "33.33333333333333%");
  assert.equal(playheadLabel.textContent, "00:02.000");

  singlePreview.currentTime = 4;
  singlePreview.dispatch("timeupdate");
  assert.equal(playhead.style.left, "33.33333333333333%");

  master.currentTime = 3;
  master.dispatch("timeupdate");
  assert.equal(playhead.style.left, "50%");
  assert.equal(playheadLabel.textContent, "00:03.000");

  store.dispatch({
    type: "workspace-dual-preview-toggled",
    force: false,
  });
  await Promise.resolve();

  singlePreview.dispatch("timeupdate");
  assert.equal(playhead.style.left, "66.66666666666666%");
  assert.equal(playheadLabel.textContent, "00:04.000");
});

test("laboratory run controller keeps click-to-seek and drag-to-select separated by the rail threshold", () => {
  const originalElement = globalThis.Element;
  const originalMouseEvent = globalThis.MouseEvent;
  const preview = new FakeMediaElement();
  preview.duration = 10;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([['video[data-lab-preserve-media="workspace-preview"]', preview]]),
    [preview]
  );
  const windowRef = new FakeWindowEventTarget();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const track = new FakeTimelineTrack(100, 1000);
  const timeline = new FakeTimelineRoot(track, 10000);

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeTimelineActionElement,
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: FakeMouseEvent,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: windowRef as unknown as Window,
    });

    controller.attach();

    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = windowRef.listeners.get("mousemove");
    const mouseUpListener = windowRef.listeners.get("mouseup");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(mouseUpListener);

    const railTarget = new FakeTimelineActionElement("timeline-interact", timeline);

    mouseDownListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
    );
    mouseMoveListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 352) as unknown as Event
    );
    mouseUpListener?.({} as Event);

    assert.equal(preview.currentTime, 2.5);
    assert.equal(store.getState().ui.workspace.timelineStartMs, null);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);

    mouseDownListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
    );
    mouseMoveListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 550) as unknown as Event
    );
    mouseUpListener?.({} as Event);

    assert.equal(preview.currentTime, 2.5);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 2500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 4500);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (originalMouseEvent === undefined) {
      delete (globalThis as Record<string, unknown>).MouseEvent;
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

test("laboratory run controller drags timeline start and end handles independently", () => {
  const originalElement = globalThis.Element;
  const originalMouseEvent = globalThis.MouseEvent;
  const documentRef = new FakeControllerDocument();
  const windowRef = new FakeWindowEventTarget();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const track = new FakeTimelineTrack(100, 1000);
  const timeline = new FakeTimelineRoot(track, 10000);

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeTimelineActionElement,
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: FakeMouseEvent,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: windowRef as unknown as Window,
    });

    controller.attach();
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = windowRef.listeners.get("mousemove");
    const mouseUpListener = windowRef.listeners.get("mouseup");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(mouseUpListener);

    mouseDownListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-drag-start", timeline) as unknown as EventTarget,
        200
      ) as unknown as Event
    );
    mouseMoveListener?.({ clientX: 150 } as MouseEvent);
    mouseUpListener?.({} as Event);

    assert.equal(store.getState().ui.workspace.timelineStartMs, 500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 3000);

    mouseDownListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-drag-end", timeline) as unknown as EventTarget,
        400
      ) as unknown as Event
    );
    mouseMoveListener?.({ clientX: 650 } as MouseEvent);
    mouseUpListener?.({} as Event);

    assert.equal(store.getState().ui.workspace.timelineStartMs, 500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 5500);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (originalMouseEvent === undefined) {
      delete (globalThis as Record<string, unknown>).MouseEvent;
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

test("laboratory run controller drags the timeline selection body from the pointer-down offset", () => {
  const originalElement = globalThis.Element;
  const originalMouseEvent = globalThis.MouseEvent;
  const documentRef = new FakeControllerDocument();
  const windowRef = new FakeWindowEventTarget();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const track = new FakeTimelineTrack(100, 1000);
  const timeline = new FakeTimelineRoot(track, 10000);

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeTimelineActionElement,
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: FakeMouseEvent,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: windowRef as unknown as Window,
    });

    controller.attach();
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = windowRef.listeners.get("mousemove");
    const mouseUpListener = windowRef.listeners.get("mouseup");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(mouseUpListener);

    const actionTarget = new FakeTimelineActionElement("timeline-drag-body", timeline);

    mouseDownListener?.(
      new FakeMouseEvent(actionTarget as unknown as EventTarget, 250) as unknown as Event
    );
    mouseMoveListener?.(
      new FakeMouseEvent(actionTarget as unknown as EventTarget, 650) as unknown as Event
    );

    assert.equal(store.getState().ui.workspace.timelineStartMs, 5000);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 7000);

    mouseUpListener?.({} as Event);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (originalMouseEvent === undefined) {
      delete (globalThis as Record<string, unknown>).MouseEvent;
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

test("laboratory run controller applies timeline finetune and clear actions from the unified timeline", () => {
  const originalElement = globalThis.Element;
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const timeline = new FakeTimelineRoot(new FakeTimelineTrack(100, 1000), 10000);

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeTimelineActionElement,
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
    store.dispatch({
      type: "workspace-selection-intent-updated",
      intent: "audio",
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement(
          "timeline-finetune",
          timeline,
          "start:+100"
        ) as unknown as EventTarget,
        0
      ) as unknown as Event
    );
    clickListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement(
          "timeline-finetune",
          timeline,
          "end:-500"
        ) as unknown as EventTarget,
        0
      ) as unknown as Event
    );

    assert.equal(store.getState().ui.workspace.timelineStartMs, 1100);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 2500);
    assert.equal(store.getState().ui.workspace.activeSelection?.intent, "audio");

    clickListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-clear", timeline) as unknown as EventTarget,
        0
      ) as unknown as Event
    );

    assert.equal(store.getState().ui.workspace.timelineStartMs, null);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(getSelectionIntent(store.getState()), "unknown");
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

test("laboratory store promotes timeline ranges into stable selection entities", () => {
  const store = createLabStore();

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });

  const firstSelection = store.getState().ui.workspace.activeSelection;
  assert.ok(firstSelection);
  assert.equal(firstSelection?.type, "clip");
  assert.equal(firstSelection?.intent, "general");
  assert.equal(firstSelection?.startMs, 1000);
  assert.equal(firstSelection?.endMs, 3000);
  assert.ok(typeof firstSelection?.id === "string" && firstSelection.id.length > 0);
  assert.equal(getActiveSelection(store.getState())?.id, firstSelection?.id);
  assert.equal(isSelectionValid(store.getState()), true);
  assert.equal(getSelectionDuration(store.getState()), 2000);
  assert.equal(getSelectionIntent(store.getState()), "general");

  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });

  assert.equal(getSelectionIntent(store.getState()), "audio");

  store.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.1,
      y: 0.15,
      width: 0.3,
      height: 0.35,
    },
  });

  assert.deepEqual(store.getState().ui.workspace.activeSelection?.roi, {
    x: 0.1,
    y: 0.15,
    width: 0.3,
    height: 0.35,
  });
  store.dispatch({
    type: "selection-roi-focus-set",
    active: true,
  });
  store.dispatch({
    type: "selection-roi-snapshot-set",
    snapshot: {
      id: "selection-snapshot",
      objectUrl: "blob:selection-snapshot",
      width: 200,
      height: 120,
      sourceKind: "video",
      roi: {
        x: 0.1,
        y: 0.15,
        width: 0.3,
        height: 0.35,
      },
      createdAt: 3,
      timeMs: 1_400,
    },
  });

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1200,
    endMs: 3400,
  });

  const evolvedSelection = store.getState().ui.workspace.activeSelection;
  assert.ok(evolvedSelection);
  assert.equal(evolvedSelection?.id, firstSelection?.id);
  assert.equal(evolvedSelection?.createdAt, firstSelection?.createdAt);
  assert.equal(evolvedSelection?.intent, "audio");
  assert.equal(evolvedSelection?.startMs, 1200);
  assert.equal(evolvedSelection?.endMs, 3400);
  assert.equal(evolvedSelection?.roi, undefined);
  assert.equal(getRoiFocusActive(store.getState()), false);
  assert.equal(getActiveInspectionSnapshot(store.getState()), null);

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1200,
    endMs: 1100,
  });

  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.equal(isSelectionValid(store.getState()), false);
  assert.equal(getSelectionDuration(store.getState()), 0);
  assert.equal(getSelectionIntent(store.getState()), "unknown");
});

test("laboratory store ignores semantic selection intent updates without an active selection", () => {
  const store = createLabStore();

  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "visual",
  });

  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.equal(getSelectionIntent(store.getState()), "unknown");
});

test("laboratory store can synthesize and clear an image inspection selection from semantic roi updates", () => {
  const store = createLabStore();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "image",
      mode: "local",
      storedPath: "/tmp/source.png",
    },
  });

  store.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.2,
      y: 0.1,
      width: 0.4,
      height: 0.5,
    },
  });

  assert.deepEqual(store.getState().ui.workspace.activeSelection, {
    id: store.getState().ui.workspace.activeSelection?.id,
    startMs: 0,
    endMs: 1,
    type: "inspect",
    intent: "general",
    roi: {
      x: 0.2,
      y: 0.1,
      width: 0.4,
      height: 0.5,
    },
    createdAt: store.getState().ui.workspace.activeSelection?.createdAt,
  });

  store.dispatch({
    type: "selection-roi-cleared",
  });

  assert.equal(store.getState().ui.workspace.activeSelection, null);
});

test("laboratory inspection micro state stays UI-scoped and resets on hydrate", async () => {
  const store = createLabStore();
  const labRootModule = await importLabRootModuleWithDomStub<{
    __testOnlyLabRootPersistence: {
      readPersistableState: (state: ReturnType<typeof store.getState>) => Record<string, unknown>;
    };
  }>();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "image",
      mode: "local",
      storedPath: "/tmp/source.png",
    },
  });
  store.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.2,
      y: 0.2,
      width: 0.24,
      height: 0.26,
    },
  });
  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "motion",
  });
  store.dispatch({
    type: "selection-roi-focus-set",
    active: true,
  });
  store.dispatch({
    type: "selection-roi-snapshot-set",
    snapshot: {
      id: "snapshot-1",
      objectUrl: "blob:roi-snapshot-1",
      width: 240,
      height: 180,
      sourceKind: "image",
      roi: {
        x: 0.2,
        y: 0.2,
        width: 0.24,
        height: 0.26,
      },
      createdAt: 1,
      timeMs: null,
    },
  });

  assert.equal(getInspectionMode(store.getState()), "motion");
  assert.equal(getRoiFocusActive(store.getState()), true);
  assert.equal(getActiveInspectionSnapshot(store.getState())?.id, "snapshot-1");

  const persistedState = labRootModule.__testOnlyLabRootPersistence.readPersistableState(
    store.getState()
  );

  assert.equal("inspectionMode" in persistedState, false);
  assert.equal("roiFocusActive" in persistedState, false);
  assert.equal("activeInspectionSnapshot" in persistedState, false);
  assert.equal(
    "inspectionMode" in ((persistedState["workspace"] as Record<string, unknown>) || {}),
    false
  );
  assert.equal(
    "roiFocusActive" in ((persistedState["workspace"] as Record<string, unknown>) || {}),
    false
  );
  assert.equal(
    "activeInspectionSnapshot" in ((persistedState["workspace"] as Record<string, unknown>) || {}),
    false
  );

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: null,
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {},
    },
  });

  assert.equal(getInspectionMode(store.getState()), "none");
  assert.equal(getRoiFocusActive(store.getState()), false);
  assert.equal(getActiveInspectionSnapshot(store.getState()), null);
});

test("laboratory source changes clear semantic roi and reset inspection mode", () => {
  const store = createLabStore();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      storedPath: "/tmp/source-a.mp4",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  store.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.2,
      y: 0.2,
      width: 0.25,
      height: 0.25,
    },
  });
  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "visual",
  });
  store.dispatch({
    type: "selection-roi-focus-set",
    active: true,
  });
  store.dispatch({
    type: "selection-roi-snapshot-set",
    snapshot: {
      id: "snapshot-reset",
      objectUrl: "blob:roi-reset",
      width: 120,
      height: 120,
      sourceKind: "video",
      roi: {
        x: 0.2,
        y: 0.2,
        width: 0.25,
        height: 0.25,
      },
      createdAt: 2,
      timeMs: 1400,
    },
  });

  store.dispatch({
    type: "source-config-patched",
    patch: {
      storedPath: "/tmp/source-b.mp4",
    },
  });

  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.equal(getInspectionMode(store.getState()), "none");
  assert.equal(getRoiFocusActive(store.getState()), false);
  assert.equal(getActiveInspectionSnapshot(store.getState()), null);
});
