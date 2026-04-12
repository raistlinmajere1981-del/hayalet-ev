import {
  getAudioAnalysisOpenSmileConfigDir,
  getAudioAnalysisOpenSmileConfigPath,
  getProjectProfileDir
} from "../../../shared/host/project-paths.js";
export function createAudioAnalysisProbeRuntime(deps) {
  const asNonEmptyString = deps.asNonEmptyString;
  const toRecord = deps.toRecord;
  const readTextFile = deps.readTextFile;
  const runProfileTool = deps.runProfileTool;
  const buildProsodySummaryFromCsv = deps.buildProsodySummaryFromCsv;
  const parseBlackDetectLog = deps.parseBlackDetectLog;
  const parseFreezeDetectLog = deps.parseFreezeDetectLog;
  const parseSilenceDetectLog = deps.parseSilenceDetectLog;
  const parseVolumeDetectLog = deps.parseVolumeDetectLog;
  function toPackageToolsRuntime(runtime) {
    return { packageToolsDir: runtime["packageToolsDir"] };
  }
  function toProjectPathRuntime(runtime) {
    const pathsRecord = toRecord(runtime["paths"]);
    const projectsDir = asNonEmptyString(pathsRecord["projectsDir"]);
    if (projectsDir === null) {
      throw new Error("Audio analysis runtime is missing a projects directory.");
    }
    return {
      paths: {
        projectsDir
      }
    };
  }
  function toProjectSlugRecord(project) {
    const slug = asNonEmptyString(project["slug"]);
    if (slug === null) {
      throw new Error("Audio analysis project is missing a slug.");
    }
    return { slug };
  }
  function readTargetPath(target) {
    const path = asNonEmptyString(target["path"]);
    if (path === null) {
      throw new Error("Audio analysis target is missing a file path.");
    }
    return path;
  }
  function readProfileToolStderr(result) {
    return asNonEmptyString(result["stderr"]);
  }
  function resolveOpenSmileProsodyRuntime(runtime) {
    const packageToolsRuntime = toPackageToolsRuntime(runtime);
    const configDir = getAudioAnalysisOpenSmileConfigDir(packageToolsRuntime);
    const configPath = getAudioAnalysisOpenSmileConfigPath(packageToolsRuntime, "prosodyAcf.conf");
    if (configDir === null || configPath === null) {
      return null;
    }
    return {
      configDir,
      configPath
    };
  }
  async function runOpenSmileProsodyExtraction(runtime, _project, requestId, jobId, target, artifactBase, moduleOutputDir, outputLabel) {
    const openSmileRuntime = resolveOpenSmileProsodyRuntime(runtime);
    if (openSmileRuntime === null) {
      throw new Error("Room-local openSMILE config package is unavailable on this runtime.");
    }
    const contourPath = `${moduleOutputDir}/${artifactBase}-${outputLabel}.csv`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
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
        "1"
      ],
      timeoutMs: 3 * 60 * 1e3
    });
    const contourCsv = await readTextFile(contourPath);
    const contourCsvText = asNonEmptyString(contourCsv);
    if (contourCsvText === null) {
      throw new Error("openSMILE did not produce a prosody contour CSV.");
    }
    return {
      contourCsv: contourCsvText,
      contourPath,
      prosodySummary: buildProsodySummaryFromCsv(contourCsvText)
    };
  }
  async function runVideoStructureProbe(runtime, project, requestId, jobId, target) {
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    const stderr = readProfileToolStderr(
      await runProfileTool(runtime, {
        requestId,
        jobId,
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
          "-"
        ],
        timeoutMs: 12e4
      })
    );
    return {
      black: parseBlackDetectLog(stderr),
      freeze: parseFreezeDetectLog(stderr)
    };
  }
  async function runAudioStructureProbe(runtime, project, requestId, jobId, target) {
    const projectPathRuntime = toProjectPathRuntime(runtime);
    const projectSlugRecord = toProjectSlugRecord(project);
    const targetPath = readTargetPath(target);
    const silencePayload = await runProfileTool(runtime, {
      requestId,
      jobId,
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
        "-"
      ],
      timeoutMs: 12e4
    });
    const volumePayload = await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(projectPathRuntime, projectSlugRecord),
      args: ["-hide_banner", "-i", targetPath, "-af", "volumedetect", "-f", "null", "-"],
      timeoutMs: 12e4
    });
    return {
      silence: parseSilenceDetectLog(silencePayload["stderr"]),
      volume: parseVolumeDetectLog(volumePayload["stderr"])
    };
  }
  return {
    resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe,
    runOpenSmileProsodyExtraction,
    runVideoStructureProbe
  };
}
