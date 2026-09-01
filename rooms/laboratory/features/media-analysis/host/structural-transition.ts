import type { LaboratoryNormalizedRoi } from "../../../shared/visual-response-probe-model.js";
import {
  applyLaboratoryCameraTransformToRoi,
  getLaboratoryCameraTransformAt,
} from "./camera-tracking.js";
import type {
  CameraTrackingCache,
  StructuralFrameMetrics,
  StructuralRoiStability,
  StructuralTransitionResult,
} from "../../../domain/lab-analysis-results.js";
import {
  isCameraTrackingCacheUsableForMeasurement,
  isCameraTransformPointUsableForDiagnostics,
  isCameraTransformPointUsableForMeasurement,
} from "../../../domain/lab-analysis-results.js";

type RecordValue = Record<string, unknown>;
type RuntimeRecord = RecordValue;
type ProjectRecord = RecordValue;
type StructuralRole = "target" | "control" | "background";

type StructuralTransitionDeps = {
  callRoomTools: (payload: RecordValue) => Promise<unknown>;
  getProjectEditOutputDir: (runtime: RuntimeRecord, project: ProjectRecord) => string;
  readBinaryFileBytes: (filePath: string) => Promise<Uint8Array | null>;
  roomId: string;
  toRecord: (value: unknown) => RecordValue;
};

export type LaboratoryStructuralTransitionInput = {
  backgroundRoi: LaboratoryNormalizedRoi;
  controlRoi: LaboratoryNormalizedRoi | null;
  durationSeconds: number | null;
  eventSeconds: number;
  project: ProjectRecord;
  referenceRoi: LaboratoryNormalizedRoi;
  requestId: string;
  runtime: RuntimeRecord;
  sourceHeight: number;
  sourcePath: string;
  sourceWidth: number;
  targetRoi: LaboratoryNormalizedRoi;
  trackingCache: CameraTrackingCache;
};

const STRUCTURAL_FRAME_SIZE = 64;
const TIMELINE_OFFSETS = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1] as const;
const EPSILON = 1e-8;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizedMean(frame: Uint8Array) {
  if (frame.length === 0) return 0;
  let total = 0;
  frame.forEach(function (value) {
    total += value;
  });
  return total / frame.length / 255;
}

function normalizedVariance(frame: Uint8Array, center: number) {
  if (frame.length === 0) return 0;
  let total = 0;
  frame.forEach(function (value) {
    const normalized = value / 255;
    total += (normalized - center) ** 2;
  });
  return total / frame.length;
}

function covariance(left: Uint8Array, right: Uint8Array, leftMean: number, rightMean: number) {
  const count = Math.min(left.length, right.length);
  if (count === 0) return 0;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const leftValue = (left[index] ?? 0) / 255;
    const rightValue = (right[index] ?? 0) / 255;
    total += (leftValue - leftMean) * (rightValue - rightMean);
  }
  return total / count;
}

function normalizedAbsoluteDifference(left: Uint8Array, right: Uint8Array) {
  const count = Math.min(left.length, right.length);
  if (count === 0) return 1;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total += Math.abs((left[index] ?? 0) - (right[index] ?? 0));
  }
  return clamp01(total / count / 255);
}

function edgeMap(frame: Uint8Array, width: number, height: number) {
  const output = new Float32Array(frame.length);
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const index = y * width + x;
      const value = frame[index] ?? 0;
      const right = frame[index + 1] ?? value;
      const down = frame[index + width] ?? value;
      output[index] = Math.min(1, (Math.abs(value - right) + Math.abs(value - down)) / 255);
    }
  }
  return output;
}

function floatCorrelation(left: Float32Array, right: Float32Array) {
  const count = Math.min(left.length, right.length);
  if (count === 0) return 0;
  let leftMean = 0;
  let rightMean = 0;
  for (let index = 0; index < count; index += 1) {
    leftMean += left[index] ?? 0;
    rightMean += right[index] ?? 0;
  }
  leftMean /= count;
  rightMean /= count;
  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = 0; index < count; index += 1) {
    const leftDelta = (left[index] ?? 0) - leftMean;
    const rightDelta = (right[index] ?? 0) - rightMean;
    numerator += leftDelta * rightDelta;
    leftEnergy += leftDelta * leftDelta;
    rightEnergy += rightDelta * rightDelta;
  }
  const denominator = Math.sqrt(leftEnergy * rightEnergy);
  if (denominator <= EPSILON) {
    return Math.abs(leftMean - rightMean) <= 0.01 ? 1 : 0;
  }
  return Math.max(-1, Math.min(1, numerator / denominator));
}

export function calculateLaboratoryStructuralFrameMetrics(
  baseline: Uint8Array,
  current: Uint8Array,
  width = STRUCTURAL_FRAME_SIZE,
  height = STRUCTURAL_FRAME_SIZE
): StructuralFrameMetrics {
  const count = Math.min(baseline.length, current.length);
  if (count === 0) {
    return {
      edgeSimilarity: 0,
      normalizedAbsoluteDifference: 1,
      normalizedPixelCorrelation: 0,
      pixelCorrelation: -1,
      structuralPersistence: 0,
      structuralSimilarity: 0,
    };
  }
  const baselineMean = normalizedMean(baseline);
  const currentMean = normalizedMean(current);
  const baselineVariance = normalizedVariance(baseline, baselineMean);
  const currentVariance = normalizedVariance(current, currentMean);
  const cov = covariance(baseline, current, baselineMean, currentMean);
  const denominator = Math.sqrt(baselineVariance * currentVariance);
  const pixelCorrelation =
    denominator <= EPSILON
      ? Math.abs(baselineMean - currentMean) <= 0.01
        ? 1
        : 0
      : Math.max(-1, Math.min(1, cov / denominator));
  const normalizedPixelCorrelation = clamp01((pixelCorrelation + 1) / 2);
  const absoluteDifference = normalizedAbsoluteDifference(baseline, current);
  const c1 = 0.01 ** 2;
  const c2 = 0.03 ** 2;
  const ssimNumerator = (2 * baselineMean * currentMean + c1) * (2 * cov + c2);
  const ssimDenominator =
    (baselineMean ** 2 + currentMean ** 2 + c1) * (baselineVariance + currentVariance + c2);
  const structuralSimilarity = clamp01(
    ssimDenominator <= EPSILON ? 0 : ssimNumerator / ssimDenominator
  );
  const edgeCorrelation = floatCorrelation(
    edgeMap(baseline, width, height),
    edgeMap(current, width, height)
  );
  const edgeSimilarity = clamp01((edgeCorrelation + 1) / 2);
  const pixelAgreement = 1 - absoluteDifference;
  const structuralPersistence = clamp01(
    mean([structuralSimilarity, normalizedPixelCorrelation, edgeSimilarity, pixelAgreement])
  );
  return {
    edgeSimilarity,
    normalizedAbsoluteDifference: absoluteDifference,
    normalizedPixelCorrelation,
    pixelCorrelation,
    structuralPersistence,
    structuralSimilarity,
  };
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce(function (sum, value) {
        return sum + value;
      }, 0) / values.length;
}

function formatNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function joinPath(directoryPath: string, fileName: string) {
  return `${directoryPath.replace(/[\\/]+$/, "")}/${fileName}`;
}

function safeToken(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 72) || "structural";
}

function identityMetrics() {
  const frame = new Uint8Array(STRUCTURAL_FRAME_SIZE * STRUCTURAL_FRAME_SIZE);
  return calculateLaboratoryStructuralFrameMetrics(frame, frame);
}

async function sequentialMap<T, U>(values: readonly T[], mapper: (value: T) => Promise<U>) {
  return values.reduce<Promise<U[]>>(async function (pending, value) {
    const output = await pending;
    output.push(await mapper(value));
    return output;
  }, Promise.resolve([]));
}

function riskFromRatio(ratio: number): StructuralRoiStability["risk"] {
  if (ratio < 0.03) return "negligible";
  if (ratio < 0.08) return "low";
  if (ratio < 0.2) return "moderate";
  return "high";
}

function usableTransform(cache: CameraTrackingCache, timeSeconds: number) {
  return getLaboratoryCameraTransformAt(cache, timeSeconds);
}

function transformedRoi(
  input: LaboratoryStructuralTransitionInput,
  roi: LaboratoryNormalizedRoi,
  timeSeconds: number
) {
  const point = usableTransform(input.trackingCache, timeSeconds);
  return point === null
    ? roi
    : applyLaboratoryCameraTransformToRoi(
        roi,
        point.transform,
        input.sourceWidth,
        input.sourceHeight
      );
}

function summarizeTracking(input: LaboratoryStructuralTransitionInput) {
  const cache = input.trackingCache;
  const points = cache.transforms.filter(function (point) {
    return Math.abs(point.timeSeconds - cache.anchorSeconds) > 0.001;
  });
  const usable = points.filter(isCameraTransformPointUsableForMeasurement);
  const trackingUsable = isCameraTrackingCacheUsableForMeasurement(cache) && usable.length > 0;
  const diagnostics = points.filter(isCameraTransformPointUsableForDiagnostics);
  const residualError =
    diagnostics.length === 0 ? null : mean(diagnostics.map((point) => point.residualErrorPx));
  const peakDisplacement =
    diagnostics.length === 0
      ? null
      : diagnostics.reduce(function (peak, point) {
          return Math.max(peak, Math.hypot(point.transform.dx, point.transform.dy));
        }, 0);
  const peakRotationDegrees =
    diagnostics.length === 0
      ? null
      : diagnostics.reduce(function (peak, point) {
          return Math.max(peak, Math.abs(point.transform.rotationDegrees));
        }, 0);
  const peakScaleDelta =
    diagnostics.length === 0
      ? null
      : diagnostics.reduce(function (peak, point) {
          return Math.max(peak, Math.abs(point.transform.scale - 1));
        }, 0);
  const targetMinDimension = Math.max(
    1,
    Math.min(input.targetRoi.width * input.sourceWidth, input.targetRoi.height * input.sourceHeight)
  );
  const riskRatio = peakDisplacement === null ? null : peakDisplacement / targetMinDimension;
  return {
    peakDisplacement,
    peakRotationDegrees,
    peakScaleDelta,
    risk: riskRatio === null ? "unknown" : riskFromRatio(riskRatio),
    riskRatio,
    referenceRoi: input.referenceRoi,
    residualErrorPx: residualError,
    measurementSuitableForSmallRoi: trackingUsable,
  };
}

export function createLaboratoryStructuralTransitionRuntime(deps: StructuralTransitionDeps) {
  const { callRoomTools, getProjectEditOutputDir, readBinaryFileBytes, roomId, toRecord } = deps;

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
      throw new Error(stderr.trim() || "Structural transition FFmpeg extraction failed.");
    }
  }

  async function extractFrame(
    input: LaboratoryStructuralTransitionInput,
    role: StructuralRole,
    timeSeconds: number,
    roi: LaboratoryNormalizedRoi
  ) {
    const outputPath = joinPath(
      getProjectEditOutputDir(input.runtime, input.project),
      `structural-${safeToken(input.requestId)}-${role}-${safeToken(formatNumber(timeSeconds))}.gray`
    );
    const filter = [
      `crop=iw*${formatNumber(roi.width)}:ih*${formatNumber(roi.height)}:iw*${formatNumber(roi.x)}:ih*${formatNumber(roi.y)}`,
      `scale=${String(STRUCTURAL_FRAME_SIZE)}:${String(STRUCTURAL_FRAME_SIZE)}:flags=area`,
      "format=gray",
    ].join(",");
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
      filter,
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
    const expected = STRUCTURAL_FRAME_SIZE * STRUCTURAL_FRAME_SIZE;
    if (bytes === null || bytes.byteLength < expected) {
      throw new Error("Structural transition frame could not be read.");
    }
    return bytes.subarray(0, expected);
  }

  async function analyzeTransition(
    input: LaboratoryStructuralTransitionInput
  ): Promise<StructuralTransitionResult> {
    const sourceEnd = input.durationSeconds ?? input.eventSeconds + 1;
    const timelineTimes = TIMELINE_OFFSETS.map(function (offsetSeconds) {
      return {
        offsetSeconds,
        timeSeconds: Math.max(0, Math.min(sourceEnd, input.eventSeconds + offsetSeconds)),
      };
    }).filter(function (point, index, entries) {
      return (
        index === 0 || Math.abs(point.timeSeconds - (entries[index - 1]?.timeSeconds ?? -1)) > 0.001
      );
    });
    const baselineSeconds = Math.max(0, Math.min(sourceEnd, input.eventSeconds - 0.6));
    const baselineRois = {
      target: transformedRoi(input, input.targetRoi, baselineSeconds),
      control:
        input.controlRoi === null ? null : transformedRoi(input, input.controlRoi, baselineSeconds),
      background: transformedRoi(input, input.backgroundRoi, baselineSeconds),
    };
    const baselineFrames = {
      target: await extractFrame(input, "target", baselineSeconds, baselineRois.target),
      control:
        baselineRois.control === null
          ? null
          : await extractFrame(input, "control", baselineSeconds, baselineRois.control),
      background: await extractFrame(input, "background", baselineSeconds, baselineRois.background),
    };

    async function measureRole(
      role: StructuralRole,
      anchorRoi: LaboratoryNormalizedRoi,
      baseline: Uint8Array,
      timeSeconds: number
    ) {
      const roi = transformedRoi(input, anchorRoi, timeSeconds);
      if (Math.abs(timeSeconds - baselineSeconds) <= 0.01) {
        return { metrics: identityMetrics(), roi };
      }
      const frame = await extractFrame(input, role, timeSeconds, roi);
      return {
        metrics: calculateLaboratoryStructuralFrameMetrics(baseline, frame),
        roi,
      };
    }

    const timeline = await sequentialMap(timelineTimes, async function (point) {
      const target = await measureRole(
        "target",
        input.targetRoi,
        baselineFrames.target,
        point.timeSeconds
      );
      const control =
        input.controlRoi === null || baselineFrames.control === null
          ? null
          : await measureRole(
              "control",
              input.controlRoi,
              baselineFrames.control,
              point.timeSeconds
            );
      const background = await measureRole(
        "background",
        input.backgroundRoi,
        baselineFrames.background,
        point.timeSeconds
      );
      const targetLoss = 1 - target.metrics.structuralPersistence;
      const controlLoss = control === null ? null : 1 - control.metrics.structuralPersistence;
      const backgroundLoss = 1 - background.metrics.structuralPersistence;
      return {
        ...point,
        target,
        control,
        background,
        differential: {
          targetVsControlStructuralLoss: controlLoss === null ? null : targetLoss - controlLoss,
          targetVsBackgroundStructuralLoss: targetLoss - backgroundLoss,
        },
      };
    });

    function closestOffset(offsetSeconds: number) {
      return timeline.reduce<(typeof timeline)[number] | null>(function (best, point) {
        if (best === null) return point;
        return Math.abs(point.offsetSeconds - offsetSeconds) <
          Math.abs(best.offsetSeconds - offsetSeconds)
          ? point
          : best;
      }, null);
    }

    const eventPoint = closestOffset(0);
    const postPoint = closestOffset(0.6);
    const targetLoss = Math.max(
      eventPoint === null ? 0 : 1 - eventPoint.target.metrics.structuralPersistence,
      postPoint === null ? 0 : 1 - postPoint.target.metrics.structuralPersistence
    );
    const controlLoss =
      eventPoint?.control === null ||
      eventPoint?.control === undefined ||
      postPoint?.control === null ||
      postPoint?.control === undefined
        ? null
        : Math.max(
            1 - eventPoint.control.metrics.structuralPersistence,
            1 - postPoint.control.metrics.structuralPersistence
          );
    const backgroundLoss = Math.max(
      eventPoint === null ? 0 : 1 - eventPoint.background.metrics.structuralPersistence,
      postPoint === null ? 0 : 1 - postPoint.background.metrics.structuralPersistence
    );
    const sceneLoss = controlLoss === null ? backgroundLoss : mean([controlLoss, backgroundLoss]);
    const targetSpecificStructuralLoss = targetLoss - sceneLoss;
    const roiStability = summarizeTracking(input);
    const trackingSuitable = roiStability.measurementSuitableForSmallRoi === true;
    const classification = !trackingSuitable
      ? "roi-tracking-quality-limits-structural-result"
      : controlLoss !== null && Math.abs(targetLoss - controlLoss) < 0.08
        ? "target-and-control-structurally-similar"
        : targetLoss >= 0.18 && targetSpecificStructuralLoss >= 0.12
          ? "structural-change-target-localized"
          : targetLoss >= 0.15 && sceneLoss >= 0.12 && targetSpecificStructuralLoss >= 0.06
            ? "structural-change-scene-wide-with-target-excess"
            : sceneLoss >= 0.12
              ? "structural-change-scene-wide"
              : "structural-result-uncertain";

    return {
      status: "assessed",
      baseline: {
        timeSeconds: baselineSeconds,
        model: "pre-midpoint-template",
        roiCoordinateAnchorSeconds: input.eventSeconds,
      },
      timeline,
      phaseSummary: {
        pre: closestOffset(-0.6),
        event: eventPoint,
        post: postPoint,
      },
      differential: {
        backgroundStructuralLoss: backgroundLoss,
        controlStructuralLoss: controlLoss,
        sceneStructuralLoss: sceneLoss,
        targetStructuralLoss: targetLoss,
        targetSpecificStructuralLoss,
      },
      assessment: {
        classification,
        mechanismVerdict: "not-assessed",
        trackingQualityGate: trackingSuitable ? "pass" : "limited",
      },
      roiStability,
      revealedBackground: {
        status: "not-assessed",
      },
      method: {
        baseline: "PRE midpoint grayscale template",
        frameSize: `${String(STRUCTURAL_FRAME_SIZE)}x${String(STRUCTURAL_FRAME_SIZE)}`,
        structuralSimilarity: "global-grayscale-ssim-like",
        pixelCorrelation: "pearson-grayscale",
        absoluteDifference: "normalized-mean-absolute-difference",
        edgeSimilarity: "gradient-map-correlation",
        structuralPersistence:
          "mean(ssim-like, normalized-correlation, edge-similarity, pixel-agreement)",
        timelineOffsetsSeconds: TIMELINE_OFFSETS,
        stabilization:
          "camera similarity transform applied to Target/Control/Background measurement coordinates",
      },
    };
  }

  return { analyzeTransition };
}
