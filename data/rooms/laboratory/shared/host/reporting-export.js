import { createLabOutputAsset, upsertLabAsset } from "./lab-assets.js";
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
  function buildSupplementalArtifactExports(reportRecord) {
    const artifacts = Array.isArray(reportRecord.artifacts) ? reportRecord.artifacts : [];
    return artifacts.filter(function(entry) {
      const kind = typeof entry["kind"] === "string" ? entry["kind"] : "";
      return kind === "subtitle-ai-payload" || kind === "subtitle-channel-batch";
    }).map(function(entry) {
      return normalizeReportExport({
        format: "json",
        path: entry["path"],
        fileName: entry["fileName"],
        status: "ready"
      });
    });
  }
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
      stage: "queued"
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
      const supplementalExports = buildSupplementalArtifactExports(reportRecord);
      await patchActiveProject(runtime, function(nextProject) {
        const nextReportRecord = composeFeatureReport(runtime, nextProject, featureId);
        const currentReportRecord = getFeatureReportRecord(nextProject, featureId);
        const currentExports = Array.isArray(currentReportRecord.exports) ? currentReportRecord.exports : [];
        const nextExportEntries = [userExportEntry, aiExportEntry].concat(supplementalExports).concat(currentExports).reduce(function(accumulator, entry) {
          const candidate = normalizeReportExport(entry);
          const candidatePath = typeof candidate["path"] === "string" ? String(candidate["path"]) : "";
          if (candidatePath !== "" && accumulator.some(function(existingEntry) {
            return String(existingEntry["path"] || "") === candidatePath;
          })) {
            return accumulator;
          }
          accumulator.push(candidate);
          return accumulator;
        }, []);
        nextReportRecord.exports = nextExportEntries.slice(0, 8);
        setFeatureReportRecord(nextProject, featureId, nextReportRecord);
        const reportRunId = typeof nextReportRecord["sourceRunId"] === "string" ? nextReportRecord["sourceRunId"] : null;
        const userReportAsset = createLabOutputAsset(nextProject, {
          type: "report",
          name: fileName,
          localPath: outputPath,
          runId: reportRunId,
          metadata: {
            action,
            featureId,
            fileName,
            format: "md",
            requestId
          }
        });
        const aiReportAsset = createLabOutputAsset(nextProject, {
          type: "report",
          name: aiFileName,
          localPath: aiOutputPath,
          runId: reportRunId,
          metadata: {
            action,
            featureId,
            fileName: aiFileName,
            format: "json",
            requestId
          }
        });
        return {
          ...nextProject,
          assets: upsertLabAsset(
            upsertLabAsset(nextProject["assets"], userReportAsset),
            aiReportAsset
          )
        };
      });
      pushJobState(api, {
        requestId,
        jobId,
        action,
        projectId: project.id,
        featureStage: "report",
        stage: "completed"
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
