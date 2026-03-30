type LaboratoryRecord = Record<string, unknown>;

export type LaboratoryMediaAnalysisSourceKind = "audio" | "image" | "video";
export type LaboratoryMediaAnalysisEditMode = "advanced" | "beginner";

export type LaboratoryMediaAnalysisProjectSourceRecord = LaboratoryRecord & {
  drafts?: unknown;
  kind?: unknown;
  mimeType?: unknown;
  mode?: unknown;
  previewUrl?: unknown;
  routeLabel?: unknown;
  sourceUrl?: unknown;
  status?: unknown;
  storedFileName?: unknown;
  storedPath?: unknown;
};

export type LaboratoryMediaAnalysisEditDraftRecord = LaboratoryRecord & {
  activePresetId?: unknown;
  mode?: unknown;
  recipe?: unknown;
};

export type LaboratoryMediaAnalysisEditRecipeRecord = LaboratoryRecord & {
  audio?: unknown;
  common?: unknown;
  image?: unknown;
  video?: unknown;
};

export type LaboratoryMediaAnalysisEditPreviewRecord = LaboratoryRecord & {
  artifacts?: unknown;
  metadata?: unknown;
  mimeType?: unknown;
  path?: unknown;
  previewUrl?: unknown;
  status?: unknown;
  summary?: unknown;
};

export type LaboratoryMediaAnalysisAssetArtifactRecord = LaboratoryRecord & {
  kind?: unknown;
  previewUrl?: unknown;
};

type LaboratoryMediaAnalysisSourceConfigRecord = LaboratoryRecord & {
  modes?: unknown;
};

type LaboratoryMediaAnalysisFocusRegionRecord = LaboratoryRecord & {
  labelKey?: unknown;
};

type LaboratoryMediaAnalysisResizePresetRecord = LaboratoryRecord & {
  labelKey?: unknown;
};

type LaboratoryMediaAnalysisSubtitleEntryRecord = LaboratoryRecord & {
  fileName?: unknown;
  fileUrl?: unknown;
  id?: unknown;
  path?: unknown;
};

type LaboratoryMediaAnalysisSubtitleOutputRecord = LaboratoryRecord & {
  fileName?: unknown;
  fileUrl?: unknown;
  id?: unknown;
  label?: unknown;
  path?: unknown;
};

type LaboratoryMediaAnalysisEditOutputRecord = LaboratoryRecord & {
  artifacts?: unknown;
  fileName?: unknown;
  fileUrl?: unknown;
  id?: unknown;
  label?: unknown;
  metadata?: unknown;
  mimeType?: unknown;
  path?: unknown;
  previewUrl?: unknown;
};

export type LaboratoryMediaAnalysisAsset = {
  artifacts: LaboratoryMediaAnalysisAssetArtifactRecord[];
  kind: "derived" | "preview" | "source" | "subtitle";
  label: string;
  metadata: LaboratoryRecord;
  mimeType: string | null;
  path: string | null;
  previewUrl: string | null;
};

type MediaAnalysisSourceEditUiRuntimeDeps = {
  featureText: (path: string[]) => string;
  getActiveEditOutput: () => unknown | null;
  getActiveProject: () => LaboratoryRecord | null;
  getActiveSubtitleEntry: () => unknown | null;
  getAvailableSourceFormats: () => string[];
  getCurrentEditDraft: () => unknown;
  getDefaultSourceKind: () => LaboratoryMediaAnalysisSourceKind;
  getEditPresets: () => LaboratoryRecord;
  getEditPreview: () => unknown;
  getProjectEdit: () => LaboratoryRecord;
  getProjectSource: () => LaboratoryMediaAnalysisProjectSourceRecord;
  getSourceMetadata: () => LaboratoryRecord;
  getSourcePresets: () => LaboratoryRecord;
  getSubtitleEditPreview: () => unknown;
  getSubtitleOutputs: () => unknown[];
  isSubtitleAnalysisFeature: () => boolean;
  subtitleText: (path: string[], tr?: string, en?: string) => string;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createMediaAnalysisSourceEditUiRuntime(deps: MediaAnalysisSourceEditUiRuntimeDeps) {
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
    toRecord,
  } = deps;

  function asRecord(value: unknown): LaboratoryRecord {
    return toRecord(value);
  }

  function asNonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }

  function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return asNonEmptyString(entry);
      })
      .filter((entry): entry is string => entry !== null);
  }

  function toSourceConfigRecord(value: unknown): LaboratoryMediaAnalysisSourceConfigRecord {
    return asRecord(value);
  }

  function toEditDraftRecord(value: unknown): LaboratoryMediaAnalysisEditDraftRecord {
    return asRecord(value);
  }

  function toEditRecipeRecord(value: unknown): LaboratoryMediaAnalysisEditRecipeRecord {
    return asRecord(value);
  }

  function toFocusRegionRecord(value: unknown): LaboratoryMediaAnalysisFocusRegionRecord {
    return asRecord(value);
  }

  function toResizePresetRecord(value: unknown): LaboratoryMediaAnalysisResizePresetRecord {
    return asRecord(value);
  }

  function toSubtitleEntryRecord(value: unknown): LaboratoryMediaAnalysisSubtitleEntryRecord {
    return asRecord(value);
  }

  function toSubtitleOutputRecord(value: unknown): LaboratoryMediaAnalysisSubtitleOutputRecord {
    return asRecord(value);
  }

  function toEditOutputRecord(value: unknown): LaboratoryMediaAnalysisEditOutputRecord {
    return asRecord(value);
  }

  function toEditPreviewRecord(value: unknown): LaboratoryMediaAnalysisEditPreviewRecord {
    return asRecord(value);
  }

  function toArtifactRecord(value: unknown): LaboratoryMediaAnalysisAssetArtifactRecord {
    return asRecord(value);
  }

  function formatSecondsLabel(value: number | null) {
    if (value === null) {
      return "--";
    }
    const totalSeconds = Math.max(0, Math.round(value));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function getSubtitleMimeType(fileName: unknown) {
    const normalized = typeof fileName === "string" ? fileName.toLowerCase() : "";
    if (normalized.endsWith(".vtt")) {
      return "text/vtt";
    }
    if (normalized.endsWith(".ass") || normalized.endsWith(".ssa")) {
      return "text/x-ass";
    }
    return "application/x-subrip";
  }

  function getNormalizedSourceKinds(): LaboratoryMediaAnalysisSourceKind[] {
    const availableKinds = toStringArray(getAvailableSourceFormats());
    return availableKinds.filter(function (entry): entry is LaboratoryMediaAnalysisSourceKind {
      return entry === "audio" || entry === "image" || entry === "video";
    });
  }

  function getSourceConfig(kind: LaboratoryMediaAnalysisSourceKind) {
    const sourceTypes = asRecord(getSourcePresets()["sourceTypes"]);
    return toSourceConfigRecord(sourceTypes[kind]);
  }

  function getSourceModeOptions(kind: LaboratoryMediaAnalysisSourceKind) {
    return toStringArray(getSourceConfig(kind).modes);
  }

  function getCurrentSourceKind(): LaboratoryMediaAnalysisSourceKind {
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
      return (
        asNonEmptyString(activeEntry["fileName"]) ||
        asNonEmptyString(activeEntry["id"]) ||
        subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle")
      );
    }
    return featureText(["source", "formats", getCurrentSourceKind(), "title"]);
  }

  function getCurrentEditMode(): LaboratoryMediaAnalysisEditMode {
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

  function getEffectiveMediaAsset(): LaboratoryMediaAnalysisAsset {
    if (isSubtitleAnalysisFeature()) {
      const preview = toEditPreviewRecord(getSubtitleEditPreview());
      const activeEntry = toSubtitleEntryRecord(getActiveSubtitleEntry());
      const latestOutput = toSubtitleOutputRecord(getSubtitleOutputs()[0]);
      const latestOutputLabel =
        asNonEmptyString(latestOutput.label) ||
        asNonEmptyString(latestOutput.fileName) ||
        asNonEmptyString(latestOutput.id);
      const activeEntryLabel =
        asNonEmptyString(activeEntry.fileName) || asNonEmptyString(activeEntry.id);

      return {
        artifacts: [],
        kind: latestOutputLabel ? "derived" : "subtitle",
        label:
          latestOutputLabel ||
          activeEntryLabel ||
          subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle"),
        metadata: asRecord(preview.summary),
        mimeType: activeEntryLabel ? getSubtitleMimeType(activeEntry.fileName) : null,
        path:
          asNonEmptyString(latestOutput.path) ||
          asNonEmptyString(latestOutput.fileUrl) ||
          asNonEmptyString(activeEntry.path) ||
          asNonEmptyString(activeEntry.fileUrl),
        previewUrl: null,
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
        previewUrl: null,
      };
    }

    const source = getProjectSource();
    const edit = asRecord(getProjectEdit());
    const preview = toEditPreviewRecord(getEditPreview());
    const activeOutput = toEditOutputRecord(getActiveEditOutput());

    if (
      asNonEmptyString(edit["handoffMode"]) === "derived" &&
      asNonEmptyString(activeOutput.previewUrl) !== null
    ) {
      return {
        artifacts: Array.isArray(activeOutput.artifacts)
          ? activeOutput.artifacts.map(toArtifactRecord)
          : [],
        kind: "derived",
        label:
          asNonEmptyString(activeOutput.label) || text(["mediaAnalysis", "edit", "derivedOutput"]),
        metadata: asRecord(activeOutput.metadata),
        mimeType: asNonEmptyString(activeOutput.mimeType),
        path: asNonEmptyString(activeOutput.path),
        previewUrl: asNonEmptyString(activeOutput.previewUrl),
      };
    }

    if (
      asNonEmptyString(preview.previewUrl) !== null &&
      (asNonEmptyString(preview.status) === "ready" || asNonEmptyString(preview.status) === "stale")
    ) {
      return {
        artifacts: Array.isArray(preview.artifacts) ? preview.artifacts.map(toArtifactRecord) : [],
        kind: "preview",
        label: text(["mediaAnalysis", "edit", "previewAsset"]),
        metadata: asRecord(preview.metadata),
        mimeType: asNonEmptyString(preview.mimeType),
        path: asNonEmptyString(preview.path),
        previewUrl: asNonEmptyString(preview.previewUrl),
      };
    }

    return {
      artifacts: [],
      kind: "source",
      label: text(["mediaAnalysis", "edit", "sourceAsset"]),
      metadata: getSourceMetadata(),
      mimeType: asNonEmptyString(source.mimeType),
      path: asNonEmptyString(source.storedPath),
      previewUrl: asNonEmptyString(source.previewUrl),
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
    getSourceModeOptions,
  };
}
