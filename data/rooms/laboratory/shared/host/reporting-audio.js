export function createLaboratoryAudioReportRuntime(deps) {
  const {
    asNonEmptyString,
    audioFeatureId,
    clone,
    createEmptyFeatureReportRecord,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessRecord,
    getFeatureReportRecord,
    getFindingSeverityRank,
    normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisState,
    normalizeFeatureReportRecord,
    normalizeProcessFinding,
    normalizeStringArray,
    syncProjectAudioAnalysisProjection,
    toRecord
  } = deps;
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toFeatureProcessRecord(value) {
    return toRecord(value);
  }
  function toFeatureReportRecord(value) {
    return toRecord(value);
  }
  function toAnalysisStateRecord(value) {
    return toRecord(value);
  }
  function toAnalysisCatalogRecord(value) {
    return toRecord(value);
  }
  function toAnalysisSourceRecord(value) {
    return toRecord(value);
  }
  function toModuleDescriptor(value) {
    return toRecord(value);
  }
  function toModuleResultRecord(value) {
    return toRecord(value);
  }
  function toProcessFindingRecord(value) {
    return toRecord(value);
  }
  function toUnknownArray(value) {
    return Array.isArray(value) ? value.map(function(entry) {
      return entry;
    }) : [];
  }
  function getAudioReportEmptyReason(processRecord, processStatus) {
    const explicitReason = asNonEmptyString(processRecord.emptyReason);
    if (explicitReason !== null) {
      return explicitReason;
    }
    if (processStatus === "running" || processStatus === "queued") {
      return "Ses analizi hala suruyor; rapor tamamlaninca dolacak.";
    }
    if (processStatus === "failed") {
      return asNonEmptyString(processRecord.error) || "Ses analizi hata ile tamamlandigi icin rapor bos kaldi.";
    }
    if (processStatus === "cancelled") {
      return "Ses analizi iptal edildigi icin rapor bos kaldi.";
    }
    return "Once ses analizi tamamlanmali.";
  }
  function buildAudioAnalysisReportProjection(runtime, project) {
    const projectedProject = clone(project);
    syncProjectAudioAnalysisProjection(runtime, projectedProject);
    const audioAnalysis = toAnalysisStateRecord(
      normalizeAudioAnalysisState(projectedProject.audioAnalysis, runtime)
    );
    const catalogMap = getAudioAnalysisModulesForRuntime(runtime).reduce(function(accumulator, entry) {
      const descriptor = toModuleDescriptor(entry);
      const moduleId = asNonEmptyString(descriptor.id);
      if (moduleId !== null) {
        accumulator[moduleId] = descriptor;
      }
      return accumulator;
    }, {});
    const orderedIds = normalizeStringArray(
      toAnalysisCatalogRecord(audioAnalysis.analysisCatalog).orderedIds
    );
    const resultMap = toRecord(audioAnalysis.results);
    const extraIds = Object.keys(resultMap).filter(function(moduleId) {
      return !orderedIds.includes(moduleId);
    });
    const orderedResults = orderedIds.concat(extraIds).map(function(moduleId) {
      return normalizeAudioAnalysisModuleResult(
        toRecord(resultMap[moduleId]),
        moduleId,
        catalogMap[moduleId] || {}
      );
    });
    return {
      audioAnalysis,
      orderedResults
    };
  }
  function composeAudioAnalysisReport(runtime, project) {
    const processRecord = toFeatureProcessRecord(getFeatureProcessRecord(project, audioFeatureId));
    const processStatus = asNonEmptyString(processRecord.status) || "idle";
    if (processStatus !== "ready" && processStatus !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(audioFeatureId),
          status: processStatus === "running" ? "staged" : "idle",
          warnings: normalizeStringArray(processRecord.warnings),
          emptyReason: getAudioReportEmptyReason(processRecord, processStatus)
        },
        audioFeatureId
      );
    }
    const projection = buildAudioAnalysisReportProjection(runtime, project);
    const orderedResults = projection.orderedResults.map(toModuleResultRecord);
    const findings = orderedResults.flatMap(function(entry) {
      return toUnknownArray(entry.signals);
    }).map(normalizeProcessFinding).map(toProcessFindingRecord).sort(function(left, right) {
      return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
    });
    const artifactCount = orderedResults.reduce(function(sum, entry) {
      return sum + (Array.isArray(entry.artifacts) ? entry.artifacts.length : 0);
    }, 0);
    const completedCount = orderedResults.filter(function(entry) {
      return ["complete", "stale"].includes(asNonEmptyString(entry.status) || "idle");
    }).length;
    const gatedCount = orderedResults.filter(function(entry) {
      return asNonEmptyString(entry.status) === "gated";
    }).length;
    const plannedCount = orderedResults.filter(function(entry) {
      return asNonEmptyString(entry.status) === "planned";
    }).length;
    const blockedCount = orderedResults.filter(function(entry) {
      return asNonEmptyString(entry.status) === "blocked";
    }).length;
    const warnings = Array.from(
      new Set(
        normalizeStringArray(processRecord.warnings).concat(
          orderedResults.flatMap(function(entry) {
            return normalizeStringArray(entry.warnings);
          })
        )
      )
    );
    const caveats = [];
    if (plannedCount > 0) {
      caveats.push(`${String(plannedCount)} audio module(s) remain planned for the v2 rollout.`);
    }
    if (gatedCount > 0) {
      caveats.push(
        `${String(gatedCount)} audio module(s) remain capability-gated on the current runtime.`
      );
    }
    if (blockedCount > 0) {
      caveats.push(
        "Blocked audio modules keep their slot visible until the target and providers are ready."
      );
    }
    const targetSummary = toRecord(processRecord.targetSummary);
    const audioSource = toAnalysisSourceRecord(projection.audioAnalysis.source);
    const projectRecord = toProjectRecord(project);
    const reportRecord = toFeatureReportRecord(getFeatureReportRecord(project, audioFeatureId));
    return normalizeFeatureReportRecord(
      {
        featureId: audioFeatureId,
        status: "ready",
        sourceRunId: processRecord.runId,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summaryCards: [
          {
            id: "audio-target",
            label: "Target",
            value: asNonEmptyString(audioSource.targetLabel) || asNonEmptyString(targetSummary["label"]) || asNonEmptyString(projectRecord.name) || "Project"
          },
          {
            id: "audio-visible-modules",
            label: "Visible modules",
            value: String(orderedResults.length)
          },
          {
            id: "audio-completed-modules",
            label: "Completed modules",
            value: String(completedCount)
          },
          {
            id: "audio-findings",
            label: "Findings",
            value: String(findings.length)
          },
          {
            id: "audio-artifacts",
            label: "Artifacts",
            value: String(artifactCount)
          }
        ],
        findings,
        caveats,
        warnings,
        exports: reportRecord.exports,
        error: null,
        emptyReason: findings.length === 0 && artifactCount === 0 ? getAudioReportEmptyReason(processRecord, processStatus) : null
      },
      audioFeatureId
    );
  }
  return {
    buildAudioAnalysisReportProjection,
    composeAudioAnalysisReport
  };
}
