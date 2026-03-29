import { createLaboratoryAudioProcessDelegatesRuntime } from "../../../shared/host/audio-process-delegates.js";
import { createAudioAnalysisProjectionRuntime } from "./module-projection.js";
import { createAudioAnalysisProcessRuntime } from "./process-runners.js";
import { createAudioAnalysisStateRuntime } from "./state.js";
export function createLaboratoryAudioAnalysisHostRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    audioAnalysisSchemaVersion,
    audioFeatureId,
    buildDerivedTargetSignature,
    buildEmotionHeuristicFromProsody,
    buildProcessSpeechAvailability,
    buildProfileModelSummary,
    buildSourceTargetSignature,
    clone,
    createProcessArtifact,
    createProcessFinding,
    ensureRuntimeDirectory,
    findEditOutputById,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessRecord,
    getFeatureReportRecord,
    getPreferredFeatureSourceKind,
    getStageSupport,
    getToolManifest,
    listDirectory,
    maybeRunWhisperProfileSample,
    normalizeEditOutput,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeReportExport,
    normalizeSourceMetadata,
    normalizeStringArray,
    parseAspectralStatsText,
    readJsonFile,
    readTextFile,
    resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe,
    runOpenSmileProsodyExtraction,
    runProfileTool,
    sanitizeFileSegment,
    toRecord,
    writeJsonFile,
    writeTextFile
  } = deps;
  function getAudioAnalysisRequiredToolIds(catalogEntry) {
    const source = toRecord(catalogEntry);
    const requiredToolIds = normalizeStringArray(source.requiredToolIds);
    return requiredToolIds.length > 0 ? requiredToolIds : normalizeStringArray(source.toolIds);
  }
  const audioAnalysisStateRuntime = createAudioAnalysisStateRuntime({
    asNonEmptyString,
    asNumber,
    audioAnalysisSchemaVersion,
    getAudioAnalysisModulesForRuntime,
    getAudioAnalysisRequiredToolIds,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeReportExport,
    normalizeStringArray,
    toRecord
  });
  const {
    normalizeAudioAnalysisCapabilityEntry,
    normalizeAudioAnalysisMetric,
    normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisProviderStateEntry,
    normalizeAudioAnalysisRunRecord,
    normalizeAudioAnalysisState
  } = audioAnalysisStateRuntime;
  const audioAnalysisProjectionRuntime = createAudioAnalysisProjectionRuntime({
    asNumber,
    asNonEmptyString,
    audioAnalysisSchemaVersion,
    audioFeatureId,
    buildDerivedTargetSignature,
    buildProcessSpeechAvailability,
    buildProfileModelSummary,
    buildSourceTargetSignature,
    findEditOutputById,
    getFeatureProcessRecord,
    getFeatureReportRecord,
    getAudioAnalysisModulesForRuntime,
    getPreferredFeatureSourceKind,
    getStageSupport,
    getToolManifest,
    normalizeAudioAnalysisCapabilityEntry,
    normalizeAudioAnalysisMetric,
    normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisProviderStateEntry,
    normalizeAudioAnalysisRunRecord,
    normalizeAudioAnalysisState,
    normalizeEditOutput,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeReportExport,
    normalizeSourceMetadata,
    normalizeStringArray,
    toRecord
  });
  const audioAnalysisProcessRuntime = createAudioAnalysisProcessRuntime({
    asNonEmptyString,
    asNumber,
    buildEmotionHeuristicFromProsody,
    buildProcessSpeechAvailability,
    clone,
    createProcessArtifact,
    createProcessFinding,
    ensureRuntimeDirectory,
    listDirectory,
    maybeRunWhisperProfileSample,
    normalizeProcessArtifact,
    parseAspectralStatsText,
    readJsonFile,
    readTextFile,
    resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe,
    runOpenSmileProsodyExtraction,
    runProfileTool,
    sanitizeFileSegment,
    toRecord,
    writeJsonFile,
    writeTextFile
  });
  const laboratoryAudioProcessDelegatesRuntime = createLaboratoryAudioProcessDelegatesRuntime({
    audioAnalysisProcessRuntime
  });
  return {
    audioAnalysisProcessRuntime,
    audioAnalysisProjectionRuntime,
    audioAnalysisStateRuntime,
    laboratoryAudioProcessDelegatesRuntime
  };
}
