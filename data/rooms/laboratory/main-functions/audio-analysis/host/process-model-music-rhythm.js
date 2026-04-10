import {
  getAudioAnalysisMusicDir,
  getAudioAnalysisMusicScriptPath,
  getAudioAnalysisProcessRootDir
} from "../../../shared/host/project-paths.js";
function isNonNullString(value) {
  return typeof value === "string" && value.length > 0;
}
export function createAudioAnalysisMusicRhythmModelRunner(deps) {
  const {
    asNonEmptyString,
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
  function asMusicScriptRuntime(runtime) {
    return runtime;
  }
  function asProcessRootRuntime(runtime) {
    return runtime;
  }
  function asProcessRootProject(project) {
    return project;
  }
  return async function runMusicRhythmAudioAnalyzer(runtime, project, requestId, jobId, target, artifactBase, moduleOutputDir, moduleId) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);
    const targetPath = asNonEmptyString(toTargetRecord(target).path);
    if (targetPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Music analysis requires an audio target path before processing can start."],
        status: "blocked",
        summary: "Music analysis is waiting for a prepared audio target."
      };
    }
    const musicScriptPath = getAudioAnalysisMusicScriptPath(asMusicScriptRuntime(runtime));
    if (musicScriptPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local music analysis helper script is unavailable on this runtime."],
        status: "blocked",
        summary: "Music analysis helper assets are missing from the room package."
      };
    }
    const preparedInputBase = sanitizeFileSegment(`${artifactBase}-music-input`, "music-input");
    const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-music-analysis.json`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(
        asProcessRootRuntime(runtime),
        asProcessRootProject(project)
      ),
      args: ["-y", "-i", targetPath, "-vn", "-ac", "1", "-ar", "22050", preparedInputPath],
      timeoutMs: 4 * 60 * 1e3
    });
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "librosa",
      cwd: getAudioAnalysisMusicDir(asMusicScriptRuntime(runtime)) || getAudioAnalysisProcessRootDir(
        asProcessRootRuntime(runtime),
        asProcessRootProject(project)
      ),
      args: [musicScriptPath, "--input", preparedInputPath, "--output", summaryPath],
      timeoutMs: 10 * 60 * 1e3
    });
    const summaryPayload = toSummaryPayload(await readJsonFile(summaryPath));
    const musicSummary = toRecord(summaryPayload.musicSummary);
    const essentiaSummary = toRecord(summaryPayload.essentia);
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "music-analysis-summary",
      summaryPath,
      "Music Analysis Summary",
      {
        musicSummary,
        essentia: essentiaSummary
      }
    );
    const artifacts = [summaryArtifact];
    const artifactIds = getArtifactIds(artifacts);
    const detailParts = [
      typeof musicSummary["tempoBpm"] === "number" ? `${Number(musicSummary["tempoBpm"]).toFixed(1)} BPM` : null,
      typeof musicSummary["dominantPitchClass"] === "string" && musicSummary["dominantPitchClass"].trim() !== "" ? `dominant pitch class ${musicSummary["dominantPitchClass"]}` : null,
      typeof musicSummary["beatCount"] === "number" ? `${musicSummary["beatCount"]} beat markers` : null
    ].filter(Boolean);
    const warnings = [];
    if (asNonEmptyString(essentiaSummary["error"]) !== null) {
      warnings.push(asNonEmptyString(essentiaSummary["error"]));
    }
    warnings.push(
      "Music and rhythm analysis is descriptor-driven; tonal summaries should be treated as guidance rather than a full musicology readout."
    );
    return {
      findings: [
        createProcessFinding(
          moduleId,
          "descriptor",
          "low",
          essentiaSummary["available"] === true ? "medium" : "low",
          "Music descriptor summary generated",
          detailParts.length > 0 ? `The music analysis helper produced ${detailParts.join(", ")} for the active target.` : "The music analysis helper produced a descriptor summary for the active target.",
          detailParts.length,
          artifactIds
        )
      ],
      artifacts,
      warnings: warnings.filter(isNonNullString),
      status: "ready",
      summary: "Music and rhythm descriptors were generated for the active audio target."
    };
  };
}
