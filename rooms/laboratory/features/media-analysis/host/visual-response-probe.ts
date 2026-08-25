import {
  getLaboratoryResponseSweepValues,
  normalizeLaboratoryResponseBackgroundRoi,
  normalizeLaboratoryVisualResponseProbeRequest,
} from "../../../shared/visual-response-probe-model.js";
import type {
  LaboratoryNormalizedRoi,
  LaboratoryResponseSweepAxis,
} from "../../../shared/visual-response-probe-model.js";
import { normalizeLaboratoryTemporalStressTestRequest } from "../../../shared/temporal-stress-test-model.js";
import type { LaboratoryTemporalStressTestRequest } from "../../../shared/temporal-stress-test-model.js";

type RecordValue = Record<string, unknown>;
type RuntimeRecord = RecordValue;
type ProjectRecord = RecordValue & { edit?: unknown; source?: unknown };
type MetricMode = "source" | "edge" | "lifted";

type Deps = {
  callRoomTools: (payload: RecordValue) => Promise<unknown>;
  getActiveProject: (runtime: RuntimeRecord) => ProjectRecord | null;
  getPreparedSourcePath: (project: ProjectRecord) => string | null;
  getProjectEditOutputDir: (runtime: RuntimeRecord, project: ProjectRecord) => string;
  patchActiveProject: (
    runtime: RuntimeRecord,
    updater: (project: ProjectRecord) => ProjectRecord
  ) => Promise<unknown>;
  roomId: string;
  toRecord: (value: unknown) => RecordValue;
};

type SampleFrame = { timeSeconds: number; values: Record<string, number> };
type RegionMetrics = {
  sampleCount: number;
  meanLuma: number;
  medianLuma: number;
  lumaLow: number;
  lumaHigh: number;
  lumaMin: number;
  lumaMax: number;
  lumaSpread: number;
  chromaDistance: number;
  nearBlackFraction: number;
  persistentNearBlackFraction: number;
  recoveredDarkFraction: number;
  edgeEnergy: number;
  edgePersistence: number;
  frameDifferenceEnergy: number;
  temporalPersistence: number;
  signalNoiseLike: number;
  visibilityScore: number;
};

const NEAR_BLACK_THRESHOLD = 32;
const LUMA_RECOVERY_MULTIPLIER = 8;
const EPSILON = 1e-6;

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function fmt(value: number) {
  return Number(value.toFixed(6)).toString();
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? 0);
}

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const center = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - center) ** 2)));
}

function normalize8(value: number) {
  return clamp01(value / 255);
}

function cropFilter(roi: LaboratoryNormalizedRoi) {
  return [
    `crop=iw*${fmt(roi.width)}`,
    `ih*${fmt(roi.height)}`,
    `iw*${fmt(roi.x)}`,
    `ih*${fmt(roi.y)}`,
  ].join(":");
}

export function buildLaboratoryResponseAxisFilter(
  axis: LaboratoryResponseSweepAxis,
  value: number
) {
  if (axis === "exposure") {
    const factor = 2 ** value;
    return `lutyuv=y='clip(val*${fmt(factor)},0,255)'`;
  }
  if (axis === "gamma") return `eq=gamma=${fmt(value)}`;
  if (axis === "brightness") return `eq=brightness=${fmt(value)}`;
  if (axis === "black-level") {
    const threshold = Math.round(clamp01(value) * 255);
    return `lutyuv=y='if(lt(val,${String(threshold)}),0,val)'`;
  }
  if (axis === "contrast") return `eq=contrast=${fmt(value)}`;
  if (axis === "local-contrast") {
    if (value <= EPSILON) return null;
    return `unsharp=5:5:${fmt(value)}:5:5:0`;
  }
  if (axis === "blur") {
    if (value <= EPSILON) return null;
    return `boxblur=${fmt(value)}:1`;
  }
  if (axis === "denoise") {
    if (value <= EPSILON) return null;
    return `hqdn3d=${fmt(value)}:${fmt(value * 0.75)}:${fmt(value * 1.5)}:${fmt(value * 1.125)}`;
  }
  if (value <= EPSILON) return null;
  return `unsharp=5:5:${fmt(value)}:5:5:0`;
}

function buildMetricCommand(
  sourcePath: string,
  request: LaboratoryTemporalStressTestRequest,
  roi: LaboratoryNormalizedRoi,
  transformFilter: string | null,
  mode: MetricMode
) {
  const filters = [
    cropFilter(roi),
    "setpts=PTS-STARTPTS",
    `fps=${String(request.sampleFps)}`,
  ];
  if (transformFilter !== null) filters.push(transformFilter);
  if (mode === "edge") {
    filters.push("edgedetect=low=0.05:high=0.2", "signalstats");
    filters.push("metadata=mode=print:key=lavfi.signalstats.YAVG");
  } else if (mode === "lifted") {
    filters.push(
      `lutyuv=y=val*${String(LUMA_RECOVERY_MULTIPLIER)}`,
      `blackframe=amount=0:threshold=${String(NEAR_BLACK_THRESHOLD)}`,
      "metadata=mode=print:key=lavfi.blackframe.pblack"
    );
  } else {
    filters.push(
      "signalstats",
      `blackframe=amount=0:threshold=${String(NEAR_BLACK_THRESHOLD)}`,
      "metadata=mode=print:key=lavfi.signalstats.YAVG",
      "metadata=mode=print:key=lavfi.signalstats.YMIN",
      "metadata=mode=print:key=lavfi.signalstats.YLOW",
      "metadata=mode=print:key=lavfi.signalstats.YHIGH",
      "metadata=mode=print:key=lavfi.signalstats.YMAX",
      "metadata=mode=print:key=lavfi.signalstats.UAVG",
      "metadata=mode=print:key=lavfi.signalstats.VAVG",
      "metadata=mode=print:key=lavfi.blackframe.pblack"
    );
  }
  return [
    "-hide_banner",
    "-nostats",
    "-ss",
    fmt(request.startSeconds),
    "-t",
    fmt(request.endSeconds - request.startSeconds),
    "-i",
    sourcePath,
    "-an",
    "-sn",
    "-dn",
    "-vf",
    filters.join(","),
    "-f",
    "null",
    "-",
  ];
}

export function parseLaboratoryResponseMetricText(text: string): SampleFrame[] {
  const frames = new Map<string, SampleFrame>();
  let currentTime = 0;
  function frame(timeSeconds: number) {
    const key = timeSeconds.toFixed(6);
    const found = frames.get(key);
    if (found) return found;
    const created: SampleFrame = { timeSeconds, values: {} };
    frames.set(key, created);
    return created;
  }
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    const time = line.match(/\bpts_time[:=](-?\d+(?:\.\d+)?)/);
    if (time?.[1] !== undefined) {
      const parsed = Number(time[1]);
      currentTime = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      frame(currentTime);
      return;
    }
    const metric = line.match(
      /\blavfi\.(signalstats\.([A-Z0-9]+)|blackframe\.(pblack))=(-?\d+(?:\.\d+)?)/
    );
    const name = metric?.[2] ?? metric?.[3];
    const numeric = metric?.[4];
    if (name === undefined || numeric === undefined) return;
    const value = Number(numeric);
    if (Number.isFinite(value)) frame(currentTime).values[name] = value;
  });
  return [...frames.values()]
    .filter((entry) => Object.keys(entry.values).length > 0)
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
}

export function buildLaboratoryResponseRegionMetrics(
  sourceFrames: SampleFrame[],
  edgeFrames: SampleFrame[],
  liftedFrames: SampleFrame[] = []
): RegionMetrics {
  const luma = sourceFrames
    .map((entry) => numberValue(entry.values["YAVG"]))
    .filter((value): value is number => value !== null)
    .map(normalize8);
  const lows = sourceFrames
    .map((entry) => numberValue(entry.values["YLOW"]))
    .filter((value): value is number => value !== null)
    .map(normalize8);
  const highs = sourceFrames
    .map((entry) => numberValue(entry.values["YHIGH"]))
    .filter((value): value is number => value !== null)
    .map(normalize8);
  const mins = sourceFrames
    .map((entry) => numberValue(entry.values["YMIN"]))
    .filter((value): value is number => value !== null)
    .map(normalize8);
  const maxs = sourceFrames
    .map((entry) => numberValue(entry.values["YMAX"]))
    .filter((value): value is number => value !== null)
    .map(normalize8);
  const nearBlack = sourceFrames.map((entry) =>
    clamp01((numberValue(entry.values["pblack"]) ?? 0) / 100)
  );
  const persistentNearBlack = liftedFrames.map((entry) =>
    clamp01((numberValue(entry.values["pblack"]) ?? 0) / 100)
  );
  const chroma = sourceFrames.map((entry) => {
    const u = normalize8(numberValue(entry.values["UAVG"]) ?? 128);
    const v = normalize8(numberValue(entry.values["VAVG"]) ?? 128);
    return Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2);
  });
  const edge = edgeFrames
    .map((entry) => numberValue(entry.values["YAVG"]))
    .filter((value): value is number => value !== null)
    .map(normalize8);
  const lumaTransitions = luma
    .slice(1)
    .map((value, index) => Math.abs(value - (luma[index] ?? value)));
  const edgeTransitions = edge
    .slice(1)
    .map((value, index) => Math.abs(value - (edge[index] ?? value)));
  const lumaLow = mean(lows);
  const lumaHigh = mean(highs);
  const contrast = Math.max(0, lumaHigh - lumaLow);
  const frameDifferenceEnergy = mean(lumaTransitions);
  const temporalPersistence = clamp01(1 - frameDifferenceEnergy * 8);
  const edgeEnergy = mean(edge);
  const edgePersistence = clamp01(1 - mean(edgeTransitions) * 8);
  const noise = stddev(luma);
  const signalNoiseLike = contrast / Math.max(0.01, noise);
  const meanNearBlackFraction = mean(nearBlack);
  const persistentNearBlackFraction = mean(persistentNearBlack);
  const recoveredDarkFraction = clamp01(
    meanNearBlackFraction - persistentNearBlackFraction
  );
  const visibilityScore = clamp01(
    contrast * 2.2 +
      edgeEnergy * 1.7 +
      temporalPersistence * 0.16 +
      edgePersistence * 0.12 +
      recoveredDarkFraction * 0.2 -
      meanNearBlackFraction * 0.35
  );
  return {
    sampleCount: luma.length,
    meanLuma: mean(luma),
    medianLuma: median(luma),
    lumaLow,
    lumaHigh,
    lumaMin: mean(mins),
    lumaMax: mean(maxs),
    lumaSpread: contrast,
    chromaDistance: mean(chroma),
    nearBlackFraction: meanNearBlackFraction,
    persistentNearBlackFraction,
    recoveredDarkFraction,
    edgeEnergy,
    edgePersistence,
    frameDifferenceEnergy,
    temporalPersistence,
    signalNoiseLike,
    visibilityScore,
  };
}

function difference(target: RegionMetrics, background: RegionMetrics) {
  const keys: Array<keyof Omit<RegionMetrics, "sampleCount">> = [
    "meanLuma",
    "medianLuma",
    "lumaLow",
    "lumaHigh",
    "lumaMin",
    "lumaMax",
    "lumaSpread",
    "chromaDistance",
    "nearBlackFraction",
    "persistentNearBlackFraction",
    "recoveredDarkFraction",
    "edgeEnergy",
    "edgePersistence",
    "frameDifferenceEnergy",
    "temporalPersistence",
    "signalNoiseLike",
    "visibilityScore",
  ];
  return keys.reduce<Record<string, number>>((output, key) => {
    output[key] = target[key] - background[key];
    return output;
  }, {});
}

function responseInterpretation(
  axis: LaboratoryResponseSweepAxis,
  points: Array<{ differential: Record<string, number> }>
) {
  if (points.length < 3) {
    return {
      dataQuality: "insufficient",
      classification: "sample-insufficient",
      sensorCompatibility: "unknown",
    };
  }
  const deltas = points.map((entry) => entry.differential["visibilityScore"] ?? 0);
  const range = Math.max(...deltas) - Math.min(...deltas);
  const center = Math.abs(deltas[Math.floor(deltas.length / 2)] ?? 0);
  const localized = Math.max(...deltas.map(Math.abs));
  const sensorAxis = new Set<LaboratoryResponseSweepAxis>([
    "exposure",
    "gamma",
    "brightness",
    "black-level",
    "denoise",
  ]).has(axis);
  return {
    dataQuality: "sufficient",
    classification:
      localized < 0.08
        ? "target-and-background-change-together"
        : range < 0.12 && center < 0.12
          ? "physical-environment-like-response"
          : range >= 0.22
            ? "target-response-differs"
            : "result-uncertain",
    sensorCompatibility:
      sensorAxis && range < 0.14
        ? "low-light-sensor-compatible"
        : sensorAxis && range >= 0.22
          ? "not-explained-by-global-sensor-response-alone"
          : "not-assessed",
    differentialVisibilityRange: range,
    peakLocalizedDifference: localized,
  };
}

export function createLaboratoryVisualResponseProbeRuntime(deps: Deps) {
  const {
    callRoomTools,
    getActiveProject,
    getPreparedSourcePath,
    getProjectEditOutputDir,
    patchActiveProject,
    roomId,
    toRecord,
  } = deps;

  async function runTool(
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
        timeoutMs: 90_000,
        toolId: "ffmpeg",
      })
    );
    const run = toRecord(result["run"]);
    const exitCode = numberValue(run["exitCode"]) ?? 0;
    if (run["cancelled"] === true || exitCode !== 0) {
      throw new Error(stringValue(run["stderr"]) || "Visual response FFmpeg probe failed.");
    }
    return [stringValue(run["stdout"]), stringValue(run["stderr"])]
      .filter((entry): entry is string => entry !== null)
      .join("\n");
  }

  async function measureRegion(
    runtime: RuntimeRecord,
    project: ProjectRecord,
    requestId: string,
    sourcePath: string,
    request: LaboratoryTemporalStressTestRequest,
    roi: LaboratoryNormalizedRoi,
    transform: string | null
  ) {
    const sourceText = await runTool(
      runtime,
      project,
      requestId,
      buildMetricCommand(sourcePath, request, roi, transform, "source")
    );
    const edgeText = await runTool(
      runtime,
      project,
      requestId,
      buildMetricCommand(sourcePath, request, roi, transform, "edge")
    );
    const liftedText = await runTool(
      runtime,
      project,
      requestId,
      buildMetricCommand(sourcePath, request, roi, transform, "lifted")
    );
    return buildLaboratoryResponseRegionMetrics(
      parseLaboratoryResponseMetricText(sourceText),
      parseLaboratoryResponseMetricText(edgeText),
      parseLaboratoryResponseMetricText(liftedText)
    );
  }

  async function store(runtime: RuntimeRecord, result: RecordValue) {
    await patchActiveProject(runtime, function (project) {
      const edit = toRecord(project.edit);
      const existing = Array.isArray(edit["temporalStressTests"])
        ? (edit["temporalStressTests"] as unknown[])
        : [];
      project.edit = {
        ...edit,
        temporalStressTests: [result, ...existing].slice(0, 30),
        lastActionAt: result["createdAt"],
        lastError: null,
      };
      return project;
    });
  }

  async function lockBackgroundRoi(runtime: RuntimeRecord, rawRequest: unknown) {
    const request = normalizeLaboratoryTemporalStressTestRequest(rawRequest);
    const roi = normalizeLaboratoryResponseBackgroundRoi(request?.roi);
    if (roi === null) {
      throw new Error("Select a background ROI before locking the differential reference.");
    }
    const createdAt = new Date().toISOString();
    await patchActiveProject(runtime, function (project) {
      const edit = toRecord(project.edit);
      project.edit = {
        ...edit,
        responseBackgroundRoi: roi,
        lastActionAt: createdAt,
        lastError: null,
      };
      return project;
    });
    return {
      schemaVersion: 1,
      kind: "response-background-lock",
      createdAt,
      backgroundRoi: roi,
    };
  }

  async function runResponseProbe(
    runtime: RuntimeRecord,
    requestId: string,
    rawRequest: unknown
  ) {
    const project = getActiveProject(runtime);
    if (project === null) throw new Error("Active project is missing.");
    const source = toRecord(project.source);
    if (stringValue(source["kind"]) !== "video") {
      throw new Error("Visibility response probing currently requires a video source.");
    }
    const sourcePath = getPreparedSourcePath(project);
    if (sourcePath === null) {
      throw new Error("Prepare a source file before running a response probe.");
    }
    const duration = numberValue(toRecord(source["metadata"])["durationSeconds"]);
    const request = normalizeLaboratoryVisualResponseProbeRequest(rawRequest, duration);
    if (request === null) {
      throw new Error(
        "Select a target ROI, lock a background ROI, and choose a valid response axis."
      );
    }
    const values = getLaboratoryResponseSweepValues(request.axis);
    const points = [];
    for (const value of values) {
      const transform = buildLaboratoryResponseAxisFilter(request.axis, value);
      const target = await measureRegion(
        runtime,
        project,
        requestId,
        sourcePath,
        request.temporalRequest,
        request.temporalRequest.roi!,
        transform
      );
      const background = await measureRegion(
        runtime,
        project,
        requestId,
        sourcePath,
        request.temporalRequest,
        request.backgroundRoi,
        transform
      );
      points.push({
        value,
        target,
        background,
        differential: difference(target, background),
      });
    }
    const createdAt = new Date().toISOString();
    const result: RecordValue = {
      schemaVersion: 1,
      kind: "visibility-response",
      id: `visibility-response-${request.axis}-${createdAt.replace(/[:.]/g, "-")}`,
      createdAt,
      sourceKind: "video",
      sourcePath,
      hypothesis: "target-vs-background-response",
      request,
      points,
      interpretation: responseInterpretation(request.axis, points),
      method: {
        axisValues: values,
        nearBlackThreshold8Bit: NEAR_BLACK_THRESHOLD,
        recoveryMultiplier: LUMA_RECOVERY_MULTIPLIER,
        metrics: [
          "luma",
          "luma-distribution",
          "chroma",
          "near-black",
          "persistent-near-black",
          "recovered-dark",
          "edge-energy",
          "edge-persistence",
          "frame-difference-energy",
          "temporal-persistence",
          "signal-noise-like",
          "visibility-score",
        ],
      },
    };
    await store(runtime, result);
    return result;
  }

  async function runTransitionProbe(
    runtime: RuntimeRecord,
    requestId: string,
    rawRequest: unknown
  ) {
    const project = getActiveProject(runtime);
    if (project === null) throw new Error("Active project is missing.");
    const source = toRecord(project.source);
    if (stringValue(source["kind"]) !== "video") {
      throw new Error("Appearance/disappearance probing currently requires video.");
    }
    const sourcePath = getPreparedSourcePath(project);
    if (sourcePath === null) {
      throw new Error("Prepare a source file before running a transition probe.");
    }
    const duration = numberValue(toRecord(source["metadata"])["durationSeconds"]);
    const record = toRecord(rawRequest);
    const temporal = normalizeLaboratoryTemporalStressTestRequest(
      record["temporalRequest"],
      duration
    );
    const backgroundRoi = normalizeLaboratoryResponseBackgroundRoi(record["backgroundRoi"]);
    if (temporal === null || temporal.roi === null || backgroundRoi === null) {
      throw new Error(
        "Select a target ROI and lock a background ROI before running a transition probe."
      );
    }
    const center = (temporal.startSeconds + temporal.endSeconds) / 2;
    const sourceEnd = duration ?? Math.max(center + 1, temporal.endSeconds);
    const windows = [
      {
        phase: "pre",
        startSeconds: Math.max(0, center - 1),
        endSeconds: Math.max(0.001, center - 0.2),
      },
      {
        phase: "event",
        startSeconds: Math.max(0, center - 0.2),
        endSeconds: Math.min(sourceEnd, center + 0.2),
      },
      {
        phase: "post",
        startSeconds: Math.min(sourceEnd - 0.001, center + 0.2),
        endSeconds: Math.min(sourceEnd, center + 1),
      },
    ].filter((window) => window.endSeconds > window.startSeconds + 0.01);
    const phases = [];
    for (const window of windows) {
      const phaseRequest: LaboratoryTemporalStressTestRequest = {
        startSeconds: window.startSeconds,
        endSeconds: window.endSeconds,
        sampleFps: temporal.sampleFps,
        roi: temporal.roi,
      };
      const target = await measureRegion(
        runtime,
        project,
        requestId,
        sourcePath,
        phaseRequest,
        temporal.roi,
        null
      );
      const background = await measureRegion(
        runtime,
        project,
        requestId,
        sourcePath,
        phaseRequest,
        backgroundRoi,
        null
      );
      phases.push({
        ...window,
        target,
        background,
        differential: difference(target, background),
      });
    }
    const eventPhase = phases.find((entry) => entry.phase === "event");
    const prePhase = phases.find((entry) => entry.phase === "pre");
    const postPhase = phases.find((entry) => entry.phase === "post");
    const eventShift =
      eventPhase && prePhase
        ? (eventPhase.differential["visibilityScore"] ?? 0) -
          (prePhase.differential["visibilityScore"] ?? 0)
        : 0;
    const postShift =
      postPhase && prePhase
        ? (postPhase.differential["visibilityScore"] ?? 0) -
          (prePhase.differential["visibilityScore"] ?? 0)
        : 0;
    const eventFrameShift =
      eventPhase && prePhase
        ? (eventPhase.differential["frameDifferenceEnergy"] ?? 0) -
          (prePhase.differential["frameDifferenceEnergy"] ?? 0)
        : 0;
    const edgePersistenceShift =
      eventPhase && prePhase
        ? (eventPhase.differential["edgePersistence"] ?? 0) -
          (prePhase.differential["edgePersistence"] ?? 0)
        : 0;
    const localizedMagnitude = Math.max(Math.abs(eventShift), Math.abs(postShift));
    const createdAt = new Date().toISOString();
    const result: RecordValue = {
      schemaVersion: 1,
      kind: "appearance-transition",
      id: `appearance-transition-${createdAt.replace(/[:.]/g, "-")}`,
      createdAt,
      sourceKind: "video",
      sourcePath,
      hypothesis: "localized-appearance-disappearance-transition",
      request: {
        temporalRequest: temporal,
        backgroundRoi,
        eventSeconds: center,
      },
      phases,
      interpretation: {
        dataQuality: phases.length === 3 ? "sufficient" : "limited",
        classification:
          localizedMagnitude < 0.08
            ? "target-and-background-change-together"
            : localizedMagnitude >= 0.22
              ? "change-localized-to-target"
              : "result-uncertain",
        eventVisibilityShift: eventShift,
        postVisibilityShift: postShift,
        eventFrameDifferenceShift: eventFrameShift,
        eventEdgePersistenceShift: edgePersistenceShift,
      },
    };
    await store(runtime, result);
    return result;
  }

  return {
    lockBackgroundRoi,
    runResponseProbe,
    runTransitionProbe,
  };
}
