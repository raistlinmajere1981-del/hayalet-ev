import { createAudioAnalysisProjectionCatalogRuntime } from "./projection-catalog.js";
import { createAudioAnalysisProjectionResultsRuntime } from "./projection-results.js";

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

  const audioAnalysisProjectionCatalogRuntime = createAudioAnalysisProjectionCatalogRuntime({
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
  });
  const {
    buildAudioAnalysisCapabilityState,
    buildAudioAnalysisCatalogProjection,
    buildAudioAnalysisProviderState,
    resolveAudioFeatureTarget,
  } = audioAnalysisProjectionCatalogRuntime;
  const audioAnalysisProjectionResultsRuntime = createAudioAnalysisProjectionResultsRuntime({
    asNonEmptyString,
    normalizeAudioAnalysisMetric,
    normalizeStringArray,
    toRecord,
  });
  const {
    buildAudioAnalysisModuleMetrics,
    buildAudioAnalysisModuleSummary,
    getAudioAnalysisConfidenceRank,
    mapAudioAnalysisResultStatus,
  } = audioAnalysisProjectionResultsRuntime;

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
    mapAudioAnalysisResultStatus,
    resolveAudioFeatureTarget,
    syncProjectAudioAnalysisProjection,
  };
}
