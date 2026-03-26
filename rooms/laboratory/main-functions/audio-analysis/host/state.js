export function createAudioAnalysisStateRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    audioAnalysisSchemaVersion,
    createEmptyAudioAnalysisCatalogState,
    createEmptyAudioAnalysisModuleResult,
    createEmptyAudioAnalysisSourceState,
    getAudioAnalysisModulesForRuntime,
    normalizeAudioAnalysisCapabilityEntry,
    normalizeAudioAnalysisMetric,
    normalizeAudioAnalysisProviderStateEntry,
    normalizeAudioAnalysisRunRecord,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeReportExport,
    normalizeStringArray,
    toRecord,
  } = deps;

  function normalizeAudioAnalysisModuleResult(rawValue, moduleId, catalogEntry) {
    const source = toRecord(rawValue);
    const defaults = createEmptyAudioAnalysisModuleResult(moduleId, catalogEntry);
    const timing = toRecord(source.timing);
    const runMeta = toRecord(source.runMeta);

    return {
      ...defaults,
      ...source,
      moduleId: moduleId,
      phase: asNonEmptyString(source.phase) || defaults.phase,
      status: asNonEmptyString(source.status) || defaults.status,
      titleKey: asNonEmptyString(source.titleKey) || defaults.titleKey,
      summaryKey: asNonEmptyString(source.summaryKey) || defaults.summaryKey,
      providerIds:
        normalizeStringArray(source.providerIds).length > 0
          ? normalizeStringArray(source.providerIds)
          : defaults.providerIds,
      toolIds:
        normalizeStringArray(source.toolIds).length > 0
          ? normalizeStringArray(source.toolIds)
          : defaults.toolIds,
      requiredToolIds:
        normalizeStringArray(source.requiredToolIds).length > 0
          ? normalizeStringArray(source.requiredToolIds)
          : defaults.requiredToolIds,
      summary: asNonEmptyString(source.summary) || "",
      blockers: normalizeStringArray(source.blockers),
      warnings: normalizeStringArray(source.warnings),
      signals: Array.isArray(source.signals) ? source.signals.map(normalizeProcessFinding) : [],
      artifacts: Array.isArray(source.artifacts)
        ? source.artifacts
            .map(normalizeProcessArtifact)
            .filter(function (entry) {
              return entry.path !== null;
            })
        : [],
      metrics: Array.isArray(source.metrics) ? source.metrics.map(normalizeAudioAnalysisMetric) : [],
      confidence: asNonEmptyString(source.confidence),
      timing: {
        sampleWindowSeconds: asNumber(timing.sampleWindowSeconds),
        startedAt: asNonEmptyString(timing.startedAt),
        completedAt: asNonEmptyString(timing.completedAt),
      },
      runMeta: {
        runId: asNonEmptyString(runMeta.runId),
        jobId: asNonEmptyString(runMeta.jobId),
        requestId: asNonEmptyString(runMeta.requestId),
      },
      sourceSignature: asNonEmptyString(source.sourceSignature),
    };
  }

  function createEmptyAudioAnalysisState() {
    return {
      schemaVersion: audioAnalysisSchemaVersion,
      source: createEmptyAudioAnalysisSourceState(),
      analysisCatalog: createEmptyAudioAnalysisCatalogState(),
      capabilityState: {},
      providerState: {},
      runs: {},
      results: {},
      export: {
        lastGeneratedAt: null,
        items: [],
      },
    };
  }

  function normalizeAudioAnalysisState(rawValue, runtime) {
    const source = toRecord(rawValue);
    const defaults = createEmptyAudioAnalysisState();
    const catalogEntries = getAudioAnalysisModulesForRuntime(runtime);
    const providerDescriptors = Array.isArray(toRecord(runtime.audioAnalysisProviders).providers)
      ? toRecord(runtime.audioAnalysisProviders).providers.map(toRecord)
      : [];
    const normalizedResults = {};
    const normalizedRuns = {};
    const normalizedCapabilities = {};
    const normalizedProviders = {};

    catalogEntries.forEach(function (entry) {
      const moduleId = asNonEmptyString(entry.id) || `audio-module-${Date.now()}`;
      normalizedResults[moduleId] = normalizeAudioAnalysisModuleResult(
        toRecord(toRecord(source.results)[moduleId]),
        moduleId,
        entry
      );
      normalizedRuns[moduleId] = normalizeAudioAnalysisRunRecord(
        toRecord(toRecord(source.runs)[moduleId]),
        moduleId
      );
      normalizedCapabilities[moduleId] = normalizeAudioAnalysisCapabilityEntry(
        toRecord(toRecord(source.capabilityState)[moduleId]),
        moduleId,
        entry
      );
    });

    providerDescriptors.forEach(function (entry) {
      const providerId = asNonEmptyString(entry.id) || `audio-provider-${Date.now()}`;
      normalizedProviders[providerId] = normalizeAudioAnalysisProviderStateEntry(
        toRecord(toRecord(source.providerState)[providerId]),
        providerId,
        entry
      );
    });

    return {
      ...defaults,
      ...source,
      schemaVersion: typeof source.schemaVersion === "number" ? source.schemaVersion : audioAnalysisSchemaVersion,
      source: {
        ...createEmptyAudioAnalysisSourceState(),
        ...toRecord(source.source),
        preferredSourceKind:
          asNonEmptyString(toRecord(source.source).preferredSourceKind) || defaults.source.preferredSourceKind,
        requestedMode: asNonEmptyString(toRecord(source.source).requestedMode) || defaults.source.requestedMode,
        mode: asNonEmptyString(toRecord(source.source).mode) || defaults.source.mode,
        outputId: asNonEmptyString(toRecord(source.source).outputId),
        targetSignature: asNonEmptyString(toRecord(source.source).targetSignature),
        targetPath: asNonEmptyString(toRecord(source.source).targetPath),
        targetFileName: asNonEmptyString(toRecord(source.source).targetFileName),
        targetMimeType: asNonEmptyString(toRecord(source.source).targetMimeType),
        targetLabel: asNonEmptyString(toRecord(source.source).targetLabel),
        extractedAudioPath: asNonEmptyString(toRecord(source.source).extractedAudioPath),
        updatedAt: asNonEmptyString(toRecord(source.source).updatedAt),
      },
      analysisCatalog: {
        ...createEmptyAudioAnalysisCatalogState(),
        ...toRecord(source.analysisCatalog),
        orderedIds: normalizeStringArray(toRecord(source.analysisCatalog).orderedIds),
        implementedIds: normalizeStringArray(toRecord(source.analysisCatalog).implementedIds),
        gatedIds: normalizeStringArray(toRecord(source.analysisCatalog).gatedIds),
        plannedIds: normalizeStringArray(toRecord(source.analysisCatalog).plannedIds),
        visibleIds: normalizeStringArray(toRecord(source.analysisCatalog).visibleIds),
      },
      capabilityState: normalizedCapabilities,
      providerState: normalizedProviders,
      runs: normalizedRuns,
      results: normalizedResults,
      export: {
        lastGeneratedAt: asNonEmptyString(toRecord(source.export).lastGeneratedAt),
        items: Array.isArray(toRecord(source.export).items)
          ? toRecord(source.export).items.map(normalizeReportExport)
          : [],
      },
    };
  }

  return {
    createEmptyAudioAnalysisState,
    normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisState,
  };
}
