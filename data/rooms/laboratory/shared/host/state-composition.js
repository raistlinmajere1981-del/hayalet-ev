import { createLaboratoryCloseoutStalenessRuntime } from "./closeout-staleness.js";
import { createLaboratoryProcessReportStateRuntime } from "./process-report-state.js";
import { createLaboratoryProjectRecordsRuntime } from "./project-records.js";
import { createLaboratoryProjectStateDelegatesRuntime } from "./project-state-delegates.js";
import { createLaboratorySubtitleProjectionRuntime } from "./subtitle-projection.js";
import { createSubtitleStateDelegatesRuntime } from "../../main-functions/subtitle-analysis/host/state-delegates.js";
import { createSubtitleStateRuntime } from "../../main-functions/subtitle-analysis/host/state.js";
export function createLaboratoryHostStateCompositionRuntime(deps) {
  const laboratoryProcessReportStateRuntime = createLaboratoryProcessReportStateRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    featureIds: deps.featureIds,
    normalizeProfileArtifact: deps.getMediaProfileStateRuntime().normalizeProfileArtifact,
    normalizeProfileSignal: deps.getMediaProfileStateRuntime().normalizeProfileSignal,
    toRecord: deps.toRecord
  });
  const {
    createEmptyFeatureProcessRecord,
    createEmptyProcessState,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeFeatureProcessRecord,
    normalizeProcessState,
    createEmptyFeatureReportRecord,
    createEmptyReportState,
    normalizeReportSummaryCard,
    normalizeReportExport,
    normalizeFeatureReportRecord,
    normalizeReportState,
    getFeatureProcessRecord,
    setFeatureProcessRecord,
    getFeatureReportRecord,
    setFeatureReportRecord
  } = laboratoryProcessReportStateRuntime;
  const laboratoryCloseoutStalenessRuntime = createLaboratoryCloseoutStalenessRuntime({
    featureIds: deps.featureIds,
    getFeatureProcessRecord,
    setFeatureProcessRecord,
    getFeatureReportRecord,
    setFeatureReportRecord
  });
  const laboratoryProjectStateDelegatesRuntime = createLaboratoryProjectStateDelegatesRuntime({
    getMediaProfileStateRuntime: deps.getMediaProfileStateRuntime,
    getProcessReportStateRuntime() {
      return laboratoryProcessReportStateRuntime;
    },
    getProjectStateRuntime: deps.getProjectStateRuntime
  });
  const subtitleStateRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    markFeatureProcessStale: deps.markFeatureProcessStale,
    markFeatureReportStale: deps.markFeatureReportStale,
    normalizeReportExport,
    normalizeStringArray: deps.normalizeStringArray,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord
  };
  const subtitleStateRuntime = createSubtitleStateRuntime(subtitleStateRuntimeDeps);
  const laboratorySubtitleStateDelegatesRuntime = createSubtitleStateDelegatesRuntime({
    subtitleStateRuntime
  });
  const {
    createEmptySubtitleAnalysisState,
    createEmptySubtitleDiscoveryState,
    createSubtitleEntryRecord,
    getActiveSubtitleEntry,
    getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe,
    getSubtitleEntries,
    getSubtitleEntryById,
    getSubtitleMimeType,
    getSubtitleSelectedEntries,
    isSubtitleFileName,
    normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem,
    normalizeSubtitleEntryRecord,
    normalizeSubtitleOutputRecord,
    resetSubtitleDiscovery,
    resetSubtitleFeatureState,
    upsertSubtitleEntries
  } = laboratorySubtitleStateDelegatesRuntime;
  const laboratoryProjectRecordsRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    buildProjectName: deps.buildProjectName,
    buildProjectSlug: deps.buildProjectSlug,
    clone: deps.clone,
    createDefaultEditState: deps.createDefaultEditState,
    createDefaultProfileState: deps.createDefaultProfileState,
    createEmptyAudioAnalysisState: deps.createEmptyAudioAnalysisState,
    createEmptyProcessState,
    createEmptyReportState,
    createEmptySubtitleAnalysisState,
    createEmptySourceDrafts: deps.createEmptySourceDrafts,
    getDefaultMode: deps.getDefaultMode,
    getDefaultSourceType: deps.getDefaultSourceType,
    getDefaultYoutubePreset: deps.getDefaultYoutubePreset,
    getPreferredFeatureSourceKind: deps.getPreferredFeatureSourceKind,
    getPresetDefaultCustomValues: deps.getPresetDefaultCustomValues,
    normalizeAudioAnalysisState: deps.normalizeAudioAnalysisState,
    normalizeEditState: deps.normalizeEditState,
    normalizeProfileState: deps.normalizeProfileState,
    normalizeProcessState,
    normalizeReportState,
    normalizeSourceMetadata: deps.normalizeSourceMetadata,
    normalizeSubtitleAnalysisState,
    projectSchemaVersion: deps.projectSchemaVersion,
    toRecord: deps.toRecord
  };
  const laboratoryProjectRecordsRuntime = createLaboratoryProjectRecordsRuntime(
    laboratoryProjectRecordsRuntimeDeps
  );
  const {
    createProjectRecord,
    findProject,
    getActiveProject,
    normalizeProject,
    updateProjectTimestamps
  } = laboratoryProjectRecordsRuntime;
  const laboratorySubtitleProjectionRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeReportExport,
    normalizeReportSummaryCard,
    normalizeSubtitleAnalysisState,
    readFeatureProcessRecord: getFeatureProcessRecord,
    readFeatureReportRecord: getFeatureReportRecord,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord
  };
  const laboratorySubtitleProjectionRuntime = createLaboratorySubtitleProjectionRuntime(
    laboratorySubtitleProjectionRuntimeDeps
  );
  const { syncProjectSubtitleAnalysisProjection } = laboratorySubtitleProjectionRuntime;
  return {
    createEmptyFeatureProcessRecord,
    createEmptyFeatureReportRecord,
    createEmptyProcessState,
    createEmptyReportState,
    createEmptySubtitleAnalysisState,
    createEmptySubtitleDiscoveryState,
    createProjectRecord,
    createSubtitleEntryRecord,
    findProject,
    getActiveProject,
    getActiveSubtitleEntry,
    getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe,
    getFeatureProcessRecord,
    getFeatureReportRecord,
    getSubtitleEntries,
    getSubtitleEntryById,
    getSubtitleMimeType,
    getSubtitleSelectedEntries,
    isSubtitleFileName,
    laboratoryCloseoutStalenessRuntime,
    laboratoryProcessReportStateRuntime,
    laboratoryProjectRecordsRuntime,
    laboratoryProjectStateDelegatesRuntime,
    laboratorySubtitleProjectionRuntime,
    laboratorySubtitleStateDelegatesRuntime,
    normalizeFeatureProcessRecord,
    normalizeFeatureReportRecord,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeProcessState,
    normalizeReportExport,
    normalizeReportState,
    normalizeReportSummaryCard,
    normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem,
    normalizeSubtitleEntryRecord,
    normalizeSubtitleOutputRecord,
    normalizeProject,
    resetSubtitleDiscovery,
    resetSubtitleFeatureState,
    setFeatureProcessRecord,
    setFeatureReportRecord,
    syncProjectSubtitleAnalysisProjection,
    updateProjectTimestamps,
    upsertSubtitleEntries
  };
}
