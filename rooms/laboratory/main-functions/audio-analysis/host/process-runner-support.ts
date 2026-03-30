import { getAudioAnalysisProcessRootDir } from "../../../shared/host/project-paths.js";

export function createAudioAnalysisProcessRunnerSupport(deps: any) {
  const {
    clone,
    createProcessArtifact,
    ensureRuntimeDirectory,
    parseAspectralStatsText,
    readTextFile,
    runProfileTool,
    sanitizeFileSegment,
    writeJsonFile,
  } = deps;

  function getModuleProcessDir(runtime: any, project: any, moduleId: string) {
    return `${getAudioAnalysisProcessRootDir(runtime, project)}/${sanitizeFileSegment(moduleId, "audio-module")}`;
  }

  async function generateProcessSpectrogram(
    runtime: any,
    project: any,
    requestId: string,
    jobId: string,
    target: any,
    artifactBase: string,
    outputDir: string,
    moduleId: string
  ) {
    const outputPath = `${outputDir}/${artifactBase}-spectrogram.png`;
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: [
        "-y",
        "-i",
        target.path,
        "-lavfi",
        "showspectrumpic=s=1600x440:legend=0",
        "-frames:v",
        "1",
        outputPath,
      ],
      timeoutMs: 90_000,
    });
    return createProcessArtifact(moduleId, "spectrogram", outputPath, "Spectrogram", {});
  }

  async function generateProcessWaveform(
    runtime: any,
    project: any,
    requestId: string,
    jobId: string,
    target: any,
    artifactBase: string,
    outputDir: string,
    moduleId: string
  ) {
    const outputPath = `${outputDir}/${artifactBase}-waveform.png`;
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
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
        outputPath,
      ],
      timeoutMs: 90_000,
    });
    return createProcessArtifact(moduleId, "waveform", outputPath, "Waveform", {});
  }

  async function generateSpectralDescriptorArtifact(
    runtime: any,
    project: any,
    requestId: string,
    jobId: string,
    target: any,
    artifactBase: string,
    outputDir: string,
    moduleId: string
  ) {
    const textPath = `${outputDir}/${artifactBase}-spectral.txt`;
    const jsonPath = `${outputDir}/${artifactBase}-spectral.json`;
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
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
        "-",
      ],
      timeoutMs: 90_000,
    });

    const descriptorSummary = parseAspectralStatsText(await readTextFile(textPath));
    await writeJsonFile(jsonPath, {
      generatedAt: new Date().toISOString(),
      target: clone(target),
      descriptorSummary: descriptorSummary,
    });
    return createProcessArtifact(
      moduleId,
      "spectral-descriptors",
      jsonPath,
      "Spectral Descriptor Summary",
      {
        descriptorSummary: descriptorSummary,
      }
    );
  }

  return {
    ensureProcessRuntimeDirectories(
      runtime: any,
      project: any,
      requestId: string,
      moduleOutputDir: string
    ) {
      return Promise.all([
        ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId),
        ensureRuntimeDirectory(moduleOutputDir, requestId),
      ]);
    },
    generateProcessSpectrogram: generateProcessSpectrogram,
    generateProcessWaveform: generateProcessWaveform,
    generateSpectralDescriptorArtifact: generateSpectralDescriptorArtifact,
    getModuleProcessDir: getModuleProcessDir,
  };
}
