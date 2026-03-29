export function createLaboratorySnapshotAccessRuntime(deps) {
  const snapshotSelectors = deps.snapshotSelectors;
  function getSourceSnapshot() {
    return snapshotSelectors.getSourceSnapshot();
  }
  function getProjectSummaries() {
    return snapshotSelectors.getProjectSummaries();
  }
  function getActiveProject() {
    return snapshotSelectors.getActiveProject();
  }
  function getSourcePresets() {
    return snapshotSelectors.getSourcePresets();
  }
  function getYtDlpForm() {
    return snapshotSelectors.getYtDlpForm();
  }
  function getEditPresets() {
    return snapshotSelectors.getEditPresets();
  }
  function getEditCapabilities() {
    return snapshotSelectors.getEditCapabilities();
  }
  function getProfilePresets() {
    return snapshotSelectors.getProfilePresets();
  }
  function getProfileCapabilities() {
    return snapshotSelectors.getProfileCapabilities();
  }
  function getProfileModelsCatalog() {
    return snapshotSelectors.getProfileModelsCatalog();
  }
  function getProfileModelState() {
    return snapshotSelectors.getProfileModelState();
  }
  function getSubtitleSourcePresets() {
    return snapshotSelectors.getSubtitleSourcePresets();
  }
  function getSubtitleYoutubeForm() {
    return snapshotSelectors.getSubtitleYoutubeForm();
  }
  function getSubtitleEditPresets() {
    return snapshotSelectors.getSubtitleEditPresets();
  }
  function getSubtitleAnalysisCatalog() {
    return snapshotSelectors.getSubtitleAnalysisCatalog();
  }
  function getSubtitleAnalysisCapabilities() {
    return snapshotSelectors.getSubtitleAnalysisCapabilities();
  }
  function getSubtitleAnalysisProviders() {
    return snapshotSelectors.getSubtitleAnalysisProviders();
  }
  function getSubtitleProcessStatusLabel() {
    return snapshotSelectors.getSubtitleProcessStatusLabel();
  }
  function getSubtitleProviderStatusLabel() {
    return snapshotSelectors.getSubtitleProviderStatusLabel();
  }
  function getSubtitleProcessModuleSummary() {
    return snapshotSelectors.getSubtitleProcessModuleSummary();
  }
  function getSubtitleProviderSummary() {
    return snapshotSelectors.getSubtitleProviderSummary();
  }
  function getSubtitleProviderModuleLabels() {
    return snapshotSelectors.getSubtitleProviderModuleLabels();
  }
  function getAudioAnalysisCatalog() {
    return snapshotSelectors.getAudioAnalysisCatalog();
  }
  function getAudioAnalysisModules() {
    return snapshotSelectors.getAudioAnalysisModules();
  }
  function getToolRegistry() {
    return snapshotSelectors.getToolRegistry();
  }
  function getProjectSource() {
    return snapshotSelectors.getProjectSource();
  }
  function getProjectEdit() {
    return snapshotSelectors.getProjectEdit();
  }
  function getProjectProfile() {
    return snapshotSelectors.getProjectProfile();
  }
  function getProjectProcess() {
    return snapshotSelectors.getProjectProcess();
  }
  function getProjectReport() {
    return snapshotSelectors.getProjectReport();
  }
  function getProjectSubtitleAnalysis() {
    return snapshotSelectors.getProjectSubtitleAnalysis();
  }
  function getSubtitleWorkspace() {
    return snapshotSelectors.getSubtitleWorkspace();
  }
  function getSubtitleDiscoveryState() {
    return snapshotSelectors.getSubtitleDiscoveryState();
  }
  function getSubtitleDiscoveryItems() {
    return snapshotSelectors.getSubtitleDiscoveryItems();
  }
  function getSubtitleSelectedCandidateIds() {
    return snapshotSelectors.getSubtitleSelectedCandidateIds();
  }
  function getActiveSubtitleEntry() {
    return snapshotSelectors.getActiveSubtitleEntry();
  }
  function getSubtitleSelectedEntryIds() {
    return snapshotSelectors.getSubtitleSelectedEntryIds();
  }
  function getSubtitleEditState() {
    return snapshotSelectors.getSubtitleEditState();
  }
  function getSubtitleEditPreview() {
    return snapshotSelectors.getSubtitleEditPreview();
  }
  function getSubtitleOutputs() {
    return snapshotSelectors.getSubtitleOutputs();
  }
  function getAudioAnalysisSourceState() {
    return snapshotSelectors.getAudioAnalysisSourceState();
  }
  function getAudioAnalysisCatalogState() {
    return snapshotSelectors.getAudioAnalysisCatalogState();
  }
  function getAudioAnalysisProviderState() {
    return snapshotSelectors.getAudioAnalysisProviderState();
  }
  function getAudioAnalysisResultMap() {
    return snapshotSelectors.getAudioAnalysisResultMap();
  }
  function getSourceMetadata() {
    return snapshotSelectors.getSourceMetadata();
  }
  function getEditPreview() {
    return snapshotSelectors.getEditPreview();
  }
  function getEditOutputs() {
    return snapshotSelectors.getEditOutputs();
  }
  function getActiveEditOutput() {
    return snapshotSelectors.getActiveEditOutput();
  }
  function getToolEntry() {
    return snapshotSelectors.getToolEntry();
  }
  function getStageToolIds() {
    return snapshotSelectors.getStageToolIds();
  }
  function getWorkspaceCapabilities() {
    return snapshotSelectors.getWorkspaceCapabilities();
  }
  function getJobs() {
    return snapshotSelectors.getJobs();
  }
  function getProjectAudioAnalysis() {
    return snapshotSelectors.getProjectAudioAnalysis();
  }
  function getAudioAnalysisCapabilities() {
    return snapshotSelectors.getAudioAnalysisCapabilities();
  }
  function getAudioAnalysisPresets() {
    return snapshotSelectors.getAudioAnalysisPresets();
  }
  function getAudioAnalysisProviders() {
    return snapshotSelectors.getAudioAnalysisProviders();
  }
  function getAudioAnalysisOrderedResultEntries() {
    return snapshotSelectors.getAudioAnalysisOrderedResultEntries();
  }
  function getSubtitleEntries() {
    return snapshotSelectors.getSubtitleEntries();
  }
  function getSubtitleProcessModuleLabel(entry) {
    return snapshotSelectors.getSubtitleProcessModuleLabel(entry);
  }
  function getSubtitleProviderLabel(entry) {
    return snapshotSelectors.getSubtitleProviderLabel(entry);
  }
  return {
    getActiveEditOutput,
    getActiveSubtitleEntry,
    getAudioAnalysisCapabilities,
    getAudioAnalysisCatalog,
    getAudioAnalysisCatalogState,
    getAudioAnalysisModules,
    getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisPresets,
    getAudioAnalysisProviderState,
    getAudioAnalysisProviders,
    getAudioAnalysisResultMap,
    getAudioAnalysisSourceState,
    getEditCapabilities,
    getEditOutputs,
    getEditPresets,
    getEditPreview,
    getActiveProject,
    getJobs,
    getProfileCapabilities,
    getProfileModelState,
    getProfileModelsCatalog,
    getProfilePresets,
    getProjectAudioAnalysis,
    getProjectEdit,
    getProjectProcess,
    getProjectProfile,
    getProjectReport,
    getProjectSource,
    getProjectSubtitleAnalysis,
    getProjectSummaries,
    getSourceMetadata,
    getSourcePresets,
    getSourceSnapshot,
    getStageToolIds,
    getSubtitleAnalysisCapabilities,
    getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders,
    getSubtitleDiscoveryItems,
    getSubtitleDiscoveryState,
    getSubtitleEditPreview,
    getSubtitleEditPresets,
    getSubtitleEditState,
    getSubtitleEntries,
    getSubtitleOutputs,
    getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary,
    getSubtitleProcessStatusLabel,
    getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels,
    getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary,
    getSubtitleSelectedCandidateIds,
    getSubtitleSelectedEntryIds,
    getSubtitleSourcePresets,
    getSubtitleWorkspace,
    getSubtitleYoutubeForm,
    getToolEntry,
    getToolRegistry,
    getWorkspaceCapabilities,
    getYtDlpForm
  };
}
