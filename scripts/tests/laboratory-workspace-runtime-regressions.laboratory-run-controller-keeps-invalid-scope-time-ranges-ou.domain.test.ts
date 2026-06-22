import { assert, createLabEventBus, createLabRunController, createLabStore, FakeControllerDocument, FakeHtmlInputElement, FakeHtmlSelectElement, FakeHtmlTextAreaElement, getReportFreshness, getRunSnapshotSummary, getWorkspaceDiff, test } from "./laboratory-runtime-truth.helpers.ts";

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


describe("laboratory run controller keeps invalid scope time ranges out of the analysis dr", () => {
void test("laboratory run controller keeps invalid scope time ranges out of the analysis draft", () => {
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
    inputListener({ target: scopeStart } as unknown as Event);

    const scopeEnd = new FakeHtmlInputElement("scope.timeEndMs", "2000");
    scopeEnd.type = "number";
    inputListener({ target: scopeEnd } as unknown as Event);

    const analysisScope = (store.getState().workbench["analysisScope"] ?? {}) as Record<
      string,
      unknown
    >;
    assert.equal((analysisScope["timeRange"] as Record<string, unknown> | undefined) ?? null, null);
  } finally {
    if (originalInput) {
      Object.defineProperty(globalThis, "HTMLInputElement", originalInput);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLInputElement"];
    }
    if (originalSelect) {
      Object.defineProperty(globalThis, "HTMLSelectElement", originalSelect);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLSelectElement"];
    }
    if (originalTextArea) {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", originalTextArea);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLTextAreaElement"];
    }
  }
});
void test("laboratory store wires live findings and preview artifacts from custom runtime events", () => {
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
  assert.equal(state.run.analysisScope.hypothesis, "gorunmeyen obje olabilir");
  assert.equal(state.run.liveFindings[0]?.id, "finding-live-1");
  assert.equal(state.run.liveFindings[0].windowKey, "motion-module-batch");
  assert.equal(state.run.previewArtifacts[0]?.id, "preview-live-1");
  assert.equal(state.ui.activePreviewArtifactId, "preview-live-1");
  assert.equal(
    state.run.moduleTrace.some(function (entry) {
      return entry.id === "trace-live-1";
    }),
    true
  );
});
void test("laboratory store hydration normalizes live runs into safe persisted summaries", () => {
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
            variantId: null,
            reference: null,
            metadata: {},
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
  assert.equal(state.run.modules["motion"]?.status, "cancelled");
  assert.equal(state.run.events.length, 1);
  assert.equal(state.run.events[0]?.kind, "activity");
  assert.equal(state.run.rawLog.length, 1);
  assert.equal(state.run.analysisScope?.focus, "visual");
  assert.equal(state.run.analysisScope.lifecycle?.mutable, false);
  assert.equal(state.run.liveFindings[0]?.windowKey, "frame-window-1");
  assert.equal(state.run.previewArtifacts[0]?.kind, "frame-preview");
  assert.equal(state.run.comparisonVariants[0]?.kind, "gamma-scan");
  assert.equal(state.run.hypothesisSummary, "Gorunmeyen obje olabilir");
});
void test("laboratory selectors expose frozen snapshot summary and live workspace drift separately", () => {
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
  });
  assert.deepEqual(getWorkspaceDiff(state), {
    timelineChanged: true,
    hypothesisChanged: true,
    workspaceDirty: true,
    changedKeys: ["timeline", "hypothesis"],
  });
  assert.deepEqual(getReportFreshness(state), {
    state: "current",
    workspaceDirty: true,
  });
});
});
