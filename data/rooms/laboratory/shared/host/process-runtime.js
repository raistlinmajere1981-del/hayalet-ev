import { createLaboratoryManagedProcessRunnersRuntime } from "./process-managed-runners.js";
export function createLaboratoryProcessRuntime(deps) {
  const {
    asNonEmptyString,
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildSubtitleProcessModules,
    cancelProcessJobsForProject,
    clearJob,
    clone,
    composeFeatureReport,
    createEmptyFeatureProcessRecord,
    createEmptyProcessRun,
    ensureEditToolReady,
    ensureProcessJobSlotAvailable,
    ensureProjectDirectories,
    getActiveProject,
    getFeatureProcessDir,
    getFeatureProcessJobAction,
    getFeatureProcessRecord,
    patchActiveProject,
    pushJobState,
    registerJob,
    resolveProcessRunFeatureIds,
    resolveProcessWorkbench,
    resolveProcessTarget,
    sanitizeFileSegment,
    setFeatureProcessRecord,
    setFeatureReportRecord,
    toRecord,
    updateProcessRecordPercent,
    markFeatureReportStale,
    audioFeatureId,
    subtitleFeatureId
  } = deps;
  const managedProcessRunnersDeps = {
    asNonEmptyString: deps["asNonEmptyString"],
    buildProcessSpeechAvailability: deps["buildProcessSpeechAvailability"],
    buildSubtitleAnalysisStats: deps["buildSubtitleAnalysisStats"],
    clampProfileTranscriptSampleSeconds: deps["clampProfileTranscriptSampleSeconds"],
    clone: deps["clone"],
    createProcessArtifact: deps["createProcessArtifact"],
    createProcessFinding: deps["createProcessFinding"],
    generateProcessMetadataArtifact: deps["generateProcessMetadataArtifact"],
    generateProcessSpectrogram: deps["generateProcessSpectrogram"],
    getAudioAnalysisModuleProcessDir: deps["getAudioAnalysisModuleProcessDir"],
    getAudioAnalysisModuleRunner: deps["getAudioAnalysisModuleRunner"],
    getProjectSubtitleProcessDir: deps["getProjectSubtitleProcessDir"],
    maybeRunWhisperProfileSample: deps["maybeRunWhisperProfileSample"],
    normalizeProcessArtifact: deps["normalizeProcessArtifact"],
    normalizeProcessFinding: deps["normalizeProcessFinding"],
    runAudioStructureProbe: deps["runAudioStructureProbe"],
    runVideoStructureProbe: deps["runVideoStructureProbe"],
    sanitizeFileSegment: deps["sanitizeFileSegment"],
    toRecord: deps["toRecord"],
    updateProcessModule: deps["updateProcessModule"],
    writeJsonFile: deps["writeJsonFile"],
    writeTextFile: deps["writeTextFile"]
  };
  const laboratoryManagedProcessRunnersRuntime = createLaboratoryManagedProcessRunnersRuntime(
    managedProcessRunnersDeps
  );
  async function runManagedProcess(runtime, project, requestId, jobId, featureId, outputDir) {
    const target = resolveProcessTarget(project, featureId);
    if (featureId === subtitleFeatureId) {
      if (!Array.isArray(target["entries"]) || target["entries"].length === 0) {
        throw new Error("Import subtitle files before starting subtitle analysis.");
      }
    } else if (target["path"] === null) {
      throw new Error("Prepare a valid target before starting the process stage.");
    }
    const artifactBase = sanitizeFileSegment(
      `${project["slug"]}-${featureId}-${Date.now()}`,
      featureId === audioFeatureId ? "audio-process" : "media-process"
    );
    const processRecord = createEmptyProcessRun(featureId);
    processRecord["status"] = "running";
    processRecord["requestId"] = requestId;
    processRecord["jobId"] = jobId;
    processRecord["runId"] = `${featureId}-run-${Date.now()}`;
    processRecord["startedAt"] = (/* @__PURE__ */ new Date()).toISOString();
    processRecord["targetSummary"] = {
      requestedMode: target["requestedMode"],
      mode: target["mode"],
      outputId: target["outputId"],
      signature: target["signature"],
      label: target["label"],
      fileName: target["fileName"],
      mimeType: target["mimeType"],
      path: target["path"],
      entryCount: Array.isArray(target["entries"]) ? target["entries"].length : null
    };
    processRecord["modules"] = featureId === audioFeatureId ? buildAudioAnalysisModules(runtime, project, target) : featureId === subtitleFeatureId ? buildSubtitleProcessModules(runtime, target) : buildMediaProcessModules(runtime, project, target);
    const results = featureId === subtitleFeatureId ? await laboratoryManagedProcessRunnersRuntime.runSubtitleManagedProcess(
      runtime,
      project,
      target,
      artifactBase,
      processRecord
    ) : featureId === audioFeatureId ? await laboratoryManagedProcessRunnersRuntime.runAudioManagedProcess(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      processRecord
    ) : await laboratoryManagedProcessRunnersRuntime.runMediaManagedProcess(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      outputDir,
      processRecord
    );
    processRecord["findings"] = results["findings"];
    processRecord["artifacts"] = results["artifacts"];
    processRecord["warnings"] = results["warnings"];
    processRecord["status"] = "ready";
    processRecord["completedAt"] = (/* @__PURE__ */ new Date()).toISOString();
    updateProcessRecordPercent(processRecord);
    return processRecord;
  }
  async function runSingleFeatureProcess(api, runtime, requestId, featureId, workbenchSource = {}) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (featureId !== audioFeatureId && featureId !== subtitleFeatureId && asNonEmptyString(toRecord(toRecord(project["profile"])["preflight"])["status"]) !== "ready") {
      throw new Error("Run the profile preflight before starting the process stage.");
    }
    if (featureId !== subtitleFeatureId) {
      ensureEditToolReady(runtime);
    }
    await ensureProjectDirectories(runtime, project, requestId);
    const action = getFeatureProcessJobAction(featureId);
    ensureProcessJobSlotAvailable(runtime, project["id"], action);
    const jobId = `room-process-${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId,
      requestId,
      action,
      projectId: project["id"],
      toolId: "ffmpeg",
      featureStage: "process"
    });
    pushJobState(api, {
      requestId,
      jobId,
      action,
      projectId: project["id"],
      toolId: "ffmpeg",
      featureStage: "process",
      stage: "queued",
      percent: 0
    });
    await patchActiveProject(runtime, function(nextProject) {
      nextProject["workbench"] = resolveProcessWorkbench(nextProject, featureId, workbenchSource);
      setFeatureProcessRecord(nextProject, featureId, {
        ...createEmptyFeatureProcessRecord(featureId),
        featureId,
        status: "running",
        jobId,
        requestId,
        percent: 0
      });
      markFeatureReportStale(nextProject, featureId, "A new process run is now in progress.");
      return nextProject;
    });
    try {
      const nextProcessRecord = await runManagedProcess(
        runtime,
        clone(project),
        requestId,
        jobId,
        featureId,
        getFeatureProcessDir(runtime, project, featureId)
      );
      await patchActiveProject(runtime, function(nextProject) {
        setFeatureProcessRecord(nextProject, featureId, nextProcessRecord);
        setFeatureReportRecord(
          nextProject,
          featureId,
          composeFeatureReport(runtime, nextProject, featureId)
        );
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action,
        projectId: project["id"],
        toolId: "ffmpeg",
        featureStage: "process",
        stage: "completed",
        percent: 100
      });
    } catch (error) {
      await patchActiveProject(runtime, function(nextProject) {
        setFeatureProcessRecord(nextProject, featureId, {
          ...getFeatureProcessRecord(nextProject, featureId),
          status: "error",
          jobId: null,
          requestId: null,
          error: error instanceof Error ? error.message : String(error)
        });
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action,
        projectId: project["id"],
        toolId: "ffmpeg",
        featureStage: "process",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  async function runFeatureProcess(api, runtime, requestId, featureId, workbenchSource = {}) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const workbench = resolveProcessWorkbench(project, featureId, workbenchSource);
    const runFeatureIds = resolveProcessRunFeatureIds(project, featureId, workbenchSource);
    if (runFeatureIds.length === 0) {
      throw new Error("Select at least one analysis module before starting the process stage.");
    }
    await patchActiveProject(runtime, function(nextProject) {
      nextProject["workbench"] = workbench;
      runFeatureIds.slice(1).forEach(function(queuedFeatureId) {
        setFeatureProcessRecord(nextProject, queuedFeatureId, {
          ...createEmptyFeatureProcessRecord(queuedFeatureId),
          featureId: queuedFeatureId,
          status: "queued",
          requestId,
          percent: 0
        });
        markFeatureReportStale(nextProject, queuedFeatureId, "A new process run is now in progress.");
      });
      return nextProject;
    });
    const errors = [];
    for (const nextFeatureId of runFeatureIds) {
      try {
        await runSingleFeatureProcess(api, runtime, requestId, nextFeatureId, workbench);
      } catch (error) {
        errors.push(
          error instanceof Error ? error : new Error(typeof error === "string" ? error : "Process run failed.")
        );
      }
    }
    if (errors.length === runFeatureIds.length) {
      throw errors[0];
    }
    if (errors.length > 0) {
      await patchActiveProject(runtime, function(nextProject) {
        nextProject["process"] = {
          ...toRecord(nextProject["process"]),
          lastError: errors.map(function(entry) {
            return entry.message;
          }).join(" | "),
          lastActionAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        return nextProject;
      });
    }
  }
  async function cancelFeatureProcess(api, runtime, requestId, featureId, workbenchSource = {}) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const workbench = resolveProcessWorkbench(project, featureId, workbenchSource);
    await cancelProcessJobsForProject(api, runtime, project["id"], requestId);
    await patchActiveProject(runtime, function(nextProject) {
      nextProject["workbench"] = workbench;
      const records = toRecord(toRecord(nextProject["process"])["records"]);
      Object.keys(records).forEach(function(recordFeatureId) {
        const existingRecord = getFeatureProcessRecord(nextProject, recordFeatureId);
        if (!["running", "queued"].includes(String(existingRecord["status"] || ""))) {
          return;
        }
        setFeatureProcessRecord(nextProject, recordFeatureId, {
          ...existingRecord,
          status: "cancelled",
          jobId: null,
          requestId: null,
          error: null
        });
      });
      return nextProject;
    });
  }
  return {
    cancelFeatureProcess,
    runFeatureProcess,
    runManagedProcess,
    runSingleFeatureProcess
  };
}
