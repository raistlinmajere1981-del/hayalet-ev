export function createLaboratoryVisualAnalysisRuntime(deps) {
  const { asNonEmptyString, toRecord } = deps;
  function toRuntimeRecord(value) {
    return toRecord(value);
  }
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toToolStateEntryRecord(value) {
    return toRecord(value);
  }
  function toCatalogRecord(value) {
    return toRecord(value);
  }
  function toCatalogEntryRecord(value) {
    return toRecord(value);
  }
  function toProviderCollectionRecord(value) {
    return toRecord(value);
  }
  function toProviderRecord(value) {
    return toRecord(value);
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return asNonEmptyString(entry);
    }).filter((entry) => entry !== null);
  }
  function getVisualAnalysisCapabilities(runtime) {
    return toRecord(toRuntimeRecord(runtime).visualAnalysisCapabilities);
  }
  function getVisualAnalysisCatalog(runtime) {
    return toCatalogRecord(toRuntimeRecord(runtime).visualAnalysisCatalog);
  }
  function getVisualAnalysisProviders(runtime) {
    return toProviderCollectionRecord(toRuntimeRecord(runtime).visualAnalysisProviders);
  }
  function getVisualAnalysisModulesForRuntime(runtime, sourceKind = null) {
    const catalog = getVisualAnalysisCatalog(runtime);
    const entries = Array.isArray(catalog.modules) ? catalog.modules.map(toCatalogEntryRecord) : [];
    if (sourceKind === null) {
      return entries;
    }
    return entries.filter(function(entry) {
      const sourceKinds = toStringArray(entry.sourceKinds);
      return sourceKinds.length === 0 || sourceKinds.includes(sourceKind);
    });
  }
  function getVisualAnalysisProviderEntries(runtime) {
    const providers = getVisualAnalysisProviders(runtime).providers;
    return Array.isArray(providers) ? providers.map(toProviderRecord) : [];
  }
  function getToolInstalled(runtime, toolId) {
    if (toolId === null) {
      return false;
    }
    const tools = toRecord(toRecord(toRecord(runtime["toolState"])["tools"])[toolId]);
    return toToolStateEntryRecord(tools).installed === true;
  }
  function buildVisualAnalysisProviderState(runtime) {
    const providerState = {};
    getVisualAnalysisProviderEntries(runtime).forEach(function(provider) {
      const providerId = asNonEmptyString(provider.id) || "visual-provider";
      const providerStatus = asNonEmptyString(provider.status) || "planned";
      const toolId = asNonEmptyString(provider.toolId);
      const installed = getToolInstalled(runtime, toolId);
      const planned = providerStatus === "planned";
      const toolReady = planned ? false : toolId ? installed : providerStatus === "ready";
      const capabilityReady = planned ? false : toolReady;
      providerState[providerId] = {
        providerId,
        status: planned ? "planned" : capabilityReady ? "ready" : "blocked",
        ready: capabilityReady,
        toolReady,
        capabilityReady,
        toolId,
        moduleIds: toStringArray(provider.moduleIds),
        providerType: asNonEmptyString(provider.providerType),
        installStrategy: asNonEmptyString(provider.installStrategy),
        expectedArtifacts: toStringArray(provider.expectedArtifacts),
        fallbackProviderIds: toStringArray(provider.fallbackProviderIds),
        titleKey: asNonEmptyString(provider.titleKey),
        summaryKey: asNonEmptyString(provider.summaryKey),
        blockers: planned || capabilityReady ? [] : [`Install ${toolId || "the required runtime"} before enabling this visual provider.`],
        warnings: planned ? ["This provider stays reserved for a later visual-analysis rollout."] : []
      };
    });
    return providerState;
  }
  function buildVisualAnalysisCapabilityState(runtime, sourceKind) {
    const providerState = buildVisualAnalysisProviderState(runtime);
    const capabilityState = {};
    getVisualAnalysisModulesForRuntime(runtime).forEach(function(entry) {
      const moduleId = asNonEmptyString(entry.id) || "visual-module";
      const moduleStatus = asNonEmptyString(entry.status) || "planned";
      const sourceKinds = toStringArray(entry.sourceKinds);
      const providerIds = toStringArray(entry.providerIds);
      const providerEntries = providerIds.map(function(providerId) {
        return toRecord(providerState[providerId]);
      });
      const readyProvider = providerEntries.find(function(providerEntry) {
        return providerEntry["ready"] === true;
      });
      const toolReady = providerEntries.some(function(providerEntry) {
        return providerEntry["toolReady"] === true;
      });
      const sourceSupported = sourceKind === null || sourceKinds.length === 0 || sourceKinds.includes(sourceKind);
      const nextStatus = moduleStatus === "planned" || moduleStatus === "gated" ? moduleStatus : sourceSupported !== true ? "blocked" : readyProvider ? "ready" : "blocked";
      capabilityState[moduleId] = {
        moduleId,
        status: nextStatus,
        phase: asNonEmptyString(entry.phase) || "v2",
        providerIds,
        toolIds: toStringArray(entry.toolIds),
        requiredToolIds: toStringArray(entry.toolIds),
        toolReady,
        featureSupported: sourceSupported,
        capabilityReady: nextStatus === "ready",
        titleKey: asNonEmptyString(entry.titleKey),
        summaryKey: asNonEmptyString(entry.summaryKey),
        sourceKinds,
        blockers: nextStatus === "blocked" ? sourceSupported !== true ? [`${moduleId} is not available for ${sourceKind || "this source kind"}.`] : providerEntries.flatMap(function(providerEntry) {
          return toStringArray(providerEntry["blockers"]);
        }) : [],
        warnings: nextStatus === "gated" ? ["This visual capability is defined but still gated behind a future-ready provider."] : providerEntries.flatMap(function(providerEntry) {
          return toStringArray(providerEntry["warnings"]);
        })
      };
    });
    return capabilityState;
  }
  function getMergedModuleToggles(project, workbenchSource = {}) {
    return {
      ...toRecord(toRecord(project["workbench"])["moduleToggles"]),
      ...toRecord(toRecord(workbenchSource)["moduleToggles"])
    };
  }
  function resolveEnabledVisualAnalysisModuleIds(runtime, project, sourceKind, workbenchSource = {}) {
    const capabilityState = buildVisualAnalysisCapabilityState(runtime, sourceKind);
    const modules = getVisualAnalysisModulesForRuntime(runtime, sourceKind).filter(
      function(entry) {
        const moduleId = asNonEmptyString(entry.id) || "";
        return toRecord(capabilityState[moduleId])["status"] === "ready";
      }
    );
    const moduleToggles = getMergedModuleToggles(toProjectRecord(project), workbenchSource);
    const relevantToggleIds = modules.map(function(entry) {
      return asNonEmptyString(entry.id);
    }).filter((moduleId) => moduleId !== null).filter(function(moduleId) {
      return Object.prototype.hasOwnProperty.call(moduleToggles, moduleId);
    });
    if (relevantToggleIds.length > 0) {
      return relevantToggleIds.filter(function(moduleId) {
        return moduleToggles[moduleId] === true;
      });
    }
    return modules.map(function(entry) {
      return asNonEmptyString(entry.id);
    }).filter((moduleId) => moduleId !== null);
  }
  function partitionVisualAnalysisModuleIds(runtime, moduleIds) {
    const catalogEntries = getVisualAnalysisModulesForRuntime(runtime);
    const moduleMap = /* @__PURE__ */ new Map();
    catalogEntries.forEach(function(entry) {
      const moduleId = asNonEmptyString(entry.id);
      if (moduleId) {
        moduleMap.set(moduleId, entry);
      }
    });
    const structure = [];
    const reveal = [];
    moduleIds.forEach(function(moduleId) {
      const entry = moduleMap.get(moduleId);
      const providerIds = entry ? toStringArray(entry.providerIds) : [];
      if (providerIds.includes("ffmpeg-visual-reveal")) {
        reveal.push(moduleId);
        return;
      }
      structure.push(moduleId);
    });
    return {
      reveal,
      structure
    };
  }
  function getVisualAnalysisDensity(runtime) {
    return toRecord(getVisualAnalysisCapabilities(runtime)["density"]);
  }
  return {
    buildVisualAnalysisCapabilityState,
    buildVisualAnalysisProviderState,
    getVisualAnalysisCapabilities,
    getVisualAnalysisCatalog,
    getVisualAnalysisDensity,
    getVisualAnalysisModulesForRuntime,
    getVisualAnalysisProviderEntries,
    partitionVisualAnalysisModuleIds,
    resolveEnabledVisualAnalysisModuleIds
  };
}
