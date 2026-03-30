export function createAudioAnalysisProjectionCatalogRuntime(deps: any) {
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
    toRecord,
  } = deps;

  function buildAudioAnalysisCatalogProjection(runtime: any) {
    const modules = getAudioAnalysisModulesForRuntime(runtime);
    const orderedIds = modules
      .map(function (entry: any) {
        return asNonEmptyString(entry.id);
      })
      .filter(Boolean);

    return {
      orderedIds: orderedIds,
      implementedIds: modules
        .filter(function (entry: any) {
          return asNonEmptyString(entry.status) === "implemented";
        })
        .map(function (entry: any) {
          return asNonEmptyString(entry.id);
        })
        .filter(Boolean),
      gatedIds: modules
        .filter(function (entry: any) {
          return asNonEmptyString(entry.status) === "gated";
        })
        .map(function (entry: any) {
          return asNonEmptyString(entry.id);
        })
        .filter(Boolean),
      plannedIds: modules
        .filter(function (entry: any) {
          return asNonEmptyString(entry.status) === "planned";
        })
        .map(function (entry: any) {
          return asNonEmptyString(entry.id);
        })
        .filter(Boolean),
      visibleIds: orderedIds,
    };
  }

  function getAudioAnalysisProviderDescriptors(runtime: any) {
    return Array.isArray(toRecord(runtime.audioAnalysisProviders).providers)
      ? toRecord(runtime.audioAnalysisProviders).providers.map(toRecord)
      : [];
  }

  function resolveAudioAnalysisProviderIdsForModule(runtime: any, catalogEntry: any) {
    const descriptorProviderIds = normalizeStringArray(toRecord(catalogEntry).providerIds);
    if (descriptorProviderIds.length > 0) {
      return descriptorProviderIds;
    }

    const toolIds = normalizeStringArray(toRecord(catalogEntry).toolIds);
    return getAudioAnalysisProviderDescriptors(runtime)
      .filter(function (entry: any) {
        const toolId = asNonEmptyString(entry.toolId);
        return toolId !== null && toolIds.includes(toolId);
      })
      .map(function (entry: any) {
        return asNonEmptyString(entry.id);
      })
      .filter(Boolean);
  }

  function getAudioAnalysisRequiredToolIds(catalogEntry: any) {
    const source = toRecord(catalogEntry);
    const requiredToolIds = normalizeStringArray(source.requiredToolIds);
    return requiredToolIds.length > 0 ? requiredToolIds : normalizeStringArray(source.toolIds);
  }

  function buildAudioAnalysisProviderState(runtime: any, project: any) {
    const toolState = toRecord(toRecord(runtime.toolState).tools);
    const speechAvailability = buildProcessSpeechAvailability(runtime, project);
    const modelSummaries = buildProfileModelSummary(runtime, project);
    const selectedModel =
      modelSummaries.find(function (entry: any) {
        return entry.selected === true;
      }) ||
      modelSummaries.find(function (entry: any) {
        return entry.ready === true;
      }) ||
      null;

    return getAudioAnalysisProviderDescriptors(runtime).reduce(function (
      accumulator: any,
      entry: any
    ) {
      const providerId = asNonEmptyString(entry.id) || `audio-provider-${Date.now()}`;
      const toolId = asNonEmptyString(entry.toolId);
      const toolEntry = toRecord(toolState[toolId as any]);
      const descriptorStatus = asNonEmptyString(entry.status) || "planned";
      const moduleIds = normalizeStringArray(entry.moduleIds);
      const blockers: string[] = [];
      const warnings: string[] = [];
      let status = descriptorStatus;
      let ready = false;

      if (descriptorStatus === "ready") {
        if (toolId !== null && toRecord(toolEntry).installed !== true) {
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
          providerId: providerId,
          status: status,
          toolId: toolId,
          moduleIds: moduleIds,
          titleKey: asNonEmptyString(entry.titleKey),
          summaryKey: asNonEmptyString(entry.summaryKey),
          providerType: asNonEmptyString(entry.providerType),
          installStrategy: asNonEmptyString(entry.installStrategy),
          expectedArtifacts: normalizeStringArray(entry.expectedArtifacts),
          fallbackProviderIds: normalizeStringArray(entry.fallbackProviderIds),
          installed: toRecord(toolEntry).installed === true,
          ready: ready,
          busy: toRecord(toolEntry).busy === true,
          version: asNonEmptyString(toolEntry.version),
          modelId: selectedModel ? asNonEmptyString(selectedModel.modelId) : null,
          platformSupported: toRecord(toolEntry).details?.platformSupported !== false,
          blockers: blockers,
          warnings: warnings,
          lastError: asNonEmptyString(toolEntry.lastError),
        },
        providerId,
        entry
      );
      return accumulator;
    }, {});
  }

  function buildAudioAnalysisCapabilityState(
    runtime: any,
    _project: any,
    target: any,
    providerState: any
  ) {
    const toolState = toRecord(toRecord(runtime.toolState).tools);
    return getAudioAnalysisModulesForRuntime(runtime).reduce(function (
      accumulator: any,
      entry: any
    ) {
      const moduleId = asNonEmptyString(entry.id) || `audio-module-${Date.now()}`;
      const moduleStatus = asNonEmptyString(entry.status) || "planned";
      const providerIds = resolveAudioAnalysisProviderIdsForModule(runtime, entry);
      const toolIds = normalizeStringArray(entry.toolIds);
      const requiredToolIds = getAudioAnalysisRequiredToolIds(entry);
      const blockers: string[] = [];
      const warnings: string[] = [];
      let status = moduleStatus;

      if (moduleStatus === "implemented") {
        if (target.path === null) {
          status = "blocked";
          blockers.push("Prepare an audio-ready source before running this module.");
        } else if (providerIds.length > 0) {
          const providerEntries = providerIds
            .map(function (providerId: string) {
              return toRecord(providerState[providerId]);
            })
            .filter(function (provider: any) {
              return Object.keys(provider).length > 0;
            });
          if (
            providerEntries.some(function (provider: any) {
              return provider.ready === true;
            })
          ) {
            status = "ready";
          } else {
            status = "blocked";
            providerEntries.forEach(function (provider: any) {
              normalizeStringArray(provider.blockers).forEach(function (entryText: string) {
                blockers.push(entryText);
              });
              normalizeStringArray(provider.warnings).forEach(function (entryText: string) {
                warnings.push(entryText);
              });
            });
          }
        }

        if (status === "ready") {
          const missingToolIds = requiredToolIds.filter(function (toolId: string) {
            return toRecord(toolState[toolId]).installed !== true;
          });
          if (missingToolIds.length > 0) {
            status = "blocked";
            missingToolIds.forEach(function (toolId: string) {
              blockers.push(`Install ${toolId} to enable this module.`);
            });
          }
        }
      } else if (moduleStatus === "gated") {
        warnings.push("This module remains capability-gated on the current runtime.");
      }

      accumulator[moduleId] = normalizeAudioAnalysisCapabilityEntry(
        {
          moduleId: moduleId,
          phase: asNonEmptyString(entry.phase),
          status: status,
          titleKey: asNonEmptyString(entry.titleKey),
          summaryKey: asNonEmptyString(entry.summaryKey),
          providerIds: providerIds,
          toolIds: toolIds,
          requiredToolIds: requiredToolIds,
          blockers: Array.from(new Set(blockers)),
          warnings: Array.from(new Set(warnings)),
        },
        moduleId,
        entry
      );
      return accumulator;
    }, {});
  }

  function resolveAudioFeatureTarget(project: any) {
    const source = toRecord(project.source);
    const activeOutputId = asNonEmptyString(toRecord(project.edit).activeOutputId);
    const activeOutput = findEditOutputById(project, activeOutputId);
    if (
      asNonEmptyString(toRecord(project.edit).handoffMode) === "derived" &&
      activeOutput !== null &&
      asNonEmptyString(toRecord(activeOutput).path) !== null
    ) {
      const output = normalizeEditOutput(activeOutput);
      return {
        requestedMode: "derived",
        mode: "derived",
        outputId: output.id,
        path: output.path,
        fileName: output.fileName,
        mimeType: output.mimeType,
        metadata: normalizeSourceMetadata(output.metadata),
        signature: buildDerivedTargetSignature(output),
        label: output.label || output.fileName || output.id,
        usingFallback: false,
        reason: null as string | null,
      };
    }

    return {
      requestedMode: "source",
      mode: "source",
      outputId: null as string | null,
      path: asNonEmptyString(source.storedPath),
      fileName: asNonEmptyString(source.storedFileName),
      mimeType: asNonEmptyString(source.mimeType),
      metadata: normalizeSourceMetadata(source.metadata),
      signature:
        asNonEmptyString(source.storedPath) !== null ? buildSourceTargetSignature(project) : null,
      label: asNonEmptyString(source.storedFileName) || project.name,
      usingFallback: false,
      reason: null as string | null,
    };
  }

  return {
    buildAudioAnalysisCapabilityState,
    buildAudioAnalysisCatalogProjection,
    buildAudioAnalysisProviderState,
    getAudioAnalysisRequiredToolIds,
    resolveAudioFeatureTarget,
  };
}
