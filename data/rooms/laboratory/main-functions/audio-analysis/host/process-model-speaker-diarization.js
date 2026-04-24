import {
  getAudioAnalysisDiarizationDir,
  getAudioAnalysisDiarizationScriptPath,
  getAudioAnalysisProcessRootDir
} from "../../../shared/host/project-paths.js";
function isNonNullString(value) {
  return typeof value === "string" && value.length > 0;
}
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
    toRecord
  } = deps;
  function toTargetRecord(value) {
    return toRecord(value);
  }
  function toSummaryPayload(value) {
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
  return async function runSpeakerDiarizationAudioAnalyzer(runtime, project, requestId, jobId, target, artifactBase, moduleOutputDir, moduleId) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);
    const targetPath = asNonEmptyString(toTargetRecord(target).path);
    if (targetPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: [
          "Speaker diarization requires an audio target path before processing can start."
        ],
        status: "blocked",
        summary: "Speaker diarization is waiting for a prepared audio target."
      };
    }
    const diarizationScriptPath = getAudioAnalysisDiarizationScriptPath(
      runtime
    );
    if (diarizationScriptPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local diarization helper script is unavailable on this runtime."],
        status: "blocked",
        summary: "Speaker diarization helper assets are missing from the room package."
      };
    }
    const preparedInputBase = sanitizeFileSegment(`${artifactBase}-speaker-input`, "speaker-input");
    const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-speaker-diarization.json`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProcessRootDir(runtime, project),
      args: ["-y", "-i", targetPath, "-vn", "-ac", "1", "-ar", "16000", preparedInputPath],
      timeoutMs: 4 * 60 * 1e3
    });
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "pyaudioanalysis",
      cwd: getAudioAnalysisDiarizationDir(runtime) || getProcessRootDir(runtime, project),
      args: [diarizationScriptPath, "--input", preparedInputPath, "--output", summaryPath],
      timeoutMs: 12 * 60 * 1e3
    });
    const summaryPayload = toSummaryPayload(await readJsonFile(summaryPath));
    const segments = Array.isArray(summaryPayload.segments) ? summaryPayload.segments.map(toRecord) : [];
    const fallbackApplied = summaryPayload.fallbackApplied === true;
    const effectiveNumSpeakers = asNumber(summaryPayload.effectiveNumSpeakers);
    const diarizationSummary = {
      speakerCount: typeof summaryPayload.speakerCount === "number" ? summaryPayload.speakerCount : null,
      segmentCount: segments.length,
      durationSeconds: asNumber(summaryPayload.durationSeconds),
      purityCluster: asNumber(summaryPayload.purityCluster),
      puritySpeaker: asNumber(summaryPayload.puritySpeaker),
      effectiveNumSpeakers,
      speakerCountMode: asNonEmptyString(summaryPayload.speakerCountMode),
      fallbackApplied
    };
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "speaker-segments-summary",
      summaryPath,
      "Speaker Diarization Summary",
      {
        diarizationSummary,
        segments
      }
    );
    const artifacts = [summaryArtifact];
    const artifactIds = getArtifactIds(artifacts);
    const detailParts = [
      typeof diarizationSummary.speakerCount === "number" ? `${diarizationSummary.speakerCount} speakers` : null,
      `${segments.length} segments`,
      typeof diarizationSummary.durationSeconds === "number" ? `${Number(diarizationSummary.durationSeconds).toFixed(1)}s analyzed` : null
    ].filter(Boolean);
    const fallbackWarning = fallbackApplied ? "The packaged pyAudioAnalysis diarization path was unavailable for this clip, so the room-local helper used a heuristic speaker segmentation fallback." : null;
    const reviewWarning = "pyAudioAnalysis diarization is a fully local heuristic pipeline; speaker boundaries should be reviewed manually.";
    const warningText = [fallbackWarning, reviewWarning].filter(Boolean).join(" ");
    const warnings = [fallbackWarning, reviewWarning].filter(isNonNullString);
    return {
      findings: [
        createProcessFinding(
          moduleId,
          "descriptor",
          "low",
          "low",
          "Speaker timeline generated",
          detailParts.length > 0 ? `The local diarization pipeline produced ${detailParts.join(", ")}. ${warningText}` : `The local diarization pipeline produced a speaker timeline. ${warningText}`,
          segments.length,
          artifactIds
        )
      ],
      artifacts,
      warnings,
      status: "ready",
      summary: "Speaker diarization generated a local speaker timeline for the active audio target."
    };
  };
}
