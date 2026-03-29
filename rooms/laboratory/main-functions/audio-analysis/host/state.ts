// @ts-nocheck
export function createAudioAnalysisStateRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    audioAnalysisSchemaVersion,
    getAudioAnalysisModulesForRuntime,
    getAudioAnalysisRequiredToolIds,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeReportExport,
    normalizeStringArray,
    toRecord,
  } = deps;

  function createEmptyAudioAnalysisSourceState() {
    return {
      preferredSourceKind: "audio",
      requestedMode: "source",
      mode: "source",
      outputId: null,
      targetSignature: null,
      targetPath: null,
      targetFileName: null,
      targetMimeType: null,
      targetLabel: null,
      extractedAudioPath: null,
      updatedAt: null,
    };
  }

  function createEmptyAudioAnalysisCatalogState() {
    return {
      orderedIds: [],
      implementedIds: [],
      gatedIds: [],
      plannedIds: [],
      visibleIds: [],
    };
  }

  function normalizeAudioAnalysisMetric(rawValue) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `audio-analysis-metric-${Date.now()}`,
      label: asNonEmptyString(source.label),
      labelKey: asNonEmptyString(source.labelKey),
      value: asNonEmptyString(source.value) || "--",
    };
  }

  function normalizeAudioAnalysisCapabilityEntry(rawValue, moduleId, catalogEntry) {
    const source = toRecord(rawValue);
    const catalog = toRecord(catalogEntry);
    return {
      moduleId: moduleId,
      phase: asNonEmptyString(source.phase) || asNonEmptyString(catalog.phase) || "v1",
      status: asNonEmptyString(source.status) || asNonEmptyString(catalog.status) || "planned",
      titleKey: asNonEmptyString(source.titleKey) || asNonEmptyString(catalog.titleKey),
      summaryKey: asNonEmptyString(source.summaryKey) || asNonEmptyString(catalog.summaryKey),
      providerIds:
        normalizeStringArray(source.providerIds).length > 0
          ? normalizeStringArray(source.providerIds)
          : normalizeStringArray(catalog.providerIds),
      toolIds:
        normalizeStringArray(source.toolIds).length > 0
          ? normalizeStringArray(source.toolIds)
          : normalizeStringArray(catalog.toolIds),
      requiredToolIds:
        normalizeStringArray(source.requiredToolIds).length > 0
          ? normalizeStringArray(source.requiredToolIds)
          : getAudioAnalysisRequiredToolIds(catalog),
      blockers: normalizeStringArray(source.blockers),
      warnings: normalizeStringArray(source.warnings),
    };
  }

  function normalizeAudioAnalysisProviderStateEntry(rawValue, providerId, descriptor) {
    const source = toRecord(rawValue);
    const provider = toRecord(descriptor);
    return {
      providerId: providerId,
      status: asNonEmptyString(source.status) || asNonEmptyString(provider.status) || "planned",
      toolId: asNonEmptyString(source.toolId) || asNonEmptyString(provider.toolId),
      moduleIds:
        normalizeStringArray(source.moduleIds).length > 0
          ? normalizeStringArray(source.moduleIds)
          : normalizeStringArray(provider.moduleIds),
      titleKey: asNonEmptyString(source.titleKey) || asNonEmptyString(provider.titleKey),
      summaryKey: asNonEmptyString(source.summaryKey) || asNonEmptyString(provider.summaryKey),
      providerType: asNonEmptyString(source.providerType) || asNonEmptyString(provider.providerType),
      installStrategy: asNonEmptyString(source.installStrategy) || asNonEmptyString(provider.installStrategy),
      expectedArtifacts:
        normalizeStringArray(source.expectedArtifacts).length > 0
          ? normalizeStringArray(source.expectedArtifacts)
          : normalizeStringArray(provider.expectedArtifacts),
      fallbackProviderIds:
        normalizeStringArray(source.fallbackProviderIds).length > 0
          ? normalizeStringArray(source.fallbackProviderIds)
          : normalizeStringArray(provider.fallbackProviderIds),
      installed: source.installed === true,
      ready: source.ready === true,
      busy: source.busy === true,
      version: asNonEmptyString(source.version),
      modelId: asNonEmptyString(source.modelId),
      platformSupported: source.platformSupported !== false,
      blockers: normalizeStringArray(source.blockers),
      warnings: normalizeStringArray(source.warnings),
      lastError: asNonEmptyString(source.lastError),
    };
  }

  function createEmptyAudioAnalysisRunRecord(moduleId) {
    return {
      moduleId: moduleId,
      status: "idle",
      runId: null,
      jobId: null,
      requestId: null,
      startedAt: null,
      completedAt: null,
      warnings: [],
      error: null,
      artifactIds: [],
      findingIds: [],
    };
  }

  function normalizeAudioAnalysisRunRecord(rawValue, moduleId) {
    const source = toRecord(rawValue);
    return {
      ...createEmptyAudioAnalysisRunRecord(moduleId),
      ...source,
      moduleId: moduleId,
      status: asNonEmptyString(source.status) || "idle",
      runId: asNonEmptyString(source.runId),
      jobId: asNonEmptyString(source.jobId),
      requestId: asNonEmptyString(source.requestId),
      startedAt: asNonEmptyString(source.startedAt),
      completedAt: asNonEmptyString(source.completedAt),
      warnings: normalizeStringArray(source.warnings),
      error: asNonEmptyString(source.error),
      artifactIds: normalizeStringArray(source.artifactIds),
      findingIds: normalizeStringArray(source.findingIds),
    };
  }

  function createEmptyAudioAnalysisModuleResult(moduleId, catalogEntry) {
    const catalog = toRecord(catalogEntry);
    const status = asNonEmptyString(catalog.status) || "planned";
    return {
      moduleId: moduleId,
      phase: asNonEmptyString(catalog.phase) || "v1",
      status: status === "implemented" ? "idle" : status,
      titleKey: asNonEmptyString(catalog.titleKey),
      summaryKey: asNonEmptyString(catalog.summaryKey),
      providerIds: normalizeStringArray(catalog.providerIds),
      toolIds: normalizeStringArray(catalog.toolIds),
      requiredToolIds: getAudioAnalysisRequiredToolIds(catalog),
      summary: "",
      blockers: [],
      warnings: [],
      signals: [],
      artifacts: [],
      metrics: [],
      confidence: null,
      timing: {
        sampleWindowSeconds: null,
        startedAt: null,
        completedAt: null,
      },
      runMeta: {
        runId: null,
        jobId: null,
        requestId: null,
      },
      sourceSignature: null,
    };
  }

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
    normalizeAudioAnalysisCapabilityEntry,
    normalizeAudioAnalysisMetric,
    normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisProviderStateEntry,
    normalizeAudioAnalysisRunRecord,
    normalizeAudioAnalysisState,
  };
}
