import { getAudioAnalysisProcessRootDir } from "../../../shared/host/project-paths.js";
function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
function requireTargetPath(target) {
  const targetPath = asNonEmptyString(target.path);
  if (targetPath === null) {
    throw new Error("Audio analysis target path is required before generating process artifacts.");
  }
  return targetPath;
}
export function createAudioAnalysisProcessRunnerSupport(deps) {
  const {
    clone,
    createProcessArtifact,
    ensureRuntimeDirectory,
    parseAspectralStatsText,
    readTextFile,
    runProfileTool,
    sanitizeFileSegment,
    writeJsonFile
  } = deps;
  function getProcessRootDir(runtime, project) {
    return getAudioAnalysisProcessRootDir(
      runtime,
      project
    );
  }
  function getModuleProcessDir(runtime, project, moduleId) {
    const processRootDir = getProcessRootDir(runtime, project);
    return `${processRootDir}/${sanitizeFileSegment(moduleId, "audio-module")}`;
  }
  async function generateProcessSpectrogram(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId) {
    return generateProcessSpectrogramFromInputPath(
      runtime,
      project,
      requestId,
      jobId,
      requireTargetPath(target),
      artifactBase,
      outputDir,
      moduleId,
      "Spectrogram"
    );
  }
  async function generateProcessSpectrogramFromInputPath(runtime, project, requestId, jobId, inputPath, artifactBase, outputDir, moduleId, label, metadata = {}) {
    const processRootDir = getProcessRootDir(runtime, project);
    const outputPath = `${outputDir}/${artifactBase}-spectrogram.png`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: processRootDir,
      args: [
        "-y",
        "-i",
        inputPath,
        "-lavfi",
        "showspectrumpic=s=1600x440:legend=0",
        "-frames:v",
        "1",
        outputPath
      ],
      timeoutMs: 9e4
    });
    return createProcessArtifact(moduleId, "spectrogram", outputPath, label, metadata);
  }
  async function generateProcessWaveform(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId) {
    const processRootDir = getProcessRootDir(runtime, project);
    const targetPath = requireTargetPath(target);
    const outputPath = `${outputDir}/${artifactBase}-waveform.png`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: processRootDir,
      args: [
        "-y",
        "-i",
        targetPath,
        "-filter_complex",
        "showwavespic=s=1600x440:split_channels=0",
        "-frames:v",
        "1",
        outputPath
      ],
      timeoutMs: 9e4
    });
    return createProcessArtifact(moduleId, "waveform", outputPath, "Waveform", {});
  }
  async function generateSpectralDescriptorArtifact(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId) {
    const processRootDir = getProcessRootDir(runtime, project);
    const targetPath = requireTargetPath(target);
    const textPath = `${outputDir}/${artifactBase}-spectral.txt`;
    const jsonPath = `${outputDir}/${artifactBase}-spectral.json`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: processRootDir,
      args: [
        "-y",
        "-i",
        targetPath,
        "-af",
        `aspectralstats=measure=centroid+rolloff+flatness+flux,ametadata=mode=print:file=${textPath}:direct=1`,
        "-f",
        "null",
        "-"
      ],
      timeoutMs: 9e4
    });
    const descriptorSummary = parseAspectralStatsText(await readTextFile(textPath));
    await writeJsonFile(jsonPath, {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      target: clone(target),
      descriptorSummary
    });
    return createProcessArtifact(
      moduleId,
      "spectral-descriptors",
      jsonPath,
      "Spectral Descriptor Summary",
      {
        descriptorSummary
      }
    );
  }
  async function generateFilteredAudioArtifact(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId, filterGraph, label, metadata, outputExtension = "wav") {
    const processRootDir = getProcessRootDir(runtime, project);
    const targetPath = requireTargetPath(target);
    const safeExtension = asNonEmptyString(outputExtension)?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "wav";
    const outputPath = `${outputDir}/${artifactBase}.${safeExtension}`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: processRootDir,
      args: ["-y", "-i", targetPath, "-af", filterGraph, outputPath],
      timeoutMs: 12e4
    });
    return createProcessArtifact(moduleId, "filtered-audio", outputPath, label, {
      ...metadata,
      filterGraph
    });
  }
  return {
    ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir) {
      return Promise.all([
        ensureRuntimeDirectory(getProcessRootDir(runtime, project), requestId),
        ensureRuntimeDirectory(moduleOutputDir, requestId)
      ]);
    },
    generateProcessSpectrogram,
    generateProcessSpectrogramFromInputPath,
    generateProcessWaveform,
    generateSpectralDescriptorArtifact,
    generateFilteredAudioArtifact,
    getModuleProcessDir
  };
}
