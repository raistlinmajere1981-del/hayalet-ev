import assert from "node:assert/strict";
import test from "node:test";

import { isLaboratoryHistoryEntry } from "../../rooms/laboratory/domain/lab-analysis-results.ts";
import { createLaboratoryPresetEditRuntime } from "../../rooms/laboratory/shared/host/preset-edit-runtime.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const runtime = createLaboratoryPresetEditRuntime({
  asNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  },
  normalizeSourceMetadata(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? toRecord(value) : null;
  },
  toRecord,
});

const editPresets = {
  defaultMode: "beginner",
  focusRegions: {
    "full-frame": {
      cropNormalized: { x: 0, y: 0, width: 1, height: 1 },
    },
  },
  resizePresets: {
    analysis: { width: 1280 },
  },
  presets: {
    video: { beginner: [] },
    audio: { beginner: [] },
    image: { beginner: [] },
  },
};

function temporalResult(index: number) {
  return {
    schemaVersion: 2,
    kind: "temporal-stress-test",
    id: `temporal-stress-${String(index)}`,
    createdAt: `2026-08-24T10:${String(index).padStart(2, "0")}:00.000Z`,
    sourceKind: "video",
    sourcePath: "/tmp/source.mp4",
    request: { startSeconds: 4, endSeconds: 6, sampleFps: 5, roi: null },
    metrics: {
      summary: {
        spatialEdgePersistenceRatio: 0.75,
        spatialEdgePersistenceSampleCount: 6,
      },
    },
    interpretation: { schemaVersion: 1, kind: "temporal-baseline" },
  };
}

const roi = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };

function regionMetrics() {
  return {
    chromaDistance: 0.1,
    edgeEnergy: 0.1,
    edgePersistence: 0.1,
    frameDifferenceEnergy: 0.1,
    lumaHigh: 0.1,
    lumaLow: 0.1,
    lumaMax: 0.1,
    lumaMin: 0.1,
    lumaSpread: 0.1,
    meanLuma: 0.1,
    medianLuma: 0.1,
    nearBlackFraction: 0.1,
    persistentNearBlackFraction: 0.1,
    recoveredDarkFraction: 0.1,
    sampleCount: 1,
    signalNoiseLike: 0.1,
    temporalPersistence: 0.1,
    visibilityScore: 0.1,
  };
}

function metricDifference() {
  return {
    chromaDistance: 0,
    edgeEnergy: 0,
    edgePersistence: 0,
    frameDifferenceEnergy: 0,
    lumaHigh: 0,
    lumaLow: 0,
    lumaMax: 0,
    lumaMin: 0,
    lumaSpread: 0,
    meanLuma: 0,
    medianLuma: 0,
    nearBlackFraction: 0,
    persistentNearBlackFraction: 0,
    recoveredDarkFraction: 0,
    signalNoiseLike: 0,
    temporalPersistence: 0,
    visibilityScore: 0,
  };
}

function trackingProvenance() {
  return {
    algorithm: "feature-similarity-ransac",
    anchorSeconds: 1,
    cacheId: "tracking-current",
    confidence: 0.8,
    fallbackUsed: false,
    featureCount: 32,
    forwardBackwardRatio: 0.9,
    inlierRatio: 0.75,
    measurementCoordinateMode: "fixed-roi",
    mode: "global-feature-similarity",
    quality: "high",
    residualErrorPx: 0.8,
    status: "completed",
    transformModel: "similarity-dx-dy-rotation-scale",
    transformSeries: [],
    version: 2,
  };
}

function visualResult() {
  return {
    createdAt: "2026-08-31T12:00:00.000Z",
    hypothesis: "target-vs-background-response",
    id: "visual-current",
    interpretation: {
      classification: "result-uncertain",
      dataQuality: "sufficient",
      photometricCoordinateMode: "fixed-roi",
      sensorCompatibility: "not-assessed",
      trackingAppliedToMeasurement: false,
      trackingQuality: "high",
      trackingQualityGate: "advisory",
      ungatedClassification: "result-uncertain",
    },
    kind: "visibility-response",
    method: {
      axisValues: [1],
      metrics: ["visibilityScore"],
      nearBlackThreshold8Bit: 16,
      recoveryMultiplier: 2,
    },
    points: [
      {
        background: regionMetrics(),
        differential: metricDifference(),
        target: regionMetrics(),
        value: 1,
      },
    ],
    request: {
      axis: "contrast",
      backgroundRoi: roi,
      temporalRequest: {
        endSeconds: 2,
        roi,
        sampleFps: 5,
        startSeconds: 1,
      },
    },
    schemaVersion: 2,
    sourceKind: "video",
    sourcePath: "/tmp/source.mp4",
    tracking: trackingProvenance(),
  };
}

function appearanceResult() {
  return {
    createdAt: "2026-08-31T12:01:00.000Z",
    hypothesis: "localized-appearance-disappearance-transition",
    id: "appearance-current",
    interpretation: {
      classification: "result-uncertain",
      controlComparability: null,
      dataQuality: "sufficient",
      eventEdgePersistenceShift: 0,
      eventFrameDifferenceShift: 0,
      eventVisibilityShift: 0,
      photometricCoordinateMode: "fixed-roi",
      postVisibilityShift: 0,
      structuralCoordinateMode: "camera-similarity",
    },
    kind: "appearance-transition",
    phases: [
      {
        background: regionMetrics(),
        control: null,
        differential: metricDifference(),
        endSeconds: 2,
        phase: "event",
        startSeconds: 1,
        target: regionMetrics(),
        targetVsControl: null,
      },
    ],
    request: {
      backgroundRoi: roi,
      controlRoi: null,
      eventSeconds: 1.5,
      temporalRequest: {
        endSeconds: 2,
        roi,
        sampleFps: 5,
        startSeconds: 1,
      },
    },
    schemaVersion: 3,
    sourceKind: "video",
    sourcePath: "/tmp/source.mp4",
    structural: { error: "measurement unavailable", status: "unavailable" },
    tracking: trackingProvenance(),
  };
}

void test("default edit state starts with empty temporal stress-test history", () => {
  const edit = runtime.createDefaultEditState(editPresets, "video");
  assert.deepEqual(edit.temporalStressTests, []);
});

void test("edit normalization preserves temporal stress-test history across restart", () => {
  const defaults = runtime.createDefaultEditState(editPresets, "video");
  const normalized = runtime.normalizeEditState(
    {
      ...defaults,
      temporalStressTests: [
        {
          ...temporalResult(1),
          id: "temporal-stress-one",
        },
      ],
    },
    editPresets,
    "video"
  );

  assert.equal(normalized.temporalStressTests.length, 1);
  assert.equal(normalized.temporalStressTests[0]?.["id"], "temporal-stress-one");
  const first = normalized.temporalStressTests[0];
  assert.ok(first?.kind === "temporal-stress-test");
  assert.deepEqual(toRecord(first["metrics"])["summary"], {
    spatialEdgePersistenceRatio: 0.75,
    spatialEdgePersistenceSampleCount: 6,
  });
});

void test("edit normalization caps temporal stress-test history at twenty entries", () => {
  const defaults = runtime.createDefaultEditState(editPresets, "video");
  const normalized = runtime.normalizeEditState(
    {
      ...defaults,
      temporalStressTests: Array.from({ length: 24 }, (_, index) => temporalResult(index)),
    },
    editPresets,
    "video"
  );

  assert.equal(normalized.temporalStressTests.length, 20);
  assert.equal(normalized.temporalStressTests[0]?.["id"], "temporal-stress-0");
  assert.equal(normalized.temporalStressTests[19]?.["id"], "temporal-stress-19");
});

void test("edit normalization rejects malformed or unknown history records", () => {
  const defaults = runtime.createDefaultEditState(editPresets, "video");
  const normalized = runtime.normalizeEditState(
    {
      ...defaults,
      temporalStressTests: [
        { id: "missing-contract" },
        { ...temporalResult(1), kind: "unknown-analysis" },
        { ...temporalResult(1), schemaVersion: 1 },
        temporalResult(2),
      ],
    },
    editPresets,
    "video"
  );

  assert.deepEqual(
    normalized.temporalStressTests.map((entry) => entry.id),
    ["temporal-stress-2"]
  );
});

void test("current visual history rejects malformed tracking provenance", () => {
  const current = visualResult();
  assert.equal(isLaboratoryHistoryEntry(current), true);
  assert.equal(isLaboratoryHistoryEntry({ ...current, tracking: {} }), false);
});

void test("current appearance history rejects malformed tracking and structural results", () => {
  const current = appearanceResult();
  assert.equal(isLaboratoryHistoryEntry(current), true);
  assert.equal(isLaboratoryHistoryEntry({ ...current, tracking: {} }), false);
  assert.equal(isLaboratoryHistoryEntry({ ...current, structural: {} }), false);
});

void test("supplemental history accepts only its current schema and non-empty identity", () => {
  const current = temporalResult(3);
  assert.equal(isLaboratoryHistoryEntry(current), true);
  assert.equal(isLaboratoryHistoryEntry({ ...current, schemaVersion: 1 }), false);
  assert.equal(isLaboratoryHistoryEntry({ ...current, id: "" }), false);
  assert.equal(isLaboratoryHistoryEntry({ ...current, createdAt: "" }), false);
});
