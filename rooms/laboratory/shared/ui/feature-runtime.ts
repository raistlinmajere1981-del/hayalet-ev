export function createLaboratoryUiFeatureRuntime(deps) {
  const {
    getActiveProject,
    getActiveSubtitleEntry,
    getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisSourceState,
    getCurrentSourceLabel,
    getCurrentSourceKind,
    getEditOutputs,
    getJobs,
    getProfileModelsCatalog,
    getProfileModelState,
    getProfilePresets,
    getProjectProfile,
    getProjectProcess,
    getProjectReport,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    toRecord,
    textFromKey,
    collectProfileStageJobs,
    collectProcessStageJobs,
    collectReportStageJobs,
  } = deps;

  function getRelevantJobs() {
    const project = getActiveProject();
    const toolJobs = [];
    const projectJobs = [];

    getJobs().forEach(function (job) {
      const jobRecord = toRecord(job);
      if (project && jobRecord.projectId === project.id) {
        projectJobs.push(jobRecord);
        return;
      }
      if (typeof jobRecord.toolId === "string" && jobRecord.toolId.trim() !== "") {
        toolJobs.push(jobRecord);
      }
    });

    return {
      project: projectJobs,
      tools: toolJobs,
    };
  }

  function getCurrentFeatureProcessRecord() {
    return toRecord(getProjectProcess());
  }

  function getCurrentFeatureReportRecord() {
    return toRecord(getProjectReport());
  }

  function getCurrentProfileMode() {
    return getProjectProfile().mode === "advanced" ? "advanced" : "beginner";
  }

  function getProfileLaneMap() {
    return toRecord(getProfilePresets().lanes);
  }

  function getCompatibleProfileLaneIds() {
    const laneMap = getProfileLaneMap();
    const sourceKind = getCurrentSourceKind();
    return Object.keys(laneMap).filter(function (laneId) {
      const mediaKinds = Array.isArray(toRecord(laneMap[laneId]).mediaKinds)
        ? toRecord(laneMap[laneId]).mediaKinds
        : [];
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    });
  }

  function getProfilePresetOptions() {
    const presetsByKind = toRecord(toRecord(getProfilePresets().presets)[getCurrentSourceKind()]);
    const mode = getCurrentProfileMode();
    const presetList = Array.isArray(presetsByKind[mode])
      ? presetsByKind[mode]
      : Array.isArray(presetsByKind.beginner)
        ? presetsByKind.beginner
        : [];
    return presetList.map(toRecord);
  }

  function getProfileLabel() {
    const activePresetId =
      typeof getProjectProfile().activePresetId === "string" ? getProjectProfile().activePresetId : null;
    const preset =
      getProfilePresetOptions().find(function (entry) {
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
    return toRecord(getProjectProfile().readiness);
  }

  function getProfileEstimate() {
    return toRecord(getProjectProfile().estimate);
  }

  function getProfilePreflight() {
    return toRecord(getProjectProfile().preflight);
  }

  function getProfileSignals() {
    const signals = getProjectProfile().signals;
    return Array.isArray(signals) ? signals.map(toRecord) : [];
  }

  function getProfileArtifacts() {
    const artifacts = getProjectProfile().artifacts;
    return Array.isArray(artifacts) ? artifacts.map(toRecord) : [];
  }

  function getProfileTargetSummary() {
    return toRecord(getProfileReadiness().target);
  }

  function getProfileTargetMode() {
    const target = getProfileTargetSummary();
    return target.requestedMode === "derived" ? "derived" : "source";
  }

  function getProfileModelEntries() {
    const readinessModels = getProfileReadiness().models;
    if (Array.isArray(readinessModels)) {
      return readinessModels.map(toRecord);
    }
    const catalog = toRecord(getProfileModelsCatalog().models);
    const stateMap = toRecord(getProfileModelState().models);
    return Object.keys(catalog).map(function (modelId) {
      return {
        modelId: modelId,
        ...toRecord(catalog[modelId]),
        ...toRecord(stateMap[modelId]),
      };
    });
  }

  function getProfileSelectedModel() {
    return (
      getProfileModelEntries().find(function (entry) {
        return entry.selected === true;
      }) || null
    );
  }

  function getProfileJobs() {
    const project = getActiveProject();
    if (!project) {
      return [];
    }
    return collectProfileStageJobs(
      getJobs()
        .map(toRecord)
        .filter(function (job) {
          return job.projectId === project.id;
        })
    );
  }

  function getProcessJobs() {
    const project = getActiveProject();
    if (!project) {
      return [];
    }
    return collectProcessStageJobs(
      getJobs()
        .map(toRecord)
        .filter(function (job) {
          return job.projectId === project.id;
        })
    );
  }

  function getReportJobs() {
    const project = getActiveProject();
    if (!project) {
      return [];
    }
    return collectReportStageJobs(
      getJobs()
        .map(toRecord)
        .filter(function (job) {
          return job.projectId === project.id;
        })
    );
  }

  function getProcessModules() {
    const modules = getCurrentFeatureProcessRecord().modules;
    return Array.isArray(modules) ? modules.map(toRecord) : [];
  }

  function getProcessFindings() {
    const findings = getCurrentFeatureProcessRecord().findings;
    return Array.isArray(findings) ? findings.map(toRecord) : [];
  }

  function getProcessArtifacts() {
    const artifacts = getCurrentFeatureProcessRecord().artifacts;
    return Array.isArray(artifacts) ? artifacts.map(toRecord) : [];
  }

  function getReportSummaryCards() {
    const cards = getCurrentFeatureReportRecord().summaryCards;
    return Array.isArray(cards) ? cards.map(toRecord) : [];
  }

  function getReportFindings() {
    const findings = getCurrentFeatureReportRecord().findings;
    return Array.isArray(findings) ? findings.map(toRecord) : [];
  }

  function getReportExports() {
    const exportsList = getCurrentFeatureReportRecord().exports;
    return Array.isArray(exportsList) ? exportsList.map(toRecord) : [];
  }

  function getCurrentFeatureTargetLabel() {
    if (isAudioAnalysisFeature()) {
      const audioState = toRecord(getAudioAnalysisSourceState());
      const processRecord = getCurrentFeatureProcessRecord();
      const targetSummary = toRecord(processRecord.targetSummary);
      return (
        (typeof audioState.targetLabel === "string" && audioState.targetLabel) ||
        (typeof targetSummary.label === "string" && targetSummary.label) ||
        getCurrentSourceLabel()
      );
    }
    if (isSubtitleAnalysisFeature()) {
      const processRecord = getCurrentFeatureProcessRecord();
      const targetSummary = toRecord(processRecord.targetSummary);
      const subtitleEntry = getActiveSubtitleEntry();
      return (
        targetSummary.label ||
        (subtitleEntry && (subtitleEntry.fileName || subtitleEntry.id)) ||
        getCurrentSourceLabel()
      );
    }
    return toRecord(getCurrentFeatureProcessRecord().targetSummary).label || getFocusLabel();
  }

  function getCurrentFeatureArtifactCount() {
    if (isSubtitleAnalysisFeature()) {
      return getProcessArtifacts().length;
    }
    if (!isAudioAnalysisFeature()) {
      return getProcessArtifacts().length;
    }
    return getAudioAnalysisOrderedResultEntries().reduce(function (sum, entry) {
      return sum + (Array.isArray(entry.artifacts) ? entry.artifacts.length : 0);
    }, 0);
  }

  function getProfileTargetOutputOptions() {
    return getEditOutputs().filter(function (entry) {
      return typeof entry.path === "string" && entry.path.trim() !== "";
    });
  }

  return {
    getRelevantJobs: getRelevantJobs,
    getCurrentFeatureProcessRecord: getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord: getCurrentFeatureReportRecord,
    getCurrentProfileMode: getCurrentProfileMode,
    getProfileLaneMap: getProfileLaneMap,
    getCompatibleProfileLaneIds: getCompatibleProfileLaneIds,
    getProfilePresetOptions: getProfilePresetOptions,
    getProfileLabel: getProfileLabel,
    getFocusLabel: getFocusLabel,
    getProfileReadiness: getProfileReadiness,
    getProfileEstimate: getProfileEstimate,
    getProfilePreflight: getProfilePreflight,
    getProfileSignals: getProfileSignals,
    getProfileArtifacts: getProfileArtifacts,
    getProfileTargetSummary: getProfileTargetSummary,
    getProfileTargetMode: getProfileTargetMode,
    getProfileModelEntries: getProfileModelEntries,
    getProfileSelectedModel: getProfileSelectedModel,
    getProfileJobs: getProfileJobs,
    getProcessJobs: getProcessJobs,
    getReportJobs: getReportJobs,
    getProcessModules: getProcessModules,
    getProcessFindings: getProcessFindings,
    getProcessArtifacts: getProcessArtifacts,
    getReportSummaryCards: getReportSummaryCards,
    getReportFindings: getReportFindings,
    getReportExports: getReportExports,
    getCurrentFeatureTargetLabel: getCurrentFeatureTargetLabel,
    getCurrentFeatureArtifactCount: getCurrentFeatureArtifactCount,
    getProfileTargetOutputOptions: getProfileTargetOutputOptions,
  };
}
