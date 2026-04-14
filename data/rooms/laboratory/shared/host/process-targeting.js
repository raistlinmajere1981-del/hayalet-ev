import { createLaboratoryWorkbenchState } from "./runtime-primitives.js";
export function createLaboratoryProcessTargetingRuntime(deps) {
  const {
    audioFeatureId,
    subtitleFeatureId,
    asNonEmptyString,
    buildProfileModelSummary,
    getActiveSubtitleEntry,
    getSubtitleMimeType,
    getSubtitleSelectedEntries,
    normalizeProcessModule,
    normalizeSubtitleAnalysisState,
    resolveAudioFeatureTarget,
    resolveProfileTarget,
    toRecord
  } = deps;
  function toProfileRecord(value) {
    return toRecord(value);
  }
  function toSourceRecord(value) {
    return toRecord(value);
  }
  function toEditRecord(value) {
    return toRecord(value);
  }
  function toReadinessRecord(value) {
    return toRecord(value);
  }
  function toSubtitleAnalysisRecord(value) {
    return toRecord(value);
  }
  function toSubtitleEntryRecord(value) {
    return toRecord(value);
  }
  function toProcessTargetRecord(value) {
    return toRecord(value);
  }
  function toWorkbenchRecord(value) {
    return toRecord(value);
  }
  function toModelSummaryEntry(value) {
    return toRecord(value);
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return asNonEmptyString(entry);
    }).filter((entry) => entry !== null);
  }
  function resolveProcessWorkbench(project, featureId, workbenchSource = {}) {
    const requestedFeatureId = asNonEmptyString(featureId);
    const baseWorkbench = createLaboratoryWorkbenchState({
      ...toWorkbenchRecord(project.workbench),
      ...toWorkbenchRecord(workbenchSource),
      ...requestedFeatureId ? { activeModuleId: requestedFeatureId } : {}
    });
    const selectedModuleIds = toStringArray(baseWorkbench.selectedModuleIds);
    if (requestedFeatureId === null || selectedModuleIds.includes(requestedFeatureId)) {
      return baseWorkbench;
    }
    return createLaboratoryWorkbenchState({
      ...baseWorkbench,
      activeModuleId: requestedFeatureId,
      selectedModuleIds: [requestedFeatureId, ...selectedModuleIds]
    });
  }
  function resolveProcessRunFeatureIds(project, featureId, workbenchSource = {}) {
    const workbench = resolveProcessWorkbench(project, featureId, workbenchSource);
    const requestedFeatureId = asNonEmptyString(featureId) || asNonEmptyString(workbench.activeModuleId);
    const selectedModuleIds = toStringArray(workbench.selectedModuleIds);
    if (requestedFeatureId === null) {
      return selectedModuleIds;
    }
    if (selectedModuleIds.includes(requestedFeatureId) === false) {
      return [requestedFeatureId];
    }
    return [
      requestedFeatureId,
      ...selectedModuleIds.filter(function(entry) {
        return entry !== requestedFeatureId;
      })
    ];
  }
  function resolveProcessTarget(project, featureId) {
    if (featureId === audioFeatureId) {
      return resolveAudioFeatureTarget(project);
    }
    if (featureId === subtitleFeatureId) {
      const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, {});
      const analysis = toSubtitleAnalysisRecord(subtitleState.analysis);
      const selectedEntries = getSubtitleSelectedEntries(project).map(toSubtitleEntryRecord);
      const activeEntry = selectedEntries[0] || getActiveSubtitleEntry(project);
      return {
        requestedMode: asNonEmptyString(analysis.sourceSelection) || "active-entry",
        mode: selectedEntries.length > 1 ? "batch" : "entry",
        outputId: null,
        path: activeEntry ? activeEntry.path : null,
        fileName: activeEntry ? activeEntry.fileName : null,
        mimeType: activeEntry && typeof activeEntry.fileName === "string" ? getSubtitleMimeType(activeEntry.fileName) : null,
        metadata: activeEntry ? toRecord(activeEntry.metadata) : null,
        signature: selectedEntries.map(function(entry) {
          return `${String(entry.id || "")}:${String(entry.path || entry.fileName || "")}`;
        }).join("|"),
        label: selectedEntries.length > 1 ? `${selectedEntries.length} subtitle files` : activeEntry ? asNonEmptyString(activeEntry.fileName) || asNonEmptyString(project.name) || "Project" : asNonEmptyString(project.name) || "Project",
        entries: selectedEntries,
        usingFallback: false,
        reason: null
      };
    }
    return resolveProfileTarget(project);
  }
  function createQueuedProcessModule(id, labelKey, title, summary) {
    return normalizeProcessModule({
      id,
      labelKey,
      title,
      status: "queued",
      percent: 0,
      summary: summary || "",
      warnings: [],
      artifactIds: [],
      findingIds: []
    });
  }
  function buildMediaProcessModules(_runtime, project, target) {
    const readiness = toReadinessRecord(toProfileRecord(project.profile).readiness);
    const enabledLaneIds = toStringArray(readiness.enabledLaneIds);
    const sourceKind = asNonEmptyString(toSourceRecord(project.source).kind) || "video";
    const edit = toEditRecord(project.edit);
    const targetRecord = toProcessTargetRecord(target);
    const modules = [];
    modules.push(
      createQueuedProcessModule(
        "intake",
        "mediaAnalysis.process.steps.intake",
        "Source Intake",
        targetRecord.path ? "Target asset is pinned and ready for the managed run." : "Prepare a source before starting."
      )
    );
    modules.push(
      createQueuedProcessModule(
        "cleanup",
        "mediaAnalysis.process.steps.cleanup",
        "Frame Cleanup",
        asNonEmptyString(edit.handoffMode) === "derived" ? "Using the selected derived output as the active analysis handoff." : "Using the original source as the active analysis handoff."
      )
    );
    modules.push(
      normalizeProcessModule({
        ...createQueuedProcessModule(
          "motion",
          "mediaAnalysis.process.steps.motion",
          "Motion Analysis",
          ""
        ),
        status: sourceKind === "video" && enabledLaneIds.includes("visual-tamper") ? "queued" : "skipped",
        summary: sourceKind === "video" && enabledLaneIds.includes("visual-tamper") ? "Visual tamper checks will run on the pinned target." : "Motion analysis is not active for this target."
      })
    );
    modules.push(
      normalizeProcessModule({
        ...createQueuedProcessModule(
          "audio",
          "mediaAnalysis.process.steps.audio",
          "Audio Sweep",
          ""
        ),
        status: (sourceKind === "video" || sourceKind === "audio") && (enabledLaneIds.includes("audio-tamper") || enabledLaneIds.includes("speech-overlay")) ? "queued" : "skipped",
        summary: sourceKind === "video" || sourceKind === "audio" ? "Audio continuity, loudness, and optional transcript checks will run." : "Audio sweep is not applicable to this target."
      })
    );
    modules.push(
      createQueuedProcessModule(
        "report",
        "mediaAnalysis.process.steps.report",
        "Report Synthesis",
        "The managed run will persist a report-ready summary for the final stage."
      )
    );
    return modules;
  }
  function buildProcessSpeechAvailability(runtime, project) {
    const summaries = buildProfileModelSummary(runtime, project).map(toModelSummaryEntry);
    const selected = summaries.find(function(entry) {
      return entry.selected === true;
    }) || null;
    const readyModel = selected && selected.ready === true ? selected : summaries.find(function(entry) {
      return entry.ready === true;
    }) || null;
    return {
      ready: readyModel !== null,
      model: readyModel
    };
  }
  return {
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    resolveProcessRunFeatureIds,
    resolveProcessWorkbench,
    resolveProcessTarget
  };
}
