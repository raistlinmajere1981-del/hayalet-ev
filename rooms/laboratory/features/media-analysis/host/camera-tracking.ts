import {
  isCameraTrackingCache,
  isCameraTrackingCacheUsableForMeasurement,
  isCameraTransformPointUsableForDiagnostics,
  isCameraTransformPointUsableForMeasurement,
} from "../../../domain/lab-analysis-results.js";
import type {
  CameraSimilarityTransform,
  CameraTrackingCache,
  CameraTrackingMode,
  CameraTransformPoint,
  NormalizedRoi,
  TrackingQuality,
} from "../../../domain/lab-analysis-results.js";

export type {
  CameraSimilarityTransform,
  CameraTrackingCache,
  CameraTrackingMode,
  CameraTransformPoint,
  TrackingQuality,
} from "../../../domain/lab-analysis-results.js";

type RecordValue = Record<string, unknown>;
type RuntimeRecord = RecordValue;
type ProjectRecord = RecordValue;

type CameraTrackingDeps = {
  callRoomTools: (payload: RecordValue) => Promise<unknown>;
  getProjectEditOutputDir: (runtime: RuntimeRecord, project: ProjectRecord) => string;
  patchActiveProject: (
    runtime: RuntimeRecord,
    patcher: (project: ProjectRecord) => ProjectRecord
  ) => Promise<unknown>;
  readBinaryFileBytes: (filePath: string) => Promise<Uint8Array | null>;
  roomId: string;
  toRecord: (value: unknown) => RecordValue;
};

type LaboratoryNormalizedRoi = NormalizedRoi;
type LaboratoryTrackingQuality = TrackingQuality;
type LaboratoryCameraTrackingMode = CameraTrackingMode;
type LaboratorySimilarityTransform = CameraSimilarityTransform;
type LaboratoryCameraTransformPoint = CameraTransformPoint;
type LaboratoryCameraTransformCache = CameraTrackingCache;

type LaboratoryCameraTrackingRequest = {
  anchorSeconds: number;
  durationSeconds: number | null;
  exclusionRois?: Array<LaboratoryNormalizedRoi | null>;
  preferredReferenceRoi?: LaboratoryNormalizedRoi | null;
  project: ProjectRecord;
  requestId: string;
  runtime: RuntimeRecord;
  sampleTimes: number[];
  sourceHeight: number;
  sourcePath: string;
  sourceWidth: number;
};

type TrackingGeometry = {
  height: number;
  scaleX: number;
  scaleY: number;
  width: number;
};

type FeaturePoint = { score: number; x: number; y: number };
type MatchPoint = {
  backwardError: number;
  error: number;
  from: FeaturePoint;
  quality: number;
  to: { x: number; y: number };
};

type TrackTransform = {
  cosScale: number;
  rotationDegrees: number;
  scale: number;
  sinScale: number;
  tx: number;
  ty: number;
};

const TRACKING_MAX_DIMENSION = 224;
const FEATURE_LIMIT = 72;
const FEATURE_MIN_DISTANCE = 7;
const FEATURE_BORDER = 7;
const PATCH_RADIUS = 3;
const SEARCH_RADIUS = 15;
const RANSAC_FEATURE_LIMIT = 30;
const INLIER_THRESHOLD = 2.35;
const MIN_INLIERS = 4;
const CACHE_LIMIT = 8;
const TIME_EPSILON = 0.035;
const EPSILON = 1e-8;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function safeToken(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 64) || "tracking";
}

function joinPath(directoryPath: string, fileName: string) {
  return `${directoryPath.replace(/[\\/]+$/, "")}/${fileName}`;
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce(function (sum, value) {
        return sum + value;
      }, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort(function (left, right) {
    return left - right;
  });
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? 0);
}

function qualityFromConfidence(confidence: number): LaboratoryTrackingQuality {
  if (confidence >= 0.76) return "high";
  if (confidence >= 0.56) return "medium";
  if (confidence >= 0.38) return "low";
  return "unreliable";
}

function trackingGeometry(sourceWidth: number, sourceHeight: number): TrackingGeometry {
  const aspect = sourceWidth / Math.max(1, sourceHeight);
  if (aspect >= 1) {
    const width = TRACKING_MAX_DIMENSION;
    const height = Math.max(48, Math.round(width / aspect));
    return {
      width,
      height,
      scaleX: sourceWidth / width,
      scaleY: sourceHeight / height,
    };
  }
  const height = TRACKING_MAX_DIMENSION;
  const width = Math.max(48, Math.round(height * aspect));
  return {
    width,
    height,
    scaleX: sourceWidth / width,
    scaleY: sourceHeight / height,
  };
}

function pointInRoi(
  x: number,
  y: number,
  geometry: TrackingGeometry,
  roi: LaboratoryNormalizedRoi
) {
  const nx = x / geometry.width;
  const ny = y / geometry.height;
  return nx >= roi.x && nx <= roi.x + roi.width && ny >= roi.y && ny <= roi.y + roi.height;
}

function expandedRoi(roi: LaboratoryNormalizedRoi, padding = 0.08): LaboratoryNormalizedRoi {
  const x = Math.max(0, roi.x - padding);
  const y = Math.max(0, roi.y - padding);
  const right = Math.min(1, roi.x + roi.width + padding);
  const bottom = Math.min(1, roi.y + roi.height + padding);
  return { x, y, width: right - x, height: bottom - y };
}

function featureScore(frame: Uint8Array, geometry: TrackingGeometry, x: number, y: number) {
  const index = y * geometry.width + x;
  const left = frame[index - 1] ?? frame[index] ?? 0;
  const right = frame[index + 1] ?? frame[index] ?? 0;
  const up = frame[index - geometry.width] ?? frame[index] ?? 0;
  const down = frame[index + geometry.width] ?? frame[index] ?? 0;
  const diagA = frame[index - geometry.width - 1] ?? frame[index] ?? 0;
  const diagB = frame[index + geometry.width + 1] ?? frame[index] ?? 0;
  const gx = Math.abs(right - left);
  const gy = Math.abs(down - up);
  const gd = Math.abs(diagB - diagA);
  return Math.min(gx, gy) * 0.6 + Math.min(Math.max(gx, gy), gd) * 0.4;
}

function detectFeatures(
  frame: Uint8Array,
  geometry: TrackingGeometry,
  exclusions: LaboratoryNormalizedRoi[],
  includeRoi: LaboratoryNormalizedRoi | null
) {
  const candidates: FeaturePoint[] = [];
  for (let y = FEATURE_BORDER; y < geometry.height - FEATURE_BORDER; y += 2) {
    for (let x = FEATURE_BORDER; x < geometry.width - FEATURE_BORDER; x += 2) {
      if (includeRoi !== null && !pointInRoi(x, y, geometry, includeRoi)) continue;
      if (
        exclusions.some(function (roi) {
          return pointInRoi(x, y, geometry, roi);
        })
      ) {
        continue;
      }
      const score = featureScore(frame, geometry, x, y);
      if (score >= 7) candidates.push({ x, y, score });
    }
  }
  candidates.sort(function (left, right) {
    return right.score - left.score;
  });
  const selected: FeaturePoint[] = [];
  for (const candidate of candidates) {
    if (
      selected.some(function (point) {
        return Math.hypot(point.x - candidate.x, point.y - candidate.y) < FEATURE_MIN_DISTANCE;
      })
    ) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= FEATURE_LIMIT) break;
  }
  return selected;
}

function patchError(
  from: Uint8Array,
  to: Uint8Array,
  geometry: TrackingGeometry,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  let fromMean = 0;
  let toMean = 0;
  let count = 0;
  for (let py = -PATCH_RADIUS; py <= PATCH_RADIUS; py += 1) {
    for (let px = -PATCH_RADIUS; px <= PATCH_RADIUS; px += 1) {
      fromMean += from[(y1 + py) * geometry.width + x1 + px] ?? 0;
      toMean += to[(y2 + py) * geometry.width + x2 + px] ?? 0;
      count += 1;
    }
  }
  fromMean /= Math.max(1, count);
  toMean /= Math.max(1, count);
  let total = 0;
  for (let py = -PATCH_RADIUS; py <= PATCH_RADIUS; py += 1) {
    for (let px = -PATCH_RADIUS; px <= PATCH_RADIUS; px += 1) {
      const left = (from[(y1 + py) * geometry.width + x1 + px] ?? 0) - fromMean;
      const right = (to[(y2 + py) * geometry.width + x2 + px] ?? 0) - toMean;
      total += Math.abs(left - right);
    }
  }
  return total / Math.max(1, count);
}

function bestPatchMatch(
  from: Uint8Array,
  to: Uint8Array,
  geometry: TrackingGeometry,
  point: { x: number; y: number },
  center: { x: number; y: number } = point
) {
  let bestError = Number.POSITIVE_INFINITY;
  let secondError = Number.POSITIVE_INFINITY;
  let bestX = point.x;
  let bestY = point.y;
  const minX = Math.max(FEATURE_BORDER, Math.round(center.x) - SEARCH_RADIUS);
  const maxX = Math.min(geometry.width - FEATURE_BORDER - 1, Math.round(center.x) + SEARCH_RADIUS);
  const minY = Math.max(FEATURE_BORDER, Math.round(center.y) - SEARCH_RADIUS);
  const maxY = Math.min(geometry.height - FEATURE_BORDER - 1, Math.round(center.y) + SEARCH_RADIUS);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const error = patchError(from, to, geometry, point.x, point.y, x, y);
      if (error < bestError) {
        secondError = bestError;
        bestError = error;
        bestX = x;
        bestY = y;
      } else if (error < secondError) {
        secondError = error;
      }
    }
  }
  const separation = clamp01((secondError - bestError) / Math.max(1, secondError));
  return { x: bestX, y: bestY, error: bestError, separation };
}

function matchFeatures(
  anchor: Uint8Array,
  current: Uint8Array,
  geometry: TrackingGeometry,
  features: FeaturePoint[]
) {
  const matches: MatchPoint[] = [];
  features.forEach(function (feature) {
    const forward = bestPatchMatch(anchor, current, geometry, feature);
    const backward = bestPatchMatch(
      current,
      anchor,
      geometry,
      { x: forward.x, y: forward.y },
      feature
    );
    const backwardError = Math.hypot(backward.x - feature.x, backward.y - feature.y);
    const errorFactor = clamp01(1 - forward.error / 32);
    const fbFactor = clamp01(1 - backwardError / 3.5);
    const quality = clamp01(errorFactor * 0.45 + forward.separation * 0.25 + fbFactor * 0.3);
    if (quality >= 0.18 && backwardError <= 4) {
      matches.push({
        from: feature,
        to: { x: forward.x, y: forward.y },
        error: forward.error,
        backwardError,
        quality,
      });
    }
  });
  return matches.sort(function (left, right) {
    return right.quality - left.quality;
  });
}

function transformPoint(transform: TrackTransform, point: { x: number; y: number }) {
  return {
    x: transform.cosScale * point.x - transform.sinScale * point.y + transform.tx,
    y: transform.sinScale * point.x + transform.cosScale * point.y + transform.ty,
  };
}

function similarityFromTwo(left: MatchPoint, right: MatchPoint): TrackTransform | null {
  const px = right.from.x - left.from.x;
  const py = right.from.y - left.from.y;
  const qx = right.to.x - left.to.x;
  const qy = right.to.y - left.to.y;
  const pLength = Math.hypot(px, py);
  const qLength = Math.hypot(qx, qy);
  if (pLength < 4 || qLength < 2) return null;
  const scale = qLength / pLength;
  if (scale < 0.82 || scale > 1.22) return null;
  const rotation = Math.atan2(qy, qx) - Math.atan2(py, px);
  if (Math.abs(rotation) > (16 * Math.PI) / 180) return null;
  const cosScale = Math.cos(rotation) * scale;
  const sinScale = Math.sin(rotation) * scale;
  return {
    cosScale,
    sinScale,
    scale,
    rotationDegrees: (rotation * 180) / Math.PI,
    tx: left.to.x - (cosScale * left.from.x - sinScale * left.from.y),
    ty: left.to.y - (sinScale * left.from.x + cosScale * left.from.y),
  };
}

function refineSimilarity(matches: MatchPoint[]): TrackTransform | null {
  if (matches.length < 2) return null;
  const pMeanX = mean(matches.map((match) => match.from.x));
  const pMeanY = mean(matches.map((match) => match.from.y));
  const qMeanX = mean(matches.map((match) => match.to.x));
  const qMeanY = mean(matches.map((match) => match.to.y));
  let a = 0;
  let b = 0;
  let denom = 0;
  matches.forEach(function (match) {
    const px = match.from.x - pMeanX;
    const py = match.from.y - pMeanY;
    const qx = match.to.x - qMeanX;
    const qy = match.to.y - qMeanY;
    a += px * qx + py * qy;
    b += px * qy - py * qx;
    denom += px * px + py * py;
  });
  if (denom <= EPSILON) return null;
  const cosScale = a / denom;
  const sinScale = b / denom;
  const scale = Math.hypot(cosScale, sinScale);
  const rotationDegrees = (Math.atan2(sinScale, cosScale) * 180) / Math.PI;
  if (scale < 0.82 || scale > 1.22 || Math.abs(rotationDegrees) > 16) return null;
  return {
    cosScale,
    sinScale,
    scale,
    rotationDegrees,
    tx: qMeanX - (cosScale * pMeanX - sinScale * pMeanY),
    ty: qMeanY - (sinScale * pMeanX + cosScale * pMeanY),
  };
}

function transformResidual(transform: TrackTransform, match: MatchPoint) {
  const predicted = transformPoint(transform, match.from);
  return Math.hypot(predicted.x - match.to.x, predicted.y - match.to.y);
}

function estimateSimilarity(matches: MatchPoint[]) {
  if (matches.length < MIN_INLIERS) return null;
  const candidates = matches.slice(0, RANSAC_FEATURE_LIMIT);
  let bestInliers: MatchPoint[] = [];
  let bestResidual = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < candidates.length - 1; leftIndex += 1) {
    const left = candidates[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const right = candidates[rightIndex];
      if (right === undefined) continue;
      const hypothesis = similarityFromTwo(left, right);
      if (hypothesis === null) continue;
      const inliers = matches.filter(function (match) {
        return transformResidual(hypothesis, match) <= INLIER_THRESHOLD;
      });
      if (inliers.length < MIN_INLIERS) continue;
      const residual = mean(
        inliers.map(function (match) {
          return transformResidual(hypothesis, match);
        })
      );
      if (
        inliers.length > bestInliers.length ||
        (inliers.length === bestInliers.length && residual < bestResidual)
      ) {
        bestInliers = inliers;
        bestResidual = residual;
      }
    }
  }
  if (bestInliers.length < MIN_INLIERS) return null;
  const refined = refineSimilarity(bestInliers);
  if (refined === null) return null;
  const finalInliers = matches.filter(function (match) {
    return transformResidual(refined, match) <= INLIER_THRESHOLD;
  });
  if (finalInliers.length < MIN_INLIERS) return null;
  const finalTransform = refineSimilarity(finalInliers) ?? refined;
  const residuals = finalInliers.map(function (match) {
    return transformResidual(finalTransform, match);
  });
  const transformedMatches = finalInliers.map(function (match) {
    const from = transformPoint(finalTransform, match.from);
    return {
      ...match,
      from: { ...match.from, x: from.x, y: from.y },
    };
  });
  const residualTransform = refineSimilarity(transformedMatches);
  return {
    transform: finalTransform,
    residualTransform,
    inliers: finalInliers,
    residualError: median(residuals),
  };
}

function sourceTransform(
  transform: TrackTransform,
  geometry: TrackingGeometry
): LaboratorySimilarityTransform {
  return {
    dx: transform.tx * geometry.scaleX,
    dy: transform.ty * geometry.scaleY,
    rotationDegrees: transform.rotationDegrees,
    scale: transform.scale,
  };
}

function residualSourceTransform(
  transform: TrackTransform | null,
  geometry: TrackingGeometry
): LaboratorySimilarityTransform {
  if (transform === null) return { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 };
  return sourceTransform(transform, geometry);
}

function identityPoint(timeSeconds: number): LaboratoryCameraTransformPoint {
  return {
    confidence: 1,
    featureCount: 0,
    forwardBackwardRatio: 1,
    inlierCount: 0,
    inlierRatio: 1,
    quality: "high",
    residual: { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 },
    residualErrorPx: 0,
    timeSeconds,
    transform: { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 },
  };
}

export function estimateLaboratoryCameraTransform(input: {
  anchorFrame: Uint8Array;
  currentFrame: Uint8Array;
  exclusionRois?: LaboratoryNormalizedRoi[];
  geometry: TrackingGeometry;
  includeRoi?: LaboratoryNormalizedRoi | null;
  timeSeconds: number;
}): LaboratoryCameraTransformPoint {
  const features = detectFeatures(
    input.anchorFrame,
    input.geometry,
    input.exclusionRois ?? [],
    input.includeRoi ?? null
  );
  const matches = matchFeatures(input.anchorFrame, input.currentFrame, input.geometry, features);
  const estimate = estimateSimilarity(matches);
  if (estimate === null) {
    return {
      confidence: 0,
      featureCount: features.length,
      forwardBackwardRatio:
        matches.length === 0
          ? 0
          : mean(
              matches.map(function (match) {
                return clamp01(1 - match.backwardError / 3.5);
              })
            ),
      inlierCount: 0,
      inlierRatio: 0,
      quality: "unreliable",
      residual: { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 },
      residualErrorPx: 0,
      timeSeconds: input.timeSeconds,
      transform: { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 },
    };
  }
  const inlierRatio = estimate.inliers.length / Math.max(1, matches.length);
  const forwardBackwardRatio = mean(
    estimate.inliers.map(function (match) {
      return clamp01(1 - match.backwardError / 3.5);
    })
  );
  const featureFactor = clamp01(estimate.inliers.length / 12);
  const residualFactor = Math.exp(-estimate.residualError / 2.2);
  const confidence = clamp01(
    featureFactor * 0.2 + inlierRatio * 0.34 + residualFactor * 0.26 + forwardBackwardRatio * 0.2
  );
  return {
    confidence,
    featureCount: features.length,
    forwardBackwardRatio,
    inlierCount: estimate.inliers.length,
    inlierRatio,
    quality: qualityFromConfidence(confidence),
    residual: residualSourceTransform(estimate.residualTransform, input.geometry),
    residualErrorPx: estimate.residualError * mean([input.geometry.scaleX, input.geometry.scaleY]),
    timeSeconds: input.timeSeconds,
    transform: sourceTransform(estimate.transform, input.geometry),
  };
}

function normalizedRoiKey(roi: LaboratoryNormalizedRoi) {
  return [roi.x, roi.y, roi.width, roi.height]
    .map(function (value) {
      return value.toFixed(4);
    })
    .join(":");
}

function cacheIdentity(input: LaboratoryCameraTrackingRequest) {
  const exclusions = (input.exclusionRois ?? [])
    .filter((roi): roi is LaboratoryNormalizedRoi => roi !== null)
    .map(normalizedRoiKey)
    .sort()
    .join("|");
  const reference = input.preferredReferenceRoi
    ? normalizedRoiKey(input.preferredReferenceRoi)
    : "none";
  return [
    input.sourcePath,
    input.anchorSeconds.toFixed(3),
    exclusions,
    reference,
    "feature-similarity-ransac",
  ].join("::");
}

function nearestTransform(cache: LaboratoryCameraTransformCache, timeSeconds: number) {
  return cache.transforms.reduce<LaboratoryCameraTransformPoint | null>(function (best, point) {
    if (best === null) return point;
    return Math.abs(point.timeSeconds - timeSeconds) < Math.abs(best.timeSeconds - timeSeconds)
      ? point
      : best;
  }, null);
}

export function getLaboratoryCameraTransformAt(
  cache: LaboratoryCameraTransformCache | null,
  timeSeconds: number
) {
  if (cache === null || !isCameraTrackingCacheUsableForMeasurement(cache)) return null;
  const point = nearestTransform(cache, timeSeconds);
  if (point === null || Math.abs(point.timeSeconds - timeSeconds) > 0.16) return null;
  if (!isCameraTransformPointUsableForMeasurement(point)) return null;
  return point;
}

export function applyLaboratoryCameraTransformToRoi(
  roi: LaboratoryNormalizedRoi,
  transform: LaboratorySimilarityTransform,
  sourceWidth: number,
  sourceHeight: number
): LaboratoryNormalizedRoi {
  const angle = (transform.rotationDegrees * Math.PI) / 180;
  const cosScale = Math.cos(angle) * transform.scale;
  const sinScale = Math.sin(angle) * transform.scale;
  const corners = [
    { x: roi.x * sourceWidth, y: roi.y * sourceHeight },
    { x: (roi.x + roi.width) * sourceWidth, y: roi.y * sourceHeight },
    { x: roi.x * sourceWidth, y: (roi.y + roi.height) * sourceHeight },
    { x: (roi.x + roi.width) * sourceWidth, y: (roi.y + roi.height) * sourceHeight },
  ].map(function (point) {
    return {
      x: cosScale * point.x - sinScale * point.y + transform.dx,
      y: sinScale * point.x + cosScale * point.y + transform.dy,
    };
  });
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  const x = Math.max(0, Math.min(sourceWidth - 1, minX));
  const y = Math.max(0, Math.min(sourceHeight - 1, minY));
  const right = Math.max(x + 1, Math.min(sourceWidth, maxX));
  const bottom = Math.max(y + 1, Math.min(sourceHeight, maxY));
  return {
    x: x / sourceWidth,
    y: y / sourceHeight,
    width: Math.max(1 / sourceWidth, (right - x) / sourceWidth),
    height: Math.max(1 / sourceHeight, (bottom - y) / sourceHeight),
  };
}

function cacheCoversTimes(cache: LaboratoryCameraTransformCache, times: number[]) {
  return times.every(function (timeSeconds) {
    return cache.transforms.some(function (point) {
      return Math.abs(point.timeSeconds - timeSeconds) <= TIME_EPSILON;
    });
  });
}

export function createLaboratoryCameraTrackingRuntime(deps: CameraTrackingDeps) {
  const {
    callRoomTools,
    getProjectEditOutputDir,
    patchActiveProject,
    readBinaryFileBytes,
    roomId,
    toRecord,
  } = deps;

  async function runFfmpeg(
    runtime: RuntimeRecord,
    project: ProjectRecord,
    requestId: string,
    args: string[]
  ) {
    const result = toRecord(
      await callRoomTools({
        args,
        cwd: getProjectEditOutputDir(runtime, project),
        operation: "tool-run",
        requestId,
        roomId,
        timeoutMs: 60_000,
        toolId: "ffmpeg",
      })
    );
    const run = toRecord(result["run"]);
    const exitCode = finite(run["exitCode"]) ?? 0;
    if (run["cancelled"] === true || exitCode !== 0) {
      const stderr = typeof run["stderr"] === "string" ? run["stderr"] : "";
      throw new Error(stderr.trim() || "Camera tracking frame extraction failed.");
    }
  }

  async function extractFrame(
    input: LaboratoryCameraTrackingRequest,
    geometry: TrackingGeometry,
    timeSeconds: number,
    label: string
  ) {
    const outputPath = joinPath(
      getProjectEditOutputDir(input.runtime, input.project),
      `camera-tracking-${safeToken(input.requestId)}-${safeToken(label)}.gray`
    );
    await runFfmpeg(input.runtime, input.project, input.requestId, [
      "-hide_banner",
      "-nostats",
      "-ss",
      formatNumber(timeSeconds),
      "-i",
      input.sourcePath,
      "-an",
      "-sn",
      "-dn",
      "-vf",
      `scale=${String(geometry.width)}:${String(geometry.height)}:flags=area,format=gray`,
      "-frames:v",
      "1",
      "-pix_fmt",
      "gray",
      "-f",
      "rawvideo",
      "-y",
      outputPath,
    ]);
    const bytes = await readBinaryFileBytes(outputPath);
    const expected = geometry.width * geometry.height;
    if (bytes === null || bytes.byteLength < expected) {
      throw new Error("Camera tracking frame could not be read.");
    }
    return bytes.subarray(0, expected);
  }

  function readCaches(project: ProjectRecord) {
    const edit = toRecord(project["edit"]);
    const caches = edit["cameraTrackingCaches"];
    return Array.isArray(caches) ? caches.map(toRecord) : [];
  }

  function deserializeCache(record: RecordValue): LaboratoryCameraTransformCache | null {
    return isCameraTrackingCache(record) ? record : null;
  }

  async function persistCache(runtime: RuntimeRecord, cache: LaboratoryCameraTransformCache) {
    await patchActiveProject(runtime, function (project) {
      const edit = toRecord(project["edit"]);
      const existing = Array.isArray(edit["cameraTrackingCaches"])
        ? (edit["cameraTrackingCaches"] as unknown[])
        : [];
      const next = [
        cache,
        ...existing.filter(function (entry) {
          return toRecord(entry)["cacheId"] !== cache.cacheId;
        }),
      ].slice(0, CACHE_LIMIT);
      project["edit"] = {
        ...edit,
        cameraTrackingCaches: next,
        lastActionAt: cache.createdAt,
      };
      return project;
    });
  }

  async function buildCache(input: LaboratoryCameraTrackingRequest) {
    const sourceEnd = input.durationSeconds ?? Math.max(input.anchorSeconds, ...input.sampleTimes);
    const anchorSeconds = Math.max(0, Math.min(sourceEnd, input.anchorSeconds));
    const sampleTimes = [...new Set([anchorSeconds, ...input.sampleTimes])]
      .map(function (timeSeconds) {
        return Math.max(0, Math.min(sourceEnd, timeSeconds));
      })
      .sort(function (left, right) {
        return left - right;
      });
    const exclusions = (input.exclusionRois ?? []).filter(
      (roi): roi is LaboratoryNormalizedRoi => roi !== null
    );
    const geometry = trackingGeometry(input.sourceWidth, input.sourceHeight);
    const anchorFrame = await extractFrame(input, geometry, anchorSeconds, "anchor");

    async function estimateSeries(includeRoi: LaboratoryNormalizedRoi | null) {
      return sampleTimes.reduce<Promise<LaboratoryCameraTransformPoint[]>>(async function (
        pending,
        timeSeconds
      ) {
        const points = await pending;
        if (Math.abs(timeSeconds - anchorSeconds) <= 0.001) {
          points.push(identityPoint(timeSeconds));
          return points;
        }
        const frame = await extractFrame(
          input,
          geometry,
          timeSeconds,
          `t-${formatNumber(timeSeconds)}`
        );
        points.push(
          estimateLaboratoryCameraTransform({
            anchorFrame,
            currentFrame: frame,
            exclusionRois: exclusions,
            geometry,
            includeRoi,
            timeSeconds,
          })
        );
        return points;
      }, Promise.resolve([]));
    }

    let mode: LaboratoryCameraTrackingMode = "global-feature-similarity";
    let transforms = await estimateSeries(null);
    const globalUsable = transforms.filter(function (point) {
      return Math.abs(point.timeSeconds - anchorSeconds) <= 0.001 || point.quality !== "unreliable";
    }).length;
    if (
      globalUsable < Math.max(2, Math.ceil(sampleTimes.length * 0.65)) &&
      input.preferredReferenceRoi !== null &&
      input.preferredReferenceRoi !== undefined
    ) {
      mode = "reference-feature-similarity";
      transforms = await estimateSeries(expandedRoi(input.preferredReferenceRoi));
    }

    const nonAnchor = transforms.filter(function (point) {
      return Math.abs(point.timeSeconds - anchorSeconds) > 0.001;
    });
    const reliable = nonAnchor.filter(isCameraTransformPointUsableForDiagnostics);
    const averageConfidence = mean(reliable.map((point) => point.confidence));
    const coverage = reliable.length / Math.max(1, nonAnchor.length);
    const overallConfidence = clamp01(averageConfidence * 0.72 + coverage * 0.28);
    const fallbackUsed = reliable.length < Math.max(2, Math.ceil(nonAnchor.length * 0.55));
    const quality = fallbackUsed ? "unreliable" : qualityFromConfidence(overallConfidence);
    if (fallbackUsed) mode = "fixed-roi-fallback";
    const createdAt = new Date().toISOString();
    const cache: LaboratoryCameraTransformCache = {
      algorithm: "feature-similarity-ransac",
      anchorSeconds,
      cacheId: `camera-tracking-${safeToken(cacheIdentity(input))}-${createdAt.replace(/[:.]/g, "-")}`,
      createdAt,
      exclusionRois: exclusions,
      fallbackUsed,
      mode,
      preferredReferenceRoi: input.preferredReferenceRoi ?? null,
      quality,
      sourceHeight: input.sourceHeight,
      sourcePath: input.sourcePath,
      sourceWidth: input.sourceWidth,
      transformModel: "similarity-dx-dy-rotation-scale",
      transforms,
      version: 2,
    };
    await persistCache(input.runtime, cache);
    return cache;
  }

  async function getOrCreateTrackingCache(input: LaboratoryCameraTrackingRequest) {
    const identity = cacheIdentity(input);
    const requestedTimes = [input.anchorSeconds, ...input.sampleTimes];
    const existing = readCaches(input.project)
      .map(deserializeCache)
      .filter((cache): cache is LaboratoryCameraTransformCache => cache !== null)
      .find(function (cache) {
        const comparableInput: LaboratoryCameraTrackingRequest = {
          ...input,
          sourcePath: cache.sourcePath,
          anchorSeconds: cache.anchorSeconds,
          exclusionRois: cache.exclusionRois,
          preferredReferenceRoi: cache.preferredReferenceRoi,
        };
        return (
          cacheIdentity(comparableInput) === identity && cacheCoversTimes(cache, requestedTimes)
        );
      });
    return existing ?? buildCache(input);
  }

  return {
    buildCache,
    getOrCreateTrackingCache,
  };
}
