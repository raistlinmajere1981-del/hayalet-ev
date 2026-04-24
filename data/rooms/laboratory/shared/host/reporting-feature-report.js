import { createLaboratoryAudioReportRuntime } from "./reporting-audio.js";
import { createLaboratoryReportMarkdownRuntime } from "./reporting-markdown.js";
import { createLaboratorySubtitleReportRuntime } from "./reporting-subtitle.js";
import { buildAiReport, buildUserReport } from "../../services/report-builder.js";
export function createLaboratoryFeatureReportRuntime(deps) {
  const {
    asNonEmptyString,
    getFindingSeverityRank,
    normalizeFeatureReportRecord,
    createEmptyFeatureReportRecord,
    getFeatureProcessRecord,
    normalizeProcessFinding,
    getFeatureReportRecord,
    mediaFeatureId
  } = deps;
  const laboratoryAudioReportRuntime = createLaboratoryAudioReportRuntime(deps);
  const laboratorySubtitleReportRuntime = createLaboratorySubtitleReportRuntime(deps);
  const laboratoryReportMarkdownRuntime = createLaboratoryReportMarkdownRuntime({
    ...deps,
    buildAudioAnalysisReportProjection: laboratoryAudioReportRuntime.buildAudioAnalysisReportProjection
  });
  const { buildAudioAnalysisReportProjection, composeAudioAnalysisReport } = laboratoryAudioReportRuntime;
  const { composeSubtitleAnalysisReport, getProcessArtifactByKind } = laboratorySubtitleReportRuntime;
  const { buildReportMarkdown, formatReportCardLabel } = laboratoryReportMarkdownRuntime;
  function toRunProjection(processRecord) {
    const runId = asNonEmptyString(processRecord["runId"]);
    if (runId === null) {
      return null;
    }
    const analysisScopeRecord = deps.toRecord(processRecord["analysisScope"]);
    const moduleTrace = Array.isArray(processRecord["moduleTrace"]) ? processRecord["moduleTrace"].map(function(entry) {
      return deps.toRecord(entry);
    }) : [];
    const comparisonVariants = Array.isArray(processRecord["comparisonVariants"]) ? processRecord["comparisonVariants"].map(function(entry) {
      return deps.toRecord(entry);
    }) : [];
    const previewArtifacts = Array.isArray(processRecord["previewArtifacts"]) ? processRecord["previewArtifacts"].map(function(entry) {
      return deps.toRecord(entry);
    }) : [];
    const modules = Array.isArray(processRecord["modules"]) ? processRecord["modules"] : [];
    const moduleMap = {};
    const moduleOrder = [];
    modules.forEach(function(entry) {
      const normalizedEntry = deps.toRecord(entry);
      const moduleId = asNonEmptyString(normalizedEntry["id"]);
      if (moduleId === null) {
        return;
      }
      moduleMap[moduleId] = normalizedEntry;
      moduleOrder.push(moduleId);
    });
    return {
      id: runId,
      state: asNonEmptyString(processRecord["status"]) || "idle",
      startedAt: Date.parse(
        asNonEmptyString(processRecord["startedAt"]) || (/* @__PURE__ */ new Date()).toISOString()
      ),
      ...asNonEmptyString(processRecord["completedAt"]) ? { endedAt: Date.parse(asNonEmptyString(processRecord["completedAt"]) || "") } : {},
      modules: moduleMap,
      moduleOrder,
      events: Array.isArray(processRecord["events"]) ? processRecord["events"].map(function(entry) {
        return deps.toRecord(entry);
      }) : [],
      rawLog: Array.isArray(processRecord["rawLog"]) ? processRecord["rawLog"].map(function(entry) {
        return deps.toRecord(entry);
      }) : [],
      artifacts: Array.isArray(processRecord["artifacts"]) ? processRecord["artifacts"].map(function(entry) {
        return deps.toRecord(entry);
      }) : [],
      findings: (Array.isArray(processRecord["findings"]) ? processRecord["findings"] : []).map(
        function(entry) {
          return deps.normalizeProcessFinding(entry);
        }
      ),
      warnings: Array.isArray(processRecord["warnings"]) ? processRecord["warnings"].map(String) : [],
      analysisScope: Object.keys(analysisScopeRecord).length > 0 ? analysisScopeRecord : null,
      hypothesisSummary: asNonEmptyString(processRecord["hypothesisSummary"]),
      moduleTrace,
      comparisonVariants,
      previewArtifacts,
      error: asNonEmptyString(processRecord["error"]),
      targetLabel: asNonEmptyString(deps.toRecord(processRecord["targetSummary"])["label"]),
      progress: typeof processRecord["percent"] === "number" ? processRecord["percent"] : null,
      emptyReason: asNonEmptyString(processRecord["emptyReason"])
    };
  }
  function attachDualReports(featureId, processRecord, reportRecord) {
    const run = toRunProjection(processRecord);
    return {
      ...reportRecord,
      featureId,
      userReport: buildUserReport(run, reportRecord),
      aiReport: buildAiReport(run, reportRecord)
    };
  }
  function getProcessBackedEmptyReason(processRecord, fallback) {
    const status = asNonEmptyString(processRecord["status"]) || "idle";
    const explicitReason = asNonEmptyString(processRecord["emptyReason"]);
    if (explicitReason !== null) {
      return explicitReason;
    }
    if (status === "running" || status === "queued") {
      return "Analiz hala suruyor; rapor tamamlaninca dolacak.";
    }
    if (status === "failed") {
      return asNonEmptyString(processRecord["error"]) || "Analiz hata ile tamamlandigi icin rapor bos kaldi.";
    }
    if (status === "cancelled") {
      return "Analiz iptal edildigi icin rapor bos kaldi.";
    }
    return fallback;
  }
  function composeFeatureReport(runtime, project, featureId) {
    if (featureId === deps.audioFeatureId) {
      const processRecord2 = getFeatureProcessRecord(project, featureId);
      return normalizeFeatureReportRecord(
        attachDualReports(
          featureId,
          processRecord2,
          composeAudioAnalysisReport(
            runtime,
            project
          )
        ),
        featureId
      );
    }
    if (featureId === deps.subtitleFeatureId) {
      const processRecord2 = getFeatureProcessRecord(project, featureId);
      return normalizeFeatureReportRecord(
        attachDualReports(
          featureId,
          processRecord2,
          composeSubtitleAnalysisReport(
            runtime,
            project
          )
        ),
        featureId
      );
    }
    const processRecord = getFeatureProcessRecord(project, featureId);
    if (processRecord.status !== "ready" && processRecord.status !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(featureId),
          status: processRecord.status === "running" ? "staged" : "idle",
          warnings: processRecord["warnings"] || [],
          emptyReason: getProcessBackedEmptyReason(
            processRecord,
            "Önce process aşaması tamamlanmalı."
          )
        },
        featureId
      );
    }
    const findings = (Array.isArray(processRecord["findings"]) ? processRecord["findings"] : []).map(normalizeProcessFinding).sort(function(left, right) {
      return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
    });
    const topLevel = findings[0] ? asNonEmptyString(findings[0].level) || "low" : "low";
    const caveats = [];
    if (featureId === mediaFeatureId) {
      caveats.push(
        "Process findings remain evidence-led but still reflect heuristic interpretation where noted."
      );
    } else {
      caveats.push("Planned audio modules remain visible but do not pretend to be implemented.");
    }
    const currentReportExports = getFeatureReportRecord(project, featureId)["exports"];
    return normalizeFeatureReportRecord(
      attachDualReports(featureId, processRecord, {
        featureId,
        status: "ready",
        sourceRunId: processRecord["runId"],
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summaryCards: [
          {
            id: `${featureId}-target`,
            labelKey: "mediaAnalysis.profile.summary.target",
            value: asNonEmptyString(deps.toRecord(processRecord.targetSummary)["label"]) || asNonEmptyString(project["name"])
          },
          {
            id: `${featureId}-modules`,
            label: "Modules",
            value: String(
              (Array.isArray(processRecord["modules"]) ? processRecord["modules"] : []).length
            )
          },
          {
            id: `${featureId}-findings`,
            labelKey: "mediaAnalysis.profile.summary.signals",
            value: String(findings.length)
          },
          {
            id: `${featureId}-artifacts`,
            labelKey: "mediaAnalysis.profile.summary.artifacts",
            value: String(
              (Array.isArray(processRecord["artifacts"]) ? processRecord["artifacts"] : []).length
            )
          },
          {
            id: `${featureId}-risk`,
            label: "Top risk",
            value: topLevel
          }
        ],
        findings,
        caveats,
        warnings: Array.isArray(processRecord["warnings"]) ? processRecord["warnings"] : [],
        ...Array.isArray(currentReportExports) ? { exports: currentReportExports } : {},
        error: null,
        emptyReason: findings.length === 0 && Array.isArray(processRecord["artifacts"]) && processRecord["artifacts"].length === 0 ? getProcessBackedEmptyReason(
          processRecord,
          "Çalışma tamamlandı ancak raporlayacak belirgin bulgu oluşmadı."
        ) : null
      }),
      featureId
    );
  }
  return {
    buildAudioAnalysisReportProjection,
    composeAudioAnalysisReport,
    composeSubtitleAnalysisReport,
    composeFeatureReport,
    buildReportMarkdown,
    formatReportCardLabel,
    getProcessArtifactByKind
  };
}
