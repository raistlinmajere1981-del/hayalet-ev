type LaboratoryAudioProcessTarget = Record<string, unknown>;

type LaboratoryAudioAnalysisProcessRuntime = {
  getModuleProcessDir: (
    runtime: unknown,
    project: unknown,
    moduleId: string,
  ) => string | null | undefined;
  getModuleRunner: (moduleId: string) => unknown;
  generateProcessSpectrogram: (
    runtime: unknown,
    project: unknown,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioProcessTarget,
    artifactBase: string,
    outputDir: string,
    moduleId: string,
  ) => Promise<unknown>;
};

type LaboratoryAudioProcessDelegatesRuntimeDeps = {
  audioAnalysisProcessRuntime: LaboratoryAudioAnalysisProcessRuntime;
};

export function createLaboratoryAudioProcessDelegatesRuntime(
  deps: LaboratoryAudioProcessDelegatesRuntimeDeps,
) {
  const { audioAnalysisProcessRuntime } = deps;

  const getAudioAnalysisModuleProcessDir: (
    runtime: unknown,
    project: unknown,
    moduleId: string,
  ) => string | null | undefined = function getAudioAnalysisModuleProcessDir(
    runtime,
    project,
    moduleId,
  ) {
    return audioAnalysisProcessRuntime.getModuleProcessDir(runtime, project, moduleId);
  };

  const getAudioAnalysisModuleRunner: (
    moduleId: string,
  ) => unknown = function getAudioAnalysisModuleRunner(moduleId) {
    return audioAnalysisProcessRuntime.getModuleRunner(moduleId);
  };

  const generateProcessSpectrogram: (
    runtime: unknown,
    project: unknown,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioProcessTarget,
    artifactBase: string,
    outputDir: string,
    moduleId: string,
  ) => Promise<unknown> = async function generateProcessSpectrogram(
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
  };

  return {
    generateProcessSpectrogram,
    getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner,
  };
}
