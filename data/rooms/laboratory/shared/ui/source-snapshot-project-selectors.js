export function createLaboratorySnapshotProjectSelectors(deps) {
  const { getActiveFeatureId, getState, toRecord } = deps;
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function getSourceSnapshot() {
    return getState().sourceSnapshot;
  }
  function getActiveProject() {
    const project = getSourceSnapshot().activeProject;
    return project && typeof project === "object" && Array.isArray(project) === false ? toProjectRecord(project) : null;
  }
  function getProjectSummaries() {
    return Array.isArray(getSourceSnapshot().projects) ? getSourceSnapshot().projects.map(toRecord) : [];
  }
  function getSourcePresets() {
    return toRecord(getSourceSnapshot().sourcePresets);
  }
  function getYtDlpForm() {
    return toRecord(getSourceSnapshot().ytDlpForm);
  }
  function getEditPresets() {
    return toRecord(getSourceSnapshot().editPresets);
  }
  function getEditCapabilities() {
    return toRecord(getSourceSnapshot().editCapabilities);
  }
  function getProfilePresets() {
    return toRecord(getSourceSnapshot().profilePresets);
  }
  function getProfileCapabilities() {
    return toRecord(getSourceSnapshot().profileCapabilities);
  }
  function getProfileModelsCatalog() {
    return toRecord(getSourceSnapshot().profileModels);
  }
  function getProfileModelState() {
    return toRecord(getSourceSnapshot().profileModelState);
  }
  function getToolRegistry() {
    return Array.isArray(getSourceSnapshot().toolRegistry) ? getSourceSnapshot().toolRegistry.map(toRecord) : [];
  }
  function getProjectSource() {
    return toRecord(getActiveProject()?.source);
  }
  function getProjectEdit() {
    return toRecord(getActiveProject()?.edit);
  }
  function getProjectProfile() {
    return toRecord(getActiveProject()?.profile);
  }
  function getProjectWorkbench() {
    return toRecord(getActiveProject()?.workbench);
  }
  function getProjectProcess() {
    return toRecord(getActiveProject()?.process);
  }
  function getProjectReport() {
    return toRecord(getActiveProject()?.report);
  }
  function getProjectAudioAnalysis() {
    return toRecord(getActiveProject()?.audioAnalysis);
  }
  function getProjectSubtitleAnalysis() {
    return toRecord(getActiveProject()?.subtitleAnalysis);
  }
  function getVisualAnalysisCatalog() {
    return toRecord(getSourceSnapshot()["visualAnalysisCatalog"]);
  }
  function getVisualAnalysisCapabilities() {
    return toRecord(getSourceSnapshot()["visualAnalysisCapabilities"]);
  }
  function getVisualAnalysisProviders() {
    return toRecord(getSourceSnapshot()["visualAnalysisProviders"]);
  }
  function getCurrentFeatureProcessRecord() {
    const records = toRecord(getProjectProcess()["records"]);
    return toRecord(records[getActiveFeatureId()]);
  }
  function getCurrentFeatureReportRecord() {
    const records = toRecord(getProjectReport()["records"]);
    return toRecord(records[getActiveFeatureId()]);
  }
  function getSourceMetadata() {
    return toRecord(getProjectSource()["metadata"]);
  }
  function getEditPreview() {
    return toRecord(getProjectEdit()["preview"]);
  }
  function getEditOutputs() {
    const outputs = getProjectEdit()["outputs"];
    return Array.isArray(outputs) ? outputs.map(toRecord) : [];
  }
  function getActiveEditOutput() {
    const projectEdit = getProjectEdit();
    const activeOutputIdValue = projectEdit["activeOutputId"];
    const activeOutputId = typeof activeOutputIdValue === "string" && activeOutputIdValue.trim() !== "" ? activeOutputIdValue.trim() : null;
    return getEditOutputs().find(function(entry) {
      return activeOutputId !== null && typeof entry["id"] === "string" && entry["id"] === activeOutputId;
    }) || null;
  }
  function getJobs() {
    return Array.isArray(getSourceSnapshot().jobs) ? getSourceSnapshot().jobs.map(toRecord) : [];
  }
  return {
    getSourceSnapshot,
    getActiveProject,
    getProjectSummaries,
    getSourcePresets,
    getYtDlpForm,
    getEditPresets,
    getEditCapabilities,
    getProfilePresets,
    getProfileCapabilities,
    getProfileModelsCatalog,
    getProfileModelState,
    getToolRegistry,
    getProjectSource,
    getProjectEdit,
    getProjectProfile,
    getProjectWorkbench,
    getProjectProcess,
    getProjectReport,
    getProjectAudioAnalysis,
    getProjectSubtitleAnalysis,
    getVisualAnalysisCatalog,
    getVisualAnalysisCapabilities,
    getVisualAnalysisProviders,
    getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord,
    getSourceMetadata,
    getEditPreview,
    getEditOutputs,
    getActiveEditOutput,
    getJobs
  };
}
