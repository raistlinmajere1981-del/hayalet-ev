import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryProjectRecord = LaboratoryRecord & {
  audioAnalysis?: unknown;
  edit?: unknown;
  process?: unknown;
  profile?: unknown;
  report?: unknown;
  source?: unknown;
  subtitleAnalysis?: unknown;
};

type LaboratorySourceSnapshotProjectSelectorsDeps = {
  getActiveFeatureId: () => string;
  getState: () => LaboratoryUiState;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratorySnapshotProjectSelectors(
  deps: LaboratorySourceSnapshotProjectSelectorsDeps
) {
  const { getActiveFeatureId, getState, toRecord } = deps;

  function toProjectRecord(value: unknown): LaboratoryProjectRecord {
    return toRecord(value);
  }

  function getSourceSnapshot() {
    return getState().sourceSnapshot;
  }

  function getActiveProject(): LaboratoryProjectRecord | null {
    const project = getSourceSnapshot().activeProject;
    return project && typeof project === "object" && Array.isArray(project) === false
      ? toProjectRecord(project)
      : null;
  }

  function getProjectSummaries(): LaboratoryRecord[] {
    return Array.isArray(getSourceSnapshot().projects)
      ? getSourceSnapshot().projects.map(toRecord)
      : [];
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

  function getToolRegistry(): LaboratoryRecord[] {
    return Array.isArray(getSourceSnapshot().toolRegistry)
      ? getSourceSnapshot().toolRegistry.map(toRecord)
      : [];
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

  function getEditOutputs(): LaboratoryRecord[] {
    const outputs = getProjectEdit()["outputs"];
    return Array.isArray(outputs) ? outputs.map(toRecord) : [];
  }

  function getActiveEditOutput(): LaboratoryRecord | null {
    const projectEdit = getProjectEdit();
    const activeOutputIdValue = projectEdit["activeOutputId"];
    const activeOutputId =
      typeof activeOutputIdValue === "string" && activeOutputIdValue.trim() !== ""
        ? activeOutputIdValue.trim()
        : null;

    return (
      getEditOutputs().find(function (entry) {
        return (
          activeOutputId !== null &&
          typeof entry["id"] === "string" &&
          entry["id"] === activeOutputId
        );
      }) || null
    );
  }

  function getJobs(): LaboratoryRecord[] {
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
    getJobs,
  };
}
