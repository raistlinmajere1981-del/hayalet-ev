export function createLaboratoryAudioReportRuntime(deps) {
  const {
    asNonEmptyString,
    clone,
    syncProjectAudioAnalysisProjection,
    normalizeAudioAnalysisState,
    getAudioAnalysisModulesForRuntime,
    toRecord,
    normalizeStringArray,
    normalizeAudioAnalysisModuleResult,
    getFindingSeverityRank,
    normalizeFeatureReportRecord,
    createEmptyFeatureReportRecord,
    getFeatureProcessRecord,
    normalizeProcessFinding,
    getFeatureReportRecord,
    audioFeatureId,
  } = deps;

  function buildAudioAnalysisReportProjection(runtime, project) {
    const projectedProject = clone(project);
    syncProjectAudioAnalysisProjection(runtime, projectedProject);

    const audioAnalysis = normalizeAudioAnalysisState(projectedProject.audioAnalysis, runtime);
    const catalogMap = getAudioAnalysisModulesForRuntime(runtime).reduce(function (accumulator, entry) {
      const moduleId = asNonEmptyString(entry.id);
      if (moduleId !== null) {
        accumulator[moduleId] = entry;
      }
      return accumulator;
    }, {});
    const orderedIds = normalizeStringArray(toRecord(audioAnalysis.analysisCatalog).orderedIds);
    const extraIds = Object.keys(toRecord(audioAnalysis.results)).filter(function (moduleId) {
      return !orderedIds.includes(moduleId);
    });
    const orderedResults = orderedIds.concat(extraIds).map(function (moduleId) {
      return normalizeAudioAnalysisModuleResult(
        toRecord(toRecord(audioAnalysis.results)[moduleId]),
        moduleId,
        toRecord(catalogMap[moduleId])
      );
    });

    return {
      audioAnalysis: audioAnalysis,
      orderedResults: orderedResults,
    };
  }

  function composeAudioAnalysisReport(runtime, project) {
    const processRecord = getFeatureProcessRecord(project, audioFeatureId);
    if (processRecord.status !== "ready" && processRecord.status !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(audioFeatureId),
          status: processRecord.status === "running" ? "staged" : "idle",
          warnings: processRecord.warnings || [],
        },
        audioFeatureId
      );
    }

    const projection = buildAudioAnalysisReportProjection(runtime, project);
    const orderedResults = projection.orderedResults;
    const findings = orderedResults
      .flatMap(function (entry) {
        return Array.isArray(entry.signals) ? entry.signals : [];
      })
      .map(normalizeProcessFinding)
      .sort(function (left, right) {
        return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
      });
    const artifactCount = orderedResults.reduce(function (sum, entry) {
      return sum + (Array.isArray(entry.artifacts) ? entry.artifacts.length : 0);
    }, 0);
    const completedCount = orderedResults.filter(function (entry) {
      return ["complete", "stale"].includes(asNonEmptyString(entry.status) || "idle");
    }).length;
    const gatedCount = orderedResults.filter(function (entry) {
      return asNonEmptyString(entry.status) === "gated";
    }).length;
    const plannedCount = orderedResults.filter(function (entry) {
      return asNonEmptyString(entry.status) === "planned";
    }).length;
    const blockedCount = orderedResults.filter(function (entry) {
      return asNonEmptyString(entry.status) === "blocked";
    }).length;
    const warnings = Array.from(
      new Set(
        normalizeStringArray(processRecord.warnings).concat(
          orderedResults.flatMap(function (entry) {
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
      caveats.push(`${String(gatedCount)} audio module(s) remain capability-gated on the current runtime.`);
    }
    if (blockedCount > 0) {
      caveats.push("Blocked audio modules keep their slot visible until the target and providers are ready.");
    }

    return normalizeFeatureReportRecord(
      {
        featureId: audioFeatureId,
        status: "ready",
        sourceRunId: processRecord.runId,
        generatedAt: new Date().toISOString(),
        summaryCards: [
          {
            id: "audio-target",
            label: "Target",
            value:
              asNonEmptyString(toRecord(projection.audioAnalysis.source).targetLabel) ||
              asNonEmptyString(toRecord(processRecord.targetSummary).label) ||
              project.name,
          },
          {
            id: "audio-visible-modules",
            label: "Visible modules",
            value: String(orderedResults.length),
          },
          {
            id: "audio-completed-modules",
            label: "Completed modules",
            value: String(completedCount),
          },
          {
            id: "audio-findings",
            label: "Findings",
            value: String(findings.length),
          },
          {
            id: "audio-artifacts",
            label: "Artifacts",
            value: String(artifactCount),
          },
        ],
        findings: findings,
        caveats: caveats,
        warnings: warnings,
        exports: getFeatureReportRecord(project, audioFeatureId).exports,
        error: null,
      },
      audioFeatureId
    );
  }

  return {
    buildAudioAnalysisReportProjection,
    composeAudioAnalysisReport,
  };
}
