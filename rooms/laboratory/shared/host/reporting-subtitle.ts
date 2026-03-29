// @ts-nocheck
export function createLaboratorySubtitleReportRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    getFindingSeverityRank,
    normalizeFeatureReportRecord,
    createEmptyFeatureReportRecord,
    getFeatureProcessRecord,
    normalizeProcessFinding,
    normalizeProcessArtifact,
    getSubtitleAnalysisModuleDescriptors,
    getSubtitleSelectedEntries,
    normalizeProcessModule,
    getFeatureReportRecord,
    normalizeStringArray,
    toRecord,
    subtitleFeatureId,
  } = deps;

  function getProcessArtifactByKind(processRecord, kind) {
    return (
      (Array.isArray(processRecord.artifacts) ? processRecord.artifacts.map(normalizeProcessArtifact) : []).find(
        function (entry) {
          return asNonEmptyString(entry.kind) === kind;
        }
      ) || null
    );
  }

  function composeSubtitleAnalysisReport(runtime, project) {
    const processRecord = getFeatureProcessRecord(project, subtitleFeatureId);
    if (processRecord.status !== "ready" && processRecord.status !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(subtitleFeatureId),
          status: processRecord.status === "running" ? "staged" : "idle",
          warnings: processRecord.warnings || [],
        },
        subtitleFeatureId
      );
    }

    const findings = (Array.isArray(processRecord.findings) ? processRecord.findings : [])
      .map(normalizeProcessFinding)
      .sort(function (left, right) {
        return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
      });
    const modules = Array.isArray(processRecord.modules) ? processRecord.modules.map(normalizeProcessModule) : [];
    const completedCount = modules.filter(function (entry) {
      return ["ready", "stale", "complete"].includes(asNonEmptyString(entry.status) || "idle");
    }).length;
    const plannedCount = getSubtitleAnalysisModuleDescriptors(runtime).filter(function (entry) {
      return asNonEmptyString(entry.status) === "planned";
    }).length;
    const targetEntries = getSubtitleSelectedEntries(project);
    const summaryArtifact = getProcessArtifactByKind(processRecord, "subtitle-summary");
    const lexicalArtifact = getProcessArtifactByKind(processRecord, "subtitle-top-words");
    const lexicalModule =
      modules.find(function (entry) {
        return entry.id === "lexical-frequency";
      }) || null;
    const totalCues =
      asNumber(toRecord(summaryArtifact).metadata.totalCues) ||
      findings.reduce(function (sum, entry) {
        return sum + Math.max(0, Math.round(asNumber(entry.evidenceCount) || 0));
      }, 0) ||
      0;
    const uniqueLanguages = Array.from(
      new Set(
        targetEntries
          .map(function (entry) {
            return asNonEmptyString(toRecord(entry).language);
          })
          .filter(Boolean)
      )
    );
    const topWord =
      asNonEmptyString(toRecord(lexicalArtifact).metadata.topWord) ||
      (typeof toRecord(lexicalModule).summary === "string" &&
      toRecord(lexicalModule).summary.toLowerCase().includes("top lexical term is")
        ? asNonEmptyString(
            toRecord(lexicalModule)
              .summary.replace(/^.*?"/, "")
              .replace(/".*$/, "")
          )
        : null);
    const warnings = Array.from(
      new Set(
        normalizeStringArray(processRecord.warnings).concat(
          modules.flatMap(function (entry) {
            return normalizeStringArray(entry.warnings);
          })
        )
      )
    );
    const caveats = [];

    if (plannedCount > 0) {
      caveats.push(`${plannedCount} subtitle module(s) remain planned for the next rollout.`);
    }
    if (targetEntries.length > 1) {
      caveats.push("Batch subtitle selections summarize the currently selected entries only.");
    }
    if (uniqueLanguages.length === 0) {
      caveats.push("Subtitle language tags are missing on the current selection.");
    }

    return normalizeFeatureReportRecord(
      {
        featureId: subtitleFeatureId,
        status: "ready",
        sourceRunId: processRecord.runId,
        generatedAt: new Date().toISOString(),
        summaryCards: [
          {
            id: "subtitle-target",
            labelKey: "subtitleAnalysis.report.summaryCards.target",
            value: asNonEmptyString(toRecord(processRecord.targetSummary).label) || project.name,
          },
          {
            id: "subtitle-files",
            labelKey: "subtitleAnalysis.report.summaryCards.files",
            value: String(asNumber(toRecord(processRecord.targetSummary).entryCount) || targetEntries.length || 0),
          },
          {
            id: "subtitle-cues",
            labelKey: "subtitleAnalysis.report.summaryCards.cues",
            value: String(totalCues),
          },
          {
            id: "subtitle-findings",
            labelKey: "subtitleAnalysis.report.summaryCards.findings",
            value: String(findings.length),
          },
          {
            id: "subtitle-languages",
            labelKey: "subtitleAnalysis.report.summaryCards.languages",
            value: uniqueLanguages.length > 0 ? uniqueLanguages.join(", ") : "--",
          },
          {
            id: "subtitle-top-term",
            labelKey: "subtitleAnalysis.report.summaryCards.topTerm",
            value: topWord || "--",
          },
          {
            id: "subtitle-modules",
            labelKey: "subtitleAnalysis.report.summaryCards.modules",
            value: String(completedCount),
          },
        ],
        findings: findings,
        caveats: caveats,
        warnings: warnings,
        exports: getFeatureReportRecord(project, subtitleFeatureId).exports,
        error: null,
      },
      subtitleFeatureId
    );
  }

  return {
    composeSubtitleAnalysisReport,
    getProcessArtifactByKind,
  };
}
