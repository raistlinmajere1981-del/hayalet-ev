import { join } from "node:path";

import { normalizeLaboratoryTemporalStressTestRequest } from "../../../shared/temporal-stress-test-model.js";
import type {
  LaboratoryTemporalStressTestRequest,
  LaboratoryTemporalStressTestRoi,
} from "../../../shared/temporal-stress-test-model.js";

type LaboratoryRecord = Record<string, unknown>;
type MotionRuntimeRecord = LaboratoryRecord;
type MotionProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  id?: unknown;
  source?: unknown;
};

type MotionImpactProbeDeps = {
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  getActiveProject: (runtime: MotionRuntimeRecord) => MotionProjectRecord | null;
  getPreparedSourcePath: (project: MotionProjectRecord) => string | null;
  getProjectEditOutputDir: (runtime: MotionRuntimeRecord, project: MotionProjectRecord) => string;
  patchActiveProject: (
    runtime: MotionRuntimeRecord,
    updater: (project: MotionProjectRecord) => MotionProjectRecord
  ) => Promise<unknown>;
  readBinaryFileBytes: (filePath: string) => Promise<Uint8Array | null>;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

type MotionFrameGeometry = {
  height: number;
  width: number;
};

type MotionPair = {
  confidence: number;
  dx: number;
  dy: number;
  frameDifferenceEnergy: number;
  magnitude: number;
  timeSeconds: number;
};

type MotionSummary = {
  angleDegrees: number | null;
  confidence: number;
  dx: number;
  dy: number;
  frameDifferenceMean: number;
  frameDifferencePeak: number;
  magnitude: number;
  pairCount: number;
  peakMagnitude: number;
  peakTimeSeconds: number | null;
};

const MOTION_SAMPLE_FPS = 10;
const MOTION_MAX_DIMENSION = 96;
const MOTION_SEARCH_RADIUS = 6;
const MOTION_SAMPLE_STEP = 2;
const MOTION_HISTORY_LIMIT = 20;
const IMPACT_HALF_WINDOW_SECONDS = 0.5;

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce(function (sum, value) {
        return sum + value;
      }, 0) / values.length;
}

function formatFfmpegNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function roundEven(value: number) {
  const rounded = Math.max(8, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function buildMotionGeometry(
  sourceWidth: number,
  sourceHeight: number,
  roi: LaboratoryTemporalStressTestRoi | null
): MotionFrameGeometry {
  const normalizedWidth = roi?.width ?? 1;
  const normalizedHeight = roi?.height ?? 1;
  const cropWidth = Math.max(1, sourceWidth * normalizedWidth);
  const cropHeight = Math.max(1, sourceHeight * normalizedHeight);
  const aspect = cropWidth / cropHeight;
  if (aspect >= 1) {
    return {
      width: MOTION_MAX_DIMENSION,
      height: roundEven(MOTION_MAX_DIMENSION / aspect),
    };
  }
  return {
    width: roundEven(MOTION_MAX_DIMENSION * aspect),
    height: MOTION_MAX_DIMENSION,
  };
}

function buildRoiFilter(roi: LaboratoryTemporalStressTestRoi | null) {
  if (roi === null) {
    return null;
  }
  return [
    "crop=",
    `iw*${formatFfmpegNumber(roi.width)}`,
    `:ih*${formatFfmpegNumber(roi.height)}`,
    `:iw*${formatFfmpegNumber(roi.x)}`,
    `:ih*${formatFfmpegNumber(roi.y)}`,
  ].join("");
}

export function buildLaboratoryMotionExtractionCommand(input: {
  endSeconds: number;
  geometry: MotionFrameGeometry;
  outputPath: string;
  roi: LaboratoryTemporalStressTestRoi | null;
  sourcePath: string;
  startSeconds: number;
}) {
  const filters: string[] = [];
  const roiFilter = buildRoiFilter(input.roi);
  if (roiFilter !== null) {
    filters.push(roiFilter);
  }
  filters.push(
    `fps=${String(MOTION_SAMPLE_FPS)}`,
    `scale=${String(input.geometry.width)}:${String(input.geometry.height)}:flags=bilinear`,
    "format=gray"
  );
  return [
    "-hide_banner",
    "-nostats",
    "-ss",
    formatFfmpegNumber(input.startSeconds),
    "-t",
    formatFfmpegNumber(Math.max(0.05, input.endSeconds - input.startSeconds)),
    "-i",
    input.sourcePath,
    "-an",
    "-sn",
    "-dn",
    "-vf",
    filters.join(","),
    "-pix_fmt",
    "gray",
    "-f",
    "rawvideo",
    "-y",
    input.outputPath,
  ];
}

function splitRawFrames(bytes: Uint8Array, geometry: MotionFrameGeometry) {
  const frameSize = geometry.width * geometry.height;
  if (frameSize <= 0) {
    return [];
  }
  const frameCount = Math.floor(bytes.byteLength / frameSize);
  return Array.from({ length: frameCount }, function (_unused, index) {
    const start = index * frameSize;
    return bytes.subarray(start, start + frameSize);
  });
}

function meanAbsoluteShiftError(
  previous: Uint8Array,
  current: Uint8Array,
  geometry: MotionFrameGeometry,
  dx: number,
  dy: number
) {
  const xStart = Math.max(0, -dx);
  const xEnd = Math.min(geometry.width, geometry.width - dx);
  const yStart = Math.max(0, -dy);
  const yEnd = Math.min(geometry.height, geometry.height - dy);
  let total = 0;
  let count = 0;
  for (let y = yStart; y < yEnd; y += MOTION_SAMPLE_STEP) {
    for (let x = xStart; x < xEnd; x += MOTION_SAMPLE_STEP) {
      const previousValue = previous[y * geometry.width + x] ?? 0;
      const currentValue = current[(y + dy) * geometry.width + x + dx] ?? 0;
      total += Math.abs(previousValue - currentValue);
      count += 1;
    }
  }
  return count === 0 ? 255 : total / count;
}

function estimateTextureEnergy(frame: Uint8Array, geometry: MotionFrameGeometry) {
  let total = 0;
  let count = 0;
  for (let y = 0; y < geometry.height - 1; y += MOTION_SAMPLE_STEP) {
    for (let x = 0; x < geometry.width - 1; x += MOTION_SAMPLE_STEP) {
      const value = frame[y * geometry.width + x] ?? 0;
      const right = frame[y * geometry.width + x + 1] ?? value;
      const down = frame[(y + 1) * geometry.width + x] ?? value;
      total += Math.abs(value - right) + Math.abs(value - down);
      count += 2;
    }
  }
  return count === 0 ? 0 : total / count / 255;
}

function analyzeFramePair(
  previous: Uint8Array,
  current: Uint8Array,
  geometry: MotionFrameGeometry,
  timeSeconds: number
): MotionPair {
  const zeroError = meanAbsoluteShiftError(previous, current, geometry, 0, 0);
  let bestError = Number.POSITIVE_INFINITY;
  let secondBestError = Number.POSITIVE_INFINITY;
  let bestDx = 0;
  let bestDy = 0;

  for (let dy = -MOTION_SEARCH_RADIUS; dy <= MOTION_SEARCH_RADIUS; dy += 1) {
    for (let dx = -MOTION_SEARCH_RADIUS; dx <= MOTION_SEARCH_RADIUS; dx += 1) {
      const error = meanAbsoluteShiftError(previous, current, geometry, dx, dy);
      if (error < bestError) {
        secondBestError = bestError;
        bestError = error;
        bestDx = dx;
        bestDy = dy;
      } else if (error < secondBestError) {
        secondBestError = error;
      }
    }
  }

  const improvement = clamp01((zeroError - bestError) / Math.max(1e-6, zeroError));
  const separation = clamp01(
    (secondBestError - bestError) / Math.max(1e-6, secondBestError)
  );
  const textureFactor = clamp01(estimateTextureEnergy(previous, geometry) / 0.03);
  const confidence = clamp01((improvement * 0.7 + separation * 0.3) * textureFactor);
  return {
    confidence,
    dx: bestDx,
    dy: bestDy,
    frameDifferenceEnergy: clamp01(zeroError / 255),
    magnitude: Math.hypot(bestDx, bestDy),
    timeSeconds,
  };
}

export function analyzeLaboratoryMotionFrames(input: {
  frames: Uint8Array[];
  geometry: MotionFrameGeometry;
  startSeconds: number;
}): { pairs: MotionPair[]; summary: MotionSummary } {
  const pairs: MotionPair[] = [];
  for (let index = 0; index < input.frames.length - 1; index += 1) {
    const previous = input.frames[index];
    const current = input.frames[index + 1];
    if (previous === undefined || current === undefined) {
      continue;
    }
    pairs.push(
      analyzeFramePair(
        previous,
        current,
        input.geometry,
        input.startSeconds + (index + 1) / MOTION_SAMPLE_FPS
      )
    );
  }

  const totalConfidence = pairs.reduce(function (sum, pair) {
    return sum + pair.confidence;
  }, 0);
  const dx =
    totalConfidence <= 1e-6
      ? 0
      : pairs.reduce(function (sum, pair) {
          return sum + pair.dx * pair.confidence;
        }, 0) / totalConfidence;
  const dy =
    totalConfidence <= 1e-6
      ? 0
      : pairs.reduce(function (sum, pair) {
          return sum + pair.dy * pair.confidence;
        }, 0) / totalConfidence;
  const magnitude = Math.hypot(dx, dy);
  const peakPair = [...pairs].sort(function (left, right) {
    return right.magnitude * right.confidence - left.magnitude * left.confidence;
  })[0];
  const frameDifferences = pairs.map(function (pair) {
    return pair.frameDifferenceEnergy;
  });
  return {
    pairs,
    summary: {
      angleDegrees: magnitude < 0.05 ? null : (Math.atan2(dy, dx) * 180) / Math.PI,
      confidence: mean(
        pairs.map(function (pair) {
          return pair.confidence;
        })
      ),
      dx,
      dy,
      frameDifferenceMean: mean(frameDifferences),
      frameDifferencePeak: frameDifferences.length === 0 ? 0 : Math.max(...frameDifferences),
      magnitude,
      pairCount: pairs.length,
      peakMagnitude: peakPair?.magnitude ?? 0,
      peakTimeSeconds: peakPair?.timeSeconds ?? null,
    },
  };
}

function buildRelativeMotion(target: MotionSummary, reference: MotionSummary | null) {
  if (reference === null) {
    return null;
  }
  const dx = target.dx - reference.dx;
  const dy = target.dy - reference.dy;
  const magnitude = Math.hypot(dx, dy);
  return {
    angleDegrees: magnitude < 0.05 ? null : (Math.atan2(dy, dx) * 180) / Math.PI,
    confidence: Math.min(target.confidence, reference.confidence),
    dx,
    dy,
    magnitude,
  };
}

function normalizeDirectionDelta(before: number | null, after: number | null) {
  if (before === null || after === null) {
    return null;
  }
  let delta = after - before;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function getHistory(project: MotionProjectRecord, toRecord: MotionImpactProbeDeps["toRecord"]) {
  const edit = toRecord(project.edit);
  const history = edit["temporalStressTests"];
  return Array.isArray(history) ? history : [];
}

function getLatestReferenceLock(
  project: MotionProjectRecord,
  sourcePath: string,
  toRecord: MotionImpactProbeDeps["toRecord"]
) {
  const entry = getHistory(project, toRecord).find(function (candidate) {
    const record = toRecord(candidate);
    return record["kind"] === "motion-reference-lock" && record["sourcePath"] === sourcePath;
  });
  if (entry === undefined) {
    return null;
  }
  const roi = toRecord(toRecord(entry)["roi"]);
  const x = asFiniteNumber(roi["x"]);
  const y = asFiniteNumber(roi["y"]);
  const width = asFiniteNumber(roi["width"]);
  const height = asFiniteNumber(roi["height"]);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }
  return { x, y, width, height } satisfies LaboratoryTemporalStressTestRoi;
}

function makeTimestampToken() {
  const createdAt = new Date().toISOString();
  return {
    createdAt,
    timestampToken: createdAt.replace(/[:.]/g, "-"),
  };
}

export function createLaboratoryMotionImpactProbeRuntime(deps: MotionImpactProbeDeps) {
  const {
    callRoomTools,
    getActiveProject,
    getPreparedSourcePath,
    getProjectEditOutputDir,
    patchActiveProject,
    readBinaryFileBytes,
    roomId,
    toRecord,
  } = deps;

  function resolveProjectContext(runtime: MotionRuntimeRecord, rawRequest: unknown) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const source = toRecord(project.source);
    if (asNonEmptyString(source["kind"]) !== "video") {
      throw new Error("Motion probing currently requires a video source.");
    }
    const sourcePath = getPreparedSourcePath(project);
    if (sourcePath === null) {
      throw new Error("Prepare a source file before running motion probing.");
    }
    const metadata = toRecord(source["metadata"]);
    const durationSeconds = asFiniteNumber(metadata["durationSeconds"]);
    const sourceWidth = asFiniteNumber(metadata["width"]);
    const sourceHeight = asFiniteNumber(metadata["height"]);
    if (sourceWidth === null || sourceHeight === null || sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error("Video dimensions are unavailable for motion probing.");
    }
    const request = normalizeLaboratoryTemporalStressTestRequest(rawRequest, durationSeconds);
    if (request === null) {
      throw new Error("Select a valid video time range before running motion probing.");
    }
    return {
      durationSeconds,
      project,
      request,
      sourceHeight,
      sourcePath,
      sourceWidth,
    };
  }

  async function persistHistoryResult(
    runtime: MotionRuntimeRecord,
    result: LaboratoryRecord,
    createdAt: string
  ) {
    await patchActiveProject(runtime, function (nextProject) {
      const edit = toRecord(nextProject.edit);
      const existing = Array.isArray(edit["temporalStressTests"])
        ? (edit["temporalStressTests"] as unknown[])
        : [];
      nextProject.edit = {
        ...edit,
        temporalStressTests: [result, ...existing].slice(0, MOTION_HISTORY_LIMIT),
        lastActionAt: createdAt,
        lastError: null,
      };
      return nextProject;
    });
  }

  async function extractMotionWindow(input: {
    endSeconds: number;
    project: MotionProjectRecord;
    requestId: string;
    roi: LaboratoryTemporalStressTestRoi | null;
    runtime: MotionRuntimeRecord;
    sourceHeight: number;
    sourcePath: string;
    sourceWidth: number;
    startSeconds: number;
    token: string;
  }) {
    const geometry = buildMotionGeometry(input.sourceWidth, input.sourceHeight, input.roi);
    const outputPath = join(
      getProjectEditOutputDir(input.runtime, input.project),
      `motion-probe-${input.token}.gray`
    );
    const args = buildLaboratoryMotionExtractionCommand({
      endSeconds: input.endSeconds,
      geometry,
      outputPath,
      roi: input.roi,
      sourcePath: input.sourcePath,
      startSeconds: input.startSeconds,
    });
    const result = toRecord(
      await callRoomTools({
        args,
        cwd: getProjectEditOutputDir(input.runtime, input.project),
        operation: "tool-run",
        requestId: input.requestId,
        roomId,
        timeoutMs: 60_000,
        toolId: "ffmpeg",
      })
    );
    const run = toRecord(result["run"]);
    const exitCode = asFiniteNumber(run["exitCode"]) ?? 0;
    if (run["cancelled"] === true || exitCode !== 0) {
      throw new Error(asNonEmptyString(run["stderr"]) || "Motion FFmpeg extraction failed.");
    }
    const bytes = await readBinaryFileBytes(outputPath);
    if (bytes === null) {
      throw new Error("Motion frame extraction could not be read.");
    }
    const frames = splitRawFrames(bytes, geometry);
    return {
      geometry,
      ...analyzeLaboratoryMotionFrames({
        frames,
        geometry,
        startSeconds: input.startSeconds,
      }),
    };
  }

  async function lockReferenceRegion(
    runtime: MotionRuntimeRecord,
    requestId: string,
    rawRequest: unknown
  ) {
    const context = resolveProjectContext(runtime, rawRequest);
    if (context.request.roi === null) {
      throw new Error("Select an ROI before locking a motion reference region.");
    }
    const { createdAt, timestampToken } = makeTimestampToken();
    const result = {
      schemaVersion: 1,
      kind: "motion-reference-lock",
      id: `motion-reference-${timestampToken}`,
      createdAt,
      requestId,
      sourceKind: "video",
      sourcePath: context.sourcePath,
      roi: context.request.roi,
    };
    await persistHistoryResult(runtime, result, createdAt);
    return result;
  }

  async function runMotionProbe(
    runtime: MotionRuntimeRecord,
    requestId: string,
    rawRequest: unknown
  ) {
    const context = resolveProjectContext(runtime, rawRequest);
    const referenceRoi = getLatestReferenceLock(context.project, context.sourcePath, toRecord);
    const target = await extractMotionWindow({
      endSeconds: context.request.endSeconds,
      project: context.project,
      requestId,
      roi: context.request.roi,
      runtime,
      sourceHeight: context.sourceHeight,
      sourcePath: context.sourcePath,
      sourceWidth: context.sourceWidth,
      startSeconds: context.request.startSeconds,
      token: "target",
    });
    const reference =
      referenceRoi === null
        ? null
        : await extractMotionWindow({
            endSeconds: context.request.endSeconds,
            project: context.project,
            requestId,
            roi: referenceRoi,
            runtime,
            sourceHeight: context.sourceHeight,
            sourcePath: context.sourcePath,
            sourceWidth: context.sourceWidth,
            startSeconds: context.request.startSeconds,
            token: "reference",
          });
    const { createdAt, timestampToken } = makeTimestampToken();
    const result = {
      schemaVersion: 1,
      kind: "motion-vector-probe",
      id: `motion-vector-${timestampToken}`,
      createdAt,
      sourceKind: "video",
      sourcePath: context.sourcePath,
      request: context.request,
      referenceRoi,
      target: { geometry: target.geometry, summary: target.summary },
      reference:
        reference === null ? null : { geometry: reference.geometry, summary: reference.summary },
      relative: buildRelativeMotion(target.summary, reference?.summary ?? null),
      method: {
        frameFps: MOTION_SAMPLE_FPS,
        maxDimension: MOTION_MAX_DIMENSION,
        searchRadiusPixels: MOTION_SEARCH_RADIUS,
        sampleStepPixels: MOTION_SAMPLE_STEP,
        model: "grayscale-translation-block-match",
      },
    };
    await persistHistoryResult(runtime, result, createdAt);
    return result;
  }

  async function runImpactWindowCompare(
    runtime: MotionRuntimeRecord,
    requestId: string,
    rawRequest: unknown
  ) {
    const context = resolveProjectContext(runtime, rawRequest);
    const referenceRoi = getLatestReferenceLock(context.project, context.sourcePath, toRecord);
    const impactTimeSeconds = (context.request.startSeconds + context.request.endSeconds) / 2;
    const beforeStart = Math.max(0, impactTimeSeconds - IMPACT_HALF_WINDOW_SECONDS);
    const beforeEnd = impactTimeSeconds;
    const afterStart = impactTimeSeconds;
    const afterEnd = Math.min(
      context.durationSeconds ?? impactTimeSeconds + IMPACT_HALF_WINDOW_SECONDS,
      impactTimeSeconds + IMPACT_HALF_WINDOW_SECONDS
    );

    async function analyzeWindow(
      label: "before" | "after",
      startSeconds: number,
      endSeconds: number
    ) {
      const target = await extractMotionWindow({
        endSeconds,
        project: context.project,
        requestId,
        roi: context.request.roi,
        runtime,
        sourceHeight: context.sourceHeight,
        sourcePath: context.sourcePath,
        sourceWidth: context.sourceWidth,
        startSeconds,
        token: `${label}-target`,
      });
      const reference =
        referenceRoi === null
          ? null
          : await extractMotionWindow({
              endSeconds,
              project: context.project,
              requestId,
              roi: referenceRoi,
              runtime,
              sourceHeight: context.sourceHeight,
              sourcePath: context.sourcePath,
              sourceWidth: context.sourceWidth,
              startSeconds,
              token: `${label}-reference`,
            });
      return {
        startSeconds,
        endSeconds,
        target: target.summary,
        reference: reference?.summary ?? null,
        relative: buildRelativeMotion(target.summary, reference?.summary ?? null),
      };
    }

    const before = await analyzeWindow("before", beforeStart, beforeEnd);
    const after = await analyzeWindow("after", afterStart, afterEnd);
    const targetPeakCandidates = [before.target, after.target].filter(
      (entry): entry is MotionSummary => entry.peakTimeSeconds !== null
    );
    const referencePeakCandidates = [before.reference, after.reference].filter(
      (entry): entry is MotionSummary => entry !== null && entry.peakTimeSeconds !== null
    );
    const targetPeak = [...targetPeakCandidates].sort(
      (left, right) => right.peakMagnitude - left.peakMagnitude
    )[0];
    const referencePeak = [...referencePeakCandidates].sort(
      (left, right) => right.peakMagnitude - left.peakMagnitude
    )[0];
    const beforeRelative = before.relative;
    const afterRelative = after.relative;
    const { createdAt, timestampToken } = makeTimestampToken();
    const result = {
      schemaVersion: 1,
      kind: "impact-window-compare",
      id: `impact-window-${timestampToken}`,
      createdAt,
      sourceKind: "video",
      sourcePath: context.sourcePath,
      request: context.request,
      referenceRoi,
      impactTimeSeconds,
      windowHalfSeconds: IMPACT_HALF_WINDOW_SECONDS,
      before,
      after,
      compare: {
        targetMagnitudeDelta: after.target.magnitude - before.target.magnitude,
        referenceMagnitudeDelta:
          after.reference === null || before.reference === null
            ? null
            : after.reference.magnitude - before.reference.magnitude,
        relativeMagnitudeDelta:
          afterRelative === null || beforeRelative === null
            ? null
            : afterRelative.magnitude - beforeRelative.magnitude,
        relativeDirectionDeltaDegrees:
          beforeRelative === null || afterRelative === null
            ? null
            : normalizeDirectionDelta(beforeRelative.angleDegrees, afterRelative.angleDegrees),
        targetFrameDifferenceDelta:
          after.target.frameDifferenceMean - before.target.frameDifferenceMean,
        referenceFrameDifferenceDelta:
          after.reference === null || before.reference === null
            ? null
            : after.reference.frameDifferenceMean - before.reference.frameDifferenceMean,
        targetPeakTimeSeconds: targetPeak?.peakTimeSeconds ?? null,
        referencePeakTimeSeconds: referencePeak?.peakTimeSeconds ?? null,
        referenceLagMs:
          targetPeak?.peakTimeSeconds === null ||
          targetPeak?.peakTimeSeconds === undefined ||
          referencePeak?.peakTimeSeconds === null ||
          referencePeak?.peakTimeSeconds === undefined
            ? null
            : (referencePeak.peakTimeSeconds - targetPeak.peakTimeSeconds) * 1000,
      },
      method: {
        frameFps: MOTION_SAMPLE_FPS,
        maxDimension: MOTION_MAX_DIMENSION,
        searchRadiusPixels: MOTION_SEARCH_RADIUS,
        sampleStepPixels: MOTION_SAMPLE_STEP,
        model: "grayscale-translation-block-match",
      },
    };
    await persistHistoryResult(runtime, result, createdAt);
    return result;
  }

  return {
    lockReferenceRegion,
    runImpactWindowCompare,
    runMotionProbe,
  };
}
