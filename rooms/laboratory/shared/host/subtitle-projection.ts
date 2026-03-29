type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id: string;
};

type LaboratoryFeatureProcessRecord = LaboratoryRecord & {
  completedAt?: unknown;
  modules?: unknown[];
  status?: unknown;
};

type LaboratoryFeatureReportRecord = LaboratoryRecord & {
  exports?: unknown[];
  findings?: unknown[];
  generatedAt?: unknown;
  summaryCards?: unknown[];
  warnings?: unknown[];
};

type LaboratorySubtitleAnalysisProjection = LaboratoryRecord & {
  findings?: unknown[];
  lastRunAt?: string | null;
  moduleResults?: Record<string, LaboratoryProcessModuleRecord>;
  status?: string | null;
  summaryCards?: unknown[];
  warnings?: string[];
};

type LaboratorySubtitleExportProjection = LaboratoryRecord & {
  items?: unknown[];
  lastGeneratedAt?: string | null;
};

type LaboratorySubtitleAnalysisState = LaboratoryRecord & {
  analysis: LaboratorySubtitleAnalysisProjection;
  export: LaboratorySubtitleExportProjection;
};

type LaboratorySubtitleProjectionProject = LaboratoryRecord & {
  subtitleAnalysis?: unknown;
};

type LaboratorySubtitleProjectionRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  normalizeProcessFinding: (value: unknown) => unknown;
  normalizeProcessModule: (value: unknown) => LaboratoryProcessModuleRecord;
  normalizeReportExport: (value: unknown) => unknown;
  normalizeReportSummaryCard: (value: unknown) => unknown;
  normalizeSubtitleAnalysisState: (
    rawValue: unknown,
    runtime: unknown,
  ) => LaboratorySubtitleAnalysisState;
  readFeatureProcessRecord: (
    project: LaboratorySubtitleProjectionProject,
    featureId: string,
  ) => LaboratoryFeatureProcessRecord;
  readFeatureReportRecord: (
    project: LaboratorySubtitleProjectionProject,
    featureId: string,
  ) => LaboratoryFeatureReportRecord;
  subtitleFeatureId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratorySubtitleProjectionRuntime(
  deps: LaboratorySubtitleProjectionRuntimeDeps,
) {
  const {
    asNonEmptyString,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeReportExport,
    normalizeReportSummaryCard,
    normalizeSubtitleAnalysisState,
    readFeatureProcessRecord,
    readFeatureReportRecord,
    subtitleFeatureId,
    toRecord,
  } = deps;

  function syncProjectSubtitleAnalysisProjection(
    runtime: unknown,
    project: LaboratorySubtitleProjectionProject,
  ): LaboratorySubtitleAnalysisState {
    const subtitleState = normalizeSubtitleAnalysisState(
      toRecord(project).subtitleAnalysis,
      runtime,
    );
    const processRecord = readFeatureProcessRecord(project, subtitleFeatureId);
    const reportRecord = readFeatureReportRecord(project, subtitleFeatureId);

    subtitleState.analysis = {
      ...subtitleState.analysis,
      status: asNonEmptyString(processRecord.status) || "idle",
      summaryCards: Array.isArray(reportRecord.summaryCards)
        ? reportRecord.summaryCards.map(normalizeReportSummaryCard)
        : [],
      findings: Array.isArray(reportRecord.findings)
        ? reportRecord.findings.map(normalizeProcessFinding)
        : [],
      warnings: Array.isArray(reportRecord.warnings) ? reportRecord.warnings.map(String) : [],
      moduleResults: (Array.isArray(processRecord.modules) ? processRecord.modules : []).reduce<Record<string, LaboratoryProcessModuleRecord>>(
        function (accumulator, entry) {
          const moduleRecord = normalizeProcessModule(entry);
          accumulator[moduleRecord.id] = moduleRecord;
          return accumulator;
        },
        {}
      ),
      lastRunAt: asNonEmptyString(processRecord.completedAt),
    };
    subtitleState.export = {
      lastGeneratedAt: asNonEmptyString(reportRecord.generatedAt),
      items: Array.isArray(reportRecord.exports) ? reportRecord.exports.map(normalizeReportExport) : [],
    };
    project.subtitleAnalysis = subtitleState;
    return subtitleState;
  }

  return {
    syncProjectSubtitleAnalysisProjection,
  };
}
