export function createSourceSnapshotSelectors(deps) {
  const getState = deps.getState;
  const toRecord = deps.toRecord;
  const subtitleText = deps.subtitleText;
  const subtitleTemplate = deps.subtitleTemplate;
  const formatStatusLabel = deps.formatStatusLabel;
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

  function getAudioAnalysisCatalog() {
    return toRecord(getSourceSnapshot().audioAnalysisCatalog);
  }

  function getAudioAnalysisCapabilities() {
    return toRecord(getSourceSnapshot().audioAnalysisCapabilities);
  }

  function getAudioAnalysisPresets() {
    return toRecord(getSourceSnapshot().audioAnalysisPresets);
  }

  function getAudioAnalysisProviders() {
    return toRecord(getSourceSnapshot().audioAnalysisProviders);
  }

  function getAudioAnalysisModules() {
    const modules = getAudioAnalysisCatalog().modules;
    return Array.isArray(modules) ? modules.map(toRecord) : [];
  }

  function getAudioAnalysisProviderEntries() {
    const providers = getAudioAnalysisProviders().providers;
    return Array.isArray(providers) ? providers.map(toRecord) : [];
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

  function getAudioAnalysisSourceState() {
    return toRecord(getProjectAudioAnalysis().source);
  }

  function getAudioAnalysisCatalogState() {
    return toRecord(getProjectAudioAnalysis().analysisCatalog);
  }

  function getAudioAnalysisProviderState() {
    return toRecord(getProjectAudioAnalysis().providerState);
  }

  function getAudioAnalysisResultMap() {
    return toRecord(getProjectAudioAnalysis().results);
  }

  function getAudioAnalysisOrderedResultEntries() {
    const catalogModules = getAudioAnalysisModules().reduce(function (accumulator, entry) {
      const moduleId = typeof entry.id === "string" && entry.id.trim() !== "" ? entry.id : null;
      if (moduleId !== null) {
        accumulator[moduleId] = entry;
      }
      return accumulator;
    }, {});
    const catalogState = getAudioAnalysisCatalogState();
    const resultMap = getAudioAnalysisResultMap();
    const orderedIds = Array.isArray(catalogState.orderedIds)
      ? catalogState.orderedIds.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : getAudioAnalysisModules().map(function (entry) {
          return entry.id;
        });
    const extraIds = Object.keys(resultMap).filter(function (moduleId) {
      return !orderedIds.includes(moduleId);
    });

    return orderedIds.concat(extraIds).map(function (moduleId) {
      const descriptor = toRecord(catalogModules[moduleId]);
      const result = toRecord(resultMap[moduleId]);
      return {
        moduleId: moduleId,
        phase:
          typeof result.phase === "string" && result.phase.trim() !== ""
            ? result.phase
            : typeof descriptor.phase === "string" && descriptor.phase.trim() !== ""
              ? descriptor.phase
              : "v1",
        status:
          typeof result.status === "string" && result.status.trim() !== ""
            ? result.status
            : typeof descriptor.status === "string" && descriptor.status.trim() !== ""
              ? descriptor.status
              : "planned",
        titleKey:
          typeof result.titleKey === "string" && result.titleKey.trim() !== ""
            ? result.titleKey
            : typeof descriptor.titleKey === "string"
              ? descriptor.titleKey
              : null,
        summaryKey:
          typeof result.summaryKey === "string" && result.summaryKey.trim() !== ""
            ? result.summaryKey
            : typeof descriptor.summaryKey === "string"
              ? descriptor.summaryKey
              : null,
        summary: typeof result.summary === "string" ? result.summary : "",
        providerIds: Array.isArray(result.providerIds)
          ? result.providerIds
          : Array.isArray(descriptor.providerIds)
            ? descriptor.providerIds
            : [],
        blockers: Array.isArray(result.blockers) ? result.blockers : [],
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        metrics: Array.isArray(result.metrics) ? result.metrics.map(toRecord) : [],
        confidence: typeof result.confidence === "string" ? result.confidence : null,
        signals: Array.isArray(result.signals) ? result.signals.map(toRecord) : [],
        artifacts: Array.isArray(result.artifacts) ? result.artifacts.map(toRecord) : [],
      };
    });
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
    return Array.isArray(outputs) ? outputs.map(toRecord) : [];
  }

  function getActiveEditOutput() {
    const edit = getProjectEdit();
    const activeOutputId =
      typeof edit.activeOutputId === "string" && edit.activeOutputId.trim() !== ""
        ? edit.activeOutputId
        : null;
    return (
      getEditOutputs().find(function (entry) {
        return activeOutputId !== null && entry.id === activeOutputId;
      }) || null
    );
  }

  function getToolEntry(toolId) {
    const tools = toRecord(toRecord(getSourceSnapshot().toolState).tools);
    return toRecord(tools[toolId]);
  }

  function getStageToolIds(stageId) {
    return getToolRegistry()
      .filter(function (entry) {
        const supportLevel = toRecord(entry.stageSupport)[stageId];
        return (
          typeof supportLevel === "string" &&
          supportLevel.trim() !== "" &&
          supportLevel !== "unsupported"
        );
      })
      .map(function (entry) {
        return entry.toolId;
      });
  }

  function getWorkspaceCapabilities(kind) {
    return toRecord(toRecord(getEditCapabilities().workspace)[kind]);
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
    getAudioAnalysisCatalog,
    getAudioAnalysisCapabilities,
    getAudioAnalysisPresets,
    getAudioAnalysisProviders,
    getAudioAnalysisModules,
    getAudioAnalysisProviderEntries,
    getToolRegistry,
    getProjectSource,
    getProjectEdit,
    getProjectProfile,
    getProjectProcess,
    getProjectReport,
    getProjectAudioAnalysis,
    getProjectSubtitleAnalysis,
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
    getAudioAnalysisSourceState,
    getAudioAnalysisCatalogState,
    getAudioAnalysisProviderState,
    getAudioAnalysisResultMap,
    getAudioAnalysisOrderedResultEntries,
    getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord,
    getSourceMetadata,
    getEditPreview,
    getEditOutputs,
    getActiveEditOutput,
    getToolEntry,
    getStageToolIds,
    getWorkspaceCapabilities,
    getJobs,
  };
}
