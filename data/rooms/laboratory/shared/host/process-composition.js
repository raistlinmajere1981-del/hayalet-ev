import { createLaboratoryAudioAnalysisHostRuntime } from "../../main-functions/audio-analysis/host/runtime.js";
import { createLaboratoryAudioAnalysisProjectionRuntime } from "./audio-analysis-projection.js";
import { createLaboratoryProcessCoordinationRuntime } from "./process-coordination.js";
import { createLaboratoryProcessDelegatesRuntime } from "./process-delegates.js";
import { createLaboratoryProcessOrchestrationRuntime } from "./process-orchestration.js";
import { createLaboratoryProcessRuntime } from "./process-runtime.js";
import { createLaboratoryProcessTargetingRuntime } from "./process-targeting.js";
import { createLaboratoryReportingRuntime } from "./reporting.js";
export function createLaboratoryHostProcessCompositionRuntime(deps) {
  let audioAnalysisProjectionRuntime = null;
  let laboratoryProcessDelegatesRuntime = null;
  function resolveAudioFeatureTarget(project) {
    return audioAnalysisProjectionRuntime.resolveAudioFeatureTarget(project);
  }
  const laboratoryProcessTargetingRuntime = createLaboratoryProcessTargetingRuntime({
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
    buildProfileModelSummary: deps.buildProfileModelSummary
  });
  const processOrchestrationRuntime = createLaboratoryProcessOrchestrationRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    audioAnalysisProjectionRuntime: {
      buildAudioAnalysisModules(...args) {
        return audioAnalysisProjectionRuntime.buildAudioAnalysisModules(...args);
      }
    },
    createEmptyFeatureProcessRecord: deps.createEmptyFeatureProcessRecord,
    normalizeProcessModule: deps.normalizeProcessModule,
    processTargetingRuntime: laboratoryProcessTargetingRuntime,
    toRecord: deps.toRecord
  });
  const {
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    createEmptyProcessRun,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessJobAction: getFeatureProcessJobActionForFeature,
    getFeatureReportExportAction: getFeatureReportExportActionForFeature,
    resolveProcessTarget,
    updateProcessModule,
    updateProcessRecordPercent
  } = processOrchestrationRuntime;
  const getFeatureProcessJobAction = function getFeatureProcessJobAction2(featureId) {
    return getFeatureProcessJobActionForFeature(featureId, deps.audioFeatureId);
  };
  const getFeatureReportExportAction = function getFeatureReportExportAction2(featureId) {
    return getFeatureReportExportActionForFeature(featureId, deps.audioFeatureId);
  };
  const {
    audioAnalysisProcessRuntime,
    audioAnalysisProjectionRuntime: nextAudioAnalysisProjectionRuntime,
    audioAnalysisStateRuntime,
    laboratoryAudioProcessDelegatesRuntime
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
    createProcessArtifact: deps.createProcessArtifact,
    createProcessFinding: deps.createProcessFinding,
    ensureRuntimeDirectory: deps.ensureRuntimeDirectory,
    findEditOutputById: deps.findEditOutputById,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessRecord: deps.getFeatureProcessRecord,
    getFeatureReportRecord: deps.getFeatureReportRecord,
    getPreferredFeatureSourceKind: deps.getPreferredFeatureSourceKind,
    getStageSupport: deps.getStageSupport,
    getToolManifest: deps.getToolManifest,
    listDirectory: deps.listDirectory,
    maybeRunWhisperProfileSample: deps.maybeRunWhisperProfileSample,
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
    writeTextFile: deps.writeTextFile
  });
  audioAnalysisProjectionRuntime = nextAudioAnalysisProjectionRuntime;
  const laboratoryAudioAnalysisProjectionRuntime = createLaboratoryAudioAnalysisProjectionRuntime({
    audioAnalysisProjectionRuntime
  });
  const { syncProjectAudioAnalysisProjection } = laboratoryAudioAnalysisProjectionRuntime;
  const laboratoryReportingRuntime = createLaboratoryReportingRuntime({
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
    mediaFeatureId: deps.mediaFeatureId
  });
  const laboratoryProcessRuntime = createLaboratoryProcessRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    buildSubtitleAnalysisStats(...args) {
      return deps.getSubtitleAnalysisHostRuntime().buildSubtitleAnalysisStats(...args);
    },
    buildSubtitleProcessModules(...args) {
      return deps.getSubtitleAnalysisHostRuntime().buildSubtitleProcessModules(...args);
    },
    cancelProcessJobsForProject: deps.cancelProcessJobsForProject,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    clearJob: deps.clearJob,
    clone: deps.clone,
    composeFeatureReport(...args) {
      return laboratoryProcessDelegatesRuntime.composeFeatureReport(...args);
    },
    createEmptyFeatureProcessRecord: deps.createEmptyFeatureProcessRecord,
    createEmptyProcessRun,
    createProcessArtifact: deps.createProcessArtifact,
    createProcessFinding: deps.createProcessFinding,
    ensureEditToolReady: deps.ensureEditToolReady,
    ensureProcessJobSlotAvailable: deps.ensureProcessJobSlotAvailable,
    ensureProjectDirectories: deps.ensureProjectDirectories,
    generateProcessMetadataArtifact: deps.generateProcessMetadataArtifact,
    generateProcessSpectrogram: laboratoryAudioProcessDelegatesRuntime.generateProcessSpectrogram,
    getActiveProject: deps.getActiveProject,
    getAudioAnalysisModuleProcessDir: laboratoryAudioProcessDelegatesRuntime.getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner: laboratoryAudioProcessDelegatesRuntime.getAudioAnalysisModuleRunner,
    getFeatureProcessDir: deps.getFeatureProcessDir,
    getFeatureProcessJobAction,
    getFeatureProcessRecord: deps.getFeatureProcessRecord,
    getProjectSubtitleProcessDir: deps.getProjectSubtitleProcessDir,
    maybeRunWhisperProfileSample: deps.maybeRunWhisperProfileSample,
    normalizeProcessArtifact: deps.normalizeProcessArtifact,
    normalizeProcessFinding: deps.normalizeProcessFinding,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
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
    subtitleFeatureId: deps.subtitleFeatureId
  });
  const laboratoryProcessCoordinationRuntime = createLaboratoryProcessCoordinationRuntime({
    processRuntime: laboratoryProcessRuntime,
    reportingRuntime: laboratoryReportingRuntime
  });
  laboratoryProcessDelegatesRuntime = createLaboratoryProcessDelegatesRuntime({
    processCoordinationRuntime: laboratoryProcessCoordinationRuntime
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
    updateProcessRecordPercent
  };
}
