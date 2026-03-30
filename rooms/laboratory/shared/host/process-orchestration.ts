type LaboratoryRecord = Record<string, unknown>

type LaboratoryRuntimeRecord = LaboratoryRecord & {
  audioAnalysisCatalog?: unknown
}

type LaboratoryProjectRecord = LaboratoryRecord

type LaboratoryProcessTargetRecord = LaboratoryRecord

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id?: unknown
  percent?: unknown
  status?: unknown
}

type LaboratoryFeatureProcessRecord = LaboratoryRecord & {
  modules?: unknown
  percent?: unknown
  status?: unknown
}

type LaboratoryAudioModuleDescriptor = LaboratoryRecord

type LaboratoryProcessTargetingRuntime = {
  buildMediaProcessModules: (
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord,
    target: LaboratoryProcessTargetRecord
  ) => LaboratoryProcessModuleRecord[]
  buildProcessSpeechAvailability: (
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord
  ) => LaboratoryRecord
  resolveProcessTarget: (
    project: LaboratoryProjectRecord,
    featureId: string | null
  ) => LaboratoryProcessTargetRecord
}

type LaboratoryAudioAnalysisProjectionRuntime = {
  buildAudioAnalysisModules: (
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord,
    target: LaboratoryProcessTargetRecord
  ) => unknown[]
}

type LaboratoryProcessOrchestrationRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null
  asNumber: (value: unknown) => number | null
  audioAnalysisProjectionRuntime: LaboratoryAudioAnalysisProjectionRuntime
  createEmptyFeatureProcessRecord: (featureId: string | null) => LaboratoryFeatureProcessRecord
  normalizeProcessModule: (rawValue: unknown) => LaboratoryProcessModuleRecord
  processTargetingRuntime: LaboratoryProcessTargetingRuntime
  toRecord: (value: unknown) => LaboratoryRecord
}

export function createLaboratoryProcessOrchestrationRuntime(
  deps: LaboratoryProcessOrchestrationRuntimeDeps
) {
  const {
    asNonEmptyString,
    asNumber,
    audioAnalysisProjectionRuntime,
    createEmptyFeatureProcessRecord,
    normalizeProcessModule,
    processTargetingRuntime,
    toRecord,
  } = deps

  function toRuntimeRecord(value: unknown): LaboratoryRuntimeRecord {
    return toRecord(value)
  }

  function toProcessRecord(value: unknown): LaboratoryFeatureProcessRecord {
    return toRecord(value)
  }

  function toProcessModuleRecord(value: unknown): LaboratoryProcessModuleRecord {
    return toRecord(value)
  }

  function resolveProcessTarget(project: LaboratoryProjectRecord, featureId: string | null) {
    return processTargetingRuntime.resolveProcessTarget(project, featureId)
  }

  function buildMediaProcessModules(
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord,
    target: LaboratoryProcessTargetRecord
  ) {
    return processTargetingRuntime.buildMediaProcessModules(runtime, project, target)
  }

  function buildAudioAnalysisModules(
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord,
    target: LaboratoryProcessTargetRecord
  ) {
    return audioAnalysisProjectionRuntime.buildAudioAnalysisModules(runtime, project, target)
  }

  function getAudioAnalysisModulesForRuntime(runtime: LaboratoryRuntimeRecord) {
    const modules = toRuntimeRecord(runtime).audioAnalysisCatalog
    const moduleEntries = toRecord(modules)["modules"]
    return Array.isArray(moduleEntries)
      ? moduleEntries.map(function (entry): LaboratoryAudioModuleDescriptor {
          return toRecord(entry)
        })
      : []
  }

  function buildProcessSpeechAvailability(
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord
  ) {
    return processTargetingRuntime.buildProcessSpeechAvailability(runtime, project)
  }

  function createEmptyProcessRun(featureId: string | null) {
    return createEmptyFeatureProcessRecord(featureId)
  }

  function updateProcessRecordPercent(record: LaboratoryFeatureProcessRecord) {
    const processRecord = toProcessRecord(record)
    const modules = Array.isArray(processRecord.modules)
      ? processRecord.modules.map(normalizeProcessModule)
      : []
    if (modules.length === 0) {
      processRecord.percent = processRecord.status === "ready" ? 100 : 0
      return processRecord
    }

    const total = modules.reduce(function (sum, moduleEntry) {
      const moduleRecord = toProcessModuleRecord(moduleEntry)
      const status = asNonEmptyString(moduleRecord.status) || "idle"
      if (status === "running" || status === "queued" || status === "idle") {
        return sum + Math.max(0, Math.min(100, Math.round(asNumber(moduleRecord.percent) || 0)))
      }
      return sum + 100
    }, 0)
    processRecord.percent = Math.max(0, Math.min(100, Math.round(total / modules.length)))
    return processRecord
  }

  function updateProcessModule(
    record: LaboratoryFeatureProcessRecord,
    moduleId: string,
    patch: LaboratoryRecord
  ) {
    const processRecord = toProcessRecord(record)
    const modules = Array.isArray(processRecord.modules)
      ? processRecord.modules.map(normalizeProcessModule)
      : []
    const moduleIndex = modules.findIndex(function (entry) {
      return toProcessModuleRecord(entry).id === moduleId
    })
    if (moduleIndex === -1) {
      return processRecord
    }
    modules[moduleIndex] = normalizeProcessModule({
      ...toProcessModuleRecord(modules[moduleIndex]),
      ...toRecord(patch),
    })
    processRecord.modules = modules
    return updateProcessRecordPercent(processRecord)
  }

  function getFeatureProcessJobAction(featureId: string | null, audioFeatureId: string) {
    return featureId === audioFeatureId ? "audio-process-run" : "process-run"
  }

  function getFeatureReportExportAction(featureId: string | null, audioFeatureId: string) {
    return featureId === audioFeatureId ? "audio-report-export" : "report-export"
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
  }
}
