import type {
  LaboratoryAnalysisMode,
  LaboratoryAnalyzerReport,
  LaboratoryHistoryEntryRecord,
  LaboratoryReportLocale,
  LaboratorySourceDescriptor,
  LaboratoryTechnicalReport,
  LaboratoryTechnicalSection,
  LaboratoryUserReport,
  LaboratoryWorkflowSettings,
} from "@shared/index.js";

interface BuildLaboratoryReportsInput {
  projectId: string;
  entryId: string;
  source: LaboratorySourceDescriptor;
  mode: LaboratoryAnalysisMode;
  reportLocale?: LaboratoryReportLocale;
  workflowSettings?: LaboratoryWorkflowSettings;
  selection: LaboratoryTechnicalReport["selection"];
  analyzers: {
    metadata: LaboratoryAnalyzerReport;
    motion: LaboratoryAnalyzerReport;
    visual: LaboratoryAnalyzerReport;
    audio: LaboratoryAnalyzerReport;
  };
}

function clampScore(value: number): number {
  if (Number.isFinite(value) === false) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function roundScore(value: number): number {
  return Math.round(clampScore(value) * 100) / 100;
}

function normalizeWorkflowSettings(
  value: BuildLaboratoryReportsInput["workflowSettings"]
): LaboratoryWorkflowSettings {
  const focus = value?.focus;

  return {
    downloadPreset:
      value?.downloadPreset === "best" || value?.downloadPreset === "fast"
        ? value.downloadPreset
        : "balanced",
    previewPolicy: value?.previewPolicy === "dense" ? "dense" : "smart",
    focus: {
      visual: typeof focus?.visual === "boolean" ? focus.visual : true,
      audio: typeof focus?.audio === "boolean" ? focus.audio : true,
      image: typeof focus?.image === "boolean" ? focus.image : true,
      motion: typeof focus?.motion === "boolean" ? focus.motion : true,
    },
  };
}

function resolveRiskLevel(value: number): "low" | "medium" | "high" {
  if (value >= 0.66) {
    return "high";
  }
  if (value >= 0.38) {
    return "medium";
  }
  return "low";
}

function buildSection(
  id: LaboratoryTechnicalSection["id"],
  title: string,
  report: LaboratoryAnalyzerReport
): LaboratoryTechnicalSection {
  return {
    id,
    title,
    status: report.status,
    score: roundScore(report.score),
    summary: report.summary,
    findings: report.findings.slice(),
    metrics: report.metrics.slice(),
    evidence: report.evidence.slice(),
  };
}

function sectionTitle(
  reportLocale: LaboratoryReportLocale,
  id: LaboratoryTechnicalSection["id"]
): string {
  if (reportLocale === "tr") {
    if (id === "metadata") {
      return "Metadata Analizi";
    }
    if (id === "motion") {
      return "Hareket Analizi";
    }
    if (id === "visual") {
      return "Gorsel Analiz";
    }
    return "Ses Analizi";
  }

  if (id === "metadata") {
    return "Metadata Analysis";
  }
  if (id === "motion") {
    return "Motion Analysis";
  }
  if (id === "visual") {
    return "Visual Analysis";
  }
  return "Audio Analysis";
}

function buildInterpretation(
  overallScore: number,
  reportLocale: LaboratoryReportLocale,
  analyzers: BuildLaboratoryReportsInput["analyzers"],
  workflowSettings: LaboratoryWorkflowSettings
): string {
  const ranked = Object.entries(analyzers)
    .map(([key, report]) => ({ key, score: clampScore(report.score) }))
    .sort((left, right) => right.score - left.score);
  const dominant = ranked[0]?.key ?? "visual";

  const focusParts = [
    workflowSettings.focus.visual ? (reportLocale === "tr" ? "gorsel" : "visual") : null,
    workflowSettings.focus.image ? (reportLocale === "tr" ? "kare" : "frame") : null,
    workflowSettings.focus.motion ? (reportLocale === "tr" ? "hareket" : "motion") : null,
    workflowSettings.focus.audio ? (reportLocale === "tr" ? "ses" : "audio") : null,
  ].filter(Boolean);
  const focusSummary =
    focusParts.length > 0
      ? reportLocale === "tr"
        ? `Secilen odak: ${focusParts.join(", ")}.`
        : `Selected focus: ${focusParts.join(", ")}.`
      : reportLocale === "tr"
        ? "Varsayilan odak kullanildi."
        : "Default focus profile was used.";

  if (overallScore >= 0.7) {
    return reportLocale === "tr"
      ? `${dominant} agirlikli bulgularla birden fazla isaret sonradan mudahale veya birlestirme ihtimalini gosteriyor. ${focusSummary}`
      : `Multiple signals suggest possible post-processing or compositing, led by ${dominant} evidence. ${focusSummary}`;
  }
  if (overallScore >= 0.4) {
    return reportLocale === "tr"
      ? `${dominant} tarafindaki bulgular daha baskin olacak sekilde bazi duzensiz sinyaller bulundu. ${focusSummary}`
      : `Some irregular signals were found, with ${dominant} evidence carrying the most weight. ${focusSummary}`;
  }
  return reportLocale === "tr"
    ? `Orneklenen kanitlar genel olarak tutarli gorunuyor, ancak bu ozgunlugu kanitlamaz. ${focusSummary}`
    : `The sampled evidence is mostly consistent, though this does not prove authenticity. ${focusSummary}`;
}

function buildUserReport(
  reportLocale: LaboratoryReportLocale,
  riskLevel: "low" | "medium" | "high",
  overallScore: number,
  analyzers: BuildLaboratoryReportsInput["analyzers"]
): LaboratoryUserReport {
  const highlights = Object.values(analyzers)
    .flatMap((report) => report.findings)
    .filter((value, index, array) => value.trim() !== "" && array.indexOf(value) === index)
    .slice(0, 3);
  const caveats = Object.values(analyzers)
    .filter((report) => report.status === "no-audio" || report.status === "unsupported")
    .map((report) => report.summary)
    .slice(0, 2);
  const headline =
    riskLevel === "high"
      ? reportLocale === "tr"
        ? "Gorunur mudahale riski yuksek"
        : "High risk of visible intervention"
      : riskLevel === "medium"
        ? reportLocale === "tr"
          ? "Orta risk, daha yakindan incelenmeli"
          : "Medium risk, worth closer review"
        : reportLocale === "tr"
          ? "Orneklenen kanitlarda gorunur risk dusuk"
          : "Low visible risk in sampled evidence";

  return {
    reportLocale,
    riskLevel,
    headline,
    summary:
      riskLevel === "high"
        ? reportLocale === "tr"
          ? `Orneklenen kareler veya ses birden fazla uyari sinyali iceriyor. Genel skor: ${String(Math.round(overallScore * 100))}%.`
          : `The sampled frames/audio contain several warning signals. Overall score: ${String(Math.round(overallScore * 100))}%.`
        : riskLevel === "medium"
          ? reportLocale === "tr"
            ? `Klipte bazi tutarsizliklar var, ancak guclu bir iddia icin yeterli degil. Genel skor: ${String(Math.round(overallScore * 100))}%.`
            : `The clip shows some inconsistencies, but not enough for a strong claim. Overall score: ${String(Math.round(overallScore * 100))}%.`
          : reportLocale === "tr"
            ? `Orneklenen kanitlar nispeten tutarli gorunuyor, ancak bu bir kanit degildir. Genel skor: ${String(Math.round(overallScore * 100))}%.`
            : `The sampled evidence looks relatively consistent, but this is not proof. Overall score: ${String(Math.round(overallScore * 100))}%.`,
    highlights,
    caveats:
      caveats.length > 0
        ? caveats
        : [
            reportLocale === "tr"
              ? "Bu sonuc olasiliksaldir; kanit degil, sinyal olarak ele alinmalidir."
              : "This result is probabilistic and should be treated as a signal, not proof.",
          ],
  };
}

export function buildLaboratoryReports(
  input: BuildLaboratoryReportsInput
): Pick<LaboratoryHistoryEntryRecord, "technicalReport" | "userReport"> {
  const reportLocale = input.reportLocale === "tr" ? "tr" : "en";
  const workflowSettings = normalizeWorkflowSettings(
    input.workflowSettings ?? input.source.workflowSettings
  );
  const analyzerWeights = {
    metadata:
      (input.analyzers.metadata.status === "ok" ? 0.22 : 0.1) *
      (workflowSettings.focus.image ? 1.08 : 0.92),
    motion:
      (input.analyzers.motion.status === "ok" ? 0.31 : 0.16) *
      (workflowSettings.focus.motion ? 1.08 : 0.74),
    visual:
      (input.analyzers.visual.status === "ok" ? 0.31 : 0.16) *
      (workflowSettings.focus.visual || workflowSettings.focus.image ? 1.08 : 0.74),
    audio:
      (input.analyzers.audio.status === "ok" ? 0.16 : 0.08) *
      (workflowSettings.focus.audio ? 1.08 : 0.74),
  };
  const totalWeight = Object.values(analyzerWeights).reduce((sum, value) => sum + value, 0);
  const overallScore = roundScore(
    (clampScore(input.analyzers.metadata.score) * analyzerWeights.metadata +
      clampScore(input.analyzers.motion.score) * analyzerWeights.motion +
      clampScore(input.analyzers.visual.score) * analyzerWeights.visual +
      clampScore(input.analyzers.audio.score) * analyzerWeights.audio) /
      totalWeight
  );
  const riskLevel = resolveRiskLevel(overallScore);
  const createdAt = new Date().toISOString();
  const technicalReport: LaboratoryTechnicalReport = {
    schemaVersion: 3,
    projectId: input.projectId,
    entryId: input.entryId,
    workspaceId: input.source.workspaceId,
    createdAt,
    overallScore,
    riskLevel,
    interpretation: buildInterpretation(
      overallScore,
      reportLocale,
      input.analyzers,
      workflowSettings
    ),
    mode: input.mode,
    reportLocale,
    source: input.source,
    workflowSettings,
    selection: input.selection,
    metadata: input.analyzers.metadata,
    motion: input.analyzers.motion,
    visual: input.analyzers.visual,
    audio: input.analyzers.audio,
    sections: [
      buildSection("metadata", sectionTitle(reportLocale, "metadata"), input.analyzers.metadata),
      buildSection("motion", sectionTitle(reportLocale, "motion"), input.analyzers.motion),
      buildSection("visual", sectionTitle(reportLocale, "visual"), input.analyzers.visual),
      buildSection("audio", sectionTitle(reportLocale, "audio"), input.analyzers.audio),
    ],
  };

  return {
    technicalReport,
    userReport: buildUserReport(reportLocale, riskLevel, overallScore, input.analyzers),
  };
}
