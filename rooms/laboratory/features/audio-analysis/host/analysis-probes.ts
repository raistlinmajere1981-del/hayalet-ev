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

type FrameHashEntry = {
  durationSeconds: number | null;
  hash: string;
  sizeBytes: number | null;
  timeSeconds: number | null;
};

type FrameMetadataEntry = {
  durationSeconds: number | null;
  keyFrame: boolean;
  packetSizeBytes: number | null;
  pictType: string | null;
  timeSeconds: number | null;
};

type MotionEnergySample = {
  energy: number;
  timeSeconds: number | null;
};

type MotionSampleRegion = {
  height: number;
  source: "analysis-scope" | "default-background" | "default-subject";
  width: number;
  x: number;
  y: number;
};

const DEFAULT_STRUCTURE_PROBE_TIMEOUT_MS = 120_000;
const MAX_STRUCTURE_PROBE_TIMEOUT_MS = 15 * 60_000;
const STRUCTURE_PROBE_TIMEOUT_MS_PER_MEDIA_SECOND = 750;
const MOTION_ENERGY_ACTIVE_THRESHOLD = 0.018;
const MOTION_ENERGY_LOW_THRESHOLD = 0.006;

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

  function readProfileToolStdout(result: Record<string, unknown>) {
    return asNonEmptyString(result["stdout"]);
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

  function roundMetric(value: number | null, digits = 4) {
    return value === null ? null : Number(value.toFixed(digits));
  }

  function safeRatio(numerator: number, denominator: number) {
    return denominator <= 0 ? null : numerator / denominator;
  }

  function toStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value
          .map(function (entry) {
            return asNonEmptyString(entry);
          })
          .filter((entry): entry is string => entry !== null)
      : [];
  }

  function getFfprobeExecutableCandidates(runtime: Record<string, unknown>) {
    const ffmpegTool = toRecord(toRecord(toRecord(runtime["toolState"])["tools"])["ffmpeg"]);
    const companionExecutables = toStringArray(ffmpegTool["companionExecutables"]);
    const detected = companionExecutables.find(function (entry) {
      return /(^|[\\/])ffprobe(?:\.exe)?$/i.test(entry);
    });
    return Array.from(new Set([detected, "ffprobe", "ffprobe.exe"].filter(Boolean) as string[]));
  }

  async function runFfprobeTool(
    runtime: Record<string, unknown>,
    options: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const candidates = getFfprobeExecutableCandidates(runtime);
    async function tryCandidate(
      index: number,
      lastError: unknown
    ): Promise<Record<string, unknown>> {
      const executableName = candidates[index];
      if (executableName === undefined) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }
      try {
        return await runProfileTool(runtime, {
          ...options,
          executableName,
          toolId: "ffmpeg",
        });
      } catch (error) {
        return tryCandidate(index + 1, error);
      }
    }
    return tryCandidate(0, null);
  }

  function parseJsonRecord(value: string | null) {
    if (value === null) {
      return {};
    }
    try {
      return toRecord(JSON.parse(value) as unknown);
    } catch (_error) {
      return {};
    }
  }

  function parseFrameHashTimeBase(stdout: string | null) {
    const match = (stdout || "").match(/^#tb\s+0:\s*(\d+)\/(\d+)/m);
    if (!match) {
      return 1;
    }
    const numerator = asFiniteNumber(match[1]);
    const denominator = asFiniteNumber(match[2]);
    return numerator !== null && denominator !== null && denominator > 0
      ? numerator / denominator
      : 1;
  }

  function shouldOffsetScopedTimes(
    firstTimeSeconds: number | null,
    timeScope: ProbeTimeScope | null
  ) {
    return (
      firstTimeSeconds !== null &&
      timeScope !== null &&
      timeScope.startSeconds > 0 &&
      firstTimeSeconds + 0.5 < timeScope.startSeconds
    );
  }

  function parseFrameHashEntries(stdout: string | null, timeScope: ProbeTimeScope | null) {
    const timeBase = parseFrameHashTimeBase(stdout);
    const parsedEntries = (stdout || "")
      .split(/\r?\n/)
      .map(function (line): FrameHashEntry | null {
        const trimmedLine = line.trim();
        if (trimmedLine === "" || trimmedLine.startsWith("#")) {
          return null;
        }
        const parts = trimmedLine.split(",").map(function (part) {
          return part.trim();
        });
        if (parts.length < 6) {
          return null;
        }
        const pts = asFiniteNumber(parts[2]);
        const durationTicks = asFiniteNumber(parts[3]);
        const sizeBytes = asFiniteNumber(parts[4]);
        const hash = asNonEmptyString(parts.slice(5).join(","));
        if (hash === null) {
          return null;
        }
        return {
          durationSeconds: durationTicks === null ? null : durationTicks * timeBase,
          hash,
          sizeBytes,
          timeSeconds: pts === null ? null : pts * timeBase,
        };
      })
      .filter((entry): entry is FrameHashEntry => entry !== null);
    const firstTimeSeconds =
      parsedEntries.find(function (entry) {
        return entry.timeSeconds !== null;
      })?.timeSeconds ?? null;
    const offsetSeconds = shouldOffsetScopedTimes(firstTimeSeconds, timeScope)
      ? timeScope?.startSeconds || 0
      : 0;
    return parsedEntries.map(function (entry) {
      return {
        ...entry,
        timeSeconds: entry.timeSeconds === null ? null : entry.timeSeconds + offsetSeconds,
      };
    });
  }

  function getFrameEndSeconds(entries: FrameHashEntry[], index: number) {
    const entry = entries[index];
    if (!entry || entry.timeSeconds === null) {
      return null;
    }
    if (entry.durationSeconds !== null && entry.durationSeconds > 0) {
      return entry.timeSeconds + entry.durationSeconds;
    }
    const nextTimeSeconds = entries[index + 1]?.timeSeconds;
    if (typeof nextTimeSeconds === "number" && nextTimeSeconds > entry.timeSeconds) {
      return nextTimeSeconds;
    }
    const previousTimeSeconds = entries[index - 1]?.timeSeconds;
    if (typeof previousTimeSeconds === "number" && entry.timeSeconds > previousTimeSeconds) {
      return entry.timeSeconds + (entry.timeSeconds - previousTimeSeconds);
    }
    return entry.timeSeconds;
  }

  function summarizeDuplicateFrameHashes(stdout: string | null, timeScope: ProbeTimeScope | null) {
    const entries = parseFrameHashEntries(stdout, timeScope);
    const segments: Record<string, unknown>[] = [];
    let exactDuplicateFrameCount = 0;
    let longestDuplicateRunFrames = 0;
    let runStartIndex = 0;

    function finalizeRun(endExclusiveIndex: number) {
      const runLength = endExclusiveIndex - runStartIndex;
      if (runLength <= 1) {
        return;
      }
      const firstEntry = entries[runStartIndex];
      const lastIndex = endExclusiveIndex - 1;
      const endSeconds = getFrameEndSeconds(entries, lastIndex);
      const startSeconds = firstEntry?.timeSeconds ?? null;
      exactDuplicateFrameCount += runLength - 1;
      longestDuplicateRunFrames = Math.max(longestDuplicateRunFrames, runLength);
      segments.push({
        durationSeconds:
          startSeconds !== null && endSeconds !== null
            ? Math.max(0, endSeconds - startSeconds)
            : null,
        endSeconds,
        frameCount: runLength,
        hashPrefix: firstEntry?.hash.slice(0, 12) || null,
        repeatedFrameCount: runLength - 1,
        startSeconds,
      });
    }

    for (let index = 1; index <= entries.length; index += 1) {
      if (index < entries.length && entries[index]?.hash === entries[index - 1]?.hash) {
        continue;
      }
      finalizeRun(index);
      runStartIndex = index;
    }

    const transitionCount = Math.max(0, entries.length - 1);
    return {
      exactDuplicateFrameCount,
      exactDuplicateFrameRatio: roundMetric(safeRatio(exactDuplicateFrameCount, transitionCount)),
      longestDuplicateRunFrames,
      sampledFrameCount: entries.length,
      segments: segments.slice(0, 12),
      status: "measured",
    };
  }

  async function runDuplicateFrameProbe(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    targetPath: string,
    timeScope: ProbeTimeScope | null,
    timeoutMs: number
  ) {
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    try {
      const stdout = readProfileToolStdout(
        await runProfileTool(runtime, {
          requestId,
          jobId,
          toolId: "ffmpeg",
          cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
          args: [
            ...buildScopedInputArgs(targetPath, timeScope),
            "-map",
            "0:v:0",
            "-an",
            "-f",
            "framehash",
            "-",
          ],
          timeoutMs,
        })
      );
      return summarizeDuplicateFrameHashes(stdout, timeScope);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        exactDuplicateFrameCount: 0,
        exactDuplicateFrameRatio: null,
        longestDuplicateRunFrames: 0,
        sampledFrameCount: 0,
        segments: [],
        status: "unavailable",
      };
    }
  }

  function buildFfprobeScopedArgs(timeScope: ProbeTimeScope | null) {
    return timeScope === null
      ? []
      : [
          "-read_intervals",
          `${formatFfmpegSeconds(timeScope.startSeconds)}%+${formatFfmpegSeconds(
            timeScope.durationSeconds
          )}`,
        ];
  }

  function parseFrameMetadataEntries(stdout: string | null, timeScope: ProbeTimeScope | null) {
    const payload = parseJsonRecord(stdout);
    const frames = Array.isArray(payload["frames"]) ? payload["frames"].map(toRecord) : [];
    const parsedEntries = frames
      .map(function (frame): FrameMetadataEntry | null {
        const timeSeconds =
          asFiniteNumber(frame["best_effort_timestamp_time"]) ??
          asFiniteNumber(frame["pkt_pts_time"]) ??
          asFiniteNumber(frame["pts_time"]);
        const pictType = asNonEmptyString(frame["pict_type"]);
        return {
          durationSeconds: asFiniteNumber(frame["pkt_duration_time"]),
          keyFrame: frame["key_frame"] === 1 || frame["key_frame"] === "1",
          packetSizeBytes: asFiniteNumber(frame["pkt_size"]),
          pictType,
          timeSeconds,
        };
      })
      .filter((entry): entry is FrameMetadataEntry => entry !== null);
    const firstTimeSeconds =
      parsedEntries.find(function (entry) {
        return entry.timeSeconds !== null;
      })?.timeSeconds ?? null;
    const offsetSeconds = shouldOffsetScopedTimes(firstTimeSeconds, timeScope)
      ? timeScope?.startSeconds || 0
      : 0;
    return parsedEntries.map(function (entry) {
      return {
        ...entry,
        timeSeconds: entry.timeSeconds === null ? null : entry.timeSeconds + offsetSeconds,
      };
    });
  }

  function average(values: number[]) {
    return values.length === 0
      ? null
      : values.reduce<number>(function (sum, value) {
          return sum + value;
        }, 0) / values.length;
  }

  function median(values: number[]) {
    const sorted = values
      .filter(function (value) {
        return Number.isFinite(value);
      })
      .sort(function (left, right) {
        return left - right;
      });
    if (sorted.length === 0) {
      return null;
    }
    const midpoint = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? ((sorted[midpoint - 1] || 0) + (sorted[midpoint] || 0)) / 2
      : sorted[midpoint] || null;
  }

  function buildFrameIntervals(entries: FrameMetadataEntry[]) {
    const intervals: number[] = [];
    let previousTimeSeconds: number | null = null;
    entries.forEach(function (entry) {
      if (entry.timeSeconds === null) {
        return;
      }
      if (previousTimeSeconds !== null) {
        const interval = entry.timeSeconds - previousTimeSeconds;
        if (interval > 0 && interval < 10) {
          intervals.push(interval);
        }
      }
      previousTimeSeconds = entry.timeSeconds;
    });
    return intervals;
  }

  function summarizeFrameCadence(entries: FrameMetadataEntry[]) {
    const intervals = buildFrameIntervals(entries);
    const medianInterval = median(intervals);
    const driftThreshold =
      medianInterval === null ? null : Math.max(0.006, Math.min(0.25, medianInterval * 0.35));
    const cadenceDriftFrameCount =
      medianInterval === null || driftThreshold === null
        ? 0
        : intervals.filter(function (interval) {
            return Math.abs(interval - medianInterval) > driftThreshold;
          }).length;
    let timestampRegressionCount = 0;
    let previousTimeSeconds: number | null = null;
    entries.forEach(function (entry) {
      if (entry.timeSeconds === null) {
        return;
      }
      if (previousTimeSeconds !== null && entry.timeSeconds + 0.001 < previousTimeSeconds) {
        timestampRegressionCount += 1;
      }
      previousTimeSeconds = entry.timeSeconds;
    });
    return {
      averageFrameIntervalSeconds: roundMetric(average(intervals)),
      cadenceDriftFrameCount,
      cadenceDriftRatio: roundMetric(safeRatio(cadenceDriftFrameCount, intervals.length)),
      maxFrameIntervalSeconds: roundMetric(intervals.length > 0 ? Math.max(...intervals) : null),
      medianFrameIntervalSeconds: roundMetric(medianInterval),
      minFrameIntervalSeconds: roundMetric(intervals.length > 0 ? Math.min(...intervals) : null),
      sampledFrameCount: entries.length,
      status: "measured",
      timestampRegressionCount,
    };
  }

  function countByPictType(entries: FrameMetadataEntry[]) {
    return entries.reduce<Record<string, number>>(function (counts, entry) {
      const key = entry.pictType || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function getMetadataNumber(target: Record<string, unknown>, key: string) {
    return asFiniteNumber(toRecord(target["metadata"])[key]);
  }

  function getMetadataString(target: Record<string, unknown>, key: string) {
    return asNonEmptyString(toRecord(target["metadata"])[key]);
  }

  function estimateBitsPerPixelFrame(
    target: Record<string, unknown>,
    medianFrameIntervalSeconds: number | null
  ) {
    const bitRate = getMetadataNumber(target, "bitRate");
    const width = getMetadataNumber(target, "width");
    const height = getMetadataNumber(target, "height");
    const fps =
      medianFrameIntervalSeconds !== null && medianFrameIntervalSeconds > 0
        ? 1 / medianFrameIntervalSeconds
        : getMetadataNumber(target, "fps");
    if (
      bitRate === null ||
      width === null ||
      height === null ||
      fps === null ||
      width <= 0 ||
      height <= 0 ||
      fps <= 0
    ) {
      return null;
    }
    return bitRate / (width * height * fps);
  }

  function summarizeCompressionSignature(
    target: Record<string, unknown>,
    entries: FrameMetadataEntry[],
    cadence: Record<string, unknown>
  ) {
    const packetSizes = entries
      .map(function (entry) {
        return entry.packetSizeBytes;
      })
      .filter((entry): entry is number => typeof entry === "number" && entry > 0);
    const medianPacketSizeBytes = median(packetSizes);
    const averagePacketSizeBytes = average(packetSizes);
    const lowPacketFrameCount =
      medianPacketSizeBytes === null
        ? 0
        : packetSizes.filter(function (size) {
            return size < medianPacketSizeBytes * 0.45;
          }).length;
    const packetSpikeFrameCount =
      medianPacketSizeBytes === null
        ? 0
        : packetSizes.filter(function (size) {
            return size > medianPacketSizeBytes * 2.5;
          }).length;
    const pictTypeCounts = countByPictType(entries);
    const bFrameCount = pictTypeCounts["B"] || 0;
    const estimatedBitsPerPixelFrame = estimateBitsPerPixelFrame(
      target,
      asFiniteNumber(cadence["medianFrameIntervalSeconds"])
    );
    const riskFactors: string[] = [];
    let riskScore = 0;
    const lowPacketFrameRatio = safeRatio(lowPacketFrameCount, packetSizes.length);
    const packetSpikeRatio = safeRatio(packetSpikeFrameCount, packetSizes.length);
    const bFrameRatio = safeRatio(bFrameCount, entries.length);
    if (estimatedBitsPerPixelFrame !== null && estimatedBitsPerPixelFrame < 0.06) {
      riskScore += 0.4;
      riskFactors.push("low bits-per-pixel-frame");
    } else if (estimatedBitsPerPixelFrame !== null && estimatedBitsPerPixelFrame < 0.1) {
      riskScore += 0.2;
      riskFactors.push("moderate bits-per-pixel-frame");
    }
    if (lowPacketFrameRatio !== null && lowPacketFrameRatio > 0.2) {
      riskScore += 0.25;
      riskFactors.push("many low-packet frames");
    }
    if (packetSpikeRatio !== null && packetSpikeRatio > 0.12) {
      riskScore += 0.2;
      riskFactors.push("packet-size spikes");
    }
    if (bFrameRatio !== null && bFrameRatio > 0.35) {
      riskScore += 0.15;
      riskFactors.push("high B-frame share");
    }
    return {
      averagePacketSizeBytes: roundMetric(averagePacketSizeBytes, 1),
      codec: getMetadataString(target, "videoCodec") || getMetadataString(target, "codec"),
      estimatedBitsPerPixelFrame: roundMetric(estimatedBitsPerPixelFrame, 5),
      lowPacketFrameCount,
      lowPacketFrameRatio: roundMetric(lowPacketFrameRatio),
      maxPacketSizeBytes: packetSizes.length > 0 ? Math.max(...packetSizes) : null,
      medianPacketSizeBytes: roundMetric(medianPacketSizeBytes, 1),
      minPacketSizeBytes: packetSizes.length > 0 ? Math.min(...packetSizes) : null,
      packetSpikeFrameCount,
      packetSpikeRatio: roundMetric(packetSpikeRatio),
      pictTypeCounts,
      riskFactors,
      riskLevel: riskScore >= 0.66 ? "high" : riskScore >= 0.33 ? "medium" : "low",
      riskScore: roundMetric(Math.min(1, riskScore)),
      sampledFrameCount: entries.length,
      status: "measured",
    };
  }

  function summarizeGopStructure(entries: FrameMetadataEntry[]) {
    const keyFrameTimes = entries
      .filter(function (entry) {
        return entry.keyFrame && entry.timeSeconds !== null;
      })
      .map(function (entry) {
        return entry.timeSeconds as number;
      });
    const gopDurations = keyFrameTimes
      .slice(1)
      .map(function (timeSeconds, index) {
        return timeSeconds - (keyFrameTimes[index] || 0);
      })
      .filter(function (durationSeconds) {
        return durationSeconds > 0;
      });
    return {
      averageGopSeconds: roundMetric(average(gopDurations)),
      keyFrameCount: keyFrameTimes.length,
      keyFrameRatio: roundMetric(safeRatio(keyFrameTimes.length, entries.length)),
      keyFrameTimes: keyFrameTimes.slice(0, 24).map(function (timeSeconds) {
        return roundMetric(timeSeconds, 3);
      }),
      maxGopSeconds: roundMetric(gopDurations.length > 0 ? Math.max(...gopDurations) : null),
      sampledFrameCount: entries.length,
      status: "measured",
    };
  }

  function clampMotionRegionValue(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  function normalizeMotionRegion(region: Record<string, unknown>, target: Record<string, unknown>) {
    const x = asFiniteNumber(region["x"]);
    const y = asFiniteNumber(region["y"]);
    const width = asFiniteNumber(region["width"]);
    const height = asFiniteNumber(region["height"]);
    if (
      x === null ||
      y === null ||
      width === null ||
      height === null ||
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }

    if (x + width <= 1.001 && y + height <= 1.001) {
      return {
        height: clampMotionRegionValue(height),
        width: clampMotionRegionValue(width),
        x: clampMotionRegionValue(x),
        y: clampMotionRegionValue(y),
      };
    }

    const sourceWidth = getMetadataNumber(target, "width");
    const sourceHeight = getMetadataNumber(target, "height");
    if (sourceWidth === null || sourceHeight === null || sourceWidth <= 0 || sourceHeight <= 0) {
      return null;
    }
    return {
      height: clampMotionRegionValue(height / sourceHeight),
      width: clampMotionRegionValue(width / sourceWidth),
      x: clampMotionRegionValue(x / sourceWidth),
      y: clampMotionRegionValue(y / sourceHeight),
    };
  }

  function resolveSubjectMotionRegion(
    target: Record<string, unknown>,
    options: StructureProbeOptions
  ): MotionSampleRegion {
    const analysisScope = toRecord(options.analysisScope);
    const normalizedRegion = normalizeMotionRegion(toRecord(analysisScope["region"]), target);
    if (normalizedRegion !== null) {
      const width = Math.max(0.04, Math.min(normalizedRegion.width, 1 - normalizedRegion.x));
      const height = Math.max(0.04, Math.min(normalizedRegion.height, 1 - normalizedRegion.y));
      return {
        height,
        source: "analysis-scope",
        width,
        x: Math.min(normalizedRegion.x, 1 - width),
        y: Math.min(normalizedRegion.y, 1 - height),
      };
    }
    return {
      height: 0.5,
      source: "default-subject",
      width: 0.5,
      x: 0.25,
      y: 0.25,
    };
  }

  function resolveBackgroundMotionRegion(subjectRegion: MotionSampleRegion): MotionSampleRegion {
    const width = Math.min(0.4, Math.max(0.18, subjectRegion.width));
    const height = Math.min(0.4, Math.max(0.18, subjectRegion.height));
    const subjectCenterX = subjectRegion.x + subjectRegion.width / 2;
    const subjectCenterY = subjectRegion.y + subjectRegion.height / 2;
    return {
      height,
      source: "default-background",
      width,
      x: subjectCenterX < 0.5 ? 1 - width : 0,
      y: subjectCenterY < 0.5 ? 1 - height : 0,
    };
  }

  function serializeMotionRegion(region: MotionSampleRegion) {
    return {
      height: roundMetric(region.height),
      source: region.source,
      width: roundMetric(region.width),
      x: roundMetric(region.x),
      y: roundMetric(region.y),
    };
  }

  function buildMotionEnergyFilter(region: MotionSampleRegion) {
    const crop = [
      `iw*${roundMetric(region.width, 5)}`,
      `ih*${roundMetric(region.height, 5)}`,
      `iw*${roundMetric(region.x, 5)}`,
      `ih*${roundMetric(region.y, 5)}`,
    ].join(":");
    return [
      "fps=6",
      `crop=${crop}`,
      "scale=160:-2:flags=fast_bilinear",
      "format=gray",
      "tblend=all_mode=difference",
      "signalstats",
      "metadata=print:key=lavfi.signalstats.YAVG",
    ].join(",");
  }

  function parseMotionEnergySamples(stderr: string | null, timeScope: ProbeTimeScope | null) {
    const samples: MotionEnergySample[] = [];
    let pendingTimeSeconds: number | null = null;
    (stderr || "").split(/\r?\n/).forEach(function (line) {
      const timeMatch = line.match(/pts_time:([0-9.]+)/);
      if (timeMatch) {
        pendingTimeSeconds = asFiniteNumber(timeMatch[1]);
        return;
      }
      const energyMatch = line.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/);
      if (!energyMatch) {
        return;
      }
      const rawEnergy = asFiniteNumber(energyMatch[1]);
      if (rawEnergy === null) {
        return;
      }
      samples.push({
        energy: rawEnergy / 255,
        timeSeconds: pendingTimeSeconds,
      });
    });

    const firstTimeSeconds =
      samples.find(function (entry) {
        return entry.timeSeconds !== null;
      })?.timeSeconds ?? null;
    const offsetSeconds = shouldOffsetScopedTimes(firstTimeSeconds, timeScope)
      ? timeScope?.startSeconds || 0
      : 0;
    return samples.map(function (sample) {
      return {
        ...sample,
        timeSeconds: sample.timeSeconds === null ? null : sample.timeSeconds + offsetSeconds,
      };
    });
  }

  function summarizeMotionEnergyRegion(
    label: "background" | "subject",
    region: MotionSampleRegion,
    samples: MotionEnergySample[]
  ) {
    const energies = samples.map(function (entry) {
      return entry.energy;
    });
    const activeFrameCount = energies.filter(function (value) {
      return value >= MOTION_ENERGY_ACTIVE_THRESHOLD;
    }).length;
    const lowMotionFrameCount = energies.filter(function (value) {
      return value <= MOTION_ENERGY_LOW_THRESHOLD;
    }).length;
    return {
      activeFrameCount,
      activeFrameRatio: roundMetric(safeRatio(activeFrameCount, energies.length)),
      averageMotionEnergy: roundMetric(average(energies), 5),
      label,
      lowMotionFrameCount,
      lowMotionFrameRatio: roundMetric(safeRatio(lowMotionFrameCount, energies.length)),
      medianMotionEnergy: roundMetric(median(energies), 5),
      peakMotionEnergy: roundMetric(energies.length > 0 ? Math.max(...energies) : null, 5),
      region: serializeMotionRegion(region),
      sampledFrameCount: samples.length,
      samples: samples.slice(0, 24).map(function (sample) {
        return {
          energy: roundMetric(sample.energy, 5),
          timeSeconds: roundMetric(sample.timeSeconds, 3),
        };
      }),
      status: "measured",
    };
  }

  function readMotionEnergy(summary: Record<string, unknown>, key: string) {
    return asFiniteNumber(toRecord(summary[key])["averageMotionEnergy"]);
  }

  function classifyOpticalFlowMotion(
    subjectSummary: Record<string, unknown>,
    backgroundSummary: Record<string, unknown>
  ) {
    const subjectMotionEnergy = readMotionEnergy({ subject: subjectSummary }, "subject");
    const backgroundMotionEnergy = readMotionEnergy(
      { background: backgroundSummary },
      "background"
    );
    const sampledFrameCount = Math.min(
      asFiniteNumber(subjectSummary["sampledFrameCount"]) || 0,
      asFiniteNumber(backgroundSummary["sampledFrameCount"]) || 0
    );
    const ratio =
      subjectMotionEnergy === null || backgroundMotionEnergy === null
        ? null
        : subjectMotionEnergy / Math.max(backgroundMotionEnergy, 0.0001);
    const subjectActive =
      subjectMotionEnergy !== null && subjectMotionEnergy >= MOTION_ENERGY_ACTIVE_THRESHOLD;
    const backgroundActive =
      backgroundMotionEnergy !== null && backgroundMotionEnergy >= MOTION_ENERGY_ACTIVE_THRESHOLD;
    const backgroundQuiet =
      backgroundMotionEnergy !== null &&
      backgroundMotionEnergy <= MOTION_ENERGY_LOW_THRESHOLD * 1.8;
    let movementClass = "insufficient_motion_samples";
    let confidence = "low";
    const reasons: string[] = [];

    if (sampledFrameCount >= 2 && subjectMotionEnergy !== null && backgroundMotionEnergy !== null) {
      if (subjectActive && backgroundQuiet && (ratio === null || ratio >= 1.8)) {
        movementClass = "localized_subject_motion";
        confidence = sampledFrameCount >= 5 && ratio !== null && ratio >= 2.5 ? "medium" : "low";
        reasons.push("subject/ROI motion energy exceeds the background sample");
      } else if (subjectActive && backgroundActive) {
        movementClass = "global_motion_or_camera_shift";
        confidence = sampledFrameCount >= 5 ? "medium" : "low";
        reasons.push("subject and background samples both carry motion energy");
      } else if (!subjectActive && backgroundActive) {
        movementClass = "background_or_camera_motion";
        confidence = sampledFrameCount >= 5 ? "medium" : "low";
        reasons.push("background sample carries more motion than the subject/ROI sample");
      } else if (!subjectActive && !backgroundActive) {
        movementClass = "low_motion_baseline";
        confidence = sampledFrameCount >= 5 ? "medium" : "low";
        reasons.push("subject and background motion energy remain low");
      } else {
        movementClass = "mixed_motion_energy";
        reasons.push("motion energy is present without a strong spatial split");
      }
    }

    return {
      backgroundMotionEnergy: roundMetric(backgroundMotionEnergy, 5),
      confidence,
      movementClass,
      reasons,
      sampledFrameCount,
      status: sampledFrameCount >= 2 ? "measured" : "unavailable",
      subjectBackgroundMotionRatio: roundMetric(ratio, 3),
      subjectMotionEnergy: roundMetric(subjectMotionEnergy, 5),
    };
  }

  async function runMotionEnergyRegionProbe(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    targetPath: string,
    timeScope: ProbeTimeScope | null,
    timeoutMs: number,
    region: MotionSampleRegion
  ) {
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    const stderr = readProfileToolStderr(
      await runProfileTool(runtime, {
        requestId,
        jobId,
        toolId: "ffmpeg",
        cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
        args: [
          ...buildScopedInputArgs(targetPath, timeScope),
          "-vf",
          buildMotionEnergyFilter(region),
          "-an",
          "-f",
          "null",
          "-",
        ],
        timeoutMs,
      })
    );
    return parseMotionEnergySamples(stderr, timeScope);
  }

  async function runOpticalFlowProbe(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    targetPath: string,
    target: Record<string, unknown>,
    options: StructureProbeOptions,
    timeScope: ProbeTimeScope | null,
    timeoutMs: number
  ) {
    const subjectRegion = resolveSubjectMotionRegion(target, options);
    const backgroundRegion = resolveBackgroundMotionRegion(subjectRegion);
    try {
      const subjectSamples = await runMotionEnergyRegionProbe(
        runtime,
        project,
        requestId,
        jobId,
        targetPath,
        timeScope,
        timeoutMs,
        subjectRegion
      );
      const backgroundSamples = await runMotionEnergyRegionProbe(
        runtime,
        project,
        requestId,
        jobId,
        targetPath,
        timeScope,
        timeoutMs,
        backgroundRegion
      );
      const subject = summarizeMotionEnergyRegion("subject", subjectRegion, subjectSamples);
      const background = summarizeMotionEnergyRegion(
        "background",
        backgroundRegion,
        backgroundSamples
      );
      return {
        ...classifyOpticalFlowMotion(subject, background),
        background,
        method: "ffmpeg-frame-difference-motion-energy",
        opticalFlowProxy: true,
        subject,
      };
    } catch (error) {
      return {
        background: {
          region: serializeMotionRegion(backgroundRegion),
          sampledFrameCount: 0,
          status: "unavailable",
        },
        error: error instanceof Error ? error.message : String(error),
        method: "ffmpeg-frame-difference-motion-energy",
        opticalFlowProxy: true,
        sampledFrameCount: 0,
        status: "unavailable",
        subject: {
          region: serializeMotionRegion(subjectRegion),
          sampledFrameCount: 0,
          status: "unavailable",
        },
      };
    }
  }

  async function runFrameMetadataProbe(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    targetPath: string,
    target: Record<string, unknown>,
    timeScope: ProbeTimeScope | null,
    timeoutMs: number
  ) {
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    try {
      const stdout = readProfileToolStdout(
        await runFfprobeTool(runtime, {
          requestId,
          jobId,
          cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
          args: [
            "-v",
            "error",
            ...buildFfprobeScopedArgs(timeScope),
            "-select_streams",
            "v:0",
            "-show_entries",
            "frame=best_effort_timestamp_time,pkt_pts_time,pts_time,pkt_duration_time,pkt_size,key_frame,pict_type",
            "-of",
            "json",
            targetPath,
          ],
          timeoutMs,
        })
      );
      const entries = parseFrameMetadataEntries(stdout, timeScope);
      const cadence = summarizeFrameCadence(entries);
      return {
        compressionSignature: summarizeCompressionSignature(target, entries, cadence),
        frameCadence: cadence,
        gopStructure: summarizeGopStructure(entries),
      };
    } catch (error) {
      const unavailable = {
        error: error instanceof Error ? error.message : String(error),
        sampledFrameCount: 0,
        status: "unavailable",
      };
      return {
        compressionSignature: unavailable,
        frameCadence: unavailable,
        gopStructure: unavailable,
      };
    }
  }

  function readSegments(summary: unknown) {
    return Array.isArray(toRecord(summary)["segments"])
      ? (toRecord(summary)["segments"] as unknown[]).map(toRecord)
      : [];
  }

  function segmentsOverlap(left: Record<string, unknown>, right: Record<string, unknown>) {
    const leftStart = asFiniteNumber(left["startSeconds"]);
    const leftEnd = asFiniteNumber(left["endSeconds"]);
    const rightStart = asFiniteNumber(right["startSeconds"]);
    const rightEnd = asFiniteNumber(right["endSeconds"]);
    if (leftStart === null || leftEnd === null || rightStart === null || rightEnd === null) {
      return false;
    }
    return leftStart <= rightEnd && rightStart <= leftEnd;
  }

  function countFreezeDuplicateOverlaps(freezeSummary: unknown, duplicateFrame: unknown) {
    const freezeSegments = readSegments(freezeSummary);
    const duplicateSegments = readSegments(duplicateFrame);
    return freezeSegments.filter(function (freezeSegment) {
      return duplicateSegments.some(function (duplicateSegment) {
        return segmentsOverlap(freezeSegment, duplicateSegment);
      });
    }).length;
  }

  function countFreezeGopBoundaryOverlaps(freezeSummary: unknown, gopStructure: unknown) {
    const freezeSegments = readSegments(freezeSummary);
    const keyFrameTimes = Array.isArray(toRecord(gopStructure)["keyFrameTimes"])
      ? (toRecord(gopStructure)["keyFrameTimes"] as unknown[])
          .map(asFiniteNumber)
          .filter((entry): entry is number => entry !== null)
      : [];
    return freezeSegments.filter(function (freezeSegment) {
      const startSeconds = asFiniteNumber(freezeSegment["startSeconds"]);
      const endSeconds = asFiniteNumber(freezeSegment["endSeconds"]);
      if (startSeconds === null && endSeconds === null) {
        return false;
      }
      return keyFrameTimes.some(function (keyFrameTime) {
        return (
          (startSeconds !== null && Math.abs(keyFrameTime - startSeconds) <= 0.35) ||
          (endSeconds !== null && Math.abs(keyFrameTime - endSeconds) <= 0.35)
        );
      });
    }).length;
  }

  function buildFreezeAttribution(
    freezeSummary: unknown,
    duplicateFrame: unknown,
    frameCadence: unknown,
    compressionSignature: unknown,
    gopStructure: unknown,
    opticalFlow: unknown
  ) {
    const freezeCount = asFiniteNumber(toRecord(freezeSummary)["count"]) || 0;
    const duplicateFrameRecord = toRecord(duplicateFrame);
    const frameCadenceRecord = toRecord(frameCadence);
    const compressionRecord = toRecord(compressionSignature);
    const duplicateCount = asFiniteNumber(duplicateFrameRecord["exactDuplicateFrameCount"]) || 0;
    const duplicateRatio = asFiniteNumber(duplicateFrameRecord["exactDuplicateFrameRatio"]) || 0;
    const cadenceDriftRatio = asFiniteNumber(frameCadenceRecord["cadenceDriftRatio"]) || 0;
    const compressionRiskLevel = asNonEmptyString(compressionRecord["riskLevel"]) || "low";
    const opticalFlowRecord = toRecord(opticalFlow);
    const opticalFlowClass = asNonEmptyString(opticalFlowRecord["movementClass"]);
    const duplicateOverlapCount = countFreezeDuplicateOverlaps(freezeSummary, duplicateFrame);
    const gopBoundaryOverlapCount = countFreezeGopBoundaryOverlaps(freezeSummary, gopStructure);
    const reasons: string[] = [];
    let classification = "baseline";
    let confidence = "low";

    if (freezeCount > 0 && (duplicateOverlapCount > 0 || duplicateRatio >= 0.35)) {
      classification = "transport_duplicate";
      confidence =
        duplicateOverlapCount >= Math.max(1, Math.ceil(freezeCount / 2)) ? "high" : "medium";
      reasons.push("freeze interval overlaps repeated decoded-frame hashes");
    } else if (freezeCount > 0 && opticalFlowClass === "localized_subject_motion") {
      classification = "localized_motion_during_background_freeze";
      confidence = asNonEmptyString(opticalFlowRecord["confidence"]) || "low";
      reasons.push("subject/ROI motion separates from a quieter background sample");
    } else if (freezeCount > 0 && opticalFlowClass === "background_or_camera_motion") {
      classification = "background_motion_with_subject_stall";
      confidence = asNonEmptyString(opticalFlowRecord["confidence"]) || "low";
      reasons.push("background motion energy exceeds the subject/ROI sample");
    } else if (freezeCount > 0 && cadenceDriftRatio >= 0.18) {
      classification = "cadence_drift";
      confidence = "medium";
      reasons.push("frame interval cadence drift is elevated");
    } else if (
      freezeCount > 0 &&
      (compressionRiskLevel === "high" || compressionRiskLevel === "medium")
    ) {
      classification = "compression_artifact_possible";
      confidence = compressionRiskLevel === "high" ? "medium" : "low";
      reasons.push("compression signature is elevated around the sampled window");
    } else if (freezeCount > 0) {
      classification = "content_or_stream_freeze_uncertain";
      confidence = "low";
      reasons.push("freezedetect reported intervals without a measured duplicate-frame cause");
    } else if (duplicateCount > 0) {
      classification = "duplicate_without_freezedetect";
      confidence = duplicateRatio >= 0.15 ? "medium" : "low";
      reasons.push("decoded duplicate frames were measured below the freeze-duration threshold");
    } else if (compressionRiskLevel === "high") {
      classification = "compression_risk_baseline";
      confidence = "low";
      reasons.push("compression signature is elevated without a freeze interval");
    }

    if (gopBoundaryOverlapCount > 0) {
      reasons.push("freeze boundary is near a keyframe/GOP boundary");
    }
    if (opticalFlowClass !== null && opticalFlowClass !== "insufficient_motion_samples") {
      reasons.push(`motion energy split: ${opticalFlowClass}`);
    }

    return {
      cadenceDriftRatio: roundMetric(cadenceDriftRatio),
      classification,
      compressionRiskLevel,
      confidence,
      duplicateFrameRatio: roundMetric(duplicateRatio),
      duplicateOverlapCount,
      freezeCount,
      gopBoundaryOverlapCount,
      opticalFlowClass,
      opticalFlowConfidence: asNonEmptyString(opticalFlowRecord["confidence"]),
      subjectBackgroundMotionRatio: roundMetric(
        asFiniteNumber(opticalFlowRecord["subjectBackgroundMotionRatio"]),
        3
      ),
      reasons,
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
    const timeoutMs = resolveStructureProbeTimeoutMs(target, timeScope);
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
        timeoutMs,
      })
    );
    const black = offsetDetectionLogSummary(parseBlackDetectLog(stderr), timeScope);
    const freeze = offsetDetectionLogSummary(parseFreezeDetectLog(stderr), timeScope);
    const duplicateFrame = await runDuplicateFrameProbe(
      runtime,
      project,
      requestId,
      jobId,
      targetPath,
      timeScope,
      timeoutMs
    );
    const frameMetadata = await runFrameMetadataProbe(
      runtime,
      project,
      requestId,
      jobId,
      targetPath,
      target,
      timeScope,
      timeoutMs
    );
    const opticalFlow = await runOpticalFlowProbe(
      runtime,
      project,
      requestId,
      jobId,
      targetPath,
      target,
      options,
      timeScope,
      timeoutMs
    );
    return {
      black,
      compressionSignature: frameMetadata.compressionSignature,
      duplicateFrame,
      frameCadence: frameMetadata.frameCadence,
      freeze,
      freezeAttribution: buildFreezeAttribution(
        freeze,
        duplicateFrame,
        frameMetadata.frameCadence,
        frameMetadata.compressionSignature,
        frameMetadata.gopStructure,
        opticalFlow
      ),
      gopStructure: frameMetadata.gopStructure,
      opticalFlow,
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
