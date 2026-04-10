export function createMediaAnalysisSourceEditUiRuntime(deps) {
  const {
    featureText,
    getActiveEditOutput,
    getActiveProject,
    getActiveSubtitleEntry,
    getAvailableSourceFormats,
    getCurrentEditDraft,
    getDefaultSourceKind,
    getEditPresets,
    getEditPreview,
    getProjectEdit,
    getProjectSource,
    getSourceMetadata,
    getSourcePresets,
    getSubtitleEditPreview,
    getSubtitleOutputs,
    isSubtitleAnalysisFeature,
    subtitleText,
    text,
    textFromKey,
    toRecord
  } = deps;
  function asRecord(value) {
    return toRecord(value);
  }
  function asNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return asNonEmptyString(entry);
    }).filter((entry) => entry !== null);
  }
  function toSourceConfigRecord(value) {
    return asRecord(value);
  }
  function toEditDraftRecord(value) {
    return asRecord(value);
  }
  function toEditRecipeRecord(value) {
    return asRecord(value);
  }
  function toFocusRegionRecord(value) {
    return asRecord(value);
  }
  function toResizePresetRecord(value) {
    return asRecord(value);
  }
  function toSubtitleEntryRecord(value) {
    return asRecord(value);
  }
  function toSubtitleOutputRecord(value) {
    return asRecord(value);
  }
  function toEditOutputRecord(value) {
    return asRecord(value);
  }
  function toEditPreviewRecord(value) {
    return asRecord(value);
  }
  function toArtifactRecord(value) {
    return asRecord(value);
  }
  function formatSecondsLabel(value) {
    if (value === null) {
      return "--";
    }
    const totalSeconds = Math.max(0, Math.round(value));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }
  function getSubtitleMimeType(fileName) {
    const normalized = typeof fileName === "string" ? fileName.toLowerCase() : "";
    if (normalized.endsWith(".vtt")) {
      return "text/vtt";
    }
    if (normalized.endsWith(".ass") || normalized.endsWith(".ssa")) {
      return "text/x-ass";
    }
    return "application/x-subrip";
  }
  function getNormalizedSourceKinds() {
    const availableKinds = toStringArray(getAvailableSourceFormats());
    return availableKinds.filter(function(entry) {
      return entry === "audio" || entry === "image" || entry === "video";
    });
  }
  function getSourceConfig(kind) {
    const sourceTypes = asRecord(getSourcePresets()["sourceTypes"]);
    return toSourceConfigRecord(sourceTypes[kind]);
  }
  function getSourceModeOptions(kind) {
    return toStringArray(getSourceConfig(kind).modes);
  }
  function getCurrentSourceKind() {
    const source = getProjectSource();
    const kind = asNonEmptyString(source["kind"]);
    const availableKinds = getNormalizedSourceKinds();
    if (kind === "audio" || kind === "image" || kind === "video") {
      return availableKinds.includes(kind) ? kind : getDefaultSourceKind();
    }
    return getDefaultSourceKind();
  }
  function getCurrentSourceMode() {
    const kind = getCurrentSourceKind();
    const source = getProjectSource();
    const mode = asNonEmptyString(source["mode"]);
    const modes = getSourceModeOptions(kind);
    return mode && modes.includes(mode) ? mode : modes[0] || "local";
  }
  function getCurrentSourceLabel() {
    if (isSubtitleAnalysisFeature()) {
      const activeEntry = toSubtitleEntryRecord(getActiveSubtitleEntry());
      return asNonEmptyString(activeEntry["fileName"]) || asNonEmptyString(activeEntry["id"]) || subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle");
    }
    return featureText(["source", "formats", getCurrentSourceKind(), "title"]);
  }
  function getCurrentEditMode() {
    return toEditDraftRecord(getCurrentEditDraft()).mode === "advanced" ? "advanced" : "beginner";
  }
  function getCurrentEditRecipe() {
    return toEditRecipeRecord(toEditDraftRecord(getCurrentEditDraft()).recipe);
  }
  function getCurrentFocusRegionId() {
    const recipe = getCurrentEditRecipe();
    const common = asRecord(recipe["common"]);
    return asNonEmptyString(common["focusRegionId"]) || "full-frame";
  }
  function getCurrentFocusLabel() {
    const focusRegions = asRecord(getEditPresets()["focusRegions"]);
    const focusRegion = toFocusRegionRecord(focusRegions[getCurrentFocusRegionId()]);
    const labelKey = asNonEmptyString(focusRegion.labelKey);
    return labelKey ? textFromKey(labelKey) : "--";
  }
  function getCurrentResizeLabel() {
    const kind = getCurrentSourceKind();
    const recipe = getCurrentEditRecipe();
    const branch = asRecord(recipe[kind]);
    const presetId = asNonEmptyString(branch["resizePreset"]) || "keep";
    const resizePresets = asRecord(getEditPresets()["resizePresets"]);
    const preset = toResizePresetRecord(resizePresets[presetId]);
    const labelKey = asNonEmptyString(preset.labelKey);
    return labelKey ? textFromKey(labelKey) : presetId;
  }
  function formatEditWindowLabel() {
    const kind = getCurrentSourceKind();
    const recipe = getCurrentEditRecipe();
    const branch = asRecord(recipe[kind]);
    const sourceMetadata = getSourceMetadata();
    const duration = asNumber(sourceMetadata["durationSeconds"]);
    const trimStartSeconds = asNumber(branch["trimStartSeconds"]) || 0;
    const trimEndSeconds = asNumber(branch["trimEndSeconds"]) || duration;
    if ((kind === "video" || kind === "audio") && branch["trimEnabled"] === true) {
      return `${formatSecondsLabel(trimStartSeconds)} - ${formatSecondsLabel(trimEndSeconds)}`;
    }
    return text(["mediaAnalysis", "edit", "fullWindow"]);
  }
  function getCurrentEditPresetOptions() {
    const presets = asRecord(getEditPresets()["presets"]);
    const presetsByKind = asRecord(presets[getCurrentSourceKind()]);
    const presetList = presetsByKind[getCurrentEditMode()];
    return Array.isArray(presetList) ? presetList.map(asRecord) : [];
  }
  function getEffectiveMediaAsset() {
    if (isSubtitleAnalysisFeature()) {
      const preview2 = toEditPreviewRecord(getSubtitleEditPreview());
      const activeEntry = toSubtitleEntryRecord(getActiveSubtitleEntry());
      const latestOutput = toSubtitleOutputRecord(getSubtitleOutputs()[0]);
      const latestOutputLabel = asNonEmptyString(latestOutput.label) || asNonEmptyString(latestOutput.fileName) || asNonEmptyString(latestOutput.id);
      const activeEntryLabel = asNonEmptyString(activeEntry.fileName) || asNonEmptyString(activeEntry.id);
      return {
        artifacts: [],
        kind: latestOutputLabel ? "derived" : "subtitle",
        label: latestOutputLabel || activeEntryLabel || subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle"),
        metadata: asRecord(preview2.summary),
        mimeType: activeEntryLabel ? getSubtitleMimeType(activeEntry.fileName) : null,
        path: asNonEmptyString(latestOutput.path) || asNonEmptyString(latestOutput.fileUrl) || asNonEmptyString(activeEntry.path) || asNonEmptyString(activeEntry.fileUrl),
        previewUrl: null
      };
    }
    const project = getActiveProject();
    if (!project) {
      return {
        artifacts: [],
        kind: "source",
        label: "--",
        metadata: {},
        mimeType: null,
        path: null,
        previewUrl: null
      };
    }
    const source = getProjectSource();
    const edit = asRecord(getProjectEdit());
    const preview = toEditPreviewRecord(getEditPreview());
    const activeOutput = toEditOutputRecord(getActiveEditOutput());
    if (asNonEmptyString(edit["handoffMode"]) === "derived" && asNonEmptyString(activeOutput.previewUrl) !== null) {
      return {
        artifacts: Array.isArray(activeOutput.artifacts) ? activeOutput.artifacts.map(toArtifactRecord) : [],
        kind: "derived",
        label: asNonEmptyString(activeOutput.label) || text(["mediaAnalysis", "edit", "derivedOutput"]),
        metadata: asRecord(activeOutput.metadata),
        mimeType: asNonEmptyString(activeOutput.mimeType),
        path: asNonEmptyString(activeOutput.path),
        previewUrl: asNonEmptyString(activeOutput.previewUrl)
      };
    }
    if (asNonEmptyString(preview.previewUrl) !== null && (asNonEmptyString(preview.status) === "ready" || asNonEmptyString(preview.status) === "stale")) {
      return {
        artifacts: Array.isArray(preview.artifacts) ? preview.artifacts.map(toArtifactRecord) : [],
        kind: "preview",
        label: text(["mediaAnalysis", "edit", "previewAsset"]),
        metadata: asRecord(preview.metadata),
        mimeType: asNonEmptyString(preview.mimeType),
        path: asNonEmptyString(preview.path),
        previewUrl: asNonEmptyString(preview.previewUrl)
      };
    }
    return {
      artifacts: [],
      kind: "source",
      label: text(["mediaAnalysis", "edit", "sourceAsset"]),
      metadata: getSourceMetadata(),
      mimeType: asNonEmptyString(source.mimeType),
      path: asNonEmptyString(source.storedPath),
      previewUrl: asNonEmptyString(source.previewUrl)
    };
  }
  return {
    formatEditWindowLabel,
    getCurrentEditMode,
    getCurrentEditPresetOptions,
    getCurrentEditRecipe,
    getCurrentFocusLabel,
    getCurrentFocusRegionId,
    getCurrentResizeLabel,
    getCurrentSourceKind,
    getCurrentSourceLabel,
    getCurrentSourceMode,
    getEffectiveMediaAsset,
    getSourceConfig,
    getSourceModeOptions
  };
}
