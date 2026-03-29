import { createLaboratoryAudioReportRuntime } from "./reporting-audio.js";
import { createLaboratoryReportMarkdownRuntime } from "./reporting-markdown.js";
import { createLaboratorySubtitleReportRuntime } from "./reporting-subtitle.js";
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
  const laboratoryAudioReportRuntime = createLaboratoryAudioReportRuntime(
    deps
  );
  const laboratorySubtitleReportRuntime = createLaboratorySubtitleReportRuntime(
    deps
  );
  const laboratoryReportMarkdownRuntime = createLaboratoryReportMarkdownRuntime({
    ...deps,
    buildAudioAnalysisReportProjection(runtime, project) {
      return laboratoryAudioReportRuntime.buildAudioAnalysisReportProjection(runtime, project);
    }
  });
  const {
    buildAudioAnalysisReportProjection,
    composeAudioAnalysisReport
  } = laboratoryAudioReportRuntime;
  const { composeSubtitleAnalysisReport, getProcessArtifactByKind } = laboratorySubtitleReportRuntime;
  const { buildReportMarkdown, formatReportCardLabel } = laboratoryReportMarkdownRuntime;
  function composeFeatureReport(runtime, project, featureId) {
    if (featureId === deps.audioFeatureId) {
      return composeAudioAnalysisReport(runtime, project);
    }
    if (featureId === deps.subtitleFeatureId) {
      return composeSubtitleAnalysisReport(runtime, project);
    }
    const processRecord = getFeatureProcessRecord(project, featureId);
    if (processRecord.status !== "ready" && processRecord.status !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(featureId),
          status: processRecord.status === "running" ? "staged" : "idle",
          warnings: processRecord.warnings || []
        },
        featureId
      );
    }
    const findings = (Array.isArray(processRecord.findings) ? processRecord.findings : []).map(normalizeProcessFinding).sort(function(left, right) {
      return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
    });
    const topLevel = findings[0] ? asNonEmptyString(findings[0].level) || "low" : "low";
    const caveats = [];
    if (featureId === mediaFeatureId) {
      caveats.push("Process findings remain evidence-led but still reflect heuristic interpretation where noted.");
    } else {
      caveats.push("Planned audio modules remain visible but do not pretend to be implemented.");
    }
    return normalizeFeatureReportRecord(
      {
        featureId,
        status: "ready",
        sourceRunId: processRecord.runId,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summaryCards: [
          {
            id: `${featureId}-target`,
            labelKey: "mediaAnalysis.profile.summary.target",
            value: asNonEmptyString(deps.toRecord(processRecord.targetSummary).label) || asNonEmptyString(project.name)
          },
          {
            id: `${featureId}-modules`,
            label: "Modules",
            value: String((Array.isArray(processRecord.modules) ? processRecord.modules : []).length)
          },
          {
            id: `${featureId}-findings`,
            labelKey: "mediaAnalysis.profile.summary.signals",
            value: String(findings.length)
          },
          {
            id: `${featureId}-artifacts`,
            labelKey: "mediaAnalysis.profile.summary.artifacts",
            value: String((Array.isArray(processRecord.artifacts) ? processRecord.artifacts : []).length)
          },
          {
            id: `${featureId}-risk`,
            label: "Top risk",
            value: topLevel
          }
        ],
        findings,
        caveats,
        warnings: Array.isArray(processRecord.warnings) ? processRecord.warnings : [],
        exports: getFeatureReportRecord(project, featureId).exports,
        error: null
      },
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
