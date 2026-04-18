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
    toRecord
  } = deps;
  function toCatalogModuleRecord(value) {
    return toRecord(value);
  }
  function toCapabilityEntryRecord(value) {
    return toRecord(value);
  }
  function toProcessRecord(value) {
    return toRecord(value);
  }
  function toProcessModuleRecord(value) {
    return toRecord(value);
  }
  function toProcessFindingRecord(value) {
    return toRecord(value);
  }
  function toProcessArtifactRecord(value) {
    return toRecord(value);
  }
  function toReportRecord(value) {
    return toRecord(value);
  }
  function toAudioTargetRecord(value) {
    return toRecord(value);
  }
  function getCatalogModules(runtime) {
    return getAudioAnalysisModulesForRuntime(runtime).map(toCatalogModuleRecord);
  }
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
    toRecord
  });
  const {
    buildAudioAnalysisCapabilityState,
    buildAudioAnalysisCatalogProjection,
    buildAudioAnalysisProviderState,
    resolveAudioFeatureTarget
  } = audioAnalysisProjectionCatalogRuntime;
  const audioAnalysisProjectionResultsRuntime = createAudioAnalysisProjectionResultsRuntime({
    asNonEmptyString,
    normalizeAudioAnalysisMetric,
    normalizeStringArray,
    toRecord
  });
  const {
    buildAudioAnalysisModuleMetrics,
    buildAudioAnalysisModuleSummary,
    getAudioAnalysisConfidenceRank,
    mapAudioAnalysisResultStatus
  } = audioAnalysisProjectionResultsRuntime;
  function buildAudioAnalysisModules(runtime, project, target) {
    const catalogModules = getCatalogModules(runtime);
    const providerState = buildAudioAnalysisProviderState(runtime, project);
    const capabilityState = buildAudioAnalysisCapabilityState(
      runtime,
      project,
      target,
      providerState
    );
    return catalogModules.map(function(entry) {
      const moduleId = asNonEmptyString(entry.id) || "audio-module";
      const capabilityEntry = normalizeAudioAnalysisCapabilityEntry(
        toCapabilityEntryRecord(capabilityState[moduleId]),
        moduleId,
        entry
      );
      const status = asNonEmptyString(capabilityEntry.status) || asNonEmptyString(entry.status) || "planned";
      const blockers = normalizeStringArray(capabilityEntry.blockers);
      const warnings = normalizeStringArray(capabilityEntry.warnings);
      if (status === "planned") {
        return normalizeProcessModule({
          id: moduleId,
          labelKey: asNonEmptyString(entry.titleKey),
          status: "planned",
          summary: "Reserved for the later rollout.",
          title: moduleId
        });
      }
      if (status === "gated") {
        return normalizeProcessModule({
          id: moduleId,
          labelKey: asNonEmptyString(entry.titleKey),
          status: "gated",
          summary: warnings[0] || "This module remains capability-gated on the current runtime.",
          title: moduleId
        });
      }
      if (status === "blocked") {
        return normalizeProcessModule({
          id: moduleId,
          labelKey: asNonEmptyString(entry.titleKey),
          status: "blocked",
          summary: blockers[0] || "Resolve the module blockers before starting the run.",
          title: moduleId
        });
      }
      return normalizeProcessModule({
        id: moduleId,
        labelKey: asNonEmptyString(entry.titleKey),
        status: status === "ready" ? "queued" : status,
        summary: status === "ready" ? "Queued for the managed audio analysis run." : warnings[0] || blockers[0] || "Audio analysis module state is waiting on provider readiness.",
        title: moduleId
      });
    });
  }
  function syncProjectAudioAnalysisProjection(runtime, project) {
    const normalizedState = normalizeAudioAnalysisState(project.audioAnalysis, runtime);
    const target = toAudioTargetRecord(resolveAudioFeatureTarget(project));
    const providerState = buildAudioAnalysisProviderState(runtime, project);
    const capabilityState = buildAudioAnalysisCapabilityState(
      runtime,
      project,
      target,
      providerState
    );
    const processRecord = toProcessRecord(getFeatureProcessRecord(project, audioFeatureId));
    const reportRecord = toReportRecord(getFeatureReportRecord(project, audioFeatureId));
    const nextResults = {};
    const nextRuns = {};
    const processModules = Array.isArray(processRecord.modules) ? processRecord.modules.map(toProcessModuleRecord) : [];
    const processFindings = Array.isArray(processRecord.findings) ? processRecord.findings.map(normalizeProcessFinding).map(toProcessFindingRecord) : [];
    const processArtifacts = Array.isArray(processRecord.artifacts) ? processRecord.artifacts.map(normalizeProcessArtifact).map(toProcessArtifactRecord) : [];
    getCatalogModules(runtime).forEach(function(entry) {
      const moduleId = asNonEmptyString(entry.id) || `audio-module-${Date.now()}`;
      const existingResult = normalizeAudioAnalysisModuleResult(
        toRecord(toRecord(normalizedState["results"])[moduleId]),
        moduleId,
        entry
      );
      const capabilityEntry = normalizeAudioAnalysisCapabilityEntry(
        toCapabilityEntryRecord(capabilityState[moduleId]),
        moduleId,
        entry
      );
      const processModule = processModules.find(function(candidate) {
        return asNonEmptyString(candidate.id) === moduleId;
      }) || normalizeProcessModule({});
      const signals = processFindings.filter(function(candidate) {
        return asNonEmptyString(candidate.moduleId) === moduleId;
      });
      const artifacts = processArtifacts.filter(function(candidate) {
        return asNonEmptyString(candidate.moduleId) === moduleId;
      });
      const resultStatus = mapAudioAnalysisResultStatus(
        processRecord,
        toProcessModuleRecord(processModule),
        capabilityEntry
      );
      const confidence = [...signals].sort(function(left, right) {
        return getAudioAnalysisConfidenceRank(right.confidence) - getAudioAnalysisConfidenceRank(left.confidence);
      })[0]?.confidence || null;
      const nextResult = normalizeAudioAnalysisModuleResult(
        {
          ...existingResult,
          artifacts,
          blockers: resultStatus === "planned" || resultStatus === "gated" || resultStatus === "blocked" ? normalizeStringArray(capabilityEntry.blockers) : [],
          confidence,
          metrics: buildAudioAnalysisModuleMetrics(signals, artifacts),
          moduleId,
          phase: asNonEmptyString(entry["phase"]) || asNonEmptyString(existingResult["phase"]),
          providerIds: normalizeStringArray(entry.providerIds).length > 0 ? normalizeStringArray(entry.providerIds) : normalizeStringArray(capabilityEntry.providerIds),
          requiredToolIds: normalizeStringArray(capabilityEntry.requiredToolIds),
          runMeta: {
            jobId: asNonEmptyString(processRecord.jobId),
            requestId: asNonEmptyString(processRecord.requestId),
            runId: asNonEmptyString(processRecord.runId)
          },
          signals,
          sourceSignature: asNonEmptyString(target.signature),
          status: resultStatus,
          summary: buildAudioAnalysisModuleSummary(
            resultStatus,
            toProcessModuleRecord(processModule),
            capabilityEntry
          ),
          summaryKey: asNonEmptyString(entry["summaryKey"]) || asNonEmptyString(existingResult["summaryKey"]),
          timing: {
            completedAt: asNonEmptyString(toProcessModuleRecord(processModule).completedAt),
            sampleWindowSeconds: asNumber(
              toRecord(processRecord.targetSummary)["sampleWindowSeconds"]
            ),
            startedAt: asNonEmptyString(toProcessModuleRecord(processModule).startedAt)
          },
          titleKey: asNonEmptyString(entry["titleKey"]) || asNonEmptyString(existingResult["titleKey"]),
          toolIds: normalizeStringArray(entry.toolIds).length > 0 ? normalizeStringArray(entry.toolIds) : normalizeStringArray(capabilityEntry.toolIds),
          warnings: Array.from(
            new Set(
              normalizeStringArray(capabilityEntry.warnings).concat(
                normalizeStringArray(toProcessModuleRecord(processModule).warnings),
                resultStatus === "stale" ? ["Target changed; rerun this audio module."] : []
              )
            )
          )
        },
        moduleId,
        entry
      );
      nextResults[moduleId] = nextResult;
      const resultArtifacts = Array.isArray(nextResult.artifacts) ? nextResult.artifacts.map(toProcessArtifactRecord) : [];
      const resultSignals = Array.isArray(nextResult.signals) ? nextResult.signals.map(toProcessFindingRecord) : [];
      nextRuns[moduleId] = normalizeAudioAnalysisRunRecord(
        {
          artifactIds: resultArtifacts.map(function(artifact) {
            return asNonEmptyString(artifact.id);
          }).filter((artifactId) => artifactId !== null),
          completedAt: asNonEmptyString(toProcessModuleRecord(processModule).completedAt) || asNonEmptyString(processRecord.completedAt),
          error: asNonEmptyString(nextResult.status) === "failed" ? asNonEmptyString(processRecord.error) : null,
          findingIds: resultSignals.map(function(signal) {
            return asNonEmptyString(signal.id);
          }).filter((signalId) => signalId !== null),
          jobId: asNonEmptyString(processRecord.jobId),
          moduleId,
          requestId: asNonEmptyString(processRecord.requestId),
          runId: asNonEmptyString(processRecord.runId),
          startedAt: asNonEmptyString(toProcessModuleRecord(processModule).startedAt) || asNonEmptyString(processRecord.startedAt),
          status: asNonEmptyString(nextResult.status),
          warnings: normalizeStringArray(nextResult.warnings)
        },
        moduleId
      );
    });
    project.audioAnalysis = normalizeAudioAnalysisState(
      {
        ...normalizedState,
        analysisCatalog: buildAudioAnalysisCatalogProjection(runtime),
        capabilityState,
        export: {
          items: Array.isArray(reportRecord.exports) ? reportRecord.exports.map(normalizeReportExport) : [],
          lastGeneratedAt: asNonEmptyString(reportRecord.generatedAt)
        },
        providerState,
        results: nextResults,
        runs: nextRuns,
        schemaVersion: audioAnalysisSchemaVersion,
        source: {
          extractedAudioPath: asNonEmptyString(toRecord(target.metadata)["extractedBy"]) !== null ? asNonEmptyString(target.path) : null,
          mode: asNonEmptyString(target.mode),
          outputId: asNonEmptyString(target.outputId),
          preferredSourceKind: getPreferredFeatureSourceKind(audioFeatureId, runtime.sourcePresets),
          requestedMode: asNonEmptyString(target.requestedMode),
          targetFileName: asNonEmptyString(target.fileName),
          targetLabel: asNonEmptyString(target.label),
          targetMimeType: asNonEmptyString(target.mimeType),
          targetPath: asNonEmptyString(target.path),
          targetSignature: asNonEmptyString(target.signature),
          updatedAt: asNonEmptyString(project.updatedAt)
        }
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
    syncProjectAudioAnalysisProjection
  };
}
