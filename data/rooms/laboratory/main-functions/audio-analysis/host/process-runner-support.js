import { getAudioAnalysisProcessRootDir } from "../../../shared/host/project-paths.js";
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
  function getModuleProcessDir(runtime, project, moduleId) {
    return `${getAudioAnalysisProcessRootDir(runtime, project)}/${sanitizeFileSegment(moduleId, "audio-module")}`;
  }
  async function generateProcessSpectrogram(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId) {
    const outputPath = `${outputDir}/${artifactBase}-spectrogram.png`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: ["-y", "-i", target.path, "-lavfi", "showspectrumpic=s=1600x440:legend=0", "-frames:v", "1", outputPath],
      timeoutMs: 9e4
    });
    return createProcessArtifact(moduleId, "spectrogram", outputPath, "Spectrogram", {});
  }
  async function generateProcessWaveform(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId) {
    const outputPath = `${outputDir}/${artifactBase}-waveform.png`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: [
        "-y",
        "-i",
        target.path,
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
    const textPath = `${outputDir}/${artifactBase}-spectral.txt`;
    const jsonPath = `${outputDir}/${artifactBase}-spectral.json`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: [
        "-y",
        "-i",
        target.path,
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
    return createProcessArtifact(moduleId, "spectral-descriptors", jsonPath, "Spectral Descriptor Summary", {
      descriptorSummary
    });
  }
  return {
    ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir) {
      return Promise.all([
        ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId),
        ensureRuntimeDirectory(moduleOutputDir, requestId)
      ]);
    },
    generateProcessSpectrogram,
    generateProcessWaveform,
    generateSpectralDescriptorArtifact,
    getModuleProcessDir
  };
}
