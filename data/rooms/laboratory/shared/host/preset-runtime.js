export function createLaboratoryPresetRuntime(deps) {
  const { asNonEmptyString, clone, toRecord } = deps;

  function asNumber(value) {
    const nextValue = Number(value);
    return Number.isFinite(nextValue) ? nextValue : null;
  }

  function normalizeStringArray(value) {
    return Array.isArray(value)
      ? value
          .map(function (entry) {
            return asNonEmptyString(entry);
          })
          .filter(Boolean)
      : [];
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
      extractedAt: asNonEmptyString(source.extractedAt),
    };

    const hasValue = Object.keys(normalized).some(function (key) {
      return normalized[key] !== null;
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
      `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`,
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
      youtubeCustom: getPresetDefaultCustomValues(sourcePresets, defaultPreset),
    };
  }

  function getFocusRegionMap(editPresets) {
    return toRecord(toRecord(editPresets).focusRegions);
  }

  function getDefaultFocusRegionId(editPresets) {
    const focusRegions = getFocusRegionMap(editPresets);
    if (focusRegions["full-frame"]) {
      return "full-frame";
    }
    return Object.keys(focusRegions)[0] || "full-frame";
  }

  function getFocusRegionCrop(editPresets, regionId) {
    const focusRegions = getFocusRegionMap(editPresets);
    const region = toRecord(focusRegions[regionId]);
    const crop = toRecord(region.cropNormalized);
    return {
      x: Number.isFinite(Number(crop.x)) ? Number(crop.x) : 0,
      y: Number.isFinite(Number(crop.y)) ? Number(crop.y) : 0,
      width: Number.isFinite(Number(crop.width)) ? Number(crop.width) : 1,
      height: Number.isFinite(Number(crop.height)) ? Number(crop.height) : 1,
    };
  }

  function getResizePresetMap(editPresets) {
    return toRecord(toRecord(editPresets).resizePresets);
  }

  function getDefaultEditPresetId(editPresets, sourceKind) {
    const presetsByKind = toRecord(toRecord(editPresets).presets);
    const mode = asNonEmptyString(toRecord(editPresets).defaultMode) || "beginner";
    const presetList = Array.isArray(toRecord(presetsByKind[sourceKind])[mode])
      ? toRecord(presetsByKind[sourceKind])[mode]
      : [];
    const first = toRecord(presetList[0]);
    return asNonEmptyString(first.id);
  }

  function mergeObjects(baseValue, patchValue) {
    const baseRecord = toRecord(baseValue);
    const patchRecord = toRecord(patchValue);
    const nextValue = { ...baseRecord };

    Object.keys(patchRecord).forEach(function (key) {
      const patchEntry = patchRecord[key];
      if (patchEntry && typeof patchEntry === "object" && Array.isArray(patchEntry) === false) {
        nextValue[key] = mergeObjects(baseRecord[key], patchEntry);
        return;
      }
      nextValue[key] = patchEntry;
    });

    return nextValue;
  }

  function createDefaultEditState(editPresets, sourceKind) {
    const focusRegionId = getDefaultFocusRegionId(editPresets);
    const resizePresets = getResizePresetMap(editPresets);
    const analysisResize = resizePresets.analysis ? "analysis" : "keep";
    const defaultPresetId = getDefaultEditPresetId(editPresets, sourceKind);
    let editState = {
      mode: asNonEmptyString(toRecord(editPresets).defaultMode) || "beginner",
      dirty: false,
      activePresetId: defaultPresetId,
      activeOutputId: null,
      handoffMode: "source",
      lastError: null,
      lastActionAt: null,
      preview: {
        status: "idle",
        outputId: null,
        jobId: null,
        requestId: null,
        path: null,
        fileName: null,
        mimeType: null,
        metadata: null,
        artifacts: [],
        error: null,
        recipeSignature: null,
        updatedAt: null,
      },
      recipe: {
        common: {
          focusRegionId: focusRegionId,
          cropNormalized: getFocusRegionCrop(editPresets, focusRegionId),
          redactionBoxes: [],
          outputNameHint: "",
          notes: "",
        },
        video: {
          trimEnabled: false,
          trimStartSeconds: 0,
          trimEndSeconds: 0,
          resizePreset: analysisResize,
          customWidth: null,
          customHeight: null,
          fpsLimit: 24,
          includeAudio: true,
          blurFocusOutside: false,
          frameGrabCount: 0,
        },
        audio: {
          trimEnabled: false,
          trimStartSeconds: 0,
          trimEndSeconds: 0,
          silenceTrim: false,
          normalize: false,
          normalizeTargetDb: -16,
          mono: false,
          spectrogram: false,
          highpassHz: 0,
          lowpassHz: 0,
        },
        image: {
          rotateDegrees: 0,
          resizePreset: analysisResize,
          customWidth: null,
          customHeight: null,
          brightness: 0,
          contrast: 1,
          sharpen: 0,
          blurStrength: 0,
        },
      },
      outputs: [],
    };

    const presetId = asNonEmptyString(editState.activePresetId);
    if (presetId === null) {
      return editState;
    }

    const presetsByKind = toRecord(toRecord(editPresets).presets);
    const presetList = Array.isArray(toRecord(presetsByKind[sourceKind]).beginner)
      ? toRecord(presetsByKind[sourceKind]).beginner
      : [];
    const preset = presetList.find(function (entry) {
      return asNonEmptyString(toRecord(entry).id) === presetId;
    });
    const patch = toRecord(toRecord(preset).patch);
    if (Object.keys(patch).length === 0) {
      return editState;
    }

    editState = mergeObjects(editState, {
      recipe: patch,
    });

    const patchedFocusRegionId = asNonEmptyString(toRecord(toRecord(editState.recipe).common).focusRegionId);
    if (patchedFocusRegionId) {
      editState.recipe.common.cropNormalized = getFocusRegionCrop(editPresets, patchedFocusRegionId);
    }
    return editState;
  }

  function normalizeCropBox(value, fallback) {
    const source = toRecord(value);
    const nextFallback = toRecord(fallback);
    const x = Number.isFinite(Number(source.x)) ? Number(source.x) : Number(nextFallback.x || 0);
    const y = Number.isFinite(Number(source.y)) ? Number(source.y) : Number(nextFallback.y || 0);
    const width = Number.isFinite(Number(source.width))
      ? Number(source.width)
      : Number(nextFallback.width || 1);
    const height = Number.isFinite(Number(source.height))
      ? Number(source.height)
      : Number(nextFallback.height || 1);

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      width: Math.max(0.02, Math.min(1, width)),
      height: Math.max(0.02, Math.min(1, height)),
    };
  }

  function normalizeEditOutput(rawValue) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `edit-output-${Date.now()}`,
      kind: asNonEmptyString(source.kind) || "output",
      path: asNonEmptyString(source.path),
      fileName: asNonEmptyString(source.fileName),
      mimeType: asNonEmptyString(source.mimeType),
      createdAt: asNonEmptyString(source.createdAt) || new Date().toISOString(),
      recipeSignature: asNonEmptyString(source.recipeSignature),
      metadata: normalizeSourceMetadata(source.metadata),
      label: asNonEmptyString(source.label),
      jobId: asNonEmptyString(source.jobId),
      sourcePath: asNonEmptyString(source.sourcePath),
      artifacts: Array.isArray(source.artifacts)
        ? source.artifacts
            .map(function (entry) {
              const artifact = toRecord(entry);
              return {
                kind: asNonEmptyString(artifact.kind),
                path: asNonEmptyString(artifact.path),
                fileName: asNonEmptyString(artifact.fileName),
              };
            })
            .filter(function (entry) {
              return entry.path !== null;
            })
        : [],
    };
  }

  function normalizeEditState(rawValue, editPresets, sourceKind) {
    const defaults = createDefaultEditState(editPresets, sourceKind);
    const source = toRecord(rawValue);
    const recipe = toRecord(source.recipe);
    const common = toRecord(recipe.common);
    const defaultFocusRegionId = getDefaultFocusRegionId(editPresets);
    const focusRegionId = asNonEmptyString(common.focusRegionId) || defaultFocusRegionId;
    const defaultCrop = getFocusRegionCrop(editPresets, focusRegionId);
    const outputs = Array.isArray(source.outputs)
      ? source.outputs.map(normalizeEditOutput).filter(function (entry) {
          return asNonEmptyString(entry.path) !== null;
        })
      : [];

    return {
      mode:
        asNonEmptyString(source.mode) === "advanced"
          ? "advanced"
          : asNonEmptyString(source.mode) || defaults.mode,
      dirty: source.dirty === true,
      activePresetId: asNonEmptyString(source.activePresetId) || defaults.activePresetId,
      activeOutputId: asNonEmptyString(source.activeOutputId),
      handoffMode:
        asNonEmptyString(source.handoffMode) === "derived"
          ? "derived"
          : "source",
      lastError: asNonEmptyString(source.lastError),
      lastActionAt: asNonEmptyString(source.lastActionAt),
      preview: {
        status: asNonEmptyString(toRecord(source.preview).status) || "idle",
        outputId: asNonEmptyString(toRecord(source.preview).outputId),
        jobId: asNonEmptyString(toRecord(source.preview).jobId),
        requestId: asNonEmptyString(toRecord(source.preview).requestId),
        path: asNonEmptyString(toRecord(source.preview).path),
        fileName: asNonEmptyString(toRecord(source.preview).fileName),
        mimeType: asNonEmptyString(toRecord(source.preview).mimeType),
        metadata: normalizeSourceMetadata(toRecord(source.preview).metadata),
        artifacts: Array.isArray(toRecord(source.preview).artifacts)
          ? toRecord(source.preview).artifacts.map(toRecord)
          : [],
        error: asNonEmptyString(toRecord(source.preview).error),
        recipeSignature: asNonEmptyString(toRecord(source.preview).recipeSignature),
        updatedAt: asNonEmptyString(toRecord(source.preview).updatedAt),
      },
      recipe: {
        common: {
          focusRegionId: focusRegionId,
          cropNormalized: normalizeCropBox(common.cropNormalized, defaultCrop),
          redactionBoxes: Array.isArray(common.redactionBoxes) ? common.redactionBoxes.map(toRecord) : [],
          outputNameHint: asNonEmptyString(common.outputNameHint) || "",
          notes: asNonEmptyString(common.notes) || "",
        },
        video: {
          ...defaults.recipe.video,
          ...toRecord(recipe.video),
        },
        audio: {
          ...defaults.recipe.audio,
          ...toRecord(recipe.audio),
        },
        image: {
          ...defaults.recipe.image,
          ...toRecord(recipe.image),
        },
      },
      outputs: outputs,
    };
  }

  function getProfileLaneMap(profilePresets) {
    return toRecord(toRecord(profilePresets).lanes);
  }

  function getCompatibleProfileLaneIds(profilePresets, sourceKind) {
    return Object.keys(getProfileLaneMap(profilePresets)).filter(function (laneId) {
      const lane = toRecord(getProfileLaneMap(profilePresets)[laneId]);
      const mediaKinds = Array.isArray(lane.mediaKinds) ? lane.mediaKinds : [];
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    });
  }

  function getProfilePresetList(profilePresets, sourceKind, mode) {
    const presetsByKind = toRecord(toRecord(profilePresets).presets);
    const branch = toRecord(presetsByKind[sourceKind]);
    const selectedMode =
      asNonEmptyString(mode) || asNonEmptyString(toRecord(profilePresets).defaultMode) || "beginner";
    return Array.isArray(branch[selectedMode]) ? branch[selectedMode] : [];
  }

  function findProfilePreset(profilePresets, sourceKind, presetId) {
    const targetId = asNonEmptyString(presetId);
    if (targetId === null) {
      return null;
    }

    return (
      getProfilePresetList(profilePresets, sourceKind, "beginner").find(function (entry) {
        return asNonEmptyString(toRecord(entry).id) === targetId;
      }) || null
    );
  }

  function getDefaultProfilePresetId(profilePresets, sourceKind) {
    const preset = toRecord(getProfilePresetList(profilePresets, sourceKind, "beginner")[0]);
    return asNonEmptyString(preset.id);
  }

  function getDefaultProfileModelId(profileModels, sourceKind) {
    const modelMap = toRecord(toRecord(profileModels).models);
    const preferredId = asNonEmptyString(toRecord(profileModels).defaultModelId);
    const preferredModel = toRecord(modelMap[preferredId]);
    const preferredKinds = Array.isArray(preferredModel.mediaKinds) ? preferredModel.mediaKinds : [];

    if (preferredId && (preferredKinds.length === 0 || preferredKinds.includes(sourceKind))) {
      return preferredId;
    }

    return (
      Object.keys(modelMap).find(function (modelId) {
        const model = toRecord(modelMap[modelId]);
        const mediaKinds = Array.isArray(model.mediaKinds) ? model.mediaKinds : [];
        return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
      }) || null
    );
  }

  function createEmptyProfileReadiness() {
    return {
      stageReady: false,
      requiredTools: [],
      optionalTools: [],
      models: [],
      blockers: [],
      warnings: [],
    };
  }

  function createEmptyProfileEstimate() {
    return {
      runtimeSeconds: null,
      artifactCount: 0,
      sampleWindowSeconds: null,
    };
  }

  function createEmptyProfilePreflight() {
    return {
      status: "idle",
      jobId: null,
      requestId: null,
      ranAt: null,
      targetSummary: null,
      warnings: [],
      error: null,
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
    createEmptySourceDrafts,
    getFocusRegionMap,
    getDefaultFocusRegionId,
    getFocusRegionCrop,
    getResizePresetMap,
    getDefaultEditPresetId,
    mergeObjects,
    createDefaultEditState,
    normalizeCropBox,
    normalizeEditOutput,
    normalizeEditState,
    getProfileLaneMap,
    getCompatibleProfileLaneIds,
    getProfilePresetList,
    findProfilePreset,
    getDefaultProfilePresetId,
    getDefaultProfileModelId,
    createEmptyProfileReadiness,
    createEmptyProfileEstimate,
    createEmptyProfilePreflight,
  };
}
