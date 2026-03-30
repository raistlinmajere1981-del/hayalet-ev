type LaboratoryRecord = Record<string, unknown>;

type LaboratorySubtitleAnalysisStateRecord = LaboratoryRecord & {
  activeEntryId?: unknown;
  discovery?: unknown;
  edit?: unknown;
  entries?: unknown;
  workspace?: unknown;
};

type LaboratorySubtitleDiscoveryRecord = LaboratoryRecord & {
  items?: unknown;
  selectedCandidateIds?: unknown;
};

type LaboratorySubtitleWorkspaceRecord = LaboratoryRecord & {
  selection?: unknown;
};

type LaboratorySubtitleEditRecord = LaboratoryRecord & {
  outputs?: unknown;
  preview?: unknown;
};

type LaboratorySnapshotSubtitleSelectorsDeps = {
  formatStatusLabel: (value: unknown) => string;
  getProjectSubtitleAnalysis: () => unknown;
  getSourceSnapshot: () => unknown;
  subtitleTemplate: (
    path: string[],
    variables: Record<string, string>,
    tr: string,
    en: string
  ) => string;
  subtitleText: (path: string[], tr: string, en: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratorySnapshotSubtitleSelectors(
  deps: LaboratorySnapshotSubtitleSelectorsDeps
) {
  const {
    formatStatusLabel,
    getProjectSubtitleAnalysis,
    getSourceSnapshot,
    subtitleTemplate,
    subtitleText,
    toRecord,
  } = deps;

  function toSubtitleAnalysisStateRecord(value: unknown): LaboratorySubtitleAnalysisStateRecord {
    return toRecord(value);
  }

  function toSubtitleDiscoveryRecord(value: unknown): LaboratorySubtitleDiscoveryRecord {
    return toRecord(value);
  }

  function toSubtitleWorkspaceRecord(value: unknown): LaboratorySubtitleWorkspaceRecord {
    return toRecord(value);
  }

  function toSubtitleEditRecord(value: unknown): LaboratorySubtitleEditRecord {
    return toRecord(value);
  }

  function toString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return toString(entry);
      })
      .filter((entry): entry is string => entry !== null);
  }

  function getSourceSnapshotRecord() {
    return toRecord(getSourceSnapshot());
  }

  function getProjectSubtitleAnalysisRecord(): LaboratorySubtitleAnalysisStateRecord {
    return toSubtitleAnalysisStateRecord(getProjectSubtitleAnalysis());
  }

  function getSubtitleSourcePresets() {
    return toRecord(getSourceSnapshotRecord()["subtitleSourcePresets"]);
  }

  function getSubtitleYoutubeForm() {
    return toRecord(getSourceSnapshotRecord()["subtitleYoutubeForm"]);
  }

  function getSubtitleEditPresets() {
    return toRecord(getSourceSnapshotRecord()["subtitleEditPresets"]);
  }

  function getSubtitleAnalysisCatalog() {
    return toRecord(getSourceSnapshotRecord()["subtitleAnalysisCatalog"]);
  }

  function getSubtitleAnalysisCapabilities() {
    return toRecord(getSourceSnapshotRecord()["subtitleAnalysisCapabilities"]);
  }

  function getSubtitleAnalysisProviders() {
    return toRecord(getSourceSnapshotRecord()["subtitleAnalysisProviders"]);
  }

  function getSubtitleProcessStatusLabel(status: unknown) {
    const token = toString(status) || "planned";
    const localized = subtitleText(["process", "catalog", "status", token], "", "");
    return localized || formatStatusLabel(token);
  }

  function getSubtitleProviderStatusLabel(status: unknown) {
    const token = toString(status) || "planned";
    const localized = subtitleText(["process", "providers", "status", token], "", "");
    return localized || formatStatusLabel(token);
  }

  function getSubtitleProcessModuleLabel(entry: unknown) {
    const moduleId = toString(toRecord(entry)["id"]) || "";
    const localized = moduleId
      ? subtitleText(["process", "catalog", "modules", moduleId, "label"], "", "")
      : "";
    return localized || toString(toRecord(entry)["label"]) || moduleId || "--";
  }

  function getSubtitleProcessModuleSummary(entry: unknown) {
    const moduleId = toString(toRecord(entry)["id"]) || "";
    return moduleId
      ? subtitleText(["process", "catalog", "modules", moduleId, "summary"], "", "")
      : "";
  }

  function getSubtitleProviderLabel(entry: unknown) {
    const providerId = toString(toRecord(entry)["id"]) || "";
    const localized = providerId
      ? subtitleText(["process", "providers", "items", providerId, "label"], "", "")
      : "";
    return localized || providerId || "--";
  }

  function getSubtitleProviderSummary(entry: unknown) {
    const providerId = toString(toRecord(entry)["id"]) || "";
    return providerId
      ? subtitleText(["process", "providers", "items", providerId, "summary"], "", "")
      : "";
  }

  function getSubtitleProviderModuleLabels(entry: unknown) {
    const moduleIds = toStringArray(toRecord(entry)["moduleIds"]);
    const labels = moduleIds
      .map(function (moduleId) {
        return getSubtitleProcessModuleLabel({ id: moduleId });
      })
      .filter(Boolean);

    if (labels.length === 0) {
      return subtitleText(
        ["process", "providers", "emptyModules"],
        "Modul bagli degil",
        "No linked modules"
      );
    }

    return subtitleTemplate(
      ["process", "providers", "labels", "modules"],
      { value: labels.join(", ") },
      `Moduller: ${labels.join(", ")}`,
      `Modules: ${labels.join(", ")}`
    );
  }

  function getSubtitleWorkspace() {
    return toSubtitleWorkspaceRecord(getProjectSubtitleAnalysisRecord().workspace);
  }

  function getSubtitleDiscoveryState() {
    return toSubtitleDiscoveryRecord(getProjectSubtitleAnalysisRecord().discovery);
  }

  function getSubtitleDiscoveryItems() {
    const items = getSubtitleDiscoveryState().items;
    return Array.isArray(items) ? items.map(toRecord) : [];
  }

  function getSubtitleSelectedCandidateIds() {
    return toStringArray(getSubtitleDiscoveryState().selectedCandidateIds);
  }

  function getSubtitleEntries(): LaboratoryRecord[] {
    const entries = getProjectSubtitleAnalysisRecord().entries;
    return Array.isArray(entries) ? entries.map(toRecord) : [];
  }

  function getActiveSubtitleEntry() {
    const activeEntryId = toString(getProjectSubtitleAnalysisRecord().activeEntryId);
    return (
      getSubtitleEntries().find(function (entry) {
        return activeEntryId !== null && toString(entry["id"]) === activeEntryId;
      }) ||
      getSubtitleEntries()[0] ||
      null
    );
  }

  function getSubtitleSelectedEntryIds() {
    return toStringArray(toRecord(getSubtitleWorkspace().selection)["selectedEntryIds"]);
  }

  function getSubtitleEditState() {
    return toSubtitleEditRecord(getProjectSubtitleAnalysisRecord().edit);
  }

  function getSubtitleEditPreview() {
    return toRecord(getSubtitleEditState().preview);
  }

  function getSubtitleOutputs() {
    const outputs = getSubtitleEditState().outputs;
    return Array.isArray(outputs) ? outputs.map(toRecord) : [];
  }

  return {
    getSubtitleSourcePresets,
    getSubtitleYoutubeForm,
    getSubtitleEditPresets,
    getSubtitleAnalysisCatalog,
    getSubtitleAnalysisCapabilities,
    getSubtitleAnalysisProviders,
    getSubtitleProcessStatusLabel,
    getSubtitleProviderStatusLabel,
    getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary,
    getSubtitleProviderLabel,
    getSubtitleProviderSummary,
    getSubtitleProviderModuleLabels,
    getSubtitleWorkspace,
    getSubtitleDiscoveryState,
    getSubtitleDiscoveryItems,
    getSubtitleSelectedCandidateIds,
    getSubtitleEntries,
    getActiveSubtitleEntry,
    getSubtitleSelectedEntryIds,
    getSubtitleEditState,
    getSubtitleEditPreview,
    getSubtitleOutputs,
  };
}
