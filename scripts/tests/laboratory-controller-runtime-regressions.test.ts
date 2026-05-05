import {
  assert,
  bindLabAssetPreviewClicks,
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
    assert.equal(mediaActions.length, 3);
    assert.deepEqual(
      mediaActions.map(function (entry) {
        return (entry.payload["action"] as string) || null;
      }),
      ["export-roi-image", "export-frame-grab", "export-audio-track"]
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

test("laboratory run controller toggles selection micro zoom from the timeline action", () => {
  const originalElement = globalThis.Element;
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
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1200,
      endMs: 3600,
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("timeline-toggle-micro-zoom") } as Event);
    assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, true);

    clickListener?.({ target: new TestElement("timeline-toggle-micro-zoom") } as Event);
    assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, false);

    store.dispatch({ type: "workspace-timeline-updated", startMs: null, endMs: null });
    clickListener?.({ target: new TestElement("timeline-toggle-micro-zoom") } as Event);
    assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, false);
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

    clickListener?.({
      target: new TestElement("workspace-intent-toggle", "visual-inspection"),
    } as Event);
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

test("laboratory run controller applies fine adjustment controls for audio and visual panels", () => {
  const originalElement = globalThis.Element;
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {
    constructor(dataset: Record<string, string>) {
      super(dataset["labAction"] || "workspace-setting-adjust");
      this.dataset = dataset;
    }
  }

  function settingButton(field: string, attrs: Record<string, string>) {
    return new TestElement({
      labAction: "workspace-setting-adjust",
      labField: field,
      ...attrs,
    });
  }

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
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({
      target: settingButton("workspace.interactive.brightness", {
        labDelta: "1",
        labMin: "0",
        labMax: "200",
        labStep: "1",
        labResetValue: "100",
      }),
    } as Event);
    assert.equal(store.getState().ui.workspace.interactiveSettings.brightness, 101);

    clickListener?.({
      target: settingButton("workspace.audioFocus.gain", {
        labDelta: "-0.1",
        labMin: "0",
        labMax: "3",
        labStep: "0.1",
        labResetValue: "1",
      }),
    } as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.gain, 0.9);

    clickListener?.({
      target: settingButton("workspace.audioFocus.filterType", {
        labDelta: "1",
        labOptions: "none|lowpass|highpass|bandpass",
        labResetValue: "none",
      }),
    } as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.filterType, "lowpass");

    clickListener?.({
      target: settingButton("workspace.audioFocus.filterType", {
        labReset: "true",
        labOptions: "none|lowpass|highpass|bandpass",
        labResetValue: "none",
      }),
    } as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.filterType, "none");

    store.dispatch({
      type: "workspace-audio-updated",
      patch: {
        eqBands: store.getState().ui.workspace.audioFocus.eqBands.map(function (band, index) {
          return index === 1 ? { ...band, gain: 4 } : band;
        }),
      },
    });
    clickListener?.({
      target: settingButton("workspace.audioFocus.eqBands.1.gain", {
        labReset: "true",
        labMin: "-12",
        labMax: "12",
        labStep: "0.5",
        labResetValue: "0",
      }),
    } as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.eqBands[1]?.gain, 0);

    clickListener?.({
      target: new TestElement({ labAction: "workspace-reset-audio-focus" }),
    } as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.gain, 1);
    assert.equal(store.getState().ui.workspace.audioFocus.playbackRate, 1);
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

test("laboratory run controller routes YouTube import mode without starting downloads", () => {
  const timerMock = installTimerMock();
  const originalElement = globalThis.Element;
  const originalInput = globalThis.HTMLInputElement;
  const originalSelect = globalThis.HTMLSelectElement;
  const originalTextarea = globalThis.HTMLTextAreaElement;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      status: "ready",
      storedPath: "/tmp/existing-lab-source.mp4",
      storedFileName: "existing-lab-source.mp4",
      sourceUrl: null,
      previewUrl: "file:///tmp/existing-lab-source.mp4",
      routeLabel: "Local Copy",
      metadata: {
        durationSeconds: 42,
      },
    },
  });
  const sourceBeforeYoutubeSelection = JSON.parse(JSON.stringify(store.getState().source));

  class TestElement extends FakeActionElement {}
  class TestInputElement {
    checked: boolean;
    dataset: Record<string, string>;

    constructor(
      field: string,
      public value: string,
      public type = "url",
      checked = false
    ) {
      this.checked = checked;
      this.dataset = {
        labField: field,
      };
    }
  }
  class TestSelectElement {
    dataset: Record<string, string>;

    constructor(
      field: string,
      public value: string
    ) {
      this.dataset = {
        labField: field,
      };
    }
  }
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
          sendEvent(eventName: string, payload: Record<string, unknown>) {
            sentEvents.push({ eventName, payload });
          },
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    const changeListener = documentRef.listeners.get("change");
    const inputListener = documentRef.listeners.get("input");
    assert.ok(clickListener);
    assert.ok(changeListener);
    assert.ok(inputListener);

    clickListener?.({ target: new TestElement("enter-youtube-import-mode") } as Event);
    assert.equal(store.getState().ui.labMode, "import-youtube");

    clickListener?.({ target: new TestElement("exit-youtube-import-mode") } as Event);
    assert.equal(store.getState().ui.labMode, "normal");

    changeListener?.({
      target: new TestSelectElement("source.mode", "youtube"),
    } as unknown as Event);

    assert.equal(store.getState().ui.labMode, "import-youtube");
    assert.deepEqual(store.getState().source, sourceBeforeYoutubeSelection);
    inputListener?.({
      target: new TestInputElement("source.youtubeUrl", "https://youtube.com/watch?v=focus"),
    } as unknown as Event);
    assert.equal(store.getState().ui.sourceDrafts.youtubeUrl, "https://youtube.com/watch?v=focus");
    assert.deepEqual(store.getState().source, sourceBeforeYoutubeSelection);

    inputListener?.({
      target: new TestInputElement(
        "youtube-import.url",
        "https://www.youtube.com/watch?v=abc123DEF45"
      ),
    } as unknown as Event);
    assert.equal(
      store.getState().ui.youtubeImport.url,
      "https://www.youtube.com/watch?v=abc123DEF45"
    );
    assert.equal(store.getState().ui.youtubeImport.status, "parsing");
    assert.equal(timerMock.scheduled[0]?.delay, 800);

    inputListener?.({
      target: new TestInputElement("youtube-import.url", "https://youtu.be/new123DEF45"),
    } as unknown as Event);
    assert.equal(store.getState().ui.youtubeImport.url, "https://youtu.be/new123DEF45");
    assert.equal(store.getState().ui.youtubeImport.status, "parsing");
    assert.equal(timerMock.scheduled[1]?.delay, 800);
    timerMock.scheduled[0]?.fn();
    assert.equal(store.getState().ui.youtubeImport.status, "parsing");
    assert.equal(store.getState().ui.youtubeImport.preview, null);
    timerMock.scheduled[1]?.fn();
    assert.equal(store.getState().ui.youtubeImport.status, "ready");
    assert.deepEqual(store.getState().ui.youtubeImport.preview, {
      title: "Sample Video Title",
      duration: 154,
      thumbnail: "https://img.youtube.com/vi/new123DEF45/hqdefault.jpg",
    });

    clickListener?.({
      target: new TestElement("youtube-import-set-strategy", "audio_only"),
    } as Event);
    assert.equal(store.getState().ui.youtubeImport.strategy, "audio_only");
    clickListener?.({
      target: new TestElement("youtube-import-set-strategy", "video_best"),
    } as Event);
    assert.equal(store.getState().ui.youtubeImport.strategy, "video_best");
    clickListener?.({
      target: new TestElement("youtube-import-set-strategy", "low_size"),
    } as Event);
    assert.equal(store.getState().ui.youtubeImport.strategy, "low_size");
    clickListener?.({
      target: new TestElement("youtube-import-set-strategy", "audio_only"),
    } as Event);
    assert.equal(store.getState().ui.youtubeImport.strategy, "audio_only");
    clickListener?.({
      target: new TestElement("youtube-import-set-strategy", "bogus"),
    } as Event);
    assert.equal(store.getState().ui.youtubeImport.strategy, "audio_only");
    clickListener?.({
      target: new TestElement("youtube-import-set-strategy", "custom"),
    } as Event);
    assert.equal(store.getState().ui.youtubeImport.strategy, "custom");
    inputListener?.({
      target: new TestInputElement("youtube-import.custom.format", "webm"),
    } as unknown as Event);
    changeListener?.({
      target: new TestSelectElement("youtube-import.custom.resolution", "720p"),
    } as unknown as Event);
    changeListener?.({
      target: new TestInputElement("youtube-import.custom.audioExtraction", "", "checkbox", true),
    } as unknown as Event);
    assert.equal(sentEvents.length, 0);
    assert.deepEqual(store.getState().ui.youtubeImport.custom, {
      resolution: "720p",
      format: "webm",
      audioExtraction: true,
    });

    inputListener?.({
      target: new TestInputElement("youtube-import.url", "https://example.com/watch?v=nope"),
    } as unknown as Event);
    assert.equal(store.getState().ui.youtubeImport.status, "error");
    assert.equal(store.getState().ui.youtubeImport.url, "https://example.com/watch?v=nope");

    inputListener?.({
      target: new TestInputElement("youtube-import.url", ""),
    } as unknown as Event);
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
      strategy: "custom",
      custom: {
        resolution: "720p",
        format: "webm",
        audioExtraction: true,
      },
    });

    inputListener?.({
      target: new TestInputElement("youtube-import.url", "https://youtu.be/clear12345"),
    } as unknown as Event);
    assert.equal(store.getState().ui.youtubeImport.status, "parsing");
    clickListener?.({ target: new TestElement("youtube-import-clear") } as Event);
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
      strategy: "video_best",
      custom: {
        resolution: "best",
        format: "mp4",
        audioExtraction: false,
      },
    });
    timerMock.scheduled[2]?.fn();
    assert.equal(store.getState().ui.youtubeImport.status, "idle");

    inputListener?.({
      target: new TestInputElement("youtube-import.url", "https://youtu.be/exit12345"),
    } as unknown as Event);
    assert.equal(store.getState().ui.youtubeImport.status, "parsing");
    clickListener?.({ target: new TestElement("exit-youtube-import-mode") } as Event);
    assert.equal(store.getState().ui.labMode, "normal");
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
      strategy: "video_best",
      custom: {
        resolution: "best",
        format: "mp4",
        audioExtraction: false,
      },
    });
    timerMock.scheduled[3]?.fn();
    assert.equal(store.getState().ui.youtubeImport.status, "idle");

    assert.equal(sentEvents.length, 0);
    assert.equal(
      sentEvents.some(function (entry) {
        return entry.payload.action === "source-download-youtube";
      }),
      false
    );
  } finally {
    timerMock.restore();
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

test("laboratory run controller sends project import draft fields without mutating committed source", () => {
  const originalElement = globalThis.Element;
  const originalInput = globalThis.HTMLInputElement;
  const originalSelect = globalThis.HTMLSelectElement;
  const originalTextarea = globalThis.HTMLTextAreaElement;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      status: "ready",
      storedPath: "/tmp/existing-lab-source.mp4",
      storedFileName: "existing-lab-source.mp4",
      sourceUrl: null,
      routeLabel: "Local Copy",
      metadata: {},
    },
  });
  const committedSourceBeforeImport = JSON.parse(JSON.stringify(store.getState().source));

  class TestElement extends FakeActionElement {}
  class TestInputElement {
    checked = false;
    dataset: Record<string, string>;
    type = "text";

    constructor(
      field: string,
      public value: string
    ) {
      this.dataset = {
        labField: field,
      };
    }
  }
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
          sendEvent(eventName: string, payload: Record<string, unknown>) {
            sentEvents.push({ eventName, payload });
          },
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    const inputListener = documentRef.listeners.get("input");
    assert.ok(clickListener);
    assert.ok(inputListener);

    inputListener?.({
      target: new TestInputElement("project-import.urlInput", "https://example.com/evidence.png"),
    } as unknown as Event);

    assert.deepEqual(store.getState().source, committedSourceBeforeImport);

    clickListener?.({ target: new TestElement("project-import-check-url") } as Event);

    assert.equal(sentEvents.length, 1);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0]?.payload["action"], "project-import-check-url");
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
          url: "https://example.com/evidence.png",
          isYoutube: false,
          kind: "image",
        },
      } as never,
    });
    assert.equal(store.getState().ui.projectImport.activeKind, "image");
    assert.equal(store.getState().ui.projectImport.methods.image, "url");

    clickListener?.({ target: new TestElement("project-import-url-add") } as Event);

    assert.equal(sentEvents.length, 2);
    assert.equal(sentEvents[1]?.eventName, "media-action");
    assert.equal(sentEvents[1]?.payload["action"], "source-download-url");
    const mediaPayload = sentEvents[1]?.payload["payload"] as Record<string, unknown>;
    const fields = mediaPayload["fields"] as Record<string, unknown>;
    assert.equal(fields["kind"], "image");
    assert.equal(fields["mode"], "url");
    assert.equal(fields["urlInput"], "https://example.com/evidence.png");
    assert.equal(Object.prototype.hasOwnProperty.call(fields, "file" + "NameHint"), false);
    assert.deepEqual(store.getState().source, committedSourceBeforeImport);
    assert.equal(store.getState().ui.projectImport.reviewFocus, "running");
    assert.equal(store.getState().ui.projectImport.lastAction, "source-download-url");
    assert.equal(
      store.getState().ui.projectImport.lastRequestId,
      sentEvents[1]?.payload["requestId"]
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
    assert.equal(store.getState().ui.analysisCancelPending, true);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0]?.payload["action"], "process-cancel");
    assert.equal(
      (sentEvents[0]?.payload["payload"] as Record<string, unknown>)["featureId"],
      "media-analysis"
    );
    clickListener?.({ target: new TestElement("cancel-analysis") } as Event);
    assert.equal(sentEvents.length, 1);
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-run-cancelled",
        kind: "activity",
        severity: "warning",
        message: "Analiz iptal edildi",
        detail: null,
        timestamp: Date.now(),
        source: "host",
        action: "process-run",
        stage: "cancelled",
        scope: "run",
        moduleId: null,
        rawLine: null,
      },
    });
    assert.equal(store.getState().ui.analysisCancelPending, false);
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

test("laboratory run controller updates focus layer from user workspace interactions", async () => {
  const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
  const preview = new FakeMediaElement();
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([['video[data-lab-preserve-media="workspace-preview"]', preview]]),
    [preview]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class FakeFocusTarget {
    dataset: Record<string, string>;

    constructor(
      options: {
        action?: string;
        surface?: "inspector" | "preview" | "timeline";
        value?: string;
      } = {}
    ) {
      this.dataset = {
        ...(options.action === undefined ? {} : { labAction: options.action }),
        ...(options.value === undefined ? {} : { labValue: options.value }),
      };
      this.surface = options.surface ?? null;
    }

    private readonly surface: "inspector" | "preview" | "timeline" | null;

    closest(selector: string): FakeFocusTarget | null {
      if (selector === "[data-lab-action]" && this.dataset.labAction !== undefined) {
        return this;
      }
      if (selector === ".labx-workspace-preview" && this.surface === "preview") {
        return this;
      }
      if (selector === ".labx-timeline" && this.surface === "timeline") {
        return this;
      }
      if (
        selector === "[data-lab-workspace-inspector='true']" &&
        this.surface === "inspector"
      ) {
        return this;
      }
      return null;
    }
  }

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeFocusTarget,
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
    await Promise.resolve();

    const clickListener = documentRef.listeners.get("click");
    const pointerDownListener = documentRef.listeners.get("pointerdown");
    assert.ok(clickListener);
    assert.ok(pointerDownListener);

    clickListener?.({
      target: new FakeFocusTarget({ action: "timeline-shift-playhead", surface: "timeline" }),
    } as Event);
    assert.equal(store.getState().ui.labFocusLayer, "timeline");

    pointerDownListener?.({
      target: new FakeFocusTarget({ surface: "preview" }),
    } as Event);
    assert.equal(store.getState().ui.labFocusLayer, "preview");

    clickListener?.({
      target: new FakeFocusTarget({
        action: "workspace-controls-drawer-toggle",
        surface: "inspector",
      }),
    } as Event);
    assert.equal(store.getState().ui.labFocusLayer, "inspector");

    await preview.play();
    preview.dispatch("timeupdate");
    assert.equal(store.getState().ui.labFocusLayer, "inspector");
  } finally {
    if (originalElement) {
      Object.defineProperty(globalThis, "Element", originalElement);
    } else {
      Reflect.deleteProperty(globalThis, "Element");
    }
  }
});

test("laboratory run controller shifts normal playback from timeline step controls", async () => {
  const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
  const preview = new FakeMediaElement();
  preview.duration = 12;
  preview.currentTime = 4.321;
  preview.paused = false;
  const playhead = new FakePlayheadElement();
  const playheadLabel = new FakeTextElement(null);
  const currentTimeLabel = new FakeTextElement(null);
  const totalDurationLabel = new FakeTextElement(null);
  const playToggleLabel = new FakeTextElement(null);
  const timelineRoot = { dataset: { duration: "12000" } };
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['video[data-lab-preserve-media="workspace-preview"]', preview],
      ['[data-lab-role="timeline-playhead"]', playhead],
      ['[data-lab-role="timeline-playhead-label"]', playheadLabel],
      ['[data-lab-role="timeline-current-time-label"]', currentTimeLabel],
      ['[data-lab-role="timeline-total-duration-label"]', totalDurationLabel],
      ['[data-lab-role="timeline-play-toggle-label"]', playToggleLabel],
      [".labx-timeline", timelineRoot],
    ]),
    [preview]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeActionElement,
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
    await Promise.resolve();

    assert.equal(currentTimeLabel.textContent, "00:04.321");
    assert.equal(totalDurationLabel.textContent, "00:12.000");
    assert.equal(playToggleLabel.textContent, "❚❚");

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener?.({
      target: new FakeActionElement("timeline-shift-playhead", "+1000"),
    } as Event);

    assert.equal(preview.currentTime, 5.321);
    assert.equal(preview.pauseCalls, 0);
    assert.equal(currentTimeLabel.textContent, "00:05.321");

    clickListener?.({
      target: new FakeActionElement("timeline-shift-playhead", "-frame"),
    } as Event);

    assert.equal(preview.currentTime, 5.288);
    assert.equal(preview.pauseCalls, 1);
    assert.equal(preview.paused, true);
    assert.equal(currentTimeLabel.textContent, "00:05.288");
    assert.equal(playToggleLabel.textContent, "▶");
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", originalElement);
    }
  }
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
    assert.equal(preview.currentTime, 2.5);
    mouseUpListener?.({} as Event);

    assert.equal(preview.currentTime, 4.5);
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

test("laboratory run controller keeps timeline drag selection stable after timeline rerender", () => {
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

  class RelayoutTimelineTrack extends FakeTimelineTrack {
    private collapsed = false;

    collapse() {
      this.collapsed = true;
    }

    override getBoundingClientRect() {
      return {
        left: 100,
        width: this.collapsed ? 0 : 1000,
      };
    }
  }

  const track = new RelayoutTimelineTrack(100, 1000);
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
    track.collapse();
    mouseMoveListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 550) as unknown as Event
    );
    mouseUpListener?.({} as Event);

    assert.equal(preview.currentTime, 4.5);
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
    assert.equal(preview.currentTime, 0.5);

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
    assert.equal(preview.currentTime, 5.5);
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
    assert.equal(preview.currentTime, 5);
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

test("laboratory source panel delete action removes a confirmed asset", () => {
  const originalElement = globalThis.Element;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const confirmMessages: string[] = [];
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
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-source-1",
        type: "source",
        name: "source.mp4",
        localPath: "/tmp/source.mp4",
        createdAt: 100,
      },
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
        confirm(message: string) {
          confirmMessages.push(message);
          return true;
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({
      target: new TestElement("asset-remove", "asset-source-1"),
    } as Event);

    assert.equal(confirmMessages.length, 1);
    assert.match(confirmMessages[0] || "", /source\.mp4/);
    assert.deepEqual(
      sentEvents.map(function (event) {
        return {
          action: event.payload["action"],
          assetId: (event.payload["payload"] as Record<string, unknown>)["assetId"],
          eventName: event.eventName,
        };
      }),
      [
        { eventName: "media-action", action: "asset-remove", assetId: "asset-source-1" },
      ]
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

test("laboratory asset delete actions stop when confirmation is rejected", () => {
  const originalElement = globalThis.Element;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const confirmMessages: string[] = [];
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
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-cancel-delete",
        type: "report",
        name: "keep-report.md",
        localPath: "/tmp/keep-report.md",
        createdAt: 300,
      },
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
        confirm(message: string) {
          confirmMessages.push(message);
          return false;
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({
      target: new TestElement("asset-remove", "asset-cancel-delete"),
    } as Event);

    assert.deepEqual(sentEvents, []);
    assert.equal(confirmMessages.length, 1);
    assert.match(confirmMessages[0] || "", /keep-report\.md/);
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

test("laboratory source panel use-as-source action sends asset source replacement", () => {
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
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-source-1",
        type: "source",
        name: "source.mp4",
        localPath: "/tmp/source.mp4",
        createdAt: 100,
      },
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

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({
      target: new TestElement("asset-use-as-source", "asset-source-1"),
    } as Event);

    assert.equal(sentEvents.length, 1);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0]?.payload["action"], "asset-use-as-source");
    assert.equal(
      (sentEvents[0]?.payload["payload"] as Record<string, unknown>)["assetId"],
      "asset-source-1"
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

test("laboratory source panel report action opens the report overlay", () => {
  const originalElement = globalThis.Element;
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
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({
      target: new TestElement("open-report-overlay", "asset-report-inline"),
    } as Event);

    assert.equal(store.getState().ui.activeAssetPreviewId, null);
    assert.equal(store.getState().ui.workspace.reportOverlayOpen, true);
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
