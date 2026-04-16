import { createLaboratoryAudioReportRuntime } from "./reporting-audio.js";
import { createLaboratoryReportMarkdownRuntime } from "./reporting-markdown.js";
import { createLaboratorySubtitleReportRuntime } from "./reporting-subtitle.js";
import { buildAiReport, buildUserReport } from "../../services/report-builder.js";
import type { LabRun } from "../../models/lab-types.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryComposedFeatureReportRecord = LaboratoryRecord & {
  aiReport?: unknown;
  exports?: unknown[];
  status?: string | null;
  userReport?: unknown;
};

type LaboratoryFeatureReportRuntimeDeps = Parameters<typeof createLaboratoryAudioReportRuntime>[0] &
  Parameters<typeof createLaboratorySubtitleReportRuntime>[0] &
  Omit<
    Parameters<typeof createLaboratoryReportMarkdownRuntime>[0],
    "buildAudioAnalysisReportProjection"
  > & {
    mediaFeatureId: string;
  };

export function createLaboratoryFeatureReportRuntime(deps: LaboratoryFeatureReportRuntimeDeps) {
  const {
    asNonEmptyString,
    getFindingSeverityRank,
    normalizeFeatureReportRecord,
    createEmptyFeatureReportRecord,
    getFeatureProcessRecord,
    normalizeProcessFinding,
    getFeatureReportRecord,
    mediaFeatureId,
  } = deps;

  const laboratoryAudioReportRuntime = createLaboratoryAudioReportRuntime(deps);
  const laboratorySubtitleReportRuntime = createLaboratorySubtitleReportRuntime(deps);
  const laboratoryReportMarkdownRuntime = createLaboratoryReportMarkdownRuntime({
    ...deps,
    buildAudioAnalysisReportProjection:
      laboratoryAudioReportRuntime.buildAudioAnalysisReportProjection,
  });

  const { buildAudioAnalysisReportProjection, composeAudioAnalysisReport } =
    laboratoryAudioReportRuntime;
  const { composeSubtitleAnalysisReport, getProcessArtifactByKind } =
    laboratorySubtitleReportRuntime;
  const { buildReportMarkdown, formatReportCardLabel } = laboratoryReportMarkdownRuntime;

  function toRunProjection(processRecord: LaboratoryRecord) {
    const runId = asNonEmptyString(processRecord["runId"]);
    if (runId === null) {
      return null;
    }

    const modules = Array.isArray(processRecord["modules"])
      ? (processRecord["modules"] as unknown[])
      : [];
    const moduleMap: Record<string, LaboratoryRecord> = {};
    const moduleOrder: string[] = [];
    modules.forEach(function (entry) {
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
      state: ((asNonEmptyString(processRecord["status"]) || "idle") as LabRun["state"]),
      startedAt: Date.parse(asNonEmptyString(processRecord["startedAt"]) || new Date().toISOString()),
      ...(asNonEmptyString(processRecord["completedAt"])
        ? { endedAt: Date.parse(asNonEmptyString(processRecord["completedAt"]) || "") }
        : {}),
      modules: moduleMap,
      moduleOrder,
      events: Array.isArray(processRecord["events"])
        ? (processRecord["events"] as unknown[]).map(function (entry) {
            return deps.toRecord(entry);
          })
        : [],
      rawLog: Array.isArray(processRecord["rawLog"])
        ? (processRecord["rawLog"] as unknown[]).map(function (entry) {
            return deps.toRecord(entry);
          })
        : [],
      artifacts: Array.isArray(processRecord["artifacts"])
        ? (processRecord["artifacts"] as unknown[]).map(function (entry) {
            return deps.toRecord(entry);
          })
        : [],
      findings: (Array.isArray(processRecord["findings"]) ? processRecord["findings"] : []).map(
        function (entry) {
          return deps.normalizeProcessFinding(entry);
        }
      ),
      warnings: Array.isArray(processRecord["warnings"])
        ? (processRecord["warnings"] as unknown[]).map(String)
        : [],
      error: asNonEmptyString(processRecord["error"]),
      targetLabel: asNonEmptyString(deps.toRecord(processRecord["targetSummary"])["label"]),
      progress: typeof processRecord["percent"] === "number" ? processRecord["percent"] : null,
      emptyReason: asNonEmptyString(processRecord["emptyReason"]),
    };
  }

  function attachDualReports(
    featureId: string,
    processRecord: LaboratoryRecord,
    reportRecord: LaboratoryComposedFeatureReportRecord
  ): LaboratoryComposedFeatureReportRecord {
    const run = toRunProjection(processRecord) as LabRun | null;
    return {
      ...reportRecord,
      featureId,
      userReport: buildUserReport(run, reportRecord),
      aiReport: buildAiReport(run, reportRecord),
    };
  }

  function getProcessBackedEmptyReason(processRecord: LaboratoryRecord, fallback: string) {
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

  function composeFeatureReport(
    runtime: unknown,
    project: LaboratoryRecord,
    featureId: string
  ): LaboratoryComposedFeatureReportRecord {
    if (featureId === deps.audioFeatureId) {
      const processRecord = getFeatureProcessRecord(project, featureId);
      return normalizeFeatureReportRecord(
        attachDualReports(
          featureId,
          processRecord,
          composeAudioAnalysisReport(
            runtime as LaboratoryRecord,
            project
          ) as unknown as LaboratoryComposedFeatureReportRecord
        ),
        featureId
      ) as unknown as LaboratoryComposedFeatureReportRecord;
    }
    if (featureId === deps.subtitleFeatureId) {
      const processRecord = getFeatureProcessRecord(project, featureId);
      return normalizeFeatureReportRecord(
        attachDualReports(
          featureId,
          processRecord,
          composeSubtitleAnalysisReport(
            runtime as LaboratoryRecord,
            project
          ) as unknown as LaboratoryComposedFeatureReportRecord
        ),
        featureId
      ) as unknown as LaboratoryComposedFeatureReportRecord;
    }

    const processRecord = getFeatureProcessRecord(project, featureId);
    if (processRecord.status !== "ready" && processRecord.status !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(featureId),
          status: processRecord.status === "running" ? "staged" : "idle",
          warnings: processRecord["warnings"] || [],
          emptyReason: getProcessBackedEmptyReason(processRecord, "Önce process aşaması tamamlanmalı."),
        },
        featureId
      ) as unknown as LaboratoryComposedFeatureReportRecord;
    }

    const findings = (Array.isArray(processRecord["findings"]) ? processRecord["findings"] : [])
      .map(normalizeProcessFinding)
      .sort(function (left, right) {
        return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
      });
    const topLevel = findings[0] ? asNonEmptyString(findings[0].level) || "low" : "low";
    const caveats: string[] = [];
    if (featureId === mediaFeatureId) {
      caveats.push(
        "Process findings remain evidence-led but still reflect heuristic interpretation where noted."
      );
    } else {
      caveats.push("Planned audio modules remain visible but do not pretend to be implemented.");
    }

    const currentReportExports = (
      getFeatureReportRecord(
        project,
        featureId
      ) as unknown as LaboratoryComposedFeatureReportRecord
    )["exports"];

    return normalizeFeatureReportRecord(
      attachDualReports(featureId, processRecord, {
        featureId: featureId,
        status: "ready",
        sourceRunId: processRecord["runId"],
        generatedAt: new Date().toISOString(),
        summaryCards: [
          {
            id: `${featureId}-target`,
            labelKey: "mediaAnalysis.profile.summary.target",
            value:
              asNonEmptyString(deps.toRecord(processRecord.targetSummary)["label"]) ||
              asNonEmptyString(project["name"]),
          },
          {
            id: `${featureId}-modules`,
            label: "Modules",
            value: String(
              (Array.isArray(processRecord["modules"]) ? processRecord["modules"] : []).length
            ),
          },
          {
            id: `${featureId}-findings`,
            labelKey: "mediaAnalysis.profile.summary.signals",
            value: String(findings.length),
          },
          {
            id: `${featureId}-artifacts`,
            labelKey: "mediaAnalysis.profile.summary.artifacts",
            value: String(
              (Array.isArray(processRecord["artifacts"]) ? processRecord["artifacts"] : []).length
            ),
          },
          {
            id: `${featureId}-risk`,
            label: "Top risk",
            value: topLevel,
          },
        ],
        findings: findings,
        caveats: caveats,
        warnings: Array.isArray(processRecord["warnings"]) ? processRecord["warnings"] : [],
        ...(Array.isArray(currentReportExports) ? { exports: currentReportExports } : {}),
        error: null,
        emptyReason:
          findings.length === 0 && Array.isArray(processRecord["artifacts"]) && processRecord["artifacts"].length === 0
            ? getProcessBackedEmptyReason(
                processRecord,
                "Çalışma tamamlandı ancak raporlayacak belirgin bulgu oluşmadı."
              )
            : null,
      }),
      featureId
    ) as unknown as LaboratoryComposedFeatureReportRecord;
  }

  return {
    buildAudioAnalysisReportProjection,
    composeAudioAnalysisReport,
    composeSubtitleAnalysisReport,
    composeFeatureReport,
    buildReportMarkdown,
    formatReportCardLabel,
    getProcessArtifactByKind,
  };
}
