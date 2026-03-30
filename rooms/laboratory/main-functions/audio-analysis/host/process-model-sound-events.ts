import {
  getAudioAnalysisProcessRootDir,
  getAudioAnalysisYamnetDir,
  getAudioAnalysisYamnetScriptPath,
} from "../../../shared/host/project-paths.js";

export function createAudioAnalysisSoundEventsModelRunner(deps: any) {
  const {
    asNonEmptyString,
    createProcessArtifact,
    createProcessFinding,
    ensureProcessRuntimeDirectories,
    readJsonFile,
    runProfileTool,
    toRecord,
  } = deps;

  return async function runSoundEventsAudioAnalyzer(
    runtime: any,
    project: any,
    requestId: any,
    jobId: any,
    target: any,
    artifactBase: any,
    moduleOutputDir: any,
    moduleId: any
  ) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);

    const yamnetScriptPath = getAudioAnalysisYamnetScriptPath(runtime);
    if (yamnetScriptPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local YAMNet helper script is unavailable on this runtime."],
        status: "blocked",
        summary: "YAMNet helper assets are missing from the room package.",
      };
    }

    const wavPath = `${moduleOutputDir}/${artifactBase}-yamnet.wav`;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-sound-events.json`;

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: ["-y", "-i", target.path, "-vn", "-ac", "1", "-ar", "16000", wavPath],
      timeoutMs: 3 * 60 * 1000,
    });

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "yamnet",
      cwd: getAudioAnalysisYamnetDir(runtime) || getAudioAnalysisProcessRootDir(runtime, project),
      args: [
        yamnetScriptPath,
        "--input",
        wavPath,
        "--output",
        summaryPath,
        "--top-k",
        "8",
        "--threshold",
        "0.15",
      ],
      timeoutMs: 8 * 60 * 1000,
    });

    const summaryPayload = toRecord(await readJsonFile(summaryPath));
    const topClasses = Array.isArray(summaryPayload.topClasses)
      ? summaryPayload.topClasses.map(toRecord)
      : [];
    const headline = topClasses[0] || null;
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "sound-events-summary",
      summaryPath,
      "Sound Events Summary",
      {
        topClasses: topClasses,
        modelVersion: asNonEmptyString(summaryPayload.modelVersion),
        classCount: topClasses.length,
      }
    );
    const artifacts = [summaryArtifact].filter(Boolean);
    const artifactIds = artifacts.map(function (artifact: any) {
      return artifact.id;
    });
    const warningText =
      asNonEmptyString(summaryPayload.warning) ||
      "YAMNet predictions are broad sound-event suggestions and should be reviewed manually.";

    return {
      findings:
        headline !== null
          ? [
              createProcessFinding(
                moduleId,
                "model",
                "low",
                typeof headline.score === "number" && headline.score >= 0.35 ? "medium" : "low",
                "Top sound event candidates captured",
                `Top class: ${headline.label || headline.className || "unknown"} (${typeof headline.score === "number" ? headline.score.toFixed(3) : "n/a"}). ${warningText}`,
                topClasses.length,
                artifactIds
              ),
            ]
          : [],
      artifacts: artifacts,
      warnings: [warningText],
      status: "ready",
      summary: "Sound event candidates were generated from the active audio target.",
    };
  };
}
