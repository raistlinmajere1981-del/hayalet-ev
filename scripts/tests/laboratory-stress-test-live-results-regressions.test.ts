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
        request: {
          kind: "low-light",
          temporalRequest: {
            startSeconds: 10,
            endSeconds: 16,
            sampleFps: 5,
            roi: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
          },
        },
        delta: {
          meanFrameDifferenceEnergy: -0.005,
          peakFrameDifferenceEnergy: -0.008,
          edgePersistenceRatio: 0,
          meanEdgeEnergy: 0,
          lumaRange: -0.013,
          chromaURange: 0,
          chromaVRange: 0,
        },
        metrics: {
          baseline: { summary: { sampleCount: 30, frameDifferenceSampleCount: 29, edgeSampleCount: 30 } },
          injected: { summary: { sampleCount: 30, frameDifferenceSampleCount: 29, edgeSampleCount: 30 } },
        },
        interpretation: {
          schemaVersion: 1,
          kind: "control-injection",
          dataQuality: "sufficient",
          overallImpact: "moderate",
        },
      },
      {
        schemaVersion: 1,
        id: "control-noise",
        kind: "control-injection",
        request: {
          kind: "noise",
          temporalRequest: {
            startSeconds: 10,
            endSeconds: 16,
            sampleFps: 5,
            roi: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
          },
        },
        delta: {
          meanFrameDifferenceEnergy: 0.011,
          peakFrameDifferenceEnergy: 0.01,
          edgePersistenceRatio: 0,
          meanEdgeEnergy: 0,
          lumaRange: 0,
          chromaURange: 0,
          chromaVRange: 0,
        },
        metrics: {
          baseline: { summary: { sampleCount: 30, frameDifferenceSampleCount: 29, edgeSampleCount: 30 } },
          injected: { summary: { sampleCount: 30, frameDifferenceSampleCount: 29, edgeSampleCount: 30 } },
        },
        interpretation: {
          schemaVersion: 1,
          kind: "control-injection",
          dataQuality: "sufficient",
          overallImpact: "moderate",
        },
      },
      {
        schemaVersion: 1,
        id: "temporal-baseline",
        request: {
          startSeconds: 10,
          endSeconds: 16,
          sampleFps: 5,
          roi: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
        },
        metrics: {
          summary: {
            sampleCount: 30,
            frameDifferenceSampleCount: 29,
            edgeSampleCount: 30,
            meanFrameDifferenceEnergy: 0.005,
            peakFrameDifferenceEnergy: 0.008,
            edgePersistenceRatio: 0,
            lumaRange: 0.012,
            chromaURange: 0.001,
            chromaVRange: 0,
          },
        },
        interpretation: {
          schemaVersion: 1,
          kind: "temporal-baseline",
          dataQuality: "sufficient",
          frameActivity: "low",
          edgePersistence: "low",
          luminanceVariation: "mild",
          chromaVariation: "stable",
        },
      },
    ],
  };
  state.ui.workspace.processViewActive = true;
  state.ui.workspace.comparisonViewMode = "difference";
  return state;
}

void test("expanded idle process strip becomes the live stress-test result surface", () => {
  const state = seedStressTestState();
  const markup = renderLabProcessStrip(state);

  assert.match(markup, /data-lab-live-results="true"/);
  assert.doesNotMatch(markup, /data-lab-process-content="analysis"/);
  assert.match(markup, /file:\/\/\/difference\.mp4/);
  assert.match(markup, /value="difference" selected/);
  assert.match(markup, /data-lab-control-comparison="true"/);
  assert.match(markup, /data-control-kind="noise" data-status="ready"/);
  assert.match(markup, /data-control-kind="low-light" data-status="ready"/);
  assert.match(markup, /data-control-kind="blur" data-status="missing"/);
  assert.match(markup, /\+0\.011/);
  assert.match(markup, /-0\.013/);
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
