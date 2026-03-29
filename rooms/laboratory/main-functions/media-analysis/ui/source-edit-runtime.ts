export function createMediaAnalysisSourceEditUiRuntime(deps) {
  const featureText = deps.featureText;
  const subtitleText = deps.subtitleText;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const toRecord = deps.toRecord;

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

  function getSourceConfig(kind) {
    const sourceTypes = toRecord(deps.getSourcePresets().sourceTypes);
    return toRecord(sourceTypes[kind]);
  }

  function getSourceModeOptions(kind) {
    const config = getSourceConfig(kind);
    return Array.isArray(config.modes) ? config.modes : [];
  }

  function getCurrentSourceKind() {
    const source = deps.getProjectSource();
    const kind = typeof source.kind === "string" ? source.kind : null;
    return deps.getAvailableSourceFormats().includes(kind) ? kind : deps.getDefaultSourceKind();
  }

  function getCurrentSourceMode() {
    const kind = getCurrentSourceKind();
    const source = deps.getProjectSource();
    const mode = typeof source.mode === "string" ? source.mode : null;
    const modes = getSourceModeOptions(kind);
    return modes.includes(mode) ? mode : modes[0] || "local";
  }

  function getCurrentSourceLabel() {
    if (deps.isSubtitleAnalysisFeature()) {
      const activeEntry = deps.getActiveSubtitleEntry();
      return activeEntry
        ? activeEntry.fileName || activeEntry.id || "Subtitle"
        : subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle");
    }
    return featureText(["source", "formats", getCurrentSourceKind(), "title"]);
  }

  function getCurrentEditMode() {
    const mode = deps.getCurrentEditDraft().mode;
    return mode === "advanced" ? "advanced" : "beginner";
  }

  function getCurrentEditRecipe() {
    return toRecord(deps.getCurrentEditDraft().recipe);
  }

  function getCurrentFocusRegionId() {
    const recipe = getCurrentEditRecipe();
    const common = toRecord(recipe.common);
    return (typeof common.focusRegionId === "string" && common.focusRegionId) || "full-frame";
  }

  function getCurrentFocusLabel() {
    const focusRegion = toRecord(toRecord(deps.getEditPresets().focusRegions)[getCurrentFocusRegionId()]);
    const labelKey = typeof focusRegion.labelKey === "string" ? focusRegion.labelKey : null;
    return labelKey ? textFromKey(labelKey) : "--";
  }

  function getCurrentResizeLabel() {
    const kind = getCurrentSourceKind();
    const recipe = getCurrentEditRecipe();
    const branch = toRecord(recipe[kind]);
    const presetId =
      typeof branch.resizePreset === "string" && branch.resizePreset.trim() !== ""
        ? branch.resizePreset
        : "keep";
    const preset = toRecord(toRecord(deps.getEditPresets().resizePresets)[presetId]);
    return preset.labelKey ? textFromKey(preset.labelKey) : presetId;
  }

  function formatEditWindowLabel() {
    const kind = getCurrentSourceKind();
    const recipe = getCurrentEditRecipe();
    const branch = toRecord(recipe[kind]);
    const previewUrl = deps.getProjectSource().previewUrl || null;
    const sourceMetadata = deps.getSourceMetadata();
    const previewMetrics = deps.state.ui.previewMetrics;
    const duration =
      typeof sourceMetadata.durationSeconds === "number" && sourceMetadata.durationSeconds > 0
        ? sourceMetadata.durationSeconds
        : previewMetrics.url === previewUrl
          ? previewMetrics.duration
          : null;

    if ((kind === "video" || kind === "audio") && branch.trimEnabled === true) {
      const endSeconds =
        typeof branch.trimEndSeconds === "number" && branch.trimEndSeconds > 0
          ? branch.trimEndSeconds
          : duration;
      return `${deps.formatDuration(branch.trimStartSeconds)} - ${deps.formatDuration(endSeconds)}`;
    }

    return text(["mediaAnalysis", "edit", "fullWindow"]);
  }

  function getCurrentEditPresetOptions() {
    const presetsByKind = toRecord(toRecord(deps.getEditPresets().presets)[getCurrentSourceKind()]);
    const presetList = presetsByKind[getCurrentEditMode()];
    return Array.isArray(presetList) ? presetList.map(toRecord) : [];
  }

  function getEffectiveMediaAsset() {
    if (deps.isSubtitleAnalysisFeature()) {
      const preview = deps.getSubtitleEditPreview();
      const activeEntry = deps.getActiveSubtitleEntry();
      const latestOutput = deps.getSubtitleOutputs()[0] || null;

      return {
        kind: latestOutput ? "derived" : "subtitle",
        label:
          (latestOutput && (latestOutput.label || latestOutput.fileName || latestOutput.id)) ||
          (activeEntry && (activeEntry.fileName || activeEntry.id)) ||
          subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle"),
        previewUrl: null,
        path:
          (latestOutput && (latestOutput.path || latestOutput.fileUrl)) ||
          (activeEntry && (activeEntry.path || activeEntry.fileUrl)) ||
          null,
        mimeType: activeEntry ? getSubtitleMimeType(activeEntry.fileName || "") : null,
        metadata: preview.summary || {},
        artifacts: [],
      };
    }

    const project = deps.getActiveProject();
    if (!project) {
      return {
        kind: "source",
        label: "--",
        previewUrl: null,
        path: null,
        mimeType: null,
        metadata: {},
      };
    }

    const source = deps.getProjectSource();
    const edit = deps.getProjectEdit();
    const preview = deps.getEditPreview();
    const activeOutput = deps.getActiveEditOutput();

    if (
      typeof edit.handoffMode === "string" &&
      edit.handoffMode === "derived" &&
      activeOutput &&
      typeof activeOutput.previewUrl === "string"
    ) {
      return {
        kind: "derived",
        label: activeOutput.label || text(["mediaAnalysis", "edit", "derivedOutput"]),
        previewUrl: activeOutput.previewUrl,
        path: activeOutput.path || null,
        mimeType: activeOutput.mimeType || null,
        metadata: toRecord(activeOutput.metadata),
        artifacts: Array.isArray(activeOutput.artifacts) ? activeOutput.artifacts.map(toRecord) : [],
      };
    }

    if (
      typeof preview.previewUrl === "string" &&
      preview.previewUrl.trim() !== "" &&
      (preview.status === "ready" || preview.status === "stale")
    ) {
      return {
        kind: "preview",
        label: text(["mediaAnalysis", "edit", "previewAsset"]),
        previewUrl: preview.previewUrl,
        path: preview.path || null,
        mimeType: preview.mimeType || null,
        metadata: toRecord(preview.metadata),
        artifacts: Array.isArray(preview.artifacts) ? preview.artifacts.map(toRecord) : [],
      };
    }

    return {
      kind: "source",
      label: text(["mediaAnalysis", "edit", "sourceAsset"]),
      previewUrl: source.previewUrl || null,
      path: source.storedPath || null,
      mimeType: source.mimeType || null,
      metadata: deps.getSourceMetadata(),
      artifacts: [],
    };
  }

  return {
    formatEditWindowLabel: formatEditWindowLabel,
    getCurrentEditMode: getCurrentEditMode,
    getCurrentEditPresetOptions: getCurrentEditPresetOptions,
    getCurrentEditRecipe: getCurrentEditRecipe,
    getCurrentFocusLabel: getCurrentFocusLabel,
    getCurrentFocusRegionId: getCurrentFocusRegionId,
    getCurrentResizeLabel: getCurrentResizeLabel,
    getCurrentSourceKind: getCurrentSourceKind,
    getCurrentSourceLabel: getCurrentSourceLabel,
    getCurrentSourceMode: getCurrentSourceMode,
    getEffectiveMediaAsset: getEffectiveMediaAsset,
    getSourceConfig: getSourceConfig,
    getSourceModeOptions: getSourceModeOptions,
  };
}
