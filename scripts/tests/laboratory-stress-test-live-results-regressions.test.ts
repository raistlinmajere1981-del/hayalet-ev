import assert from "node:assert/strict";
import test from "node:test";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabProcessStrip } from "../../rooms/laboratory/ui/lab-process-strip.ts";

function seedStressTestState() {
  const store = createLabStore();
  const state = store.getState();
  state.source = {
    kind: "video",
    previewUrl: "file:///source.mp4",
    status: "ready",
  };
  state.editConfig = {
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
    temporalStressTests: [
      {
        schemaVersion: 1,
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
        schemaVersion: 1,
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
        schemaVersion: 1,
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
  };
  state.ui.workspace.processViewActive = true;
  state.ui.workspace.comparisonViewMode = "difference";
  return state;
}

void test("expanded idle process strip becomes compact newest-first report history", () => {
  const state = seedStressTestState();
  const markup = renderLabProcessStrip(state);

  assert.match(markup, /data-lab-live-results="true"/);
  assert.doesNotMatch(markup, /data-lab-process-content="analysis"/);
  assert.match(markup, /file:\/\/\/difference\.mp4/);
  assert.match(markup, /value="difference" selected/);
  assert.match(markup, /data-lab-stress-report-history="true"/);
  assert.match(markup, /Rapor Geçmişi|Report History/);
  assert.match(markup, /data-lab-report-latest="true"/);
  assert.match(markup, /data-lab-report-copy="true"/);
  assert.match(markup, /data-lab-report-export="true"/);
  assert.doesNotMatch(markup, /data-lab-control-comparison="true"/);
  assert.ok(markup.indexOf("Control · low light") < markup.indexOf("Control · noise"));
  assert.ok(markup.indexOf("Control · noise") < markup.indexOf("Temporal Stress Test"));
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
