export function createLaboratoryAudioProcessDelegatesRuntime(deps) {
  const { audioAnalysisProcessRuntime } = deps;
  return {
    generateProcessSpectrogram: audioAnalysisProcessRuntime.generateProcessSpectrogram,
    getAudioAnalysisModuleProcessDir: audioAnalysisProcessRuntime.getModuleProcessDir,
    getAudioAnalysisModuleRunner: audioAnalysisProcessRuntime.getModuleRunner
  };
}
