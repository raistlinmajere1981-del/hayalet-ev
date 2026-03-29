import {
  getAudioAnalysisDiarizationDir,
  getAudioAnalysisDiarizationScriptPath,
  getAudioAnalysisProcessRootDir,
} from "../../../shared/host/project-paths.js";

export function createAudioAnalysisSpeakerDiarizationModelRunner(deps) {
  const {
    asNonEmptyString,
    asNumber,
    createProcessArtifact,
    createProcessFinding,
    ensureProcessRuntimeDirectories,
    readJsonFile,
    runProfileTool,
    sanitizeFileSegment,
    toRecord,
  } = deps;

  return async function runSpeakerDiarizationAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  ) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);

    const diarizationScriptPath = getAudioAnalysisDiarizationScriptPath(runtime);
    if (diarizationScriptPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local diarization helper script is unavailable on this runtime."],
        status: "blocked",
        summary: "Speaker diarization helper assets are missing from the room package.",
      };
    }

    const preparedInputBase = sanitizeFileSegment(`${artifactBase}-speaker-input`, "speaker-input");
    const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-speaker-diarization.json`;

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: ["-y", "-i", target.path, "-vn", "-ac", "1", "-ar", "16000", preparedInputPath],
      timeoutMs: 4 * 60 * 1000,
    });

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "pyaudioanalysis",
      cwd:
        getAudioAnalysisDiarizationDir(runtime) || getAudioAnalysisProcessRootDir(runtime, project),
      args: [diarizationScriptPath, "--input", preparedInputPath, "--output", summaryPath],
      timeoutMs: 12 * 60 * 1000,
    });

    const summaryPayload = toRecord(await readJsonFile(summaryPath));
    const segments = Array.isArray(summaryPayload.segments) ? summaryPayload.segments.map(toRecord) : [];
    const fallbackApplied = summaryPayload.fallbackApplied === true;
    const effectiveNumSpeakers = asNumber(summaryPayload.effectiveNumSpeakers);
    const diarizationSummary = {
      speakerCount: typeof summaryPayload.speakerCount === "number" ? summaryPayload.speakerCount : null,
      segmentCount: segments.length,
      durationSeconds: asNumber(summaryPayload.durationSeconds),
      purityCluster: asNumber(summaryPayload.purityCluster),
      puritySpeaker: asNumber(summaryPayload.puritySpeaker),
      effectiveNumSpeakers: effectiveNumSpeakers,
      speakerCountMode: asNonEmptyString(summaryPayload.speakerCountMode),
      fallbackApplied: fallbackApplied,
    };
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "speaker-segments-summary",
      summaryPath,
      "Speaker Diarization Summary",
      {
        diarizationSummary: diarizationSummary,
        segments: segments,
      }
    );
    const artifacts = [summaryArtifact].filter(Boolean);
    const artifactIds = artifacts.map(function (artifact) {
      return artifact.id;
    });
    const detailParts = [
      typeof diarizationSummary.speakerCount === "number"
        ? `${diarizationSummary.speakerCount} speakers`
        : null,
      `${segments.length} segments`,
      typeof diarizationSummary.durationSeconds === "number"
        ? `${Number(diarizationSummary.durationSeconds).toFixed(1)}s analyzed`
        : null,
    ].filter(Boolean);
    const fallbackWarning =
      fallbackApplied
        ? "pyAudioAnalysis HMM smoothing failed for this clip, so the room-local diarization helper fell back to a KMeans-only segmentation path."
        : null;
    const reviewWarning =
      "pyAudioAnalysis diarization is a fully local heuristic pipeline; speaker boundaries should be reviewed manually.";
    const warningText = [fallbackWarning, reviewWarning].filter(Boolean).join(" ");

    return {
      findings: [
        createProcessFinding(
          moduleId,
          "descriptor",
          "low",
          "low",
          "Speaker timeline generated",
          detailParts.length > 0
            ? `The local diarization pipeline produced ${detailParts.join(", ")}. ${warningText}`
            : `The local diarization pipeline produced a speaker timeline. ${warningText}`,
          segments.length,
          artifactIds
        ),
      ],
      artifacts: artifacts,
      warnings: [fallbackWarning, reviewWarning].filter(Boolean),
      status: "ready",
      summary: "Speaker diarization generated a local speaker timeline for the active audio target.",
    };
  };
}
