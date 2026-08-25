import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateLaboratoryStructuralFrameMetrics } from "../../rooms/laboratory/features/media-analysis/host/structural-transition.ts";
import { formatLaboratoryStructuralTransitionMarkdown } from "../../rooms/laboratory/ui/workspace-structural-transition-summary.ts";

function checkerboard(inverted = false) {
  const size = 64;
  return Uint8Array.from({ length: size * size }, function (_unused, index) {
    const x = index % size;
    const y = Math.floor(index / size);
    const light = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
    const value = light ? 255 : 0;
    return inverted ? 255 - value : value;
  });
}

void test("structural metrics preserve identical PRE template as full persistence", () => {
  const baseline = checkerboard();
  const result = calculateLaboratoryStructuralFrameMetrics(baseline, baseline);
  assert.ok(result.structuralSimilarity > 0.999);
  assert.ok(result.normalizedPixelCorrelation > 0.999);
  assert.ok(result.edgeSimilarity > 0.999);
  assert.ok(result.structuralPersistence > 0.999);
  assert.ok(result.normalizedAbsoluteDifference < 0.001);
});

void test("structural metrics detect strong template replacement without a mechanism verdict", () => {
  const result = calculateLaboratoryStructuralFrameMetrics(checkerboard(), checkerboard(true));
  assert.ok(result.normalizedAbsoluteDifference > 0.95);
  assert.ok(result.normalizedPixelCorrelation < 0.05);
  assert.ok(result.structuralPersistence < 0.5);
});

void test("structural runtime keeps dense event timeline and translation-only confidence fallback", async () => {
  const source = await readFile(
    "rooms/laboratory/features/media-analysis/host/structural-transition.ts",
    "utf8"
  );
  assert.match(source, /\[-1, -0\.8, -0\.6, -0\.4, -0\.2, 0, 0\.2, 0\.4, 0\.6, 0\.8, 1\]/);
  assert.match(source, /grayscale-translation-block-match/);
  assert.match(source, /tracking-confidence-low/);
  assert.match(source, /fallbackUsed/);
  assert.match(source, /targetVsControlStructuralLoss/);
  assert.match(source, /targetSpecificStructuralLoss/);
  assert.match(source, /post-to-reference-convergence/);
  assert.doesNotMatch(source, /paranormal/i);
});

void test("structural transition report exports control differential timeline and ROI stability", () => {
  const targetMetrics = {
    structuralSimilarity: 0.62,
    normalizedPixelCorrelation: 0.68,
    edgeSimilarity: 0.71,
    structuralPersistence: 0.66,
  };
  const controlMetrics = {
    structuralSimilarity: 0.88,
    normalizedPixelCorrelation: 0.9,
    edgeSimilarity: 0.91,
    structuralPersistence: 0.89,
  };
  const backgroundMetrics = {
    structuralSimilarity: 0.9,
    normalizedPixelCorrelation: 0.91,
    edgeSimilarity: 0.92,
    structuralPersistence: 0.9,
  };
  const point = {
    offsetSeconds: 0,
    target: { metrics: targetMetrics },
    control: { metrics: controlMetrics },
    background: { metrics: backgroundMetrics },
    differential: {
      targetVsControlStructuralLoss: 0.23,
      targetVsBackgroundStructuralLoss: 0.24,
    },
  };
  const entry = {
    kind: "appearance-transition",
    createdAt: "2026-08-26T00:00:00.000Z",
    sourcePath: "/tmp/source.mp4",
    request: {
      temporalRequest: {
        roi: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 },
      },
      controlRoi: { x: 0.4, y: 0.2, width: 0.2, height: 0.2 },
      backgroundRoi: { x: 0.65, y: 0.2, width: 0.2, height: 0.2 },
      eventSeconds: 12.5,
    },
    phases: [
      {
        phase: "event",
        target: { visibilityScore: 0.45 },
        control: { visibilityScore: 0.6 },
        background: { visibilityScore: 0.61 },
        targetVsControl: { visibilityScore: -0.15 },
        targetVsBackground: { visibilityScore: -0.16 },
      },
    ],
    interpretation: {
      photometricClassification: "result-uncertain",
      controlComparability: { score: 0.84, status: "high" },
    },
    structural: {
      assessment: { classification: "structural-change-target-localized" },
      phaseSummary: { pre: point, event: point, post: point },
      timeline: [point],
      roiStability: {
        mode: "translation",
        trackingConfidence: 0.72,
        netDx: 3.2,
        netDy: -1.4,
        peakDisplacement: 4.1,
        risk: "low",
        riskRatio: 0.05,
        fallbackUsed: false,
      },
    },
  };
  const markdown = formatLaboratoryStructuralTransitionMarkdown(
    entry,
    {
      locale: "tr",
      t(_key: string, fallback = "") {
        return fallback;
      },
    } as never
  );
  assert.match(markdown, /Control ROI/);
  assert.match(markdown, /Structural PRE \/ EVENT \/ POST/);
  assert.match(markdown, /Structural Timeline/);
  assert.match(markdown, /Target-Control structural loss/);
  assert.match(markdown, /ROI Stability/);
  assert.match(markdown, /Tracking confidence: 72%/);
  assert.match(markdown, /SSIM-like/);
  assert.doesNotMatch(markdown, /paranormal|real\/fake verdict/i);
});

void test("transition host enrichment keeps legacy photometry and adds control plus structural result", async () => {
  const handlers = await readFile(
    "rooms/laboratory/features/media-analysis/host/action-handlers.ts",
    "utf8"
  );
  const controller = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  assert.match(handlers, /runTransitionProbe/);
  assert.match(handlers, /enrichTransitionResult/);
  assert.match(handlers, /measureControlPhases/);
  assert.match(handlers, /analyzeTransition/);
  assert.match(controller, /controlRoi/);
  assert.match(controller, /backgroundRoi/);
});
