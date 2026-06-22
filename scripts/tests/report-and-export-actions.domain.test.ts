import { assert, createLabEventBus, createLabRunController, createLabStore, FakeActionElement, FakeControllerDocument, test } from "./laboratory-runtime-truth.helpers.ts";

describe("report and export actions", () => {
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

      clickListener({
        target: new TestElement("workspace-roi-export", "face"),
      } as unknown as Event);
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
      clickListener({
        target: new TestElement("workspace-comparison-moment-capture"),
      } as unknown as Event);

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
      assert.deepEqual(payload["primaryNormalizedRoi"], {
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
      });
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

      clickListener({
        target: new TestElement("workspace-selection-roi-export"),
      } as unknown as Event);

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
      assert.equal(
        store.getState().ui.workspace.comparisonReferenceAssetId,
        "asset-reference-crop"
      );
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
});
