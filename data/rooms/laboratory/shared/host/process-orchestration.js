export function createLaboratoryProcessOrchestrationRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    audioAnalysisProjectionRuntime,
    createEmptyFeatureProcessRecord,
    normalizeProcessModule,
    processTargetingRuntime,
    toRecord
  } = deps;
  function toRuntimeRecord(value) {
    return toRecord(value);
  }
  function toProcessRecord(value) {
    return toRecord(value);
  }
  function toProcessModuleRecord(value) {
    return toRecord(value);
  }
  function resolveProcessTarget(project, featureId) {
    return processTargetingRuntime.resolveProcessTarget(project, featureId);
  }
  function resolveProcessRunFeatureIds(project, featureId, workbenchSource = {}) {
    return processTargetingRuntime.resolveProcessRunFeatureIds(project, featureId, workbenchSource);
  }
  function resolveProcessWorkbench(project, featureId, workbenchSource = {}) {
    return processTargetingRuntime.resolveProcessWorkbench(project, featureId, workbenchSource);
  }
  function buildMediaProcessModules(runtime, project, target) {
    return processTargetingRuntime.buildMediaProcessModules(runtime, project, target);
  }
  function buildAudioAnalysisModules(runtime, project, target) {
    return audioAnalysisProjectionRuntime.buildAudioAnalysisModules(runtime, project, target);
  }
  function getAudioAnalysisModulesForRuntime(runtime) {
    const modules = toRuntimeRecord(runtime).audioAnalysisCatalog;
    const moduleEntries = toRecord(modules)["modules"];
    return Array.isArray(moduleEntries) ? moduleEntries.map(function(entry) {
      return toRecord(entry);
    }) : [];
  }
  function buildProcessSpeechAvailability(runtime, project) {
    return processTargetingRuntime.buildProcessSpeechAvailability(runtime, project);
  }
  function createEmptyProcessRun(featureId) {
    return {
      ...createEmptyFeatureProcessRecord(featureId),
      events: [],
      rawLog: [],
      emptyReason: null
    };
  }
  function trimFeed(entries, limit) {
    return entries.slice(Math.max(0, entries.length - limit));
  }
  function appendProcessEvent(record, event) {
    const processRecord = toProcessRecord(record);
    const events = Array.isArray(processRecord.events) ? processRecord.events.map(toRecord) : [];
    events.push({
      id: typeof event["id"] === "string" ? event["id"] : `process-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: typeof event["kind"] === "string" ? event["kind"] : "activity",
      severity: typeof event["severity"] === "string" ? event["severity"] : "info",
      message: typeof event["message"] === "string" ? event["message"] : "İşlem güncellemesi",
      detail: typeof event["detail"] === "string" ? event["detail"] : null,
      timestamp: typeof event["timestamp"] === "number" ? event["timestamp"] : Date.now(),
      source: typeof event["source"] === "string" ? event["source"] : "host",
      action: typeof event["action"] === "string" ? event["action"] : null,
      stage: typeof event["stage"] === "string" ? event["stage"] : null,
      scope: "run",
      moduleId: typeof event["moduleId"] === "string" ? event["moduleId"] : null,
      rawLine: typeof event["rawLine"] === "string" ? event["rawLine"] : null
    });
    processRecord.events = trimFeed(events, 260);
    return processRecord;
  }
  function appendProcessRawLog(record, event) {
    const processRecord = toProcessRecord(record);
    const rawLog = Array.isArray(processRecord.rawLog) ? processRecord.rawLog.map(toRecord) : [];
    rawLog.push({
      id: typeof event["id"] === "string" ? event["id"] : `process-raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "raw-log",
      severity: typeof event["severity"] === "string" ? event["severity"] : "info",
      message: typeof event["message"] === "string" ? event["message"] : typeof event["rawLine"] === "string" ? event["rawLine"] : "Ham çıktı",
      detail: typeof event["detail"] === "string" ? event["detail"] : null,
      timestamp: typeof event["timestamp"] === "number" ? event["timestamp"] : Date.now(),
      source: typeof event["source"] === "string" ? event["source"] : "host",
      action: typeof event["action"] === "string" ? event["action"] : null,
      stage: typeof event["stage"] === "string" ? event["stage"] : null,
      scope: "run",
      moduleId: typeof event["moduleId"] === "string" ? event["moduleId"] : null,
      rawLine: typeof event["rawLine"] === "string" ? event["rawLine"] : null
    });
    processRecord.rawLog = trimFeed(rawLog, 260);
    return processRecord;
  }
  function updateProcessRecordPercent(record) {
    const processRecord = toProcessRecord(record);
    const modules = Array.isArray(processRecord.modules) ? processRecord.modules.map(normalizeProcessModule) : [];
    if (modules.length === 0) {
      processRecord.percent = processRecord.status === "ready" ? 100 : null;
      return processRecord;
    }
    const total = modules.reduce(function(sum, moduleEntry) {
      const moduleRecord = toProcessModuleRecord(moduleEntry);
      const status = asNonEmptyString(moduleRecord.status) || "idle";
      if (status === "running" || status === "queued" || status === "idle") {
        const percent = asNumber(moduleRecord.percent);
        return sum + Math.max(0, Math.min(100, Math.round(percent || 0)));
      }
      return sum + 100;
    }, 0);
    const shouldExposePercent = processRecord.status === "ready" || modules.some(function(moduleEntry) {
      return asNumber(toProcessModuleRecord(moduleEntry).percent) !== null;
    });
    processRecord.percent = shouldExposePercent ? Math.max(0, Math.min(100, Math.round(total / modules.length))) : null;
    return processRecord;
  }
  function updateProcessModule(record, moduleId, patch) {
    const processRecord = toProcessRecord(record);
    const modules = Array.isArray(processRecord.modules) ? processRecord.modules.map(normalizeProcessModule) : [];
    const moduleIndex = modules.findIndex(function(entry) {
      return toProcessModuleRecord(entry).id === moduleId;
    });
    if (moduleIndex === -1) {
      return processRecord;
    }
    const previousModule = toProcessModuleRecord(modules[moduleIndex]);
    const nextModule = normalizeProcessModule({
      ...previousModule,
      ...toRecord(patch)
    });
    modules[moduleIndex] = nextModule;
    processRecord.modules = modules;
    const previousStatus = asNonEmptyString(previousModule.status) || "idle";
    const nextStatus = asNonEmptyString(nextModule.status) || previousStatus;
    if (previousStatus !== nextStatus) {
      const moduleLabel = asNonEmptyString(nextModule["title"]) || asNonEmptyString(nextModule["label"]) || moduleId;
      const detail = asNonEmptyString(toRecord(patch)["message"]) || asNonEmptyString(toRecord(patch)["summary"]);
      appendProcessEvent(processRecord, {
        kind: "activity",
        severity: nextStatus === "failed" ? "error" : nextStatus === "skipped" ? "warning" : nextStatus === "ready" || nextStatus === "completed" ? "success" : "info",
        message: nextStatus === "running" ? `${moduleLabel} başladı` : nextStatus === "failed" ? `${moduleLabel} hata verdi` : nextStatus === "skipped" ? `${moduleLabel} atlandı` : `${moduleLabel} tamamlandı`,
        detail,
        moduleId
      });
    }
    return updateProcessRecordPercent(processRecord);
  }
  function getFeatureProcessJobAction(featureId, audioFeatureId) {
    return featureId === audioFeatureId ? "audio-process-run" : "process-run";
  }
  function getFeatureReportExportAction(featureId, audioFeatureId) {
    return featureId === audioFeatureId ? "audio-report-export" : "report-export";
  }
  return {
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    createEmptyProcessRun,
    getAudioAnalysisModulesForRuntime,
    getFeatureProcessJobAction,
    getFeatureReportExportAction,
    resolveProcessRunFeatureIds,
    resolveProcessWorkbench,
    resolveProcessTarget,
    appendProcessEvent,
    appendProcessRawLog,
    updateProcessModule,
    updateProcessRecordPercent
  };
}
