function isNonNullString(value) {
  return typeof value === "string" && value.length > 0;
}
export function createAudioAnalysisProjectionCatalogRuntime(deps) {
  const {
    asNonEmptyString,
    buildDerivedTargetSignature,
    buildProcessSpeechAvailability,
    buildProfileModelSummary,
    buildSourceTargetSignature,
    findEditOutputById,
    getAudioAnalysisModulesForRuntime,
    normalizeAudioAnalysisCapabilityEntry,
    normalizeAudioAnalysisProviderStateEntry,
    normalizeEditOutput,
    normalizeSourceMetadata,
    normalizeStringArray,
    toRecord
  } = deps;
  function toRuntimeRecord(value) {
    return toRecord(value);
  }
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toCatalogModuleRecord(value) {
    return toRecord(value);
  }
  function toProviderCollectionRecord(value) {
    return toRecord(value);
  }
  function toProviderDescriptorRecord(value) {
    return toRecord(value);
  }
  function toProviderStateEntryRecord(value) {
    return toRecord(value);
  }
  function toTargetRecord(value) {
    return toRecord(value);
  }
  function toEditRecord(value) {
    return toRecord(value);
  }
  function toSourceRecord(value) {
    return toRecord(value);
  }
  function toEditOutputRecord(value) {
    return toRecord(value);
  }
  function toToolStateEntryRecord(value) {
    return toRecord(value);
  }
  function toToolDetailsRecord(value) {
    return toRecord(value);
  }
  function toSpeechAvailabilityRecord(value) {
    return toRecord(value);
  }
  function toModelSummaryRecord(value) {
    return toRecord(value);
  }
  function hasRecordValues(value) {
    return Object.keys(value).length > 0;
  }
  function toUniqueStrings(values) {
    return Array.from(
      new Set(
        values.filter(function(value) {
          return value.length > 0;
        })
      )
    );
  }
  function collectModuleIdsByStatus(modules, status) {
    return modules.filter(function(entry) {
      return asNonEmptyString(entry.status) === status;
    }).map(function(entry) {
      return asNonEmptyString(entry.id);
    }).filter(isNonNullString);
  }
  function getToolState(runtime) {
    const runtimeRecord = toRuntimeRecord(runtime);
    return toRecord(toRecord(runtimeRecord.toolState)["tools"]);
  }
  function getToolEntry(toolState, toolId) {
    return toolId === null ? {} : toToolStateEntryRecord(toolState[toolId]);
  }
  function buildAudioAnalysisCatalogProjection(runtime) {
    const modules = getAudioAnalysisModulesForRuntime(runtime).map(toCatalogModuleRecord);
    const orderedIds = modules.map(function(entry) {
      return asNonEmptyString(entry.id);
    }).filter(isNonNullString);
    return {
      orderedIds,
      implementedIds: collectModuleIdsByStatus(modules, "implemented"),
      gatedIds: collectModuleIdsByStatus(modules, "gated"),
      plannedIds: collectModuleIdsByStatus(modules, "planned"),
      visibleIds: orderedIds
    };
  }
  function getAudioAnalysisProviderDescriptors(runtime) {
    const providerCollection = toProviderCollectionRecord(
      toRuntimeRecord(runtime).audioAnalysisProviders
    );
    return Array.isArray(providerCollection.providers) ? providerCollection.providers.map(toProviderDescriptorRecord) : [];
  }
  function resolveAudioAnalysisProviderIdsForModule(runtime, catalogEntry) {
    const descriptorProviderIds = normalizeStringArray(catalogEntry.providerIds);
    if (descriptorProviderIds.length > 0) {
      return toUniqueStrings(descriptorProviderIds);
    }
    const toolIds = toUniqueStrings(normalizeStringArray(catalogEntry.toolIds));
    return getAudioAnalysisProviderDescriptors(runtime).filter(function(entry) {
      const toolId = asNonEmptyString(entry.toolId);
      return toolId !== null && toolIds.includes(toolId);
    }).map(function(entry) {
      return asNonEmptyString(entry.id);
    }).filter(isNonNullString);
  }
  function getAudioAnalysisRequiredToolIds(catalogEntry) {
    const requiredToolIds = normalizeStringArray(catalogEntry.requiredToolIds);
    return requiredToolIds.length > 0 ? toUniqueStrings(requiredToolIds) : toUniqueStrings(normalizeStringArray(catalogEntry.toolIds));
  }
  function buildAudioAnalysisProviderState(runtime, project) {
    const toolState = getToolState(runtime);
    const speechAvailability = toSpeechAvailabilityRecord(
      buildProcessSpeechAvailability(runtime, project)
    );
    const modelSummaries = buildProfileModelSummary(runtime, project).map(toModelSummaryRecord);
    const selectedModel = modelSummaries.find(function(entry) {
      return entry.selected === true;
    }) ?? modelSummaries.find(function(entry) {
      return entry.ready === true;
    }) ?? null;
    return getAudioAnalysisProviderDescriptors(runtime).reduce(function(accumulator, descriptor, index) {
      const providerId = asNonEmptyString(descriptor.id) ?? `audio-provider-${index}`;
      const toolId = asNonEmptyString(descriptor.toolId);
      const toolEntry = getToolEntry(toolState, toolId);
      const toolDetails = toToolDetailsRecord(toolEntry.details);
      const descriptorStatus = asNonEmptyString(descriptor.status) ?? "planned";
      const moduleIds = normalizeStringArray(descriptor.moduleIds);
      const blockers = [];
      const warnings = [];
      let status = descriptorStatus;
      let ready = false;
      if (descriptorStatus === "ready") {
        if (toolId !== null && toolEntry.installed !== true) {
          status = "missing-tool";
          blockers.push(`Install ${toolId} to enable this provider.`);
        } else if (toolId === "whisper.cpp" && speechAvailability.ready !== true) {
          status = "missing-model";
          blockers.push("Install a compatible Whisper model to enable this provider.");
        } else {
          status = "ready";
          ready = true;
        }
      } else if (descriptorStatus === "gated") {
        warnings.push("This provider remains capability-gated in the current rollout.");
      }
      accumulator[providerId] = normalizeAudioAnalysisProviderStateEntry(
        {
          providerId,
          status,
          toolId,
          moduleIds,
          titleKey: asNonEmptyString(descriptor.titleKey),
          summaryKey: asNonEmptyString(descriptor.summaryKey),
          providerType: asNonEmptyString(descriptor.providerType),
          installStrategy: asNonEmptyString(descriptor.installStrategy),
          expectedArtifacts: normalizeStringArray(descriptor.expectedArtifacts),
          fallbackProviderIds: normalizeStringArray(descriptor.fallbackProviderIds),
          installed: toolEntry.installed === true,
          ready,
          busy: toolEntry.busy === true,
          version: asNonEmptyString(toolEntry.version),
          modelId: selectedModel === null ? null : asNonEmptyString(selectedModel.modelId),
          platformSupported: toolDetails.platformSupported !== false,
          blockers,
          warnings,
          lastError: asNonEmptyString(toolEntry.lastError)
        },
        providerId,
        descriptor
      );
      return accumulator;
    }, {});
  }
  function buildAudioAnalysisCapabilityState(runtime, _project, target, providerState) {
    const toolState = getToolState(runtime);
    const targetRecord = toTargetRecord(target);
    return getAudioAnalysisModulesForRuntime(runtime).map(toCatalogModuleRecord).reduce(function(accumulator, entry, index) {
      const moduleId = asNonEmptyString(entry.id) ?? `audio-module-${index}`;
      const moduleStatus = asNonEmptyString(entry.status) ?? "planned";
      const providerIds = resolveAudioAnalysisProviderIdsForModule(runtime, entry);
      const toolIds = normalizeStringArray(entry.toolIds);
      const requiredToolIds = getAudioAnalysisRequiredToolIds(entry);
      const blockers = [];
      const warnings = [];
      let status = moduleStatus;
      if (moduleStatus === "implemented") {
        if (asNonEmptyString(targetRecord.path) === null) {
          status = "blocked";
          blockers.push("Prepare an audio-ready source before running this module.");
        } else if (providerIds.length > 0) {
          const providerEntries = providerIds.map(function(providerId) {
            return toProviderStateEntryRecord(providerState[providerId]);
          }).filter(hasRecordValues);
          if (providerEntries.some(function(provider) {
            return provider.ready === true;
          })) {
            status = "ready";
          } else {
            status = "blocked";
            providerEntries.forEach(function(provider) {
              normalizeStringArray(provider.blockers).forEach(function(entryText) {
                blockers.push(entryText);
              });
              normalizeStringArray(provider.warnings).forEach(function(entryText) {
                warnings.push(entryText);
              });
            });
          }
        }
        if (status === "ready") {
          const missingToolIds = requiredToolIds.filter(function(toolId) {
            return getToolEntry(toolState, toolId).installed !== true;
          });
          if (missingToolIds.length > 0) {
            status = "blocked";
            missingToolIds.forEach(function(toolId) {
              blockers.push(`Install ${toolId} to enable this module.`);
            });
          }
        }
      } else if (moduleStatus === "gated") {
        warnings.push("This module remains capability-gated on the current runtime.");
      }
      accumulator[moduleId] = normalizeAudioAnalysisCapabilityEntry(
        {
          moduleId,
          phase: asNonEmptyString(entry.phase),
          status,
          titleKey: asNonEmptyString(entry.titleKey),
          summaryKey: asNonEmptyString(entry.summaryKey),
          providerIds,
          toolIds,
          requiredToolIds,
          blockers: toUniqueStrings(blockers),
          warnings: toUniqueStrings(warnings)
        },
        moduleId,
        entry
      );
      return accumulator;
    }, {});
  }
  function resolveAudioFeatureTarget(project) {
    const projectRecord = toProjectRecord(project);
    const source = toSourceRecord(projectRecord.source);
    const edit = toEditRecord(projectRecord.edit);
    const activeOutputId = asNonEmptyString(edit.activeOutputId);
    const activeOutput = findEditOutputById(projectRecord, activeOutputId);
    if (asNonEmptyString(edit.handoffMode) === "derived" && activeOutput !== null && asNonEmptyString(toEditOutputRecord(activeOutput).path) !== null) {
      const output = normalizeEditOutput(activeOutput);
      return {
        requestedMode: "derived",
        mode: "derived",
        outputId: asNonEmptyString(output.id),
        path: asNonEmptyString(output.path),
        fileName: asNonEmptyString(output.fileName),
        mimeType: asNonEmptyString(output.mimeType),
        metadata: normalizeSourceMetadata(output.metadata),
        signature: buildDerivedTargetSignature(output),
        label: asNonEmptyString(output.label) ?? asNonEmptyString(output.fileName) ?? asNonEmptyString(output.id),
        usingFallback: false,
        reason: null
      };
    }
    const sourcePath = asNonEmptyString(source.storedPath);
    const sourceFileName = asNonEmptyString(source.storedFileName);
    return {
      requestedMode: "source",
      mode: "source",
      outputId: null,
      path: sourcePath,
      fileName: sourceFileName,
      mimeType: asNonEmptyString(source.mimeType),
      metadata: normalizeSourceMetadata(source.metadata),
      signature: sourcePath === null ? null : buildSourceTargetSignature(projectRecord),
      label: sourceFileName ?? asNonEmptyString(projectRecord.name),
      usingFallback: false,
      reason: null
    };
  }
  return {
    buildAudioAnalysisCapabilityState,
    buildAudioAnalysisCatalogProjection,
    buildAudioAnalysisProviderState,
    getAudioAnalysisRequiredToolIds,
    resolveAudioFeatureTarget
  };
}
