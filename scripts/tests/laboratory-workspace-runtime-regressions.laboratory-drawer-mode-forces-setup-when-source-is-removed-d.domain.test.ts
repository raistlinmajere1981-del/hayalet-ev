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
  getReportFreshness,
  getRunSnapshotSummary,
  getWorkspaceDiff,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { getBookmarks, resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";

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


describe("laboratory drawer mode forces setup when source is removed despite old reports", () => {
void test("laboratory drawer mode forces setup when source is removed despite old reports", () => {
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
void test("laboratory drawer mode routes empty completed runs without reports to explore", () => {
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
void test("laboratory report freshness treats feature report records as report payloads", () => {
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
void test("laboratory store resets semantic and primitive selection state on source changes", () => {
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
});
