import type { LaboratoryNormalizedRoi } from "../../../shared/visual-response-probe-model.js";
import {
  applyLaboratoryCameraTransformToRoi,
  getLaboratoryCameraTransformAt,
} from "./camera-tracking-v2.js";
import type { LaboratoryCameraTransformCache } from "./camera-tracking-v2.js";
import { calculateLaboratoryStructuralFrameMetrics } from "./structural-transition.js";

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

export type LaboratoryStructuralTransitionV2Input = {
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
  trackingCache: LaboratoryCameraTransformCache;
};

const STRUCTURAL_FRAME_SIZE = 64;
const TIMELINE_OFFSETS = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1] as const;

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
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 72) || "structural-v2";
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

function riskFromRatio(ratio: number) {
  if (ratio < 0.03) return "negligible";
  if (ratio < 0.08) return "low";
  if (ratio < 0.2) return "moderate";
  return "high";
}

function usableTransform(cache: LaboratoryCameraTransformCache, timeSeconds: number) {
  return getLaboratoryCameraTransformAt(cache, timeSeconds);
}

function transformedRoi(
  input: LaboratoryStructuralTransitionV2Input,
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

function summarizeTracking(input: LaboratoryStructuralTransitionV2Input) {
  const cache = input.trackingCache;
  const points = cache.transforms.filter(function (point) {
    return Math.abs(point.timeSeconds - cache.anchorSeconds) > 0.001;
  });
  const usable = points.filter(function (point) {
    return point.quality !== "unreliable" && point.confidence >= 0.38;
  });
  const confidence = mean(usable.map((point) => point.confidence));
  const inlierRatio = mean(usable.map((point) => point.inlierRatio));
  const forwardBackwardRatio = mean(usable.map((point) => point.forwardBackwardRatio));
  const residualError = mean(usable.map((point) => point.residualErrorPx));
  const peakDisplacement = points.reduce(function (peak, point) {
    return Math.max(peak, Math.hypot(point.transform.dx, point.transform.dy));
  }, 0);
  const peakRotationDegrees = points.reduce(function (peak, point) {
    return Math.max(peak, Math.abs(point.transform.rotationDegrees));
  }, 0);
  const peakScaleDelta = points.reduce(function (peak, point) {
    return Math.max(peak, Math.abs(point.transform.scale - 1));
  }, 0);
  const targetMinDimension = Math.max(
    1,
    Math.min(input.targetRoi.width * input.sourceWidth, input.targetRoi.height * input.sourceHeight)
  );
  const riskRatio = peakDisplacement / targetMinDimension;
  const last = usable[usable.length - 1] ?? null;
  const residualDx = mean(usable.map((point) => point.residual.dx));
  const residualDy = mean(usable.map((point) => point.residual.dy));
  const residualRotationDegrees = mean(usable.map((point) => point.residual.rotationDegrees));
  const residualScale = usable.length === 0 ? 1 : mean(usable.map((point) => point.residual.scale));
  return {
    algorithm: cache.algorithm,
    version: cache.version,
    transformModel: cache.transformModel,
    transformCacheId: cache.cacheId,
    referenceTimeSeconds: cache.anchorSeconds,
    trackingMode: cache.mode,
    trackingQuality: cache.quality,
    trackingConfidence: confidence,
    inlierRatio,
    forwardBackwardRatio,
    featureCount: Math.round(mean(usable.map((point) => point.featureCount))),
    fallbackUsed: cache.fallbackUsed,
    fallbackReason: cache.fallbackUsed ? "feature-similarity-tracking-unreliable" : null,
    mode: cache.fallbackUsed ? "off" : "similarity",
    method: cache.algorithm,
    netDx: last?.transform.dx ?? 0,
    netDy: last?.transform.dy ?? 0,
    rotationDegrees: last?.transform.rotationDegrees ?? 0,
    scale: last?.transform.scale ?? 1,
    peakDisplacement,
    peakRotationDegrees,
    peakScaleDelta,
    risk: riskFromRatio(riskRatio),
    riskRatio,
    referenceRoi: input.referenceRoi,
    correctedResidual: {
      dx: residualDx,
      dy: residualDy,
      rotationDegrees: residualRotationDegrees,
      scale: residualScale,
      errorPx: residualError,
    },
    measurementSuitableForSmallRoi:
      !cache.fallbackUsed && (cache.quality === "high" || cache.quality === "medium"),
  };
}

export function createLaboratoryStructuralTransitionV2Runtime(deps: StructuralTransitionDeps) {
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
      throw new Error(stderr.trim() || "Structural transition v2 FFmpeg extraction failed.");
    }
  }

  async function extractFrame(
    input: LaboratoryStructuralTransitionV2Input,
    role: StructuralRole,
    timeSeconds: number,
    roi: LaboratoryNormalizedRoi
  ) {
    const outputPath = joinPath(
      getProjectEditOutputDir(input.runtime, input.project),
      `structural-v2-${safeToken(input.requestId)}-${role}-${safeToken(formatNumber(timeSeconds))}.gray`
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
      throw new Error("Structural transition v2 frame could not be read.");
    }
    return bytes.subarray(0, expected);
  }

  async function analyzeTransition(input: LaboratoryStructuralTransitionV2Input) {
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
        tracking: usableTransform(input.trackingCache, point.timeSeconds),
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
      tracking: {
        cacheId: input.trackingCache.cacheId,
        algorithm: input.trackingCache.algorithm,
        version: input.trackingCache.version,
        transformModel: input.trackingCache.transformModel,
        anchorSeconds: input.trackingCache.anchorSeconds,
        quality: input.trackingCache.quality,
        fallbackUsed: input.trackingCache.fallbackUsed,
        mode: input.trackingCache.mode,
      },
      revealedBackground: {
        status: "not-assessed",
        futureField: "post-to-reference-convergence",
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
          "camera-tracking-v2 similarity transform applied to Target/Control/Background measurement coordinates",
      },
    };
  }

  return { analyzeTransition };
}
