export function createLaboratorySnapshotProjectSelectors(deps) {
  const getState = deps.getState;
  const toRecord = deps.toRecord;
  const getActiveFeatureId = deps.getActiveFeatureId;
  function getSourceSnapshot() {
    const state = getState();
    return toRecord(state.sourceSnapshot);
  }
  function getActiveProject() {
    const project = getSourceSnapshot().activeProject;
    return project && typeof project === "object" && Array.isArray(project) === false ? project : null;
  }
  function getProjectSummaries() {
    const projects = getSourceSnapshot().projects;
    return Array.isArray(projects) ? projects : [];
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
    const toolRegistry = getSourceSnapshot().toolRegistry;
    return Array.isArray(toolRegistry) ? toolRegistry.map(toRecord) : [];
  }
  function getProjectSource() {
    const project = getActiveProject();
    return project ? toRecord(project.source) : {};
  }
  function getProjectEdit() {
    const project = getActiveProject();
    return project ? toRecord(project.edit) : {};
  }
  function getProjectProfile() {
    const project = getActiveProject();
    return project ? toRecord(project.profile) : {};
  }
  function getProjectProcess() {
    const project = getActiveProject();
    return project ? toRecord(project.process) : {};
  }
  function getProjectReport() {
    const project = getActiveProject();
    return project ? toRecord(project.report) : {};
  }
  function getProjectAudioAnalysis() {
    const project = getActiveProject();
    return project ? toRecord(project.audioAnalysis) : {};
  }
  function getProjectSubtitleAnalysis() {
    const project = getActiveProject();
    return project ? toRecord(project.subtitleAnalysis) : {};
  }
  function getCurrentFeatureProcessRecord() {
    return toRecord(toRecord(getProjectProcess().records)[getActiveFeatureId()]);
  }
  function getCurrentFeatureReportRecord() {
    return toRecord(toRecord(getProjectReport().records)[getActiveFeatureId()]);
  }
  function getSourceMetadata() {
    return toRecord(getProjectSource().metadata);
  }
  function getEditPreview() {
    return toRecord(getProjectEdit().preview);
  }
  function getEditOutputs() {
    const outputs = getProjectEdit().outputs;
    return Array.isArray(outputs) ? outputs.map(function(entry) {
      return toRecord(entry);
    }) : [];
  }
  function getActiveEditOutput() {
    const edit = getProjectEdit();
    const activeOutputId = typeof edit.activeOutputId === "string" && edit.activeOutputId.trim() !== "" ? edit.activeOutputId : null;
    return getEditOutputs().find(function(entry) {
      return activeOutputId !== null && entry.id === activeOutputId;
    }) || null;
  }
  function getJobs() {
    const jobs = getSourceSnapshot().jobs;
    return Array.isArray(jobs) ? jobs : [];
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
    getProjectProcess,
    getProjectReport,
    getProjectAudioAnalysis,
    getProjectSubtitleAnalysis,
    getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord,
    getSourceMetadata,
    getEditPreview,
    getEditOutputs,
    getActiveEditOutput,
    getJobs
  };
}
