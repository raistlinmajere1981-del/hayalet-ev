import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyLaboratoryCameraTransformToRoi,
  estimateLaboratoryCameraTransform,
  getLaboratoryCameraTransformAt,
} from "../../rooms/laboratory/features/media-analysis/host/camera-tracking.ts";
import { isCameraTrackingCacheUsableForMeasurement } from "../../rooms/laboratory/domain/lab-analysis-results.ts";
import type { CameraTrackingCache } from "../../rooms/laboratory/domain/lab-analysis-results.ts";
import {
  isLaboratoryTrackingPreviewCacheUsable,
  resolveLaboratoryTrackingPreviewCache,
} from "../../rooms/laboratory/shared/tracking-preview-model.ts";

const WIDTH = 160;
const HEIGHT = 100;
const GEOMETRY = {
  width: WIDTH,
  height: HEIGHT,
  scaleX: 1,
  scaleY: 1,
};
const TARGET_ROI = { x: 0.34, y: 0.28, width: 0.3, height: 0.42 };

type Transform = {
  dx: number;
  dy: number;
  rotationDegrees: number;
  scale: number;
};

function baseScene() {
  const frame = new Uint8Array(WIDTH * HEIGHT).fill(24);
  function rect(x: number, y: number, width: number, height: number, value: number) {
    for (let py = y; py < y + height; py += 1) {
      for (let px = x; px < x + width; px += 1) {
        if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
          frame[py * WIDTH + px] = value;
        }
      }
    }
  }
  for (let x = 8; x < WIDTH - 8; x += 19) {
    rect(x, 8 + ((x * 7) % 22), 5, 14, 210);
    rect(x + 4, 62 + ((x * 3) % 17), 11, 4, 145);
  }
  rect(5, 48, 43, 3, 230);
  rect(111, 17, 4, 66, 196);
  rect(126, 72, 24, 4, 112);
  rect(18, 78, 5, 12, 245);
  return frame;
}

function inverseWarp(frame: Uint8Array, transform: Transform) {
  const output = new Uint8Array(WIDTH * HEIGHT).fill(12);
  const angle = (transform.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = transform.scale;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const qx = x - transform.dx;
      const qy = y - transform.dy;
      const sourceX = (cos * qx + sin * qy) / scale;
      const sourceY = (-sin * qx + cos * qy) / scale;
      const sx = Math.round(sourceX);
      const sy = Math.round(sourceY);
      if (sx >= 0 && sx < WIDTH && sy >= 0 && sy < HEIGHT) {
        output[y * WIDTH + x] = frame[sy * WIDTH + sx] ?? 0;
      }
    }
  }
  return output;
}

function paintTarget(frame: Uint8Array, offsetX: number, value: number) {
  const x0 = Math.round(TARGET_ROI.x * WIDTH) + offsetX;
  const y0 = Math.round(TARGET_ROI.y * HEIGHT);
  const width = Math.round(TARGET_ROI.width * WIDTH);
  const height = Math.round(TARGET_ROI.height * HEIGHT);
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
        frame[y * WIDTH + x] = (x + y) % 7 === 0 ? 255 : value;
      }
    }
  }
}

function estimate(anchor: Uint8Array, current: Uint8Array, exclusions = [TARGET_ROI]) {
  return estimateLaboratoryCameraTransform({
    anchorFrame: anchor,
    currentFrame: current,
    exclusionRois: exclusions,
    geometry: GEOMETRY as never,
    includeRoi: null,
    timeSeconds: 1,
  });
}

function assertTransformClose(
  estimated: ReturnType<typeof estimate>,
  expected: Transform,
  tolerance: { translation?: number; rotation?: number; scale?: number } = {}
) {
  const translationTolerance = tolerance.translation ?? 2.2;
  const rotationTolerance = tolerance.rotation ?? 1.2;
  const scaleTolerance = tolerance.scale ?? 0.035;
  assert.notEqual(estimated.quality, "unreliable");
  assert.ok(Math.abs(estimated.transform.dx - expected.dx) <= translationTolerance);
  assert.ok(Math.abs(estimated.transform.dy - expected.dy) <= translationTolerance);
  assert.ok(
    Math.abs(estimated.transform.rotationDegrees - expected.rotationDegrees) <= rotationTolerance
  );
  assert.ok(Math.abs(estimated.transform.scale - expected.scale) <= scaleTolerance);
  assert.ok(estimated.inlierCount >= 4);
  assert.ok(estimated.inlierRatio > 0.35);
}

void test("camera tracking recovers horizontal translation", () => {
  const anchor = baseScene();
  const expected = { dx: 7, dy: 0, rotationDegrees: 0, scale: 1 };
  assertTransformClose(estimate(anchor, inverseWarp(anchor, expected)), expected);
});

void test("camera tracking recovers vertical translation", () => {
  const anchor = baseScene();
  const expected = { dx: 0, dy: -6, rotationDegrees: 0, scale: 1 };
  assertTransformClose(estimate(anchor, inverseWarp(anchor, expected)), expected);
});

void test("camera tracking recovers translation plus small rotation", () => {
  const anchor = baseScene();
  const expected = { dx: 4, dy: 2, rotationDegrees: 2.5, scale: 1 };
  assertTransformClose(estimate(anchor, inverseWarp(anchor, expected)), expected, {
    translation: 3,
    rotation: 1.4,
  });
});

void test("camera tracking recovers mild zoom", () => {
  const anchor = baseScene();
  const expected = { dx: 1, dy: -1, rotationDegrees: 0, scale: 1.035 };
  assertTransformClose(estimate(anchor, inverseWarp(anchor, expected)), expected, {
    translation: 3,
    scale: 0.045,
  });
});

void test("moving foreground is excluded from static-camera estimation", () => {
  const anchor = baseScene();
  const current = anchor.slice();
  paintTarget(anchor, 0, 40);
  paintTarget(current, 18, 210);
  const result = estimate(anchor, current);
  assert.notEqual(result.quality, "unreliable");
  assert.ok(Math.hypot(result.transform.dx, result.transform.dy) < 3);
  assert.ok(Math.abs(result.transform.rotationDegrees) < 1.5);
  assert.ok(Math.abs(result.transform.scale - 1) < 0.035);
});

void test("moving foreground plus moving camera follows camera rather than target", () => {
  const anchor = baseScene();
  paintTarget(anchor, 0, 50);
  const cameraTransform = { dx: -6, dy: 5, rotationDegrees: 1.5, scale: 1.01 };
  const current = inverseWarp(anchor, cameraTransform);
  paintTarget(current, 20, 235);
  assertTransformClose(estimate(anchor, current), cameraTransform, {
    translation: 3.2,
    rotation: 1.5,
    scale: 0.045,
  });
});

void test("low-texture dark scene reports unreliable instead of inventing motion", () => {
  const anchor = new Uint8Array(WIDTH * HEIGHT).fill(9);
  const current = new Uint8Array(WIDTH * HEIGHT).fill(11);
  const result = estimate(anchor, current, []);
  assert.equal(result.quality, "unreliable");
  assert.equal(result.confidence, 0);
  assert.equal(result.inlierCount, 0);
});

void test("background-reference ROI can be mapped to another camera time", () => {
  const roi = { x: 0.2, y: 0.3, width: 0.15, height: 0.2 };
  const transformed = applyLaboratoryCameraTransformToRoi(
    roi,
    { dx: 8, dy: -4, rotationDegrees: 0, scale: 1 },
    WIDTH,
    HEIGHT
  );
  assert.ok(Math.abs(transformed.x - (roi.x + 8 / WIDTH)) < 0.001);
  assert.ok(Math.abs(transformed.y - (roi.y - 4 / HEIGHT)) < 0.001);
  assert.ok(Math.abs(transformed.width - roi.width) < 0.001);
  assert.ok(Math.abs(transformed.height - roi.height) < 0.001);
});

void test("static camera plus strongly moving target never creates an 80px camera displacement regression", () => {
  const anchor = baseScene();
  const current = anchor.slice();
  paintTarget(anchor, -8, 20);
  paintTarget(current, 24, 250);
  const result = estimate(anchor, current);
  assert.ok(Math.hypot(result.transform.dx, result.transform.dy) < 8);
  assert.ok(Math.hypot(result.transform.dx, result.transform.dy) < 80);
});

void test("tracking preview cache resolver reads canonical edit cache state", () => {
  const transformPoint = {
    timeSeconds: 10,
    confidence: 0.8,
    featureCount: 32,
    inlierCount: 24,
    inlierRatio: 0.7,
    forwardBackwardRatio: 0.9,
    residualErrorPx: 2,
    quality: "high",
    residual: { dx: 0.1, dy: -0.1, rotationDegrees: 0.01, scale: 1 },
    transform: { dx: 3, dy: -2, rotationDegrees: 0.2, scale: 1.01 },
  };
  const cache = resolveLaboratoryTrackingPreviewCache({
    cameraTrackingCaches: [
      {
        algorithm: "feature-similarity-ransac",
        anchorSeconds: 10,
        cacheId: "canonical-cache",
        createdAt: "2026-08-30T00:00:00.000Z",
        exclusionRois: [],
        fallbackUsed: false,
        mode: "global-feature-similarity",
        preferredReferenceRoi: null,
        quality: "high",
        sourceHeight: 1080,
        sourcePath: "/tmp/source.mp4",
        sourceWidth: 1920,
        transformModel: "similarity-dx-dy-rotation-scale",
        transforms: [transformPoint],
        version: 2,
      },
    ],
  });
  assert.notEqual(cache, null);
  assert.equal(cache?.cacheId, "canonical-cache");
  assert.equal(cache?.sourceWidth, 1920);
  assert.equal(cache?.sourceHeight, 1080);
  assert.equal(cache?.transforms.length, 1);
  assert.equal(isLaboratoryTrackingPreviewCacheUsable(cache), true);
});

void test("low non-anchor transforms remain preview diagnostics but never drive measurement coordinates", () => {
  const point = (timeSeconds: number, quality: "high" | "low", confidence: number) => ({
    timeSeconds,
    confidence,
    featureCount: 24,
    inlierCount: 12,
    inlierRatio: 0.5,
    forwardBackwardRatio: 0.7,
    residualErrorPx: 3,
    quality,
    residual: { dx: 0.2, dy: -0.1, rotationDegrees: 0.02, scale: 1 },
    transform: { dx: 4, dy: -3, rotationDegrees: 0.4, scale: 1.01 },
  });
  const cache: CameraTrackingCache = {
    algorithm: "feature-similarity-ransac",
    anchorSeconds: 0,
    cacheId: "low-non-anchor-cache",
    createdAt: "2026-08-31T00:00:00.000Z",
    exclusionRois: [],
    fallbackUsed: false,
    mode: "global-feature-similarity",
    preferredReferenceRoi: null,
    quality: "medium",
    sourceHeight: 1080,
    sourcePath: "/tmp/source.mp4",
    sourceWidth: 1920,
    transformModel: "similarity-dx-dy-rotation-scale",
    transforms: [point(0, "high", 1), point(1, "low", 0.4), point(2, "low", 0.4)],
    version: 2,
  };

  assert.equal(isCameraTrackingCacheUsableForMeasurement(cache), false);
  assert.equal(getLaboratoryCameraTransformAt(cache, 1), null);
  assert.equal(isLaboratoryTrackingPreviewCacheUsable(cache), true);
});

void test("measurement cache requires the established 55 percent usable timeline coverage", () => {
  const point = (
    timeSeconds: number,
    quality: "high" | "medium" | "low",
    confidence: number
  ) => ({
    timeSeconds,
    confidence,
    featureCount: 24,
    inlierCount: 12,
    inlierRatio: 0.5,
    forwardBackwardRatio: 0.7,
    residualErrorPx: 3,
    quality,
    residual: { dx: 0.2, dy: -0.1, rotationDegrees: 0.02, scale: 1 },
    transform: { dx: 4, dy: -3, rotationDegrees: 0.4, scale: 1.01 },
  });
  const cache = (transforms: CameraTrackingCache["transforms"]): CameraTrackingCache => ({
    algorithm: "feature-similarity-ransac",
    anchorSeconds: 0,
    cacheId: "mixed-quality-cache",
    createdAt: "2026-09-01T00:00:00.000Z",
    exclusionRois: [],
    fallbackUsed: false,
    mode: "global-feature-similarity",
    preferredReferenceRoi: null,
    quality: "medium",
    sourceHeight: 1080,
    sourcePath: "/tmp/source.mp4",
    sourceWidth: 1920,
    transformModel: "similarity-dx-dy-rotation-scale",
    transforms,
    version: 2,
  });
  const anchor = point(0, "high", 1);
  const insufficient = cache([
    anchor,
    point(1, "medium", 0.6),
    point(2, "medium", 0.6),
    point(3, "low", 0.4),
    point(4, "low", 0.4),
  ]);
  const sufficient = cache([
    anchor,
    point(1, "medium", 0.6),
    point(2, "medium", 0.6),
    point(3, "medium", 0.6),
    point(4, "low", 0.4),
  ]);

  assert.equal(isCameraTrackingCacheUsableForMeasurement(insufficient), false);
  assert.equal(getLaboratoryCameraTransformAt(insufficient, 1), null);
  assert.equal(isCameraTrackingCacheUsableForMeasurement(sufficient), true);
  assert.notEqual(getLaboratoryCameraTransformAt(sufficient, 1), null);
  assert.equal(getLaboratoryCameraTransformAt(sufficient, 4), null);
});

void test("tracking is wired as the canonical shared cache/provenance layer", async () => {
  const composition = await readFile("rooms/laboratory/shared/host/action-composition.ts", "utf8");
  const handlers = await readFile(
    "rooms/laboratory/features/media-analysis/host/action-handlers.ts",
    "utf8"
  );
  const structural = await readFile(
    "rooms/laboratory/features/media-analysis/host/structural-transition.ts",
    "utf8"
  );
  const convergence = await readFile(
    "rooms/laboratory/features/media-analysis/host/background-reference-convergence.ts",
    "utf8"
  );
  const responseProbe = await readFile(
    "rooms/laboratory/features/media-analysis/host/visual-response-probe.ts",
    "utf8"
  );
  const preview = await readFile("rooms/laboratory/ui/lab-tracking-preview-binder.ts", "utf8");
  const liveResults = await readFile(
    "rooms/laboratory/ui/workspace-stress-test-live-results.ts",
    "utf8"
  );
  const workspacePreview = await readFile(
    "rooms/laboratory/ui/workspace-tracking-preview.ts",
    "utf8"
  );
  const playerModes = await readFile("rooms/laboratory/ui/workspace-preview-modes.ts", "utf8");
  const timeline = await readFile("rooms/laboratory/ui/lab-waveform-timeline-render.ts", "utf8");
  const workspaceStyles = await readFile(
    "rooms/laboratory/ui/styles/lab-workspace-selection.css",
    "utf8"
  );
  assert.match(composition, /action-handlers\.js/);
  assert.match(handlers, /getOrCreateTrackingCache/);
  assert.match(handlers, /exclusionRois: \[context\.targetRoi, controlRoi\]/);
  assert.match(handlers, /preferredReferenceRoi: context\.backgroundRoi/);
  assert.match(handlers, /photometricCoordinateMode: "fixed-roi"/);
  assert.match(handlers, /structuralCoordinateMode:[\s\S]*"camera-similarity"/);
  assert.match(handlers, /persistCompositeResult\(runtime, finalResult\)/);
  assert.doesNotMatch(handlers, /persistFallbackTrackingCache/);
  assert.doesNotMatch(handlers, /replaceStoredResult/);
  assert.doesNotMatch(responseProbe, /temporalStressTests/);
  assert.match(structural, /camera similarity transform applied/);
  assert.match(convergence, /camera-similarity|feature-similarity-ransac camera transform/);
  assert.match(preview, /data-lab-tracking-preview-surface/);
  assert.doesNotMatch(preview, /data-lab-selection-roi-overlay/);
  assert.match(timeline, /workspace-tracking-preview-toggle/);
  assert.ok(
    timeline.indexOf("workspace-tracking-preview-toggle") >
      timeline.indexOf("timeline-toggle-micro-zoom")
  );
  assert.doesNotMatch(liveResults, /data-lab-transform-preview-content/);
  assert.doesNotMatch(liveResults, /data-lab-live-transform-mode/);
  assert.doesNotMatch(liveResults, /data-lab-tracking-preview-video/);
  assert.doesNotMatch(liveResults, /resolveLaboratoryTrackingPreviewCache/);
  assert.match(playerModes, /data-lab-workspace-preview-modes/);
  assert.match(playerModes, /workspace\.comparison\.viewMode/);
  assert.match(workspacePreview, /data-lab-workspace-tracking-comparison/);
  assert.match(workspacePreview, /data-lab-preserve-media="tracking-preview"/);
  assert.match(workspacePreview, /resolveLaboratoryTrackingPreviewCache/);
  assert.match(workspaceStyles, /labx-workspace-tracking-comparison/);
  assert.match(workspaceStyles, /grid-template-rows: minmax\(0, 1fr\) auto/);
});
