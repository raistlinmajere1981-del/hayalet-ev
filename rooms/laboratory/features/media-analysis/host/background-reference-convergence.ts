import type { LaboratoryNormalizedRoi } from "../../../shared/visual-response-probe-model.js";
import { calculateLaboratoryStructuralFrameMetrics } from "./structural-transition.js";

type RecordValue = Record<string, unknown>;
type RuntimeRecord = RecordValue;
type ProjectRecord = RecordValue;

type BackgroundReferenceConvergenceDeps = {
  callRoomTools: (payload: RecordValue) => Promise<unknown>;
  getProjectEditOutputDir: (runtime: RuntimeRecord, project: ProjectRecord) => string;
  readBinaryFileBytes: (filePath: string) => Promise<Uint8Array | null>;
  roomId: string;
  toRecord: (value: unknown) => RecordValue;
};

type ReferenceConvergencePoint = {
  metrics: ReturnType<typeof calculateLaboratoryStructuralFrameMetrics>;
  offsetSeconds: number;
  timeSeconds: number;
};

export type LaboratoryReferenceConvergenceShape =
  "gradual" | "abrupt" | "mixed" | "weak-or-nonconvergent";

export type LaboratoryBackgroundReferenceConvergenceInput = {
  backgroundReferenceSeconds: number;
  durationSeconds: number | null;
  eventSeconds: number;
  project: ProjectRecord;
  requestId: string;
  runtime: RuntimeRecord;
  sourcePath: string;
  targetRoi: LaboratoryNormalizedRoi;
  targetStructuralTimeline: unknown[];
};

const FRAME_SIZE = 64;
const TIMELINE_OFFSETS = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1] as const;
const EPSILON = 1e-8;

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function joinPath(directoryPath: string, fileName: string) {
  return `${directoryPath.replace(/[\\/]+$/, "")}/${fileName}`;
}

function safeToken(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 72) || "reference";
}

async function sequentialMap<T, U>(values: readonly T[], mapper: (value: T) => Promise<U>) {
  return values.reduce<Promise<U[]>>(async function (pending, value) {
    const output = await pending;
    output.push(await mapper(value));
    return output;
  }, Promise.resolve([]));
}

function closestPoint(points: ReferenceConvergencePoint[], offsetSeconds: number) {
  return points.reduce<ReferenceConvergencePoint | null>(function (best, point) {
    if (best === null) return point;
    return Math.abs(point.offsetSeconds - offsetSeconds) <
      Math.abs(best.offsetSeconds - offsetSeconds)
      ? point
      : best;
  }, null);
}

function targetPersistenceAt(
  timeline: unknown[],
  offsetSeconds: number,
  toRecord: (value: unknown) => RecordValue
) {
  const point = timeline.reduce<RecordValue | null>(function (best, value) {
    const record = toRecord(value);
    const offset = finite(record["offsetSeconds"]);
    if (offset === null) return best;
    if (best === null) return record;
    const bestOffset = finite(best["offsetSeconds"]);
    if (bestOffset === null) return record;
    return Math.abs(offset - offsetSeconds) < Math.abs(bestOffset - offsetSeconds) ? record : best;
  }, null);
  if (point === null) return null;
  const target = toRecord(point["target"]);
  const metrics = toRecord(target["metrics"]);
  return finite(metrics["structuralPersistence"]);
}

export function classifyLaboratoryReferenceConvergenceShape(
  points: Array<{ convergence: number; offsetSeconds: number }>
): LaboratoryReferenceConvergenceShape {
  const ordered = points
    .filter(function (point) {
      return (
        Number.isFinite(point.offsetSeconds) &&
        Number.isFinite(point.convergence) &&
        point.offsetSeconds >= -0.2
      );
    })
    .sort(function (left, right) {
      return left.offsetSeconds - right.offsetSeconds;
    });
  if (ordered.length < 3) return "weak-or-nonconvergent";
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (first === undefined || last === undefined) return "weak-or-nonconvergent";
  const totalGain = last.convergence - first.convergence;
  if (totalGain < 0.1) return "weak-or-nonconvergent";
  const positiveSteps: number[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous === undefined || current === undefined) continue;
    positiveSteps.push(Math.max(0, current.convergence - previous.convergence));
  }
  const positiveSum = positiveSteps.reduce(function (sum, value) {
    return sum + value;
  }, 0);
  const maxPositiveStep = positiveSteps.reduce(function (peak, value) {
    return Math.max(peak, value);
  }, 0);
  const concentration = maxPositiveStep / Math.max(EPSILON, positiveSum);
  const activeStepCount = positiveSteps.filter(function (value) {
    return value >= 0.035;
  }).length;
  if (maxPositiveStep >= 0.15 && concentration >= 0.55) return "abrupt";
  if (activeStepCount >= 3 && concentration < 0.5) return "gradual";
  return "mixed";
}

export function createLaboratoryBackgroundReferenceConvergenceRuntime(
  deps: BackgroundReferenceConvergenceDeps
) {
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
      throw new Error(stderr.trim() || "Background reference convergence extraction failed.");
    }
  }

  async function extractTargetFrame(
    input: LaboratoryBackgroundReferenceConvergenceInput,
    timeSeconds: number,
    label: string
  ) {
    const outputPath = joinPath(
      getProjectEditOutputDir(input.runtime, input.project),
      `background-reference-${safeToken(input.requestId)}-${safeToken(label)}.gray`
    );
    const roi = input.targetRoi;
    const filter = [
      `crop=iw*${formatNumber(roi.width)}:ih*${formatNumber(roi.height)}:iw*${formatNumber(roi.x)}:ih*${formatNumber(roi.y)}`,
      `scale=${String(FRAME_SIZE)}:${String(FRAME_SIZE)}:flags=area`,
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
    const expected = FRAME_SIZE * FRAME_SIZE;
    if (bytes === null || bytes.byteLength < expected) {
      throw new Error("Background reference frame could not be read.");
    }
    return bytes.subarray(0, expected);
  }

  async function analyzeConvergence(input: LaboratoryBackgroundReferenceConvergenceInput) {
    const sourceEnd =
      input.durationSeconds ?? Math.max(input.eventSeconds + 1, input.backgroundReferenceSeconds);
    const referenceTimeSeconds = Math.max(0, Math.min(sourceEnd, input.backgroundReferenceSeconds));
    const referenceFrame = await extractTargetFrame(input, referenceTimeSeconds, "template");
    const times = TIMELINE_OFFSETS.map(function (offsetSeconds) {
      return {
        offsetSeconds,
        timeSeconds: Math.max(0, Math.min(sourceEnd, input.eventSeconds + offsetSeconds)),
      };
    }).filter(function (point, index, entries) {
      return (
        index === 0 || Math.abs(point.timeSeconds - (entries[index - 1]?.timeSeconds ?? -1)) > 0.001
      );
    });
    const timeline = await sequentialMap(times, async function (point) {
      const frame = await extractTargetFrame(
        input,
        point.timeSeconds,
        `timeline-${formatNumber(point.offsetSeconds)}`
      );
      return {
        ...point,
        metrics: calculateLaboratoryStructuralFrameMetrics(referenceFrame, frame),
      } satisfies ReferenceConvergencePoint;
    });
    const prePoint = closestPoint(timeline, -0.6);
    const eventPoint = closestPoint(timeline, 0);
    const postPoint = closestPoint(timeline, 0.6);
    const postCandidates = timeline.filter(function (point) {
      return point.offsetSeconds >= 0.2;
    });
    const peakPostPoint = postCandidates.reduce<ReferenceConvergencePoint | null>(function (
      best,
      point
    ) {
      if (best === null) return point;
      return point.metrics.structuralPersistence > best.metrics.structuralPersistence
        ? point
        : best;
    }, null);
    const preConvergence = prePoint?.metrics.structuralPersistence ?? 0;
    const eventConvergence = eventPoint?.metrics.structuralPersistence ?? preConvergence;
    const postConvergence = postPoint?.metrics.structuralPersistence ?? eventConvergence;
    const peakPostConvergence = peakPostPoint?.metrics.structuralPersistence ?? postConvergence;
    const convergenceGain = peakPostConvergence - preConvergence;
    const preEdgeConvergence = prePoint?.metrics.edgeSimilarity ?? 0;
    const peakPostEdgeConvergence = peakPostPoint?.metrics.edgeSimilarity ?? preEdgeConvergence;
    const edgeConvergenceGain = peakPostEdgeConvergence - preEdgeConvergence;
    const peakOffset = peakPostPoint?.offsetSeconds ?? 0.6;
    const targetPersistence = targetPersistenceAt(
      input.targetStructuralTimeline,
      peakOffset,
      toRecord
    );
    const targetStructuralLossAtPeak = targetPersistence === null ? null : 1 - targetPersistence;
    const classification =
      convergenceGain >= 0.15 && (targetStructuralLossAtPeak ?? 0) >= 0.15
        ? "target-loss-with-reference-convergence"
        : convergenceGain >= 0.15
          ? "reference-convergence-without-strong-target-loss"
          : (targetStructuralLossAtPeak ?? 0) >= 0.15 && convergenceGain < 0.08
            ? "target-loss-without-reference-convergence"
            : "reference-convergence-uncertain";
    const transitionShape = classifyLaboratoryReferenceConvergenceShape(
      timeline.map(function (point) {
        return {
          convergence: point.metrics.structuralPersistence,
          offsetSeconds: point.offsetSeconds,
        };
      })
    );
    return {
      status: "assessed",
      referenceTimeSeconds,
      referenceRoi: input.targetRoi,
      alignment: "fixed-target-roi",
      timeline,
      phaseSummary: {
        pre: prePoint,
        event: eventPoint,
        post: postPoint,
        peakPost: peakPostPoint,
      },
      assessment: {
        classification,
        transitionShape,
        convergenceGain,
        edgeConvergenceGain,
        preConvergence,
        eventConvergence,
        postConvergence,
        peakPostConvergence,
        peakPostOffsetSeconds: peakOffset,
        targetStructuralLossAtPeak,
        mechanismVerdict: "not-assessed",
      },
      method: {
        reference: "user-captured same-spatial target ROI template",
        alignment: "fixed normalized target ROI; reference-time motion is not modeled",
        similarity: "same deterministic grayscale structural metrics as Structural Transition",
        timelineOffsetsSeconds: TIMELINE_OFFSETS,
      },
    };
  }

  return {
    analyzeConvergence,
  };
}
