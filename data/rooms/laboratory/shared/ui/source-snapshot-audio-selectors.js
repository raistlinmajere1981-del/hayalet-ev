export function createLaboratorySnapshotAudioSelectors(deps) {
  const { getProjectAudioAnalysis, getSourceSnapshot, toRecord } = deps;
  function toAudioCatalogRecord(value) {
    return toRecord(value);
  }
  function toAudioProvidersRecord(value) {
    return toRecord(value);
  }
  function toAudioStateRecord(value) {
    return toRecord(value);
  }
  function toAudioCatalogStateRecord(value) {
    return toRecord(value);
  }
  function toAudioModuleRecord(value) {
    return toRecord(value);
  }
  function toAudioResultRecord(value) {
    return toRecord(value);
  }
  function toString(value) {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return toString(entry);
    }).filter((entry) => entry !== null);
  }
  function getAudioAnalysisCatalog() {
    return toAudioCatalogRecord(toRecord(getSourceSnapshot())["audioAnalysisCatalog"]);
  }
  function getAudioAnalysisCapabilities() {
    return toRecord(toRecord(getSourceSnapshot())["audioAnalysisCapabilities"]);
  }
  function getAudioAnalysisPresets() {
    return toRecord(toRecord(getSourceSnapshot())["audioAnalysisPresets"]);
  }
  function getAudioAnalysisProviders() {
    return toAudioProvidersRecord(toRecord(getSourceSnapshot())["audioAnalysisProviders"]);
  }
  function getAudioAnalysisModules() {
    const modules = getAudioAnalysisCatalog().modules;
    return Array.isArray(modules) ? modules.map(toAudioModuleRecord) : [];
  }
  function getAudioAnalysisProviderEntries() {
    const providers = getAudioAnalysisProviders().providers;
    return Array.isArray(providers) ? providers.map(toRecord) : [];
  }
  function getProjectAudioAnalysisState() {
    return toAudioStateRecord(getProjectAudioAnalysis());
  }
  function getAudioAnalysisSourceState() {
    return toRecord(getProjectAudioAnalysisState().source);
  }
  function getAudioAnalysisCatalogState() {
    return toAudioCatalogStateRecord(getProjectAudioAnalysisState().analysisCatalog);
  }
  function getAudioAnalysisProviderState() {
    return toRecord(getProjectAudioAnalysisState().providerState);
  }
  function getAudioAnalysisResultMap() {
    return toRecord(getProjectAudioAnalysisState().results);
  }
  function getAudioAnalysisOrderedResultEntries() {
    const catalogModules = getAudioAnalysisModules().reduce(function(accumulator, entry) {
      const moduleId = toString(entry.id);
      if (moduleId !== null) {
        accumulator[moduleId] = entry;
      }
      return accumulator;
    }, {});
    const catalogState = getAudioAnalysisCatalogState();
    const resultMap = getAudioAnalysisResultMap();
    const orderedIds = toStringArray(catalogState.orderedIds).length > 0 ? toStringArray(catalogState.orderedIds) : getAudioAnalysisModules().map(function(entry) {
      return toString(entry.id);
    }).filter((entry) => entry !== null);
    const extraIds = Object.keys(resultMap).filter(function(moduleId) {
      return orderedIds.includes(moduleId) === false;
    });
    return orderedIds.concat(extraIds).map(function(moduleId) {
      const descriptor = toAudioModuleRecord(catalogModules[moduleId]);
      const result = toAudioResultRecord(resultMap[moduleId]);
      return {
        artifacts: Array.isArray(result.artifacts) ? result.artifacts.map(toRecord) : [],
        blockers: toStringArray(result.blockers),
        confidence: toString(result.confidence),
        metrics: Array.isArray(result.metrics) ? result.metrics.map(toRecord) : [],
        moduleId,
        phase: toString(result.phase) || toString(descriptor.phase) || "v1",
        providerIds: toStringArray(result.providerIds).length > 0 ? toStringArray(result.providerIds) : toStringArray(descriptor.providerIds),
        signals: Array.isArray(result.signals) ? result.signals.map(toRecord) : [],
        status: toString(result.status) || toString(descriptor.status) || "planned",
        summary: toString(result.summary) || "",
        summaryKey: toString(result.summaryKey) || toString(descriptor.summaryKey),
        titleKey: toString(result.titleKey) || toString(descriptor.titleKey),
        warnings: toStringArray(result.warnings)
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
    getAudioAnalysisOrderedResultEntries
  };
}
