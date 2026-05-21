import {
  getAudioAnalysisOpenSmileConfigDir,
  getAudioAnalysisOpenSmileConfigPath,
  getProjectProfileDir,
} from "../../../shared/host/project-paths.js";

interface AnalysisProbesDeps {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  toRecord: (value: unknown) => Record<string, unknown>;
  readTextFile: (path: string) => Promise<string | null>;
  runProfileTool: (
    runtime: Record<string, unknown>,
    options: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  buildProsodySummaryFromCsv: (csv: string) => Record<string, unknown>;
  parseBlackDetectLog: (log: string | null) => unknown;
  parseFreezeDetectLog: (log: string | null) => unknown;
  parseSilenceDetectLog: (log: unknown) => unknown;
  parseVolumeDetectLog: (log: unknown) => unknown;
}

type DetectionLogSegmentRecord = Record<string, unknown>;

type ProbeTimeScope = {
  durationSeconds: number;
  endSeconds: number;
  source: "analysis-scope" | "sample-window";
  startSeconds: number;
};

type StructureProbeOptions = {
  analysisScope?: unknown;
  fallbackWindowSeconds?: unknown;
};

const DEFAULT_STRUCTURE_PROBE_TIMEOUT_MS = 120_000;
const MAX_STRUCTURE_PROBE_TIMEOUT_MS = 15 * 60_000;
const STRUCTURE_PROBE_TIMEOUT_MS_PER_MEDIA_SECOND = 750;

export function createAudioAnalysisProbeRuntime(deps: AnalysisProbesDeps) {
  const asNonEmptyString = deps.asNonEmptyString;
  const asNumber = deps.asNumber;
  const toRecord = deps.toRecord;
  const readTextFile = deps.readTextFile;
  const runProfileTool = deps.runProfileTool;
  const buildProsodySummaryFromCsv = deps.buildProsodySummaryFromCsv;
  const parseBlackDetectLog = deps.parseBlackDetectLog;
  const parseFreezeDetectLog = deps.parseFreezeDetectLog;
  const parseSilenceDetectLog = deps.parseSilenceDetectLog;
  const parseVolumeDetectLog = deps.parseVolumeDetectLog;

  function toPackageToolsRuntime(runtime: Record<string, unknown>) {
    return { packageToolsDir: runtime["packageToolsDir"] };
  }

  function toProjectPathRuntime(runtime: Record<string, unknown>) {
    const pathsRecord = toRecord(runtime["paths"]);
    const projectsDir = asNonEmptyString(pathsRecord["projectsDir"]);
    if (projectsDir === null) {
      throw new Error("Audio analysis runtime is missing a projects directory.");
    }
    return {
      paths: {
        projectsDir: projectsDir,
      },
    };
  }

  function toProjectSlugRecord(project: Record<string, unknown>) {
    const slug = asNonEmptyString(project["slug"]);
    if (slug === null) {
      throw new Error("Audio analysis project is missing a slug.");
    }
    return { slug: slug };
  }

  function readTargetPath(target: Record<string, unknown>) {
    const path = asNonEmptyString(target["path"]);
    if (path === null) {
      throw new Error("Audio analysis target is missing a file path.");
    }
    return path;
  }

  function readProfileToolStderr(result: Record<string, unknown>) {
    return asNonEmptyString(result["stderr"]);
  }

  function asFiniteNumber(value: unknown) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const numericValue = asNumber(value) ?? Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function readTargetDurationSeconds(target: Record<string, unknown>) {
    const metadata = toRecord(target["metadata"]);
    const durationSeconds =
      asFiniteNumber(metadata["durationSeconds"]) ?? asFiniteNumber(target["durationSeconds"]);
    return durationSeconds !== null && durationSeconds > 0 ? durationSeconds : null;
  }

  function formatFfmpegSeconds(value: number) {
    return (
      Math.max(0, value)
        .toFixed(3)
        .replace(/\.?0+$/, "") || "0"
    );
  }

  function resolveAnalysisScopeTimeScope(
    target: Record<string, unknown>,
    options: StructureProbeOptions
  ): ProbeTimeScope | null {
    const analysisScope = toRecord(options.analysisScope);
    const timeRange = toRecord(analysisScope["timeRange"]);
    const startMs = asFiniteNumber(timeRange["startMs"]);
    const endMs = asFiniteNumber(timeRange["endMs"]);
    if (startMs === null || endMs === null || endMs <= startMs) {
      return null;
    }

    const targetDurationSeconds = readTargetDurationSeconds(target);
    const unclampedStartSeconds = Math.max(0, startMs / 1000);
    const unclampedEndSeconds = Math.max(unclampedStartSeconds, endMs / 1000);
    const startSeconds =
      targetDurationSeconds === null
        ? unclampedStartSeconds
        : Math.min(unclampedStartSeconds, targetDurationSeconds);
    const endSeconds =
      targetDurationSeconds === null
        ? unclampedEndSeconds
        : Math.min(unclampedEndSeconds, targetDurationSeconds);
    if (endSeconds <= startSeconds) {
      return null;
    }
    return {
      durationSeconds: endSeconds - startSeconds,
      endSeconds,
      source: "analysis-scope",
      startSeconds,
    };
  }

  function resolveFallbackTimeScope(
    target: Record<string, unknown>,
    options: StructureProbeOptions
  ): ProbeTimeScope | null {
    const fallbackWindowSeconds = asFiniteNumber(options.fallbackWindowSeconds);
    if (fallbackWindowSeconds === null || fallbackWindowSeconds <= 0) {
      return null;
    }

    const targetDurationSeconds = readTargetDurationSeconds(target);
    const durationSeconds =
      targetDurationSeconds === null
        ? fallbackWindowSeconds
        : Math.min(fallbackWindowSeconds, targetDurationSeconds);
    if (durationSeconds <= 0) {
      return null;
    }
    return {
      durationSeconds,
      endSeconds: durationSeconds,
      source: "sample-window",
      startSeconds: 0,
    };
  }

  function resolveProbeTimeScope(
    target: Record<string, unknown>,
    options: StructureProbeOptions = {}
  ) {
    return (
      resolveAnalysisScopeTimeScope(target, options) || resolveFallbackTimeScope(target, options)
    );
  }

  function buildScopedInputArgs(targetPath: string, timeScope: ProbeTimeScope | null) {
    return [
      "-hide_banner",
      ...(timeScope === null
        ? []
        : [
            "-ss",
            formatFfmpegSeconds(timeScope.startSeconds),
            "-t",
            formatFfmpegSeconds(timeScope.durationSeconds),
          ]),
      "-i",
      targetPath,
    ];
  }

  function resolveStructureProbeTimeoutMs(
    target: Record<string, unknown>,
    timeScope: ProbeTimeScope | null
  ) {
    const durationSeconds = timeScope?.durationSeconds ?? readTargetDurationSeconds(target);
    if (durationSeconds === null) {
      return DEFAULT_STRUCTURE_PROBE_TIMEOUT_MS;
    }
    return Math.min(
      MAX_STRUCTURE_PROBE_TIMEOUT_MS,
      Math.max(
        DEFAULT_STRUCTURE_PROBE_TIMEOUT_MS,
        Math.ceil(durationSeconds * STRUCTURE_PROBE_TIMEOUT_MS_PER_MEDIA_SECOND)
      )
    );
  }

  function offsetOptionalSeconds(value: unknown, offsetSeconds: number) {
    const numericValue = asFiniteNumber(value);
    return numericValue === null ? value : numericValue + offsetSeconds;
  }

  function offsetDetectionLogSummary(summary: unknown, timeScope: ProbeTimeScope | null) {
    if (timeScope === null || timeScope.startSeconds <= 0) {
      return summary;
    }
    const source = toRecord(summary);
    const segments = Array.isArray(source["segments"]) ? source["segments"] : null;
    if (segments === null) {
      return summary;
    }
    return {
      ...source,
      segments: segments.map(function (segment) {
        const segmentRecord = toRecord(segment) as DetectionLogSegmentRecord;
        return {
          ...segmentRecord,
          endSeconds: offsetOptionalSeconds(segmentRecord["endSeconds"], timeScope.startSeconds),
          startSeconds: offsetOptionalSeconds(
            segmentRecord["startSeconds"],
            timeScope.startSeconds
          ),
        };
      }),
    };
  }

  function serializeProbeTimeScope(timeScope: ProbeTimeScope | null) {
    return timeScope === null
      ? null
      : {
          durationSeconds: timeScope.durationSeconds,
          endSeconds: timeScope.endSeconds,
          source: timeScope.source,
          startSeconds: timeScope.startSeconds,
        };
  }

  function resolveOpenSmileProsodyRuntime(runtime: Record<string, unknown>) {
    const packageToolsRuntime = toPackageToolsRuntime(runtime);
    const configDir = getAudioAnalysisOpenSmileConfigDir(packageToolsRuntime);
    const configPath = getAudioAnalysisOpenSmileConfigPath(packageToolsRuntime, "prosodyAcf.conf");
    if (configDir === null || configPath === null) {
      return null;
    }
    return {
      configDir: configDir,
      configPath: configPath,
    };
  }

  async function runOpenSmileProsodyExtraction(
    runtime: Record<string, unknown>,
    _project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    target: Record<string, unknown>,
    artifactBase: string,
    moduleOutputDir: string,
    outputLabel: string
  ) {
    const openSmileRuntime = resolveOpenSmileProsodyRuntime(runtime);
    if (openSmileRuntime === null) {
      throw new Error("Room-local openSMILE config package is unavailable on this runtime.");
    }

    const contourPath = `${moduleOutputDir}/${artifactBase}-${outputLabel}.csv`;
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "opensmile",
      cwd: openSmileRuntime.configDir,
      args: [
        "-C",
        openSmileRuntime.configPath,
        "-I",
        readTargetPath(target),
        "-csvoutput",
        contourPath,
        "-appendcsv",
        "0",
        "-nologfile",
        "1",
      ],
      timeoutMs: 3 * 60 * 1000,
    });

    const contourCsv = await readTextFile(contourPath);
    const contourCsvText = asNonEmptyString(contourCsv);
    if (contourCsvText === null) {
      throw new Error("openSMILE did not produce a prosody contour CSV.");
    }

    return {
      contourCsv: contourCsvText,
      contourPath: contourPath,
      prosodySummary: buildProsodySummaryFromCsv(contourCsvText),
    };
  }

  async function runVideoStructureProbe(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    target: Record<string, unknown>,
    options: StructureProbeOptions = {}
  ) {
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    const targetPath = readTargetPath(target);
    const timeScope = resolveProbeTimeScope(target, options);
    const stderr = readProfileToolStderr(
      await runProfileTool(runtime, {
        requestId: requestId,
        jobId: jobId,
        toolId: "ffmpeg",
        cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
        args: [
          ...buildScopedInputArgs(targetPath, timeScope),
          "-vf",
          "blackdetect=d=0.25:pix_th=0.10,freezedetect=n=-40dB:d=0.4",
          "-an",
          "-f",
          "null",
          "-",
        ],
        timeoutMs: resolveStructureProbeTimeoutMs(target, timeScope),
      })
    );
    return {
      black: offsetDetectionLogSummary(parseBlackDetectLog(stderr), timeScope),
      freeze: offsetDetectionLogSummary(parseFreezeDetectLog(stderr), timeScope),
      scopeWindow: serializeProbeTimeScope(timeScope),
    };
  }

  async function runAudioStructureProbe(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    target: Record<string, unknown>,
    options: StructureProbeOptions = {}
  ) {
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    const targetPath = readTargetPath(target);
    const timeScope = resolveProbeTimeScope(target, options);
    const timeoutMs = resolveStructureProbeTimeoutMs(target, timeScope);
    const silencePayload = await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
      args: [
        ...buildScopedInputArgs(targetPath, timeScope),
        "-af",
        "silencedetect=n=-38dB:d=0.35",
        "-f",
        "null",
        "-",
      ],
      timeoutMs,
    });
    const volumePayload = await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
      args: [
        ...buildScopedInputArgs(targetPath, timeScope),
        "-af",
        "volumedetect",
        "-f",
        "null",
        "-",
      ],
      timeoutMs,
    });

    return {
      scopeWindow: serializeProbeTimeScope(timeScope),
      silence: offsetDetectionLogSummary(
        parseSilenceDetectLog(silencePayload["stderr"]),
        timeScope
      ),
      volume: parseVolumeDetectLog(volumePayload["stderr"]),
    };
  }

  return {
    resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe,
    runOpenSmileProsodyExtraction,
    runVideoStructureProbe,
  };
}
