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

export function createAudioAnalysisProbeRuntime(deps: AnalysisProbesDeps) {
  const asNonEmptyString = deps.asNonEmptyString;
  const readTextFile = deps.readTextFile;
  const runProfileTool = deps.runProfileTool;
  const buildProsodySummaryFromCsv = deps.buildProsodySummaryFromCsv;
  const parseBlackDetectLog = deps.parseBlackDetectLog;
  const parseFreezeDetectLog = deps.parseFreezeDetectLog;
  const parseSilenceDetectLog = deps.parseSilenceDetectLog;
  const parseVolumeDetectLog = deps.parseVolumeDetectLog;

  function resolveOpenSmileProsodyRuntime(runtime: Record<string, unknown>) {
    const configDir = getAudioAnalysisOpenSmileConfigDir(runtime as any);
    const configPath = getAudioAnalysisOpenSmileConfigPath(runtime as any, "prosodyAcf.conf");
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
        target["path"] as string,
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
    if (asNonEmptyString(contourCsv) === null) {
      throw new Error("openSMILE did not produce a prosody contour CSV.");
    }

    return {
      contourCsv: contourCsv,
      contourPath: contourPath,
      prosodySummary: buildProsodySummaryFromCsv(contourCsv as string),
    };
  }

  async function runVideoStructureProbe(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    target: Record<string, unknown>
  ) {
    const stderr = asNonEmptyString(
      (
        await runProfileTool(runtime, {
          requestId: requestId,
          jobId: jobId,
          toolId: "ffmpeg",
          cwd: getProjectProfileDir(runtime as any, project as any),
          args: [
            "-hide_banner",
            "-i",
            target["path"] as string,
            "-vf",
            "blackdetect=d=0.25:pix_th=0.10,freezedetect=n=-40dB:d=0.4",
            "-an",
            "-f",
            "null",
            "-",
          ],
          timeoutMs: 120_000,
        })
      )["stderr"]
    );
    return {
      black: parseBlackDetectLog(stderr),
      freeze: parseFreezeDetectLog(stderr),
    };
  }

  async function runAudioStructureProbe(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    target: Record<string, unknown>
  ) {
    const silencePayload = await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime as any, project as any),
      args: [
        "-hide_banner",
        "-i",
        target["path"] as string,
        "-af",
        "silencedetect=n=-38dB:d=0.35",
        "-f",
        "null",
        "-",
      ],
      timeoutMs: 120_000,
    });
    const volumePayload = await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime as any, project as any),
      args: ["-hide_banner", "-i", target["path"] as string, "-af", "volumedetect", "-f", "null", "-"],
      timeoutMs: 120_000,
    });

    return {
      silence: parseSilenceDetectLog(silencePayload["stderr"]),
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
