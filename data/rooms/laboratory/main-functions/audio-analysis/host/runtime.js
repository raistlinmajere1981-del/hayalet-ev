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
    buildProcessSpeechAvailability,
    buildProfileModelSummary,
    buildSourceTargetSignature,
    findEditOutputById,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessRecord,
    getFeatureReportRecord,
    getPreferredFeatureSourceKind,
    normalizeEditOutput,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeReportExport,
    normalizeSourceMetadata,
    normalizeStringArray,
    parseAspectralStatsText,
    toRecord
  } = deps;
  function toCatalogEntryRecord(value) {
    return toRecord(value);
  }
  function getAudioAnalysisRequiredToolIds(catalogEntry) {
    const source = toCatalogEntryRecord(catalogEntry);
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
    ...deps,
    parseAspectralStatsText
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
