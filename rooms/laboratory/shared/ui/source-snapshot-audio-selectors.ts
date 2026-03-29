// @ts-nocheck
export function createLaboratorySnapshotAudioSelectors(deps) {
  const toRecord = deps.toRecord;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getProjectAudioAnalysis = deps.getProjectAudioAnalysis;

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

  return {
    getAudioAnalysisCatalog,
    getAudioAnalysisCapabilities,
    getAudioAnalysisPresets,
    getAudioAnalysisProviders,
    getAudioAnalysisModules,
    getAudioAnalysisProviderEntries,
    getAudioAnalysisSourceState,
    getAudioAnalysisCatalogState,
    getAudioAnalysisProviderState,
    getAudioAnalysisResultMap,
    getAudioAnalysisOrderedResultEntries,
  };
}
