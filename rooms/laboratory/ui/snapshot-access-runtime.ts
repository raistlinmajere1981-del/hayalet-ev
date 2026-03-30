type LaboratorySnapshotSelectorsApi = {
  getActiveEditOutput: () => unknown;
  getActiveProject: () => unknown;
  getActiveSubtitleEntry: () => unknown;
  getAudioAnalysisCapabilities: () => unknown;
  getAudioAnalysisCatalog: () => unknown;
  getAudioAnalysisCatalogState: () => unknown;
  getAudioAnalysisModules: () => unknown[];
  getAudioAnalysisOrderedResultEntries: () => unknown[];
  getAudioAnalysisPresets: () => unknown;
  getAudioAnalysisProviderEntries: () => unknown;
  getAudioAnalysisProviderState: () => unknown;
  getAudioAnalysisProviders: () => unknown;
  getAudioAnalysisResultMap: () => unknown;
  getAudioAnalysisSourceState: () => unknown;
  getEditCapabilities: () => unknown;
  getEditOutputs: () => unknown[];
  getEditPresets: () => unknown;
  getEditPreview: () => unknown;
  getJobs: () => unknown[];
  getProfileCapabilities: () => unknown;
  getProfileModelState: () => unknown;
  getProfileModelsCatalog: () => unknown;
  getProfilePresets: () => unknown;
  getProjectAudioAnalysis: () => unknown;
  getProjectEdit: () => unknown;
  getProjectProcess: () => unknown;
  getProjectProfile: () => unknown;
  getProjectReport: () => unknown;
  getProjectSource: () => unknown;
  getProjectSubtitleAnalysis: () => unknown;
  getProjectSummaries: () => unknown[];
  getSourceMetadata: () => unknown;
  getSourcePresets: () => unknown;
  getSourceSnapshot: () => unknown;
  getStageToolIds: (stageId: string) => unknown;
  getSubtitleAnalysisCapabilities: () => unknown;
  getSubtitleAnalysisCatalog: () => unknown;
  getSubtitleAnalysisProviders: () => unknown;
  getSubtitleDiscoveryItems: () => unknown;
  getSubtitleDiscoveryState: () => unknown;
  getSubtitleEditPreview: () => unknown;
  getSubtitleEditPresets: () => unknown;
  getSubtitleEditState: () => unknown;
  getSubtitleEntries: () => unknown;
  getSubtitleOutputs: () => unknown;
  getSubtitleProcessModuleLabel: (entry: unknown) => unknown;
  getSubtitleProcessModuleSummary: (entry: unknown) => unknown;
  getSubtitleProcessStatusLabel: (status?: unknown) => unknown;
  getSubtitleProviderLabel: (entry: unknown) => unknown;
  getSubtitleProviderModuleLabels: (entry: unknown) => unknown;
  getSubtitleProviderStatusLabel: (status?: unknown) => unknown;
  getSubtitleProviderSummary: (entry: unknown) => unknown;
  getSubtitleSelectedCandidateIds: () => unknown;
  getSubtitleSelectedEntryIds: () => unknown;
  getSubtitleSourcePresets: () => unknown;
  getSubtitleWorkspace: () => unknown;
  getSubtitleYoutubeForm: () => unknown;
  getToolEntry: (toolId: string) => unknown;
  getToolRegistry: () => unknown[];
  getWorkspaceCapabilities: (kind: string) => unknown;
  getYtDlpForm: () => unknown;
};

type LaboratorySnapshotAccessRuntimeDeps = {
  snapshotSelectors: LaboratorySnapshotSelectorsApi;
};

export function createLaboratorySnapshotAccessRuntime(deps: LaboratorySnapshotAccessRuntimeDeps) {
  const { snapshotSelectors } = deps;

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

  function getSubtitleProcessStatusLabel(status?: unknown) {
    return snapshotSelectors.getSubtitleProcessStatusLabel(status);
  }

  function getSubtitleProviderStatusLabel(status?: unknown) {
    return snapshotSelectors.getSubtitleProviderStatusLabel(status);
  }

  function getSubtitleProcessModuleSummary(entry: unknown) {
    return snapshotSelectors.getSubtitleProcessModuleSummary(entry);
  }

  function getSubtitleProviderSummary(entry: unknown) {
    return snapshotSelectors.getSubtitleProviderSummary(entry);
  }

  function getSubtitleProviderModuleLabels(entry: unknown) {
    return snapshotSelectors.getSubtitleProviderModuleLabels(entry);
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

  function getToolEntry(toolId: string) {
    return snapshotSelectors.getToolEntry(toolId);
  }

  function getStageToolIds(stageId: string) {
    return snapshotSelectors.getStageToolIds(stageId);
  }

  function getWorkspaceCapabilities(kind: string) {
    return snapshotSelectors.getWorkspaceCapabilities(kind);
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

  function getSubtitleProcessModuleLabel(entry: unknown) {
    return snapshotSelectors.getSubtitleProcessModuleLabel(entry);
  }

  function getSubtitleProviderLabel(entry: unknown) {
    return snapshotSelectors.getSubtitleProviderLabel(entry);
  }

  return {
    getActiveEditOutput,
    getActiveProject,
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
    getYtDlpForm,
  };
}
