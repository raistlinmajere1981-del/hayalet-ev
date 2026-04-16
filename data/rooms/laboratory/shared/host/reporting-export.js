export function createLaboratoryReportExportRuntime(deps) {
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
    buildReportMarkdown
  } = deps;
  async function exportFeatureReport(api, runtime, requestId, featureId) {
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
      jobId,
      requestId,
      action,
      projectId: project.id,
      featureStage: "report"
    });
    pushJobState(api, {
      requestId,
      jobId,
      action,
      projectId: project.id,
      featureStage: "report",
      stage: "queued",
      percent: 0
    });
    try {
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const baseName = `${sanitizeFileSegment(project.slug, "project")}-${featureId}-${stamp}`;
      const fileName = `${baseName}-user.md`;
      const outputPath = `${getFeatureReportDir(runtime, project, featureId)}/${fileName}`;
      const aiFileName = `${baseName}-ai.json`;
      const aiOutputPath = `${getFeatureReportDir(runtime, project, featureId)}/${aiFileName}`;
      await writeTextFile(
        outputPath,
        buildReportMarkdown(runtime, project, featureId, reportRecord)
      );
      await writeTextFile(aiOutputPath, JSON.stringify(reportRecord.aiReport || null, null, 2));
      const userExportEntry = normalizeReportExport({
        format: "md",
        path: outputPath,
        fileName,
        status: "ready"
      });
      const aiExportEntry = normalizeReportExport({
        format: "json",
        path: aiOutputPath,
        fileName: aiFileName,
        status: "ready"
      });
      await patchActiveProject(runtime, function(nextProject) {
        const nextReportRecord = composeFeatureReport(runtime, nextProject, featureId);
        const currentReportRecord = getFeatureReportRecord(nextProject, featureId);
        const currentExports = Array.isArray(currentReportRecord.exports) ? currentReportRecord.exports : [];
        nextReportRecord.exports = [userExportEntry, aiExportEntry].concat(
          currentExports.slice(0, 6)
        );
        setFeatureReportRecord(nextProject, featureId, nextReportRecord);
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action,
        projectId: project.id,
        featureStage: "report",
        stage: "completed",
        percent: 100
      });
    } catch (error) {
      await patchActiveProject(runtime, function(nextProject) {
        setFeatureReportRecord(nextProject, featureId, {
          ...getFeatureReportRecord(nextProject, featureId),
          status: "error",
          error: error instanceof Error ? error.message : String(error)
        });
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action,
        projectId: project.id,
        featureStage: "report",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  return {
    exportFeatureReport
  };
}
