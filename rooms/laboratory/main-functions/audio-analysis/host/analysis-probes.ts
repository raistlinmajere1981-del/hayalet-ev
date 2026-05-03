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
    target: Record<string, unknown>
  ) {
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    const stderr = readProfileToolStderr(
      await runProfileTool(runtime, {
        requestId: requestId,
        jobId: jobId,
        toolId: "ffmpeg",
        cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
        args: [
          "-hide_banner",
          "-i",
          readTargetPath(target),
          "-vf",
          "blackdetect=d=0.25:pix_th=0.10,freezedetect=n=-40dB:d=0.4",
          "-an",
          "-f",
          "null",
          "-",
        ],
        timeoutMs: 120_000,
      })
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
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    const targetPath = readTargetPath(target);
    const silencePayload = await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
      args: [
        "-hide_banner",
        "-i",
        targetPath,
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
      cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
      args: ["-hide_banner", "-i", targetPath, "-af", "volumedetect", "-f", "null", "-"],
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
