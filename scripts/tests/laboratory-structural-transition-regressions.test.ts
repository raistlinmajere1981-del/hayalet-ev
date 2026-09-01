import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifyLaboratoryReferenceConvergenceShape,
  createLaboratoryBackgroundReferenceConvergenceRuntime,
} from "../../rooms/laboratory/features/media-analysis/host/background-reference-convergence.ts";
import {
  calculateLaboratoryStructuralFrameMetrics,
  createLaboratoryStructuralTransitionRuntime,
} from "../../rooms/laboratory/features/media-analysis/host/structural-transition.ts";
import type { CameraTrackingCache } from "../../rooms/laboratory/domain/lab-analysis-results.ts";
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

void test("background reference convergence shape distinguishes abrupt from gradual change", () => {
  assert.equal(
    classifyLaboratoryReferenceConvergenceShape([
      { offsetSeconds: -0.2, convergence: 0.2 },
      { offsetSeconds: 0, convergence: 0.22 },
      { offsetSeconds: 0.2, convergence: 0.25 },
      { offsetSeconds: 0.4, convergence: 0.56 },
      { offsetSeconds: 0.6, convergence: 0.58 },
    ]),
    "abrupt"
  );
  assert.equal(
    classifyLaboratoryReferenceConvergenceShape([
      { offsetSeconds: -0.2, convergence: 0.2 },
      { offsetSeconds: 0, convergence: 0.25 },
      { offsetSeconds: 0.2, convergence: 0.31 },
      { offsetSeconds: 0.4, convergence: 0.38 },
      { offsetSeconds: 0.6, convergence: 0.45 },
      { offsetSeconds: 0.8, convergence: 0.52 },
    ]),
    "gradual"
  );
});

void test("structural runtime keeps dense stabilized timeline and confidence fallback", async () => {
  const source = await readFile(
    "rooms/laboratory/features/media-analysis/host/structural-transition.ts",
    "utf8"
  );
  const convergenceSource = await readFile(
    "rooms/laboratory/features/media-analysis/host/background-reference-convergence.ts",
    "utf8"
  );
  assert.match(source, /\[-1, -0\.8, -0\.6, -0\.4, -0\.2, 0, 0\.2, 0\.4, 0\.6, 0\.8, 1\]/);
  assert.match(source, /getLaboratoryCameraTransformAt/);
  assert.match(source, /camera similarity transform applied/);
  assert.match(source, /measurementSuitableForSmallRoi/);
  assert.match(source, /targetVsControlStructuralLoss/);
  assert.match(source, /targetSpecificStructuralLoss/);
  assert.match(convergenceSource, /camera-similarity/);
  assert.match(convergenceSource, /fixed-roi-fallback/);
  assert.match(convergenceSource, /target-loss-with-reference-convergence/);
  assert.match(convergenceSource, /weak-or-nonconvergent/);
  assert.doesNotMatch(`${source}\n${convergenceSource}`, /paranormal/i);
});

void test("failed tracking estimates do not become measured zero drift diagnostics", async () => {
  const runtime = createLaboratoryStructuralTransitionRuntime({
    async callRoomTools() {
      return { run: { exitCode: 0, stderr: "" } };
    },
    getProjectEditOutputDir() {
      return "/tmp";
    },
    async readBinaryFileBytes() {
      return new Uint8Array(64 * 64).fill(24);
    },
    roomId: "laboratory",
    toRecord(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
  });
  const failedPoint = (timeSeconds: number) => ({
    confidence: 0,
    featureCount: 20,
    forwardBackwardRatio: 0,
    inlierCount: 0,
    inlierRatio: 0,
    quality: "unreliable" as const,
    residual: { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 },
    residualErrorPx: 0,
    timeSeconds,
    transform: { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 },
  });
  const trackingCache: CameraTrackingCache = {
    algorithm: "feature-similarity-ransac",
    anchorSeconds: 10,
    cacheId: "failed-estimate-cache",
    createdAt: "2026-09-01T00:00:00.000Z",
    exclusionRois: [],
    fallbackUsed: true,
    mode: "fixed-roi-fallback",
    preferredReferenceRoi: null,
    quality: "unreliable",
    sourceHeight: 1080,
    sourcePath: "/tmp/source.mp4",
    sourceWidth: 1920,
    transformModel: "similarity-dx-dy-rotation-scale",
    transforms: [failedPoint(9), failedPoint(11)],
    version: 2,
  };
  const result = await runtime.analyzeTransition({
    backgroundRoi: { x: 0.65, y: 0.2, width: 0.2, height: 0.2 },
    controlRoi: { x: 0.4, y: 0.2, width: 0.2, height: 0.2 },
    durationSeconds: 20,
    eventSeconds: 10,
    project: {},
    referenceRoi: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 },
    requestId: "failed-estimate",
    runtime: {},
    sourceHeight: 1080,
    sourcePath: "/tmp/source.mp4",
    sourceWidth: 1920,
    targetRoi: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 },
    trackingCache,
  });
  assert.equal(result.status, "assessed");
  if (result.status !== "assessed") return;
  assert.equal(result.roiStability.residualErrorPx, null);
  assert.equal(result.roiStability.peakDisplacement, null);
  assert.equal(result.roiStability.peakRotationDegrees, null);
  assert.equal(result.roiStability.peakScaleDelta, null);
  assert.equal(result.roiStability.risk, "unknown");
  assert.equal(result.roiStability.measurementSuitableForSmallRoi, false);
});

void test("limited reference alignment reports the reference point quality", async () => {
  const runtime = createLaboratoryBackgroundReferenceConvergenceRuntime({
    async callRoomTools() {
      return { run: { exitCode: 0, stderr: "" } };
    },
    getProjectEditOutputDir() {
      return "/tmp";
    },
    async readBinaryFileBytes() {
      return new Uint8Array(64 * 64).fill(24);
    },
    roomId: "laboratory",
    toRecord(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
  });
  const lowReferencePoint = {
    confidence: 0.4,
    featureCount: 20,
    forwardBackwardRatio: 0.7,
    inlierCount: 8,
    inlierRatio: 0.4,
    quality: "low" as const,
    residual: { dx: 0.2, dy: -0.1, rotationDegrees: 0.01, scale: 1 },
    residualErrorPx: 2.5,
    timeSeconds: 12,
    transform: { dx: 2, dy: -1, rotationDegrees: 0.2, scale: 1.01 },
  };
  const trackingCache: CameraTrackingCache = {
    algorithm: "feature-similarity-ransac",
    anchorSeconds: 10,
    cacheId: "mixed-reference-cache",
    createdAt: "2026-09-01T00:00:00.000Z",
    exclusionRois: [],
    fallbackUsed: false,
    mode: "global-feature-similarity",
    preferredReferenceRoi: null,
    quality: "high",
    sourceHeight: 1080,
    sourcePath: "/tmp/source.mp4",
    sourceWidth: 1920,
    transformModel: "similarity-dx-dy-rotation-scale",
    transforms: [lowReferencePoint],
    version: 2,
  };
  const result = await runtime.analyzeConvergence({
    backgroundReferenceSeconds: 12,
    durationSeconds: 20,
    eventSeconds: 10,
    project: {},
    requestId: "low-reference",
    runtime: {},
    sourceHeight: 1080,
    sourcePath: "/tmp/source.mp4",
    sourceWidth: 1920,
    targetRoi: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 },
    targetStructuralTimeline: [],
    trackingCache,
  });
  assert.equal(result.status, "limited");
  if (result.status !== "limited") return;
  assert.equal(result.tracking.quality, "low");
  assert.equal(result.tracking.referenceConfidence, 0.4);
  assert.equal(result.tracking.fallbackUsed, true);
});

void test("structural transition report exports convergence timeline and ROI stability", () => {
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
  const referenceMetrics = {
    structuralSimilarity: 0.74,
    normalizedPixelCorrelation: 0.81,
    edgeSimilarity: 0.78,
    structuralPersistence: 0.76,
  };
  const referencePoint = {
    offsetSeconds: 0,
    timeSeconds: 12.5,
    metrics: referenceMetrics,
  };
  const entry = {
    kind: "appearance-transition",
    createdAt: "2026-08-26T00:00:00.000Z",
    sourcePath: "/tmp/source.mp4",
    tracking: {
      status: "completed",
      algorithm: "feature-similarity-ransac",
      version: 2,
      transformModel: "similarity-dx-dy-rotation-scale",
      mode: "global-feature-similarity",
      cacheId: "tracking-cache-1",
      anchorSeconds: 12.5,
      quality: "high",
      confidence: 0.72,
      inlierRatio: 0.68,
      forwardBackwardRatio: 0.91,
      residualErrorPx: 1.25,
      featureCount: 48,
      fallbackUsed: false,
      transformSeries: [],
    },
    request: {
      temporalRequest: {
        roi: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 },
      },
      controlRoi: { x: 0.4, y: 0.2, width: 0.2, height: 0.2 },
      backgroundRoi: { x: 0.65, y: 0.2, width: 0.2, height: 0.2 },
      backgroundReferenceSeconds: 18.25,
      eventSeconds: 12.5,
    },
    phases: [
      {
        phase: "event",
        target: { visibilityScore: 0.45 },
        control: { visibilityScore: 0.6 },
        background: { visibilityScore: 0.61 },
        targetVsControl: { visibilityScore: -0.15 },
        differential: { visibilityScore: -0.16 },
      },
    ],
    interpretation: {
      classification: "result-uncertain",
      controlComparability: { score: 0.84, status: "high" },
    },
    structural: {
      status: "assessed",
      assessment: {
        classification: "structural-change-target-localized",
        trackingQualityGate: "pass",
      },
      phaseSummary: { pre: point, event: point, post: point },
      timeline: [point],
      roiStability: {
        residualErrorPx: 1.25,
        peakDisplacement: 4.1,
        peakRotationDegrees: 0.18,
        peakScaleDelta: 0.006,
        risk: "low",
        riskRatio: 0.05,
        measurementSuitableForSmallRoi: true,
      },
      revealedBackground: {
        status: "assessed",
        referenceTimeSeconds: 18.25,
        timeline: [referencePoint],
        phaseSummary: {
          pre: referencePoint,
          event: referencePoint,
          post: referencePoint,
          peakPost: referencePoint,
        },
        assessment: {
          classification: "target-loss-with-reference-convergence",
          transitionShape: "gradual",
          convergenceGain: 0.28,
          edgeConvergenceGain: 0.24,
          targetStructuralLossAtPeak: 0.34,
          peakPostConvergence: 0.76,
          peakPostOffsetSeconds: 0.6,
        },
      },
    },
  };
  const markdown = formatLaboratoryStructuralTransitionMarkdown(entry, {
    locale: "tr",
    t(_key: string, fallback = "") {
      return fallback;
    },
  } as never);
  assert.match(markdown, /Control ROI/);
  assert.match(markdown, /Background reference: 18\.25 s/);
  assert.match(markdown, /Structural PRE \/ EVENT \/ POST/);
  assert.match(markdown, /Structural Timeline/);
  assert.match(markdown, /Reference convergence/);
  assert.match(markdown, /Background Reference Convergence/);
  assert.match(markdown, /Transition shape: kademeli/);
  assert.match(markdown, /Target structural loss at peak convergence: 34%/);
  assert.match(markdown, /Target-Control structural loss/);
  assert.match(markdown, /ROI Tracking \/ Stabilization/);
  assert.match(markdown, /Confidence: 72%/);
  assert.match(markdown, /Residual alignment error: 1\.25 px/);
  assert.match(markdown, /Measurement coordinate mode: camera similarity/);
  assert.match(
    markdown,
    /Reference-time alignment: event-to-reference camera similarity transform; fixed ROI fallback/
  );
  assert.match(markdown, /SSIM-like/);
  assert.doesNotMatch(markdown, /Net dx\/dy|Corrected residual drift/);
  assert.doesNotMatch(markdown, /paranormal|real\/fake verdict/i);

  const limitedMarkdown = formatLaboratoryStructuralTransitionMarkdown(
    {
      ...entry,
      structural: {
        ...entry.structural,
        revealedBackground: {
          ...entry.structural.revealedBackground,
          status: "limited",
          tracking: {
            quality: "unreliable",
            referenceConfidence: null,
            inlierRatio: null,
            residualErrorPx: null,
          },
        },
      },
    },
    {
      locale: "tr",
      t(_key: string, fallback = "") {
        return fallback;
      },
    } as never
  );
  assert.match(limitedMarkdown, /Reference tracking quality: unreliable/);
  assert.doesNotMatch(
    limitedMarkdown,
    /Reference confidence|Reference inlier ratio|Reference residual alignment error/
  );
});

void test("canonical transition result carries a user-captured background reference into structural analysis", async () => {
  const handlers = await readFile(
    "rooms/laboratory/features/media-analysis/host/action-handlers.ts",
    "utf8"
  );
  const controller = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  assert.match(handlers, /createLaboratoryBackgroundReferenceConvergenceRuntime/);
  assert.match(handlers, /backgroundReferenceSeconds/);
  assert.match(handlers, /analyzeConvergence/);
  assert.match(handlers, /runTransitionProbe/);
  assert.match(handlers, /enrichTransitionResult/);
  assert.match(handlers, /measureControlPhases/);
  assert.match(handlers, /analyzeTransition/);
  assert.match(controller, /workspace-background-reference-capture/);
  assert.match(controller, /workspace-background-reference-clear/);
  assert.match(controller, /backgroundReferenceSecondsBySource/);
  assert.match(controller, /backgroundReferenceSeconds/);
  assert.match(controller, /controlRoi/);
  assert.match(controller, /backgroundRoi/);
});
