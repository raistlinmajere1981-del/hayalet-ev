import { createLaboratoryManagedAudioRunnerRuntime } from "./process-managed-audio-runner.js";
import { createLaboratoryManagedMediaRunnerRuntime } from "./process-managed-media-runner.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryManagedAudioRunnerDeps = Parameters<
  typeof createLaboratoryManagedAudioRunnerRuntime
>[0];
type LaboratoryManagedMediaRunnerDeps = Parameters<
  typeof createLaboratoryManagedMediaRunnerRuntime
>[0];

type LaboratoryManagedProcessRunnersDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  buildProcessSpeechAvailability: LaboratoryManagedMediaRunnerDeps["buildProcessSpeechAvailability"];
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
  generateProcessFramePreviewArtifact: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string,
    sampleWindowSeconds: number,
    tileCount: unknown,
    label?: string,
    filterGraph?: string | null
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
  generateProcessVisualTransformArtifact: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string,
    filterGraph: string,
    label: string,
    metadata?: LaboratoryRecord
  ) => Promise<unknown>;
  partitionVisualAnalysisModuleIds: (
    runtime: LaboratoryRecord,
    moduleIds: string[]
  ) => LaboratoryRecord;
  resolveEnabledVisualAnalysisModuleIds: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    sourceKind: string | null
  ) => string[];
  getAudioAnalysisModuleProcessDir: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    moduleId: string
  ) => string;
  getAudioAnalysisModuleRunner: LaboratoryManagedAudioRunnerDeps["getAudioAnalysisModuleRunner"];
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

type LaboratoryManagedProcessUpdateEmitter = (payload: LaboratoryRecord) => void;

export function createLaboratoryManagedProcessRunnersRuntime(
  deps: LaboratoryManagedProcessRunnersDeps
) {
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
    generateProcessFramePreviewArtifact: deps.generateProcessFramePreviewArtifact,
    generateProcessMetadataArtifact: deps.generateProcessMetadataArtifact,
    generateProcessSpectrogram: deps.generateProcessSpectrogram,
    generateProcessVisualTransformArtifact: deps.generateProcessVisualTransformArtifact,
    maybeRunWhisperProfileSample: deps.maybeRunWhisperProfileSample,
    normalizeProcessArtifact: deps.normalizeProcessArtifact,
    normalizeProcessFinding: deps.normalizeProcessFinding,
    partitionVisualAnalysisModuleIds: deps.partitionVisualAnalysisModuleIds,
    resolveEnabledVisualAnalysisModuleIds: deps.resolveEnabledVisualAnalysisModuleIds,
    runAudioStructureProbe: deps.runAudioStructureProbe,
    runVideoStructureProbe: deps.runVideoStructureProbe,
    toRecord: deps.toRecord,
    updateProcessModule: deps.updateProcessModule,
  });

  return {
    runAudioManagedProcess(
      runtime: LaboratoryRecord,
      project: LaboratoryRecord,
      requestId: string,
      jobId: string,
      target: LaboratoryRecord,
      artifactBase: string,
      processRecord: LaboratoryRecord,
      emitRuntimeUpdate?: LaboratoryManagedProcessUpdateEmitter | null
    ) {
      return laboratoryManagedAudioRunnerRuntime.runAudioManagedProcess(
        runtime,
        project,
        requestId,
        jobId,
        target,
        artifactBase,
        processRecord,
        emitRuntimeUpdate || null
      );
    },
    runMediaManagedProcess(
      runtime: LaboratoryRecord,
      project: LaboratoryRecord,
      requestId: string,
      jobId: string,
      target: LaboratoryRecord,
      artifactBase: string,
      outputDir: string,
      processRecord: LaboratoryRecord,
      emitRuntimeUpdate?: LaboratoryManagedProcessUpdateEmitter | null
    ) {
      return laboratoryManagedMediaRunnerRuntime.runMediaManagedProcess(
        runtime,
        project,
        requestId,
        jobId,
        target,
        artifactBase,
        outputDir,
        processRecord,
        emitRuntimeUpdate || null
      );
    },
  };
}
