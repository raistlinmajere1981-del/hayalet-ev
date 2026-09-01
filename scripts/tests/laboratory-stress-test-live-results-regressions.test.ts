import assert from "node:assert/strict";
import test from "node:test";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { createLaboratoryPresetEditRuntime } from "../../rooms/laboratory/shared/host/preset-edit-runtime.ts";
import { renderLabProcessStrip } from "../../rooms/laboratory/ui/lab-process-strip.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const editRuntime = createLaboratoryPresetEditRuntime({
  asNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  },
  normalizeSourceMetadata(value) {
    return Object.keys(toRecord(value)).length > 0 ? toRecord(value) : null;
  },
  toRecord,
});

function seedStressTestState() {
  const store = createLabStore();
  const state = store.getState();
  state.source = {
    kind: "video",
    mode: "local",
    previewUrl: "file:///source.mp4",
    routeLabel: "Local Copy",
    status: "ready",
    metadata: {
      durationSeconds: 30,
      height: 1080,
      width: 1920,
    },
  };
  state.bootReady = true;
  state.sourceProbeStatus = "completed";
  const normalizedEdit = editRuntime.normalizeEditState(
    {
      preview: {
        status: "ready",
        previewUrl: "file:///transform.mp4",
        artifacts: [
          {
            kind: "transform-source-baseline",
            previewUrl: "file:///baseline.mp4",
          },
          {
            kind: "transform-difference",
            previewUrl: "file:///difference.mp4",
          },
        ],
      },
      cameraTrackingCaches: [
        {
          algorithm: "feature-similarity-ransac",
          anchorSeconds: 12,
          cacheId: "tracking-preview-cache",
          createdAt: "2026-08-26T12:04:00.000Z",
          exclusionRois: [
            { x: 0.15, y: 0.2, width: 0.3, height: 0.35 },
            { x: 0.52, y: 0.22, width: 0.18, height: 0.24 },
          ],
          fallbackUsed: false,
          mode: "global-feature-similarity",
          preferredReferenceRoi: { x: 0.06, y: 0.08, width: 0.16, height: 0.2 },
          quality: "high",
          sourcePath: "/source.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          transformModel: "similarity-dx-dy-rotation-scale",
          transforms: [
            {
              timeSeconds: 12,
              confidence: 0.91,
              featureCount: 120,
              inlierCount: 84,
              inlierRatio: 0.82,
              forwardBackwardRatio: 0.88,
              residualErrorPx: 1.2,
              quality: "high",
              residual: { dx: 0.1, dy: -0.1, rotationDegrees: 0, scale: 1 },
              transform: { dx: 2, dy: -1, rotationDegrees: 0.1, scale: 1 },
            },
          ],
          version: 2,
        },
      ],
      temporalStressTests: [
        {
          schemaVersion: 2,
          id: "control-low-light",
          kind: "control-injection",
          createdAt: "2026-08-26T12:05:00.000Z",
          request: {
            kind: "low-light",
            temporalRequest: {
              startSeconds: 10,
              endSeconds: 16,
              sampleFps: 5,
              roi: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
            },
          },
          interpretation: {
            dataQuality: "sufficient",
            overallImpact: "moderate",
          },
        },
        {
          schemaVersion: 2,
          id: "control-noise",
          kind: "control-injection",
          createdAt: "2026-08-26T12:03:00.000Z",
          request: {
            kind: "noise",
            temporalRequest: {
              startSeconds: 10,
              endSeconds: 16,
              sampleFps: 5,
              roi: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
            },
          },
          interpretation: {
            dataQuality: "sufficient",
            overallImpact: "moderate",
          },
        },
        {
          schemaVersion: 2,
          id: "temporal-baseline",
          kind: "temporal-stress-test",
          createdAt: "2026-08-26T12:00:00.000Z",
          request: {
            startSeconds: 10,
            endSeconds: 16,
            sampleFps: 5,
            roi: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
          },
          interpretation: {
            schemaVersion: 1,
            kind: "temporal-baseline",
            dataQuality: "sufficient",
          },
        },
      ],
    },
    {},
    "video"
  ) as unknown as NonNullable<typeof state.editConfig>;
  state.editConfig = {
    ...normalizedEdit,
    preview: {
      ...toRecord(normalizedEdit.preview),
      previewUrl: "file:///transform.mp4",
    },
  };
  state.ui.workspace.activeSelection = {
    id: "tracking-target",
    startMs: 10_000,
    endMs: 16_000,
    type: "focus",
    roi: { x: 0.15, y: 0.2, width: 0.3, height: 0.35 },
    createdAt: 1,
  };
  state.ui.workspace.comparisonRois.primary = {
    x: 0.52,
    y: 0.22,
    width: 0.18,
    height: 0.24,
  };
  state.ui.workspace.comparisonRois.reference = {
    x: 0.06,
    y: 0.08,
    width: 0.16,
    height: 0.2,
  };
  state.ui.workspace.processViewActive = true;
  state.ui.workspace.comparisonViewMode = "difference";
  return state;
}

void test("expanded idle process strip contains only full-width newest-first report history", () => {
  const state = seedStressTestState();
  const markup = renderLabProcessStrip(state);

  assert.match(markup, /data-lab-live-results="true"/);
  assert.doesNotMatch(markup, /data-lab-process-content="analysis"/);
  assert.doesNotMatch(markup, /file:\/\/\/difference\.mp4/);
  assert.doesNotMatch(markup, /data-lab-live-transform-mode/);
  assert.doesNotMatch(markup, /labx-strip-live-column--preview/);
  assert.match(markup, /data-lab-stress-report-history="true"/);
  assert.match(markup, /Rapor Geçmişi|Report History/);
  assert.match(markup, /data-lab-report-latest="true"/);
  assert.match(markup, /data-lab-report-copy="true"/);
  assert.match(markup, /data-lab-report-export="true"/);
  assert.doesNotMatch(markup, /data-lab-control-comparison="true"/);
  assert.ok(markup.indexOf("Control · low light") < markup.indexOf("Control · noise"));
  assert.ok(markup.indexOf("Control · noise") < markup.indexOf("Temporal Stress Test"));
});

void test("transform and difference artifacts render as modes inside the main player", () => {
  const state = seedStressTestState();
  state.ui.workspace.trackingPreviewActive = false;

  let surface = renderWorkspaceSurface(state);
  assert.match(surface.main, /data-lab-workspace-preview-modes="true"/);
  assert.match(surface.main, /data-lab-workspace-preview-mode="true"/);
  assert.match(surface.main, /option value="difference" selected/);
  assert.match(surface.main, /src="file:\/\/\/difference\.mp4"/);

  state.ui.workspace.comparisonViewMode = "stacked";
  surface = renderWorkspaceSurface(state);
  assert.match(surface.main, /option value="stacked" selected/);
  assert.match(surface.main, /src="file:\/\/\/transform\.mp4"/);
});

void test("tracking preview splits the main player and stays out of the report preview", () => {
  const state = seedStressTestState();
  state.ui.workspace.trackingPreviewActive = true;
  const surface = renderWorkspaceSurface(state);
  const reportMarkup = renderLabProcessStrip(state);

  assert.match(surface.main, /data-lab-workspace-tracking-comparison="true"/);
  assert.match(surface.main, /data-lab-tracking-preview-pane="raw"/);
  assert.match(surface.main, /data-lab-tracking-preview-pane="tracking"/);
  assert.match(surface.main, /data-lab-preserve-media="workspace-preview"/);
  assert.match(surface.main, /data-lab-preserve-media="tracking-preview"/);
  assert.match(surface.main, /option value="side-by-side" selected/);
  const cacheAttribute = surface.main.match(/data-lab-tracking-preview-cache-json="([^"]*)"/)?.[1];
  const roiAttribute = surface.main.match(/data-lab-tracking-preview-rois-json="([^"]*)"/)?.[1];
  assert.ok(cacheAttribute);
  assert.match(cacheAttribute, /tracking-preview-cache/);
  assert.match(cacheAttribute, /confidence/);
  assert.match(cacheAttribute, /inlierRatio/);
  assert.match(cacheAttribute, /forwardBackwardRatio/);
  assert.match(cacheAttribute, /residualErrorPx/);
  assert.ok(roiAttribute);
  assert.match(roiAttribute, /target/);
  assert.match(roiAttribute, /control/);
  assert.match(roiAttribute, /background/);
  assert.doesNotMatch(reportMarkup, /data-lab-transform-preview-content/);
  assert.doesNotMatch(reportMarkup, /data-lab-tracking-preview/);
});

void test("tracking preview ignores report-history tracking when the canonical cache is absent", () => {
  const state = seedStressTestState();
  const canonicalCache = state.editConfig?.cameraTrackingCaches?.[0];
  assert.ok(canonicalCache);
  state.editConfig = {
    ...state.editConfig,
    cameraTrackingCaches: [],
    temporalStressTests: [
      {
        tracking: {
          ...canonicalCache,
          cacheId: "history-only-tracking-cache",
          status: "completed",
        },
      },
    ],
  };
  state.ui.workspace.trackingPreviewActive = true;

  const surface = renderWorkspaceSurface(state);

  assert.doesNotMatch(surface.main, /data-lab-workspace-tracking-comparison="true"/);
  assert.doesNotMatch(surface.main, /history-only-tracking-cache/);
});

void test("unreliable canonical tracking keeps the tracking preview unavailable", () => {
  const state = seedStressTestState();
  const canonicalCache = state.editConfig?.cameraTrackingCaches?.[0];
  assert.ok(canonicalCache);
  state.editConfig = {
    ...state.editConfig,
    cameraTrackingCaches: [{ ...canonicalCache, quality: "unreliable" }],
  };
  state.ui.workspace.trackingPreviewActive = true;

  const surface = renderWorkspaceSurface(state);

  assert.doesNotMatch(surface.main, /data-lab-workspace-tracking-comparison="true"/);
});

void test("tracking preview and report visibility toggle independently", () => {
  const store = createLabStore();

  store.dispatch({ type: "workspace-tracking-preview-toggled" });
  assert.equal(store.getState().ui.workspace.trackingPreviewActive, true);
  assert.equal(store.getState().ui.workspace.processViewActive, false);

  store.dispatch({ type: "workspace-process-view-toggled", force: true });
  assert.equal(store.getState().ui.workspace.trackingPreviewActive, true);
  assert.equal(store.getState().ui.workspace.processViewActive, true);

  store.dispatch({ type: "workspace-process-view-toggled", force: false });
  assert.equal(store.getState().ui.workspace.trackingPreviewActive, true);
  assert.equal(store.getState().ui.workspace.processViewActive, false);

  store.dispatch({
    type: "workspace-comparison-updated",
    patch: { comparisonViewMode: "stacked" },
  });
  assert.equal(store.getState().ui.workspace.trackingPreviewActive, false);
  assert.equal(store.getState().ui.workspace.comparisonViewMode, "stacked");

  store.dispatch({ type: "workspace-tracking-preview-toggled" });
  assert.equal(store.getState().ui.workspace.trackingPreviewActive, true);
  assert.equal(store.getState().ui.workspace.comparisonViewMode, "side-by-side");
  assert.equal(store.getState().ui.workspace.processViewActive, false);
});

void test("active analysis keeps the process strip on analysis summary and raw log", () => {
  const state = seedStressTestState();
  state.run = {
    id: "run-1",
    state: "running",
    startedAt: Date.now(),
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
    progress: null,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  const markup = renderLabProcessStrip(state);
  assert.match(markup, /data-lab-process-content="analysis"/);
  assert.doesNotMatch(markup, /data-lab-live-results="true"/);
  assert.match(markup, /Analiz özeti|Analysis summary/);
  assert.match(markup, /Ham log|Raw log/);
});
