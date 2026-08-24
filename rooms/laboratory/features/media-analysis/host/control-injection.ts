import { normalizeLaboratoryControlInjectionRequest } from "../../../shared/control-injection-model.js";
import type { LaboratoryControlInjectionRequest } from "../../../shared/control-injection-model.js";
import type { LaboratoryTemporalStressTestRequest } from "../../../shared/temporal-stress-test-model.js";
import type { createLaboratoryTemporalStressTestRuntime } from "./temporal-stress-test.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryControlRuntimeRecord = LaboratoryRecord;
type LaboratoryControlProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  source?: unknown;
};
type LaboratoryTemporalRuntime = ReturnType<typeof createLaboratoryTemporalStressTestRuntime>;

type LaboratoryControlInjectionDeps = {
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  getActiveProject: (
    runtime: LaboratoryControlRuntimeRecord
  ) => LaboratoryControlProjectRecord | null;
  getPreparedSourcePath: (project: LaboratoryControlProjectRecord) => string | null;
  getProjectEditOutputDir: (
    runtime: LaboratoryControlRuntimeRecord,
    project: LaboratoryControlProjectRecord
  ) => string;
  patchActiveProject: (
    runtime: LaboratoryControlRuntimeRecord,
    updater: (project: LaboratoryControlProjectRecord) => LaboratoryControlProjectRecord
  ) => Promise<unknown>;
  roomId: string;
  temporalRuntime: Pick<
    LaboratoryTemporalRuntime,
    "buildCommands" | "buildTemporalResult" | "parseSignalStatsText"
  >;
  toRecord: (value: unknown) => LaboratoryRecord;
};

type ControlPairPaths = {
  baselinePath: string;
  injectedPath: string;
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function formatNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function buildCropFilter(request: LaboratoryControlInjectionRequest) {
  const roi = request.temporalRequest.roi;
  if (roi === null) {
    return null;
  }
  return [
    `crop=trunc(iw*${formatNumber(roi.width)}/2)*2`,
    `trunc(ih*${formatNumber(roi.height)}/2)*2`,
    `trunc(iw*${formatNumber(roi.x)}/2)*2`,
    `trunc(ih*${formatNumber(roi.y)}/2)*2`,
  ].join(":");
}

function buildControlFilter(request: LaboratoryControlInjectionRequest) {
  const params = request.params;
  if (request.kind === "noise") {
    return `noise=alls=${formatNumber(params["strength"] ?? 12)}:allf=t+u`;
  }
  if (request.kind === "blur") {
    return `boxblur=${formatNumber(params["radius"] ?? 2)}:1`;
  }
  if (request.kind === "sharpen") {
    return `unsharp=5:5:${formatNumber(params["amount"] ?? 1.25)}:5:5:0`;
  }
  return [
    `eq=brightness=${formatNumber(params["brightness"] ?? -0.25)}` +
      `:contrast=${formatNumber(params["contrast"] ?? 1.05)}` +
      `:saturation=${formatNumber(params["saturation"] ?? 0.9)}`,
    `noise=alls=${formatNumber(params["noiseStrength"] ?? 8)}:allf=t+u`,
  ].join(",");
}

function buildPairCommand(
  sourcePath: string,
  outputPath: string,
  request: LaboratoryControlInjectionRequest,
  injected: boolean
) {
  const temporal = request.temporalRequest;
  const filters: string[] = [];
  const crop = buildCropFilter(request);
  if (crop !== null) {
    filters.push(crop);
  }
  if (injected) {
    filters.push(buildControlFilter(request));
  }
  return [
    "-y",
    "-hide_banner",
    "-ss",
    formatNumber(temporal.startSeconds),
    "-t",
    formatNumber(temporal.endSeconds - temporal.startSeconds),
    "-i",
    sourcePath,
    "-map",
    "0:v:0",
    "-an",
    "-sn",
    "-dn",
    ...(filters.length > 0 ? ["-vf", filters.join(",")] : []),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}

function getRunText(value: unknown, toRecord: (value: unknown) => LaboratoryRecord) {
  const result = toRecord(value);
  const run = toRecord(result["run"]);
  const exitCode = asFiniteNumber(run["exitCode"]) ?? 0;
  if (run["cancelled"] === true || exitCode !== 0) {
    throw new Error(asNonEmptyString(run["stderr"]) || "Control injection FFmpeg pass failed.");
  }
  return [asNonEmptyString(run["stdout"]), asNonEmptyString(run["stderr"])]
    .filter((entry): entry is string => entry !== null)
    .join("\n");
}

function toMetricRequest(request: LaboratoryControlInjectionRequest): LaboratoryTemporalStressTestRequest {
  return {
    startSeconds: 0,
    endSeconds: request.temporalRequest.endSeconds - request.temporalRequest.startSeconds,
    sampleFps: request.temporalRequest.sampleFps,
    roi: null,
  };
}

function readSummaryNumber(summary: LaboratoryRecord, key: string) {
  return asFiniteNumber(summary[key]) ?? 0;
}

function buildSummaryDelta(
  baselineMetrics: unknown,
  injectedMetrics: unknown,
  toRecord: (value: unknown) => LaboratoryRecord
) {
  const baseline = toRecord(toRecord(baselineMetrics)["summary"]);
  const injected = toRecord(toRecord(injectedMetrics)["summary"]);
  const keys = [
    "meanFrameDifferenceEnergy",
    "peakFrameDifferenceEnergy",
    "meanEdgeEnergy",
    "edgePersistenceRatio",
    "lumaRange",
    "chromaURange",
    "chromaVRange",
  ];
  return keys.reduce(function (accumulator: LaboratoryRecord, key: string) {
    accumulator[key] = readSummaryNumber(injected, key) - readSummaryNumber(baseline, key);
    return accumulator;
  }, {});
}

export function createLaboratoryControlInjectionRuntime(deps: LaboratoryControlInjectionDeps) {
  const {
    callRoomTools,
    getActiveProject,
    getPreparedSourcePath,
    getProjectEditOutputDir,
    patchActiveProject,
    roomId,
    temporalRuntime,
    toRecord,
  } = deps;

  async function runTool(
    runtime: LaboratoryControlRuntimeRecord,
    project: LaboratoryControlProjectRecord,
    requestId: string,
    args: string[]
  ) {
    return getRunText(
      await callRoomTools({
        args,
        cwd: getProjectEditOutputDir(runtime, project),
        operation: "tool-run",
        requestId,
        roomId,
        timeoutMs: 90_000,
        toolId: "ffmpeg",
      }),
      toRecord
    );
  }

  async function measureClip(
    runtime: LaboratoryControlRuntimeRecord,
    project: LaboratoryControlProjectRecord,
    requestId: string,
    sourcePath: string,
    request: LaboratoryControlInjectionRequest
  ) {
    const metricRequest = toMetricRequest(request);
    const commands = temporalRuntime.buildCommands(sourcePath, metricRequest);
    const signalText = await runTool(runtime, project, requestId, commands.signal);
    const differenceText = await runTool(runtime, project, requestId, commands.frameDifference);
    const edgeText = await runTool(runtime, project, requestId, commands.edge);
    return temporalRuntime.buildTemporalResult(
      metricRequest,
      temporalRuntime.parseSignalStatsText(signalText),
      temporalRuntime.parseSignalStatsText(differenceText),
      temporalRuntime.parseSignalStatsText(edgeText)
    );
  }

  function buildPairPaths(
    runtime: LaboratoryControlRuntimeRecord,
    project: LaboratoryControlProjectRecord,
    request: LaboratoryControlInjectionRequest,
    timestampToken: string
  ): ControlPairPaths {
    const outputDir = getProjectEditOutputDir(runtime, project);
    const prefix = `control-${request.kind}-${timestampToken}`;
    return {
      baselinePath: `${outputDir}/${prefix}-baseline.mp4`,
      injectedPath: `${outputDir}/${prefix}-injected.mp4`,
    };
  }

  async function runControlInjection(
    runtime: LaboratoryControlRuntimeRecord,
    requestId: string,
    rawRequest: unknown
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const source = toRecord(project.source);
    if (asNonEmptyString(source["kind"]) !== "video") {
      throw new Error("Destruction controls currently require a video source.");
    }
    const sourcePath = getPreparedSourcePath(project);
    if (sourcePath === null) {
      throw new Error("Prepare a source file before running destruction controls.");
    }
    const metadata = toRecord(source["metadata"]);
    const sourceDurationSeconds = asFiniteNumber(metadata["durationSeconds"]);
    const request = normalizeLaboratoryControlInjectionRequest(rawRequest, sourceDurationSeconds);
    if (request === null) {
      throw new Error(
        "Select a valid control type and video time range before running a destruction control."
      );
    }

    const createdAt = new Date().toISOString();
    const timestampToken = createdAt.replace(/[:.]/g, "-");
    const paths = buildPairPaths(runtime, project, request, timestampToken);
    await runTool(
      runtime,
      project,
      requestId,
      buildPairCommand(sourcePath, paths.baselinePath, request, false)
    );
    await runTool(
      runtime,
      project,
      requestId,
      buildPairCommand(sourcePath, paths.injectedPath, request, true)
    );

    const baselineMetrics = await measureClip(
      runtime,
      project,
      requestId,
      paths.baselinePath,
      request
    );
    const injectedMetrics = await measureClip(
      runtime,
      project,
      requestId,
      paths.injectedPath,
      request
    );
    const result = {
      schemaVersion: 1,
      kind: "control-injection",
      id: `control-injection-${request.kind}-${timestampToken}`,
      createdAt,
      sourceKind: "video",
      sourcePath,
      comparisonMethod: "paired-reencode-baseline",
      request,
      baselinePath: paths.baselinePath,
      injectedPath: paths.injectedPath,
      metrics: {
        baseline: baselineMetrics,
        injected: injectedMetrics,
      },
      delta: buildSummaryDelta(baselineMetrics, injectedMetrics, toRecord),
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
    buildControlFilter,
    buildPairCommand,
    runControlInjection,
  };
}
