import { createLaboratoryManagedAudioRunnerRuntime } from "./process-managed-audio-runner.js";
import { createLaboratoryManagedMediaRunnerRuntime } from "./process-managed-media-runner.js";
import { createLaboratoryManagedSubtitleRunnerRuntime } from "./process-managed-subtitle-runner.js";
export function createLaboratoryManagedProcessRunnersRuntime(deps) {
  const laboratoryManagedSubtitleRunnerRuntime = createLaboratoryManagedSubtitleRunnerRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    buildSubtitleAnalysisStats: deps.buildSubtitleAnalysisStats,
    clone: deps.clone,
    createProcessArtifact: deps.createProcessArtifact,
    createProcessFinding: deps.createProcessFinding,
    getProjectSubtitleProcessDir: deps.getProjectSubtitleProcessDir,
    normalizeProcessFinding: deps.normalizeProcessFinding,
    toRecord: deps.toRecord,
    updateProcessModule: deps.updateProcessModule,
    writeJsonFile: deps.writeJsonFile,
    writeTextFile: deps.writeTextFile
  });
  const laboratoryManagedAudioRunnerRuntime = createLaboratoryManagedAudioRunnerRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    getAudioAnalysisModuleProcessDir: deps.getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner: deps.getAudioAnalysisModuleRunner,
    normalizeProcessArtifact: deps.normalizeProcessArtifact,
    normalizeProcessFinding: deps.normalizeProcessFinding,
    sanitizeFileSegment: deps.sanitizeFileSegment,
    toRecord: deps.toRecord,
    updateProcessModule: deps.updateProcessModule
  });
  const laboratoryManagedMediaRunnerRuntime = createLaboratoryManagedMediaRunnerRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    buildProcessSpeechAvailability: deps.buildProcessSpeechAvailability,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    createProcessFinding: deps.createProcessFinding,
    generateProcessMetadataArtifact: deps.generateProcessMetadataArtifact,
    generateProcessSpectrogram: deps.generateProcessSpectrogram,
    maybeRunWhisperProfileSample: deps.maybeRunWhisperProfileSample,
    normalizeProcessArtifact: deps.normalizeProcessArtifact,
    runAudioStructureProbe: deps.runAudioStructureProbe,
    runVideoStructureProbe: deps.runVideoStructureProbe,
    toRecord: deps.toRecord,
    updateProcessModule: deps.updateProcessModule
  });
  return {
    runSubtitleManagedProcess: laboratoryManagedSubtitleRunnerRuntime.runSubtitleManagedProcess,
    runAudioManagedProcess: laboratoryManagedAudioRunnerRuntime.runAudioManagedProcess,
    runMediaManagedProcess: laboratoryManagedMediaRunnerRuntime.runMediaManagedProcess
  };
}
