import {
  assert,
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
  importLabRootModuleWithDomStub,
  installTimerMock,
  isSelectionValid,
  LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { closeLabAssetMenusForClick } from "../../rooms/laboratory/runtime/controller/lab-asset-context-menu-controller.ts";
import { resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";

void test("laboratory run controller dismisses successful user actions from the topbar after the success window", () => {
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

    timerMock.scheduled[0].fn();

    assert.equal(typeof store.getState().userActions[0]?.dismissedFromHubAt, "number");
  } finally {
    timerMock.restore();
  }
});

void test("laboratory run controller waits for linked assets before dismissing success chips", () => {
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

void test("laboratory report overlay export buttons send host export actions without webview electron api", () => {
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

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener({ target: new TestElement("report-export-json") } as unknown as Event);
    store.dispatch({ type: "report-view-changed", view: "ai" });
    clickListener({ target: new TestElement("report-export-pdf") } as unknown as Event);

    const mediaActions = sentEvents.filter(function (entry) {
      return entry.eventName === "media-action";
    });
    assert.equal(mediaActions.length, 2);
    assert.deepEqual(
      mediaActions.map(function (entry) {
        return entry.payload["action"];
      }),
      ["report-export", "report-export"]
    );
    assert.deepEqual(
      mediaActions.map(function (entry) {
        const payload = entry.payload["payload"] as Record<string, unknown>;
        return {
          featureId: payload["featureId"],
          format: payload["format"],
          hasTargetDirectory: Object.prototype.hasOwnProperty.call(payload, "targetDirectory"),
          reportView: payload["reportView"],
        };
      }),
      [
        {
          featureId: "media-analysis",
          format: "json",
          hasTargetDirectory: false,
          reportView: "user",
        },
        {
          featureId: "media-analysis",
          format: "pdf",
          hasTargetDirectory: false,
          reportView: "ai",
        },
      ]
    );
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller threads frozen run context into tracked export actions", () => {
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
        active: true,
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

    clickListener({ target: new TestElement("workspace-roi-export", "face") } as unknown as Event);
    clickListener({ target: new TestElement("timeline-export-clip") } as unknown as Event);
    clickListener({ target: new TestElement("timeline-grab-frame") } as unknown as Event);
    clickListener({ target: new TestElement("timeline-extract-audio") } as unknown as Event);

    const mediaActions = sentEvents.filter(function (entry) {
      return entry.eventName === "media-action";
    });
    assert.equal(mediaActions.length, 3);
    assert.deepEqual(
      mediaActions.map(function (entry) {
        return entry.payload["action"] as string;
      }),
      ["export-roi-image", "export-frame-grab", "export-audio-track"]
    );
    assert.ok(mediaActions.every((entry) => typeof entry.payload["payload"] === "object"));
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller sends comparison ROI payloads with image comparison actions", () => {
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

    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "image",
        mode: "local",
        storedPath: "/tmp/primary.png",
      },
    });
    store.dispatch({ type: "workspace-asset-selected", assetId: "asset-primary" });
    store.dispatch({ type: "workspace-comparison-reference-set", assetId: "asset-reference" });
    store.dispatch({
      type: "workspace-comparison-updated",
      patch: {
        comparisonFindingNote: "Reference glow shifted",
        comparisonSplitPercent: 42,
        comparisonViewMode: "roi-detail",
      },
    });
    store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "primary",
      roi: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    });
    store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "reference",
      roi: { x: 0.2, y: 0.1, width: 0.25, height: 0.35 },
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener({ target: new TestElement("workspace-comparison-moment-capture") } as unknown as Event);

    assert.equal(sentEvents.length, 1);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0].payload["action"], "capture-comparison-moment");
    const payload = sentEvents[0].payload["payload"] as Record<string, unknown>;
    assert.equal(payload["workspaceTargetAssetId"], "asset-primary");
    assert.equal(payload["comparisonReferenceAssetId"], "asset-reference");
    assert.equal(payload["comparisonRoiActiveSide"], "reference");
    assert.equal(payload["comparisonViewMode"], "roi-detail");
    assert.equal(payload["comparisonSplitPercent"], 42);
    assert.equal(payload["findingNote"], "Reference glow shifted");
    assert.deepEqual(payload["normalizedRoi"], { x: 0.2, y: 0.1, width: 0.25, height: 0.35 });
    assert.deepEqual(payload["primaryNormalizedRoi"], { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    assert.deepEqual(payload["referenceNormalizedRoi"], {
      x: 0.2,
      y: 0.1,
      width: 0.25,
      height: 0.35,
    });
    assert.deepEqual(payload["comparisonRois"], {
      activeSide: "reference",
      primary: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      reference: { x: 0.2, y: 0.1, width: 0.25, height: 0.35 },
    });

    clickListener({ target: new TestElement("workspace-selection-roi-export") } as unknown as Event);

    assert.equal(sentEvents.length, 3);
    assert.equal(sentEvents[1]?.eventName, "media-action");
    assert.equal(sentEvents[1].payload["action"], "export-roi-image");
    const primaryRoiPayload = sentEvents[1].payload["payload"] as Record<string, unknown>;
    assert.equal(primaryRoiPayload["workspaceTargetAssetId"], "asset-primary");
    assert.equal(primaryRoiPayload["comparisonReferenceAssetId"], "asset-reference");
    assert.equal(primaryRoiPayload["comparisonRoiActiveSide"], "reference");
    assert.equal(primaryRoiPayload["workspaceResultTargetSide"], "primary");
    assert.equal(primaryRoiPayload["allowParallelWorkspaceOperation"], true);
    assert.deepEqual(primaryRoiPayload["normalizedRoi"], {
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
    assert.equal(sentEvents[2]?.eventName, "media-action");
    assert.equal(sentEvents[2].payload["action"], "export-roi-image");
    const referenceRoiPayload = sentEvents[2].payload["payload"] as Record<string, unknown>;
    assert.equal(referenceRoiPayload["workspaceTargetAssetId"], "asset-reference");
    assert.equal(referenceRoiPayload["comparisonReferenceAssetId"], "asset-reference");
    assert.equal(referenceRoiPayload["comparisonRoiActiveSide"], "reference");
    assert.equal(referenceRoiPayload["workspaceResultTargetSide"], "reference");
    assert.equal(referenceRoiPayload["allowParallelWorkspaceOperation"], true);
    assert.deepEqual(referenceRoiPayload["normalizedRoi"], {
      x: 0.2,
      y: 0.1,
      width: 0.25,
      height: 0.35,
    });

    const primaryRequestId = sentEvents[1].payload["requestId"] as string;
    const referenceRequestId = sentEvents[2].payload["requestId"] as string;
    eventBus.emit({
      type: "host-event-received",
      event: {
        id: "evt-primary-roi-crop",
        kind: "job",
        severity: "success",
        message: "Primary ROI crop completed",
        detail: null,
        action: "export-roi-image",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: primaryRequestId,
        resultAssetIds: ["asset-primary-crop"],
      } as never,
    });
    assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-primary");
    eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-primary-crop",
        type: "image",
        name: "primary-crop.png",
        localPath: "/tmp/primary-crop.png",
        createdAt: 200,
      },
    });
    assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-primary-crop");
    assert.equal(store.getState().ui.workspace.comparisonReferenceAssetId, "asset-reference");

    eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-reference-crop",
        type: "image",
        name: "reference-crop.png",
        localPath: "/tmp/reference-crop.png",
        createdAt: 201,
      },
    });
    eventBus.emit({
      type: "host-event-received",
      event: {
        id: "evt-reference-roi-crop",
        kind: "job",
        severity: "success",
        message: "Reference ROI crop completed",
        detail: null,
        action: "export-roi-image",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: referenceRequestId,
        resultAssetIds: ["asset-reference-crop"],
      } as never,
    });
    assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-primary-crop");
    assert.equal(store.getState().ui.workspace.comparisonReferenceAssetId, "asset-reference-crop");
    assert.equal(store.getState().ui.workspace.comparisonRois.primary, null);
    assert.equal(store.getState().ui.workspace.comparisonRois.reference, null);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller replaces workspace media from enhanced frame outputs", () => {
  const originalElement = globalThis.Element;

  class TestElement extends FakeActionElement {}

  function createScenario() {
    const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
    const documentRef = new FakeControllerDocument();
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
    return {
      click(action: string) {
        clickListener({ target: new TestElement(action) } as unknown as Event);
      },
      eventBus,
      sentEvents,
      store,
    };
  }

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    const single = createScenario();
    single.store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "image",
        mode: "local",
        storedPath: "/tmp/single.png",
      },
    });
    single.store.dispatch({ type: "workspace-asset-selected", assetId: "asset-single" });

    single.click("workspace-enhanced-frame-export");

    assert.equal(single.sentEvents.length, 1);
    assert.equal(single.sentEvents[0]?.payload["action"], "export-enhanced-frame");
    const singlePayload = single.sentEvents[0].payload["payload"] as Record<string, unknown>;
    assert.equal(singlePayload["workspaceTargetAssetId"], "asset-single");
    assert.equal(singlePayload["workspaceResultMode"], "replace-workspace-media");
    assert.equal(singlePayload["workspaceResultTargetSide"], "single");

    const singleRequestId = single.sentEvents[0].payload["requestId"] as string;
    single.eventBus.emit({
      type: "host-event-received",
      event: {
        id: "evt-single-enhanced-frame",
        kind: "job",
        severity: "success",
        message: "Enhanced frame completed",
        detail: null,
        action: "export-enhanced-frame",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: singleRequestId,
        resultAssetIds: ["asset-single-enhanced"],
      } as never,
    });
    single.eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-single-enhanced",
        type: "image",
        name: "single-enhanced.png",
        localPath: "/tmp/single-enhanced.png",
        createdAt: 300,
      },
    });
    assert.equal(single.store.getState().ui.activeWorkspaceAssetId, "asset-single-enhanced");
    assert.equal(single.store.getState().ui.workspace.comparisonReferenceAssetId, null);

    const comparison = createScenario();
    comparison.store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "image",
        mode: "local",
        storedPath: "/tmp/primary.png",
      },
    });
    comparison.store.dispatch({ type: "workspace-asset-selected", assetId: "asset-primary" });
    comparison.store.dispatch({
      type: "workspace-comparison-reference-set",
      assetId: "asset-reference",
    });
    comparison.store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "primary",
      roi: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    });

    comparison.click("workspace-enhanced-frame-export");

    assert.equal(comparison.sentEvents.length, 2);
    const primaryPayload = comparison.sentEvents[0]?.payload["payload"] as Record<string, unknown>;
    const referencePayload = comparison.sentEvents[1]?.payload["payload"] as Record<
      string,
      unknown
    >;
    assert.equal(primaryPayload["workspaceTargetAssetId"], "asset-primary");
    assert.equal(primaryPayload["workspaceResultMode"], "replace-workspace-media");
    assert.equal(primaryPayload["workspaceResultTargetSide"], "primary");
    assert.equal(primaryPayload["allowParallelWorkspaceOperation"], true);
    assert.deepEqual(primaryPayload["normalizedRoi"], { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    assert.equal(referencePayload["workspaceTargetAssetId"], "asset-reference");
    assert.equal(referencePayload["workspaceResultMode"], "replace-workspace-media");
    assert.equal(referencePayload["workspaceResultTargetSide"], "reference");
    assert.equal(referencePayload["allowParallelWorkspaceOperation"], true);
    assert.equal(referencePayload["normalizedRoi"], null);

    const primaryRequestId = comparison.sentEvents[0]?.payload["requestId"] as string;
    const referenceRequestId = comparison.sentEvents[1]?.payload["requestId"] as string;
    comparison.eventBus.emit({
      type: "host-event-received",
      event: {
        id: "evt-primary-enhanced-frame",
        kind: "job",
        severity: "success",
        message: "Primary enhanced frame completed",
        detail: null,
        action: "export-enhanced-frame",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: primaryRequestId,
        resultAssetIds: ["asset-primary-enhanced"],
      } as never,
    });
    comparison.eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-primary-enhanced",
        type: "image",
        name: "primary-enhanced.png",
        localPath: "/tmp/primary-enhanced.png",
        createdAt: 301,
      },
    });
    comparison.eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-reference-enhanced",
        type: "image",
        name: "reference-enhanced.png",
        localPath: "/tmp/reference-enhanced.png",
        createdAt: 302,
      },
    });
    comparison.eventBus.emit({
      type: "host-event-received",
      event: {
        id: "evt-reference-enhanced-frame",
        kind: "job",
        severity: "success",
        message: "Reference enhanced frame completed",
        detail: null,
        action: "export-enhanced-frame",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: referenceRequestId,
        resultAssetIds: ["asset-reference-enhanced"],
      } as never,
    });
    assert.equal(comparison.store.getState().ui.activeWorkspaceAssetId, "asset-primary-enhanced");
    assert.equal(
      comparison.store.getState().ui.workspace.comparisonReferenceAssetId,
      "asset-reference-enhanced"
    );
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller restores comparison finding focus from inspector actions", () => {
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
      type: "source-config-patched",
      patch: {
        kind: "image",
        mode: "local",
        storedPath: "/tmp/source.png",
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-primary",
        type: "image",
        name: "primary.png",
        localPath: "/tmp/primary.png",
        createdAt: 10,
        metadata: { kind: "image" },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-reference",
        type: "image",
        name: "reference.png",
        localPath: "/tmp/reference.png",
        createdAt: 11,
        metadata: { kind: "image" },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-manifest",
        type: "artifact",
        name: "comparison-finding.json",
        localPath: "/tmp/comparison-finding.json",
        createdAt: 12,
        metadata: {
          artifactKind: "comparison-finding-manifest",
          captureContext: {
            comparisonRois: {
              activeSide: "reference",
              primary: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
              reference: { x: 0.2, y: 0.1, width: 0.25, height: 0.35 },
            },
            comparisonViewMode: "roi-detail",
            primaryAssetId: "asset-primary",
            referenceAssetId: "asset-reference",
            splitPercent: 44,
          },
          findingId: "finding-restore",
          primaryAssetId: "asset-primary",
          referenceAssetId: "asset-reference",
        },
      },
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener({
      target: new TestElement("workspace-comparison-finding-focus", "finding-restore"),
    } as unknown as Event);

    const workspace = store.getState().ui.workspace;
    assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-primary");
    assert.equal(workspace.comparisonReferenceAssetId, "asset-reference");
    assert.equal(workspace.comparisonViewMode, "roi-detail");
    assert.equal(workspace.comparisonSplitPercent, 44);
    assert.equal(workspace.activeIconRailSlot, "image-comparison");
    assert.equal(workspace.controlsDrawerTab, "audio");
    assert.equal(workspace.comparisonRois.activeSide, "reference");
    assert.deepEqual(workspace.comparisonRois.primary, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    assert.deepEqual(workspace.comparisonRois.reference, {
      x: 0.2,
      y: 0.1,
      width: 0.25,
      height: 0.35,
    });
    assert.deepEqual(workspace.activeSelection?.roi, {
      x: 0.2,
      y: 0.1,
      width: 0.25,
      height: 0.35,
    });
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller toggles selection micro zoom from the timeline action", () => {
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

    clickListener({ target: new TestElement("timeline-toggle-micro-zoom") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, true);

    clickListener({ target: new TestElement("timeline-toggle-micro-zoom") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, false);

    store.dispatch({ type: "workspace-timeline-updated", startMs: null, endMs: null });
    clickListener({ target: new TestElement("timeline-toggle-micro-zoom") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, false);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory asset menus close on menu actions and outside clicks", () => {
  const originalElement = (globalThis as Record<string, unknown>)["Element"];

  class TestElement {
    constructor(
      private readonly menu: HTMLDetailsElement | null,
      private readonly action = false
    ) {}

    closest(selector: string) {
      if (selector === "details.labx-sp-asset__menu") {
        return this.menu;
      }
      if (selector === "[data-lab-action]" && this.action) {
        return this;
      }
      return null;
    }
  }

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    const sourceMenu = { open: true } as HTMLDetailsElement;
    const projectMenu = { open: true } as HTMLDetailsElement;
    const documentRef = {
      querySelectorAll(selector: string) {
        assert.equal(selector, "details.labx-sp-asset__menu");
        return [sourceMenu, projectMenu];
      },
    } as unknown as Document;

    closeLabAssetMenusForClick(
      { target: new TestElement(sourceMenu, true) } as unknown as Event,
      documentRef
    );
    assert.equal(sourceMenu.open, false);
    assert.equal(projectMenu.open, false);

    sourceMenu.open = true;
    projectMenu.open = true;
    closeLabAssetMenusForClick(
      { target: new TestElement(sourceMenu, false) } as unknown as Event,
      documentRef
    );
    assert.equal(sourceMenu.open, true);
    assert.equal(projectMenu.open, false);

    sourceMenu.open = true;
    projectMenu.open = true;
    closeLabAssetMenusForClick(
      { target: new TestElement(null, false) } as unknown as Event,
      documentRef
    );
    assert.equal(sourceMenu.open, false);
    assert.equal(projectMenu.open, false);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller focuses the source preview through explicit source-preview actions", () => {
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
          ? (listener)
          : (event: Event) => { listener.handleEvent(event); }
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

    clickListener({ target: new TestElement("focus-source-preview", "source-active") } as unknown as Event);

    assert.deepEqual(previewCalls, ["scroll", "focus"]);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller wires v2 shell action buttons into workspace state", () => {
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

    clickListener({ target: new TestElement("drawer-collapsed-toggled") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.drawerCollapsed, true);

    let prevented = false;
    keyListener({
      ctrlKey: true,
      key: "b",
      target: new TestElement("not-a-text-control"),
      preventDefault() {
        prevented = true;
      },
    } as unknown as Event);
    assert.equal(prevented, true);
    assert.equal(store.getState().ui.workspace.drawerCollapsed, false);

    clickListener({
      target: new TestElement("analysis-prep-group-toggle", "visual-structure"),
    } as unknown as Event);
    assert.deepEqual(store.getState().selectedCapabilities, ["visual-structure"]);
    assert.equal(
      (store.getState().workbench["moduleToggles"] as Record<string, unknown>)["frame-consistency"],
      true
    );

    clickListener({
      target: new TestElement("module-toggle", "audio-signal::signal-health"),
    } as unknown as Event);
    assert.equal(
      (store.getState().workbench["moduleToggles"] as Record<string, unknown>)["signal-health"],
      true
    );
    assert.ok(store.getState().selectedCapabilities.includes("audio-signal"));

    clickListener({ target: new TestElement("workspace-process-view-toggled") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.processViewActive, true);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (typeof originalInput === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLInputElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLInputElement", {
        configurable: true,
        value: originalInput,
      });
    }
    if (typeof originalSelect === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLSelectElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLSelectElement", {
        configurable: true,
        value: originalSelect,
      });
    }
    if (typeof originalTextarea === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLTextAreaElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", {
        configurable: true,
        value: originalTextarea,
      });
    }
  }
});

void test("laboratory run controller applies fine adjustment controls for audio and visual panels", () => {
  const originalElement = globalThis.Element;
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {
    constructor(dataset: Record<string, string>) {
      super(dataset["labAction"] ?? "workspace-setting-adjust");
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

    clickListener({
      target: settingButton("workspace.interactive.brightness", {
        labDelta: "1",
        labMin: "0",
        labMax: "200",
        labStep: "1",
        labResetValue: "100",
      }),
    } as unknown as Event);
    assert.equal(store.getState().ui.workspace.interactiveSettings.brightness, 101);

    store.dispatch({
      type: "workspace-comparison-reference-set",
      assetId: "asset-reference",
    });
    clickListener({
      target: settingButton("workspace.interactive.brightness", {
        labDelta: "1",
        labMin: "0",
        labMax: "200",
        labStep: "1",
        labResetValue: "100",
      }),
    } as unknown as Event);
    assert.equal(store.getState().ui.workspace.interactiveSettings.brightness, 101);
    assert.equal(
      store.getState().ui.workspace.comparisonInteractiveSettings.primary.brightness,
      101
    );
    assert.equal(
      store.getState().ui.workspace.comparisonInteractiveSettings.reference.brightness,
      102
    );

    store.dispatch({ type: "workspace-comparison-side-activated", side: "primary" });
    clickListener({
      target: settingButton("workspace.interactive.brightness", {
        labMin: "0",
        labMax: "200",
        labReset: "true",
        labStep: "1",
        labResetValue: "100",
      }),
    } as unknown as Event);
    assert.equal(
      store.getState().ui.workspace.comparisonInteractiveSettings.primary.brightness,
      100
    );
    assert.equal(
      store.getState().ui.workspace.comparisonInteractiveSettings.reference.brightness,
      102
    );

    clickListener({
      target: settingButton("workspace.audioFocus.gain", {
        labDelta: "-0.1",
        labMin: "0",
        labMax: "3",
        labStep: "0.1",
        labResetValue: "1",
      }),
    } as unknown as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.gain, 0.9);

    clickListener({
      target: settingButton("workspace.audioFocus.filterType", {
        labDelta: "1",
        labOptions: "none|lowpass|highpass|bandpass",
        labResetValue: "none",
      }),
    } as unknown as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.filterType, "lowpass");

    clickListener({
      target: settingButton("workspace.audioFocus.filterType", {
        labReset: "true",
        labOptions: "none|lowpass|highpass|bandpass",
        labResetValue: "none",
      }),
    } as unknown as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.filterType, "none");

    store.dispatch({
      type: "workspace-audio-updated",
      patch: {
        eqBands: store.getState().ui.workspace.audioFocus.eqBands.map(function (band, index) {
          return index === 1 ? { ...band, gain: 4 } : band;
        }),
      },
    });
    clickListener({
      target: settingButton("workspace.audioFocus.eqBands.1.gain", {
        labReset: "true",
        labMin: "-12",
        labMax: "12",
        labStep: "0.5",
        labResetValue: "0",
      }),
    } as unknown as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.eqBands[1]?.gain, 0);

    clickListener({
      target: new TestElement({ labAction: "workspace-reset-audio-focus" }),
    } as unknown as Event);
    assert.equal(store.getState().ui.workspace.audioFocus.gain, 1);
    assert.equal(store.getState().ui.workspace.audioFocus.playbackRate, 1);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller routes YouTube source selection without import mode or downloads", () => {
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

    changeListener({
      target: new TestSelectElement("source.mode", "youtube"),
    } as unknown as Event);

    assert.equal(store.getState().ui.labMode, "normal");
    assert.equal(store.getState().source!["mode"], "youtube");
    assert.equal(store.getState().source!["storedPath"], null);
    assert.equal(sentEvents.length, 1);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0].payload["action"], "source-set-mode");
    const sourceAfterModeSelection = JSON.parse(JSON.stringify(store.getState().source)) as Record<string, unknown>;

    inputListener({
      target: new TestInputElement("source.youtubeUrl", "https://youtube.com/watch?v=focus"),
    } as unknown as Event);
    assert.equal(store.getState().ui.sourceDrafts.youtubeUrl, "https://youtube.com/watch?v=focus");
    assert.deepEqual(store.getState().source, sourceAfterModeSelection);

    store.dispatch({
      type: "youtube-import-set-url",
      url: "https://www.youtube.com/watch?v=abc123DEF45",
    });
    store.dispatch({
      type: "youtube-import-parse-success",
      url: "https://www.youtube.com/watch?v=abc123DEF45",
      preview: {
        title: "Sample Video Title",
        duration: 154,
        thumbnail: "https://img.youtube.com/vi/abc123DEF45/hqdefault.jpg",
      },
      formats: [
        {
          formatId: "137",
          label: "Video 1080p",
          kind: "video",
          extension: "mp4",
        },
        {
          formatId: "248",
          label: "Video 1080p webm",
          kind: "video",
          extension: "webm",
        },
        {
          formatId: "140",
          label: "Audio m4a",
          kind: "audio",
          extension: "m4a",
        },
        {
          formatId: "251",
          label: "Audio opus",
          kind: "audio",
          extension: "webm",
        },
      ],
      selectedVideoFormatId: "137",
      selectedAudioFormatId: "140",
    });
    assert.equal(store.getState().ui.youtubeImport.status, "ready");
    assert.equal(store.getState().ui.youtubeImport.selectedVideoFormatId, "137");
    assert.equal(store.getState().ui.youtubeImport.selectedAudioFormatId, "140");

    changeListener({
      target: new TestSelectElement("project-import.youtubeVideoFormat", "248"),
    } as unknown as Event);
    assert.equal(store.getState().ui.youtubeImport.selectedVideoFormatId, "248");

    changeListener({
      target: new TestSelectElement("project-import.youtubeAudioFormat", "251"),
    } as unknown as Event);
    assert.equal(store.getState().ui.youtubeImport.selectedAudioFormatId, "251");

    changeListener({
      target: new TestSelectElement("project-import.youtubeCaptureMode", "audio-only"),
    } as unknown as Event);
    assert.equal(store.getState().ui.projectImport.drafts.video.youtubeCaptureMode, "audio-only");

    assert.equal(sentEvents.length, 1);
    clickListener({ target: new TestElement("youtube-import-clear") } as unknown as Event);
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });

    assert.equal(
      sentEvents.some(function (entry) {
        return entry.payload["action"] === "source-download-youtube";
      }),
      false
    );
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (typeof originalInput === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLInputElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLInputElement", {
        configurable: true,
        value: originalInput,
      });
    }
    if (typeof originalSelect === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLSelectElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLSelectElement", {
        configurable: true,
        value: originalSelect,
      });
    }
    if (typeof originalTextarea === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLTextAreaElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", {
        configurable: true,
        value: originalTextarea,
      });
    }
  }
});

void test("laboratory run controller sends project import draft fields without mutating committed source", () => {
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
  const committedSourceBeforeImport = JSON.parse(JSON.stringify(store.getState().source)) as Record<string, unknown>;

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

    inputListener({
      target: new TestInputElement("project-import.urlInput", "https://example.com/evidence.png"),
    } as unknown as Event);

    assert.deepEqual(store.getState().source, committedSourceBeforeImport);

    clickListener({ target: new TestElement("project-import-check-url") } as unknown as Event);

    assert.equal(sentEvents.length, 1);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0].payload["action"], "project-import-check-url");
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

    clickListener({ target: new TestElement("project-import-url-add") } as unknown as Event);

    assert.equal(sentEvents.length, 2);
    assert.equal(sentEvents[1]?.eventName, "media-action");
    assert.equal(sentEvents[1].payload["action"], "source-download-url");
    const mediaPayload = sentEvents[1].payload["payload"] as Record<string, unknown>;
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
      sentEvents[1].payload["requestId"]
    );
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (typeof originalInput === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLInputElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLInputElement", {
        configurable: true,
        value: originalInput,
      });
    }
    if (typeof originalSelect === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLSelectElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLSelectElement", {
        configurable: true,
        value: originalSelect,
      });
    }
    if (typeof originalTextarea === "undefined") {
      delete (globalThis as Record<string, unknown>)["HTMLTextAreaElement"];
    } else {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", {
        configurable: true,
        value: originalTextarea,
      });
    }
  }
});

void test("laboratory run controller routes topbar pills and cancel through v2 contracts", () => {
  const originalElement = globalThis.Element;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const cancelStateDuringSend: Array<{ pending: boolean; requestId: string | null }> = [];
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
            if (eventName === "media-action" && payload["action"] === "process-cancel") {
              cancelStateDuringSend.push({
                pending: store.getState().ui.analysisCancelPending,
                requestId: store.getState().ui.analysisCancelRequestId,
              });
            }
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

    clickListener({ target: new TestElement("drawer-explore-toggled") } as unknown as Event);
    assert.equal(resolveDrawerMode(store.getState()), "explore");

    clickListener({ target: new TestElement("topbar-pill-results") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.drawerModeOverride, "result");
    assert.equal(resolveDrawerMode(store.getState()), "result");

    clickListener({ target: new TestElement("topbar-pill-source") } as unknown as Event);
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
    store.dispatch({ type: "selection-tab-toggled", active: true });
    clickListener({ target: new TestElement("topbar-pill-analyze") } as unknown as Event);

    assert.equal(store.getState().ui.workspace.selectionTabActive, false);
    assert.equal(store.getState().ui.workspace.drawerModeOverride, null);
    assert.equal(resolveDrawerMode(store.getState()), "running");

    clickListener({ target: new TestElement("cancel-analysis") } as unknown as Event);

    assert.equal(sentEvents.length, 1);
    const sentCancelRequestId = sentEvents[0]?.payload["requestId"];
    assert.deepEqual(cancelStateDuringSend, [
      {
        pending: true,
        requestId: typeof sentCancelRequestId === "string" ? sentCancelRequestId : null,
      },
    ]);
    assert.equal(store.getState().ui.analysisCancelPending, true);
    assert.equal(store.getState().ui.analysisCancelRequestId, sentCancelRequestId);
    assert.equal(sentEvents[0]?.eventName, "media-action");
    assert.equal(sentEvents[0].payload["action"], "process-cancel");
    assert.equal(
      (sentEvents[0].payload["payload"] as Record<string, unknown>)["featureId"],
      "media-analysis"
    );
    clickListener({ target: new TestElement("cancel-analysis") } as unknown as Event);
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
    assert.equal(store.getState().ui.analysisCancelRequestId, null);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller honors the analysis preflight auto-run toggle", () => {
  const originalElement = globalThis.Element;

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  function runWithPreflightToggle(preflightAutoRunEnabled: boolean) {
    const sentActions: string[] = [];
    const preflightPayloads: Array<Record<string, unknown>> = [];
    const processRunPayloadRequestIds: Array<string | null> = [];
    const processRunRequestIdsDuringSend: Array<string | null> = [];
    const processRunStatesDuringSend: Array<string | null> = [];
    const prompts: string[] = [];
    const documentRef = new FakeControllerDocument();
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
          sendEvent(eventName: string, payload: Record<string, unknown>) {
            if (eventName === "media-action" && typeof payload["action"] === "string") {
              sentActions.push(payload["action"]);
              const actionPayload =
                typeof payload["payload"] === "object" &&
                payload["payload"] !== null &&
                Array.isArray(payload["payload"]) === false
                  ? (payload["payload"] as Record<string, unknown>)
                  : {};
              if (payload["action"] === "profile-run-preflight") {
                preflightPayloads.push(actionPayload);
              }
              if (payload["action"] === "process-run") {
                processRunPayloadRequestIds.push(
                  typeof payload["requestId"] === "string" ? payload["requestId"] : null
                );
                processRunRequestIdsDuringSend.push(store.getState().run?.requestId ?? null);
                processRunStatesDuringSend.push(store.getState().run?.state ?? null);
              }
            }
          },
        },
        addEventListener() {},
        prompt(message: string) {
          prompts.push(message);
          return "1";
        },
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        source: {
          kind: "video",
          mode: "local",
          previewUrl: "preview://video",
          storedPath: "/tmp/lab-demo.mp4",
        },
        sourceProbeStatus: "completed",
        toolState: {
          tools: {
            ffmpeg: { installed: true },
          },
        },
        selectedCapabilities: ["visual-forensics"],
        workspace: {
          preflightAutoRunEnabled,
        },
        reports: {
          user: null,
          ai: null,
          emptyReason: null,
        },
        activityFeed: [],
        lastRun: null,
      },
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener({ target: new TestElement("run-deep-analysis") } as unknown as Event);

    return {
      preflightPayloads,
      processRunPayloadRequestIds,
      processRunRequestIdsDuringSend,
      processRunStatesDuringSend,
      prompts,
      sentActions,
    };
  }

  try {
    const enabledRun = runWithPreflightToggle(true);
    const enabledPreflightIndex = enabledRun.sentActions.indexOf("profile-run-preflight");
    const enabledRunIndex = enabledRun.sentActions.indexOf("process-run");

    assert.equal(enabledRun.prompts.length, 0);
    assert.notEqual(enabledPreflightIndex, -1);
    assert.notEqual(enabledRunIndex, -1);
    assert.ok(enabledPreflightIndex < enabledRunIndex);
    assert.deepEqual(enabledRun.processRunStatesDuringSend, ["running"]);
    assert.deepEqual(
      enabledRun.processRunRequestIdsDuringSend,
      enabledRun.processRunPayloadRequestIds
    );

    const disabledRun = runWithPreflightToggle(false);

    assert.equal(disabledRun.prompts.length, 0);
    assert.equal(disabledRun.sentActions.includes("profile-run-preflight"), false);
    assert.ok(disabledRun.sentActions.includes("process-run"));
    assert.deepEqual(disabledRun.processRunStatesDuringSend, ["running"]);
    assert.deepEqual(
      disabledRun.processRunRequestIdsDuringSend,
      disabledRun.processRunPayloadRequestIds
    );
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller treats missing area selection as full-media analysis scope", () => {
  const originalElement = globalThis.Element;
  const sentActions: string[] = [];
  const prompts: string[] = [];
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
            if (eventName === "media-action" && typeof payload["action"] === "string") {
              sentActions.push(payload["action"]);
            }
          },
        },
        addEventListener() {},
        prompt(message: string) {
          prompts.push(message);
          return "1";
        },
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        workbench: {
          analysisScope: {
            focus: "visual",
            lifecycle: {
              frozenAt: "2026-05-09T00:00:00.000Z",
              mutable: false,
              processId: "stale-process",
            },
            region: {
              height: 90,
              width: 120,
              x: 10,
              y: 20,
            },
            timeRange: {
              endMs: 9999,
              startMs: 8888,
            },
          },
        },
        source: {
          kind: "video",
          mode: "local",
          previewUrl: "preview://video",
          storedPath: "/tmp/lab-demo.mp4",
        },
        sourceProbeStatus: "completed",
        toolState: {
          tools: {
            ffmpeg: { installed: true },
          },
        },
        selectedCapabilities: ["visual-forensics"],
        workspace: {
          preflightAutoRunEnabled: false,
        },
        reports: {
          user: null,
          ai: null,
          emptyReason: null,
        },
        activityFeed: [],
        lastRun: null,
      },
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener({ target: new TestElement("run-deep-analysis") } as unknown as Event);

    const analysisScope = store.getState().run?.analysisScope;

    assert.equal(prompts.length, 0);
    assert.ok(sentActions.includes("process-run"));
    assert.equal(analysisScope?.timeRange, undefined);
    assert.equal(analysisScope?.region, undefined);
    assert.equal(analysisScope?.focus, undefined);
    assert.notEqual(analysisScope?.lifecycle?.processId, "stale-process");
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller carries active image comparison pair into analysis scope", () => {
  const originalElement = globalThis.Element;
  const sentActions: string[] = [];
  const processRunPayloads: Array<Record<string, unknown>> = [];
  class TestElement extends FakeActionElement {}
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();

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
            if (eventName === "media-action" && typeof payload["action"] === "string") {
              sentActions.push(payload["action"]);
              if (payload["action"] === "process-run") {
                processRunPayloads.push(
                  typeof payload["payload"] === "object" &&
                    payload["payload"] !== null &&
                    Array.isArray(payload["payload"]) === false
                    ? (payload["payload"] as Record<string, unknown>)
                    : {}
                );
              }
            }
          },
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        source: {
          kind: "image",
          mode: "local",
          previewUrl: "preview://primary",
          storedFileName: "primary.png",
          storedPath: "/tmp/primary.png",
        },
        sourceProbeStatus: "completed",
        toolState: {
          tools: {
            ffmpeg: { installed: true },
          },
        },
        workspace: {
          comparisonSplitPercent: 38,
          comparisonViewMode: "difference",
          preflightAutoRunEnabled: false,
        },
        selectedCapabilities: ["visual-forensics"],
        reports: {
          user: null,
          ai: null,
          emptyReason: null,
        },
        activityFeed: [],
        lastRun: null,
      },
    });
    eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-primary",
        type: "image",
        name: "A primary.png",
        localPath: "/tmp/primary.png",
        createdAt: 1,
        metadata: { height: 500, sourceKind: "image", width: 1000 },
      },
    });
    eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-reference",
        type: "image",
        name: "B reference.png",
        localPath: "/tmp/reference.png",
        createdAt: 2,
        metadata: { height: 600, sourceKind: "image", width: 800 },
      },
    });
    store.dispatch({ type: "workspace-asset-selected", assetId: "asset-primary" });
    store.dispatch({ type: "workspace-comparison-reference-set", assetId: "asset-reference" });
    store.dispatch({ type: "capability-set", capabilities: ["visual-forensics"] });
    store.dispatch({ type: "analysis-preflight-auto-run-toggled", force: false } as unknown as Parameters<typeof store.dispatch>[0]);
    store.dispatch({
      type: "workspace-comparison-updated",
      patch: {
        comparisonSplitPercent: 38,
        comparisonViewMode: "difference",
      },
    });
    store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "primary",
      roi: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    });
    store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "reference",
      roi: { x: 0.2, y: 0.1, width: 0.25, height: 0.35 },
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener({ target: new TestElement("run-deep-analysis") } as unknown as Event);
    if (!sentActions.includes("process-run")) {
      clickListener({ target: new TestElement("analysis-scope-choice", "selected") } as unknown as Event);
    }

    const comparison = store.getState().run?.analysisScope?.comparison;
    assert.ok(sentActions.includes("process-run"));
    assert.equal(comparison?.primary.assetId, "asset-primary");
    assert.equal(comparison.primary.localPath, "/tmp/primary.png");
    assert.equal(comparison.reference.assetId, "asset-reference");
    assert.equal(comparison.reference.localPath, "/tmp/reference.png");
    assert.equal(comparison.activeSide, "reference");
    assert.equal(comparison.viewMode, "difference");
    assert.equal(comparison.splitPercent, 38);
    assert.equal(processRunPayloads.at(-1)?.["workspaceTargetAssetId"], "asset-primary");
    assert.equal(processRunPayloads.at(-1)?.["comparisonReferenceAssetId"], "asset-reference");
    assert.deepEqual(
      (processRunPayloads.at(-1)?.["analysisScope"] as { comparison?: unknown } | undefined)
        ?.comparison,
      comparison
    );
    assert.deepEqual(comparison.rois?.primary, { x: 100, y: 100, width: 300, height: 200 });
    assert.deepEqual(comparison.rois.reference, {
      x: 160,
      y: 60,
      width: 200,
      height: 210,
    });
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller opens an in-room scope overlay for selected ranges", () => {
  const originalElement = globalThis.Element;
  const sentActions: string[] = [];
  const prompts: string[] = [];
  class FakeScopeOverlayElement {
    className = "";
    dataset: Record<string, string> = {};
    innerHTML = "";
    removed = false;
    attributes: Record<string, string> = {};
    focused = false;

    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }

    querySelector(selector: string) {
      return selector.includes("analysis-scope-choice")
        ? { focus: () => (this.focused = true) }
        : null;
    }

    remove() {
      this.removed = true;
    }
  }

  const documentRef = new FakeControllerDocument() as FakeControllerDocument & {
    body: {
      appended: FakeScopeOverlayElement[];
      appendChild: (child: FakeScopeOverlayElement) => void;
    };
    createElement: (tagName: string) => FakeScopeOverlayElement;
  };
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  documentRef.body = {
    appended: [],
    appendChild(child: FakeScopeOverlayElement) {
      this.appended.push(child);
    },
  };
  documentRef.createElement = function () {
    return new FakeScopeOverlayElement();
  };

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
            if (eventName === "media-action" && typeof payload["action"] === "string") {
              sentActions.push(payload["action"]);
            }
          },
        },
        addEventListener() {},
        prompt(message: string) {
          prompts.push(message);
          return "1";
        },
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        source: {
          kind: "video",
          mode: "local",
          previewUrl: "preview://video",
          storedPath: "/tmp/lab-demo.mp4",
        },
        sourceProbeStatus: "completed",
        toolState: {
          tools: {
            ffmpeg: { installed: true },
          },
        },
        workspace: {
          preflightAutoRunEnabled: false,
          timelineStartMs: 1200,
          timelineEndMs: 2600,
        },
        selectedCapabilities: ["visual-forensics"],
        reports: {
          user: null,
          ai: null,
          emptyReason: null,
        },
        activityFeed: [],
        lastRun: null,
      },
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener({ target: new TestElement("run-deep-analysis") } as unknown as Event);

    const overlay = documentRef.body.appended[0];
    assert.ok(overlay);
    assert.equal(prompts.length, 0);
    assert.equal(sentActions.includes("process-run"), false);
    assert.equal(overlay.attributes["data-open"], "true");
    assert.match(overlay.innerHTML, /data-lab-action="analysis-scope-choice"/);

    clickListener({ target: new TestElement("analysis-scope-choice", "selected") } as unknown as Event);

    const analysisScope = store.getState().run?.analysisScope;
    assert.equal(overlay.removed, true);
    assert.ok(sentActions.includes("process-run"));
    assert.deepEqual(analysisScope?.timeRange, {
      startMs: 1200,
      endMs: 2600,
    });
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory run controller syncs the unified timeline playhead to the active preview media", async () => {
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

  assert.equal(playhead.style["left"], "25%");
  assert.equal(playhead.attributes.get("data-active"), "true");
  assert.equal(playheadLabel.textContent, "00:01.250");

  preview.currentTime = 2.5;
  preview.dispatch("timeupdate");

  assert.equal(playhead.style["left"], "50%");
  assert.equal(playheadLabel.textContent, "00:02.500");
});

void test("laboratory run controller updates focus layer from user workspace interactions", async () => {
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
      if (selector === "[data-lab-action]" && this.dataset["labAction"] !== undefined) {
        return this;
      }
      if (selector === ".labx-workspace-preview" && this.surface === "preview") {
        return this;
      }
      if (selector === ".labx-timeline" && this.surface === "timeline") {
        return this;
      }
      if (selector === "[data-lab-workspace-inspector='true']" && this.surface === "inspector") {
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

    clickListener({
      target: new FakeFocusTarget({ action: "timeline-shift-playhead", surface: "timeline" }),
    } as unknown as Event);
    assert.equal(store.getState().ui.labFocusLayer, "timeline");

    pointerDownListener({
      target: new FakeFocusTarget({ surface: "preview" }),
    } as unknown as Event);
    assert.equal(store.getState().ui.labFocusLayer, "preview");

    clickListener({
      target: new FakeFocusTarget({
        action: "workspace-controls-drawer-toggle",
        surface: "inspector",
      }),
    } as unknown as Event);
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

void test("laboratory run controller shifts normal playback from timeline step controls", async () => {
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
    clickListener({
      target: new FakeActionElement("timeline-shift-playhead", "+1000"),
    } as unknown as Event);

    assert.equal(preview.currentTime, 5.321);
    assert.equal(preview.pauseCalls, 0);
    assert.equal(currentTimeLabel.textContent, "00:05.321");

    clickListener({
      target: new FakeActionElement("timeline-shift-playhead", "-frame"),
    } as unknown as Event);

    assert.equal(preview.currentTime, 5.288);
    assert.equal(preview.pauseCalls, 1);
    assert.equal(preview.paused, true);
    assert.equal(currentTimeLabel.textContent, "00:05.288");
    assert.equal(playToggleLabel.textContent, "▶");
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", originalElement);
    }
  }
});

void test("laboratory run controller keeps click-to-seek and drag-to-select separated by the rail threshold", () => {
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

    mouseDownListener(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
    );
    mouseMoveListener(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 352) as unknown as Event
    );
    mouseUpListener({} as unknown as Event);

    assert.equal(preview.currentTime, 2.5);
    assert.equal(store.getState().ui.workspace.timelineStartMs, null);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);

    mouseDownListener(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
    );
    mouseMoveListener(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 550) as unknown as Event
    );
    assert.equal(preview.currentTime, 2.5);
    mouseUpListener({} as unknown as Event);

    assert.equal(preview.currentTime, 4.5);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 2500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 4500);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (typeof originalMouseEvent === "undefined") {
      delete (globalThis as Record<string, unknown>)["MouseEvent"];
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

void test("laboratory run controller keeps timeline drag selection stable after timeline rerender", () => {
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

    mouseDownListener(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
    );
    track.collapse();
    mouseMoveListener(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 550) as unknown as Event
    );
    mouseUpListener({} as unknown as Event);

    assert.equal(preview.currentTime, 4.5);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 2500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 4500);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (typeof originalMouseEvent === "undefined") {
      delete (globalThis as Record<string, unknown>)["MouseEvent"];
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

void test("laboratory run controller drags timeline start and end handles independently", () => {
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

    mouseDownListener(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-drag-start", timeline) as unknown as EventTarget,
        200
      ) as unknown as Event
    );
    mouseMoveListener({ clientX: 150 } as MouseEvent);
    mouseUpListener({} as unknown as Event);

    assert.equal(store.getState().ui.workspace.timelineStartMs, 500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 3000);
    assert.equal(preview.currentTime, 0.5);

    mouseDownListener(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-drag-end", timeline) as unknown as EventTarget,
        400
      ) as unknown as Event
    );
    mouseMoveListener({ clientX: 650 } as MouseEvent);
    mouseUpListener({} as unknown as Event);

    assert.equal(store.getState().ui.workspace.timelineStartMs, 500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 5500);
    assert.equal(preview.currentTime, 5.5);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (typeof originalMouseEvent === "undefined") {
      delete (globalThis as Record<string, unknown>)["MouseEvent"];
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

void test("laboratory run controller drags the timeline selection body from the pointer-down offset", () => {
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

    mouseDownListener(
      new FakeMouseEvent(actionTarget as unknown as EventTarget, 250) as unknown as Event
    );
    mouseMoveListener(
      new FakeMouseEvent(actionTarget as unknown as EventTarget, 650) as unknown as Event
    );

    assert.equal(store.getState().ui.workspace.timelineStartMs, 5000);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 7000);

    mouseUpListener({} as unknown as Event);
    assert.equal(preview.currentTime, 5);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (typeof originalMouseEvent === "undefined") {
      delete (globalThis as Record<string, unknown>)["MouseEvent"];
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

void test("laboratory run controller applies timeline finetune and clear actions from the unified timeline", () => {
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
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener(
      new FakeMouseEvent(
        new FakeTimelineActionElement(
          "timeline-finetune",
          timeline,
          "start:+100"
        ) as unknown as EventTarget,
        0
      ) as unknown as Event
    );
    clickListener(
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
    assert.equal(getInspectionMode(store.getState()), "audio");

    clickListener(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-clear", timeline) as unknown as EventTarget,
        0
      ) as unknown as Event
    );

    assert.equal(store.getState().ui.workspace.timelineStartMs, null);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(getInspectionMode(store.getState()), "audio");
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory store promotes timeline ranges into stable selection entities", () => {
  const store = createLabStore();

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });

  const firstSelection = store.getState().ui.workspace.activeSelection;
  assert.ok(firstSelection);
  assert.equal(firstSelection.type, "clip");
  assert.equal(firstSelection.startMs, 1000);
  assert.equal(firstSelection.endMs, 3000);
  assert.ok(typeof firstSelection.id === "string" && firstSelection.id.length > 0);
  assert.equal(getActiveSelection(store.getState())?.id, firstSelection.id);
  assert.equal(isSelectionValid(store.getState()), true);
  assert.equal(getSelectionDuration(store.getState()), 2000);
  assert.equal(getInspectionMode(store.getState()), "none");

  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });

  assert.equal(getInspectionMode(store.getState()), "audio");

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
  assert.equal(evolvedSelection.id, firstSelection.id);
  assert.equal(evolvedSelection.createdAt, firstSelection.createdAt);
  assert.equal(evolvedSelection.startMs, 1200);
  assert.equal(evolvedSelection.endMs, 3400);
  assert.equal(evolvedSelection.roi, undefined);
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
  assert.equal(getInspectionMode(store.getState()), "audio");
});

void test("laboratory store keeps inspection mode without requiring an active selection", () => {
  const store = createLabStore();

  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "visual",
  });

  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.equal(getInspectionMode(store.getState()), "visual");
});

void test("laboratory store can synthesize and clear an image inspection selection from semantic roi updates", () => {
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

void test("laboratory inspection micro state stays UI-scoped and resets on hydrate", async () => {
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
    "inspectionMode" in ((persistedState["workspace"] ?? {}) as Record<string, unknown>),
    false
  );
  assert.equal(
    "roiFocusActive" in ((persistedState["workspace"] ?? {}) as Record<string, unknown>),
    false
  );
  assert.equal(
    "activeInspectionSnapshot" in ((persistedState["workspace"] ?? {}) as Record<string, unknown>),
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

void test("laboratory source changes clear semantic roi and reset inspection mode", () => {
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

void test("laboratory source panel delete action removes a confirmed asset", () => {
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

    clickListener({
      target: new TestElement("asset-remove", "asset-source-1"),
    } as unknown as Event);

    assert.equal(confirmMessages.length, 1);
    assert.match(confirmMessages[0] ?? "", /source\.mp4/);
    assert.deepEqual(
      sentEvents.map(function (event) {
        return {
          action: event.payload["action"],
          assetId: (event.payload["payload"] as Record<string, unknown>)["assetId"],
          eventName: event.eventName,
        };
      }),
      [{ eventName: "media-action", action: "asset-remove", assetId: "asset-source-1" }]
    );
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory asset delete actions stop when confirmation is rejected", () => {
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

    clickListener({
      target: new TestElement("asset-remove", "asset-cancel-delete"),
    } as unknown as Event);

    assert.deepEqual(sentEvents, []);
    assert.equal(confirmMessages.length, 1);
    assert.match(confirmMessages[0] ?? "", /keep-report\.md/);
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory source panel media click opens workspace content without host source activation", () => {
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

    clickListener({
      target: new TestElement("workspace-asset-select", "asset-source-1"),
    } as unknown as Event);

    assert.equal(sentEvents.length, 0);
    assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-source-1");
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory report overlay action opens the report overlay", () => {
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

    clickListener({
      target: new TestElement("open-report-overlay", "ai"),
    } as unknown as Event);

    assert.equal(store.getState().ui.workspace.reportOverlayOpen, true);
    assert.equal(store.getState().ui.reportView, "ai");
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

void test("laboratory document overlay action opens the shared overlay shell", () => {
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

    clickListener({
      target: new TestElement("open-document-overlay", "artifact-json-1"),
    } as unknown as Event);

    assert.equal(store.getState().ui.workspace.reportOverlayOpen, true);
    assert.equal(store.getState().ui.activeDocumentOverlayAssetId, "artifact-json-1");
  } finally {
    if (typeof originalElement === "undefined") {
      delete (globalThis as Record<string, unknown>)["Element"];
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});
