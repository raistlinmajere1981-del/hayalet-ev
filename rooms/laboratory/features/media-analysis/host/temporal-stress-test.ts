import {
  normalizeLaboratoryTemporalStressTestRequest,
} from "../../../shared/temporal-stress-test-model.js";
import type {
  LaboratoryTemporalStressTestRequest,
} from "../../../shared/temporal-stress-test-model.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryTemporalStressTestRuntimeRecord = LaboratoryRecord;
type LaboratoryTemporalStressTestProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  id?: unknown;
  source?: unknown;
};

type LaboratoryTemporalStressTestDeps = {
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  ensureProjectDirectories: (
    runtime: LaboratoryTemporalStressTestRuntimeRecord,
    project: LaboratoryTemporalStressTestProjectRecord,
    requestId?: string | null
  ) => Promise<unknown>;
  getActiveProject: (
    runtime: LaboratoryTemporalStressTestRuntimeRecord
  ) => LaboratoryTemporalStressTestProjectRecord | null;
  getPreparedSourcePath: (project: LaboratoryTemporalStressTestProjectRecord) => string | null;
  getProjectEditOutputDir: (
    runtime: LaboratoryTemporalStressTestRuntimeRecord,
    project: LaboratoryTemporalStressTestProjectRecord
  ) => string;
  patchActiveProject: (
    runtime: LaboratoryTemporalStressTestRuntimeRecord,
    updater: (
      project: LaboratoryTemporalStressTestProjectRecord
    ) => LaboratoryTemporalStressTestProjectRecord
  ) => Promise<unknown>;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

type LaboratorySignalStatsFrame = {
  timeSeconds: number;
  values: Record<string, number>;
};

type LaboratoryTemporalStressTestCommandSet = {
  signal: string[];
  frameDifference: string[];
  edge: string[];
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeEightBitMetric(value: number | null) {
  return value === null ? null : clamp01(value / 255);
}

function formatFfmpegNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function buildRoiFilter(request: LaboratoryTemporalStressTestRequest) {
  const roi = request.roi;
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

function buildMetricFilter(
  request: LaboratoryTemporalStressTestRequest,
  metric: "signal" | "frame-difference" | "edge"
) {
  const filters: string[] = [];
  const roiFilter = buildRoiFilter(request);
  if (roiFilter !== null) {
    filters.push(roiFilter);
  }
  filters.push("setpts=PTS-STARTPTS", `fps=${String(request.sampleFps)}`);
  if (metric === "frame-difference") {
    filters.push("tblend=all_mode=difference");
  } else if (metric === "edge") {
    filters.push("edgedetect=low=0.1:high=0.4");
  }
  filters.push("signalstats");
  if (metric === "signal") {
    filters.push(
      "metadata=mode=print:key=lavfi.signalstats.YAVG",
      "metadata=mode=print:key=lavfi.signalstats.UAVG",
      "metadata=mode=print:key=lavfi.signalstats.VAVG"
    );
  } else {
    filters.push("metadata=mode=print:key=lavfi.signalstats.YAVG");
  }
  return filters.join(",");
}

function buildMetricCommand(
  sourcePath: string,
  request: LaboratoryTemporalStressTestRequest,
  metric: "signal" | "frame-difference" | "edge"
) {
  return [
    "-hide_banner",
    "-nostats",
    "-ss",
    formatFfmpegNumber(request.startSeconds),
    "-t",
    formatFfmpegNumber(request.endSeconds - request.startSeconds),
    "-i",
    sourcePath,
    "-an",
    "-sn",
    "-dn",
    "-vf",
    buildMetricFilter(request, metric),
    "-f",
    "null",
    "-",
  ];
}

function buildCommands(
  sourcePath: string,
  request: LaboratoryTemporalStressTestRequest
): LaboratoryTemporalStressTestCommandSet {
  return {
    signal: buildMetricCommand(sourcePath, request, "signal"),
    frameDifference: buildMetricCommand(sourcePath, request, "frame-difference"),
    edge: buildMetricCommand(sourcePath, request, "edge"),
  };
}

function parseSignalStatsText(text: string): LaboratorySignalStatsFrame[] {
  const framesByTime = new Map<string, LaboratorySignalStatsFrame>();
  let currentTimeSeconds = 0;

  function getFrame(timeSeconds: number) {
    const key = timeSeconds.toFixed(6);
    const existing = framesByTime.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const created = { timeSeconds, values: {} } satisfies LaboratorySignalStatsFrame;
    framesByTime.set(key, created);
    return created;
  }

  text.split(/\r?\n/).forEach(function (rawLine) {
    const line = rawLine.trim();
    const timeMatch = line.match(/\bpts_time[:=](-?\d+(?:\.\d+)?)/);
    if (timeMatch?.[1] !== undefined) {
      const timeSeconds = Number(timeMatch[1]);
      currentTimeSeconds = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
      getFrame(currentTimeSeconds);
      return;
    }

    const metricMatch = line.match(/\blavfi\.signalstats\.([A-Z0-9]+)=(-?\d+(?:\.\d+)?)/);
    if (metricMatch?.[1] === undefined || metricMatch[2] === undefined) {
      return;
    }
    const numericValue = Number(metricMatch[2]);
    if (Number.isFinite(numericValue)) {
      getFrame(currentTimeSeconds).values[metricMatch[1]] = numericValue;
    }
  });

  return [...framesByTime.values()]
    .filter(function (frame) {
      return Object.keys(frame.values).length > 0;
    })
    .sort(function (left, right) {
      return left.timeSeconds - right.timeSeconds;
    });
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce(function (sum, value) {
        return sum + value;
      }, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort(function (left, right) {
    return left - right;
  });
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function range(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return Math.max(...values) - Math.min(...values);
}

function buildTemporalResult(
  request: LaboratoryTemporalStressTestRequest,
  signalFrames: LaboratorySignalStatsFrame[],
  differenceFrames: LaboratorySignalStatsFrame[],
  edgeFrames: LaboratorySignalStatsFrame[]
) {
  const signal = signalFrames.map(function (frame) {
    return {
      timeSeconds: request.startSeconds + frame.timeSeconds,
      luma: normalizeEightBitMetric(asFiniteNumber(frame.values["YAVG"])),
      chromaU: normalizeEightBitMetric(asFiniteNumber(frame.values["UAVG"])),
      chromaV: normalizeEightBitMetric(asFiniteNumber(frame.values["VAVG"])),
    };
  });
  const frameDifference = differenceFrames.map(function (frame) {
    return {
      timeSeconds: request.startSeconds + frame.timeSeconds,
      energy: normalizeEightBitMetric(asFiniteNumber(frame.values["YAVG"])) ?? 0,
    };
  });
  const edge = edgeFrames.map(function (frame) {
    return {
      timeSeconds: request.startSeconds + frame.timeSeconds,
      energy: normalizeEightBitMetric(asFiniteNumber(frame.values["YAVG"])) ?? 0,
    };
  });

  const lumaValues = signal
    .map(function (entry) {
      return entry.luma;
    })
    .filter((value): value is number => value !== null);
  const chromaUValues = signal
    .map(function (entry) {
      return entry.chromaU;
    })
    .filter((value): value is number => value !== null);
  const chromaVValues = signal
    .map(function (entry) {
      return entry.chromaV;
    })
    .filter((value): value is number => value !== null);
  const frameDifferenceValues = frameDifference.map(function (entry) {
    return entry.energy;
  });
  const edgeValues = edge.map(function (entry) {
    return entry.energy;
  });
  const edgePersistenceThreshold = Math.max(0.01, median(edgeValues) * 0.5);
  const edgePersistenceRatio =
    edgeValues.length === 0
      ? 0
      : edgeValues.filter(function (value) {
          return value >= edgePersistenceThreshold;
        }).length / edgeValues.length;

  return {
    signal,
    frameDifference,
    edge,
    summary: {
      sampleCount: signal.length,
      frameDifferenceSampleCount: frameDifference.length,
      edgeSampleCount: edge.length,
      meanLuma: mean(lumaValues),
      lumaRange: range(lumaValues),
      chromaURange: range(chromaUValues),
      chromaVRange: range(chromaVValues),
      meanFrameDifferenceEnergy: mean(frameDifferenceValues),
      peakFrameDifferenceEnergy:
        frameDifferenceValues.length === 0 ? 0 : Math.max(...frameDifferenceValues),
      meanEdgeEnergy: mean(edgeValues),
      edgePersistenceThreshold,
      edgePersistenceRatio,
    },
  };
}

export function createLaboratoryTemporalStressTestRuntime(
  deps: LaboratoryTemporalStressTestDeps
) {
  const {
    callRoomTools,
    ensureProjectDirectories,
    getActiveProject,
    getPreparedSourcePath,
    getProjectEditOutputDir,
    patchActiveProject,
    roomId,
    toRecord,
  } = deps;

  async function runMetricCommand(
    runtime: LaboratoryTemporalStressTestRuntimeRecord,
    project: LaboratoryTemporalStressTestProjectRecord,
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
    const exitCode = asFiniteNumber(run["exitCode"]) ?? 0;
    if (run["cancelled"] === true || exitCode !== 0) {
      throw new Error(asNonEmptyString(run["stderr"]) || "Temporal FFmpeg metric pass failed.");
    }
    return [asNonEmptyString(run["stdout"]), asNonEmptyString(run["stderr"])]
      .filter((entry): entry is string => entry !== null)
      .join("\n");
  }

  async function runTemporalStressTest(
    runtime: LaboratoryTemporalStressTestRuntimeRecord,
    requestId: string,
    rawRequest: unknown
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const source = toRecord(project.source);
    if (asNonEmptyString(source["kind"]) !== "video") {
      throw new Error("Temporal stress testing currently requires a video source.");
    }
    const sourcePath = getPreparedSourcePath(project);
    if (sourcePath === null) {
      throw new Error("Prepare a source file before running temporal stress testing.");
    }
    const metadata = toRecord(source["metadata"]);
    const sourceDurationSeconds = asFiniteNumber(metadata["durationSeconds"]);
    const request = normalizeLaboratoryTemporalStressTestRequest(
      rawRequest,
      sourceDurationSeconds
    );
    if (request === null) {
      throw new Error("Select a valid video time range before running temporal stress testing.");
    }

    await ensureProjectDirectories(runtime, project, requestId);
    const commands = buildCommands(sourcePath, request);
    const signalText = await runMetricCommand(runtime, project, requestId, commands.signal);
    const differenceText = await runMetricCommand(
      runtime,
      project,
      requestId,
      commands.frameDifference
    );
    const edgeText = await runMetricCommand(runtime, project, requestId, commands.edge);
    const metrics = buildTemporalResult(
      request,
      parseSignalStatsText(signalText),
      parseSignalStatsText(differenceText),
      parseSignalStatsText(edgeText)
    );

    const createdAt = new Date().toISOString();
    const timestampToken = createdAt.replace(/[:.]/g, "-");
    const result = {
      schemaVersion: 1,
      id: `temporal-stress-${timestampToken}`,
      createdAt,
      sourceKind: "video",
      sourcePath,
      request,
      metrics,
    };
    await patchActiveProject(runtime, function (nextProject) {
      const edit = toRecord(nextProject.edit);
      const existing = Array.isArray(edit["temporalStressTests"])
        ? (edit["temporalStressTests"] as unknown[])
        : [];
      nextProject.edit = {
        ...edit,
        temporalStressTests: [result, ...existing].slice(0, 20),
        lastActionAt: createdAt,
        lastError: null,
      };
      return nextProject;
    });
    return result;
  }

  return {
    buildCommands,
    buildTemporalResult,
    parseSignalStatsText,
    runTemporalStressTest,
  };
}
