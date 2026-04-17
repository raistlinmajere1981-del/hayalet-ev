import { createLaboratoryManagedProcessRunnersRuntime } from "./process-managed-runners.js";
import { extractFindings } from "../../services/finding-engine.js";
export function createLaboratoryProcessRuntime(deps) {
  const {
    appendProcessEvent,
    asNonEmptyString,
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildSubtitleProcessModules,
    cancelProcessJobsForProject,
    clearJob,
    clone,
    composeFeatureReport,
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
  function appendRunLifecycleEvent(record, action, stage, detail, options = {}) {
    return appendProcessEvent(record, {
      kind: options.kind || "activity",
      severity: options.severity || (stage === "completed" ? "success" : stage === "failed" ? "error" : stage === "cancelled" ? "warning" : "info"),
      message: options.message || (stage === "completed" ? "Analiz tamamlandi" : stage === "failed" ? "Analiz hata verdi" : stage === "cancelled" ? "Analiz iptal edildi" : "Analiz basladi"),
      detail,
      action,
      stage,
      scope: "run"
    });
  }
  function deriveProcessEmptyReason(featureId, processRecord) {
    const semanticEventCount = Array.isArray(processRecord["events"]) ? processRecord["events"].length : 0;
    const rawLogCount = Array.isArray(processRecord["rawLog"]) ? processRecord["rawLog"].length : 0;
    if (semanticEventCount === 0 && rawLogCount === 0) {
      return featureId === subtitleFeatureId ? "Altyazi analizi tamamlandi ancak islenebilir arac cikisi gelmedigi icin rapor bos kaldi." : featureId === audioFeatureId ? "Ses analizi tamamlandi ancak okunabilir is izi uretilmedigi icin rapor bos kaldi." : "Analiz tamamlandi ancak araclardan anlamli cikti gelmedigi icin rapor bos kaldi.";
    }
    return featureId === subtitleFeatureId ? "Secili altyazi girdilerinden raporlanabilir bulgu veya artefakt cikmadi." : featureId === audioFeatureId ? "Ses modulleri raporlanabilir bir sinyal veya artefakt uretmedi." : "Analiz akisi tamamlandi ancak raporlanabilir bulgu veya artefakt cikmadi.";
  }
  async function runManagedProcess(runtime, project, requestId, jobId, featureId, outputDir) {
    const target = resolveProcessTarget(project, featureId);
    const action = getFeatureProcessJobAction(featureId);
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
    processRecord["events"] = [];
    processRecord["rawLog"] = [];
    processRecord["emptyReason"] = null;
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
    appendRunLifecycleEvent(
      processRecord,
      action,
      "running",
      typeof processRecord["targetSummary"] === "object" && processRecord["targetSummary"] !== null ? asNonEmptyString(toRecord(processRecord["targetSummary"])["label"]) : null
    );
    const runtimeJobs = toRecord(runtime["jobs"]);
    const jobRecord = toRecord(runtimeJobs[jobId]);
    if (Object.keys(jobRecord).length > 0) {
      jobRecord["processRecordRef"] = processRecord;
    }
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
    const collectedFindings = Array.isArray(results["findings"]) ? results["findings"] : [];
    const derivedFindings = extractFindings(
      (Array.isArray(processRecord["events"]) ? processRecord["events"] : []).map(function(entry) {
        return toRecord(entry);
      })
    );
    const derivedFindingRecords = derivedFindings.filter(function(candidate) {
      return collectedFindings.some(function(finding) {
        return toRecord(finding)["title"] === candidate.title;
      }) === false;
    }).map(function(candidate) {
      return {
        id: candidate.id,
        moduleId: candidate.moduleId,
        title: candidate.title,
        detail: candidate.detail,
        level: candidate.level,
        confidence: candidate.confidence,
        kind: candidate.kind,
        evidenceCount: candidate.evidenceCount,
        artifactIds: candidate.artifactIds
      };
    });
    processRecord["findings"] = collectedFindings.concat(derivedFindingRecords);
    processRecord["artifacts"] = results["artifacts"];
    processRecord["warnings"] = results["warnings"];
    processRecord["status"] = "ready";
    processRecord["completedAt"] = (/* @__PURE__ */ new Date()).toISOString();
    processRecord["emptyReason"] = Array.isArray(processRecord["findings"]) && processRecord["findings"].length === 0 && Array.isArray(processRecord["artifacts"]) && processRecord["artifacts"].length === 0 ? deriveProcessEmptyReason(featureId, processRecord) : null;
    appendRunLifecycleEvent(
      processRecord,
      action,
      "completed",
      processRecord["emptyReason"],
      {
        message: "Analiz tamamlandi",
        severity: "success"
      }
    );
    appendRunLifecycleEvent(processRecord, action, "completed", null, {
      kind: "request-result",
      message: "Analiz istegi tamamlandi",
      severity: "success"
    });
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
      featureStage: "process",
      stage: "queued"
    });
    await patchActiveProject(runtime, function(nextProject) {
      nextProject["workbench"] = resolveProcessWorkbench(nextProject, featureId, workbenchSource);
      setFeatureProcessRecord(nextProject, featureId, {
        ...createEmptyProcessRun(featureId),
        featureId,
        status: "running",
        jobId,
        requestId,
        percent: null
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
        stage: "completed"
      });
    } catch (error) {
      await patchActiveProject(runtime, function(nextProject) {
        const failedRecord = {
          ...getFeatureProcessRecord(nextProject, featureId),
          status: "failed",
          jobId: null,
          requestId: null,
          error: error instanceof Error ? error.message : String(error)
        };
        appendRunLifecycleEvent(
          failedRecord,
          action,
          "failed",
          error instanceof Error ? error.message : String(error),
          {
            message: "Analiz hata verdi",
            severity: "error"
          }
        );
        appendRunLifecycleEvent(
          failedRecord,
          action,
          "failed",
          error instanceof Error ? error.message : String(error),
          {
            kind: "request-result",
            message: "Analiz istegi hata verdi",
            severity: "error"
          }
        );
        setFeatureProcessRecord(nextProject, featureId, failedRecord);
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action,
        projectId: project["id"],
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
          ...createEmptyProcessRun(queuedFeatureId),
          featureId: queuedFeatureId,
          status: "queued",
          requestId,
          percent: null
        });
        markFeatureReportStale(
          nextProject,
          queuedFeatureId,
          "A new process run is now in progress."
        );
      });
      return nextProject;
    });
    const errors = [];
    await runFeatureIds.reduce(async function(previousRun, nextFeatureId) {
      await previousRun;
      try {
        await runSingleFeatureProcess(api, runtime, requestId, nextFeatureId, workbench);
      } catch (error) {
        errors.push(
          error instanceof Error ? error : new Error(typeof error === "string" ? error : "Process run failed.")
        );
      }
    }, Promise.resolve());
    if (errors.length === runFeatureIds.length) {
      const firstError = errors[0];
      throw firstError instanceof Error ? firstError : new Error("Process run failed.");
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
        const cancelledRecord = {
          ...existingRecord,
          status: "cancelled",
          jobId: null,
          requestId: null,
          error: null
        };
        appendRunLifecycleEvent(
          cancelledRecord,
          getFeatureProcessJobAction(recordFeatureId),
          "cancelled",
          "Calisma kullanici tarafindan iptal edildi.",
          {
            message: "Analiz iptal edildi",
            severity: "warning"
          }
        );
        appendRunLifecycleEvent(
          cancelledRecord,
          getFeatureProcessJobAction(recordFeatureId),
          "cancelled",
          "Calisma kullanici tarafindan iptal edildi.",
          {
            kind: "request-result",
            message: "Analiz istegi iptal edildi",
            severity: "warning"
          }
        );
        setFeatureProcessRecord(nextProject, recordFeatureId, cancelledRecord);
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
