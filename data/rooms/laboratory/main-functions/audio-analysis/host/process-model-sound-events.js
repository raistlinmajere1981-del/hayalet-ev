import {
  getAudioAnalysisProcessRootDir,
  getAudioAnalysisYamnetDir,
  getAudioAnalysisYamnetScriptPath
} from "../../../shared/host/project-paths.js";
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.isFinite(Number(value)) ? Number(value) : null;
}
function isNonNullString(value) {
  return typeof value === "string" && value.length > 0;
}
export function createAudioAnalysisSoundEventsModelRunner(deps) {
  const {
    asNonEmptyString,
    createProcessArtifact,
    createProcessFinding,
    ensureProcessRuntimeDirectories,
    readJsonFile,
    runProfileTool,
    toRecord
  } = deps;
  function toTargetRecord(value) {
    return toRecord(value);
  }
  function toSummaryPayload(value) {
    return toRecord(value);
  }
  function toSoundEventClassRecord(value) {
    return toRecord(value);
  }
  function getArtifactIds(artifacts) {
    return artifacts.map(function(artifact) {
      return asNonEmptyString(artifact.id);
    }).filter(isNonNullString);
  }
  function getProcessRootDir(runtime, project) {
    return getAudioAnalysisProcessRootDir(
      runtime,
      project
    );
  }
  return async function runSoundEventsAudioAnalyzer(runtime, project, requestId, jobId, target, artifactBase, moduleOutputDir, moduleId) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);
    const targetPath = asNonEmptyString(toTargetRecord(target).path);
    if (targetPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: [
          "Sound event analysis requires an audio target path before processing can start."
        ],
        status: "blocked",
        summary: "Sound event analysis is waiting for a prepared audio target."
      };
    }
    const yamnetScriptPath = getAudioAnalysisYamnetScriptPath(
      runtime
    );
    if (yamnetScriptPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local YAMNet helper script is unavailable on this runtime."],
        status: "blocked",
        summary: "YAMNet helper assets are missing from the room package."
      };
    }
    const wavPath = `${moduleOutputDir}/${artifactBase}-yamnet.wav`;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-sound-events.json`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProcessRootDir(runtime, project),
      args: ["-y", "-i", targetPath, "-vn", "-ac", "1", "-ar", "16000", wavPath],
      timeoutMs: 3 * 60 * 1e3
    });
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "yamnet",
      cwd: getAudioAnalysisYamnetDir(runtime) || getProcessRootDir(runtime, project),
      args: [
        yamnetScriptPath,
        "--input",
        wavPath,
        "--output",
        summaryPath,
        "--top-k",
        "8",
        "--threshold",
        "0.15"
      ],
      timeoutMs: 8 * 60 * 1e3
    });
    const summaryPayload = toSummaryPayload(await readJsonFile(summaryPath));
    const topClasses = Array.isArray(summaryPayload.topClasses) ? summaryPayload.topClasses.map(toSoundEventClassRecord) : [];
    const headline = topClasses[0] || null;
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "sound-events-summary",
      summaryPath,
      "Sound Events Summary",
      {
        topClasses,
        modelVersion: asNonEmptyString(summaryPayload.modelVersion),
        classCount: topClasses.length
      }
    );
    const artifacts = [summaryArtifact];
    const artifactIds = getArtifactIds(artifacts);
    const warningText = asNonEmptyString(summaryPayload.warning) || "YAMNet predictions are broad sound-event suggestions and should be reviewed manually.";
    return {
      findings: headline !== null ? [
        createProcessFinding(
          moduleId,
          "model",
          "low",
          (asNumber(headline.score) ?? 0) >= 0.35 ? "medium" : "low",
          "Top sound event candidates captured",
          `Top class: ${asNonEmptyString(headline.label) || asNonEmptyString(headline.className) || "unknown"} (${asNumber(headline.score)?.toFixed(3) ?? "n/a"}). ${warningText}`,
          topClasses.length,
          artifactIds
        )
      ] : [],
      artifacts,
      warnings: [warningText],
      status: "ready",
      summary: "Sound event candidates were generated from the active audio target."
    };
  };
}
