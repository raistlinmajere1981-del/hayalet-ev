export function createLaboratoryAudioProcessDelegatesRuntime(deps) {
  const { audioAnalysisProcessRuntime } = deps;

  function getAudioAnalysisModuleProcessDir(runtime, project, moduleId) {
    return audioAnalysisProcessRuntime.getModuleProcessDir(runtime, project, moduleId);
  }

  function getAudioAnalysisModuleRunner(moduleId) {
    return audioAnalysisProcessRuntime.getModuleRunner(moduleId);
  }

  async function generateProcessSpectrogram(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    outputDir,
    moduleId
  ) {
    return audioAnalysisProcessRuntime.generateProcessSpectrogram(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      outputDir,
      moduleId
    );
  }

  return {
    generateProcessSpectrogram,
    getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner,
  };
}
