export function createLaboratoryUiFeatureRuntime(deps) {
  const {
    collectProcessStageJobs,
    collectProfileStageJobs,
    collectReportStageJobs,
    getActiveProject: readActiveProject,
    getActiveSubtitleEntry: readActiveSubtitleEntry,
    getAudioAnalysisOrderedResultEntries: readAudioAnalysisOrderedResultEntries,
    getAudioAnalysisSourceState: readAudioAnalysisSourceState,
    getCurrentSourceKind,
    getCurrentSourceLabel,
    getEditOutputs: readEditOutputs,
    getJobs: readJobs,
    getProfileModelsCatalog: readProfileModelsCatalog,
    getProfileModelState: readProfileModelState,
    getProfilePresets: readProfilePresets,
    getProjectProcess: readProjectProcess,
    getProjectProfile: readProjectProfile,
    getProjectReport: readProjectReport,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    textFromKey,
    toRecord
  } = deps;
  function toJobRecord(value) {
    return toRecord(value);
  }
  function toProjectProfileRecord(value) {
    return toRecord(value);
  }
  function toFeatureProcessRecord(value) {
    return toRecord(value);
  }
  function toFeatureReportRecord(value) {
    return toRecord(value);
  }
  function toProfileReadinessRecord(value) {
    return toRecord(value);
  }
  function toTargetSummaryRecord(value) {
    return toRecord(value);
  }
  function toProfilePresetOption(value) {
    return toRecord(value);
  }
  function toProfileLaneRecord(value) {
    return toRecord(value);
  }
  function toProfileModelEntry(value) {
    return toRecord(value);
  }
  function toProfileCatalogRecord(value) {
    return toRecord(value);
  }
  function toProfileStateRecord(value) {
    return toRecord(value);
  }
  function toProfilePresetsRecord(value) {
    return toRecord(value);
  }
  function toSubtitleEntryRecord(value) {
    return toRecord(value);
  }
  function toAudioAnalysisResultEntry(value) {
    return toRecord(value);
  }
  function toOutputRecord(value) {
    return toRecord(value);
  }
  function toRecordList(value) {
    return Array.isArray(value) ? value.map(toRecord) : [];
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry) => typeof entry === "string");
  }
  function getActiveProject() {
    return toRecord(readActiveProject());
  }
  function getActiveProjectId() {
    const project = getActiveProject();
    const projectId = project["id"];
    return typeof projectId === "string" && projectId.trim() !== "" ? projectId : null;
  }
  function getProjectJobs() {
    const projectId = getActiveProjectId();
    if (!projectId) {
      return [];
    }
    return readJobs().map(toJobRecord).filter(function(job) {
      return job.projectId === projectId;
    });
  }
  function getProjectProfileRecord() {
    return toProjectProfileRecord(readProjectProfile());
  }
  function getProfilePresetsRecord() {
    return toProfilePresetsRecord(readProfilePresets());
  }
  function getRelevantJobs() {
    const projectId = getActiveProjectId();
    const toolJobs = [];
    const projectJobs = [];
    readJobs().forEach(function(job) {
      const jobRecord = toJobRecord(job);
      if (projectId && jobRecord.projectId === projectId) {
        projectJobs.push(jobRecord);
        return;
      }
      if (typeof jobRecord.toolId === "string" && jobRecord.toolId.trim() !== "") {
        toolJobs.push(jobRecord);
      }
    });
    return {
      project: projectJobs,
      tools: toolJobs
    };
  }
  function getCurrentFeatureProcessRecord() {
    return toFeatureProcessRecord(readProjectProcess());
  }
  function getCurrentFeatureReportRecord() {
    return toFeatureReportRecord(readProjectReport());
  }
  function getCurrentProfileMode() {
    return getProjectProfileRecord().mode === "advanced" ? "advanced" : "beginner";
  }
  function getProfileLaneMap() {
    return toRecord(getProfilePresetsRecord().lanes);
  }
  function getCompatibleProfileLaneIds() {
    const laneMap = getProfileLaneMap();
    const sourceKind = getCurrentSourceKind();
    return Object.keys(laneMap).filter(function(laneId) {
      const mediaKinds = toStringArray(toProfileLaneRecord(laneMap[laneId]).mediaKinds);
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    });
  }
  function getProfilePresetOptions() {
    const presetsByKind = toRecord(
      toRecord(getProfilePresetsRecord().presets)[getCurrentSourceKind()]
    );
    const mode = getCurrentProfileMode();
    const presetList = Array.isArray(presetsByKind[mode]) ? presetsByKind[mode] : Array.isArray(presetsByKind["beginner"]) ? presetsByKind["beginner"] : [];
    return presetList.map(toProfilePresetOption);
  }
  function getProfileLabel() {
    const activePresetId = typeof getProjectProfileRecord().activePresetId === "string" ? getProjectProfileRecord().activePresetId : null;
    const preset = getProfilePresetOptions().find(function(entry) {
      return entry.id === activePresetId;
    }) || null;
    const labelKey = preset && typeof preset.labelKey === "string" ? preset.labelKey : null;
    return labelKey ? textFromKey(labelKey) : "--";
  }
  function getFocusLabel() {
    const target = getProfileTargetSummary();
    if (typeof target.label === "string" && target.label.trim() !== "") {
      return target.label;
    }
    return getCurrentSourceLabel();
  }
  function getProfileReadiness() {
    return toProfileReadinessRecord(getProjectProfileRecord().readiness);
  }
  function getProfileEstimate() {
    return toRecord(getProjectProfileRecord().estimate);
  }
  function getProfilePreflight() {
    return toRecord(getProjectProfileRecord().preflight);
  }
  function getProfileSignals() {
    return toRecordList(getProjectProfileRecord().signals);
  }
  function getProfileArtifacts() {
    return toRecordList(getProjectProfileRecord().artifacts);
  }
  function getProfileTargetSummary() {
    return toTargetSummaryRecord(getProfileReadiness().target);
  }
  function getProfileTargetMode() {
    const target = getProfileTargetSummary();
    return target.requestedMode === "derived" ? "derived" : "source";
  }
  function getProfileModelEntries() {
    const readinessModels = getProfileReadiness().models;
    if (Array.isArray(readinessModels)) {
      return readinessModels.map(toProfileModelEntry);
    }
    const catalog = toRecord(toProfileCatalogRecord(readProfileModelsCatalog()).models);
    const stateMap = toRecord(toProfileStateRecord(readProfileModelState()).models);
    return Object.keys(catalog).map(function(modelId) {
      return {
        modelId,
        ...toRecord(catalog[modelId]),
        ...toRecord(stateMap[modelId])
      };
    });
  }
  function getProfileSelectedModel() {
    return getProfileModelEntries().find(function(entry) {
      return entry.selected === true;
    }) || null;
  }
  function getProfileJobs() {
    return collectProfileStageJobs(getProjectJobs());
  }
  function getProcessJobs() {
    return collectProcessStageJobs(getProjectJobs());
  }
  function getReportJobs() {
    return collectReportStageJobs(getProjectJobs());
  }
  function getProcessModules() {
    return toRecordList(getCurrentFeatureProcessRecord().modules);
  }
  function getProcessFindings() {
    return toRecordList(getCurrentFeatureProcessRecord().findings);
  }
  function getProcessArtifacts() {
    return toRecordList(getCurrentFeatureProcessRecord().artifacts);
  }
  function getReportSummaryCards() {
    return toRecordList(getCurrentFeatureReportRecord().summaryCards);
  }
  function getReportFindings() {
    return toRecordList(getCurrentFeatureReportRecord().findings);
  }
  function getReportExports() {
    return toRecordList(getCurrentFeatureReportRecord().exports);
  }
  function getCurrentFeatureTargetLabel() {
    if (isAudioAnalysisFeature()) {
      const audioState = toRecord(readAudioAnalysisSourceState());
      const targetSummary2 = toTargetSummaryRecord(getCurrentFeatureProcessRecord().targetSummary);
      return typeof audioState["targetLabel"] === "string" && audioState["targetLabel"] || typeof targetSummary2.label === "string" && targetSummary2.label || getCurrentSourceLabel();
    }
    if (isSubtitleAnalysisFeature()) {
      const targetSummary2 = toTargetSummaryRecord(getCurrentFeatureProcessRecord().targetSummary);
      const subtitleEntry = toSubtitleEntryRecord(readActiveSubtitleEntry());
      return typeof targetSummary2.label === "string" && targetSummary2.label || typeof subtitleEntry.fileName === "string" && subtitleEntry.fileName || typeof subtitleEntry.id === "string" && subtitleEntry.id || getCurrentSourceLabel();
    }
    const targetSummary = toTargetSummaryRecord(getCurrentFeatureProcessRecord().targetSummary);
    return typeof targetSummary.label === "string" && targetSummary.label || getFocusLabel();
  }
  function getCurrentFeatureArtifactCount() {
    if (isSubtitleAnalysisFeature() || !isAudioAnalysisFeature()) {
      return getProcessArtifacts().length;
    }
    return readAudioAnalysisOrderedResultEntries().reduce(function(sum, entry) {
      const artifacts = toAudioAnalysisResultEntry(entry).artifacts;
      return sum + (Array.isArray(artifacts) ? artifacts.length : 0);
    }, 0);
  }
  function getProfileTargetOutputOptions() {
    return readEditOutputs().map(toOutputRecord).filter(function(entry) {
      return typeof entry.path === "string" && entry.path.trim() !== "";
    });
  }
  return {
    getCompatibleProfileLaneIds,
    getCurrentFeatureArtifactCount,
    getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord,
    getCurrentFeatureTargetLabel,
    getCurrentProfileMode,
    getFocusLabel,
    getProcessArtifacts,
    getProcessFindings,
    getProcessJobs,
    getProcessModules,
    getProfileArtifacts,
    getProfileEstimate,
    getProfileJobs,
    getProfileLabel,
    getProfileLaneMap,
    getProfileModelEntries,
    getProfilePreflight,
    getProfilePresetOptions,
    getProfileReadiness,
    getProfileSelectedModel,
    getProfileSignals,
    getProfileTargetMode,
    getProfileTargetOutputOptions,
    getProfileTargetSummary,
    getRelevantJobs,
    getReportExports,
    getReportFindings,
    getReportJobs,
    getReportSummaryCards
  };
}
