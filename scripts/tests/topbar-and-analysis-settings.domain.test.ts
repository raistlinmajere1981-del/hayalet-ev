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

describe("topbar and analysis settings", () => {
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
      store.dispatch({
        type: "analysis-preflight-auto-run-toggled",
        force: false,
      } as unknown as Parameters<typeof store.dispatch>[0]);
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
        clickListener({
          target: new TestElement("analysis-scope-choice", "selected"),
        } as unknown as Event);
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
});
