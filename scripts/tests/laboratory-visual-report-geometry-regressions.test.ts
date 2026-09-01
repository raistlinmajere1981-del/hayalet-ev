import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateLaboratoryContainedMediaRect } from "../../rooms/laboratory/ui/lab-roi-media-geometry-binder.ts";
import { buildLaboratoryVisualResponseReportAssessment } from "../../rooms/laboratory/shared/visual-response-report-assessment.ts";
import {
  buildLaboratoryVisualReportModel,
  formatLaboratoryVisualReportMarkdown,
  renderWorkspaceVisualResponseSummaries,
} from "../../rooms/laboratory/ui/workspace-visual-response-summary.ts";

function point(
  value: number,
  visibilityDelta: number,
  edgeDelta = 0,
  recoveredDarkDelta = 0,
  temporalDelta = 0,
  chromaDelta = 0
) {
  const background = {
    meanLuma: 0.35,
    lumaSpread: 0.28,
    edgeEnergy: 0.14,
    recoveredDarkFraction: 0.18,
    temporalPersistence: 0.8,
    chromaDistance: 0.08,
    visibilityScore: 0.5,
  };
  return {
    value,
    background,
    target: {
      ...background,
      edgeEnergy: background.edgeEnergy + edgeDelta,
      recoveredDarkFraction: background.recoveredDarkFraction + recoveredDarkDelta,
      temporalPersistence: background.temporalPersistence + temporalDelta,
      chromaDistance: background.chromaDistance + chromaDelta,
      visibilityScore: background.visibilityScore + visibilityDelta,
    },
    differential: {
      meanLuma: 0,
      lumaSpread: 0,
      edgeEnergy: edgeDelta,
      recoveredDarkFraction: recoveredDarkDelta,
      temporalPersistence: temporalDelta,
      chromaDistance: chromaDelta,
      visibilityScore: visibilityDelta,
    },
  };
}

const copy = {
  locale: "tr",
  t(_key: string, fallback = "") {
    return fallback;
  },
} as never;

void test("ROI media geometry follows contain letterboxing instead of the changing panel box", () => {
  const wide = calculateLaboratoryContainedMediaRect(
    { left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500 },
    16 / 9
  );
  assert.ok(Math.abs(wide.width - 888.8889) < 0.001);
  assert.ok(Math.abs(wide.left - 55.5556) < 0.001);
  assert.equal(wide.height, 500);

  const square = calculateLaboratoryContainedMediaRect(
    { left: 0, top: 0, width: 500, height: 500, right: 500, bottom: 500 },
    16 / 9
  );
  assert.equal(square.width, 500);
  assert.ok(Math.abs(square.height - 281.25) < 0.001);
  assert.ok(Math.abs(square.top - 109.375) < 0.001);
});

void test("large background ROI mismatch gates a strong visibility separation", () => {
  const entry = {
    kind: "visibility-response",
    request: {
      axis: "contrast",
      temporalRequest: {
        startSeconds: 10,
        endSeconds: 12,
        roi: { x: 0.44, y: 0.51, width: 0.1, height: 0.42 },
      },
      backgroundRoi: { x: 0.57, y: 0.04, width: 0.39, height: 0.9 },
    },
    points: [
      point(0.5, 0.21),
      point(0.7, 0.23),
      point(0.85, 0.12),
      point(1, 0.07, 0, -0.11),
      point(1.2, 0.07, 0.01, -0.18),
      point(1.5, 0.21, 0.01, -0.14),
      point(2, 0.38, 0.01, 0.01),
    ],
  };
  const assessment = buildLaboratoryVisualResponseReportAssessment(entry);
  assert.equal(assessment.classification, "background-not-comparable");
  assert.equal(assessment.comparability.status, "low");
  assert.ok(assessment.comparability.roiAreaRatio < 0.2);
});

void test("visibility-only divergence stays below multi-metric target-response classification", () => {
  const entry = {
    kind: "visibility-response",
    request: {
      axis: "contrast",
      temporalRequest: {
        roi: { x: 0.1, y: 0.1, width: 0.25, height: 0.25 },
      },
      backgroundRoi: { x: 0.4, y: 0.1, width: 0.25, height: 0.25 },
    },
    points: [point(0.5, 0.05), point(1, 0.12), point(1.5, 0.22), point(2, 0.3)],
  };
  const assessment = buildLaboratoryVisualResponseReportAssessment(entry);
  assert.equal(assessment.classification, "visibility-only-separation");
  assert.equal(assessment.corroboration.supportingMetricCount, 0);
});

void test("comparable ROIs need multiple supporting metrics for target-response-differs", () => {
  const entry = {
    kind: "visibility-response",
    request: {
      axis: "contrast",
      temporalRequest: {
        roi: { x: 0.1, y: 0.1, width: 0.25, height: 0.25 },
      },
      backgroundRoi: { x: 0.4, y: 0.1, width: 0.25, height: 0.25 },
    },
    points: [
      point(0.5, 0.04, 0, 0),
      point(1, 0.1, 0.02, 0.02),
      point(1.5, 0.24, 0.06, 0.1),
      point(2, 0.34, 0.09, 0.14),
    ],
  };
  const assessment = buildLaboratoryVisualResponseReportAssessment(entry);
  assert.equal(assessment.comparability.status, "high");
  assert.ok(assessment.corroboration.supportingMetricCount >= 2);
  assert.equal(assessment.classification, "target-response-differs");
});

void test("visual report copy surface exports structured markdown instead of flattened table text", () => {
  const entry = {
    kind: "visibility-response",
    createdAt: "2026-08-25T20:00:00.000Z",
    sourcePath: "/tmp/source.mp4",
    tracking: {
      status: "completed",
      algorithm: "feature-similarity-ransac",
      version: 2,
      transformModel: "similarity-dx-dy-rotation-scale",
      mode: "global-feature-similarity",
      cacheId: "tracking-cache-visual-1",
      anchorSeconds: 11,
      quality: "medium",
      confidence: 0.69,
      inlierRatio: 0.61,
      forwardBackwardRatio: 0.84,
      residualErrorPx: 1.8,
      featureCount: 36,
      fallbackUsed: false,
      measurementCoordinateMode: "fixed-roi",
      transformSeries: [],
    },
    request: {
      axis: "contrast",
      temporalRequest: {
        startSeconds: 10,
        endSeconds: 12,
        roi: { x: 0.1, y: 0.1, width: 0.25, height: 0.25 },
      },
      backgroundRoi: { x: 0.4, y: 0.1, width: 0.25, height: 0.25 },
    },
    points: [point(0.5, 0.05), point(1, 0.06), point(1.5, 0.07)],
  };
  const markdown = formatLaboratoryVisualReportMarkdown(entry, copy);
  assert.match(markdown, /# Hayalet Ev Laboratory/);
  assert.match(markdown, /Interpretation policy: measurement only/);
  assert.match(markdown, /\| Axis \| Target visibility \| Background visibility \|/);
  assert.match(markdown, /\| 0\.5 \|/);
  assert.match(markdown, /## ROI Tracking \/ Stabilization/);
  assert.match(markdown, /Measurement coordinate mode: fixed ROI/);
  assert.match(markdown, /Photometric measurements use fixed ROI coordinates/);

  const markup = renderWorkspaceVisualResponseSummaries(
    { temporalStressTests: [entry] } as never,
    copy
  );
  assert.match(markup, /data-lab-report-copy="true"/);
  assert.match(markup, /data-lab-report-export="true"/);
  assert.match(markup, /data-lab-report-markdown="true"/);
  assert.match(markup, /ROI Tracking \/ Stabilization/);
});

void test("tracker-unavailable report exposes fallback provenance without fake zero diagnostics", () => {
  const entry = {
    kind: "visibility-response",
    createdAt: "2026-08-31T12:00:00.000Z",
    sourcePath: "/tmp/source.mp4",
    tracking: {
      status: "unavailable",
      algorithm: "feature-similarity-ransac",
      version: 2,
      transformModel: "similarity-dx-dy-rotation-scale",
      mode: "fixed-roi-fallback",
      cacheId: "tracking-cache-unavailable",
      anchorSeconds: 11,
      quality: "unreliable",
      confidence: null,
      inlierRatio: null,
      forwardBackwardRatio: null,
      residualErrorPx: null,
      featureCount: null,
      fallbackUsed: true,
      measurementCoordinateMode: "fixed-roi-fallback",
      transformSeries: [],
      error: "Camera tracker process unavailable.",
    },
    request: {
      axis: "contrast",
      temporalRequest: {
        startSeconds: 10,
        endSeconds: 12,
        roi: { x: 0.1, y: 0.1, width: 0.25, height: 0.25 },
      },
      backgroundRoi: { x: 0.4, y: 0.1, width: 0.25, height: 0.25 },
    },
    interpretation: {
      classification: "roi-tracking-quality-limits-response-result",
      sensorCompatibility: "not-assessed",
      trackingQualityGate: "limited",
    },
    points: [point(1, 0.05)],
  };

  const markdown = formatLaboratoryVisualReportMarkdown(entry, copy);
  const model = buildLaboratoryVisualReportModel(entry, copy);
  assert.equal(model?.classification, "roi-tracking-quality-limits-response-result");
  assert.match(markdown, /Tracking kalitesi response sonucunu sınırlıyor/);
  assert.doesNotMatch(markdown, /birden fazla metrikte ayrışıyor/);
  assert.match(markdown, /Status: unavailable/);
  assert.match(markdown, /Tracking quality: UNRELIABLE/);
  assert.match(markdown, /Quality gate: limited/);
  assert.match(markdown, /Fallback used: yes — fixed ROI fallback/);
  assert.match(markdown, /Measurement coordinate mode: fixed ROI fallback/);
  assert.match(markdown, /Tracking error: Camera tracker process unavailable\./);
  assert.doesNotMatch(markdown, /- Confidence:/);
  assert.doesNotMatch(markdown, /- Inlier ratio:/);
  assert.doesNotMatch(markdown, /- Forward\/backward consistency:/);
  assert.doesNotMatch(markdown, /- Residual alignment error:/);
  assert.doesNotMatch(markdown, /- Feature count:/);
});

void test("visual report actions and geometry binders are wired at the Laboratory UI entry point", async () => {
  const index = await readFile("rooms/laboratory/ui/index.ts", "utf8");
  const reportBinder = await readFile(
    "rooms/laboratory/ui/lab-visual-report-actions-binder.ts",
    "utf8"
  );
  const geometryBinder = await readFile(
    "rooms/laboratory/ui/lab-roi-media-geometry-binder.ts",
    "utf8"
  );
  assert.match(index, /bindLaboratoryRoiMediaGeometry/);
  assert.match(index, /bindLaboratoryVisualReportActions/);
  assert.match(reportBinder, /clipboard/);
  assert.match(reportBinder, /text\/markdown/);
  assert.match(geometryBinder, /ResizeObserver/);
  assert.match(geometryBinder, /OVERLAY_SELECTOR = "\[data-lab-selection-roi-overlay='true'\]"/);
  assert.match(geometryBinder, /overlay\.style\.inset = "auto"/);
  assert.doesNotMatch(geometryBinder, /appendChild\(overlay\)/);
});
