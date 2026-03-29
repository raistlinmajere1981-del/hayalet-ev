export function createLaboratoryProcessTargetingRuntime(deps) {
  const audioFeatureId = deps.audioFeatureId;
  const subtitleFeatureId = deps.subtitleFeatureId;
  const asNonEmptyString = deps.asNonEmptyString;
  const toRecord = deps.toRecord;
  const normalizeSubtitleAnalysisState = deps.normalizeSubtitleAnalysisState;
  const getSubtitleSelectedEntries = deps.getSubtitleSelectedEntries;
  const getActiveSubtitleEntry = deps.getActiveSubtitleEntry;
  const getSubtitleMimeType = deps.getSubtitleMimeType;
  const resolveAudioFeatureTarget = deps.resolveAudioFeatureTarget;
  const resolveProfileTarget = deps.resolveProfileTarget;
  const normalizeProcessModule = deps.normalizeProcessModule;
  const buildProfileModelSummary = deps.buildProfileModelSummary;
  function resolveProcessTarget(project, featureId) {
    if (featureId === audioFeatureId) {
      return resolveAudioFeatureTarget(project);
    }
    if (featureId === subtitleFeatureId) {
      const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, {});
      const selectedEntries = getSubtitleSelectedEntries(project);
      const activeEntry = selectedEntries[0] || getActiveSubtitleEntry(project);
      return {
        requestedMode: asNonEmptyString(subtitleState.analysis.sourceSelection) || "active-entry",
        mode: selectedEntries.length > 1 ? "batch" : "entry",
        outputId: null,
        path: activeEntry ? activeEntry.path : null,
        fileName: activeEntry ? activeEntry.fileName : null,
        mimeType: activeEntry ? getSubtitleMimeType(activeEntry.fileName) : null,
        metadata: activeEntry ? toRecord(activeEntry.metadata) : null,
        signature: selectedEntries.map(function(entry) {
          return `${entry.id}:${entry.path || entry.fileName}`;
        }).join("|"),
        label: selectedEntries.length > 1 ? `${selectedEntries.length} subtitle files` : activeEntry ? activeEntry.fileName || project.name : project.name,
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
  function buildMediaProcessModules(runtime, project, target) {
    const readiness = toRecord(project.profile.readiness);
    const enabledLaneIds = Array.isArray(readiness.enabledLaneIds) ? readiness.enabledLaneIds : [];
    const sourceKind = asNonEmptyString(toRecord(project.source).kind) || "video";
    const modules = [];
    modules.push(
      createQueuedProcessModule(
        "intake",
        "mediaAnalysis.process.steps.intake",
        "Source Intake",
        target.path ? "Target asset is pinned and ready for the managed run." : "Prepare a source before starting."
      )
    );
    modules.push(
      createQueuedProcessModule(
        "cleanup",
        "mediaAnalysis.process.steps.cleanup",
        "Frame Cleanup",
        asNonEmptyString(toRecord(project.edit).handoffMode) === "derived" ? "Using the selected derived output as the active analysis handoff." : "Using the original source as the active analysis handoff."
      )
    );
    modules.push(
      normalizeProcessModule({
        ...createQueuedProcessModule("motion", "mediaAnalysis.process.steps.motion", "Motion Analysis", ""),
        status: sourceKind === "video" && enabledLaneIds.includes("visual-tamper") ? "queued" : sourceKind === "video" ? "skipped" : "skipped",
        summary: sourceKind === "video" && enabledLaneIds.includes("visual-tamper") ? "Visual tamper checks will run on the pinned target." : "Motion analysis is not active for this target."
      })
    );
    modules.push(
      normalizeProcessModule({
        ...createQueuedProcessModule("audio", "mediaAnalysis.process.steps.audio", "Audio Sweep", ""),
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
    const summaries = buildProfileModelSummary(runtime, project);
    const selected = summaries.find(function(entry) {
      return entry.selected === true;
    }) || null;
    const readyModel = selected && selected.ready === true ? selected : summaries.find(function(entry) {
      return toRecord(entry).ready === true;
    }) || null;
    return {
      ready: readyModel !== null,
      model: readyModel
    };
  }
  return {
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    resolveProcessTarget
  };
}
