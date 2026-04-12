type LaboratoryRecord = Record<string, unknown>;

type LaboratoryJobRecord = LaboratoryRecord & {
  projectId?: unknown;
  toolId?: unknown;
};

type LaboratoryProjectProfileRecord = LaboratoryRecord & {
  activePresetId?: unknown;
  artifacts?: unknown;
  estimate?: unknown;
  mode?: unknown;
  preflight?: unknown;
  readiness?: unknown;
  signals?: unknown;
};

type LaboratoryFeatureProcessRecord = LaboratoryRecord & {
  artifacts?: unknown;
  findings?: unknown;
  modules?: unknown;
  targetSummary?: unknown;
};

type LaboratoryFeatureReportRecord = LaboratoryRecord & {
  exports?: unknown;
  findings?: unknown;
  summaryCards?: unknown;
};

type LaboratoryProfileReadinessRecord = LaboratoryRecord & {
  models?: unknown;
  target?: unknown;
};

type LaboratoryTargetSummaryRecord = LaboratoryRecord & {
  label?: unknown;
  requestedMode?: unknown;
};

type LaboratoryProfilePresetOption = LaboratoryRecord & {
  id?: unknown;
  labelKey?: unknown;
};

type LaboratoryProfileLaneRecord = LaboratoryRecord & {
  mediaKinds?: unknown;
};

type LaboratoryProfileModelEntry = LaboratoryRecord & {
  selected?: unknown;
};

type LaboratoryProfileCatalogRecord = LaboratoryRecord & {
  models?: unknown;
};

type LaboratoryProfileStateRecord = LaboratoryRecord & {
  models?: unknown;
};

type LaboratoryProfilePresetsRecord = LaboratoryRecord & {
  lanes?: unknown;
  presets?: unknown;
};

type LaboratorySubtitleEntryRecord = LaboratoryRecord & {
  fileName?: unknown;
  id?: unknown;
};

type LaboratoryAudioAnalysisResultEntry = LaboratoryRecord & {
  artifacts?: unknown;
};

type LaboratoryOutputRecord = LaboratoryRecord & {
  path?: unknown;
};

type LaboratoryUiFeatureRuntimeDeps = {
  collectProcessStageJobs: (projectJobs: LaboratoryJobRecord[]) => unknown[];
  collectProfileStageJobs: (projectJobs: LaboratoryJobRecord[]) => unknown[];
  collectReportStageJobs: (projectJobs: LaboratoryJobRecord[]) => unknown[];
  getActiveFeatureId: () => string;
  getActiveProject: () => unknown;
  getActiveSubtitleEntry: () => unknown;
  getAudioAnalysisOrderedResultEntries: () => unknown[];
  getAudioAnalysisSourceState: () => unknown;
  getCurrentSourceKind: () => string;
  getCurrentSourceLabel: () => string;
  getEditOutputs: () => unknown[];
  getJobs: () => unknown[];
  getProfileModelsCatalog: () => unknown;
  getProfileModelState: () => unknown;
  getProfilePresets: () => unknown;
  getProjectProcess: () => unknown;
  getProjectProfile: () => unknown;
  getProjectReport: () => unknown;
  isAudioAnalysisFeature: () => boolean;
  isSubtitleAnalysisFeature: () => boolean;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryUiFeatureRuntime(deps: LaboratoryUiFeatureRuntimeDeps) {
  const {
    collectProcessStageJobs,
    collectProfileStageJobs,
    collectReportStageJobs,
    getActiveFeatureId,
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
    toRecord,
  } = deps;

  function toJobRecord(value: unknown): LaboratoryJobRecord {
    return toRecord(value);
  }

  function toProjectProfileRecord(value: unknown): LaboratoryProjectProfileRecord {
    return toRecord(value);
  }

  function toFeatureProcessRecord(value: unknown): LaboratoryFeatureProcessRecord {
    return toRecord(value);
  }

  function toFeatureReportRecord(value: unknown): LaboratoryFeatureReportRecord {
    return toRecord(value);
  }

  function toProfileReadinessRecord(value: unknown): LaboratoryProfileReadinessRecord {
    return toRecord(value);
  }

  function toTargetSummaryRecord(value: unknown): LaboratoryTargetSummaryRecord {
    return toRecord(value);
  }

  function toProfilePresetOption(value: unknown): LaboratoryProfilePresetOption {
    return toRecord(value);
  }

  function toProfileLaneRecord(value: unknown): LaboratoryProfileLaneRecord {
    return toRecord(value);
  }

  function toProfileModelEntry(value: unknown): LaboratoryProfileModelEntry {
    return toRecord(value);
  }

  function toProfileCatalogRecord(value: unknown): LaboratoryProfileCatalogRecord {
    return toRecord(value);
  }

  function toProfileStateRecord(value: unknown): LaboratoryProfileStateRecord {
    return toRecord(value);
  }

  function toProfilePresetsRecord(value: unknown): LaboratoryProfilePresetsRecord {
    return toRecord(value);
  }

  function toSubtitleEntryRecord(value: unknown): LaboratorySubtitleEntryRecord {
    return toRecord(value);
  }

  function toAudioAnalysisResultEntry(value: unknown): LaboratoryAudioAnalysisResultEntry {
    return toRecord(value);
  }

  function toOutputRecord(value: unknown): LaboratoryOutputRecord {
    return toRecord(value);
  }

  function toRecordList(value: unknown): LaboratoryRecord[] {
    return Array.isArray(value) ? value.map(toRecord) : [];
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  function getActiveProject() {
    return toRecord(readActiveProject());
  }

  function getActiveProjectId(): string | null {
    const project = getActiveProject();
    const projectId = project["id"];
    return typeof projectId === "string" && projectId.trim() !== "" ? projectId : null;
  }

  function getProjectJobs(): LaboratoryJobRecord[] {
    const projectId = getActiveProjectId();
    if (!projectId) {
      return [];
    }

    return readJobs()
      .map(toJobRecord)
      .filter(function (job) {
        return job.projectId === projectId;
      });
  }

  function getProjectProfileRecord(): LaboratoryProjectProfileRecord {
    return toProjectProfileRecord(readProjectProfile());
  }

  function getProfilePresetsRecord(): LaboratoryProfilePresetsRecord {
    return toProfilePresetsRecord(readProfilePresets());
  }

  function getRelevantJobs() {
    const projectId = getActiveProjectId();
    const toolJobs: LaboratoryJobRecord[] = [];
    const projectJobs: LaboratoryJobRecord[] = [];

    readJobs().forEach(function (job) {
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
      tools: toolJobs,
    };
  }

  function getCurrentFeatureProcessRecord(): LaboratoryFeatureProcessRecord {
    const records = toRecord(toRecord(readProjectProcess())["records"]);
    return toFeatureProcessRecord(records[getActiveFeatureId()]);
  }

  function getCurrentFeatureReportRecord(): LaboratoryFeatureReportRecord {
    const records = toRecord(toRecord(readProjectReport())["records"]);
    return toFeatureReportRecord(records[getActiveFeatureId()]);
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
    return Object.keys(laneMap).filter(function (laneId) {
      const mediaKinds = toStringArray(toProfileLaneRecord(laneMap[laneId]).mediaKinds);
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    });
  }

  function getProfilePresetOptions(): LaboratoryProfilePresetOption[] {
    const presetsByKind = toRecord(
      toRecord(getProfilePresetsRecord().presets)[getCurrentSourceKind()]
    );
    const mode = getCurrentProfileMode();
    const presetList = Array.isArray(presetsByKind[mode])
      ? presetsByKind[mode]
      : Array.isArray(presetsByKind["beginner"])
        ? presetsByKind["beginner"]
        : [];

    return presetList.map(toProfilePresetOption);
  }

  function getProfileLabel() {
    const activePresetId =
      typeof getProjectProfileRecord().activePresetId === "string"
        ? getProjectProfileRecord().activePresetId
        : null;
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

  function getProfileReadiness(): LaboratoryProfileReadinessRecord {
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

  function getProfileTargetSummary(): LaboratoryTargetSummaryRecord {
    return toTargetSummaryRecord(getProfileReadiness().target);
  }

  function getProfileTargetMode() {
    const target = getProfileTargetSummary();
    return target.requestedMode === "derived" ? "derived" : "source";
  }

  function getProfileModelEntries(): LaboratoryProfileModelEntry[] {
    const readinessModels = getProfileReadiness().models;
    if (Array.isArray(readinessModels)) {
      return readinessModels.map(toProfileModelEntry);
    }

    const catalog = toRecord(toProfileCatalogRecord(readProfileModelsCatalog()).models);
    const stateMap = toRecord(toProfileStateRecord(readProfileModelState()).models);

    return Object.keys(catalog).map(function (modelId) {
      return {
        modelId,
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
      const targetSummary = toTargetSummaryRecord(getCurrentFeatureProcessRecord().targetSummary);
      return (
        (typeof audioState["targetLabel"] === "string" && audioState["targetLabel"]) ||
        (typeof targetSummary.label === "string" && targetSummary.label) ||
        getCurrentSourceLabel()
      );
    }

    if (isSubtitleAnalysisFeature()) {
      const targetSummary = toTargetSummaryRecord(getCurrentFeatureProcessRecord().targetSummary);
      const subtitleEntry = toSubtitleEntryRecord(readActiveSubtitleEntry());
      return (
        (typeof targetSummary.label === "string" && targetSummary.label) ||
        (typeof subtitleEntry.fileName === "string" && subtitleEntry.fileName) ||
        (typeof subtitleEntry.id === "string" && subtitleEntry.id) ||
        getCurrentSourceLabel()
      );
    }

    const targetSummary = toTargetSummaryRecord(getCurrentFeatureProcessRecord().targetSummary);
    return (typeof targetSummary.label === "string" && targetSummary.label) || getFocusLabel();
  }

  function getCurrentFeatureArtifactCount() {
    if (isSubtitleAnalysisFeature() || !isAudioAnalysisFeature()) {
      return getProcessArtifacts().length;
    }

    return readAudioAnalysisOrderedResultEntries().reduce<number>(function (sum, entry) {
      const artifacts = toAudioAnalysisResultEntry(entry).artifacts;
      return sum + (Array.isArray(artifacts) ? artifacts.length : 0);
    }, 0);
  }

  function getProfileTargetOutputOptions() {
    return readEditOutputs()
      .map(toOutputRecord)
      .filter(function (entry) {
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
    getReportSummaryCards,
  };
}

export type LaboratoryUiFeatureRuntimeApi = ReturnType<typeof createLaboratoryUiFeatureRuntime>;
