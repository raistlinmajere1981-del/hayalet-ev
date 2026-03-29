// @ts-nocheck
import {
  getAudioAnalysisOpenSmileConfigDir,
  getAudioAnalysisOpenSmileConfigPath,
  getProjectProfileDir,
} from "../../../shared/host/project-paths.js";

export function createAudioAnalysisProbeRuntime(deps) {
  const asNonEmptyString = deps.asNonEmptyString;
  const readTextFile = deps.readTextFile;
  const runProfileTool = deps.runProfileTool;
  const buildProsodySummaryFromCsv = deps.buildProsodySummaryFromCsv;
  const parseBlackDetectLog = deps.parseBlackDetectLog;
  const parseFreezeDetectLog = deps.parseFreezeDetectLog;
  const parseSilenceDetectLog = deps.parseSilenceDetectLog;
  const parseVolumeDetectLog = deps.parseVolumeDetectLog;

  function resolveOpenSmileProsodyRuntime(runtime) {
    const configDir = getAudioAnalysisOpenSmileConfigDir(runtime);
    const configPath = getAudioAnalysisOpenSmileConfigPath(runtime, "prosodyAcf.conf");
    if (configDir === null || configPath === null) {
      return null;
    }
    return {
      configDir: configDir,
      configPath: configPath,
    };
  }

  async function runOpenSmileProsodyExtraction(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    outputLabel
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
        target.path,
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
      prosodySummary: buildProsodySummaryFromCsv(contourCsv),
    };
  }

  async function runVideoStructureProbe(runtime, project, requestId, jobId, target) {
    const stderr = asNonEmptyString(
      (
        await runProfileTool(runtime, {
          requestId: requestId,
          jobId: jobId,
          toolId: "ffmpeg",
          cwd: getProjectProfileDir(runtime, project),
          args: [
            "-hide_banner",
            "-i",
            target.path,
            "-vf",
            "blackdetect=d=0.25:pix_th=0.10,freezedetect=n=-40dB:d=0.4",
            "-an",
            "-f",
            "null",
            "-",
          ],
          timeoutMs: 120_000,
        })
      ).stderr
    );
    return {
      black: parseBlackDetectLog(stderr),
      freeze: parseFreezeDetectLog(stderr),
    };
  }

  async function runAudioStructureProbe(runtime, project, requestId, jobId, target) {
    const silencePayload = await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: ["-hide_banner", "-i", target.path, "-af", "silencedetect=n=-38dB:d=0.35", "-f", "null", "-"],
      timeoutMs: 120_000,
    });
    const volumePayload = await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: ["-hide_banner", "-i", target.path, "-af", "volumedetect", "-f", "null", "-"],
      timeoutMs: 120_000,
    });

    return {
      silence: parseSilenceDetectLog(silencePayload.stderr),
      volume: parseVolumeDetectLog(volumePayload.stderr),
    };
  }

  return {
    resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe,
    runOpenSmileProsodyExtraction,
    runVideoStructureProbe,
  };
}
