import { normalizeLaboratoryTemporalStressTestRequest } from "../../../shared/temporal-stress-test-model.js";
import type { LaboratoryTemporalStressTestRequest } from "../../../shared/temporal-stress-test-model.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryPhotometricRuntimeRecord = LaboratoryRecord;
type LaboratoryPhotometricProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  source?: unknown;
};

type LaboratoryPhotometricAttenuationDeps = {
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  getActiveProject: (
    runtime: LaboratoryPhotometricRuntimeRecord
  ) => LaboratoryPhotometricProjectRecord | null;
  getPreparedSourcePath: (project: LaboratoryPhotometricProjectRecord) => string | null;
  getProjectEditOutputDir: (
    runtime: LaboratoryPhotometricRuntimeRecord,
    project: LaboratoryPhotometricProjectRecord
  ) => string;
  patchActiveProject: (
    runtime: LaboratoryPhotometricRuntimeRecord,
    updater: (project: LaboratoryPhotometricProjectRecord) => LaboratoryPhotometricProjectRecord
  ) => Promise<unknown>;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

type LaboratoryPhotometricFrame = {
  timeSeconds: number;
  values: Record<string, number>;
};

const NEAR_BLACK_THRESHOLD = 32;
const LUMA_RECOVERY_MULTIPLIER = 8;

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeEightBit(value: number | null) {
  return value === null ? null : clamp01(value / 255);
}

function formatNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce(function (sum, value) {
        return sum + value;
      }, 0) / values.length;
}

function buildRoiFilter(request: LaboratoryTemporalStressTestRequest) {
  if (request.roi === null) {
    return null;
  }
  return [
    "crop=",
    `iw*${formatNumber(request.roi.width)}`,
    `:ih*${formatNumber(request.roi.height)}`,
    `:iw*${formatNumber(request.roi.x)}`,
    `:ih*${formatNumber(request.roi.y)}`,
  ].join("");
}

function buildPhotometricFilter(
  request: LaboratoryTemporalStressTestRequest,
  lifted: boolean
) {
  const filters: string[] = [];
  const roi = buildRoiFilter(request);
  if (roi !== null) {
    filters.push(roi);
  }
  filters.push("setpts=PTS-STARTPTS", `fps=${String(request.sampleFps)}`);
  if (lifted) {
    filters.push(`lutyuv=y=val*${String(LUMA_RECOVERY_MULTIPLIER)}`);
  } else {
    filters.push("signalstats");
  }
  filters.push(`blackframe=amount=0:threshold=${String(NEAR_BLACK_THRESHOLD)}`);
  if (lifted) {
    filters.push("metadata=mode=print:key=lavfi.blackframe.pblack");
  } else {
    filters.push(
      "metadata=mode=print:key=lavfi.signalstats.YMIN",
      "metadata=mode=print:key=lavfi.signalstats.YLOW",
      "metadata=mode=print:key=lavfi.signalstats.YAVG",
      "metadata=mode=print:key=lavfi.signalstats.YHIGH",
      "metadata=mode=print:key=lavfi.signalstats.YMAX",
      "metadata=mode=print:key=lavfi.signalstats.UAVG",
      "metadata=mode=print:key=lavfi.signalstats.VAVG",
      "metadata=mode=print:key=lavfi.blackframe.pblack"
    );
  }
  return filters.join(",");
}

function buildCommand(
  sourcePath: string,
  request: LaboratoryTemporalStressTestRequest,
  lifted: boolean
) {
  return [
    "-hide_banner",
    "-nostats",
    "-ss",
    formatNumber(request.startSeconds),
    "-t",
    formatNumber(request.endSeconds - request.startSeconds),
    "-i",
    sourcePath,
    "-an",
    "-sn",
    "-dn",
    "-vf",
    buildPhotometricFilter(request, lifted),
    "-f",
    "null",
    "-",
  ];
}

function parsePhotometricText(text: string): LaboratoryPhotometricFrame[] {
  const framesByTime = new Map<string, LaboratoryPhotometricFrame>();
  let currentTimeSeconds = 0;

  function getFrame(timeSeconds: number) {
    const key = timeSeconds.toFixed(6);
    const existing = framesByTime.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const created: LaboratoryPhotometricFrame = { timeSeconds, values: {} };
    framesByTime.set(key, created);
    return created;
  }

  text.split(/\r?\n/).forEach(function (rawLine) {
    const line = rawLine.trim();
    const timeMatch = line.match(/\bpts_time[:=](-?\d+(?:\.\d+)?)/);
    if (timeMatch?.[1] !== undefined) {
      const parsed = Number(timeMatch[1]);
      currentTimeSeconds = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      getFrame(currentTimeSeconds);
      return;
    }
    const metricMatch = line.match(
      /\blavfi\.(signalstats\.([A-Z0-9]+)|blackframe\.(pblack))=(-?\d+(?:\.\d+)?)/
    );
    const metricName = metricMatch?.[2] ?? metricMatch?.[3];
    const numericText = metricMatch?.[4];
    if (metricName === undefined || numericText === undefined) {
      return;
    }
    const numericValue = Number(numericText);
    if (Number.isFinite(numericValue)) {
      getFrame(currentTimeSeconds).values[metricName] = numericValue;
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

function buildPhotometricResult(
  request: LaboratoryTemporalStressTestRequest,
  sourceFrames: LaboratoryPhotometricFrame[],
  liftedFrames: LaboratoryPhotometricFrame[]
) {
  const source = sourceFrames.map(function (frame) {
    return {
      timeSeconds: request.startSeconds + frame.timeSeconds,
      lumaMin: normalizeEightBit(asFiniteNumber(frame.values["YMIN"])),
      lumaLow: normalizeEightBit(asFiniteNumber(frame.values["YLOW"])),
      lumaMean: normalizeEightBit(asFiniteNumber(frame.values["YAVG"])),
      lumaHigh: normalizeEightBit(asFiniteNumber(frame.values["YHIGH"])),
      lumaMax: normalizeEightBit(asFiniteNumber(frame.values["YMAX"])),
      chromaU: normalizeEightBit(asFiniteNumber(frame.values["UAVG"])),
      chromaV: normalizeEightBit(asFiniteNumber(frame.values["VAVG"])),
      nearBlackFraction: clamp01((asFiniteNumber(frame.values["pblack"]) ?? 0) / 100),
    };
  });
  const lifted = liftedFrames.map(function (frame) {
    return {
      timeSeconds: request.startSeconds + frame.timeSeconds,
      nearBlackFraction: clamp01((asFiniteNumber(frame.values["pblack"]) ?? 0) / 100),
    };
  });

  const meanLuma = mean(
    source.map((entry) => entry.lumaMean).filter((value): value is number => value !== null)
  );
  const meanLumaLow = mean(
    source.map((entry) => entry.lumaLow).filter((value): value is number => value !== null)
  );
  const meanLumaHigh = mean(
    source.map((entry) => entry.lumaHigh).filter((value): value is number => value !== null)
  );
  const meanNearBlackFraction = mean(source.map((entry) => entry.nearBlackFraction));
  const persistentNearBlackFraction = mean(lifted.map((entry) => entry.nearBlackFraction));
  const recoveredDarkFraction = clamp01(meanNearBlackFraction - persistentNearBlackFraction);
  const chromaNeutralDistance = mean(
    source
      .filter((entry) => entry.chromaU !== null && entry.chromaV !== null)
      .map(function (entry) {
        const u = entry.chromaU ?? 0.5;
        const v = entry.chromaV ?? 0.5;
        return Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2);
      })
  );

  return {
    source,
    lifted,
    summary: {
      sampleCount: source.length,
      liftedSampleCount: lifted.length,
      nearBlackThreshold: NEAR_BLACK_THRESHOLD / 255,
      recoveryMultiplier: LUMA_RECOVERY_MULTIPLIER,
      meanLuma,
      meanLumaLow,
      meanLumaHigh,
      lumaLowHighSpread: Math.max(0, meanLumaHigh - meanLumaLow),
      meanNearBlackFraction,
      recoveredDarkFraction,
      persistentNearBlackFraction,
      nearBlackRetentionRatio:
        meanNearBlackFraction <= 1e-9
          ? 0
          : clamp01(persistentNearBlackFraction / meanNearBlackFraction),
      chromaNeutralDistance,
    },
  };
}

function interpretPhotometricSummary(value: unknown) {
  const summary = value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as LaboratoryRecord)
    : {};
  const sampleCount = asFiniteNumber(summary["sampleCount"]) ?? 0;
  const liftedSampleCount = asFiniteNumber(summary["liftedSampleCount"]) ?? 0;
  const meanLuma = asFiniteNumber(summary["meanLuma"]) ?? 0;
  const recovered = asFiniteNumber(summary["recoveredDarkFraction"]) ?? 0;
  const persistent = asFiniteNumber(summary["persistentNearBlackFraction"]) ?? 0;
  const spread = asFiniteNumber(summary["lumaLowHighSpread"]) ?? 0;
  return {
    schemaVersion: 1,
    kind: "photometric-attenuation",
    dataQuality: sampleCount > 0 && liftedSampleCount > 0 ? "sufficient" : "insufficient",
    darkness: meanLuma < 0.1 ? "very-dark" : meanLuma < 0.22 ? "dark" : "not-dark",
    recoverability: recovered >= 0.25 ? "high" : recovered >= 0.08 ? "partial" : "low",
    persistentFloor: persistent >= 0.35 ? "high" : persistent >= 0.1 ? "moderate" : "low",
    internalLumaStructure: spread >= 0.12 ? "broad" : spread >= 0.04 ? "present" : "weak",
  } as const;
}

export function createLaboratoryPhotometricAttenuationRuntime(
  deps: LaboratoryPhotometricAttenuationDeps
) {
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
    runtime: LaboratoryPhotometricRuntimeRecord,
    project: LaboratoryPhotometricProjectRecord,
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
      throw new Error(asNonEmptyString(run["stderr"]) || "Photometric FFmpeg probe failed.");
    }
    return [asNonEmptyString(run["stdout"]), asNonEmptyString(run["stderr"])]
      .filter((entry): entry is string => entry !== null)
      .join("\n");
  }

  async function runPhotometricAttenuationProbe(
    runtime: LaboratoryPhotometricRuntimeRecord,
    requestId: string,
    rawRequest: unknown
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const source = toRecord(project.source);
    if (asNonEmptyString(source["kind"]) !== "video") {
      throw new Error("Photometric attenuation probing currently requires a video source.");
    }
    const sourcePath = getPreparedSourcePath(project);
    if (sourcePath === null) {
      throw new Error("Prepare a source file before running a photometric probe.");
    }
    const metadata = toRecord(source["metadata"]);
    const sourceDurationSeconds = asFiniteNumber(metadata["durationSeconds"]);
    const request = normalizeLaboratoryTemporalStressTestRequest(rawRequest, sourceDurationSeconds);
    if (request === null) {
      throw new Error("Select a valid video time range before running a photometric probe.");
    }

    const sourceText = await runTool(
      runtime,
      project,
      requestId,
      buildCommand(sourcePath, request, false)
    );
    const liftedText = await runTool(
      runtime,
      project,
      requestId,
      buildCommand(sourcePath, request, true)
    );
    const metrics = buildPhotometricResult(
      request,
      parsePhotometricText(sourceText),
      parsePhotometricText(liftedText)
    );
    const interpretation = interpretPhotometricSummary(metrics.summary);
    const createdAt = new Date().toISOString();
    const timestampToken = createdAt.replace(/[:.]/g, "-");
    const result = {
      schemaVersion: 1,
      kind: "photometric-attenuation",
      id: `photometric-attenuation-${timestampToken}`,
      createdAt,
      sourceKind: "video",
      sourcePath,
      hypothesis: "persistent-photometric-attenuation",
      request,
      metrics,
      interpretation,
      method: {
        nearBlackThreshold8Bit: NEAR_BLACK_THRESHOLD,
        recoveryOperation: `luma-multiply-${String(LUMA_RECOVERY_MULTIPLIER)}x`,
      },
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
    buildCommand,
    buildPhotometricResult,
    interpretPhotometricSummary,
    parsePhotometricText,
    runPhotometricAttenuationProbe,
  };
}
