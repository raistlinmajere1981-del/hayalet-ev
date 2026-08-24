import assert from "node:assert/strict";
import test from "node:test";

import {
  interpretLaboratoryControlDelta,
  interpretLaboratoryTemporalSummary,
} from "../../rooms/laboratory/shared/stress-test-interpretation.ts";
import { renderWorkspaceStressTestSummaries } from "../../rooms/laboratory/ui/workspace-stress-test-summary.ts";

const copy = {
  locale: "tr",
  t(_key: string, fallback = "") {
    return fallback;
  },
} as never;

const sufficientSummary = {
  sampleCount: 30,
  frameDifferenceSampleCount: 29,
  edgeSampleCount: 30,
};

void test("temporal interpretation describes a quiet stable interval without overstating it", () => {
  const interpretation = interpretLaboratoryTemporalSummary({
    ...sufficientSummary,
    meanFrameDifferenceEnergy: 0.002,
    edgePersistenceRatio: 0,
    lumaRange: 0.003,
    chromaURange: 0.001,
    chromaVRange: 0.001,
  });

  assert.equal(interpretation.dataQuality, "sufficient");
  assert.equal(interpretation.frameActivity, "very-low");
  assert.equal(interpretation.edgePersistence, "low");
  assert.equal(interpretation.luminanceVariation, "stable");
  assert.equal(interpretation.chromaVariation, "stable");
});

void test("temporal interpretation refuses to infer stability from empty samples", () => {
  const interpretation = interpretLaboratoryTemporalSummary({
    sampleCount: 0,
    frameDifferenceSampleCount: 0,
    edgeSampleCount: 0,
    meanFrameDifferenceEnergy: 0,
    edgePersistenceRatio: 0,
  });

  assert.equal(interpretation.dataQuality, "insufficient");
});

void test("control interpretation maps a +0.011 frame delta to a clear measurable increase", () => {
  const interpretation = interpretLaboratoryControlDelta(
    {
      meanFrameDifferenceEnergy: 0.011,
      peakFrameDifferenceEnergy: 0.01,
      meanEdgeEnergy: 0,
      edgePersistenceRatio: 0,
      lumaRange: 0,
      chromaURange: 0,
      chromaVRange: 0,
    },
    {
      baselineSummary: sufficientSummary,
      injectedSummary: sufficientSummary,
    }
  );

  assert.equal(interpretation.dataQuality, "sufficient");
  assert.equal(interpretation.overallImpact, "moderate");
  assert.equal(interpretation.frameDifference.magnitude, "moderate");
  assert.equal(interpretation.frameDifference.direction, "increase");
  assert.equal(interpretation.edgePersistence.magnitude, "negligible");
});

void test("control interpretation preserves the direction of destructive metric changes", () => {
  const interpretation = interpretLaboratoryControlDelta(
    {
      meanFrameDifferenceEnergy: 0,
      meanEdgeEnergy: 0,
      edgePersistenceRatio: -0.2,
      lumaRange: 0,
      chromaURange: 0,
      chromaVRange: 0,
    },
    {
      baselineSummary: sufficientSummary,
      injectedSummary: sufficientSummary,
    }
  );

  assert.equal(interpretation.overallImpact, "moderate");
  assert.equal(interpretation.edgePersistence.magnitude, "moderate");
  assert.equal(interpretation.edgePersistence.direction, "decrease");
});

void test("control interpretation refuses a semantic result when paired measurements have no samples", () => {
  const emptySummary = {
    sampleCount: 0,
    frameDifferenceSampleCount: 0,
    edgeSampleCount: 0,
  };
  const interpretation = interpretLaboratoryControlDelta(
    { meanFrameDifferenceEnergy: 0.2 },
    { baselineSummary: emptySummary, injectedSummary: emptySummary }
  );

  assert.equal(interpretation.dataQuality, "insufficient");
});

void test("stress-test cards render readable Turkish meaning above the technical values", () => {
  const markup = renderWorkspaceStressTestSummaries(
    {
      temporalStressTests: [
        {
          kind: "control-injection",
          request: {
            kind: "noise",
            params: { strength: 12, seed: 4242 },
            temporalRequest: { startSeconds: 10, endSeconds: 16, sampleFps: 5, roi: null },
          },
          metrics: {
            baseline: { summary: sufficientSummary },
            injected: { summary: sufficientSummary },
          },
          delta: {
            meanFrameDifferenceEnergy: 0.011,
            peakFrameDifferenceEnergy: 0.01,
            meanEdgeEnergy: 0,
            edgePersistenceRatio: 0,
            lumaRange: 0,
            chromaURange: 0,
            chromaVRange: 0,
          },
        },
        {
          request: { startSeconds: 10, endSeconds: 16, sampleFps: 5, roi: null },
          metrics: {
            summary: {
              ...sufficientSummary,
              meanFrameDifferenceEnergy: 0.002,
              peakFrameDifferenceEnergy: 0.003,
              edgePersistenceRatio: 0,
              lumaRange: 0.003,
              chromaURange: 0.001,
              chromaVRange: 0.001,
            },
          },
        },
      ],
    } as never,
    copy
  );

  assert.match(markup, /Ölçümün anlamı/);
  assert.match(markup, /Seçili aralık kareden kareye oldukça durağan/);
  assert.match(markup, /Control sonucu/);
  assert.match(markup, /ölçülen metriklerde belirgin bir değişiklik oluşturdu/);
  assert.match(markup, /Kareler arası değişim belirgin biçimde arttı/);
  assert.match(markup, /Hedef yapının yok olduğu, üretildiği veya kaynağının açıklanmış olduğu anlamına gelmez/);
});
