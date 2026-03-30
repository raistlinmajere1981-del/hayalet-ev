export function createLaboratoryProcessOrchestrationRuntime(deps: any) {
  const {
    asNonEmptyString,
    asNumber,
    audioAnalysisProjectionRuntime,
    createEmptyFeatureProcessRecord,
    normalizeProcessModule,
    processTargetingRuntime,
    toRecord,
  } = deps;

  function resolveProcessTarget(project: any, featureId: any) {
    return processTargetingRuntime.resolveProcessTarget(project, featureId);
  }

  function buildMediaProcessModules(runtime: any, project: any, target: any) {
    return processTargetingRuntime.buildMediaProcessModules(runtime, project, target);
  }

  function buildAudioAnalysisModules(runtime: any, project: any, target: any) {
    return audioAnalysisProjectionRuntime.buildAudioAnalysisModules(runtime, project, target);
  }

  function getAudioAnalysisModulesForRuntime(runtime: any) {
    const modules = toRecord(runtime.audioAnalysisCatalog).modules;
    return Array.isArray(modules) ? modules.map(toRecord) : [];
  }

  function buildProcessSpeechAvailability(runtime: any, project: any) {
    return processTargetingRuntime.buildProcessSpeechAvailability(runtime, project);
  }

  function createEmptyProcessRun(featureId: any) {
    return createEmptyFeatureProcessRecord(featureId);
  }

  function updateProcessRecordPercent(record: any) {
    const modules = Array.isArray(record.modules) ? record.modules.map(toRecord) : [];
    if (modules.length === 0) {
      record.percent = record.status === "ready" ? 100 : 0;
      return record;
    }

    const total = modules.reduce(function (sum: any, moduleEntry: any) {
      const status = asNonEmptyString(moduleEntry.status) || "idle";
      if (status === "running" || status === "queued" || status === "idle") {
        return sum + Math.max(0, Math.min(100, Math.round(asNumber(moduleEntry.percent) || 0)));
      }
      return sum + 100;
    }, 0);
    record.percent = Math.max(0, Math.min(100, Math.round(total / modules.length)));
    return record;
  }

  function updateProcessModule(record: any, moduleId: any, patch: any) {
    const modules = Array.isArray(record.modules) ? record.modules.map(normalizeProcessModule) : [];
    const moduleIndex = modules.findIndex(function (entry: any) {
      return entry.id === moduleId;
    });
    if (moduleIndex === -1) {
      return record;
    }
    modules[moduleIndex] = normalizeProcessModule({
      ...modules[moduleIndex],
      ...toRecord(patch),
    });
    record.modules = modules;
    return updateProcessRecordPercent(record);
  }

  function getFeatureProcessJobAction(featureId: any, audioFeatureId: any) {
    return featureId === audioFeatureId ? "audio-process-run" : "process-run";
  }

  function getFeatureReportExportAction(featureId: any, audioFeatureId: any) {
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
    resolveProcessTarget,
    updateProcessModule,
    updateProcessRecordPercent,
  };
}
