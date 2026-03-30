type LaboratoryRecord = Record<string, unknown>;

type LaboratoryReportExportEntry = LaboratoryRecord;

type LaboratoryFeatureReportRecord = LaboratoryRecord & {
  error?: string | null;
  exports?: LaboratoryReportExportEntry[];
  status?: string | null;
};

type LaboratoryReportExportProject = LaboratoryRecord & {
  id: string;
  slug: string;
};

type LaboratoryReportExportRuntimeDeps = {
  buildReportMarkdown: (
    runtime: unknown,
    project: LaboratoryRecord,
    featureId: string,
    reportRecord: LaboratoryFeatureReportRecord
  ) => string;
  clearJob: (runtime: unknown, jobId: string) => void;
  composeFeatureReport: (
    runtime: unknown,
    project: LaboratoryRecord,
    featureId: string
  ) => LaboratoryFeatureReportRecord;
  ensureProjectDirectories: (
    runtime: unknown,
    project: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  ensureReportJobSlotAvailable: (runtime: unknown, projectId: string, action: string) => void;
  getActiveProject: (runtime: unknown) => LaboratoryReportExportProject | null;
  getFeatureReportDir: (runtime: unknown, project: LaboratoryRecord, featureId: string) => string;
  getFeatureReportExportAction: (featureId: string) => string;
  getFeatureReportRecord: (
    project: LaboratoryRecord,
    featureId: string
  ) => LaboratoryFeatureReportRecord;
  normalizeReportExport: (value: unknown) => LaboratoryReportExportEntry;
  patchActiveProject: (
    runtime: unknown,
    patcher: (project: LaboratoryReportExportProject) => LaboratoryReportExportProject
  ) => Promise<unknown>;
  pushJobState: (api: unknown, payload: LaboratoryRecord) => void;
  registerJob: (runtime: unknown, options: LaboratoryRecord) => unknown;
  sanitizeFileSegment: (value: unknown, fallback: string) => string;
  setFeatureReportRecord: (
    project: LaboratoryRecord,
    featureId: string,
    record: LaboratoryFeatureReportRecord
  ) => void;
  writeTextFile: (filePath: string, value: string) => Promise<unknown>;
};

export function createLaboratoryReportExportRuntime(deps: LaboratoryReportExportRuntimeDeps) {
  const {
    getActiveProject,
    ensureProjectDirectories,
    getFeatureReportExportAction,
    ensureReportJobSlotAvailable,
    registerJob,
    pushJobState,
    patchActiveProject,
    setFeatureReportRecord,
    sanitizeFileSegment,
    normalizeReportExport,
    writeTextFile,
    clearJob,
    getFeatureReportDir,
    getFeatureReportRecord,
    composeFeatureReport,
    buildReportMarkdown,
  } = deps;

  async function exportFeatureReport(
    api: unknown,
    runtime: unknown,
    requestId: string,
    featureId: string
  ): Promise<void> {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    await ensureProjectDirectories(runtime, project, requestId);
    const reportRecord = composeFeatureReport(runtime, project, featureId);
    if (reportRecord.status !== "ready") {
      throw new Error("Run the process stage before exporting a report.");
    }

    const action = getFeatureReportExportAction(featureId);
    ensureReportJobSlotAvailable(runtime, project.id, action);
    const jobId = `room-report-${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: action,
      projectId: project.id,
      featureStage: "report",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      featureStage: "report",
      stage: "queued",
      percent: 0,
    });

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${sanitizeFileSegment(project.slug, "project")}-${featureId}-${stamp}.md`;
      const outputPath = `${getFeatureReportDir(runtime, project, featureId)}/${fileName}`;
      await writeTextFile(
        outputPath,
        buildReportMarkdown(runtime, project, featureId, reportRecord)
      );
      const exportEntry = normalizeReportExport({
        format: "md",
        path: outputPath,
        fileName: fileName,
        status: "ready",
      });

      await patchActiveProject(runtime, function (nextProject) {
        const nextReportRecord = composeFeatureReport(runtime, nextProject, featureId);
        const currentReportRecord = getFeatureReportRecord(nextProject, featureId);
        const currentExports = Array.isArray(currentReportRecord.exports)
          ? currentReportRecord.exports
          : [];
        nextReportRecord.exports = [exportEntry].concat(currentExports.slice(0, 7));
        setFeatureReportRecord(nextProject, featureId, nextReportRecord);
        return nextProject;
      });
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project.id,
        featureStage: "report",
        stage: "completed",
        percent: 100,
      });
    } catch (error) {
      await patchActiveProject(runtime, function (nextProject) {
        setFeatureReportRecord(nextProject, featureId, {
          ...getFeatureReportRecord(nextProject, featureId),
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        return nextProject;
      });
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project.id,
        featureStage: "report",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    exportFeatureReport,
  };
}
