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
    return createEmptyFeatureProcessRecord(featureId);
  }
  function updateProcessRecordPercent(record) {
    const processRecord = toProcessRecord(record);
    const modules = Array.isArray(processRecord.modules) ? processRecord.modules.map(normalizeProcessModule) : [];
    if (modules.length === 0) {
      processRecord.percent = processRecord.status === "ready" ? 100 : 0;
      return processRecord;
    }
    const total = modules.reduce(function(sum, moduleEntry) {
      const moduleRecord = toProcessModuleRecord(moduleEntry);
      const status = asNonEmptyString(moduleRecord.status) || "idle";
      if (status === "running" || status === "queued" || status === "idle") {
        return sum + Math.max(0, Math.min(100, Math.round(asNumber(moduleRecord.percent) || 0)));
      }
      return sum + 100;
    }, 0);
    processRecord.percent = Math.max(0, Math.min(100, Math.round(total / modules.length)));
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
    modules[moduleIndex] = normalizeProcessModule({
      ...toProcessModuleRecord(modules[moduleIndex]),
      ...toRecord(patch)
    });
    processRecord.modules = modules;
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
    updateProcessModule,
    updateProcessRecordPercent
  };
}
