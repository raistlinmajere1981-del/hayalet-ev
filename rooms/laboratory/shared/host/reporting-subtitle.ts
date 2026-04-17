type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProjectRecord = LaboratoryRecord & {
  name?: unknown;
};

type LaboratoryFeatureProcessRecord = LaboratoryRecord & {
  artifacts?: unknown;
  emptyReason?: unknown;
  error?: unknown;
  findings?: unknown;
  modules?: unknown;
  runId?: unknown;
  status?: unknown;
  targetSummary?: unknown;
  warnings?: unknown;
};

type LaboratoryFeatureReportRecord = LaboratoryRecord & {
  exports?: unknown;
};

type LaboratoryProcessFindingRecord = LaboratoryRecord & {
  evidenceCount?: unknown;
  level?: unknown;
};

type LaboratoryProcessArtifactRecord = LaboratoryRecord & {
  kind?: unknown;
  metadata?: unknown;
  moduleId?: unknown;
};

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id?: unknown;
  status?: unknown;
  summary?: unknown;
  warnings?: unknown;
};

type LaboratorySubtitleModuleDescriptor = LaboratoryRecord & {
  status?: unknown;
};

type LaboratorySubtitleEntryRecord = LaboratoryRecord & {
  language?: unknown;
};

type LaboratorySubtitleMetadataRecord = LaboratoryRecord & {
  topWord?: unknown;
  totalCues?: unknown;
};

type LaboratorySubtitleReportRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  createEmptyFeatureReportRecord: (featureId: string) => LaboratoryRecord;
  getFeatureProcessRecord: (
    project: LaboratoryProjectRecord,
    featureId: string
  ) => LaboratoryFeatureProcessRecord;
  getFeatureReportRecord: (
    project: LaboratoryProjectRecord,
    featureId: string
  ) => LaboratoryFeatureReportRecord;
  getFindingSeverityRank: (level: unknown) => number;
  getSubtitleAnalysisModuleDescriptors: (runtime: LaboratoryRecord) => unknown[];
  getSubtitleSelectedEntries: (project: LaboratoryProjectRecord) => unknown[];
  normalizeFeatureReportRecord: (
    rawValue: unknown,
    featureId: string
  ) => LaboratoryFeatureReportRecord;
  normalizeProcessArtifact: (rawValue: unknown) => LaboratoryProcessArtifactRecord;
  normalizeProcessFinding: (rawValue: unknown) => LaboratoryProcessFindingRecord;
  normalizeProcessModule: (rawValue: unknown) => LaboratoryProcessModuleRecord;
  normalizeStringArray: (value: unknown) => string[];
  subtitleFeatureId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratorySubtitleReportRuntime(deps: LaboratorySubtitleReportRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    createEmptyFeatureReportRecord,
    getFeatureProcessRecord,
    getFeatureReportRecord,
    getFindingSeverityRank,
    getSubtitleAnalysisModuleDescriptors,
    getSubtitleSelectedEntries,
    normalizeFeatureReportRecord,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeStringArray,
    subtitleFeatureId,
    toRecord,
  } = deps;

  function toProjectRecord(value: unknown): LaboratoryProjectRecord {
    return toRecord(value);
  }

  function toFeatureProcessRecord(value: unknown): LaboratoryFeatureProcessRecord {
    return toRecord(value);
  }

  function toFeatureReportRecord(value: unknown): LaboratoryFeatureReportRecord {
    return toRecord(value);
  }

  function toProcessArtifactRecord(value: unknown): LaboratoryProcessArtifactRecord {
    return toRecord(value);
  }

  function toProcessModuleRecord(value: unknown): LaboratoryProcessModuleRecord {
    return toRecord(value);
  }

  function toProcessFindingRecord(value: unknown): LaboratoryProcessFindingRecord {
    return toRecord(value);
  }

  function toSubtitleModuleDescriptor(value: unknown): LaboratorySubtitleModuleDescriptor {
    return toRecord(value);
  }

  function toSubtitleEntryRecord(value: unknown): LaboratorySubtitleEntryRecord {
    return toRecord(value);
  }

  function toMetadataRecord(value: unknown): LaboratorySubtitleMetadataRecord {
    return toRecord(value);
  }

  function getProcessArtifactByKind(
    processRecord: LaboratoryFeatureProcessRecord,
    kind: string
  ): LaboratoryProcessArtifactRecord | null {
    return (
      (Array.isArray(processRecord.artifacts)
        ? processRecord.artifacts.map(normalizeProcessArtifact).map(toProcessArtifactRecord)
        : []
      ).find(function (entry) {
        return asNonEmptyString(entry.kind) === kind;
      }) || null
    );
  }

  function getSubtitleReportEmptyReason(
    processRecord: LaboratoryFeatureProcessRecord,
    processStatus: string
  ) {
    const explicitReason = asNonEmptyString(processRecord.emptyReason);
    if (explicitReason !== null) {
      return explicitReason;
    }
    if (processStatus === "running" || processStatus === "queued") {
      return "Altyazi analizi hala suruyor; rapor tamamlaninca dolacak.";
    }
    if (processStatus === "failed") {
      return (
        asNonEmptyString(processRecord.error) ||
        "Altyazi analizi hata ile tamamlandigi icin rapor bos kaldi."
      );
    }
    if (processStatus === "cancelled") {
      return "Altyazi analizi iptal edildigi icin rapor bos kaldi.";
    }
    return "Once altyazi analizi tamamlanmali.";
  }

  function extractTopWordFromLexicalSummary(
    moduleRecord: LaboratoryProcessModuleRecord
  ): string | null {
    const summary = asNonEmptyString(moduleRecord.summary);
    if (summary === null || summary.toLowerCase().includes("top lexical term is") === false) {
      return null;
    }
    return asNonEmptyString(summary.replace(/^.*?"/, "").replace(/".*$/, ""));
  }

  function composeSubtitleAnalysisReport(
    runtime: LaboratoryRecord,
    project: LaboratoryProjectRecord
  ) {
    const processRecord = toFeatureProcessRecord(
      getFeatureProcessRecord(project, subtitleFeatureId)
    );
    const processStatus = asNonEmptyString(processRecord.status) || "idle";
    if (processStatus !== "ready" && processStatus !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(subtitleFeatureId),
          status: processStatus === "running" ? "staged" : "idle",
          warnings: normalizeStringArray(processRecord.warnings),
          emptyReason: getSubtitleReportEmptyReason(processRecord, processStatus),
        },
        subtitleFeatureId
      );
    }

    const findings = (Array.isArray(processRecord.findings) ? processRecord.findings : [])
      .map(normalizeProcessFinding)
      .map(toProcessFindingRecord)
      .sort(function (left, right) {
        return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
      });
    const modules = Array.isArray(processRecord.modules)
      ? processRecord.modules.map(normalizeProcessModule).map(toProcessModuleRecord)
      : [];
    const completedCount = modules.filter(function (entry) {
      return ["ready", "stale", "complete"].includes(asNonEmptyString(entry.status) || "idle");
    }).length;
    const plannedCount = getSubtitleAnalysisModuleDescriptors(runtime)
      .map(toSubtitleModuleDescriptor)
      .filter(function (entry) {
        return asNonEmptyString(entry.status) === "planned";
      }).length;
    const targetEntries = getSubtitleSelectedEntries(project).map(toSubtitleEntryRecord);
    const summaryArtifact = getProcessArtifactByKind(processRecord, "subtitle-summary");
    const lexicalArtifact = getProcessArtifactByKind(processRecord, "subtitle-top-words");
    const lexicalModule =
      modules.find(function (entry) {
        return entry.id === "lexical-frequency";
      }) || null;
    const summaryMetadata = toMetadataRecord(summaryArtifact?.metadata);
    const lexicalMetadata = toMetadataRecord(lexicalArtifact?.metadata);
    const totalCues =
      asNumber(summaryMetadata.totalCues) ||
      findings.reduce(function (sum, entry) {
        return sum + Math.max(0, Math.round(asNumber(entry.evidenceCount) || 0));
      }, 0);
    const uniqueLanguages = Array.from(
      new Set(
        targetEntries
          .map(function (entry) {
            return asNonEmptyString(entry.language);
          })
          .filter((entry): entry is string => entry !== null)
      )
    );
    const topWord =
      asNonEmptyString(lexicalMetadata.topWord) ||
      (lexicalModule ? extractTopWordFromLexicalSummary(lexicalModule) : null);
    const warnings = Array.from(
      new Set(
        normalizeStringArray(processRecord.warnings).concat(
          modules.flatMap(function (entry) {
            return normalizeStringArray(entry.warnings);
          })
        )
      )
    );
    const caveats: string[] = [];

    if (plannedCount > 0) {
      caveats.push(`${plannedCount} subtitle module(s) remain planned for the next rollout.`);
    }
    if (targetEntries.length > 1) {
      caveats.push("Batch subtitle selections summarize the currently selected entries only.");
    }
    if (uniqueLanguages.length === 0) {
      caveats.push("Subtitle language tags are missing on the current selection.");
    }

    const projectRecord = toProjectRecord(project);
    const targetSummary = toRecord(processRecord.targetSummary);
    const featureReportRecord = toFeatureReportRecord(
      getFeatureReportRecord(project, subtitleFeatureId)
    );

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
            value:
              asNonEmptyString(targetSummary["label"]) ||
              asNonEmptyString(projectRecord.name) ||
              "Project",
          },
          {
            id: "subtitle-files",
            labelKey: "subtitleAnalysis.report.summaryCards.files",
            value: String(asNumber(targetSummary["entryCount"]) || targetEntries.length || 0),
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
        findings,
        caveats,
        warnings,
        exports: featureReportRecord.exports,
        error: null,
        emptyReason:
          findings.length === 0 &&
          (Array.isArray(processRecord.artifacts) ? processRecord.artifacts.length : 0) === 0
            ? getSubtitleReportEmptyReason(processRecord, processStatus)
            : null,
      },
      subtitleFeatureId
    );
  }

  return {
    composeSubtitleAnalysisReport,
    getProcessArtifactByKind,
  };
}
