import { createLaboratoryAudioAnalysisHostRuntime } from "../../main-functions/audio-analysis/host/runtime.js";
import { createLaboratoryAudioAnalysisProjectionRuntime } from "./audio-analysis-projection.js";
import { createLaboratoryProcessCoordinationRuntime } from "./process-coordination.js";
import { createLaboratoryProcessDelegatesRuntime } from "./process-delegates.js";
import { createLaboratoryProcessOrchestrationRuntime } from "./process-orchestration.js";
import { createLaboratoryProcessRuntime } from "./process-runtime.js";
import { createLaboratoryProcessTargetingRuntime } from "./process-targeting.js";
import { createLaboratoryReportingRuntime } from "./reporting.js";

type UnknownFn = (...args: unknown[]) => unknown;
type LaboratoryProcessRuntimeDeps = Parameters<typeof createLaboratoryProcessRuntime>[0];
type LaboratoryReportingRuntimeDeps = Parameters<typeof createLaboratoryReportingRuntime>[0];
type LaboratoryAudioAnalysisHostRuntime = ReturnType<
  typeof createLaboratoryAudioAnalysisHostRuntime
>;
type LaboratoryAudioAnalysisProjectionRuntime =
  LaboratoryAudioAnalysisHostRuntime["audioAnalysisProjectionRuntime"];
type LaboratoryProcessDelegatesRuntime = ReturnType<typeof createLaboratoryProcessDelegatesRuntime>;
type LaboratorySubtitleAnalysisHostRuntime = {
  buildSubtitleAnalysisStats: (...args: unknown[]) => unknown;
  buildSubtitleProcessModules: (...args: unknown[]) => unknown[];
};

type LaboratoryHostProcessCompositionDeps = LaboratoryProcessRuntimeDeps &
  LaboratoryReportingRuntimeDeps & {
    audioAnalysisSchemaVersion: number;
    buildDerivedTargetSignature: UnknownFn;
    buildEmotionHeuristicFromProsody: UnknownFn;
    buildProfileModelSummary: UnknownFn;
    buildSourceTargetSignature: UnknownFn;
    ensureRuntimeDirectory: UnknownFn;
    findEditOutputById: UnknownFn;
    getActiveSubtitleEntry: UnknownFn;
    getPreferredFeatureSourceKind: UnknownFn;
    getStageSupport: UnknownFn;
    getSubtitleAnalysisHostRuntime: () => LaboratorySubtitleAnalysisHostRuntime | null;
    getSubtitleMimeType: UnknownFn;
    getToolManifest: UnknownFn;
    listDirectory: UnknownFn;
    normalizeEditOutput: UnknownFn;
    normalizeSourceMetadata: UnknownFn;
    normalizeSubtitleAnalysisState: UnknownFn;
    parseAspectralStatsText: UnknownFn;
    readJsonFile: UnknownFn;
    readTextFile: UnknownFn;
    resolveOpenSmileProsodyRuntime: UnknownFn;
    resolveProfileTarget: UnknownFn;
    runAudioStructureProbe: UnknownFn;
    runOpenSmileProsodyExtraction: UnknownFn;
    runProfileTool: UnknownFn;
    runVideoStructureProbe: UnknownFn;
    writeJsonFile: UnknownFn;
  };

export function createLaboratoryHostProcessCompositionRuntime(
  deps: LaboratoryHostProcessCompositionDeps
) {
  let audioAnalysisProjectionRuntime: LaboratoryAudioAnalysisProjectionRuntime | null = null;
  let laboratoryProcessDelegatesRuntime: LaboratoryProcessDelegatesRuntime | null = null;

  function resolveAudioFeatureTarget(
    project: Parameters<LaboratoryAudioAnalysisProjectionRuntime["resolveAudioFeatureTarget"]>[0]
  ) {
    const projection = audioAnalysisProjectionRuntime;
    if (!projection) {
      throw new Error("Audio analysis projection runtime is not initialized");
    }
    return projection.resolveAudioFeatureTarget(project);
  }

  const laboratoryProcessTargetingRuntimeDeps = {
    audioFeatureId: deps.audioFeatureId,
    subtitleFeatureId: deps.subtitleFeatureId,
    asNonEmptyString: deps.asNonEmptyString,
    toRecord: deps.toRecord,
    normalizeSubtitleAnalysisState: deps.normalizeSubtitleAnalysisState,
    getSubtitleSelectedEntries: deps.getSubtitleSelectedEntries,
    getActiveSubtitleEntry: deps.getActiveSubtitleEntry,
    getSubtitleMimeType: deps.getSubtitleMimeType,
    resolveAudioFeatureTarget,
    resolveProfileTarget: deps.resolveProfileTarget,
    normalizeProcessModule: deps.normalizeProcessModule,
    buildProfileModelSummary: deps.buildProfileModelSummary,
  };
  const laboratoryProcessTargetingRuntime = createLaboratoryProcessTargetingRuntime(
    laboratoryProcessTargetingRuntimeDeps as unknown as Parameters<
      typeof createLaboratoryProcessTargetingRuntime
    >[0]
  );

  const processOrchestrationRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    audioAnalysisProjectionRuntime: {
      buildAudioAnalysisModules(
        ...args: Parameters<LaboratoryProcessRuntimeDeps["buildAudioAnalysisModules"]>
      ) {
        const projection = audioAnalysisProjectionRuntime;
        if (!projection) {
          throw new Error("Audio analysis projection runtime is not initialized");
        }
        const modules: unknown = projection.buildAudioAnalysisModules(...args);
        return Array.isArray(modules) ? modules.map((entry): unknown => entry) : [];
      },
    },
    createEmptyFeatureProcessRecord: deps.createEmptyFeatureProcessRecord,
    normalizeProcessModule: deps.normalizeProcessModule,
    processTargetingRuntime: laboratoryProcessTargetingRuntime,
    toRecord: deps.toRecord,
  };
  const processOrchestrationRuntime = createLaboratoryProcessOrchestrationRuntime(
    processOrchestrationRuntimeDeps as unknown as Parameters<
      typeof createLaboratoryProcessOrchestrationRuntime
    >[0]
  );

  const {
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    createEmptyProcessRun,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessJobAction: getFeatureProcessJobActionForFeature,
    getFeatureReportExportAction: getFeatureReportExportActionForFeature,
    resolveProcessRunFeatureIds,
    resolveProcessWorkbench,
    resolveProcessTarget,
    updateProcessModule,
    updateProcessRecordPercent,
  } = processOrchestrationRuntime;
  const getFeatureProcessJobAction = function getFeatureProcessJobAction(
    featureId: Parameters<typeof getFeatureProcessJobActionForFeature>[0]
  ) {
    return getFeatureProcessJobActionForFeature(featureId, deps.audioFeatureId);
  };
  const getFeatureReportExportAction = function getFeatureReportExportAction(
    featureId: Parameters<typeof getFeatureReportExportActionForFeature>[0]
  ) {
    return getFeatureReportExportActionForFeature(featureId, deps.audioFeatureId);
  };

  const {
    audioAnalysisProcessRuntime,
    audioAnalysisProjectionRuntime: nextAudioAnalysisProjectionRuntime,
    audioAnalysisStateRuntime,
    laboratoryAudioProcessDelegatesRuntime,
  } = createLaboratoryAudioAnalysisHostRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    audioAnalysisSchemaVersion: deps.audioAnalysisSchemaVersion,
    audioFeatureId: deps.audioFeatureId,
    buildDerivedTargetSignature: deps.buildDerivedTargetSignature,
    buildEmotionHeuristicFromProsody: deps.buildEmotionHeuristicFromProsody,
    buildProcessSpeechAvailability,
    buildProfileModelSummary: deps.buildProfileModelSummary,
    buildSourceTargetSignature: deps.buildSourceTargetSignature,
    clone: deps.clone,
    createProcessArtifact: deps["createProcessArtifact"],
    createProcessFinding: deps["createProcessFinding"],
    ensureRuntimeDirectory: deps.ensureRuntimeDirectory,
    findEditOutputById: deps.findEditOutputById,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessRecord: deps.getFeatureProcessRecord,
    getFeatureReportRecord: deps.getFeatureReportRecord,
    getPreferredFeatureSourceKind: deps.getPreferredFeatureSourceKind,
    getStageSupport: deps.getStageSupport,
    getToolManifest: deps.getToolManifest,
    listDirectory: deps.listDirectory,
    maybeRunWhisperProfileSample: deps["maybeRunWhisperProfileSample"],
    normalizeAudioAnalysisModuleResult: deps.normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisState: deps.normalizeAudioAnalysisState,
    normalizeEditOutput: deps.normalizeEditOutput,
    normalizeProcessArtifact: deps.normalizeProcessArtifact,
    normalizeProcessFinding: deps.normalizeProcessFinding,
    normalizeProcessModule: deps.normalizeProcessModule,
    normalizeReportExport: deps.normalizeReportExport,
    normalizeSourceMetadata: deps.normalizeSourceMetadata,
    normalizeStringArray: deps.normalizeStringArray,
    parseAspectralStatsText: deps.parseAspectralStatsText,
    readJsonFile: deps.readJsonFile,
    readTextFile: deps.readTextFile,
    resolveOpenSmileProsodyRuntime: deps.resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe: deps.runAudioStructureProbe,
    runOpenSmileProsodyExtraction: deps.runOpenSmileProsodyExtraction,
    runProfileTool: deps.runProfileTool,
    sanitizeFileSegment: deps.sanitizeFileSegment,
    toRecord: deps.toRecord,
    writeJsonFile: deps.writeJsonFile,
    writeTextFile: deps.writeTextFile,
  } as unknown as Parameters<typeof createLaboratoryAudioAnalysisHostRuntime>[0]);
  audioAnalysisProjectionRuntime = nextAudioAnalysisProjectionRuntime;

  const laboratoryAudioAnalysisProjectionRuntime = createLaboratoryAudioAnalysisProjectionRuntime({
    audioAnalysisProjectionRuntime: nextAudioAnalysisProjectionRuntime as Parameters<
      typeof createLaboratoryAudioAnalysisProjectionRuntime
    >[0]["audioAnalysisProjectionRuntime"],
  });
  const { syncProjectAudioAnalysisProjection } = laboratoryAudioAnalysisProjectionRuntime;

  const laboratoryReportingRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    clearJob: deps.clearJob,
    clone: deps.clone,
    createEmptyFeatureReportRecord: deps.createEmptyFeatureReportRecord,
    ensureProjectDirectories: deps.ensureProjectDirectories,
    ensureReportJobSlotAvailable: deps.ensureReportJobSlotAvailable,
    formatIdentifierLabel: deps.formatIdentifierLabel,
    getActiveProject: deps.getActiveProject,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessRecord: deps.getFeatureProcessRecord,
    getFeatureReportDir: deps.getFeatureReportDir,
    getFeatureReportExportAction,
    getFeatureReportRecord: deps.getFeatureReportRecord,
    getFindingSeverityRank: deps.getFindingSeverityRank,
    getSubtitleAnalysisModuleDescriptors: deps.getSubtitleAnalysisModuleDescriptors,
    getSubtitleSelectedEntries: deps.getSubtitleSelectedEntries,
    normalizeAudioAnalysisModuleResult: deps.normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisState: deps.normalizeAudioAnalysisState,
    normalizeFeatureReportRecord: deps.normalizeFeatureReportRecord,
    normalizeProcessArtifact: deps.normalizeProcessArtifact,
    normalizeProcessFinding: deps.normalizeProcessFinding,
    normalizeProcessModule: deps.normalizeProcessModule,
    normalizeReportExport: deps.normalizeReportExport,
    normalizeStringArray: deps.normalizeStringArray,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    sanitizeFileSegment: deps.sanitizeFileSegment,
    setFeatureReportRecord: deps.setFeatureReportRecord,
    syncProjectAudioAnalysisProjection,
    toRecord: deps.toRecord,
    writeTextFile: deps.writeTextFile,
    audioFeatureId: deps.audioFeatureId,
    subtitleFeatureId: deps.subtitleFeatureId,
    mediaFeatureId: deps.mediaFeatureId,
  };
  const laboratoryReportingRuntime = createLaboratoryReportingRuntime(
    laboratoryReportingRuntimeDeps as unknown as Parameters<
      typeof createLaboratoryReportingRuntime
    >[0]
  );

  const laboratoryProcessRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    buildSubtitleAnalysisStats(
      ...args: Parameters<LaboratorySubtitleAnalysisHostRuntime["buildSubtitleAnalysisStats"]>
    ) {
      const subtitleAnalysisHostRuntime = deps.getSubtitleAnalysisHostRuntime();
      if (!subtitleAnalysisHostRuntime) {
        throw new Error("Subtitle analysis host runtime is not initialized");
      }
      return subtitleAnalysisHostRuntime.buildSubtitleAnalysisStats(...args);
    },
    buildSubtitleProcessModules(
      ...args: Parameters<LaboratorySubtitleAnalysisHostRuntime["buildSubtitleProcessModules"]>
    ) {
      const subtitleAnalysisHostRuntime = deps.getSubtitleAnalysisHostRuntime();
      if (!subtitleAnalysisHostRuntime) {
        throw new Error("Subtitle analysis host runtime is not initialized");
      }
      return subtitleAnalysisHostRuntime.buildSubtitleProcessModules(...args);
    },
    cancelProcessJobsForProject: deps.cancelProcessJobsForProject,
    clampProfileTranscriptSampleSeconds: deps["clampProfileTranscriptSampleSeconds"],
    clearJob: deps.clearJob,
    clone: deps.clone,
    composeFeatureReport(
      ...args: Parameters<LaboratoryProcessDelegatesRuntime["composeFeatureReport"]>
    ) {
      const delegates = laboratoryProcessDelegatesRuntime;
      if (!delegates) {
        throw new Error("Laboratory process delegates runtime is not initialized");
      }
      return delegates.composeFeatureReport(...args);
    },
    createEmptyFeatureProcessRecord: deps.createEmptyFeatureProcessRecord,
    createEmptyProcessRun,
    createProcessArtifact: deps["createProcessArtifact"],
    createProcessFinding: deps["createProcessFinding"],
    ensureEditToolReady: deps.ensureEditToolReady,
    ensureProcessJobSlotAvailable: deps.ensureProcessJobSlotAvailable,
    ensureProjectDirectories: deps.ensureProjectDirectories,
    generateProcessMetadataArtifact: deps["generateProcessMetadataArtifact"],
    generateProcessSpectrogram: laboratoryAudioProcessDelegatesRuntime.generateProcessSpectrogram,
    getActiveProject: deps.getActiveProject,
    getAudioAnalysisModuleProcessDir:
      laboratoryAudioProcessDelegatesRuntime.getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner:
      laboratoryAudioProcessDelegatesRuntime.getAudioAnalysisModuleRunner,
    getFeatureProcessDir: deps.getFeatureProcessDir,
    getFeatureProcessJobAction,
    getFeatureProcessRecord: deps.getFeatureProcessRecord,
    getProjectSubtitleProcessDir: deps["getProjectSubtitleProcessDir"],
    maybeRunWhisperProfileSample: deps["maybeRunWhisperProfileSample"],
    normalizeProcessArtifact: deps.normalizeProcessArtifact,
    normalizeProcessFinding: deps.normalizeProcessFinding,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    resolveProcessRunFeatureIds,
    resolveProcessWorkbench,
    resolveProcessTarget,
    runAudioStructureProbe: deps.runAudioStructureProbe,
    runVideoStructureProbe: deps.runVideoStructureProbe,
    sanitizeFileSegment: deps.sanitizeFileSegment,
    setFeatureProcessRecord: deps.setFeatureProcessRecord,
    setFeatureReportRecord: deps.setFeatureReportRecord,
    toRecord: deps.toRecord,
    updateProcessModule,
    updateProcessRecordPercent,
    writeJsonFile: deps.writeJsonFile,
    writeTextFile: deps.writeTextFile,
    markFeatureReportStale: deps.markFeatureReportStale,
    audioFeatureId: deps.audioFeatureId,
    subtitleFeatureId: deps.subtitleFeatureId,
  };
  const laboratoryProcessRuntime = createLaboratoryProcessRuntime(
    laboratoryProcessRuntimeDeps as unknown as Parameters<typeof createLaboratoryProcessRuntime>[0]
  );

  const laboratoryProcessCoordinationRuntime = createLaboratoryProcessCoordinationRuntime({
    processRuntime: laboratoryProcessRuntime,
    reportingRuntime: laboratoryReportingRuntime,
  });
  laboratoryProcessDelegatesRuntime = createLaboratoryProcessDelegatesRuntime({
    processCoordinationRuntime: laboratoryProcessCoordinationRuntime,
  });

  return {
    audioAnalysisProcessRuntime,
    audioAnalysisProjectionRuntime,
    audioAnalysisStateRuntime,
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessJobAction,
    getFeatureReportExportAction,
    laboratoryAudioProcessDelegatesRuntime,
    laboratoryProcessCoordinationRuntime,
    laboratoryProcessDelegatesRuntime,
    laboratoryProcessRuntime,
    laboratoryProcessTargetingRuntime,
    laboratoryReportingRuntime,
    resolveAudioFeatureTarget,
    resolveProcessTarget,
    syncProjectAudioAnalysisProjection,
    updateProcessModule,
    updateProcessRecordPercent,
  };
}
