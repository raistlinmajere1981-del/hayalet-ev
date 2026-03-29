export function createLaboratoryPresetSourceRuntime(deps) {
  const { asNonEmptyString, clone, toRecord } = deps;
  function asNumber(value) {
    const nextValue = Number(value);
    return Number.isFinite(nextValue) ? nextValue : null;
  }
  function normalizeStringArray(value) {
    return Array.isArray(value) ? value.map(function(entry) {
      return asNonEmptyString(entry);
    }).filter(function(entry) {
      return typeof entry === "string" && entry.length > 0;
    }) : [];
  }
  function normalizeSourceMetadata(rawValue) {
    const source = toRecord(rawValue);
    const normalized = {
      durationSeconds: asNumber(source.durationSeconds),
      width: asNumber(source.width),
      height: asNumber(source.height),
      codec: asNonEmptyString(source.codec),
      videoCodec: asNonEmptyString(source.videoCodec),
      audioCodec: asNonEmptyString(source.audioCodec),
      formatName: asNonEmptyString(source.formatName),
      bitRate: asNumber(source.bitRate),
      sizeBytes: asNumber(source.sizeBytes),
      streamCount: asNumber(source.streamCount),
      mimeType: asNonEmptyString(source.mimeType),
      extractedBy: asNonEmptyString(source.extractedBy),
      extractedAt: asNonEmptyString(source.extractedAt)
    };
    const hasValue = Object.values(normalized).some(function(value) {
      return value !== null;
    });
    return hasValue ? normalized : null;
  }
  function pad2(value) {
    return String(value).padStart(2, "0");
  }
  function buildProjectName(dateValue) {
    const date = new Date(dateValue);
    return `Lab Session ${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate()
    )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  function buildProjectSlug(dateValue) {
    const date = new Date(dateValue);
    return [
      "lab-session",
      `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`,
      `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
    ].join("-");
  }
  function getSourceConfig(sourcePresets, kind) {
    const presets = toRecord(sourcePresets);
    const sourceTypes = toRecord(presets.sourceTypes);
    return toRecord(sourceTypes[kind]);
  }
  function getDefaultSourceType(sourcePresets) {
    const presets = toRecord(sourcePresets);
    const sourceType = asNonEmptyString(presets.defaultSourceType);
    return sourceType || "video";
  }
  function getDefaultMode(sourcePresets, kind) {
    const config = getSourceConfig(sourcePresets, kind);
    return asNonEmptyString(config.defaultMode) || "local";
  }
  function getDefaultYoutubePreset(sourcePresets) {
    const presets = toRecord(sourcePresets);
    const youtubePresets = toRecord(presets.youtubePresets);
    return youtubePresets.medium ? "medium" : youtubePresets.custom ? "custom" : "low";
  }
  function getPresetDefaultCustomValues(sourcePresets, presetId) {
    const presets = toRecord(sourcePresets);
    const youtubePresets = toRecord(presets.youtubePresets);
    const preset = toRecord(youtubePresets[presetId]);
    return clone(toRecord(preset.defaultCustomValues));
  }
  function createEmptySourceDrafts(sourcePresets) {
    const defaultPreset = getDefaultYoutubePreset(sourcePresets);
    return {
      urlInput: "",
      youtubeUrl: "",
      fileNameHint: "",
      youtubePreset: defaultPreset,
      youtubeCustom: getPresetDefaultCustomValues(sourcePresets, defaultPreset)
    };
  }
  return {
    asNumber,
    normalizeStringArray,
    normalizeSourceMetadata,
    buildProjectName,
    buildProjectSlug,
    getSourceConfig,
    getDefaultSourceType,
    getDefaultMode,
    getDefaultYoutubePreset,
    getPresetDefaultCustomValues,
    createEmptySourceDrafts
  };
}
