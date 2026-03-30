import { createLaboratoryManagedAudioRunnerRuntime } from "./process-managed-audio-runner.js";
import { createLaboratoryManagedMediaRunnerRuntime } from "./process-managed-media-runner.js";
import { createLaboratoryManagedSubtitleRunnerRuntime } from "./process-managed-subtitle-runner.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryManagedSubtitleRunnerDeps = Parameters<
  typeof createLaboratoryManagedSubtitleRunnerRuntime
>[0];
type LaboratoryManagedAudioRunnerDeps = Parameters<
  typeof createLaboratoryManagedAudioRunnerRuntime
>[0];
type LaboratoryManagedMediaRunnerDeps = Parameters<
  typeof createLaboratoryManagedMediaRunnerRuntime
>[0];

type LaboratoryManagedProcessRunnersDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  buildProcessSpeechAvailability: LaboratoryManagedMediaRunnerDeps["buildProcessSpeechAvailability"];
  buildSubtitleAnalysisStats: LaboratoryManagedSubtitleRunnerDeps["buildSubtitleAnalysisStats"];
  clampProfileTranscriptSampleSeconds: (value: unknown) => number;
  clone: <T>(value: T) => T;
  createProcessArtifact: (
    moduleId: string,
    kind: string,
    path: string,
    title: string,
    metadata: LaboratoryRecord
  ) => LaboratoryRecord | null;
  createProcessFinding: (
    moduleId: string,
    kind: string,
    level: string,
    confidence: string,
    title: string,
    detail: string,
    evidenceCount: number,
    artifactIds: string[]
  ) => LaboratoryRecord;
  generateProcessMetadataArtifact: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    target: LaboratoryRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string
  ) => Promise<unknown>;
  generateProcessSpectrogram: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryRecord,
    artifactBase: string,
    outputDir: string
  ) => Promise<unknown>;
  getAudioAnalysisModuleProcessDir: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    moduleId: string
  ) => string;
  getAudioAnalysisModuleRunner: LaboratoryManagedAudioRunnerDeps["getAudioAnalysisModuleRunner"];
  getProjectSubtitleProcessDir: (runtime: LaboratoryRecord, project: LaboratoryRecord) => string;
  maybeRunWhisperProfileSample: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryRecord,
    outputDir: string
  ) => Promise<unknown>;
  normalizeProcessArtifact: (rawValue: unknown) => LaboratoryRecord;
  normalizeProcessFinding: (rawValue: unknown) => LaboratoryRecord;
  runAudioStructureProbe: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryRecord
  ) => Promise<unknown>;
  runVideoStructureProbe: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryRecord
  ) => Promise<unknown>;
  sanitizeFileSegment: (value: string, fallbackValue: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
  updateProcessModule: (
    processRecord: LaboratoryRecord,
    moduleId: string,
    patch: LaboratoryRecord
  ) => LaboratoryRecord;
  writeJsonFile: (filePath: string, payload: unknown) => Promise<unknown> | unknown;
  writeTextFile: (filePath: string, content: string) => Promise<unknown> | unknown;
};

export function createLaboratoryManagedProcessRunnersRuntime(
  deps: LaboratoryManagedProcessRunnersDeps
) {
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
    writeTextFile: deps.writeTextFile,
  });

  const laboratoryManagedAudioRunnerRuntime = createLaboratoryManagedAudioRunnerRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    getAudioAnalysisModuleProcessDir: deps.getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner: deps.getAudioAnalysisModuleRunner,
    normalizeProcessArtifact: deps.normalizeProcessArtifact,
    normalizeProcessFinding: deps.normalizeProcessFinding,
    sanitizeFileSegment: deps.sanitizeFileSegment,
    toRecord: deps.toRecord,
    updateProcessModule: deps.updateProcessModule,
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
    updateProcessModule: deps.updateProcessModule,
  });

  return {
    runSubtitleManagedProcess: laboratoryManagedSubtitleRunnerRuntime.runSubtitleManagedProcess,
    runAudioManagedProcess: laboratoryManagedAudioRunnerRuntime.runAudioManagedProcess,
    runMediaManagedProcess: laboratoryManagedMediaRunnerRuntime.runMediaManagedProcess,
  };
}
