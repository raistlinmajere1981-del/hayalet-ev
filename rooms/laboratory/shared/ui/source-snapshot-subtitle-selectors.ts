// @ts-nocheck
export function createLaboratorySnapshotSubtitleSelectors(deps) {
  const toRecord = deps.toRecord;
  const subtitleText = deps.subtitleText;
  const subtitleTemplate = deps.subtitleTemplate;
  const formatStatusLabel = deps.formatStatusLabel;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getProjectSubtitleAnalysis = deps.getProjectSubtitleAnalysis;

  function getSubtitleSourcePresets() {
    return toRecord(getSourceSnapshot().subtitleSourcePresets);
  }

  function getSubtitleYoutubeForm() {
    return toRecord(getSourceSnapshot().subtitleYoutubeForm);
  }

  function getSubtitleEditPresets() {
    return toRecord(getSourceSnapshot().subtitleEditPresets);
  }

  function getSubtitleAnalysisCatalog() {
    return toRecord(getSourceSnapshot().subtitleAnalysisCatalog);
  }

  function getSubtitleAnalysisCapabilities() {
    return toRecord(getSourceSnapshot().subtitleAnalysisCapabilities);
  }

  function getSubtitleAnalysisProviders() {
    return toRecord(getSourceSnapshot().subtitleAnalysisProviders);
  }

  function getSubtitleProcessStatusLabel(status) {
    const token = typeof status === "string" && status.trim() !== "" ? status.trim() : "planned";
    const localized = subtitleText(["process", "catalog", "status", token], "", "");
    return localized || formatStatusLabel(token);
  }

  function getSubtitleProviderStatusLabel(status) {
    const token = typeof status === "string" && status.trim() !== "" ? status.trim() : "planned";
    const localized = subtitleText(["process", "providers", "status", token], "", "");
    return localized || formatStatusLabel(token);
  }

  function getSubtitleProcessModuleLabel(entry) {
    const moduleId = typeof toRecord(entry).id === "string" ? toRecord(entry).id : "";
    const localized = moduleId
      ? subtitleText(["process", "catalog", "modules", moduleId, "label"], "", "")
      : "";
    return localized || toRecord(entry).label || moduleId || "--";
  }

  function getSubtitleProcessModuleSummary(entry) {
    const moduleId = typeof toRecord(entry).id === "string" ? toRecord(entry).id : "";
    return moduleId ? subtitleText(["process", "catalog", "modules", moduleId, "summary"], "", "") : "";
  }

  function getSubtitleProviderLabel(entry) {
    const providerId = typeof toRecord(entry).id === "string" ? toRecord(entry).id : "";
    const localized = providerId
      ? subtitleText(["process", "providers", "items", providerId, "label"], "", "")
      : "";
    return localized || providerId || "--";
  }

  function getSubtitleProviderSummary(entry) {
    const providerId = typeof toRecord(entry).id === "string" ? toRecord(entry).id : "";
    return providerId ? subtitleText(["process", "providers", "items", providerId, "summary"], "", "") : "";
  }

  function getSubtitleProviderModuleLabels(entry) {
    const moduleIds = Array.isArray(toRecord(entry).moduleIds) ? toRecord(entry).moduleIds : [];
    const labels = moduleIds
      .map(function (moduleId) {
        return getSubtitleProcessModuleLabel({ id: moduleId });
      })
      .filter(Boolean);

    if (labels.length === 0) {
      return subtitleText(["process", "providers", "emptyModules"], "Modul bagli degil", "No linked modules");
    }

    return subtitleTemplate(
      ["process", "providers", "labels", "modules"],
      { value: labels.join(", ") },
      `Moduller: ${labels.join(", ")}`,
      `Modules: ${labels.join(", ")}`
    );
  }

  function getSubtitleWorkspace() {
    return toRecord(getProjectSubtitleAnalysis().workspace);
  }

  function getSubtitleDiscoveryState() {
    return toRecord(getProjectSubtitleAnalysis().discovery);
  }

  function getSubtitleDiscoveryItems() {
    const items = getSubtitleDiscoveryState().items;
    return Array.isArray(items) ? items.map(toRecord) : [];
  }

  function getSubtitleSelectedCandidateIds() {
    const selectedCandidateIds = getSubtitleDiscoveryState().selectedCandidateIds;
    return Array.isArray(selectedCandidateIds)
      ? selectedCandidateIds.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [];
  }

  function getSubtitleEntries() {
    const entries = getProjectSubtitleAnalysis().entries;
    return Array.isArray(entries) ? entries.map(toRecord) : [];
  }

  function getActiveSubtitleEntry() {
    const activeEntryId =
      typeof getProjectSubtitleAnalysis().activeEntryId === "string"
        ? getProjectSubtitleAnalysis().activeEntryId
        : null;
    return (
      getSubtitleEntries().find(function (entry) {
        return activeEntryId !== null && entry.id === activeEntryId;
      }) || getSubtitleEntries()[0] || null
    );
  }

  function getSubtitleSelectedEntryIds() {
    const selectedEntryIds = toRecord(getSubtitleWorkspace().selection).selectedEntryIds;
    return Array.isArray(selectedEntryIds)
      ? selectedEntryIds.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [];
  }

  function getSubtitleEditState() {
    return toRecord(getProjectSubtitleAnalysis().edit);
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
