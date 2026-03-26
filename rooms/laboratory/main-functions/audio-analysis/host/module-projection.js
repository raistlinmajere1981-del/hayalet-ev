export function createAudioAnalysisProjectionRuntime(deps) {
  const {
    asNumber,
    asNonEmptyString,
    audioAnalysisSchemaVersion,
    audioFeatureId,
    buildDerivedTargetSignature,
    buildProcessSpeechAvailability,
    buildProfileModelSummary,
    buildSourceTargetSignature,
    findEditOutputById,
    getFeatureProcessRecord,
    getFeatureReportRecord,
    getAudioAnalysisModulesForRuntime,
    getPreferredFeatureSourceKind,
    getStageSupport,
    getToolManifest,
    normalizeAudioAnalysisCapabilityEntry,
    normalizeAudioAnalysisMetric,
    normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisProviderStateEntry,
    normalizeAudioAnalysisRunRecord,
    normalizeAudioAnalysisState,
    normalizeEditOutput,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeReportExport,
    normalizeSourceMetadata,
    normalizeStringArray,
    toRecord,
  } = deps;

  function buildAudioAnalysisCatalogProjection(runtime) {
    const modules = getAudioAnalysisModulesForRuntime(runtime);
    const orderedIds = modules
      .map(function (entry) {
        return asNonEmptyString(entry.id);
      })
      .filter(Boolean);

    return {
      orderedIds: orderedIds,
      implementedIds: modules
        .filter(function (entry) {
          return asNonEmptyString(entry.status) === "implemented";
        })
        .map(function (entry) {
          return asNonEmptyString(entry.id);
        })
        .filter(Boolean),
      gatedIds: modules
        .filter(function (entry) {
          return asNonEmptyString(entry.status) === "gated";
        })
        .map(function (entry) {
          return asNonEmptyString(entry.id);
        })
        .filter(Boolean),
      plannedIds: modules
        .filter(function (entry) {
          return asNonEmptyString(entry.status) === "planned";
        })
        .map(function (entry) {
          return asNonEmptyString(entry.id);
        })
        .filter(Boolean),
      visibleIds: orderedIds,
    };
  }

  function getAudioAnalysisProviderDescriptors(runtime) {
    return Array.isArray(toRecord(runtime.audioAnalysisProviders).providers)
      ? toRecord(runtime.audioAnalysisProviders).providers.map(toRecord)
      : [];
  }

  function resolveAudioAnalysisProviderIdsForModule(runtime, catalogEntry) {
    const descriptorProviderIds = normalizeStringArray(toRecord(catalogEntry).providerIds);
    if (descriptorProviderIds.length > 0) {
      return descriptorProviderIds;
    }

    const toolIds = normalizeStringArray(toRecord(catalogEntry).toolIds);
    return getAudioAnalysisProviderDescriptors(runtime)
      .filter(function (entry) {
        const toolId = asNonEmptyString(entry.toolId);
        return toolId !== null && toolIds.includes(toolId);
      })
      .map(function (entry) {
        return asNonEmptyString(entry.id);
      })
      .filter(Boolean);
  }

  function getAudioAnalysisRequiredToolIds(catalogEntry) {
    const source = toRecord(catalogEntry);
    const requiredToolIds = normalizeStringArray(source.requiredToolIds);
    return requiredToolIds.length > 0 ? requiredToolIds : normalizeStringArray(source.toolIds);
  }

  function buildAudioAnalysisProviderState(runtime, project) {
    const toolState = toRecord(toRecord(runtime.toolState).tools);
    const speechAvailability = buildProcessSpeechAvailability(runtime, project);
    const modelSummaries = buildProfileModelSummary(runtime, project);
    const selectedModel =
      modelSummaries.find(function (entry) {
        return entry.selected === true;
      }) ||
      modelSummaries.find(function (entry) {
        return entry.ready === true;
      }) ||
      null;

    return getAudioAnalysisProviderDescriptors(runtime).reduce(function (accumulator, entry) {
      const providerId = asNonEmptyString(entry.id) || `audio-provider-${Date.now()}`;
      const toolId = asNonEmptyString(entry.toolId);
      const toolEntry = toRecord(toolState[toolId]);
      const descriptorStatus = asNonEmptyString(entry.status) || "planned";
      const moduleIds = normalizeStringArray(entry.moduleIds);
      const blockers = [];
      const warnings = [];
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

  function buildAudioAnalysisCapabilityState(runtime, project, target, providerState) {
    const toolState = toRecord(toRecord(runtime.toolState).tools);
    return getAudioAnalysisModulesForRuntime(runtime).reduce(function (accumulator, entry) {
      const moduleId = asNonEmptyString(entry.id) || `audio-module-${Date.now()}`;
      const moduleStatus = asNonEmptyString(entry.status) || "planned";
      const providerIds = resolveAudioAnalysisProviderIdsForModule(runtime, entry);
      const toolIds = normalizeStringArray(entry.toolIds);
      const requiredToolIds = getAudioAnalysisRequiredToolIds(entry);
      const blockers = [];
      const warnings = [];
      let status = moduleStatus;

      if (moduleStatus === "implemented") {
        if (target.path === null) {
          status = "blocked";
          blockers.push("Prepare an audio-ready source before running this module.");
        } else if (providerIds.length > 0) {
          const providerEntries = providerIds
            .map(function (providerId) {
              return toRecord(providerState[providerId]);
            })
            .filter(function (provider) {
              return Object.keys(provider).length > 0;
            });
          if (providerEntries.some(function (provider) {
            return provider.ready === true;
          })) {
            status = "ready";
          } else {
            status = "blocked";
            providerEntries.forEach(function (provider) {
              normalizeStringArray(provider.blockers).forEach(function (entryText) {
                blockers.push(entryText);
              });
              normalizeStringArray(provider.warnings).forEach(function (entryText) {
                warnings.push(entryText);
              });
            });
          }
        }

        if (status === "ready") {
          const missingToolIds = requiredToolIds.filter(function (toolId) {
            return toRecord(toolState[toolId]).installed !== true;
          });
          if (missingToolIds.length > 0) {
            status = "blocked";
            missingToolIds.forEach(function (toolId) {
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

  function getAudioAnalysisConfidenceRank(confidence) {
    const nextConfidence = asNonEmptyString(confidence) || "low";
    return nextConfidence === "high" ? 3 : nextConfidence === "medium" ? 2 : 1;
  }

  function mapAudioAnalysisResultStatus(processRecord, moduleEntry, capabilityEntry) {
    const processStatus = asNonEmptyString(toRecord(processRecord).status) || "idle";
    const moduleStatus = asNonEmptyString(toRecord(moduleEntry).status) || "idle";
    const capabilityStatus = asNonEmptyString(toRecord(capabilityEntry).status) || "planned";

    if (moduleStatus === "ready") {
      return processStatus === "stale" ? "stale" : "complete";
    }
    if (moduleStatus === "error" || moduleStatus === "failed") {
      return "failed";
    }
    if (moduleStatus === "cancelled") {
      return "cancelled";
    }
    if (["planned", "gated", "blocked", "skipped", "running", "queued"].includes(moduleStatus)) {
      return moduleStatus;
    }
    if (processStatus === "stale" && capabilityStatus === "ready") {
      return "stale";
    }
    return capabilityStatus === "ready" ? "idle" : capabilityStatus;
  }

  function buildAudioAnalysisModuleMetrics(signals, artifacts) {
    const metrics = [
      {
        id: "signals",
        label: "Signals",
        value: String(signals.length),
      },
      {
        id: "artifacts",
        label: "Artifacts",
        value: String(artifacts.length),
      },
    ];
    const descriptorSummary =
      artifacts
        .map(function (artifact) {
          return toRecord(toRecord(artifact).metadata).descriptorSummary;
        })
        .find(function (entry) {
          return Object.keys(toRecord(entry)).length > 0;
        }) || {};
    const prosodySummary =
      artifacts
        .map(function (artifact) {
          return toRecord(toRecord(artifact).metadata).prosodySummary;
        })
        .find(function (entry) {
          return Object.keys(toRecord(entry)).length > 0;
        }) || {};
    const emotionHeuristic =
      artifacts
        .map(function (artifact) {
          return toRecord(toRecord(artifact).metadata).emotionHeuristic;
        })
        .find(function (entry) {
          return Object.keys(toRecord(entry)).length > 0;
        }) || {};
    const soundEventSummary =
      artifacts
        .map(function (artifact) {
          return toRecord(toRecord(artifact).metadata).topClasses;
        })
        .find(function (entry) {
          return Array.isArray(entry) && entry.length > 0;
        }) || [];
    const sourceSeparationSummary =
      artifacts
        .map(function (artifact) {
          return toRecord(toRecord(artifact).metadata);
        })
        .find(function (entry) {
          return typeof toRecord(entry).stemCount === "number";
        }) || {};
    const musicAnalysisSummary =
      artifacts
        .map(function (artifact) {
          return toRecord(toRecord(artifact).metadata).musicSummary;
        })
        .find(function (entry) {
          return Object.keys(toRecord(entry)).length > 0;
        }) || {};
    const diarizationSummary =
      artifacts
        .map(function (artifact) {
          return toRecord(toRecord(artifact).metadata).diarizationSummary;
        })
        .find(function (entry) {
          return Object.keys(toRecord(entry)).length > 0;
        }) || {};

    if (typeof toRecord(descriptorSummary.centroid).mean === "number") {
      metrics.push({
        id: "spectral-centroid",
        label: "Mean centroid",
        value: `${Number(toRecord(descriptorSummary.centroid).mean).toFixed(1)} Hz`,
      });
    }
    if (typeof toRecord(descriptorSummary.rolloff).mean === "number") {
      metrics.push({
        id: "spectral-rolloff",
        label: "Mean rolloff",
        value: `${Number(toRecord(descriptorSummary.rolloff).mean).toFixed(1)} Hz`,
      });
    }
    if (typeof toRecord(descriptorSummary.flatness).mean === "number") {
      metrics.push({
        id: "spectral-flatness",
        label: "Flatness",
        value: Number(toRecord(descriptorSummary.flatness).mean).toFixed(3),
      });
    }
    if (typeof prosodySummary.meanF0Hz === "number") {
      metrics.push({
        id: "prosody-f0",
        label: "Mean F0",
        value: `${Number(prosodySummary.meanF0Hz).toFixed(1)} Hz`,
      });
    }
    if (typeof prosodySummary.voicedRatio === "number") {
      metrics.push({
        id: "prosody-voiced-ratio",
        label: "Voiced ratio",
        value: `${Math.round(Number(prosodySummary.voicedRatio) * 100)}%`,
      });
    }
    if (typeof prosodySummary.estimatedPauseCount === "number") {
      metrics.push({
        id: "prosody-pauses",
        label: "Estimated pauses",
        value: String(prosodySummary.estimatedPauseCount),
      });
    }
    if (typeof emotionHeuristic.label === "string" && emotionHeuristic.label.trim() !== "") {
      metrics.push({
        id: "emotion-label",
        label: "Heuristic label",
        value: emotionHeuristic.label,
      });
    }
    if (Array.isArray(soundEventSummary) && soundEventSummary.length > 0) {
      const topClass = toRecord(soundEventSummary[0]);
      metrics.push({
        id: "sound-event-top",
        label: "Top event",
        value:
          typeof topClass.label === "string" && topClass.label.trim() !== ""
            ? topClass.label
            : typeof topClass.className === "string" && topClass.className.trim() !== ""
              ? topClass.className
              : "Unknown",
      });
    }
    if (typeof sourceSeparationSummary.stemCount === "number") {
      metrics.push({
        id: "source-separation-stems",
        label: "Separated stems",
        value: String(sourceSeparationSummary.stemCount),
      });
    }
    if (
      typeof sourceSeparationSummary.modelName === "string" &&
      sourceSeparationSummary.modelName.trim() !== ""
    ) {
      metrics.push({
        id: "source-separation-model",
        label: "Separation model",
        value: sourceSeparationSummary.modelName,
      });
    }
    if (typeof musicAnalysisSummary.tempoBpm === "number") {
      metrics.push({
        id: "music-tempo",
        label: "Tempo",
        value: `${Number(musicAnalysisSummary.tempoBpm).toFixed(1)} BPM`,
      });
    }
    if (
      typeof musicAnalysisSummary.dominantPitchClass === "string" &&
      musicAnalysisSummary.dominantPitchClass.trim() !== ""
    ) {
      metrics.push({
        id: "music-pitch-class",
        label: "Dominant pitch class",
        value: musicAnalysisSummary.dominantPitchClass,
      });
    }
    if (typeof diarizationSummary.speakerCount === "number") {
      metrics.push({
        id: "speaker-count",
        label: "Speakers",
        value: String(diarizationSummary.speakerCount),
      });
    }
    if (typeof diarizationSummary.segmentCount === "number") {
      metrics.push({
        id: "speaker-segments",
        label: "Speaker segments",
        value: String(diarizationSummary.segmentCount),
      });
    }

    return metrics.map(normalizeAudioAnalysisMetric);
  }

  function buildAudioAnalysisModuleSummary(resultStatus, moduleEntry, capabilityEntry) {
    const summary = asNonEmptyString(toRecord(moduleEntry).summary);
    if (summary !== null) {
      return summary;
    }
    const blockers = normalizeStringArray(toRecord(capabilityEntry).blockers);
    if (blockers.length > 0) {
      return blockers[0];
    }
    switch (resultStatus) {
      case "planned":
        return "Reserved for the later rollout.";
      case "gated":
        return "This module remains capability-gated on the current runtime.";
      case "blocked":
        return "Resolve the module blockers before running the audio desk.";
      case "stale":
        return "The target changed after the last completed run.";
      case "complete":
        return "This module completed during the latest managed run.";
      case "running":
        return "This module is currently running.";
      default:
        return "";
    }
  }

  function resolveAudioFeatureTarget(project) {
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
        reason: null,
      };
    }

    return {
      requestedMode: "source",
      mode: "source",
      outputId: null,
      path: asNonEmptyString(source.storedPath),
      fileName: asNonEmptyString(source.storedFileName),
      mimeType: asNonEmptyString(source.mimeType),
      metadata: normalizeSourceMetadata(source.metadata),
      signature: asNonEmptyString(source.storedPath) !== null ? buildSourceTargetSignature(project) : null,
      label: asNonEmptyString(source.storedFileName) || project.name,
      usingFallback: false,
      reason: null,
    };
  }

  function buildAudioAnalysisModules(runtime, project, target) {
    const catalogModules = getAudioAnalysisModulesForRuntime(runtime);
    const providerState = buildAudioAnalysisProviderState(runtime, project);
    const capabilityState = buildAudioAnalysisCapabilityState(runtime, project, target, providerState);

    return catalogModules.map(function (entry) {
      const moduleId = asNonEmptyString(entry.id) || "audio-module";
      const capabilityEntry = toRecord(capabilityState[moduleId]);
      const status = asNonEmptyString(capabilityEntry.status) || asNonEmptyString(entry.status) || "planned";
      const blockers = normalizeStringArray(capabilityEntry.blockers);
      const warnings = normalizeStringArray(capabilityEntry.warnings);

      if (status === "planned") {
        return normalizeProcessModule({
          id: moduleId,
          labelKey: asNonEmptyString(entry.titleKey),
          title: moduleId,
          status: "planned",
          summary: "Reserved for the later rollout.",
        });
      }
      if (status === "gated") {
        return normalizeProcessModule({
          id: moduleId,
          labelKey: asNonEmptyString(entry.titleKey),
          title: moduleId,
          status: "gated",
          summary:
            warnings[0] || "This module remains capability-gated on the current runtime.",
        });
      }
      if (status === "blocked") {
        return normalizeProcessModule({
          id: moduleId,
          labelKey: asNonEmptyString(entry.titleKey),
          title: moduleId,
          status: "blocked",
          summary:
            blockers[0] || "Resolve the module blockers before starting the run.",
        });
      }
      return normalizeProcessModule({
        id: moduleId,
        labelKey: asNonEmptyString(entry.titleKey),
        title: moduleId,
        status: status === "ready" ? "queued" : status,
        summary:
          status === "ready"
            ? "Queued for the managed audio analysis run."
            : warnings[0] ||
              blockers[0] ||
              "Audio analysis module state is waiting on provider readiness.",
      });
    });
  }

  function syncProjectAudioAnalysisProjection(runtime, project) {
    const normalizedState = normalizeAudioAnalysisState(project.audioAnalysis, runtime);
    const target = resolveAudioFeatureTarget(project);
    const providerState = buildAudioAnalysisProviderState(runtime, project);
    const capabilityState = buildAudioAnalysisCapabilityState(runtime, project, target, providerState);
    const processRecord = getFeatureProcessRecord(project, audioFeatureId);
    const reportRecord = getFeatureReportRecord(project, audioFeatureId);
    const nextResults = {};
    const nextRuns = {};

    getAudioAnalysisModulesForRuntime(runtime).forEach(function (entry) {
      const moduleId = asNonEmptyString(entry.id) || `audio-module-${Date.now()}`;
      const existingResult = normalizeAudioAnalysisModuleResult(
        toRecord(toRecord(normalizedState.results)[moduleId]),
        moduleId,
        entry
      );
      const capabilityEntry = normalizeAudioAnalysisCapabilityEntry(
        toRecord(capabilityState[moduleId]),
        moduleId,
        entry
      );
      const processModule =
        (Array.isArray(processRecord.modules) ? processRecord.modules : []).find(function (candidate) {
          return asNonEmptyString(toRecord(candidate).id) === moduleId;
        }) || {};
      const signals = (Array.isArray(processRecord.findings) ? processRecord.findings : [])
        .filter(function (candidate) {
          return asNonEmptyString(toRecord(candidate).moduleId) === moduleId;
        })
        .map(normalizeProcessFinding);
      const artifacts = (Array.isArray(processRecord.artifacts) ? processRecord.artifacts : [])
        .filter(function (candidate) {
          return asNonEmptyString(toRecord(candidate).moduleId) === moduleId;
        })
        .map(normalizeProcessArtifact);
      const resultStatus = mapAudioAnalysisResultStatus(processRecord, processModule, capabilityEntry);
      const confidence =
        signals.sort(function (left, right) {
          return getAudioAnalysisConfidenceRank(right.confidence) - getAudioAnalysisConfidenceRank(left.confidence);
        })[0]?.confidence || null;

      nextResults[moduleId] = normalizeAudioAnalysisModuleResult(
        {
          ...existingResult,
          moduleId: moduleId,
          phase: asNonEmptyString(entry.phase) || existingResult.phase,
          status: resultStatus,
          titleKey: asNonEmptyString(entry.titleKey) || existingResult.titleKey,
          summaryKey: asNonEmptyString(entry.summaryKey) || existingResult.summaryKey,
          providerIds:
            normalizeStringArray(entry.providerIds).length > 0
              ? normalizeStringArray(entry.providerIds)
              : capabilityEntry.providerIds,
          toolIds:
            normalizeStringArray(entry.toolIds).length > 0
              ? normalizeStringArray(entry.toolIds)
              : capabilityEntry.toolIds,
          requiredToolIds: capabilityEntry.requiredToolIds,
          summary: buildAudioAnalysisModuleSummary(resultStatus, processModule, capabilityEntry),
          blockers:
            resultStatus === "planned" || resultStatus === "gated" || resultStatus === "blocked"
              ? capabilityEntry.blockers
              : [],
          warnings: Array.from(
            new Set(
              normalizeStringArray(capabilityEntry.warnings).concat(
                normalizeStringArray(toRecord(processModule).warnings),
                resultStatus === "stale" ? ["Target changed; rerun this audio module."] : []
              )
            )
          ),
          signals: signals,
          artifacts: artifacts,
          metrics: buildAudioAnalysisModuleMetrics(signals, artifacts),
          confidence: confidence,
          timing: {
            sampleWindowSeconds: asNumber(toRecord(processRecord.targetSummary).sampleWindowSeconds),
            startedAt: asNonEmptyString(toRecord(processModule).startedAt),
            completedAt: asNonEmptyString(toRecord(processModule).completedAt),
          },
          runMeta: {
            runId: asNonEmptyString(processRecord.runId),
            jobId: asNonEmptyString(processRecord.jobId),
            requestId: asNonEmptyString(processRecord.requestId),
          },
          sourceSignature: asNonEmptyString(target.signature),
        },
        moduleId,
        entry
      );

      nextRuns[moduleId] = normalizeAudioAnalysisRunRecord(
        {
          moduleId: moduleId,
          status: nextResults[moduleId].status,
          runId: asNonEmptyString(processRecord.runId),
          jobId: asNonEmptyString(processRecord.jobId),
          requestId: asNonEmptyString(processRecord.requestId),
          startedAt:
            asNonEmptyString(toRecord(processModule).startedAt) ||
            asNonEmptyString(processRecord.startedAt),
          completedAt:
            asNonEmptyString(toRecord(processModule).completedAt) ||
            asNonEmptyString(processRecord.completedAt),
          warnings: nextResults[moduleId].warnings,
          error: nextResults[moduleId].status === "failed" ? asNonEmptyString(processRecord.error) : null,
          artifactIds: nextResults[moduleId].artifacts.map(function (artifact) {
            return artifact.id;
          }),
          findingIds: nextResults[moduleId].signals.map(function (signal) {
            return signal.id;
          }),
        },
        moduleId
      );
    });

    project.audioAnalysis = normalizeAudioAnalysisState(
      {
        ...normalizedState,
        schemaVersion: audioAnalysisSchemaVersion,
        source: {
          preferredSourceKind: getPreferredFeatureSourceKind(audioFeatureId, runtime.sourcePresets),
          requestedMode: target.requestedMode,
          mode: target.mode,
          outputId: target.outputId,
          targetSignature: target.signature,
          targetPath: target.path,
          targetFileName: target.fileName,
          targetMimeType: target.mimeType,
          targetLabel: target.label,
          extractedAudioPath:
            asNonEmptyString(toRecord(target.metadata).extractedBy) !== null ? asNonEmptyString(target.path) : null,
          updatedAt: project.updatedAt,
        },
        analysisCatalog: buildAudioAnalysisCatalogProjection(runtime),
        capabilityState: capabilityState,
        providerState: providerState,
        runs: nextRuns,
        results: nextResults,
        export: {
          lastGeneratedAt: asNonEmptyString(reportRecord.generatedAt),
          items: Array.isArray(reportRecord.exports) ? reportRecord.exports.map(normalizeReportExport) : [],
        },
      },
      runtime
    );

    return project.audioAnalysis;
  }

  return {
    buildAudioAnalysisCapabilityState,
    buildAudioAnalysisCatalogProjection,
    buildAudioAnalysisModuleMetrics,
    buildAudioAnalysisModuleSummary,
    buildAudioAnalysisModules,
    buildAudioAnalysisProviderState,
    getAudioAnalysisConfidenceRank,
    getAudioAnalysisRequiredToolIds,
    mapAudioAnalysisResultStatus,
    resolveAudioFeatureTarget,
    syncProjectAudioAnalysisProjection,
  };
}
