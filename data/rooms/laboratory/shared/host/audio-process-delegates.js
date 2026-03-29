export function createLaboratoryAudioProcessDelegatesRuntime(deps) {
  const { audioAnalysisProcessRuntime } = deps;
  const getAudioAnalysisModuleProcessDir = function getAudioAnalysisModuleProcessDir2(runtime, project, moduleId) {
    return audioAnalysisProcessRuntime.getModuleProcessDir(runtime, project, moduleId);
  };
  const getAudioAnalysisModuleRunner = function getAudioAnalysisModuleRunner2(moduleId) {
    return audioAnalysisProcessRuntime.getModuleRunner(moduleId);
  };
  const generateProcessSpectrogram = async function generateProcessSpectrogram2(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId) {
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
  };
  return {
    generateProcessSpectrogram,
    getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner
  };
}
