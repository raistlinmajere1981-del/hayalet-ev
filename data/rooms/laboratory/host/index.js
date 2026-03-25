const ROOM_ID = "laboratory";
const SUBTITLE_FEATURE_ID = "subtitle-analysis";
const AUDIO_FEATURE_ID = "audio-analysis";
const FEATURE_ID = "media-analysis";
const FEATURE_IDS = [FEATURE_ID, AUDIO_FEATURE_ID, SUBTITLE_FEATURE_ID];
const MEDIA_STAGES = ["source", "edit", "profile", "process", "report"];
const AUDIO_ANALYSIS_SCHEMA_VERSION = 1;
const PROJECT_SCHEMA_VERSION = 1;
const FEATURE_NAMESPACES = {
  [FEATURE_ID]: "mediaAnalysis",
  [AUDIO_FEATURE_ID]: "audioAnalysis",
  [SUBTITLE_FEATURE_ID]: "subtitleAnalysis",
};

function toRecord(value) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function sanitizeContext(payload, api) {
  const source = toRecord(payload);
  const room = toRecord(source.room);
  const user = toRecord(source.user);
  const presentation = toRecord(source.presentation);
  const translations = toRecord(source.translations);
  const slots = toRecord(source.slots);
  const activeFeature = toRecord(source.activeFeature);

  return {
    room: {
      id: ROOM_ID,
      name:
        typeof room.name === "string" && room.name.trim() !== "" ? room.name.trim() : "Laboratory",
    },
    user: {
      nickname:
        typeof user.nickname === "string" && user.nickname.trim() !== ""
          ? user.nickname.trim()
          : "Operator",
    },
    presentation: {
      mode: presentation.mode === "scene-view" ? "scene-view" : "classic",
    },
    locale:
      typeof source.locale === "string" && source.locale.trim() !== ""
        ? normalizeLocale(source.locale)
        : normalizeLocale(api.getLocale()),
    translations,
    slots,
    roomId:
      typeof source.roomId === "string" && source.roomId.trim() !== ""
        ? source.roomId.trim()
        : ROOM_ID,
    featureId:
      (typeof activeFeature.id === "string" && activeFeature.id.trim() !== ""
        ? activeFeature.id.trim()
        : null) ||
      (typeof source.featureId === "string" && source.featureId.trim() !== ""
        ? source.featureId.trim()
        : null) ||
      (typeof source.feature === "string" && source.feature.trim() !== ""
        ? source.feature.trim()
        : null) ||
      FEATURE_ID,
  };
}

function loadContext(api) {
  return sanitizeContext(api.getState("context"), api);
}

function saveContext(api, payload) {
  const nextContext = sanitizeContext(payload, api);
  api.setState("context", nextContext);
  return nextContext;
}

function getFeatureIdFromContext(context) {
  const featureId = asNonEmptyString(toRecord(context).featureId);
  return featureId || FEATURE_ID;
}

function getElectronApi() {
  return typeof window !== "undefined" ? window.electronAPI || null : null;
}

function decodeBase64Text(base64Value) {
  if (typeof base64Value !== "string" || base64Value.trim() === "") {
    return null;
  }

  try {
    const binary = atob(base64Value);
    const bytes = Uint8Array.from(binary, function (char) {
      return char.charCodeAt(0);
    });
    return new TextDecoder("utf-8").decode(bytes);
  } catch (_error) {
    return null;
  }
}

function decodeBase64Bytes(base64Value) {
  if (typeof base64Value !== "string" || base64Value.trim() === "") {
    return null;
  }

  try {
    const binary = atob(base64Value);
    return Uint8Array.from(binary, function (char) {
      return char.charCodeAt(0);
    });
  } catch (_error) {
    return null;
  }
}

function toHexString(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(function (value) {
      return value.toString(16).padStart(2, "0");
    })
    .join("");
}

async function digestSha1(bytes) {
  if (!(bytes instanceof Uint8Array) || typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("SHA-1 digest is unavailable in the current room host.");
  }
  return toHexString(await crypto.subtle.digest("SHA-1", bytes));
}

async function readJsonFile(filePath) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.readFile !== "function") {
    return null;
  }

  const encoded = await electronApi.readFile(filePath);
  const raw = decodeBase64Text(encoded);
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

async function readTextFile(filePath) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.readFile !== "function") {
    return null;
  }

  const encoded = await electronApi.readFile(filePath);
  return decodeBase64Text(encoded);
}

async function readBinaryFileBytes(filePath) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.readFile !== "function") {
    return null;
  }

  const encoded = await electronApi.readFile(filePath);
  return decodeBase64Bytes(encoded);
}

async function writeJsonFile(filePath, value) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.fmWriteFileAtomic !== "function") {
    throw new Error("Electron API is unavailable.");
  }

  const result = await electronApi.fmWriteFileAtomic({
    path: filePath,
    data: JSON.stringify(value, null, 2),
  });

  if (!result || result.success !== true) {
    throw new Error((result && (result.message || result.error)) || "Write failed.");
  }
}

async function writeTextFile(filePath, value) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.fmWriteFileAtomic !== "function") {
    throw new Error("Electron API is unavailable.");
  }

  const result = await electronApi.fmWriteFileAtomic({
    path: filePath,
    data: typeof value === "string" ? value : String(value || ""),
  });

  if (!result || result.success !== true) {
    throw new Error((result && (result.message || result.error)) || "Write failed.");
  }
}

async function listDirectory(dirPath) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.readDirectoryFiles !== "function") {
    return [];
  }

  try {
    const result = await electronApi.readDirectoryFiles(dirPath);
    return Array.isArray(result) ? result : [];
  } catch (_error) {
    return [];
  }
}

async function callRoomTools(request) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.roomToolsCall !== "function") {
    throw new Error("Room tools bridge is unavailable.");
  }

  const result = await electronApi.roomToolsCall(request);
  if (!result || result.success !== true) {
    throw new Error((result && result.error) || "Room tools call failed.");
  }
  return result;
}

function isUnsupportedEnsureDirError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.indexOf("Unsupported room-tools operation: ensure-dir") !== -1;
}

async function ensureDirectoryMarker(dirPath) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.fmWriteFileAtomic !== "function") {
    throw new Error("Electron API is unavailable.");
  }

  const result = await electronApi.fmWriteFileAtomic({
    path: `${dirPath}/.keep`,
    data: "",
  });

  if (!result || result.success !== true) {
    throw new Error((result && (result.message || result.error)) || "Directory prepare failed.");
  }
}

async function ensureRuntimeDirectory(dirPath, requestId) {
  try {
    await callRoomTools({
      operation: "ensure-dir",
      roomId: ROOM_ID,
      requestId: requestId || null,
      targetPath: dirPath,
    });
    return;
  } catch (error) {
    if (isUnsupportedEnsureDirError(error) !== true) {
      throw error;
    }
  }

  await ensureDirectoryMarker(dirPath);
}

async function ensureProjectDirectories(runtime, project, requestId) {
  const dirPaths = [
    getProjectDir(runtime, project),
    getProjectSourceDir(runtime, project),
    getProjectSubtitleSourceDir(runtime, project),
    getProjectDerivedDir(runtime, project),
    getProjectEditDir(runtime, project),
    getProjectEditPreviewDir(runtime, project),
    getProjectEditOutputDir(runtime, project),
    getProjectSubtitleEditDir(runtime, project),
    getProjectSubtitleEditPreviewDir(runtime, project),
    getProjectSubtitleEditOutputDir(runtime, project),
    getProjectProfileDir(runtime, project),
    getProjectProfilePreflightDir(runtime, project),
    getProjectProcessDir(runtime, project),
    getProjectSubtitleProcessDir(runtime, project),
    getProjectReportDir(runtime, project),
  ];

  try {
    for (let index = 0; index < dirPaths.length; index += 1) {
      await callRoomTools({
        operation: "ensure-dir",
        roomId: ROOM_ID,
        requestId: requestId || null,
        targetPath: dirPaths[index],
      });
    }
    return;
  } catch (error) {
    if (isUnsupportedEnsureDirError(error) !== true) {
      throw error;
    }
  }

  await Promise.all([
    ensureDirectoryMarker(getProjectSubtitleSourceDir(runtime, project)),
    ensureDirectoryMarker(getProjectSourceDir(runtime, project)),
    ensureDirectoryMarker(getProjectDerivedDir(runtime, project)),
    ensureDirectoryMarker(getProjectEditPreviewDir(runtime, project)),
    ensureDirectoryMarker(getProjectEditOutputDir(runtime, project)),
    ensureDirectoryMarker(getProjectSubtitleEditPreviewDir(runtime, project)),
    ensureDirectoryMarker(getProjectSubtitleEditOutputDir(runtime, project)),
    ensureDirectoryMarker(getProjectProfilePreflightDir(runtime, project)),
    ensureDirectoryMarker(getProjectProcessDir(runtime, project)),
    ensureDirectoryMarker(getProjectSubtitleProcessDir(runtime, project)),
    ensureDirectoryMarker(getProjectReportDir(runtime, project)),
  ]);
}

async function cancelRoomTool(roomId, jobId, requestId) {
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.roomToolsCancel !== "function") {
    return;
  }
  await electronApi.roomToolsCancel({
    roomId: roomId,
    jobId: jobId,
    requestId: requestId || null,
  });
}

function createRuntimeState() {
  return {
    hydrated: false,
    hydrating: null,
    paths: null,
    packageToolsDir: null,
    toolchainManifest: null,
    sourcePresets: null,
    projectSchema: null,
    ytDlpForm: null,
    editPresets: null,
    editCapabilities: null,
    profilePresets: null,
    profileCapabilities: null,
    profileModels: null,
    subtitleSourcePresets: null,
    subtitleYoutubeForm: null,
    subtitleEditPresets: null,
    subtitleAnalysisCatalog: null,
    subtitleAnalysisCapabilities: null,
    subtitleAnalysisProviders: null,
    audioAnalysisCatalog: null,
    audioAnalysisCapabilities: null,
    audioAnalysisPresets: null,
    audioAnalysisProviders: null,
    projects: [],
    activeProjectId: null,
    toolState: createDefaultToolState([]),
    profileModelState: {
      schemaVersion: 1,
      updatedAt: null,
      models: {},
    },
    jobs: {},
    roomToolsSubscribed: false,
    roomToolsProgressHandler: null,
  };
}

function createDefaultToolState(toolIds) {
  const ids = Array.isArray(toolIds) ? toolIds : [];
  const tools = {};
  ids.forEach(function (toolId) {
    tools[toolId] = createDefaultToolEntry(toolId);
  });

  return {
    schemaVersion: 1,
    updatedAt: null,
    tools: tools,
  };
}

function createDefaultToolEntry(toolId) {
  return {
    toolId: toolId,
    installed: false,
    version: null,
    binaryPath: null,
    releaseTag: null,
    releaseName: null,
    installDir: null,
    companionPaths: {},
    latestVersion: null,
    latestReleaseTag: null,
    latestReleaseName: null,
    releaseUrl: null,
    updateAvailable: false,
    busy: false,
    lastCheckedAt: null,
    lastError: null,
  };
}

function getPreferredFeatureSourceKind(featureId, sourcePresets) {
  if (featureId === AUDIO_FEATURE_ID) {
    return Object.prototype.hasOwnProperty.call(toRecord(sourcePresets).sourceTypes, "audio")
      ? "audio"
      : getDefaultSourceType(sourcePresets);
  }
  return getDefaultSourceType(sourcePresets);
}

function createDefaultProfileModelEntry(modelId) {
  return {
    modelId: modelId,
    installed: false,
    fileName: null,
    path: null,
    sizeBytes: null,
    checksumSha1: null,
    checksumValid: false,
    expectedBytes: null,
    expectedSha1: null,
    busy: false,
    lastVerifiedAt: null,
    lastError: null,
  };
}

function getToolManifestMap(runtime) {
  return toRecord(toRecord(runtime.toolchainManifest).tools);
}

function getRuntimeToolIds(runtime) {
  return Object.keys(getToolManifestMap(runtime));
}

function getToolManifest(runtime, toolId) {
  return toRecord(getToolManifestMap(runtime)[toolId]);
}

function getStageSupport(toolManifest, stageId) {
  return asNonEmptyString(toRecord(toolManifest).stageSupport?.[stageId]) || "unsupported";
}

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
  const selectedMode = asNonEmptyString(mode) || asNonEmptyString(toRecord(profilePresets).defaultMode) || "beginner";
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

function createEmptyFeatureProcessRecord(featureId) {
  return {
    featureId: featureId,
    status: "idle",
    jobId: null,
    requestId: null,
    runId: null,
    startedAt: null,
    completedAt: null,
    percent: 0,
    targetSummary: null,
    modules: [],
    findings: [],
    artifacts: [],
    warnings: [],
    error: null,
  };
}

function createEmptyProcessState() {
  const records = {};
  FEATURE_IDS.forEach(function (featureId) {
    records[featureId] = createEmptyFeatureProcessRecord(featureId);
  });
  return {
    records: records,
    lastError: null,
    lastActionAt: null,
  };
}

function normalizeProcessArtifact(rawValue) {
  const artifact = normalizeProfileArtifact(rawValue);
  return {
    ...artifact,
    moduleId: asNonEmptyString(toRecord(rawValue).moduleId),
  };
}

function normalizeProcessFinding(rawValue) {
  const finding = normalizeProfileSignal(rawValue);
  return {
    ...finding,
    moduleId: asNonEmptyString(toRecord(rawValue).moduleId),
  };
}

function normalizeProcessModule(rawValue) {
  const source = toRecord(rawValue);
  return {
    id: asNonEmptyString(source.id) || `process-module-${Date.now()}`,
    labelKey: asNonEmptyString(source.labelKey),
    title: asNonEmptyString(source.title),
    status: asNonEmptyString(source.status) || "idle",
    percent: Math.max(0, Math.min(100, Math.round(asNumber(source.percent) || 0))),
    summary: asNonEmptyString(source.summary) || "",
    warnings: Array.isArray(source.warnings)
      ? source.warnings.map(function (entry) {
          return String(entry);
        })
      : [],
    artifactIds: Array.isArray(source.artifactIds)
      ? source.artifactIds.map(asNonEmptyString).filter(Boolean)
      : [],
    findingIds: Array.isArray(source.findingIds)
      ? source.findingIds.map(asNonEmptyString).filter(Boolean)
      : [],
    startedAt: asNonEmptyString(source.startedAt),
    completedAt: asNonEmptyString(source.completedAt),
  };
}

function normalizeFeatureProcessRecord(rawValue, featureId) {
  const source = toRecord(rawValue);
  return {
    ...createEmptyFeatureProcessRecord(featureId),
    ...source,
    featureId: featureId,
    status: asNonEmptyString(source.status) || "idle",
    jobId: asNonEmptyString(source.jobId),
    requestId: asNonEmptyString(source.requestId),
    runId: asNonEmptyString(source.runId),
    startedAt: asNonEmptyString(source.startedAt),
    completedAt: asNonEmptyString(source.completedAt),
    percent: Math.max(0, Math.min(100, Math.round(asNumber(source.percent) || 0))),
    targetSummary:
      Object.keys(toRecord(source.targetSummary)).length > 0 ? toRecord(source.targetSummary) : null,
    modules: Array.isArray(source.modules) ? source.modules.map(normalizeProcessModule) : [],
    findings: Array.isArray(source.findings) ? source.findings.map(normalizeProcessFinding) : [],
    artifacts: Array.isArray(source.artifacts)
      ? source.artifacts
          .map(normalizeProcessArtifact)
          .filter(function (entry) {
            return entry.path !== null;
          })
      : [],
    warnings: Array.isArray(source.warnings)
      ? source.warnings.map(function (entry) {
          return String(entry);
        })
      : [],
    error: asNonEmptyString(source.error),
  };
}

function normalizeProcessState(rawValue) {
  const source = toRecord(rawValue);
  const records = {};

  FEATURE_IDS.forEach(function (featureId) {
    records[featureId] = normalizeFeatureProcessRecord(toRecord(toRecord(source.records)[featureId]), featureId);
  });

  return {
    records: records,
    lastError: asNonEmptyString(source.lastError),
    lastActionAt: asNonEmptyString(source.lastActionAt),
  };
}

function createEmptyFeatureReportRecord(featureId) {
  return {
    featureId: featureId,
    status: "idle",
    sourceRunId: null,
    generatedAt: null,
    summaryCards: [],
    findings: [],
    caveats: [],
    warnings: [],
    exports: [],
    error: null,
  };
}

function createEmptyReportState() {
  const records = {};
  FEATURE_IDS.forEach(function (featureId) {
    records[featureId] = createEmptyFeatureReportRecord(featureId);
  });
  return {
    records: records,
    lastError: null,
    lastActionAt: null,
  };
}

function normalizeReportSummaryCard(rawValue) {
  const source = toRecord(rawValue);
  return {
    id: asNonEmptyString(source.id) || `report-card-${Date.now()}`,
    label: asNonEmptyString(source.label),
    labelKey: asNonEmptyString(source.labelKey),
    value: asNonEmptyString(source.value) || "--",
  };
}

function normalizeReportExport(rawValue) {
  const source = toRecord(rawValue);
  return {
    id: asNonEmptyString(source.id) || `report-export-${Date.now()}`,
    format: asNonEmptyString(source.format) || "md",
    path: asNonEmptyString(source.path),
    fileName: asNonEmptyString(source.fileName),
    createdAt: asNonEmptyString(source.createdAt) || new Date().toISOString(),
    status: asNonEmptyString(source.status) || "ready",
    error: asNonEmptyString(source.error),
  };
}

function normalizeFeatureReportRecord(rawValue, featureId) {
  const source = toRecord(rawValue);
  return {
    ...createEmptyFeatureReportRecord(featureId),
    ...source,
    featureId: featureId,
    status: asNonEmptyString(source.status) || "idle",
    sourceRunId: asNonEmptyString(source.sourceRunId),
    generatedAt: asNonEmptyString(source.generatedAt),
    summaryCards: Array.isArray(source.summaryCards)
      ? source.summaryCards.map(normalizeReportSummaryCard)
      : [],
    findings: Array.isArray(source.findings) ? source.findings.map(normalizeProcessFinding) : [],
    caveats: Array.isArray(source.caveats)
      ? source.caveats.map(function (entry) {
          return String(entry);
        })
      : [],
    warnings: Array.isArray(source.warnings)
      ? source.warnings.map(function (entry) {
          return String(entry);
        })
      : [],
    exports: Array.isArray(source.exports) ? source.exports.map(normalizeReportExport) : [],
    error: asNonEmptyString(source.error),
  };
}

function normalizeReportState(rawValue) {
  const source = toRecord(rawValue);
  const records = {};

  FEATURE_IDS.forEach(function (featureId) {
    records[featureId] = normalizeFeatureReportRecord(toRecord(toRecord(source.records)[featureId]), featureId);
  });

  return {
    records: records,
    lastError: asNonEmptyString(source.lastError),
    lastActionAt: asNonEmptyString(source.lastActionAt),
  };
}

function getFeatureProcessRecord(project, featureId) {
  return normalizeFeatureProcessRecord(
    toRecord(toRecord(toRecord(project).process).records)[featureId],
    featureId
  );
}

function setFeatureProcessRecord(project, featureId, record) {
  const nextProcess = normalizeProcessState(project.process);
  nextProcess.records[featureId] = normalizeFeatureProcessRecord(record, featureId);
  project.process = nextProcess;
  return project.process.records[featureId];
}

function getFeatureReportRecord(project, featureId) {
  return normalizeFeatureReportRecord(
    toRecord(toRecord(toRecord(project).report).records)[featureId],
    featureId
  );
}

function setFeatureReportRecord(project, featureId, record) {
  const nextReport = normalizeReportState(project.report);
  nextReport.records[featureId] = normalizeFeatureReportRecord(record, featureId);
  project.report = nextReport;
  return project.report.records[featureId];
}

function createEmptyAudioAnalysisSourceState() {
  return {
    preferredSourceKind: "audio",
    requestedMode: "source",
    mode: "source",
    outputId: null,
    targetSignature: null,
    targetPath: null,
    targetFileName: null,
    targetMimeType: null,
    targetLabel: null,
    extractedAudioPath: null,
    updatedAt: null,
  };
}

function createEmptyAudioAnalysisCatalogState() {
  return {
    orderedIds: [],
    implementedIds: [],
    gatedIds: [],
    plannedIds: [],
    visibleIds: [],
  };
}

function normalizeAudioAnalysisMetric(rawValue) {
  const source = toRecord(rawValue);
  return {
    id: asNonEmptyString(source.id) || `audio-analysis-metric-${Date.now()}`,
    label: asNonEmptyString(source.label),
    labelKey: asNonEmptyString(source.labelKey),
    value: asNonEmptyString(source.value) || "--",
  };
}

function normalizeAudioAnalysisCapabilityEntry(rawValue, moduleId, catalogEntry) {
  const source = toRecord(rawValue);
  const catalog = toRecord(catalogEntry);
  return {
    moduleId: moduleId,
    phase: asNonEmptyString(source.phase) || asNonEmptyString(catalog.phase) || "v1",
    status: asNonEmptyString(source.status) || asNonEmptyString(catalog.status) || "planned",
    titleKey: asNonEmptyString(source.titleKey) || asNonEmptyString(catalog.titleKey),
    summaryKey: asNonEmptyString(source.summaryKey) || asNonEmptyString(catalog.summaryKey),
    providerIds:
      normalizeStringArray(source.providerIds).length > 0
        ? normalizeStringArray(source.providerIds)
        : normalizeStringArray(catalog.providerIds),
    toolIds:
      normalizeStringArray(source.toolIds).length > 0
        ? normalizeStringArray(source.toolIds)
        : normalizeStringArray(catalog.toolIds),
    requiredToolIds:
      normalizeStringArray(source.requiredToolIds).length > 0
        ? normalizeStringArray(source.requiredToolIds)
        : getAudioAnalysisRequiredToolIds(catalog),
    blockers: normalizeStringArray(source.blockers),
    warnings: normalizeStringArray(source.warnings),
  };
}

function normalizeAudioAnalysisProviderStateEntry(rawValue, providerId, descriptor) {
  const source = toRecord(rawValue);
  const provider = toRecord(descriptor);
  return {
    providerId: providerId,
    status: asNonEmptyString(source.status) || asNonEmptyString(provider.status) || "planned",
    toolId: asNonEmptyString(source.toolId) || asNonEmptyString(provider.toolId),
    moduleIds:
      normalizeStringArray(source.moduleIds).length > 0
        ? normalizeStringArray(source.moduleIds)
        : normalizeStringArray(provider.moduleIds),
    titleKey: asNonEmptyString(source.titleKey) || asNonEmptyString(provider.titleKey),
    summaryKey: asNonEmptyString(source.summaryKey) || asNonEmptyString(provider.summaryKey),
    providerType: asNonEmptyString(source.providerType) || asNonEmptyString(provider.providerType),
    installStrategy: asNonEmptyString(source.installStrategy) || asNonEmptyString(provider.installStrategy),
    expectedArtifacts:
      normalizeStringArray(source.expectedArtifacts).length > 0
        ? normalizeStringArray(source.expectedArtifacts)
        : normalizeStringArray(provider.expectedArtifacts),
    fallbackProviderIds:
      normalizeStringArray(source.fallbackProviderIds).length > 0
        ? normalizeStringArray(source.fallbackProviderIds)
        : normalizeStringArray(provider.fallbackProviderIds),
    installed: source.installed === true,
    ready: source.ready === true,
    busy: source.busy === true,
    version: asNonEmptyString(source.version),
    modelId: asNonEmptyString(source.modelId),
    platformSupported: source.platformSupported !== false,
    blockers: normalizeStringArray(source.blockers),
    warnings: normalizeStringArray(source.warnings),
    lastError: asNonEmptyString(source.lastError),
  };
}

function createEmptyAudioAnalysisRunRecord(moduleId) {
  return {
    moduleId: moduleId,
    status: "idle",
    runId: null,
    jobId: null,
    requestId: null,
    startedAt: null,
    completedAt: null,
    warnings: [],
    error: null,
    artifactIds: [],
    findingIds: [],
  };
}

function normalizeAudioAnalysisRunRecord(rawValue, moduleId) {
  const source = toRecord(rawValue);
  return {
    ...createEmptyAudioAnalysisRunRecord(moduleId),
    ...source,
    moduleId: moduleId,
    status: asNonEmptyString(source.status) || "idle",
    runId: asNonEmptyString(source.runId),
    jobId: asNonEmptyString(source.jobId),
    requestId: asNonEmptyString(source.requestId),
    startedAt: asNonEmptyString(source.startedAt),
    completedAt: asNonEmptyString(source.completedAt),
    warnings: normalizeStringArray(source.warnings),
    error: asNonEmptyString(source.error),
    artifactIds: normalizeStringArray(source.artifactIds),
    findingIds: normalizeStringArray(source.findingIds),
  };
}

function createEmptyAudioAnalysisModuleResult(moduleId, catalogEntry) {
  const catalog = toRecord(catalogEntry);
  const status = asNonEmptyString(catalog.status) || "planned";
  return {
    moduleId: moduleId,
    phase: asNonEmptyString(catalog.phase) || "v1",
    status: status === "implemented" ? "idle" : status,
    titleKey: asNonEmptyString(catalog.titleKey),
    summaryKey: asNonEmptyString(catalog.summaryKey),
    providerIds: normalizeStringArray(catalog.providerIds),
    toolIds: normalizeStringArray(catalog.toolIds),
    requiredToolIds: getAudioAnalysisRequiredToolIds(catalog),
    summary: "",
    blockers: [],
    warnings: [],
    signals: [],
    artifacts: [],
    metrics: [],
    confidence: null,
    timing: {
      sampleWindowSeconds: null,
      startedAt: null,
      completedAt: null,
    },
    runMeta: {
      runId: null,
      jobId: null,
      requestId: null,
    },
    sourceSignature: null,
  };
}

function normalizeAudioAnalysisModuleResult(rawValue, moduleId, catalogEntry) {
  const source = toRecord(rawValue);
  const defaults = createEmptyAudioAnalysisModuleResult(moduleId, catalogEntry);
  const timing = toRecord(source.timing);
  const runMeta = toRecord(source.runMeta);

  return {
    ...defaults,
    ...source,
    moduleId: moduleId,
    phase: asNonEmptyString(source.phase) || defaults.phase,
    status: asNonEmptyString(source.status) || defaults.status,
    titleKey: asNonEmptyString(source.titleKey) || defaults.titleKey,
    summaryKey: asNonEmptyString(source.summaryKey) || defaults.summaryKey,
    providerIds:
      normalizeStringArray(source.providerIds).length > 0
        ? normalizeStringArray(source.providerIds)
        : defaults.providerIds,
    toolIds:
      normalizeStringArray(source.toolIds).length > 0
        ? normalizeStringArray(source.toolIds)
        : defaults.toolIds,
    requiredToolIds:
      normalizeStringArray(source.requiredToolIds).length > 0
        ? normalizeStringArray(source.requiredToolIds)
        : defaults.requiredToolIds,
    summary: asNonEmptyString(source.summary) || "",
    blockers: normalizeStringArray(source.blockers),
    warnings: normalizeStringArray(source.warnings),
    signals: Array.isArray(source.signals) ? source.signals.map(normalizeProcessFinding) : [],
    artifacts: Array.isArray(source.artifacts)
      ? source.artifacts
          .map(normalizeProcessArtifact)
          .filter(function (entry) {
            return entry.path !== null;
          })
      : [],
    metrics: Array.isArray(source.metrics) ? source.metrics.map(normalizeAudioAnalysisMetric) : [],
    confidence: asNonEmptyString(source.confidence),
    timing: {
      sampleWindowSeconds: asNumber(timing.sampleWindowSeconds),
      startedAt: asNonEmptyString(timing.startedAt),
      completedAt: asNonEmptyString(timing.completedAt),
    },
    runMeta: {
      runId: asNonEmptyString(runMeta.runId),
      jobId: asNonEmptyString(runMeta.jobId),
      requestId: asNonEmptyString(runMeta.requestId),
    },
    sourceSignature: asNonEmptyString(source.sourceSignature),
  };
}

function createEmptyAudioAnalysisState() {
  return {
    schemaVersion: AUDIO_ANALYSIS_SCHEMA_VERSION,
    source: createEmptyAudioAnalysisSourceState(),
    analysisCatalog: createEmptyAudioAnalysisCatalogState(),
    capabilityState: {},
    providerState: {},
    runs: {},
    results: {},
    export: {
      lastGeneratedAt: null,
      items: [],
    },
  };
}

function normalizeAudioAnalysisState(rawValue, runtime) {
  const source = toRecord(rawValue);
  const defaults = createEmptyAudioAnalysisState();
  const catalogEntries = getAudioAnalysisModulesForRuntime(runtime);
  const providerDescriptors = Array.isArray(toRecord(runtime.audioAnalysisProviders).providers)
    ? toRecord(runtime.audioAnalysisProviders).providers.map(toRecord)
    : [];
  const normalizedResults = {};
  const normalizedRuns = {};
  const normalizedCapabilities = {};
  const normalizedProviders = {};

  catalogEntries.forEach(function (entry) {
    const moduleId = asNonEmptyString(entry.id) || `audio-module-${Date.now()}`;
    normalizedResults[moduleId] = normalizeAudioAnalysisModuleResult(
      toRecord(toRecord(source.results)[moduleId]),
      moduleId,
      entry
    );
    normalizedRuns[moduleId] = normalizeAudioAnalysisRunRecord(
      toRecord(toRecord(source.runs)[moduleId]),
      moduleId
    );
    normalizedCapabilities[moduleId] = normalizeAudioAnalysisCapabilityEntry(
      toRecord(toRecord(source.capabilityState)[moduleId]),
      moduleId,
      entry
    );
  });

  providerDescriptors.forEach(function (entry) {
    const providerId = asNonEmptyString(entry.id) || `audio-provider-${Date.now()}`;
    normalizedProviders[providerId] = normalizeAudioAnalysisProviderStateEntry(
      toRecord(toRecord(source.providerState)[providerId]),
      providerId,
      entry
    );
  });

  return {
    ...defaults,
    ...source,
    schemaVersion:
      typeof source.schemaVersion === "number" ? source.schemaVersion : AUDIO_ANALYSIS_SCHEMA_VERSION,
    source: {
      ...createEmptyAudioAnalysisSourceState(),
      ...toRecord(source.source),
      preferredSourceKind:
        asNonEmptyString(toRecord(source.source).preferredSourceKind) ||
        defaults.source.preferredSourceKind,
      requestedMode: asNonEmptyString(toRecord(source.source).requestedMode) || defaults.source.requestedMode,
      mode: asNonEmptyString(toRecord(source.source).mode) || defaults.source.mode,
      outputId: asNonEmptyString(toRecord(source.source).outputId),
      targetSignature: asNonEmptyString(toRecord(source.source).targetSignature),
      targetPath: asNonEmptyString(toRecord(source.source).targetPath),
      targetFileName: asNonEmptyString(toRecord(source.source).targetFileName),
      targetMimeType: asNonEmptyString(toRecord(source.source).targetMimeType),
      targetLabel: asNonEmptyString(toRecord(source.source).targetLabel),
      extractedAudioPath: asNonEmptyString(toRecord(source.source).extractedAudioPath),
      updatedAt: asNonEmptyString(toRecord(source.source).updatedAt),
    },
    analysisCatalog: {
      ...createEmptyAudioAnalysisCatalogState(),
      ...toRecord(source.analysisCatalog),
      orderedIds: normalizeStringArray(toRecord(source.analysisCatalog).orderedIds),
      implementedIds: normalizeStringArray(toRecord(source.analysisCatalog).implementedIds),
      gatedIds: normalizeStringArray(toRecord(source.analysisCatalog).gatedIds),
      plannedIds: normalizeStringArray(toRecord(source.analysisCatalog).plannedIds),
      visibleIds: normalizeStringArray(toRecord(source.analysisCatalog).visibleIds),
    },
    capabilityState: normalizedCapabilities,
    providerState: normalizedProviders,
    runs: normalizedRuns,
    results: normalizedResults,
    export: {
      lastGeneratedAt: asNonEmptyString(toRecord(source.export).lastGeneratedAt),
      items: Array.isArray(toRecord(source.export).items)
        ? toRecord(source.export).items.map(normalizeReportExport)
        : [],
    },
  };
}

function getDefaultSubtitleEditPresetId(runtime) {
  return asNonEmptyString(toRecord(runtime.subtitleEditPresets).defaultPresetId) || "safe-cleanup";
}

function getDefaultSubtitleEditRecipe(runtime, presetId) {
  const presets = Array.isArray(toRecord(runtime.subtitleEditPresets).presets)
    ? toRecord(runtime.subtitleEditPresets).presets.map(toRecord)
    : [];
  const matchedPreset =
    presets.find(function (entry) {
      return asNonEmptyString(entry.id) === presetId;
    }) || {};

  return {
    trimWhitespace: true,
    collapseBlankLines: true,
    normalizeQuotes: false,
    stripHtml: false,
    removeMusicTags: false,
    mergeShortCues: false,
    splitLongLines: true,
    maxCharsPerLine: 42,
    outputFormat: "source",
    ...toRecord(matchedPreset.operations),
  };
}

function createEmptySubtitleDiscoveryState() {
  return {
    status: "idle",
    scope: "single",
    items: [],
    selectedCandidateIds: [],
    totalCandidateCount: 0,
    lastError: null,
    lastRunAt: null,
    lastDownloadAt: null,
  };
}

function createEmptySubtitleAnalysisState(runtime) {
  const defaultPresetId = getDefaultSubtitleEditPresetId(runtime || {});
  return {
    workspace: {
      mode: "local-file",
      drafts: {
        urlInput: "",
        youtubeUrl: "",
        subtitleMode: "manual",
        subtitlesLang: "all",
        publishedAfter: "",
        publishedBefore: "",
        weekdays: "",
        durationMinSeconds: null,
        durationMaxSeconds: null,
        shortsMode: "all",
        liveMode: "all",
        titleInclude: "",
        titleExclude: "",
        playlistItems: "",
        limitCount: null,
      },
      selection: {
        selectedEntryIds: [],
      },
      lastError: null,
      lastActionAt: null,
      lastImportAt: null,
    },
    discovery: createEmptySubtitleDiscoveryState(),
    entries: [],
    activeEntryId: null,
    edit: {
      presetId: defaultPresetId,
      recipe: getDefaultSubtitleEditRecipe(runtime || {}, defaultPresetId),
      preview: {
        status: "idle",
        entryId: null,
        outputText: "",
        warnings: [],
        summary: null,
      },
      outputs: [],
      lastError: null,
      lastActionAt: null,
    },
    analysis: {
      status: "idle",
      summaryCards: [],
      findings: [],
      warnings: [],
      moduleResults: {},
      lastRunAt: null,
      sourceSelection: "active-entry",
    },
    export: {
      lastGeneratedAt: null,
      items: [],
    },
  };
}

function normalizeSubtitleAnalysisState(rawValue, runtime) {
  const source = toRecord(rawValue);
  const defaults = createEmptySubtitleAnalysisState(runtime);
  const workspace = toRecord(source.workspace);
  const workspaceDrafts = toRecord(workspace.drafts);
  const selection = toRecord(workspace.selection);
  const discovery = toRecord(source.discovery);
  const edit = toRecord(source.edit);
  const editPreview = toRecord(edit.preview);
  const analysis = toRecord(source.analysis);
  const defaultPresetId = asNonEmptyString(edit.presetId) || defaults.edit.presetId;

  return {
    workspace: {
      mode: asNonEmptyString(workspace.mode) || defaults.workspace.mode,
      drafts: {
        ...defaults.workspace.drafts,
        ...workspaceDrafts,
        urlInput: asNonEmptyString(workspaceDrafts.urlInput) || "",
        youtubeUrl: asNonEmptyString(workspaceDrafts.youtubeUrl) || "",
        subtitleMode: asNonEmptyString(workspaceDrafts.subtitleMode) || defaults.workspace.drafts.subtitleMode,
        subtitlesLang: asNonEmptyString(workspaceDrafts.subtitlesLang) || defaults.workspace.drafts.subtitlesLang,
        publishedAfter: asNonEmptyString(workspaceDrafts.publishedAfter) || "",
        publishedBefore: asNonEmptyString(workspaceDrafts.publishedBefore) || "",
        weekdays: asNonEmptyString(workspaceDrafts.weekdays) || "",
        durationMinSeconds: asNumber(workspaceDrafts.durationMinSeconds),
        durationMaxSeconds: asNumber(workspaceDrafts.durationMaxSeconds),
        shortsMode: asNonEmptyString(workspaceDrafts.shortsMode) || defaults.workspace.drafts.shortsMode,
        liveMode: asNonEmptyString(workspaceDrafts.liveMode) || defaults.workspace.drafts.liveMode,
        titleInclude: asNonEmptyString(workspaceDrafts.titleInclude) || "",
        titleExclude: asNonEmptyString(workspaceDrafts.titleExclude) || "",
        playlistItems: asNonEmptyString(workspaceDrafts.playlistItems) || "",
        limitCount: asNumber(workspaceDrafts.limitCount),
      },
      selection: {
        selectedEntryIds: normalizeStringArray(selection.selectedEntryIds),
      },
      lastError: asNonEmptyString(workspace.lastError),
      lastActionAt: asNonEmptyString(workspace.lastActionAt),
      lastImportAt: asNonEmptyString(workspace.lastImportAt),
    },
    discovery: {
      status: asNonEmptyString(discovery.status) || defaults.discovery.status,
      scope: asNonEmptyString(discovery.scope) || defaults.discovery.scope,
      items: Array.isArray(discovery.items)
        ? discovery.items.map(function (entry, index) {
            return normalizeSubtitleDiscoveryItem(entry, index);
          })
        : [],
      selectedCandidateIds: normalizeStringArray(discovery.selectedCandidateIds),
      totalCandidateCount:
        typeof discovery.totalCandidateCount === "number"
          ? discovery.totalCandidateCount
          : defaults.discovery.totalCandidateCount,
      lastError: asNonEmptyString(discovery.lastError),
      lastRunAt: asNonEmptyString(discovery.lastRunAt),
      lastDownloadAt: asNonEmptyString(discovery.lastDownloadAt),
    },
    entries: Array.isArray(source.entries)
      ? source.entries.map(function (entry, index) {
          const record = toRecord(entry);
          return {
            id: asNonEmptyString(record.id) || `subtitle-entry-${Date.now()}-${index}`,
            sourceType: asNonEmptyString(record.sourceType) || "local-file",
            status: asNonEmptyString(record.status) || "ready",
            fileName: asNonEmptyString(record.fileName) || `subtitle-${index + 1}.srt`,
            path: asNonEmptyString(record.path),
            format: asNonEmptyString(record.format) || "srt",
            createdAt: asNonEmptyString(record.createdAt) || new Date().toISOString(),
            sourceUrl: asNonEmptyString(record.sourceUrl),
            language: asNonEmptyString(record.language),
            publishedAt: asNonEmptyString(record.publishedAt),
            durationSeconds: asNumber(record.durationSeconds),
            isShort: typeof record.isShort === "boolean" ? record.isShort : null,
            warnings: Array.isArray(record.warnings) ? record.warnings.map(String) : [],
            metadata: toRecord(record.metadata),
          };
        })
      : [],
    activeEntryId: asNonEmptyString(source.activeEntryId),
    edit: {
      presetId: defaultPresetId,
      recipe: {
        ...getDefaultSubtitleEditRecipe(runtime, defaultPresetId),
        ...toRecord(edit.recipe),
      },
      preview: {
        status: asNonEmptyString(editPreview.status) || defaults.edit.preview.status,
        entryId: asNonEmptyString(editPreview.entryId),
        outputText: asNonEmptyString(editPreview.outputText) || "",
        warnings: Array.isArray(editPreview.warnings) ? editPreview.warnings.map(String) : [],
        summary:
          toRecord(editPreview.summary) && Object.keys(toRecord(editPreview.summary)).length > 0
            ? toRecord(editPreview.summary)
            : null,
      },
      outputs: Array.isArray(edit.outputs)
        ? edit.outputs.map(function (entry, index) {
            const record = toRecord(entry);
            return {
              id: asNonEmptyString(record.id) || `subtitle-output-${Date.now()}-${index}`,
              entryId: asNonEmptyString(record.entryId),
              label: asNonEmptyString(record.label),
              format: asNonEmptyString(record.format) || "srt",
              path: asNonEmptyString(record.path),
              createdAt: asNonEmptyString(record.createdAt) || new Date().toISOString(),
              summary:
                toRecord(record.summary) && Object.keys(toRecord(record.summary)).length > 0
                  ? toRecord(record.summary)
                  : null,
            };
          })
        : [],
      lastError: asNonEmptyString(edit.lastError),
      lastActionAt: asNonEmptyString(edit.lastActionAt),
    },
    analysis: {
      status: asNonEmptyString(analysis.status) || defaults.analysis.status,
      summaryCards: Array.isArray(analysis.summaryCards)
        ? analysis.summaryCards.map(function (entry) {
            return toRecord(entry);
          })
        : [],
      findings: Array.isArray(analysis.findings)
        ? analysis.findings.map(function (entry) {
            return toRecord(entry);
          })
        : [],
      warnings: Array.isArray(analysis.warnings) ? analysis.warnings.map(String) : [],
      moduleResults: toRecord(analysis.moduleResults),
      lastRunAt: asNonEmptyString(analysis.lastRunAt),
      sourceSelection: asNonEmptyString(analysis.sourceSelection) || defaults.analysis.sourceSelection,
    },
    export: {
      lastGeneratedAt: asNonEmptyString(toRecord(source.export).lastGeneratedAt),
      items: Array.isArray(toRecord(source.export).items)
        ? toRecord(source.export).items.map(normalizeReportExport)
        : [],
    },
  };
}

function getSubtitleSupportedExtensions(runtime) {
  const configured = Array.isArray(toRecord(runtime.subtitleSourcePresets).supportedExtensions)
    ? toRecord(runtime.subtitleSourcePresets).supportedExtensions
        .map(function (entry) {
          return String(entry || "").toLowerCase().replace(/^\./, "");
        })
        .filter(Boolean)
    : [];
  return configured.length > 0 ? configured : ["srt", "vtt", "ass", "ssa"];
}

function getSubtitleFileExtension(fileName) {
  const normalized = asNonEmptyString(fileName);
  if (normalized === null || normalized.indexOf(".") === -1) {
    return null;
  }
  return normalized.split(".").pop().toLowerCase();
}

function getSubtitleMimeType(fileName) {
  const extension = getSubtitleFileExtension(fileName);
  if (extension === "vtt") {
    return "text/vtt";
  }
  if (extension === "ass" || extension === "ssa") {
    return "text/x-ass";
  }
  return "application/x-subrip";
}

function isSubtitleFileName(runtime, fileName) {
  const extension = getSubtitleFileExtension(fileName);
  return extension !== null && getSubtitleSupportedExtensions(runtime).includes(extension);
}

function inferSubtitleLanguageFromFileName(fileName) {
  const normalized = asNonEmptyString(fileName);
  if (normalized === null) {
    return null;
  }

  const match = normalized.match(/\.([a-z]{2,3}(?:-[a-z0-9]+)?)\.(srt|vtt|ass|ssa)$/i);
  return match ? String(match[1]).toLowerCase() : null;
}

function normalizeSubtitleEntryRecord(rawValue, index) {
  const record = toRecord(rawValue);
  return {
    id: asNonEmptyString(record.id) || `subtitle-entry-${Date.now()}-${index}`,
    sourceType: asNonEmptyString(record.sourceType) || "local-file",
    status: asNonEmptyString(record.status) || "ready",
    fileName: asNonEmptyString(record.fileName) || `subtitle-${index + 1}.srt`,
    path: asNonEmptyString(record.path),
    format: asNonEmptyString(record.format) || getSubtitleFileExtension(record.fileName) || "srt",
    createdAt: asNonEmptyString(record.createdAt) || new Date().toISOString(),
    sourceUrl: asNonEmptyString(record.sourceUrl),
    language: asNonEmptyString(record.language) || inferSubtitleLanguageFromFileName(record.fileName),
    publishedAt: asNonEmptyString(record.publishedAt),
    durationSeconds: asNumber(record.durationSeconds),
    isShort: typeof record.isShort === "boolean" ? record.isShort : null,
    warnings: Array.isArray(record.warnings) ? record.warnings.map(String) : [],
    metadata: toRecord(record.metadata),
  };
}

function normalizeSubtitleOutputRecord(rawValue, index) {
  const record = toRecord(rawValue);
  return {
    id: asNonEmptyString(record.id) || `subtitle-output-${Date.now()}-${index}`,
    entryId: asNonEmptyString(record.entryId),
    label: asNonEmptyString(record.label),
    format: asNonEmptyString(record.format) || getSubtitleFileExtension(record.path || record.fileName) || "srt",
    path: asNonEmptyString(record.path),
    createdAt: asNonEmptyString(record.createdAt) || new Date().toISOString(),
    summary:
      toRecord(record.summary) && Object.keys(toRecord(record.summary)).length > 0
        ? toRecord(record.summary)
        : null,
  };
}

function normalizeSubtitleDiscoveryItem(rawValue, index) {
  const record = toRecord(rawValue);
  return {
    id: asNonEmptyString(record.id) || `subtitle-discovery-${Date.now()}-${index}`,
    url: asNonEmptyString(record.url),
    videoId: asNonEmptyString(record.videoId),
    title: asNonEmptyString(record.title) || `Subtitle candidate ${index + 1}`,
    channelTitle: asNonEmptyString(record.channelTitle),
    publishedAt: asNonEmptyString(record.publishedAt),
    durationSeconds: asNumber(record.durationSeconds),
    isShort: typeof record.isShort === "boolean" ? record.isShort : null,
    liveStatus: asNonEmptyString(record.liveStatus),
    subtitleLanguages: Array.isArray(record.subtitleLanguages) ? record.subtitleLanguages.map(String) : [],
    warnings: Array.isArray(record.warnings) ? record.warnings.map(String) : [],
    metadata: toRecord(record.metadata),
  };
}

function getSubtitleEntries(project) {
  const entries = toRecord(toRecord(project).subtitleAnalysis).entries;
  return Array.isArray(entries) ? entries.map(function (entry, index) {
    return normalizeSubtitleEntryRecord(entry, index);
  }) : [];
}

function getSubtitleEntryById(project, entryId) {
  const requestedId = asNonEmptyString(entryId);
  return (
    getSubtitleEntries(project).find(function (entry) {
      return requestedId !== null && entry.id === requestedId;
    }) || null
  );
}

function getActiveSubtitleEntry(project) {
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, {});
  return (
    getSubtitleEntryById(project, subtitleState.activeEntryId) ||
    (getSubtitleEntries(project)[0] || null)
  );
}

function getSubtitleSelectedEntries(project) {
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, {});
  const selectedIds = normalizeStringArray(toRecord(toRecord(subtitleState.workspace).selection).selectedEntryIds);
  const entries = getSubtitleEntries(project);

  if (selectedIds.length > 0) {
    const selectedEntries = entries.filter(function (entry) {
      return selectedIds.includes(entry.id);
    });
    if (selectedEntries.length > 0) {
      return selectedEntries;
    }
  }

  const activeEntry = getActiveSubtitleEntry(project);
  return activeEntry ? [activeEntry] : [];
}

function createSubtitleEntryRecord(filePath, options) {
  const config = toRecord(options);
  const fileName =
    asNonEmptyString(config.fileName) ||
    (asNonEmptyString(filePath) ? String(filePath).split(/[\\/]/).pop() : null) ||
    `subtitle-${Date.now()}.srt`;

  return normalizeSubtitleEntryRecord(
    {
      id: `subtitle-entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceType: asNonEmptyString(config.sourceType) || "local-file",
      status: "ready",
      fileName: fileName,
      path: asNonEmptyString(filePath),
      format: asNonEmptyString(config.format) || getSubtitleFileExtension(fileName) || "srt",
      createdAt: new Date().toISOString(),
      sourceUrl: asNonEmptyString(config.sourceUrl),
      language: asNonEmptyString(config.language) || inferSubtitleLanguageFromFileName(fileName),
      publishedAt: asNonEmptyString(config.publishedAt),
      durationSeconds: asNumber(config.durationSeconds),
      isShort: typeof config.isShort === "boolean" ? config.isShort : null,
      warnings: Array.isArray(config.warnings) ? config.warnings.map(String) : [],
      metadata: {
        ...toRecord(config.metadata),
        mimeType: asNonEmptyString(toRecord(config.metadata).mimeType) || getSubtitleMimeType(fileName),
      },
    },
    0
  );
}

function resetSubtitleFeatureState(runtime, project, reason) {
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, runtime);
  const nextPresetId = asNonEmptyString(toRecord(subtitleState.edit).presetId) || getDefaultSubtitleEditPresetId(runtime);

  subtitleState.edit = {
    presetId: nextPresetId,
    recipe: getDefaultSubtitleEditRecipe(runtime, nextPresetId),
    preview: {
      status: "idle",
      entryId: null,
      outputText: "",
      warnings: [],
      summary: null,
    },
    outputs: [],
    lastError: null,
    lastActionAt: new Date().toISOString(),
  };
  subtitleState.analysis = {
    ...subtitleState.analysis,
    status: "idle",
    summaryCards: [],
    findings: [],
    warnings: [],
    moduleResults: {},
    lastRunAt: null,
  };
  subtitleState.export = {
    lastGeneratedAt: null,
    items: [],
  };
  project.subtitleAnalysis = subtitleState;
  markFeatureProcessStale(project, SUBTITLE_FEATURE_ID, reason);
  markFeatureReportStale(project, SUBTITLE_FEATURE_ID, reason);
  return project.subtitleAnalysis;
}

function resetSubtitleDiscovery(runtime, project) {
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, runtime);
  subtitleState.discovery = createEmptySubtitleDiscoveryState();
  project.subtitleAnalysis = subtitleState;
  return project.subtitleAnalysis;
}

function upsertSubtitleEntries(runtime, project, incomingEntries, options) {
  const config = toRecord(options);
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, runtime);
  const existingEntries = Array.isArray(subtitleState.entries) ? subtitleState.entries.map(function (entry, index) {
    return normalizeSubtitleEntryRecord(entry, index);
  }) : [];
  const existingByPath = existingEntries.reduce(function (accumulator, entry) {
    if (entry.path !== null) {
      accumulator[entry.path] = entry;
    }
    return accumulator;
  }, {});
  const normalizedIncoming = Array.isArray(incomingEntries)
    ? incomingEntries
        .map(function (entry, index) {
          return normalizeSubtitleEntryRecord(entry, index);
        })
        .filter(function (entry) {
          return entry.path !== null;
        })
    : [];
  const mergedEntries =
    config.replaceExisting === true
      ? []
      : existingEntries.filter(function (entry) {
          return normalizedIncoming.some(function (incomingEntry) {
            return incomingEntry.path === entry.path;
          }) === false;
        });

  normalizedIncoming.forEach(function (entry) {
    const existingEntry = entry.path !== null ? existingByPath[entry.path] : null;
    mergedEntries.push(
      normalizeSubtitleEntryRecord(
        {
          ...toRecord(existingEntry),
          ...entry,
          id: existingEntry && existingEntry.id ? existingEntry.id : entry.id,
        },
        mergedEntries.length
      )
    );
  });

  subtitleState.entries = mergedEntries;
  subtitleState.activeEntryId =
    asNonEmptyString(config.activeEntryId) ||
    (normalizedIncoming[0] ? normalizedIncoming[0].id : subtitleState.activeEntryId) ||
    (mergedEntries[0] ? mergedEntries[0].id : null);
  subtitleState.workspace.mode =
    asNonEmptyString(config.mode) || subtitleState.workspace.mode;
  subtitleState.workspace.selection = {
    selectedEntryIds:
      Array.isArray(config.selectedEntryIds) && config.selectedEntryIds.length > 0
        ? normalizeStringArray(config.selectedEntryIds)
        : normalizedIncoming.map(function (entry) {
            return entry.id;
          }),
  };
  subtitleState.workspace.lastError = null;
  subtitleState.workspace.lastActionAt = new Date().toISOString();
  subtitleState.workspace.lastImportAt = new Date().toISOString();
  project.subtitleAnalysis = subtitleState;
  resetSubtitleFeatureState(runtime, project, "Subtitle sources changed; rerun the subtitle analysis.");
  return project.subtitleAnalysis;
}

function normalizeSubtitleText(rawText) {
  return String(rawText || "").replace(/\r\n/g, "\n");
}

function applySubtitleTextCleanup(textValue, recipe) {
  let nextValue = String(textValue || "");
  const config = toRecord(recipe);

  if (config.stripHtml === true) {
    nextValue = nextValue.replace(/<[^>]+>/g, "");
  }
  if (config.removeMusicTags === true) {
    nextValue = nextValue
      .replace(/\[[^\]]*music[^\]]*\]/gi, "")
      .replace(/\([^\)]*music[^\)]*\)/gi, "")
      .replace(/[♪♫]+/g, "");
  }
  if (config.normalizeQuotes === true) {
    nextValue = nextValue
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
  }
  if (config.trimWhitespace === true) {
    nextValue = nextValue
      .split("\n")
      .map(function (line) {
        return line.trim().replace(/[ \t]{2,}/g, " ");
      })
      .join("\n");
  }
  return nextValue;
}

function wrapSubtitleLines(lines, maxCharsPerLine) {
  const limit = Math.max(10, Math.round(asNumber(maxCharsPerLine) || 42));
  return (Array.isArray(lines) ? lines : [String(lines || "")]).reduce(function (accumulator, lineValue) {
    const line = String(lineValue || "").trim();
    if (line === "") {
      return accumulator;
    }
    if (line.length <= limit) {
      accumulator.push(line);
      return accumulator;
    }

    let currentLine = "";
    line.split(/\s+/).forEach(function (word) {
      if (currentLine === "") {
        currentLine = word;
        return;
      }
      if (`${currentLine} ${word}`.length <= limit) {
        currentLine = `${currentLine} ${word}`;
        return;
      }
      accumulator.push(currentLine);
      currentLine = word;
    });
    if (currentLine !== "") {
      accumulator.push(currentLine);
    }
    return accumulator;
  }, []);
}

function transformSubtitleCueLines(lines, recipe) {
  const config = toRecord(recipe);
  let nextLines = (Array.isArray(lines) ? lines : []).map(function (line) {
    return applySubtitleTextCleanup(line, config);
  });

  if (config.mergeShortCues === true) {
    nextLines = [nextLines.join(" ").replace(/[ \t]{2,}/g, " ").trim()];
  }
  if (config.splitLongLines === true) {
    nextLines = wrapSubtitleLines(nextLines, config.maxCharsPerLine);
  }

  return nextLines.filter(function (line) {
    return String(line || "").trim() !== "";
  });
}

function parseSubtitleTimestamp(rawValue) {
  const normalized = asNonEmptyString(rawValue);
  if (normalized === null) {
    return null;
  }

  const cleaned = normalized.replace(",", ".").trim();
  const parts = cleaned.split(":").map(function (entry) {
    return entry.trim();
  });
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const secondsToken = parts.pop();
  const minutesToken = parts.pop();
  const hoursToken = parts.pop() || "0";
  const seconds = Number(secondsToken);
  const minutes = Number(minutesToken);
  const hours = Number(hoursToken);
  if ([hours, minutes, seconds].some(function (entry) { return Number.isFinite(entry) !== true; })) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function parseSubtitleCues(rawText, format) {
  const normalized = normalizeSubtitleText(rawText);
  const nextFormat = asNonEmptyString(format) || "srt";

  if (nextFormat === "ass" || nextFormat === "ssa") {
    return normalized
      .split("\n")
      .map(function (line) {
        return line.trim();
      })
      .filter(function (line) {
        return /^Dialogue:/i.test(line);
      })
      .map(function (line, index) {
        const payload = line.replace(/^Dialogue:\s*/i, "");
        const fields = [];
        let buffer = "";
        let commaCount = 0;

        for (let cursor = 0; cursor < payload.length; cursor += 1) {
          const char = payload[cursor];
          if (char === "," && commaCount < 9) {
            fields.push(buffer);
            buffer = "";
            commaCount += 1;
          } else {
            buffer += char;
          }
        }
        fields.push(buffer);

        const cueText = String(fields[9] || "").replace(/\\N/g, "\n").replace(/\{[^}]+\}/g, "");
        const textLines = cueText.split("\n").map(function (entry) {
          return entry.trim();
        }).filter(Boolean);
        return {
          id: `ass-cue-${index}`,
          startSeconds: parseSubtitleTimestamp(fields[1]),
          endSeconds: parseSubtitleTimestamp(fields[2]),
          textLines: textLines,
          text: textLines.join(" "),
        };
      });
  }

  return normalized
    .split(/\n{2,}/)
    .map(function (block) {
      return block.trim();
    })
    .filter(Boolean)
    .map(function (block, index) {
      const lines = block.split("\n");
      const timingIndex = lines.findIndex(function (line) {
        return line.indexOf("-->") >= 0;
      });
      if (timingIndex === -1) {
        return null;
      }
      const timingLine = lines[timingIndex];
      const match = timingLine.match(/(.+?)\s*-->\s*(.+?)(?:\s+.+)?$/);
      const textLines = lines.slice(timingIndex + 1).map(function (line) {
        return line.trim();
      }).filter(Boolean);
      return {
        id: `subtitle-cue-${index}`,
        startSeconds: parseSubtitleTimestamp(match ? match[1] : null),
        endSeconds: parseSubtitleTimestamp(match ? match[2] : null),
        textLines: textLines,
        text: textLines.join(" "),
      };
    })
    .filter(Boolean);
}

function formatSubtitleRenderTimestamp(secondsValue, format) {
  const totalMs = Math.max(0, Math.round((Number(secondsValue) || 0) * 1000));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  const separator = format === "srt" ? "," : ".";
  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":") + `${separator}${String(milliseconds).padStart(3, "0")}`;
}

function buildNormalizedSubtitleCueModel(rawText, format, recipe) {
  return parseSubtitleCues(rawText, format)
    .map(function (cue, index) {
      const nextLines = transformSubtitleCueLines(cue.textLines, recipe);
      return {
        id: cue.id || `subtitle-cue-${index}`,
        startSeconds: cue.startSeconds,
        endSeconds: cue.endSeconds,
        textLines: nextLines,
        text: nextLines.join(" "),
      };
    })
    .filter(function (cue) {
      return cue.textLines.length > 0;
    });
}

function serializeSubtitleCueModel(cues, format) {
  const nextFormat = asNonEmptyString(format) || "srt";
  if (nextFormat === "json") {
    return JSON.stringify(Array.isArray(cues) ? cues : [], null, 2);
  }

  const blocks = (Array.isArray(cues) ? cues : []).map(function (cue, index) {
    const startToken = formatSubtitleRenderTimestamp(cue.startSeconds, nextFormat);
    const endToken = formatSubtitleRenderTimestamp(cue.endSeconds, nextFormat);
    const header = `${startToken} --> ${endToken}`;
    const textLines = Array.isArray(cue.textLines) ? cue.textLines : [String(cue.text || "")];

    if (nextFormat === "vtt") {
      return [header].concat(textLines).join("\n");
    }
    return [String(index + 1), header].concat(textLines).join("\n");
  });

  return `${nextFormat === "vtt" ? "WEBVTT\n\n" : ""}${blocks.join("\n\n")}`.trim();
}

function resolveSubtitleOutputFormat(sourceFormat, outputFormatValue) {
  const requested = asNonEmptyString(outputFormatValue) || "source";
  if (requested === "source") {
    return asNonEmptyString(sourceFormat) || "srt";
  }
  return requested === "json" || requested === "vtt" || requested === "srt" ? requested : "srt";
}

function transformSubtitleDocument(rawText, format, recipe, outputFormatValue) {
  const normalized = normalizeSubtitleText(rawText);
  const nextFormat = asNonEmptyString(format) || "srt";
  const outputFormat = resolveSubtitleOutputFormat(nextFormat, outputFormatValue || toRecord(recipe).outputFormat);

  if (outputFormat !== nextFormat || outputFormat === "json") {
    return serializeSubtitleCueModel(buildNormalizedSubtitleCueModel(normalized, nextFormat, recipe), outputFormat);
  }

  if (nextFormat === "ass" || nextFormat === "ssa") {
    const transformedLines = normalized.split("\n").map(function (line) {
      if (/^Dialogue:/i.test(line) !== true) {
        return line;
      }

      const payload = line.replace(/^Dialogue:\s*/i, "");
      const fields = [];
      let buffer = "";
      let commaCount = 0;

      for (let cursor = 0; cursor < payload.length; cursor += 1) {
        const char = payload[cursor];
        if (char === "," && commaCount < 9) {
          fields.push(buffer);
          buffer = "";
          commaCount += 1;
        } else {
          buffer += char;
        }
      }
      fields.push(buffer);
      const textLines = String(fields[9] || "").replace(/\\N/g, "\n").split("\n");
      const nextText = transformSubtitleCueLines(textLines, recipe).join("\\N");
      return `Dialogue: ${fields.slice(0, 9).join(",")},${nextText}`;
    });

    return transformedLines.join("\n");
  }

  const transformedBlocks = normalized
    .split(/\n{2,}/)
    .map(function (block) {
      return block.trim();
    })
    .filter(Boolean)
    .map(function (block) {
      const lines = block.split("\n");
      const timingIndex = lines.findIndex(function (line) {
        return line.indexOf("-->") >= 0;
      });
      if (timingIndex === -1) {
        return block;
      }

      const headerLines = lines.slice(0, timingIndex + 1);
      const textLines = lines.slice(timingIndex + 1);
      const transformedTextLines = transformSubtitleCueLines(textLines, recipe);
      return headerLines.concat(transformedTextLines).join("\n");
    });

  let nextValue = transformedBlocks.join("\n\n");
  if (toRecord(recipe).collapseBlankLines === true) {
    nextValue = nextValue.replace(/\n{3,}/g, "\n\n");
  }
  return nextValue.trim() === "" ? normalized.trim() : nextValue;
}

function buildSubtitleEditSummary(sourceText, outputText, format, outputFormatValue) {
  const normalizedOutputFormat = resolveSubtitleOutputFormat(format, outputFormatValue);
  const sourceCues = parseSubtitleCues(sourceText, format);
  let outputCues = [];
  if (normalizedOutputFormat === "json") {
    try {
      const parsed = JSON.parse(outputText);
      outputCues = Array.isArray(parsed) ? parsed.map(toRecord) : [];
    } catch (_error) {
      outputCues = [];
    }
  } else {
    outputCues = parseSubtitleCues(outputText, normalizedOutputFormat);
  }
  const sourceLines = normalizeSubtitleText(sourceText).split("\n").filter(Boolean);
  const outputLines = normalizeSubtitleText(outputText).split("\n").filter(Boolean);
  const maxLineLength = outputLines.reduce(function (maxValue, line) {
    return Math.max(maxValue, String(line || "").trim().length);
  }, 0);

  return {
    sourceCueCount: sourceCues.length,
    outputCueCount: outputCues.length,
    sourceLineCount: sourceLines.length,
    outputLineCount: outputLines.length,
    maxLineLength: maxLineLength,
    changed: normalizeSubtitleText(sourceText) !== normalizeSubtitleText(outputText),
    outputFormat: normalizedOutputFormat,
  };
}

function buildAudioAnalysisCatalogProjection(runtime) {
  const modules = getAudioAnalysisModulesForRuntime(runtime);
  const orderedIds = modules
    .map(function (entry) {
      return asNonEmptyString(entry.id);
    })
    .filter(Boolean);

  return {
    orderedIds: orderedIds,
    implementedIds: modules
      .filter(function (entry) {
        return asNonEmptyString(entry.status) === "implemented";
      })
      .map(function (entry) {
        return asNonEmptyString(entry.id);
      })
      .filter(Boolean),
    gatedIds: modules
      .filter(function (entry) {
        return asNonEmptyString(entry.status) === "gated";
      })
      .map(function (entry) {
        return asNonEmptyString(entry.id);
      })
      .filter(Boolean),
    plannedIds: modules
      .filter(function (entry) {
        return asNonEmptyString(entry.status) === "planned";
      })
      .map(function (entry) {
        return asNonEmptyString(entry.id);
      })
      .filter(Boolean),
    visibleIds: orderedIds,
  };
}

function getAudioAnalysisProviderDescriptors(runtime) {
  return Array.isArray(toRecord(runtime.audioAnalysisProviders).providers)
    ? toRecord(runtime.audioAnalysisProviders).providers.map(toRecord)
    : [];
}

function resolveAudioAnalysisProviderIdsForModule(runtime, catalogEntry) {
  const descriptorProviderIds = normalizeStringArray(toRecord(catalogEntry).providerIds);
  if (descriptorProviderIds.length > 0) {
    return descriptorProviderIds;
  }

  const toolIds = normalizeStringArray(toRecord(catalogEntry).toolIds);
  return getAudioAnalysisProviderDescriptors(runtime)
    .filter(function (entry) {
      const toolId = asNonEmptyString(entry.toolId);
      return toolId !== null && toolIds.includes(toolId);
    })
    .map(function (entry) {
      return asNonEmptyString(entry.id);
    })
    .filter(Boolean);
}

function getAudioAnalysisRequiredToolIds(catalogEntry) {
  const source = toRecord(catalogEntry);
  const requiredToolIds = normalizeStringArray(source.requiredToolIds);
  return requiredToolIds.length > 0 ? requiredToolIds : normalizeStringArray(source.toolIds);
}

function buildAudioAnalysisProviderState(runtime, project) {
  const toolState = toRecord(toRecord(runtime.toolState).tools);
  const speechAvailability = buildProcessSpeechAvailability(runtime, project);
  const modelSummaries = buildProfileModelSummary(runtime, project);
  const selectedModel =
    modelSummaries.find(function (entry) {
      return entry.selected === true;
    }) ||
    modelSummaries.find(function (entry) {
      return entry.ready === true;
    }) ||
    null;

  return getAudioAnalysisProviderDescriptors(runtime).reduce(function (accumulator, entry) {
    const providerId = asNonEmptyString(entry.id) || `audio-provider-${Date.now()}`;
    const toolId = asNonEmptyString(entry.toolId);
    const toolEntry = toRecord(toolState[toolId]);
    const descriptorStatus = asNonEmptyString(entry.status) || "planned";
    const moduleIds = normalizeStringArray(entry.moduleIds);
    const blockers = [];
    const warnings = [];
    let status = descriptorStatus;
    let ready = false;

    if (descriptorStatus === "ready") {
      if (toolId !== null && toRecord(toolEntry).installed !== true) {
        status = "missing-tool";
        blockers.push(`Install ${toolId} to enable this provider.`);
      } else if (toolId === "whisper.cpp" && speechAvailability.ready !== true) {
        status = "missing-model";
        blockers.push("Install a compatible Whisper model to enable this provider.");
      } else {
        status = "ready";
        ready = true;
      }
    } else if (descriptorStatus === "gated") {
      warnings.push("This provider remains capability-gated in the current rollout.");
    }

    accumulator[providerId] = normalizeAudioAnalysisProviderStateEntry(
      {
        providerId: providerId,
        status: status,
        toolId: toolId,
        moduleIds: moduleIds,
        titleKey: asNonEmptyString(entry.titleKey),
        summaryKey: asNonEmptyString(entry.summaryKey),
        providerType: asNonEmptyString(entry.providerType),
        installStrategy: asNonEmptyString(entry.installStrategy),
        expectedArtifacts: normalizeStringArray(entry.expectedArtifacts),
        fallbackProviderIds: normalizeStringArray(entry.fallbackProviderIds),
        installed: toRecord(toolEntry).installed === true,
        ready: ready,
        busy: toRecord(toolEntry).busy === true,
        version: asNonEmptyString(toolEntry.version),
        modelId: selectedModel ? asNonEmptyString(selectedModel.modelId) : null,
        platformSupported: toRecord(toolEntry).details?.platformSupported !== false,
        blockers: blockers,
        warnings: warnings,
        lastError: asNonEmptyString(toolEntry.lastError),
      },
      providerId,
      entry
    );
    return accumulator;
  }, {});
}

function buildAudioAnalysisCapabilityState(runtime, project, target, providerState) {
  const toolState = toRecord(toRecord(runtime.toolState).tools);
  return getAudioAnalysisModulesForRuntime(runtime).reduce(function (accumulator, entry) {
    const moduleId = asNonEmptyString(entry.id) || `audio-module-${Date.now()}`;
    const moduleStatus = asNonEmptyString(entry.status) || "planned";
    const providerIds = resolveAudioAnalysisProviderIdsForModule(runtime, entry);
    const toolIds = normalizeStringArray(entry.toolIds);
    const requiredToolIds = getAudioAnalysisRequiredToolIds(entry);
    const blockers = [];
    const warnings = [];
    let status = moduleStatus;

    if (moduleStatus === "implemented") {
      if (target.path === null) {
        status = "blocked";
        blockers.push("Prepare an audio-ready source before running this module.");
      } else if (providerIds.length > 0) {
        const providerEntries = providerIds
          .map(function (providerId) {
            return toRecord(providerState[providerId]);
          })
          .filter(function (provider) {
            return Object.keys(provider).length > 0;
          });
        if (providerEntries.some(function (provider) { return provider.ready === true; })) {
          status = "ready";
        } else {
          status = "blocked";
          providerEntries.forEach(function (provider) {
            normalizeStringArray(provider.blockers).forEach(function (entryText) {
              blockers.push(entryText);
            });
            normalizeStringArray(provider.warnings).forEach(function (entryText) {
              warnings.push(entryText);
            });
          });
        }
      }

      if (status === "ready") {
        const missingToolIds = requiredToolIds.filter(function (toolId) {
          return toRecord(toolState[toolId]).installed !== true;
        });
        if (missingToolIds.length > 0) {
          status = "blocked";
          missingToolIds.forEach(function (toolId) {
            blockers.push(`Install ${toolId} to enable this module.`);
          });
        }
      }
    } else if (moduleStatus === "gated") {
      warnings.push("This module remains capability-gated on the current runtime.");
    }

    accumulator[moduleId] = normalizeAudioAnalysisCapabilityEntry(
      {
        moduleId: moduleId,
        phase: asNonEmptyString(entry.phase),
        status: status,
        titleKey: asNonEmptyString(entry.titleKey),
        summaryKey: asNonEmptyString(entry.summaryKey),
        providerIds: providerIds,
        toolIds: toolIds,
        requiredToolIds: requiredToolIds,
        blockers: Array.from(new Set(blockers)),
        warnings: Array.from(new Set(warnings)),
      },
      moduleId,
      entry
    );
    return accumulator;
  }, {});
}

function getAudioAnalysisConfidenceRank(confidence) {
  const nextConfidence = asNonEmptyString(confidence) || "low";
  return nextConfidence === "high" ? 3 : nextConfidence === "medium" ? 2 : 1;
}

function mapAudioAnalysisResultStatus(processRecord, moduleEntry, capabilityEntry) {
  const processStatus = asNonEmptyString(toRecord(processRecord).status) || "idle";
  const moduleStatus = asNonEmptyString(toRecord(moduleEntry).status) || "idle";
  const capabilityStatus = asNonEmptyString(toRecord(capabilityEntry).status) || "planned";

  if (moduleStatus === "ready") {
    return processStatus === "stale" ? "stale" : "complete";
  }
  if (moduleStatus === "error" || moduleStatus === "failed") {
    return "failed";
  }
  if (moduleStatus === "cancelled") {
    return "cancelled";
  }
  if (["planned", "gated", "blocked", "skipped", "running", "queued"].includes(moduleStatus)) {
    return moduleStatus;
  }
  if (processStatus === "stale" && capabilityStatus === "ready") {
    return "stale";
  }
  return capabilityStatus === "ready" ? "idle" : capabilityStatus;
}

function buildAudioAnalysisModuleMetrics(signals, artifacts) {
  const metrics = [
    {
      id: "signals",
      label: "Signals",
      value: String(signals.length),
    },
    {
      id: "artifacts",
      label: "Artifacts",
      value: String(artifacts.length),
    },
  ];
  const descriptorSummary =
    artifacts
      .map(function (artifact) {
        return toRecord(toRecord(artifact).metadata).descriptorSummary;
      })
      .find(function (entry) {
        return Object.keys(toRecord(entry)).length > 0;
      }) || {};
  const prosodySummary =
    artifacts
      .map(function (artifact) {
        return toRecord(toRecord(artifact).metadata).prosodySummary;
      })
      .find(function (entry) {
        return Object.keys(toRecord(entry)).length > 0;
      }) || {};
  const emotionHeuristic =
    artifacts
      .map(function (artifact) {
        return toRecord(toRecord(artifact).metadata).emotionHeuristic;
      })
      .find(function (entry) {
        return Object.keys(toRecord(entry)).length > 0;
      }) || {};
  const soundEventSummary =
    artifacts
      .map(function (artifact) {
        return toRecord(toRecord(artifact).metadata).topClasses;
      })
      .find(function (entry) {
        return Array.isArray(entry) && entry.length > 0;
      }) || [];
  const sourceSeparationSummary =
    artifacts
      .map(function (artifact) {
        return toRecord(toRecord(artifact).metadata);
      })
      .find(function (entry) {
        return typeof toRecord(entry).stemCount === "number";
      }) || {};
  const musicAnalysisSummary =
    artifacts
      .map(function (artifact) {
        return toRecord(toRecord(artifact).metadata).musicSummary;
      })
      .find(function (entry) {
        return Object.keys(toRecord(entry)).length > 0;
      }) || {};
  const diarizationSummary =
    artifacts
      .map(function (artifact) {
        return toRecord(toRecord(artifact).metadata).diarizationSummary;
      })
      .find(function (entry) {
        return Object.keys(toRecord(entry)).length > 0;
      }) || {};

  if (typeof toRecord(descriptorSummary.centroid).mean === "number") {
    metrics.push({
      id: "spectral-centroid",
      label: "Mean centroid",
      value: `${Number(toRecord(descriptorSummary.centroid).mean).toFixed(1)} Hz`,
    });
  }
  if (typeof toRecord(descriptorSummary.rolloff).mean === "number") {
    metrics.push({
      id: "spectral-rolloff",
      label: "Mean rolloff",
      value: `${Number(toRecord(descriptorSummary.rolloff).mean).toFixed(1)} Hz`,
    });
  }
  if (typeof toRecord(descriptorSummary.flatness).mean === "number") {
    metrics.push({
      id: "spectral-flatness",
      label: "Flatness",
      value: Number(toRecord(descriptorSummary.flatness).mean).toFixed(3),
    });
  }
  if (typeof prosodySummary.meanF0Hz === "number") {
    metrics.push({
      id: "prosody-f0",
      label: "Mean F0",
      value: `${Number(prosodySummary.meanF0Hz).toFixed(1)} Hz`,
    });
  }
  if (typeof prosodySummary.voicedRatio === "number") {
    metrics.push({
      id: "prosody-voiced-ratio",
      label: "Voiced ratio",
      value: `${Math.round(Number(prosodySummary.voicedRatio) * 100)}%`,
    });
  }
  if (typeof prosodySummary.estimatedPauseCount === "number") {
    metrics.push({
      id: "prosody-pauses",
      label: "Estimated pauses",
      value: String(prosodySummary.estimatedPauseCount),
    });
  }
  if (typeof emotionHeuristic.label === "string" && emotionHeuristic.label.trim() !== "") {
    metrics.push({
      id: "emotion-label",
      label: "Heuristic label",
      value: emotionHeuristic.label,
    });
  }
  if (Array.isArray(soundEventSummary) && soundEventSummary.length > 0) {
    const topClass = toRecord(soundEventSummary[0]);
    metrics.push({
      id: "sound-event-top",
      label: "Top event",
      value:
        typeof topClass.label === "string" && topClass.label.trim() !== ""
          ? topClass.label
          : typeof topClass.className === "string" && topClass.className.trim() !== ""
            ? topClass.className
            : "Unknown",
    });
  }
  if (typeof sourceSeparationSummary.stemCount === "number") {
    metrics.push({
      id: "source-separation-stems",
      label: "Separated stems",
      value: String(sourceSeparationSummary.stemCount),
    });
  }
  if (
    typeof sourceSeparationSummary.modelName === "string" &&
    sourceSeparationSummary.modelName.trim() !== ""
  ) {
    metrics.push({
      id: "source-separation-model",
      label: "Separation model",
      value: sourceSeparationSummary.modelName,
    });
  }
  if (typeof musicAnalysisSummary.tempoBpm === "number") {
    metrics.push({
      id: "music-tempo",
      label: "Tempo",
      value: `${Number(musicAnalysisSummary.tempoBpm).toFixed(1)} BPM`,
    });
  }
  if (
    typeof musicAnalysisSummary.dominantPitchClass === "string" &&
    musicAnalysisSummary.dominantPitchClass.trim() !== ""
  ) {
    metrics.push({
      id: "music-pitch-class",
      label: "Dominant pitch class",
      value: musicAnalysisSummary.dominantPitchClass,
    });
  }
  if (typeof diarizationSummary.speakerCount === "number") {
    metrics.push({
      id: "speaker-count",
      label: "Speakers",
      value: String(diarizationSummary.speakerCount),
    });
  }
  if (typeof diarizationSummary.segmentCount === "number") {
    metrics.push({
      id: "speaker-segments",
      label: "Speaker segments",
      value: String(diarizationSummary.segmentCount),
    });
  }

  return metrics.map(normalizeAudioAnalysisMetric);
}

function buildAudioAnalysisModuleSummary(resultStatus, moduleEntry, capabilityEntry) {
  const summary = asNonEmptyString(toRecord(moduleEntry).summary);
  if (summary !== null) {
    return summary;
  }
  const blockers = normalizeStringArray(toRecord(capabilityEntry).blockers);
  if (blockers.length > 0) {
    return blockers[0];
  }
  switch (resultStatus) {
    case "planned":
      return "Reserved for the later rollout.";
    case "gated":
      return "This module remains capability-gated on the current runtime.";
    case "blocked":
      return "Resolve the module blockers before running the audio desk.";
    case "stale":
      return "The target changed after the last completed run.";
    case "complete":
      return "This module completed during the latest managed run.";
    case "running":
      return "This module is currently running.";
    default:
      return "";
  }
}

function syncProjectAudioAnalysisProjection(runtime, project) {
  const normalizedState = normalizeAudioAnalysisState(project.audioAnalysis, runtime);
  const target = resolveAudioFeatureTarget(project);
  const providerState = buildAudioAnalysisProviderState(runtime, project);
  const capabilityState = buildAudioAnalysisCapabilityState(runtime, project, target, providerState);
  const processRecord = getFeatureProcessRecord(project, AUDIO_FEATURE_ID);
  const reportRecord = getFeatureReportRecord(project, AUDIO_FEATURE_ID);
  const nextResults = {};
  const nextRuns = {};

  getAudioAnalysisModulesForRuntime(runtime).forEach(function (entry) {
    const moduleId = asNonEmptyString(entry.id) || `audio-module-${Date.now()}`;
    const existingResult = normalizeAudioAnalysisModuleResult(
      toRecord(toRecord(normalizedState.results)[moduleId]),
      moduleId,
      entry
    );
    const capabilityEntry = normalizeAudioAnalysisCapabilityEntry(
      toRecord(capabilityState[moduleId]),
      moduleId,
      entry
    );
    const processModule =
      (Array.isArray(processRecord.modules) ? processRecord.modules : []).find(function (candidate) {
        return asNonEmptyString(toRecord(candidate).id) === moduleId;
      }) || {};
    const signals = (Array.isArray(processRecord.findings) ? processRecord.findings : [])
      .filter(function (candidate) {
        return asNonEmptyString(toRecord(candidate).moduleId) === moduleId;
      })
      .map(normalizeProcessFinding);
    const artifacts = (Array.isArray(processRecord.artifacts) ? processRecord.artifacts : [])
      .filter(function (candidate) {
        return asNonEmptyString(toRecord(candidate).moduleId) === moduleId;
      })
      .map(normalizeProcessArtifact);
    const resultStatus = mapAudioAnalysisResultStatus(processRecord, processModule, capabilityEntry);
    const confidence =
      signals.sort(function (left, right) {
        return getAudioAnalysisConfidenceRank(right.confidence) - getAudioAnalysisConfidenceRank(left.confidence);
      })[0]?.confidence || null;

    nextResults[moduleId] = normalizeAudioAnalysisModuleResult(
      {
        ...existingResult,
        moduleId: moduleId,
        phase: asNonEmptyString(entry.phase) || existingResult.phase,
        status: resultStatus,
        titleKey: asNonEmptyString(entry.titleKey) || existingResult.titleKey,
        summaryKey: asNonEmptyString(entry.summaryKey) || existingResult.summaryKey,
        providerIds:
          normalizeStringArray(entry.providerIds).length > 0
            ? normalizeStringArray(entry.providerIds)
            : capabilityEntry.providerIds,
        toolIds:
          normalizeStringArray(entry.toolIds).length > 0
            ? normalizeStringArray(entry.toolIds)
            : capabilityEntry.toolIds,
        requiredToolIds: capabilityEntry.requiredToolIds,
        summary: buildAudioAnalysisModuleSummary(resultStatus, processModule, capabilityEntry),
        blockers:
          resultStatus === "planned" || resultStatus === "gated" || resultStatus === "blocked"
            ? capabilityEntry.blockers
            : [],
        warnings: Array.from(
          new Set(
            normalizeStringArray(capabilityEntry.warnings).concat(
              normalizeStringArray(toRecord(processModule).warnings),
              resultStatus === "stale" ? ["Target changed; rerun this audio module."] : []
            )
          )
        ),
        signals: signals,
        artifacts: artifacts,
        metrics: buildAudioAnalysisModuleMetrics(signals, artifacts),
        confidence: confidence,
        timing: {
          sampleWindowSeconds: asNumber(toRecord(processRecord.targetSummary).sampleWindowSeconds),
          startedAt: asNonEmptyString(toRecord(processModule).startedAt),
          completedAt: asNonEmptyString(toRecord(processModule).completedAt),
        },
        runMeta: {
          runId: asNonEmptyString(processRecord.runId),
          jobId: asNonEmptyString(processRecord.jobId),
          requestId: asNonEmptyString(processRecord.requestId),
        },
        sourceSignature: asNonEmptyString(target.signature),
      },
      moduleId,
      entry
    );

    nextRuns[moduleId] = normalizeAudioAnalysisRunRecord(
      {
        moduleId: moduleId,
        status: nextResults[moduleId].status,
        runId: asNonEmptyString(processRecord.runId),
        jobId: asNonEmptyString(processRecord.jobId),
        requestId: asNonEmptyString(processRecord.requestId),
        startedAt: asNonEmptyString(toRecord(processModule).startedAt) || asNonEmptyString(processRecord.startedAt),
        completedAt: asNonEmptyString(toRecord(processModule).completedAt) || asNonEmptyString(processRecord.completedAt),
        warnings: nextResults[moduleId].warnings,
        error: nextResults[moduleId].status === "failed" ? asNonEmptyString(processRecord.error) : null,
        artifactIds: nextResults[moduleId].artifacts.map(function (artifact) {
          return artifact.id;
        }),
        findingIds: nextResults[moduleId].signals.map(function (signal) {
          return signal.id;
        }),
      },
      moduleId
    );
  });

  project.audioAnalysis = normalizeAudioAnalysisState(
    {
      ...normalizedState,
      schemaVersion: AUDIO_ANALYSIS_SCHEMA_VERSION,
      source: {
        preferredSourceKind: getPreferredFeatureSourceKind(AUDIO_FEATURE_ID, runtime.sourcePresets),
        requestedMode: target.requestedMode,
        mode: target.mode,
        outputId: target.outputId,
        targetSignature: target.signature,
        targetPath: target.path,
        targetFileName: target.fileName,
        targetMimeType: target.mimeType,
        targetLabel: target.label,
        extractedAudioPath:
          asNonEmptyString(toRecord(target.metadata).extractedBy) !== null ? asNonEmptyString(target.path) : null,
        updatedAt: project.updatedAt,
      },
      analysisCatalog: buildAudioAnalysisCatalogProjection(runtime),
      capabilityState: capabilityState,
      providerState: providerState,
      runs: nextRuns,
      results: nextResults,
      export: {
        lastGeneratedAt: asNonEmptyString(reportRecord.generatedAt),
        items: Array.isArray(reportRecord.exports) ? reportRecord.exports.map(normalizeReportExport) : [],
      },
    },
    runtime
  );

  return project.audioAnalysis;
}

function syncProjectSubtitleAnalysisProjection(runtime, project) {
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, runtime);
  const processRecord = getFeatureProcessRecord(project, SUBTITLE_FEATURE_ID);
  const reportRecord = getFeatureReportRecord(project, SUBTITLE_FEATURE_ID);

  subtitleState.analysis = {
    ...subtitleState.analysis,
    status: asNonEmptyString(processRecord.status) || "idle",
    summaryCards: Array.isArray(reportRecord.summaryCards) ? reportRecord.summaryCards.map(normalizeReportSummaryCard) : [],
    findings: Array.isArray(reportRecord.findings) ? reportRecord.findings.map(normalizeProcessFinding) : [],
    warnings: Array.isArray(reportRecord.warnings) ? reportRecord.warnings.map(String) : [],
    moduleResults: (Array.isArray(processRecord.modules) ? processRecord.modules : []).reduce(function (accumulator, entry) {
      const moduleRecord = normalizeProcessModule(entry);
      accumulator[moduleRecord.id] = moduleRecord;
      return accumulator;
    }, {}),
    lastRunAt: asNonEmptyString(processRecord.completedAt),
  };
  subtitleState.export = {
    lastGeneratedAt: asNonEmptyString(reportRecord.generatedAt),
    items: Array.isArray(reportRecord.exports) ? reportRecord.exports.map(normalizeReportExport) : [],
  };
  project.subtitleAnalysis = subtitleState;
  return project.subtitleAnalysis;
}

function getProfileArtifactPreferenceMap(profileCapabilities) {
  return toRecord(toRecord(profileCapabilities).artifactPreferences);
}

function getProfileSamplingConfig(profileCapabilities) {
  return toRecord(toRecord(profileCapabilities).sampling);
}

function getProfileFrameDensityConfig(profileCapabilities, densityId) {
  const densityModes = toRecord(toRecord(getProfileSamplingConfig(profileCapabilities)).frameDensityModes);
  return toRecord(densityModes[asNonEmptyString(densityId) || "balanced"]);
}

function clampProfileTranscriptSampleSeconds(profileCapabilities, value) {
  const config = toRecord(toRecord(getProfileSamplingConfig(profileCapabilities)).transcriptSampleSeconds);
  const minValue = Math.max(5, Math.round(asNumber(config.min) || 15));
  const maxValue = Math.max(minValue, Math.round(asNumber(config.max) || 90));
  const stepValue = Math.max(1, Math.round(asNumber(config.step) || 15));
  const fallback = Math.max(minValue, Math.min(maxValue, Math.round(asNumber(config.defaultValue) || 45)));
  const normalizedValue = Math.max(minValue, Math.min(maxValue, Math.round(asNumber(value) || fallback)));
  return Math.max(minValue, Math.min(maxValue, Math.round(normalizedValue / stepValue) * stepValue));
}

function normalizeProfileArtifactPreferences(rawValue, profileCapabilities, sourceKind) {
  const preferenceMap = getProfileArtifactPreferenceMap(profileCapabilities);
  const source = toRecord(rawValue);
  const normalized = {};

  Object.keys(preferenceMap).forEach(function (artifactId) {
    const descriptor = toRecord(preferenceMap[artifactId]);
    const mediaKinds = Array.isArray(descriptor.mediaKinds) ? descriptor.mediaKinds : [];
    const compatible = mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    normalized[artifactId] =
      compatible &&
      (Object.prototype.hasOwnProperty.call(source, artifactId)
        ? source[artifactId] === true
        : descriptor.defaultEnabled !== false);
  });

  return normalized;
}

function applyProfilePresetPatch(profilePresets, profileModels, profileCapabilities, sourceKind, profileState, presetId) {
  const preset = findProfilePreset(profilePresets, sourceKind, presetId);
  if (!preset) {
    return profileState;
  }

  const patch = toRecord(toRecord(preset).patch);
  const laneIds = getCompatibleProfileLaneIds(profilePresets, sourceKind);
  const lanePatch = toRecord(patch.laneSelection);
  const nextLaneSelection = {};
  laneIds.forEach(function (laneId) {
    nextLaneSelection[laneId] =
      Object.prototype.hasOwnProperty.call(lanePatch, laneId)
        ? lanePatch[laneId] === true
        : profileState.laneSelection[laneId] === true;
  });

  const requestedModelId = asNonEmptyString(patch.modelId);
  const fallbackModelId = getDefaultProfileModelId(profileModels, sourceKind);
  const nextArtifactPreferences = normalizeProfileArtifactPreferences(
    {
      ...toRecord(profileState.artifactPreferences),
      ...toRecord(patch.artifactPreferences),
    },
    profileCapabilities,
    sourceKind
  );

  return {
    ...profileState,
    activePresetId: asNonEmptyString(toRecord(preset).id),
    targetAssetMode: asNonEmptyString(patch.targetAssetMode) === "derived" ? "derived" : "source",
    depth: asNonEmptyString(patch.depth) || profileState.depth,
    sensitivity: clampNumber(patch.sensitivity, 0.1, 1, profileState.sensitivity),
    frameSampleDensity:
      ["sparse", "balanced", "dense"].includes(asNonEmptyString(patch.frameSampleDensity))
        ? asNonEmptyString(patch.frameSampleDensity)
        : profileState.frameSampleDensity,
    transcriptSampleSeconds: clampProfileTranscriptSampleSeconds(
      profileCapabilities,
      patch.transcriptSampleSeconds
    ),
    modelId: requestedModelId || fallbackModelId,
    artifactPreferences: nextArtifactPreferences,
    laneSelection: nextLaneSelection,
  };
}

function createDefaultProfileState(profilePresets, profileModels, profileCapabilities, sourceKind) {
  const defaultDepth = asNonEmptyString(toRecord(profilePresets).defaultDepth) || "balanced";
  const defaultSensitivity = clampNumber(
    toRecord(profilePresets).defaultSensitivity,
    0.1,
    1,
    0.58
  );
  const modelId = getDefaultProfileModelId(profileModels, sourceKind);
  const defaultSampling = getProfileSamplingConfig(profileCapabilities);
  const laneSelection = {};
  getCompatibleProfileLaneIds(profilePresets, sourceKind).forEach(function (laneId) {
    laneSelection[laneId] = toRecord(getProfileLaneMap(profilePresets)[laneId]).supportsBeginner === true;
  });

  let profileState = {
    mode: asNonEmptyString(toRecord(profilePresets).defaultMode) || "beginner",
    dirty: false,
    activePresetId: null,
    targetAssetMode: "source",
    targetOutputId: null,
    targetAssetSignature: null,
    depth: defaultDepth,
    sensitivity: defaultSensitivity,
    frameSampleDensity:
      asNonEmptyString(toRecord(defaultSampling).defaultFrameDensity) || "balanced",
    transcriptSampleSeconds: clampProfileTranscriptSampleSeconds(
      profileCapabilities,
      toRecord(toRecord(defaultSampling).transcriptSampleSeconds).defaultValue
    ),
    modelId: modelId,
    artifactPreferences: normalizeProfileArtifactPreferences({}, profileCapabilities, sourceKind),
    laneSelection: laneSelection,
    readiness: createEmptyProfileReadiness(),
    estimate: createEmptyProfileEstimate(),
    preflight: createEmptyProfilePreflight(),
    signals: [],
    artifacts: [],
    lastError: null,
    lastActionAt: null,
  };

  const defaultPresetId = getDefaultProfilePresetId(profilePresets, sourceKind);
  if (defaultPresetId) {
    profileState = applyProfilePresetPatch(
      profilePresets,
      profileModels,
      profileCapabilities,
      sourceKind,
      profileState,
      defaultPresetId
    );
  }

  return profileState;
}

function normalizeProfileArtifact(rawValue) {
  const source = toRecord(rawValue);
  return {
    id: asNonEmptyString(source.id) || `profile-artifact-${Date.now()}`,
    kind: asNonEmptyString(source.kind) || "artifact",
    path: asNonEmptyString(source.path),
    fileName: asNonEmptyString(source.fileName),
    label: asNonEmptyString(source.label),
    createdAt: asNonEmptyString(source.createdAt) || new Date().toISOString(),
    metadata: toRecord(source.metadata),
  };
}

function normalizeProfileSignal(rawValue) {
  const source = toRecord(rawValue);
  return {
    id: asNonEmptyString(source.id) || `profile-signal-${Date.now()}`,
    laneId: asNonEmptyString(source.laneId) || "metadata-lineage",
    kind: asNonEmptyString(source.kind) || "derived",
    level: asNonEmptyString(source.level) || "low",
    confidence: asNonEmptyString(source.confidence) || "low",
    title: asNonEmptyString(source.title) || "Signal",
    detail: asNonEmptyString(source.detail) || "",
    evidenceCount: Math.max(0, Math.round(asNumber(source.evidenceCount) || 0)),
    artifactIds: Array.isArray(source.artifactIds)
      ? source.artifactIds.map(asNonEmptyString).filter(Boolean)
      : [],
  };
}

function normalizeProfileState(rawValue, profilePresets, profileModels, profileCapabilities, sourceKind) {
  const defaults = createDefaultProfileState(profilePresets, profileModels, profileCapabilities, sourceKind);
  const source = toRecord(rawValue);
  const laneSelection = {};
  getCompatibleProfileLaneIds(profilePresets, sourceKind).forEach(function (laneId) {
    laneSelection[laneId] = Object.prototype.hasOwnProperty.call(toRecord(source.laneSelection), laneId)
      ? toRecord(source.laneSelection)[laneId] === true
      : defaults.laneSelection[laneId] === true;
  });

  const requestedPresetId = asNonEmptyString(source.activePresetId) || defaults.activePresetId;
  const modelId =
    asNonEmptyString(source.modelId) || getDefaultProfileModelId(profileModels, sourceKind);

  return {
    mode:
      asNonEmptyString(source.mode) === "advanced"
        ? "advanced"
        : asNonEmptyString(source.mode) || defaults.mode,
    dirty: source.dirty === true,
    activePresetId: findProfilePreset(profilePresets, sourceKind, requestedPresetId)
      ? requestedPresetId
      : defaults.activePresetId,
    targetAssetMode:
      asNonEmptyString(source.targetAssetMode) === "derived" ? "derived" : defaults.targetAssetMode,
    targetOutputId: asNonEmptyString(source.targetOutputId),
    targetAssetSignature: asNonEmptyString(source.targetAssetSignature),
    depth:
      ["quick", "balanced", "deep"].includes(asNonEmptyString(source.depth))
        ? asNonEmptyString(source.depth)
        : defaults.depth,
    sensitivity: clampNumber(source.sensitivity, 0.1, 1, defaults.sensitivity),
    frameSampleDensity:
      ["sparse", "balanced", "dense"].includes(asNonEmptyString(source.frameSampleDensity))
        ? asNonEmptyString(source.frameSampleDensity)
        : defaults.frameSampleDensity,
    transcriptSampleSeconds: clampProfileTranscriptSampleSeconds(
      profileCapabilities,
      source.transcriptSampleSeconds
    ),
    modelId: modelId,
    artifactPreferences: normalizeProfileArtifactPreferences(
      toRecord(source.artifactPreferences),
      profileCapabilities,
      sourceKind
    ),
    laneSelection: laneSelection,
    readiness: {
      ...createEmptyProfileReadiness(),
      ...toRecord(source.readiness),
      requiredTools: Array.isArray(toRecord(source.readiness).requiredTools)
        ? toRecord(source.readiness).requiredTools.map(toRecord)
        : [],
      optionalTools: Array.isArray(toRecord(source.readiness).optionalTools)
        ? toRecord(source.readiness).optionalTools.map(toRecord)
        : [],
      models: Array.isArray(toRecord(source.readiness).models)
        ? toRecord(source.readiness).models.map(toRecord)
        : [],
      blockers: Array.isArray(toRecord(source.readiness).blockers)
        ? toRecord(source.readiness).blockers.map(function (entry) {
            return String(entry);
          })
        : [],
      warnings: Array.isArray(toRecord(source.readiness).warnings)
        ? toRecord(source.readiness).warnings.map(function (entry) {
            return String(entry);
          })
        : [],
    },
    estimate: {
      ...createEmptyProfileEstimate(),
      ...toRecord(source.estimate),
      runtimeSeconds: asNumber(toRecord(source.estimate).runtimeSeconds),
      artifactCount: Math.max(0, Math.round(asNumber(toRecord(source.estimate).artifactCount) || 0)),
      sampleWindowSeconds: asNumber(toRecord(source.estimate).sampleWindowSeconds),
    },
    preflight: {
      ...createEmptyProfilePreflight(),
      ...toRecord(source.preflight),
      status: asNonEmptyString(toRecord(source.preflight).status) || "idle",
      jobId: asNonEmptyString(toRecord(source.preflight).jobId),
      requestId: asNonEmptyString(toRecord(source.preflight).requestId),
      ranAt: asNonEmptyString(toRecord(source.preflight).ranAt),
      targetSummary:
        toRecord(toRecord(source.preflight).targetSummary) &&
        Object.keys(toRecord(toRecord(source.preflight).targetSummary)).length > 0
          ? toRecord(toRecord(source.preflight).targetSummary)
          : null,
      warnings: Array.isArray(toRecord(source.preflight).warnings)
        ? toRecord(source.preflight).warnings.map(function (entry) {
            return String(entry);
          })
        : [],
      error: asNonEmptyString(toRecord(source.preflight).error),
    },
    signals: Array.isArray(source.signals)
      ? source.signals.map(normalizeProfileSignal)
      : [],
    artifacts: Array.isArray(source.artifacts)
      ? source.artifacts
          .map(normalizeProfileArtifact)
          .filter(function (entry) {
            return entry.path !== null;
          })
      : [],
    lastError: asNonEmptyString(source.lastError),
    lastActionAt: asNonEmptyString(source.lastActionAt),
  };
}

function createProjectRecord(
  sourcePresets,
  editPresets,
  profilePresets,
  profileModels,
  profileCapabilities,
  subtitleRuntime,
  featureId
) {
  const now = new Date().toISOString();
  const kind = getPreferredFeatureSourceKind(featureId, sourcePresets);
  const mode = getDefaultMode(sourcePresets, kind);
  const slug = buildProjectSlug(now);

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: slug,
    slug: slug,
    name: buildProjectName(now),
    createdAt: now,
    updatedAt: now,
    source: {
      kind: kind,
      mode: mode,
      status: "idle",
      storedPath: null,
      storedFileName: null,
      sourceUrl: null,
      mimeType: null,
      routeLabel: null,
      lastError: null,
      metadata: null,
      metadataError: null,
      drafts: createEmptySourceDrafts(sourcePresets),
    },
    edit: createDefaultEditState(editPresets, kind),
    profile: createDefaultProfileState(profilePresets, profileModels, profileCapabilities, kind),
    audioAnalysis: createEmptyAudioAnalysisState(),
    subtitleAnalysis: createEmptySubtitleAnalysisState(subtitleRuntime || {}),
    process: createEmptyProcessState(),
    report: createEmptyReportState(),
  };
}

function normalizeProject(
  rawValue,
  sourcePresets,
  editPresets,
  profilePresets,
  profileModels,
  profileCapabilities,
  subtitleRuntime
) {
  const source = toRecord(toRecord(rawValue).source);
  const kind = asNonEmptyString(source.kind) || getDefaultSourceType(sourcePresets);
  const mode = asNonEmptyString(source.mode) || getDefaultMode(sourcePresets, kind);
  const drafts = toRecord(source.drafts);
  const defaultPreset = getDefaultYoutubePreset(sourcePresets);
  const youtubePreset = asNonEmptyString(drafts.youtubePreset) || defaultPreset;

  return {
    schemaVersion:
      typeof toRecord(rawValue).schemaVersion === "number"
        ? toRecord(rawValue).schemaVersion
        : PROJECT_SCHEMA_VERSION,
    id: asNonEmptyString(toRecord(rawValue).id) || asNonEmptyString(toRecord(rawValue).slug) || buildProjectSlug(new Date().toISOString()),
    slug: asNonEmptyString(toRecord(rawValue).slug) || asNonEmptyString(toRecord(rawValue).id) || buildProjectSlug(new Date().toISOString()),
    name: asNonEmptyString(toRecord(rawValue).name) || buildProjectName(new Date().toISOString()),
    createdAt: asNonEmptyString(toRecord(rawValue).createdAt) || new Date().toISOString(),
    updatedAt: asNonEmptyString(toRecord(rawValue).updatedAt) || new Date().toISOString(),
    source: {
      kind: kind,
      mode: mode,
      status: asNonEmptyString(source.status) || "idle",
      storedPath: asNonEmptyString(source.storedPath),
      storedFileName: asNonEmptyString(source.storedFileName),
      sourceUrl: asNonEmptyString(source.sourceUrl),
      mimeType: asNonEmptyString(source.mimeType),
      routeLabel: asNonEmptyString(source.routeLabel),
      lastError: asNonEmptyString(source.lastError),
      metadata: normalizeSourceMetadata(source.metadata),
      metadataError: asNonEmptyString(source.metadataError),
      drafts: {
        urlInput: asNonEmptyString(drafts.urlInput) || "",
        youtubeUrl: asNonEmptyString(drafts.youtubeUrl) || "",
        fileNameHint: asNonEmptyString(drafts.fileNameHint) || "",
        youtubePreset: youtubePreset,
        youtubeCustom: {
          ...getPresetDefaultCustomValues(sourcePresets, youtubePreset),
          ...toRecord(drafts.youtubeCustom),
        },
      },
    },
    edit: normalizeEditState(toRecord(rawValue).edit, editPresets, kind),
    profile: normalizeProfileState(
      toRecord(rawValue).profile,
      profilePresets,
      profileModels,
      profileCapabilities,
      kind
    ),
    audioAnalysis: clone(toRecord(rawValue).audioAnalysis),
    subtitleAnalysis: normalizeSubtitleAnalysisState(toRecord(rawValue).subtitleAnalysis, subtitleRuntime || {}),
    process: normalizeProcessState(toRecord(rawValue).process),
    report: normalizeReportState(toRecord(rawValue).report),
  };
}

function updateProjectTimestamps(project) {
  project.updatedAt = new Date().toISOString();
  return project;
}

function findProject(runtime, projectId) {
  return runtime.projects.find(function (project) {
    return project.id === projectId;
  });
}

function getActiveProject(runtime) {
  return findProject(runtime, runtime.activeProjectId) || null;
}

function getProjectDir(runtime, project) {
  return `${runtime.paths.projectsDir}/${project.slug}`;
}

function getProjectMetaPath(runtime, project) {
  return `${getProjectDir(runtime, project)}/project.json`;
}

function getProjectSourceDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/source`;
}

function getProjectSubtitleSourceDir(runtime, project) {
  return `${getProjectSourceDir(runtime, project)}/subtitles`;
}

function getProjectDerivedDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/derived`;
}

function getProjectEditDir(runtime, project) {
  return `${getProjectDerivedDir(runtime, project)}/edit`;
}

function getProjectSubtitleEditDir(runtime, project) {
  return `${getProjectDerivedDir(runtime, project)}/subtitle-edit`;
}

function getProjectEditPreviewDir(runtime, project) {
  return `${getProjectEditDir(runtime, project)}/preview`;
}

function getProjectSubtitleEditPreviewDir(runtime, project) {
  return `${getProjectSubtitleEditDir(runtime, project)}/preview`;
}

function getProjectEditOutputDir(runtime, project) {
  return `${getProjectEditDir(runtime, project)}/output`;
}

function getProjectSubtitleEditOutputDir(runtime, project) {
  return `${getProjectSubtitleEditDir(runtime, project)}/output`;
}

function getProjectEditManifestPath(runtime, project) {
  return `${getProjectEditDir(runtime, project)}/manifest.json`;
}

function getProjectProfileDir(runtime, project) {
  return `${getProjectDerivedDir(runtime, project)}/profile`;
}

function getProjectProfilePreflightDir(runtime, project) {
  return `${getProjectProfileDir(runtime, project)}/preflight`;
}

function getProjectProfileManifestPath(runtime, project) {
  return `${getProjectProfileDir(runtime, project)}/manifest.json`;
}

function getProjectProcessDir(runtime, project) {
  return `${getProjectDerivedDir(runtime, project)}/process`;
}

function getProjectSubtitleProcessDir(runtime, project) {
  return `${getProjectProcessDir(runtime, project)}/subtitle-analysis`;
}

function getProjectProcessManifestPath(runtime, project) {
  return `${getProjectProcessDir(runtime, project)}/manifest.json`;
}

function getProjectReportDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/reports`;
}

function getProjectReportManifestPath(runtime, project) {
  return `${getProjectReportDir(runtime, project)}/manifest.json`;
}

function getRoomPackageToolsDir(runtime) {
  return asNonEmptyString(runtime.packageToolsDir);
}

function getAudioAnalysisOpenSmileConfigDir(runtime) {
  const packageToolsDir = getRoomPackageToolsDir(runtime);
  return packageToolsDir !== null ? `${packageToolsDir}/opensmile` : null;
}

function getAudioAnalysisOpenSmileConfigPath(runtime, relativePath) {
  const configDir = getAudioAnalysisOpenSmileConfigDir(runtime);
  return configDir !== null ? `${configDir}/${relativePath}` : null;
}

function getAudioAnalysisYamnetDir(runtime) {
  const packageToolsDir = getRoomPackageToolsDir(runtime);
  return packageToolsDir !== null ? `${packageToolsDir}/yamnet` : null;
}

function getAudioAnalysisYamnetScriptPath(runtime) {
  const yamnetDir = getAudioAnalysisYamnetDir(runtime);
  return yamnetDir !== null ? `${yamnetDir}/yamnet_infer.py` : null;
}

function getAudioAnalysisDiarizationDir(runtime) {
  const packageToolsDir = getRoomPackageToolsDir(runtime);
  return packageToolsDir !== null ? `${packageToolsDir}/diarization` : null;
}

function getAudioAnalysisDiarizationScriptPath(runtime) {
  const diarizationDir = getAudioAnalysisDiarizationDir(runtime);
  return diarizationDir !== null ? `${diarizationDir}/pyaudioanalysis_diarize.py` : null;
}

function getAudioAnalysisMusicDir(runtime) {
  const packageToolsDir = getRoomPackageToolsDir(runtime);
  return packageToolsDir !== null ? `${packageToolsDir}/music` : null;
}

function getAudioAnalysisMusicScriptPath(runtime) {
  const musicDir = getAudioAnalysisMusicDir(runtime);
  return musicDir !== null ? `${musicDir}/librosa_music_analysis.py` : null;
}

function getProfileModelsDir(runtime) {
  return `${runtime.paths.storageDir}/models/whisper`;
}

function getProfileModelStatePath(runtime) {
  return `${runtime.paths.storageDir}/profile-model-state.json`;
}

function toFileUrl(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return null;
  }

  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    return encodeURI(`file://${normalized}`);
  }
  return encodeURI(`file:///${normalized}`);
}

function getSourceRouteLabel(project) {
  if (project.source.routeLabel) {
    return project.source.routeLabel;
  }
  if (project.source.mode === "youtube") {
    return "YouTube";
  }
  if (project.source.mode === "url") {
    return "Direct URL";
  }
  return "Local copy";
}

function serializeProjectSummary(project) {
  const mediaProcess = getFeatureProcessRecord(project, FEATURE_ID);
  const audioProcess = getFeatureProcessRecord(project, AUDIO_FEATURE_ID);
  const mediaReport = getFeatureReportRecord(project, FEATURE_ID);
  const audioReport = getFeatureReportRecord(project, AUDIO_FEATURE_ID);
  const subtitleProcess = getFeatureProcessRecord(project, SUBTITLE_FEATURE_ID);
  const subtitleReport = getFeatureReportRecord(project, SUBTITLE_FEATURE_ID);
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    updatedAt: project.updatedAt,
    sourceKind: project.source.kind,
    sourceMode: project.source.mode,
    status: project.source.status,
    hasSource: typeof project.source.storedPath === "string" && project.source.storedPath.trim() !== "",
    handoffMode: asNonEmptyString(toRecord(project.edit).handoffMode) || "source",
    hasDerivedOutput:
      Array.isArray(toRecord(project.edit).outputs) &&
      toRecord(project.edit).outputs.some(function (entry) {
        return asNonEmptyString(toRecord(entry).path) !== null;
      }),
    profileMode: asNonEmptyString(toRecord(project.profile).mode) || "beginner",
    profilePreflightStatus: asNonEmptyString(toRecord(toRecord(project.profile).preflight).status) || "idle",
    profileTargetMode: asNonEmptyString(toRecord(project.profile).targetAssetMode) || "source",
    processStatus: mediaProcess.status,
    reportStatus: mediaReport.status,
    audioProcessStatus: audioProcess.status,
    audioReportStatus: audioReport.status,
    audioModuleCount: Object.keys(toRecord(toRecord(project.audioAnalysis).results)).length,
    subtitleProcessStatus: subtitleProcess.status,
    subtitleReportStatus: subtitleReport.status,
    subtitleEntryCount: Array.isArray(toRecord(project.subtitleAnalysis).entries)
      ? toRecord(project.subtitleAnalysis).entries.length
      : 0,
  };
}

function serializeProject(project, runtime) {
  if (project === null) {
    return null;
  }

  const audioAnalysis = normalizeAudioAnalysisState(project.audioAnalysis, runtime);
  const subtitleAnalysis = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    source: {
      ...clone(project.source),
      previewUrl: toFileUrl(project.source.storedPath),
      routeLabel: getSourceRouteLabel(project),
    },
    edit: {
      ...clone(project.edit),
      preview: {
        ...clone(toRecord(project.edit).preview),
        previewUrl: toFileUrl(toRecord(toRecord(project.edit).preview).path),
        artifacts: (Array.isArray(toRecord(toRecord(project.edit).preview).artifacts)
          ? toRecord(toRecord(project.edit).preview).artifacts
          : []
        ).map(function (entry) {
          return {
            ...clone(entry),
            previewUrl: toFileUrl(toRecord(entry).path),
          };
        }),
      },
      outputs: (Array.isArray(toRecord(project.edit).outputs) ? project.edit.outputs : []).map(
        function (entry) {
          return {
            ...clone(entry),
            previewUrl: toFileUrl(entry.path),
            artifacts: (Array.isArray(entry.artifacts) ? entry.artifacts : []).map(function (artifact) {
              return {
                ...clone(artifact),
                previewUrl: toFileUrl(toRecord(artifact).path),
              };
            }),
          };
        }
      ),
    },
    profile: {
      ...clone(project.profile),
      artifacts: (Array.isArray(toRecord(project.profile).artifacts) ? project.profile.artifacts : []).map(
        function (entry) {
          return {
            ...clone(entry),
            previewUrl: toFileUrl(entry.path),
          };
        }
      ),
    },
    audioAnalysis: {
      ...clone(audioAnalysis),
      results: Object.keys(toRecord(audioAnalysis.results)).reduce(
        function (accumulator, moduleId) {
          const result = normalizeAudioAnalysisModuleResult(
            toRecord(toRecord(audioAnalysis.results)[moduleId]),
            moduleId,
            {}
          );
          accumulator[moduleId] = {
            ...clone(result),
            artifacts: result.artifacts.map(function (entry) {
              return {
                ...clone(entry),
                previewUrl: toFileUrl(entry.path),
              };
            }),
          };
          return accumulator;
        },
        {}
      ),
      export: {
        ...clone(toRecord(audioAnalysis.export)),
        items: (
          Array.isArray(toRecord(audioAnalysis.export).items)
            ? toRecord(audioAnalysis.export).items
            : []
        ).map(function (entry) {
          return {
            ...clone(entry),
            fileUrl: toFileUrl(entry.path),
          };
        }),
      },
    },
    subtitleAnalysis: {
      ...clone(subtitleAnalysis),
      entries: subtitleAnalysis.entries.map(function (entry) {
        return {
          ...clone(entry),
          fileUrl: toFileUrl(entry.path),
        };
      }),
      edit: {
        ...clone(subtitleAnalysis.edit),
        outputs: (Array.isArray(toRecord(subtitleAnalysis.edit).outputs)
          ? toRecord(subtitleAnalysis.edit).outputs
          : []
        ).map(function (entry) {
          return {
            ...clone(entry),
            fileUrl: toFileUrl(entry.path),
          };
        }),
      },
      export: {
        ...clone(toRecord(subtitleAnalysis.export)),
        items: (
          Array.isArray(toRecord(subtitleAnalysis.export).items)
            ? toRecord(subtitleAnalysis.export).items
            : []
        ).map(function (entry) {
          return {
            ...clone(entry),
            fileUrl: toFileUrl(entry.path),
          };
        }),
      },
    },
    process: {
      ...clone(project.process),
      records: FEATURE_IDS.reduce(function (accumulator, featureId) {
        const record = getFeatureProcessRecord(project, featureId);
        accumulator[featureId] = {
          ...clone(record),
          artifacts: record.artifacts.map(function (entry) {
            return {
              ...clone(entry),
              previewUrl: toFileUrl(entry.path),
            };
          }),
        };
        return accumulator;
      }, {}),
    },
    report: {
      ...clone(project.report),
      records: FEATURE_IDS.reduce(function (accumulator, featureId) {
        const record = getFeatureReportRecord(project, featureId);
        accumulator[featureId] = {
          ...clone(record),
          exports: record.exports.map(function (entry) {
            return {
              ...clone(entry),
              fileUrl: toFileUrl(entry.path),
            };
          }),
        };
        return accumulator;
      }, {}),
    },
  };
}

function buildEditManifest(project) {
  const edit = toRecord(project.edit);
  const preview = toRecord(edit.preview);
  const outputs = Array.isArray(edit.outputs) ? edit.outputs.map(normalizeEditOutput) : [];

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: project.id,
    updatedAt: project.updatedAt,
    sourceKind: project.source.kind,
    handoffMode: asNonEmptyString(edit.handoffMode) || "source",
    activeOutputId: asNonEmptyString(edit.activeOutputId),
    preview: {
      status: asNonEmptyString(preview.status) || "idle",
      path: asNonEmptyString(preview.path),
      fileName: asNonEmptyString(preview.fileName),
      recipeSignature: asNonEmptyString(preview.recipeSignature),
      metadata: normalizeSourceMetadata(preview.metadata),
      artifacts: Array.isArray(preview.artifacts) ? preview.artifacts.map(toRecord) : [],
      updatedAt: asNonEmptyString(preview.updatedAt),
    },
    outputs: outputs.map(function (entry) {
      return {
        id: entry.id,
        path: entry.path,
        fileName: entry.fileName,
        kind: entry.kind,
        label: entry.label,
        recipeSignature: entry.recipeSignature,
        createdAt: entry.createdAt,
        metadata: normalizeSourceMetadata(entry.metadata),
        artifacts: Array.isArray(entry.artifacts) ? entry.artifacts.map(toRecord) : [],
      };
    }),
  };
}

function buildProfileManifest(project) {
  const profile = toRecord(project.profile);

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: project.id,
    updatedAt: project.updatedAt,
    targetAssetMode: asNonEmptyString(profile.targetAssetMode) || "source",
    targetOutputId: asNonEmptyString(profile.targetOutputId),
    targetAssetSignature: asNonEmptyString(profile.targetAssetSignature),
    depth: asNonEmptyString(profile.depth) || "balanced",
    sensitivity: asNumber(profile.sensitivity),
    frameSampleDensity: asNonEmptyString(profile.frameSampleDensity) || "balanced",
    transcriptSampleSeconds: asNumber(profile.transcriptSampleSeconds),
    activePresetId: asNonEmptyString(profile.activePresetId),
    artifactPreferences: clone(toRecord(profile.artifactPreferences)),
    preflight: clone(toRecord(profile.preflight)),
    signals: Array.isArray(profile.signals) ? profile.signals.map(normalizeProfileSignal) : [],
    artifacts: Array.isArray(profile.artifacts) ? profile.artifacts.map(normalizeProfileArtifact) : [],
  };
}

function buildProcessManifest(project) {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: project.id,
    updatedAt: project.updatedAt,
    process: normalizeProcessState(project.process),
  };
}

function buildReportManifest(project) {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: project.id,
    updatedAt: project.updatedAt,
    report: normalizeReportState(project.report),
  };
}

function buildSourceTargetSignature(project) {
  const source = toRecord(project.source);
  const metadata = normalizeSourceMetadata(source.metadata);

  return JSON.stringify({
    mode: "source",
    kind: asNonEmptyString(source.kind) || "video",
    path: asNonEmptyString(source.storedPath),
    fileName: asNonEmptyString(source.storedFileName),
    mimeType: asNonEmptyString(source.mimeType),
    durationSeconds: asNumber(toRecord(metadata).durationSeconds),
    sizeBytes: asNumber(toRecord(metadata).sizeBytes),
    updatedAt: asNonEmptyString(project.updatedAt),
  });
}

function buildDerivedTargetSignature(output) {
  const entry = normalizeEditOutput(output);
  const metadata = normalizeSourceMetadata(entry.metadata);

  return JSON.stringify({
    mode: "derived",
    outputId: entry.id,
    path: asNonEmptyString(entry.path),
    fileName: asNonEmptyString(entry.fileName),
    mimeType: asNonEmptyString(entry.mimeType),
    recipeSignature: asNonEmptyString(entry.recipeSignature),
    durationSeconds: asNumber(toRecord(metadata).durationSeconds),
    sizeBytes: asNumber(toRecord(metadata).sizeBytes),
    createdAt: asNonEmptyString(entry.createdAt),
  });
}

function findEditOutputById(project, outputId) {
  const targetId = asNonEmptyString(outputId);
  if (targetId === null) {
    return null;
  }

  return (
    (Array.isArray(toRecord(project.edit).outputs) ? project.edit.outputs : []).find(function (entry) {
      return asNonEmptyString(toRecord(entry).id) === targetId;
    }) || null
  );
}

function resolveProfileTarget(project) {
  const profile = toRecord(project.profile);
  const source = toRecord(project.source);
  const requestedMode = asNonEmptyString(profile.targetAssetMode) === "derived" ? "derived" : "source";
  const sourcePath = asNonEmptyString(source.storedPath);
  const sourceFileName = asNonEmptyString(source.storedFileName);
  const sourceMetadata = normalizeSourceMetadata(source.metadata);
  const sourceTarget = {
    requestedMode: requestedMode,
    mode: "source",
    outputId: null,
    path: sourcePath,
    fileName: sourceFileName,
    mimeType: asNonEmptyString(source.mimeType),
    metadata: sourceMetadata,
    signature: sourcePath !== null ? buildSourceTargetSignature(project) : null,
    label: sourceFileName || project.name,
    usingFallback: false,
    reason: null,
  };

  if (requestedMode !== "derived") {
    return sourceTarget;
  }

  const outputId = asNonEmptyString(profile.targetOutputId);
  const pinnedOutput = findEditOutputById(project, outputId);
  if (pinnedOutput !== null && asNonEmptyString(toRecord(pinnedOutput).path) !== null) {
    const output = normalizeEditOutput(pinnedOutput);
    return {
      requestedMode: requestedMode,
      mode: "derived",
      outputId: output.id,
      path: output.path,
      fileName: output.fileName,
      mimeType: output.mimeType,
      metadata: normalizeSourceMetadata(output.metadata),
      signature: buildDerivedTargetSignature(output),
      label: output.label || output.fileName || output.id,
      usingFallback: false,
      reason: null,
    };
  }

  return {
    ...sourceTarget,
    requestedMode: requestedMode,
    outputId: outputId,
    usingFallback: true,
    reason:
      outputId === null
        ? "Choose a derived output to keep the profile target pinned."
        : "Pinned derived output is unavailable. Falling back to the saved source.",
  };
}

function getProfileDepthConfig(runtime, depthId) {
  const depthModes = toRecord(toRecord(runtime.profileCapabilities).depthModes);
  return toRecord(depthModes[asNonEmptyString(depthId) || "balanced"]);
}

function getProfileFrameDensityRuntimeConfig(runtime, densityId) {
  return getProfileFrameDensityConfig(runtime.profileCapabilities, densityId);
}

function getCurrentRuntimePlatformKey(runtime) {
  const toolMap = toRecord(toRecord(runtime.toolState).tools);
  const preferredToolIds = ["whisper.cpp", "ffmpeg", "yt-dlp"];

  for (let index = 0; index < preferredToolIds.length; index += 1) {
    const toolId = preferredToolIds[index];
    const platformKey = asNonEmptyString(toRecord(toRecord(toolMap[toolId]).details).platformKey);
    if (platformKey !== null) {
      return platformKey;
    }
  }

  return null;
}

function evaluateProfileModelCompatibility(runtime, descriptor, whisperSummary) {
  const runtimeCompatibility = toRecord(descriptor.runtimeCompatibility);
  const supportedPlatforms = Array.isArray(runtimeCompatibility.platforms)
    ? runtimeCompatibility.platforms.map(function (entry) {
        return String(entry);
      })
    : [];
  const runtimePlatformKey = getCurrentRuntimePlatformKey(runtime);
  const requiresBinarySupport = runtimeCompatibility.requiresBinarySupport === true;
  let runtimeCompatible = true;
  let compatibilityReason = null;

  if (supportedPlatforms.length > 0) {
    if (runtimePlatformKey === null) {
      runtimeCompatible = false;
      compatibilityReason = "Runtime platform could not be resolved yet.";
    } else if (supportedPlatforms.includes(runtimePlatformKey) === false) {
      runtimeCompatible = false;
      compatibilityReason = `This model is not declared for ${runtimePlatformKey}.`;
    }
  }

  if (runtimeCompatible && requiresBinarySupport && whisperSummary.platformSupported !== true) {
    runtimeCompatible = false;
    compatibilityReason = "Whisper.cpp is unavailable on this runtime platform.";
  }

  return {
    runtimePlatformKey: runtimePlatformKey,
    supportedPlatforms: supportedPlatforms,
    cleanupPolicy: toRecord(descriptor.cleanupPolicy),
    runtimeCompatible: runtimeCompatible,
    compatibilityReason: compatibilityReason,
  };
}

function getEnabledProfileLaneIds(runtime, project) {
  const sourceKind = asNonEmptyString(toRecord(project.source).kind) || "video";
  const compatibleLaneIds = getCompatibleProfileLaneIds(runtime.profilePresets, sourceKind);
  const laneSelection = toRecord(toRecord(project.profile).laneSelection);

  return compatibleLaneIds.filter(function (laneId) {
    return laneSelection[laneId] === true;
  });
}

function buildProfileToolSummary(runtime, toolId, supportLevel) {
  const tool = toRecord(toRecord(runtime.toolState).tools)[toolId];
  const manifest = getToolManifest(runtime, toolId);
  const details = toRecord(toRecord(tool).details);
  const displayName = asNonEmptyString(toRecord(manifest).displayName) || toolId;
  const platformSupported = details.platformSupported !== false;
  const installed = toRecord(tool).installed === true;

  return {
    toolId: toolId,
    displayName: displayName,
    supportLevel: supportLevel || "unsupported",
    installed: installed,
    busy: toRecord(tool).busy === true,
    version: asNonEmptyString(tool.version),
    binaryPath: asNonEmptyString(tool.binaryPath),
    ready: supportLevel === "unsupported" ? false : platformSupported && installed,
    platformSupported: platformSupported,
    lastError:
      asNonEmptyString(tool.lastError) ||
      (platformSupported === false ? asNonEmptyString(details.supportError) : null),
  };
}

function buildProfileModelSummary(runtime, project) {
  const sourceKind = asNonEmptyString(toRecord(project.source).kind) || "video";
  const selectedModelId = asNonEmptyString(toRecord(project.profile).modelId);
  const whisperManifest = getToolManifest(runtime, "whisper.cpp");
  const whisperSupport = getStageSupport(whisperManifest, "profile");
  const whisperSummary = buildProfileToolSummary(runtime, "whisper.cpp", whisperSupport);
  const storedModels = toRecord(toRecord(runtime.profileModelState).models);

  return Object.keys(getProfileModelDescriptorMap(runtime))
    .filter(function (modelId) {
      const descriptor = getProfileModelDescriptor(runtime, modelId);
      const mediaKinds = Array.isArray(descriptor.mediaKinds) ? descriptor.mediaKinds : [];
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    })
    .map(function (modelId) {
      const descriptor = getProfileModelDescriptor(runtime, modelId);
      const stored = toRecord(storedModels[modelId]);
      const expectedBytes = asNumber(descriptor.expectedBytes);
      const sizeBytes = asNumber(stored.sizeBytes);
      const checksumValid = stored.installed === true && stored.checksumValid === true;
      const compatibility = evaluateProfileModelCompatibility(runtime, descriptor, whisperSummary);
      return {
        modelId: modelId,
        labelKey: asNonEmptyString(descriptor.labelKey),
        summaryKey: asNonEmptyString(descriptor.summaryKey),
        language: asNonEmptyString(descriptor.language) || "en",
        quantization: asNonEmptyString(descriptor.quantization) || "f16",
        fileName: asNonEmptyString(descriptor.fileName),
        expectedBytes: expectedBytes,
        expectedSha1: asNonEmptyString(descriptor.expectedSha1),
        sizeBytes: sizeBytes,
        installed: stored.installed === true,
        selected: modelId === selectedModelId,
        checksumValid: checksumValid,
        checksumSha1: asNonEmptyString(stored.checksumSha1),
        lastVerifiedAt: asNonEmptyString(stored.lastVerifiedAt),
        busy: stored.busy === true,
        path: asNonEmptyString(stored.path),
        lastError: asNonEmptyString(stored.lastError),
        binarySupported: whisperSummary.platformSupported,
        binaryReady: whisperSummary.ready,
        runtimePlatformKey: compatibility.runtimePlatformKey,
        supportedPlatforms: compatibility.supportedPlatforms,
        cleanupPolicy: compatibility.cleanupPolicy,
        runtimeCompatible: compatibility.runtimeCompatible,
        compatibilityReason: compatibility.compatibilityReason,
        ready: whisperSummary.ready && checksumValid && compatibility.runtimeCompatible,
      };
    });
}

function buildProfileReadiness(runtime, project) {
  const sourceKind = asNonEmptyString(toRecord(project.source).kind) || "video";
  const profile = toRecord(project.profile);
  const enabledLaneIds = getCompatibleProfileLaneIds(runtime.profilePresets, sourceKind).filter(function (
    laneId
  ) {
    return toRecord(profile.laneSelection)[laneId] === true;
  });
  const target = resolveProfileTarget(project);
  const laneMap = getProfileLaneMap(runtime.profilePresets);
  const requiredToolIds = [];
  const optionalToolIds = [];
  const blockers = [];
  const warnings = [];
  const requiredToolMap = {};
  const optionalToolMap = {};
  const modelSummaries = buildProfileModelSummary(runtime, project);
  const selectedModel =
    modelSummaries.find(function (entry) {
      return entry.selected === true;
    }) || null;

  if (target.path === null) {
    blockers.push("Prepare a source or derived output before building the profile.");
  }
  if (target.usingFallback === true && target.reason) {
    warnings.push(target.reason);
  }

  const laneSummaries = enabledLaneIds.map(function (laneId) {
    const lane = toRecord(laneMap[laneId]);
    const laneRequired = Array.isArray(lane.requiredTools) ? lane.requiredTools : [];
    const laneOptional = Array.isArray(lane.optionalTools) ? lane.optionalTools : [];
    const laneWarnings = [];

    laneRequired.forEach(function (toolId) {
      if (requiredToolIds.includes(toolId) === false) {
        requiredToolIds.push(toolId);
      }
      if (!requiredToolMap[toolId]) {
        requiredToolMap[toolId] = buildProfileToolSummary(
          runtime,
          toolId,
          getStageSupport(getToolManifest(runtime, toolId), "profile")
        );
      }
    });

    laneOptional.forEach(function (toolId) {
      if (optionalToolIds.includes(toolId) === false) {
        optionalToolIds.push(toolId);
      }
      if (!optionalToolMap[toolId]) {
        optionalToolMap[toolId] = buildProfileToolSummary(
          runtime,
          toolId,
          getStageSupport(getToolManifest(runtime, toolId), "profile")
        );
      }
    });

    const missingRequired = laneRequired.filter(function (toolId) {
      return toRecord(requiredToolMap[toolId]).ready !== true;
    });

    if (missingRequired.length > 0) {
      blockers.push(
        `${asNonEmptyString(lane.labelKey) || laneId} requires ${missingRequired
          .map(function (toolId) {
            return asNonEmptyString(toRecord(requiredToolMap[toolId]).displayName) || toolId;
          })
          .join(", ")}.`
      );
    }

    if (laneOptional.includes("whisper.cpp")) {
      const whisperSummary = toRecord(optionalToolMap["whisper.cpp"]);
      if (whisperSummary.ready !== true) {
        laneWarnings.push("Speech transcript sampling is unavailable until Whisper.cpp is ready.");
      } else if (selectedModel && selectedModel.runtimeCompatible === false && selectedModel.compatibilityReason) {
        laneWarnings.push(selectedModel.compatibilityReason);
      } else if (selectedModel === null || selectedModel.ready !== true) {
        laneWarnings.push("Install and verify a Whisper model to unlock transcript sampling.");
      }
    }

    warnings.push.apply(warnings, laneWarnings);

    return {
      laneId: laneId,
      labelKey: asNonEmptyString(lane.labelKey),
      summaryKey: asNonEmptyString(lane.summaryKey),
      supportLevel: missingRequired.length > 0 ? "blocked" : laneWarnings.length > 0 ? "degraded" : "ready",
      requiredTools: laneRequired,
      optionalTools: laneOptional,
      artifactKinds: Array.isArray(lane.artifactKinds) ? lane.artifactKinds.slice() : [],
      warnings: laneWarnings,
    };
  });

  return {
    stageReady: blockers.length === 0,
    target: {
      requestedMode: target.requestedMode,
      mode: target.mode,
      outputId: target.outputId,
      label: target.label,
      fileName: target.fileName,
      path: target.path,
      mimeType: target.mimeType,
      signature: target.signature,
      usingFallback: target.usingFallback,
      reason: target.reason,
      metadata: clone(target.metadata || {}),
    },
    enabledLaneIds: enabledLaneIds,
    enabledLaneCount: enabledLaneIds.length,
    requiredTools: requiredToolIds.map(function (toolId) {
      return requiredToolMap[toolId];
    }),
    optionalTools: optionalToolIds.map(function (toolId) {
      return optionalToolMap[toolId];
    }),
    models: modelSummaries,
    lanes: laneSummaries,
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
  };
}

function buildProfileEstimate(runtime, project, readiness) {
  const profile = toRecord(project.profile);
  const sourceKind = asNonEmptyString(toRecord(project.source).kind) || "video";
  const depthConfig = getProfileDepthConfig(runtime, profile.depth);
  const frameDensityConfig = getProfileFrameDensityRuntimeConfig(runtime, profile.frameSampleDensity);
  const enabledLaneIds = Array.isArray(toRecord(readiness).enabledLaneIds)
    ? readiness.enabledLaneIds
    : getEnabledProfileLaneIds(runtime, project);
  const laneMap = getProfileLaneMap(runtime.profilePresets);
  const artifactBudget = Math.max(1, Math.round(asNumber(depthConfig.artifactBudget) || 3));
  const targetMetadata = normalizeSourceMetadata(toRecord(toRecord(readiness).target).metadata);
  const durationSeconds = asNumber(toRecord(targetMetadata).durationSeconds);
  const sampleWindowSeconds = Math.min(
    durationSeconds || Number.MAX_SAFE_INTEGER,
    Math.max(12, Math.round(asNumber(depthConfig.sampleWindowSeconds) || 60))
  );
  const transcriptSampleSeconds = clampProfileTranscriptSampleSeconds(
    runtime.profileCapabilities,
    profile.transcriptSampleSeconds
  );
  const artifactPreferences = normalizeProfileArtifactPreferences(
    toRecord(profile.artifactPreferences),
    runtime.profileCapabilities,
    sourceKind
  );
  const artifactKinds = [];

  enabledLaneIds.forEach(function (laneId) {
    const lane = toRecord(laneMap[laneId]);
    (Array.isArray(lane.artifactKinds) ? lane.artifactKinds : []).forEach(function (artifactKind) {
      if (artifactPreferences[artifactKind] !== true) {
        return;
      }
      if (artifactKinds.includes(artifactKind) === false) {
        artifactKinds.push(artifactKind);
      }
    });
  });

  let runtimeSeconds =
    (sourceKind === "video" ? 18 : sourceKind === "audio" ? 14 : 10) +
    enabledLaneIds.length * 8 +
    (asNonEmptyString(profile.depth) === "deep" ? 28 : asNonEmptyString(profile.depth) === "quick" ? 8 : 16);

  runtimeSeconds += Math.max(0, Math.round(asNumber(frameDensityConfig.tileCount) || 4) - 2) * 2;

  if (enabledLaneIds.includes("speech-overlay")) {
    const selectedModel =
      (Array.isArray(toRecord(readiness).models) ? readiness.models : []).find(function (entry) {
        return toRecord(entry).selected === true;
      }) || null;
    runtimeSeconds += artifactPreferences.transcript === true
      ? selectedModel && selectedModel.ready === true
        ? Math.max(8, Math.round(transcriptSampleSeconds / 3))
        : 5
      : 0;
  }

  return {
    runtimeSeconds: runtimeSeconds,
    artifactCount: Math.min(artifactBudget, artifactKinds.length),
    sampleWindowSeconds: Number.isFinite(sampleWindowSeconds) ? sampleWindowSeconds : null,
  };
}

function syncProjectProfileProjection(runtime, project) {
  const defaults = createDefaultProfileState(
    runtime.profilePresets,
    runtime.profileModels,
    runtime.profileCapabilities,
    asNonEmptyString(toRecord(project.source).kind) || "video"
  );
  const profile = normalizeProfileState(
    project.profile,
    runtime.profilePresets,
    runtime.profileModels,
    runtime.profileCapabilities,
    asNonEmptyString(toRecord(project.source).kind) || "video"
  );
  const compatibleLaneIds = getCompatibleProfileLaneIds(
    runtime.profilePresets,
    asNonEmptyString(toRecord(project.source).kind) || "video"
  );
  const laneSelection = {};

  compatibleLaneIds.forEach(function (laneId) {
    laneSelection[laneId] = toRecord(profile.laneSelection)[laneId] === true;
  });
  if (compatibleLaneIds.length > 0 && compatibleLaneIds.every(function (laneId) {
    return laneSelection[laneId] !== true;
  })) {
    compatibleLaneIds.forEach(function (laneId) {
      laneSelection[laneId] = toRecord(defaults.laneSelection)[laneId] === true;
    });
  }

  const requestedTargetMode = asNonEmptyString(profile.targetAssetMode) === "derived" ? "derived" : "source";
  const requestedModelId = asNonEmptyString(profile.modelId);
  const requestedModelDescriptor = toRecord(getProfileModelDescriptorMap(runtime)[requestedModelId]);
  const requestedModelKinds = Array.isArray(requestedModelDescriptor.mediaKinds)
    ? requestedModelDescriptor.mediaKinds
    : [];
  const fallbackModelId = getDefaultProfileModelId(runtime.profileModels, project.source.kind);
  const resolvedProfile = {
    ...profile,
    activePresetId:
      findProfilePreset(runtime.profilePresets, project.source.kind, profile.activePresetId) !== null
        ? profile.activePresetId
        : defaults.activePresetId,
    targetAssetMode: requestedTargetMode,
    targetOutputId: requestedTargetMode === "derived" ? asNonEmptyString(profile.targetOutputId) : null,
    modelId:
      requestedModelId &&
      (requestedModelKinds.length === 0 || requestedModelKinds.includes(project.source.kind))
        ? requestedModelId
        : fallbackModelId,
    laneSelection: laneSelection,
  };

  const target = resolveProfileTarget({
    ...project,
    profile: resolvedProfile,
  });
  const existingPreflight = {
    ...createEmptyProfilePreflight(),
    ...toRecord(resolvedProfile.preflight),
  };
  const previousTargetSummary = toRecord(existingPreflight.targetSummary);
  const previousSignature = asNonEmptyString(previousTargetSummary.signature);
  const nextSignature = asNonEmptyString(target.signature);
  const signatureChanged = previousSignature !== nextSignature;

  if (existingPreflight.status !== "running") {
    existingPreflight.targetSummary =
      nextSignature === null
        ? null
        : {
            requestedMode: target.requestedMode,
            mode: target.mode,
            outputId: target.outputId,
            signature: nextSignature,
            label: target.label,
            fileName: target.fileName,
            mimeType: target.mimeType,
            path: target.path,
          };
    if (
      signatureChanged === true ||
      (target.usingFallback === true && asNonEmptyString(existingPreflight.ranAt) !== null)
    ) {
      existingPreflight.status = asNonEmptyString(existingPreflight.ranAt) !== null ? "stale" : "idle";
      existingPreflight.jobId = null;
      existingPreflight.requestId = null;
      existingPreflight.error = null;
      existingPreflight.warnings = Array.from(
        new Set(
          (Array.isArray(existingPreflight.warnings) ? existingPreflight.warnings : []).concat(
            target.reason ? [target.reason] : []
          )
        )
      );
    }
  }

  resolvedProfile.targetAssetSignature = nextSignature;
  resolvedProfile.preflight = existingPreflight;
  resolvedProfile.readiness = buildProfileReadiness(runtime, {
    ...project,
    profile: resolvedProfile,
  });
  resolvedProfile.estimate = buildProfileEstimate(
    runtime,
    {
      ...project,
      profile: resolvedProfile,
    },
    resolvedProfile.readiness
  );
  resolvedProfile.dirty =
    resolvedProfile.dirty === true ||
    signatureChanged === true ||
    target.usingFallback === true ||
    asNonEmptyString(toRecord(resolvedProfile.preflight).status) !== "ready";

  project.profile = resolvedProfile;
  return project;
}

function syncProjectFeatureProjections(runtime, project) {
  syncProjectProfileProjection(runtime, project);
  syncProjectAudioAnalysisProjection(runtime, project);
  syncProjectSubtitleAnalysisProjection(runtime, project);
  return project;
}

function buildProjectedProjects(runtime) {
  return runtime.projects.map(function (project) {
    const nextProject = clone(project);
    syncProjectFeatureProjections(runtime, nextProject);
    return nextProject;
  });
}

function serializeJobs(runtime) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      const job = runtime.jobs[jobId];
      if (!job) {
        return null;
      }

      return {
        jobId: jobId,
        requestId: job.requestId,
        action: job.action,
        projectId: job.projectId || null,
        toolId: job.toolId || null,
        featureStage: job.featureStage || null,
        stage: job.stage || "queued",
        percent: typeof job.percent === "number" ? job.percent : null,
        message: job.message || null,
      };
    })
    .filter(Boolean);
}

function buildToolRegistry(runtime) {
  return getRuntimeToolIds(runtime).map(function (toolId) {
    const toolManifest = getToolManifest(runtime, toolId);
    const systemCommand = toRecord(toolManifest.systemCommand);
    const stageSupport = {};

    MEDIA_STAGES.forEach(function (stageId) {
      const supportLevel = getStageSupport(toolManifest, stageId);
      if (supportLevel !== "unsupported") {
        stageSupport[stageId] = supportLevel;
      }
    });

    return {
      toolId: toolId,
      displayName: asNonEmptyString(toolManifest.displayName) || toolId,
      installDirName: asNonEmptyString(toolManifest.installDirName) || toolId,
      availability: asNonEmptyString(toolManifest.availability) || "installable",
      plannedReason: asNonEmptyString(toolManifest.plannedReason),
      commandName: asNonEmptyString(systemCommand.executableName),
      setupHint: asNonEmptyString(systemCommand.setupHint),
      stageSupport: stageSupport,
    };
  });
}

function buildMediaSnapshot(runtime, featureId) {
  const projectedProjects = buildProjectedProjects(runtime);
  const activeProject =
    projectedProjects.find(function (project) {
      return project.id === runtime.activeProjectId;
    }) || null;

  return {
    roomId: ROOM_ID,
    featureId: featureId || FEATURE_ID,
    ready: runtime.hydrated,
    stages: MEDIA_STAGES.slice(),
    sourcePresets: clone(runtime.sourcePresets || {}),
    ytDlpForm: clone(runtime.ytDlpForm || {}),
    editPresets: clone(runtime.editPresets || {}),
    editCapabilities: clone(runtime.editCapabilities || {}),
    profilePresets: clone(runtime.profilePresets || {}),
    profileCapabilities: clone(runtime.profileCapabilities || {}),
    profileModels: clone(runtime.profileModels || {}),
    subtitleSourcePresets: clone(runtime.subtitleSourcePresets || {}),
    subtitleYoutubeForm: clone(runtime.subtitleYoutubeForm || {}),
    subtitleEditPresets: clone(runtime.subtitleEditPresets || {}),
    subtitleAnalysisCatalog: clone(runtime.subtitleAnalysisCatalog || {}),
    subtitleAnalysisCapabilities: clone(runtime.subtitleAnalysisCapabilities || {}),
    subtitleAnalysisProviders: clone(runtime.subtitleAnalysisProviders || {}),
    audioAnalysisCatalog: clone(runtime.audioAnalysisCatalog || {}),
    audioAnalysisCapabilities: clone(runtime.audioAnalysisCapabilities || {}),
    audioAnalysisPresets: clone(runtime.audioAnalysisPresets || {}),
    audioAnalysisProviders: clone(runtime.audioAnalysisProviders || {}),
    toolRegistry: buildToolRegistry(runtime),
    profileModelState: clone(runtime.profileModelState || {}),
    projects: projectedProjects.map(serializeProjectSummary),
    activeProjectId: runtime.activeProjectId,
    activeProject: serializeProject(activeProject, runtime),
    toolState: clone(runtime.toolState),
    jobs: serializeJobs(runtime),
  };
}

function buildSourceSnapshot(runtime) {
  return buildMediaSnapshot(runtime, FEATURE_ID);
}

function notifyRoom(api, type, payload) {
  api.notifyRoom(type, payload || {});
}

function isSourceCompatibleAction(action) {
  const actionId = asNonEmptyString(action);
  if (actionId === null) {
    return true;
  }
  return (
    actionId === "refresh" ||
    actionId === "tools-refresh" ||
    actionId.startsWith("source-") ||
    actionId.startsWith("subtitle-source-") ||
    actionId.startsWith("project-") ||
    actionId.startsWith("tool-")
  );
}

function pushMediaState(api, runtime, requestId, action) {
  const featureId = getFeatureIdFromContext(loadContext(api));
  const payload = {
    requestId: requestId || null,
    action: action || null,
    snapshot: buildMediaSnapshot(runtime, featureId),
  };

  notifyRoom(api, "media-state", payload);
  if (isSourceCompatibleAction(action)) {
    notifyRoom(api, "source-state", payload);
  }
}

function pushSourceState(api, runtime, requestId, action) {
  pushMediaState(api, runtime, requestId, action);
}

function pushActionResult(api, payload) {
  notifyRoom(api, "media-action-result", payload);
  if (isSourceCompatibleAction(payload && payload.action)) {
    notifyRoom(api, "source-action-result", payload);
  }
}

function pushJobState(api, payload) {
  notifyRoom(api, "media-job", payload);
  if (isSourceCompatibleAction(payload && payload.action)) {
    notifyRoom(api, "source-job", payload);
  }
}

async function loadRuntimeConfigs(api, runtime) {
  const baseDir = `${api.room.installedDir}/tools`;
  const sourcePresets = await readJsonFile(`${baseDir}/source-presets.json`);
  const projectSchema = await readJsonFile(`${baseDir}/project-schema.json`);
  const ytDlpForm = await readJsonFile(`${baseDir}/yt-dlp.form.json`);
  const toolchainManifest = await readJsonFile(`${baseDir}/toolchain.manifest.json`);
  const editPresets = await readJsonFile(`${baseDir}/edit-presets.json`);
  const editCapabilities = await readJsonFile(`${baseDir}/edit-capabilities.json`);
  const profilePresets = await readJsonFile(`${baseDir}/profile-presets.json`);
  const profileCapabilities = await readJsonFile(`${baseDir}/profile-capabilities.json`);
  const profileModels = await readJsonFile(`${baseDir}/profile-models.json`);
  const subtitleSourcePresets = await readJsonFile(`${baseDir}/subtitle-source-presets.json`);
  const subtitleYoutubeForm = await readJsonFile(`${baseDir}/subtitle-youtube.form.json`);
  const subtitleEditPresets = await readJsonFile(`${baseDir}/subtitle-edit-presets.json`);
  const subtitleAnalysisCatalog = await readJsonFile(`${baseDir}/subtitle-analysis-catalog.json`);
  const subtitleAnalysisCapabilities = await readJsonFile(
    `${baseDir}/subtitle-analysis-capabilities.json`
  );
  const subtitleAnalysisProviders = await readJsonFile(`${baseDir}/subtitle-analysis-providers.json`);
  const audioAnalysisCatalog = await readJsonFile(`${baseDir}/audio-analysis-catalog.json`);
  const audioAnalysisCapabilities = await readJsonFile(`${baseDir}/audio-analysis-capabilities.json`);
  const audioAnalysisPresets = await readJsonFile(`${baseDir}/audio-analysis-presets.json`);
  const audioAnalysisProviders = await readJsonFile(`${baseDir}/audio-analysis-providers.json`);

  runtime.packageToolsDir = baseDir;
  runtime.toolchainManifest = toolchainManifest || {};
  runtime.sourcePresets = sourcePresets || {};
  runtime.projectSchema = projectSchema || {};
  runtime.ytDlpForm = ytDlpForm || {};
  runtime.editPresets = editPresets || {};
  runtime.editCapabilities = editCapabilities || {};
  runtime.profilePresets = profilePresets || {};
  runtime.profileCapabilities = profileCapabilities || {};
  runtime.profileModels = profileModels || {};
  runtime.subtitleSourcePresets = subtitleSourcePresets || {};
  runtime.subtitleYoutubeForm = subtitleYoutubeForm || {};
  runtime.subtitleEditPresets = subtitleEditPresets || {};
  runtime.subtitleAnalysisCatalog = subtitleAnalysisCatalog || {};
  runtime.subtitleAnalysisCapabilities = subtitleAnalysisCapabilities || {};
  runtime.subtitleAnalysisProviders = subtitleAnalysisProviders || {};
  runtime.audioAnalysisCatalog = audioAnalysisCatalog || {};
  runtime.audioAnalysisCapabilities = audioAnalysisCapabilities || {};
  runtime.audioAnalysisPresets = audioAnalysisPresets || {};
  runtime.audioAnalysisProviders = audioAnalysisProviders || {};
}

async function loadProjects(runtime) {
  const entries = await listDirectory(runtime.paths.projectsDir);
  const projects = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || entry.isDirectory !== true) {
      continue;
    }

    const project = await readJsonFile(`${entry.path}/project.json`);
    if (project) {
      const normalizedProject = normalizeProject(
        project,
        runtime.sourcePresets,
        runtime.editPresets,
        runtime.profilePresets,
        runtime.profileModels,
        runtime.profileCapabilities,
        runtime
      );
      syncProjectFeatureProjections(runtime, normalizedProject);
      projects.push(normalizedProject);
    }
  }

  projects.sort(function (left, right) {
    return String(right.updatedAt).localeCompare(String(left.updatedAt));
  });

  runtime.projects = projects;
}

async function saveProject(runtime, project) {
  await writeJsonFile(getProjectMetaPath(runtime, project), project);
  await writeJsonFile(getProjectEditManifestPath(runtime, project), buildEditManifest(project));
  await writeJsonFile(getProjectProfileManifestPath(runtime, project), buildProfileManifest(project));
  await writeJsonFile(getProjectProcessManifestPath(runtime, project), buildProcessManifest(project));
  await writeJsonFile(getProjectReportManifestPath(runtime, project), buildReportManifest(project));
}

async function persistToolState(runtime) {
  if (!runtime.paths || !runtime.paths.toolStatePath) {
    return;
  }
  runtime.toolState.updatedAt = new Date().toISOString();
  await writeJsonFile(runtime.paths.toolStatePath, runtime.toolState);
}

async function persistProfileModelState(runtime) {
  if (!runtime.paths) {
    return;
  }

  runtime.profileModelState.updatedAt = new Date().toISOString();
  await writeJsonFile(getProfileModelStatePath(runtime), runtime.profileModelState);
}

async function loadToolState(runtime) {
  const stored = await readJsonFile(runtime.paths.toolStatePath);
  const nextState = createDefaultToolState(getRuntimeToolIds(runtime));
  const tools = toRecord(toRecord(stored).tools);

  getRuntimeToolIds(runtime).forEach(function (toolId) {
    nextState.tools[toolId] = {
      ...createDefaultToolEntry(toolId),
      ...toRecord(tools[toolId]),
      toolId: toolId,
      companionPaths: toRecord(toRecord(tools[toolId]).companionPaths),
    };
  });

  nextState.updatedAt = asNonEmptyString(toRecord(stored).updatedAt);
  runtime.toolState = nextState;
}

async function loadProfileModelState(runtime) {
  const stored = await readJsonFile(getProfileModelStatePath(runtime));
  const models = toRecord(toRecord(stored).models);
  const nextState = {
    schemaVersion: 1,
    updatedAt: asNonEmptyString(toRecord(stored).updatedAt),
    models: {},
  };

  Object.keys(toRecord(toRecord(runtime.profileModels).models)).forEach(function (modelId) {
    nextState.models[modelId] = {
      ...createDefaultProfileModelEntry(modelId),
      ...toRecord(models[modelId]),
      modelId: modelId,
    };
  });

  runtime.profileModelState = nextState;
}

function getProfileModelDescriptorMap(runtime) {
  return toRecord(toRecord(runtime.profileModels).models);
}

function getProfileModelDescriptor(runtime, modelId) {
  return toRecord(getProfileModelDescriptorMap(runtime)[modelId]);
}

async function refreshProfileModelState(runtime) {
  const modelDir = getProfileModelsDir(runtime);
  try {
    await callRoomTools({
      operation: "ensure-dir",
      roomId: ROOM_ID,
      targetPath: modelDir,
    });
  } catch (_error) {
    await ensureDirectoryMarker(modelDir);
  }

  const directoryEntries = await listDirectory(modelDir);
  const storedModels = toRecord(runtime.profileModelState.models);
  const nextState = {
    schemaVersion: 1,
    updatedAt: runtime.profileModelState.updatedAt,
    models: {},
  };

  Object.keys(getProfileModelDescriptorMap(runtime)).forEach(function (modelId) {
    const descriptor = getProfileModelDescriptor(runtime, modelId);
    const fileName = asNonEmptyString(descriptor.fileName);
    const current = toRecord(storedModels[modelId]);
    const fileEntry =
      fileName === null
        ? null
        : directoryEntries.find(function (entry) {
            return entry && entry.isDirectory !== true && String(entry.name || "") === fileName;
          }) || null;

    nextState.models[modelId] = {
      ...createDefaultProfileModelEntry(modelId),
      ...current,
      modelId: modelId,
      fileName: fileName,
      path: fileEntry ? fileEntry.path : fileName ? `${modelDir}/${fileName}` : null,
      expectedBytes: asNumber(descriptor.expectedBytes),
      expectedSha1: asNonEmptyString(descriptor.expectedSha1),
      installed: Boolean(fileEntry),
      busy: false,
      lastError: fileEntry ? asNonEmptyString(current.lastError) : null,
      checksumValid: fileEntry ? current.checksumValid === true : false,
      checksumSha1: fileEntry ? asNonEmptyString(current.checksumSha1) : null,
      lastVerifiedAt: fileEntry ? asNonEmptyString(current.lastVerifiedAt) : null,
      sizeBytes: fileEntry ? asNumber(current.sizeBytes) : null,
    };
  });

  runtime.profileModelState = nextState;
  await persistProfileModelState(runtime);
}

async function ensureProjectExists(runtime, featureId) {
  if (runtime.projects.length > 0) {
    if (!findProject(runtime, runtime.activeProjectId)) {
      runtime.activeProjectId = runtime.projects[0].id;
    }
    return;
  }

  const project = createProjectRecord(
    runtime.sourcePresets,
    runtime.editPresets,
    runtime.profilePresets,
    runtime.profileModels,
    runtime.profileCapabilities,
    runtime,
    featureId || FEATURE_ID
  );
  syncProjectFeatureProjections(runtime, project);
  await ensureProjectDirectories(runtime, project, null);
  await saveProject(runtime, project);
  runtime.projects = [project];
  runtime.activeProjectId = project.id;
}

async function refreshToolStatus(runtime, options) {
  const checkUpdates = options && options.checkUpdates === true;

  const toolIds = getRuntimeToolIds(runtime);

  for (let index = 0; index < toolIds.length; index += 1) {
    const toolId = toolIds[index];
    const currentEntry = runtime.toolState.tools[toolId] || createDefaultToolEntry(toolId);
    try {
      const probeResult = await callRoomTools({
        operation: "tool-probe",
        roomId: ROOM_ID,
        toolId: toolId,
      });
      runtime.toolState.tools[toolId] = {
        ...currentEntry,
        ...toRecord(probeResult.tool),
        toolId: toolId,
        busy: false,
        lastError: null,
        lastCheckedAt: new Date().toISOString(),
      };

      if (
        checkUpdates &&
        toRecord(toRecord(runtime.toolState.tools[toolId]).details).platformSupported !== false
      ) {
        const updateResult = await callRoomTools({
          operation: "tool-check-for-updates",
          roomId: ROOM_ID,
          toolId: toolId,
          installedVersion: runtime.toolState.tools[toolId].version,
          installedReleaseTag: runtime.toolState.tools[toolId].releaseTag,
          installedReleaseName: runtime.toolState.tools[toolId].releaseName,
        });

        runtime.toolState.tools[toolId] = {
          ...runtime.toolState.tools[toolId],
          latestVersion: updateResult.update ? updateResult.update.latestVersion : null,
          latestReleaseTag: updateResult.update ? updateResult.update.latestReleaseTag : null,
          latestReleaseName: updateResult.update ? updateResult.update.latestReleaseName : null,
          releaseUrl: updateResult.update ? updateResult.update.releaseUrl : null,
          updateAvailable: updateResult.update ? updateResult.update.updateAvailable === true : false,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.toolState.tools[toolId] = {
        ...currentEntry,
        toolId: toolId,
        installed: false,
        busy: false,
        lastError: message,
        lastCheckedAt: new Date().toISOString(),
        details: {
          ...toRecord(currentEntry.details),
          platformSupported: message.indexOf("does not support") === -1 ? true : false,
          supportError: message,
        },
      };
    }
  }

  await persistToolState(runtime);
}

async function ensureHydrated(api, runtime) {
  if (runtime.hydrated === true) {
    return;
  }

  if (runtime.hydrating) {
    await runtime.hydrating;
    return;
  }

  runtime.hydrating = (async function () {
    const pathResult = await callRoomTools({
      operation: "resolve-paths",
      roomId: ROOM_ID,
    });

    runtime.paths = pathResult.paths;
    await loadRuntimeConfigs(api, runtime);
    await loadToolState(runtime);
    await loadProfileModelState(runtime);
    await loadProjects(runtime);
    await ensureProjectExists(runtime, getFeatureIdFromContext(loadContext(api)));
    await refreshToolStatus(runtime, { checkUpdates: false });
    await refreshProfileModelState(runtime);
    runtime.hydrated = true;
  })();

  try {
    await runtime.hydrating;
  } finally {
    runtime.hydrating = null;
  }
}

function createRequestId() {
  return `lab-source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateProjectInMemory(runtime, nextProject) {
  runtime.projects = runtime.projects.map(function (project) {
    return project.id === nextProject.id ? nextProject : project;
  });
  runtime.projects.sort(function (left, right) {
    return String(right.updatedAt).localeCompare(String(left.updatedAt));
  });
}

async function patchActiveProject(runtime, updater) {
  const activeProject = getActiveProject(runtime);
  if (activeProject === null) {
    throw new Error("Active project is missing.");
  }

  const nextProject = normalizeProject(
    updater(clone(activeProject)),
    runtime.sourcePresets,
    runtime.editPresets,
    runtime.profilePresets,
    runtime.profileModels,
    runtime.profileCapabilities,
    runtime
  );
    syncProjectFeatureProjections(runtime, nextProject);
  updateProjectTimestamps(nextProject);
  await saveProject(runtime, nextProject);
  updateProjectInMemory(runtime, nextProject);
  runtime.activeProjectId = nextProject.id;
  return nextProject;
}

async function patchActiveProjectDrafts(runtime, fields) {
  const patch = toRecord(fields);
  if (Object.keys(patch).length === 0) {
    return getActiveProject(runtime);
  }

  return await patchActiveProject(runtime, function (nextProject) {
    nextProject.source.drafts = {
      ...toRecord(nextProject.source.drafts),
      ...patch,
      youtubeCustom: {
        ...toRecord(toRecord(nextProject.source.drafts).youtubeCustom),
        ...toRecord(patch.youtubeCustom),
      },
    };
    return nextProject;
  });
}

async function refreshActiveProjectMetadata(runtime, requestId) {
  const project = getActiveProject(runtime);
  if (
    project === null ||
    asNonEmptyString(project.source.storedPath) === null ||
    asNonEmptyString(project.source.storedFileName) === null
  ) {
    return null;
  }

  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  if (ffmpegState.installed !== true) {
    return null;
  }

  const currentMetadata = normalizeSourceMetadata(project.source.metadata);
  if (currentMetadata && currentMetadata.extractedBy === "ffprobe") {
    return currentMetadata;
  }

  const validation = validateSourceCandidate(
    runtime,
    project.source.kind,
    project.source.storedFileName,
    project.source.mimeType
  );
  if (validation.valid !== true) {
    return null;
  }

  const metadataResult = await collectStoredSourceMetadata(runtime, project, {
    requestId: requestId,
    storedPath: project.source.storedPath,
    mimeType: validation.mimeType,
  });

  await patchActiveProject(runtime, function (nextProject) {
    if (nextProject.id !== project.id) {
      return nextProject;
    }
    nextProject.source.mimeType = validation.mimeType;
    nextProject.source.metadata = metadataResult.metadata;
    nextProject.source.metadataError = metadataResult.metadataError;
    return nextProject;
  });

  return metadataResult.metadata;
}

async function createProject(runtime, featureId) {
  const project = createProjectRecord(
    runtime.sourcePresets,
    runtime.editPresets,
    runtime.profilePresets,
    runtime.profileModels,
    runtime.profileCapabilities,
    runtime,
    featureId
  );
  syncProjectFeatureProjections(runtime, project);
  await ensureProjectDirectories(runtime, project, null);
  await saveProject(runtime, project);
  runtime.projects.unshift(project);
  runtime.activeProjectId = project.id;
  return project;
}

async function deleteProject(runtime, projectId, requestId, featureId) {
  const project = findProject(runtime, projectId);
  if (project === null || project === undefined) {
    return null;
  }

  await cancelJobsForProject(runtime, projectId, requestId);
  await callRoomTools({
    operation: "delete-path",
    roomId: ROOM_ID,
    requestId: requestId,
    targetPath: getProjectDir(runtime, project),
    recursive: true,
  });
  runtime.projects = runtime.projects.filter(function (entry) {
    return entry.id !== projectId;
  });
  if (runtime.activeProjectId === projectId) {
    runtime.activeProjectId = runtime.projects[0] ? runtime.projects[0].id : null;
  }
  await ensureProjectExists(runtime, featureId);
  return project;
}

function updateProfileModelEntry(runtime, modelId, patch) {
  runtime.profileModelState.models[modelId] = {
    ...createDefaultProfileModelEntry(modelId),
    ...toRecord(toRecord(runtime.profileModelState).models)[modelId],
    ...toRecord(patch),
    modelId: modelId,
  };
  return runtime.profileModelState.models[modelId];
}

function updateProfileModelBusy(runtime, modelId, busy, lastError) {
  return updateProfileModelEntry(runtime, modelId, {
    busy: busy === true,
    lastError: lastError || null,
  });
}

async function verifyProfileModel(runtime, modelId) {
  const descriptor = getProfileModelDescriptor(runtime, modelId);
  const fileName = asNonEmptyString(descriptor.fileName);
  const filePath =
    asNonEmptyString(toRecord(toRecord(runtime.profileModelState).models)[modelId]?.path) ||
    (fileName ? `${getProfileModelsDir(runtime)}/${fileName}` : null);

  if (filePath === null) {
    throw new Error(`Profile model ${modelId} is missing its storage path.`);
  }

  const bytes = await readBinaryFileBytes(filePath);
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`Could not read the profile model file: ${filePath}`);
  }

  const checksumSha1 = await digestSha1(bytes);
  const sizeBytes = bytes.byteLength;
  const expectedSha1 = asNonEmptyString(descriptor.expectedSha1);
  const expectedBytes = asNumber(descriptor.expectedBytes);
  const checksumValid =
    (expectedSha1 === null || expectedSha1 === checksumSha1) &&
    (expectedBytes === null || expectedBytes === sizeBytes);

  const nextEntry = updateProfileModelEntry(runtime, modelId, {
    installed: true,
    fileName: fileName,
    path: filePath,
    sizeBytes: sizeBytes,
    checksumSha1: checksumSha1,
    checksumValid: checksumValid,
    expectedBytes: expectedBytes,
    expectedSha1: expectedSha1,
    lastVerifiedAt: new Date().toISOString(),
    lastError: checksumValid ? null : "Downloaded model failed checksum verification.",
  });

  await persistProfileModelState(runtime);
  if (checksumValid !== true) {
    throw new Error("Downloaded model failed checksum verification.");
  }

  return nextEntry;
}

async function installProfileModel(api, runtime, requestId, modelId) {
  const descriptor = getProfileModelDescriptor(runtime, modelId);
  const downloadUrl = asNonEmptyString(descriptor.downloadUrl);
  const fileName = asNonEmptyString(descriptor.fileName);
  if (downloadUrl === null || fileName === null) {
    throw new Error(`Profile model descriptor is incomplete for ${modelId}.`);
  }

  const whisperSummary = buildProfileToolSummary(
    runtime,
    "whisper.cpp",
    getStageSupport(getToolManifest(runtime, "whisper.cpp"), "profile")
  );
  if (whisperSummary.platformSupported !== true) {
    throw new Error("Whisper.cpp is not supported on this platform.");
  }
  if (whisperSummary.installed !== true) {
    throw new Error("Install Whisper.cpp before downloading speech models.");
  }
  const compatibility = evaluateProfileModelCompatibility(runtime, descriptor, whisperSummary);
  if (compatibility.runtimeCompatible !== true) {
    throw new Error(compatibility.compatibilityReason || "This model is not compatible with the current runtime.");
  }

  const project = getActiveProject(runtime);
  const jobId = `room-profile-model-${modelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const targetPath = `${getProfileModelsDir(runtime)}/${fileName}`;

  await callRoomTools({
    operation: "ensure-dir",
    roomId: ROOM_ID,
    requestId: requestId,
    targetPath: getProfileModelsDir(runtime),
  });

  updateProfileModelBusy(runtime, modelId, true, null);
  await persistProfileModelState(runtime);
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "profile-model-install",
    projectId: project ? project.id : null,
    toolId: "whisper.cpp",
    featureStage: "profile",
  });

  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "profile-model-install",
    projectId: project ? project.id : null,
    toolId: "whisper.cpp",
    featureStage: "profile",
    stage: "queued",
    message: fileName,
  });

  try {
    await callRoomTools({
      operation: "download-file",
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      url: downloadUrl,
      destinationPath: targetPath,
      overwrite: true,
    });

    await refreshProfileModelState(runtime);
    const verifiedModel = await verifyProfileModel(runtime, modelId);
    updateProfileModelBusy(runtime, modelId, false, null);
    await persistProfileModelState(runtime);

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "profile-model-install",
      projectId: project ? project.id : null,
      toolId: "whisper.cpp",
      featureStage: "profile",
      stage: "completed",
      percent: 100,
      message: verifiedModel.fileName || modelId,
    });

    return verifiedModel;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateProfileModelBusy(runtime, modelId, false, message);
    await persistProfileModelState(runtime);
    try {
      await callRoomTools({
        operation: "delete-path",
        roomId: ROOM_ID,
        requestId: requestId,
        targetPath: targetPath,
        recursive: false,
      });
    } catch (_cleanupError) {
      // noop
    }
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "profile-model-install",
      projectId: project ? project.id : null,
      toolId: "whisper.cpp",
      featureStage: "profile",
      stage: "failed",
      message: message,
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
    await refreshProfileModelState(runtime);
  }
}

async function removeProfileModel(runtime, requestId, modelId) {
  const modelState = toRecord(toRecord(runtime.profileModelState).models)[modelId];
  const descriptor = getProfileModelDescriptor(runtime, modelId);
  const targetPath =
    asNonEmptyString(toRecord(modelState).path) ||
    (asNonEmptyString(descriptor.fileName) ? `${getProfileModelsDir(runtime)}/${descriptor.fileName}` : null);

  if (targetPath !== null) {
    await callRoomTools({
      operation: "delete-path",
      roomId: ROOM_ID,
      requestId: requestId,
      targetPath: targetPath,
      recursive: false,
    });
  }

  updateProfileModelEntry(runtime, modelId, {
    installed: false,
    sizeBytes: null,
    checksumSha1: null,
    checksumValid: false,
    path: targetPath,
    lastError: null,
    lastVerifiedAt: null,
  });
  await refreshProfileModelState(runtime);
  await persistProfileModelState(runtime);
}

function resetProfileForCurrentSource(runtime, nextProject, reason) {
  const previousMode = asNonEmptyString(toRecord(nextProject.profile).mode);
  const previousPresetId = asNonEmptyString(toRecord(nextProject.profile).activePresetId);
  const nextProfile = createDefaultProfileState(
    runtime.profilePresets,
    runtime.profileModels,
    runtime.profileCapabilities,
    nextProject.source.kind
  );

  if (previousMode === "advanced") {
    nextProfile.mode = "advanced";
  }
  if (findProfilePreset(runtime.profilePresets, nextProject.source.kind, previousPresetId) !== null) {
    nextProfile.activePresetId = previousPresetId;
  }

  nextProfile.dirty = true;
  nextProfile.lastError = null;
  nextProfile.lastActionAt = new Date().toISOString();
  nextProfile.preflight = {
    ...createEmptyProfilePreflight(),
    status: "idle",
    warnings: reason ? [reason] : [],
  };
  nextProject.profile = nextProfile;
  markCloseoutAsStale(nextProject, reason || "Source media changed.");
}

function markProfileAsStale(nextProject, reason, options) {
  const profile = toRecord(nextProject.profile);
  const preflight = toRecord(profile.preflight);
  nextProject.profile = {
    ...profile,
    dirty: true,
    targetOutputId:
      options && options.clearTargetOutput === true ? null : asNonEmptyString(profile.targetOutputId),
    targetAssetSignature: null,
    lastError: null,
    lastActionAt: new Date().toISOString(),
    preflight: {
      ...createEmptyProfilePreflight(),
      ...preflight,
      status: asNonEmptyString(preflight.ranAt) !== null ? "stale" : "idle",
      jobId: null,
      requestId: null,
      error: null,
      warnings: Array.from(
        new Set(
          (Array.isArray(preflight.warnings) ? preflight.warnings : []).concat(reason ? [reason] : [])
        )
      ),
    },
  };
  markCloseoutAsStale(nextProject, reason, [FEATURE_ID]);
}

function getActiveProfileJobs(runtime, projectId, actionId) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      return {
        jobId: jobId,
        ...toRecord(runtime.jobs[jobId]),
      };
    })
    .filter(function (job) {
      return (
        job.projectId === projectId &&
        String(job.action || "").startsWith("profile-") &&
        (actionId ? job.action === actionId : true)
      );
    });
}

function ensureProfileJobSlotAvailable(runtime, projectId, actionId) {
  const activeJobs = getActiveProfileJobs(runtime, projectId, actionId);
  if (activeJobs.length > 0) {
    throw new Error("This profile job is already running. Cancel it before starting another one.");
  }
}

async function cancelProfileJobsForProject(api, runtime, projectId, requestId, actionId) {
  const activeJobs = getActiveProfileJobs(runtime, projectId, actionId);
  for (let index = 0; index < activeJobs.length; index += 1) {
    const job = activeJobs[index];
    await cancelRoomTool(ROOM_ID, job.jobId, requestId);
    pushJobState(api, {
      requestId: requestId,
      jobId: job.jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: "profile",
      stage: "cancelled",
      message: "Cancelled by operator.",
    });
    clearJob(runtime, job.jobId);
  }
  return activeJobs;
}

function registerJob(runtime, options) {
  runtime.jobs[options.jobId] = {
    requestId: options.requestId || null,
    action: options.action,
    projectId: options.projectId || null,
    toolId: options.toolId || null,
    featureStage: options.featureStage || null,
    stage: "queued",
    percent: null,
    message: null,
  };
  return runtime.jobs[options.jobId];
}

function clearJob(runtime, jobId) {
  delete runtime.jobs[jobId];
}

async function cancelJobsForProject(runtime, projectId, requestId) {
  const jobIds = Object.keys(runtime.jobs);
  for (let index = 0; index < jobIds.length; index += 1) {
    const jobId = jobIds[index];
    const job = runtime.jobs[jobId];
    if (job && job.projectId === projectId) {
      await cancelRoomTool(ROOM_ID, jobId, requestId);
      clearJob(runtime, jobId);
    }
  }
}

function normalizeMimeType(fileName, kind) {
  const lowerName = String(fileName || "").toLowerCase();
  if (kind === "audio") {
    if (lowerName.endsWith(".m4a")) return "audio/mp4";
    if (lowerName.endsWith(".wav")) return "audio/wav";
    if (lowerName.endsWith(".flac")) return "audio/flac";
    if (lowerName.endsWith(".ogg")) return "audio/ogg";
    if (lowerName.endsWith(".aac")) return "audio/aac";
    return "audio/mpeg";
  }
  if (kind === "image") {
    if (lowerName.endsWith(".png")) return "image/png";
    if (lowerName.endsWith(".webp")) return "image/webp";
    if (lowerName.endsWith(".gif")) return "image/gif";
    if (lowerName.endsWith(".bmp")) return "image/bmp";
    return "image/jpeg";
  }
  if (lowerName.endsWith(".webm")) return "video/webm";
  if (lowerName.endsWith(".mov")) return "video/quicktime";
  if (lowerName.endsWith(".mkv")) return "video/x-matroska";
  if (lowerName.endsWith(".avi")) return "video/x-msvideo";
  if (lowerName.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

function stripMimeParameters(value) {
  const rawValue = asNonEmptyString(value);
  if (rawValue === null) {
    return null;
  }

  const normalized = rawValue.split(";")[0].trim().toLowerCase();
  return normalized || null;
}

function getFileExtension(fileName) {
  const rawValue = asNonEmptyString(fileName);
  if (rawValue === null) {
    return null;
  }

  const match = rawValue.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

function getSupportedMimeTypes(sourcePresets, kind) {
  const sourceConfig = getSourceConfig(sourcePresets, kind);
  return toRecord(sourceConfig).supportedMimeTypes instanceof Array
    ? toRecord(sourceConfig).supportedMimeTypes
        .map(stripMimeParameters)
        .filter(Boolean)
    : [];
}

function getSupportedExtensions(sourcePresets, kind) {
  const sourceConfig = getSourceConfig(sourcePresets, kind);
  const filters = Array.isArray(sourceConfig.fileDialogFilters) ? sourceConfig.fileDialogFilters : [];
  const values = [];

  filters.forEach(function (filter) {
    if (!filter || Array.isArray(filter.extensions) === false) {
      return;
    }

    filter.extensions.forEach(function (extension) {
      const normalized = asNonEmptyString(extension);
      if (normalized) {
        values.push(normalized.toLowerCase().replace(/^\./, ""));
      }
    });
  });

  return Array.from(new Set(values));
}

function validateSourceCandidate(runtime, kind, storedFileName, mimeType) {
  const normalizedMimeType = stripMimeParameters(mimeType);
  const normalizedExtension = getFileExtension(storedFileName);
  const supportedMimeTypes = getSupportedMimeTypes(runtime.sourcePresets, kind);
  const supportedExtensions = getSupportedExtensions(runtime.sourcePresets, kind);
  const extensionMatches =
    normalizedExtension !== null && supportedExtensions.includes(normalizedExtension);
  const mimeMatches =
    normalizedMimeType !== null &&
    (supportedMimeTypes.includes(normalizedMimeType) || normalizedMimeType.startsWith(`${kind}/`));

  if (
    normalizedMimeType === "text/html" ||
    normalizedMimeType === "application/xhtml+xml" ||
    normalizedMimeType === "text/plain"
  ) {
    return {
      valid: false,
      error: `Saved file is ${normalizedMimeType}, not a supported ${kind} source.`,
    };
  }

  if (mimeMatches || extensionMatches) {
    return {
      valid: true,
      mimeType:
        mimeMatches && normalizedMimeType !== null
          ? normalizedMimeType
          : normalizeMimeType(storedFileName, kind),
    };
  }

  if (normalizedMimeType === "application/octet-stream" && extensionMatches) {
    return {
      valid: true,
      mimeType: normalizeMimeType(storedFileName, kind),
    };
  }

  return {
    valid: false,
    error: `Saved file is not a supported ${kind} source.`,
  };
}

function findCompanionExecutableName(toolEntry, baseName) {
  const companionPaths = toRecord(toRecord(toolEntry).companionPaths);
  const keys = Object.keys(companionPaths);
  const match = keys.find(function (key) {
    return key.toLowerCase() === baseName.toLowerCase() || key.toLowerCase().startsWith(`${baseName.toLowerCase()}.`);
  });
  return match || null;
}

function parseFfprobeMetadata(stdout, kind, mimeType) {
  const payload = toRecord(JSON.parse(stdout));
  const format = toRecord(payload.format);
  const streams = Array.isArray(payload.streams) ? payload.streams.map(toRecord) : [];
  const videoStream =
    streams.find(function (stream) {
      return asNonEmptyString(stream.codec_type) === "video";
    }) ||
    streams.find(function (stream) {
      return asNumber(stream.width) !== null || asNumber(stream.height) !== null;
    }) ||
    {};
  const audioStream =
    streams.find(function (stream) {
      return asNonEmptyString(stream.codec_type) === "audio";
    }) || {};
  const durationSeconds =
    asNumber(format.duration) || asNumber(videoStream.duration) || asNumber(audioStream.duration);
  const videoCodec = asNonEmptyString(videoStream.codec_name);
  const audioCodec = asNonEmptyString(audioStream.codec_name);
  let codec = videoCodec || audioCodec;

  if (kind === "audio") {
    codec = audioCodec;
  } else if (kind === "video" && videoCodec && audioCodec) {
    codec = `${videoCodec} + ${audioCodec}`;
  }

  return normalizeSourceMetadata({
    durationSeconds: durationSeconds,
    width: asNumber(videoStream.width),
    height: asNumber(videoStream.height),
    codec: codec,
    videoCodec: videoCodec,
    audioCodec: audioCodec,
    formatName: asNonEmptyString(format.format_long_name) || asNonEmptyString(format.format_name),
    bitRate: asNumber(format.bit_rate) || asNumber(audioStream.bit_rate) || asNumber(videoStream.bit_rate),
    sizeBytes: asNumber(format.size),
    streamCount: streams.length,
    mimeType: stripMimeParameters(mimeType),
    extractedBy: "ffprobe",
    extractedAt: new Date().toISOString(),
  });
}

async function deleteOwnedSourceFile(filePath, requestId) {
  const targetPath = asNonEmptyString(filePath);
  if (targetPath === null) {
    return;
  }

  try {
    await callRoomTools({
      operation: "delete-path",
      roomId: ROOM_ID,
      requestId: requestId || null,
      targetPath: targetPath,
      recursive: false,
    });
  } catch (_error) {
    // noop
  }
}

async function collectStoredSourceMetadata(runtime, project, options) {
  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  const normalizedMimeType = stripMimeParameters(options.mimeType);

  if (ffmpegState.installed !== true) {
    return {
      metadata: normalizeSourceMetadata({
        mimeType: normalizedMimeType,
        formatName: normalizedMimeType,
        extractedBy: "host-fallback",
        extractedAt: new Date().toISOString(),
      }),
      metadataError: null,
    };
  }

  const executableName = findCompanionExecutableName(ffmpegState, "ffprobe");
  if (executableName === null) {
    return {
      metadata: normalizeSourceMetadata({
        mimeType: normalizedMimeType,
        formatName: normalizedMimeType,
        extractedBy: "host-fallback",
        extractedAt: new Date().toISOString(),
      }),
      metadataError: null,
    };
  }

  try {
    await ensureProjectDirectories(runtime, project, options.requestId || null);
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: ROOM_ID,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: "ffmpeg",
      executableName: executableName,
      cwd: getProjectSourceDir(runtime, project),
      args: [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        options.storedPath,
      ],
      timeoutMs: 15_000,
    });
    const runPayload = toRecord(runResult.run);
    const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
    const stdout = asNonEmptyString(runPayload.stdout);

    if (runPayload.cancelled === true || exitCode !== 0 || stdout === null) {
      throw new Error(
        asNonEmptyString(runPayload.stderr) || "ffprobe did not return structured metadata."
      );
    }

    return {
      metadata: parseFfprobeMetadata(stdout, project.source.kind, options.mimeType),
      metadataError: null,
    };
  } catch (error) {
    return {
      metadata: normalizeSourceMetadata({
        mimeType: normalizedMimeType,
        formatName: normalizedMimeType,
        extractedBy: "host-fallback",
        extractedAt: new Date().toISOString(),
      }),
      metadataError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolvePreparedSource(runtime, project, options) {
  const storedPath = asNonEmptyString(options.storedPath);
  const storedFileName = asNonEmptyString(options.storedFileName);
  const sourceKind = project.source.kind;

  if (storedPath === null || storedFileName === null) {
    throw new Error("Saved source file is missing.");
  }

  const validation = validateSourceCandidate(runtime, sourceKind, storedFileName, options.mimeType);
  if (validation.valid !== true) {
    await deleteOwnedSourceFile(storedPath, options.requestId);
    throw new Error(validation.error);
  }

  const metadataResult = await collectStoredSourceMetadata(runtime, project, {
    requestId: options.requestId,
    jobId: options.jobId,
    storedPath: storedPath,
    mimeType: validation.mimeType,
  });

  return {
    storedPath: storedPath,
    storedFileName: storedFileName,
    mimeType: validation.mimeType,
    metadata: metadataResult.metadata,
    metadataError: metadataResult.metadataError,
  };
}

function deriveFilename(urlValue, kind, hint) {
  const hintValue = asNonEmptyString(hint);
  if (hintValue) {
    return hintValue;
  }

  try {
    const parsed = new URL(urlValue);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const rawName = pathname.split("/").filter(Boolean).pop();
    if (rawName && rawName.indexOf(".") > 0) {
      return rawName;
    }
  } catch (_error) {
    // noop
  }

  if (kind === "audio") return "downloaded-audio.mp3";
  if (kind === "image") return "downloaded-image.jpg";
  return "downloaded-video.mp4";
}

function sanitizeFileSegment(value, fallback) {
  const baseValue = asNonEmptyString(value) || fallback || "artifact";
  const normalized = baseValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback || "artifact";
}

function getPreparedSourcePath(project) {
  return asNonEmptyString(toRecord(project.source).storedPath);
}

function requirePreparedSource(project) {
  const storedPath = getPreparedSourcePath(project);
  if (storedPath === null) {
    throw new Error("Prepare a source file before using the edit stage.");
  }
  return storedPath;
}

function getDerivedExtension(kind) {
  if (kind === "audio") {
    return "wav";
  }
  if (kind === "image") {
    return "png";
  }
  return "mp4";
}

function getDerivedMimeType(kind) {
  if (kind === "audio") {
    return "audio/wav";
  }
  if (kind === "image") {
    return "image/png";
  }
  return "video/mp4";
}

function getEditRecipeSignature(project) {
  return JSON.stringify({
    kind: toRecord(project.source).kind,
    recipe: toRecord(project.edit).recipe,
  });
}

function clampNumber(value, minimum, maximum, fallback) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) !== true) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, numericValue));
}

function toFfmpegTimestamp(seconds, fallback) {
  const numericValue = Number(seconds);
  if (Number.isFinite(numericValue) !== true || numericValue < 0) {
    return fallback || "0";
  }
  return numericValue.toFixed(3);
}

function toEvenInteger(value, minimum) {
  const numericValue = Math.max(minimum || 2, Math.round(Number(value) || 0));
  return numericValue % 2 === 0 ? numericValue : numericValue - 1;
}

function isFullFrameCrop(cropNormalized) {
  const crop = toRecord(cropNormalized);
  return (
    Number(crop.x || 0) <= 0 &&
    Number(crop.y || 0) <= 0 &&
    Number(crop.width || 0) >= 0.999 &&
    Number(crop.height || 0) >= 0.999
  );
}

function resolveCropPixels(project) {
  const recipe = toRecord(toRecord(project.edit).recipe);
  const common = toRecord(recipe.common);
  const crop = toRecord(common.cropNormalized);
  const metadata = normalizeSourceMetadata(toRecord(project.source).metadata);
  const width = asNumber(toRecord(metadata).width);
  const height = asNumber(toRecord(metadata).height);

  if (width === null || height === null || isFullFrameCrop(crop)) {
    return null;
  }

  const rawX = clampNumber(crop.x, 0, 1, 0);
  const rawY = clampNumber(crop.y, 0, 1, 0);
  const rawWidth = clampNumber(crop.width, 0.02, 1, 1);
  const rawHeight = clampNumber(crop.height, 0.02, 1, 1);

  const pixelWidth = Math.min(width, toEvenInteger(width * rawWidth, 2));
  const pixelHeight = Math.min(height, toEvenInteger(height * rawHeight, 2));
  const maxX = Math.max(0, width - pixelWidth);
  const maxY = Math.max(0, height - pixelHeight);
  const pixelX = Math.min(maxX, Math.max(0, Math.floor(width * rawX)));
  const pixelY = Math.min(maxY, Math.max(0, Math.floor(height * rawY)));

  return {
    x: pixelX,
    y: pixelY,
    width: pixelWidth,
    height: pixelHeight,
  };
}

function resolveResizeTarget(runtime, resizePresetId, customWidth, customHeight) {
  const resizePresets = getResizePresetMap(runtime.editPresets);
  const presetId = asNonEmptyString(resizePresetId) || "keep";
  const preset = toRecord(resizePresets[presetId]);

  if (presetId === "keep") {
    return null;
  }

  if (presetId === "custom") {
    const width = asNumber(customWidth);
    const height = asNumber(customHeight);
    if (width === null && height === null) {
      return null;
    }
    return {
      width: width !== null ? toEvenInteger(width, 2) : -2,
      height: height !== null ? toEvenInteger(height, 2) : -2,
    };
  }

  const width = asNumber(preset.width);
  const height = asNumber(preset.height);
  if (width === null && height === null) {
    return null;
  }

  return {
    width: width !== null ? width : -2,
    height: height !== null ? height : -2,
  };
}

function buildVideoFilterArgs(runtime, project) {
  const recipe = toRecord(toRecord(project.edit).recipe);
  const video = toRecord(recipe.video);
  const filters = [];
  const cropPixels = resolveCropPixels(project);
  const blurFocusOutside = video.blurFocusOutside === true && cropPixels !== null;

  if (blurFocusOutside) {
    filters.push(
      `split=2[base][focus];` +
        `[base]boxblur=18:1[blurred];` +
        `[focus]crop=${cropPixels.width}:${cropPixels.height}:${cropPixels.x}:${cropPixels.y}[focuscrop];` +
        `[blurred][focuscrop]overlay=${cropPixels.x}:${cropPixels.y}`
    );
  } else if (cropPixels !== null) {
    filters.push(
      `crop=${cropPixels.width}:${cropPixels.height}:${cropPixels.x}:${cropPixels.y}`
    );
  }

  const resizeTarget = resolveResizeTarget(
    runtime,
    video.resizePreset,
    video.customWidth,
    video.customHeight
  );
  if (resizeTarget !== null) {
    filters.push(`scale=${resizeTarget.width}:${resizeTarget.height}:flags=lanczos`);
  }

  const fpsLimit = clampNumber(video.fpsLimit, 1, 60, null);
  if (fpsLimit !== null) {
    filters.push(`fps=${Math.round(fpsLimit)}`);
  }

  return filters;
}

function buildAudioFilterArgs(project) {
  const recipe = toRecord(toRecord(project.edit).recipe);
  const audio = toRecord(recipe.audio);
  const filters = [];

  if (audio.silenceTrim === true) {
    filters.push(
      "silenceremove=start_periods=1:start_silence=0.2:start_threshold=-45dB:stop_periods=-1:stop_silence=0.3:stop_threshold=-45dB"
    );
  }
  if (audio.normalize === true) {
    filters.push(`loudnorm=I=${clampNumber(audio.normalizeTargetDb, -30, -8, -16)}:TP=-1.5:LRA=11`);
  }
  const highpassHz = clampNumber(audio.highpassHz, 0, 24000, 0);
  if (highpassHz > 0) {
    filters.push(`highpass=f=${Math.round(highpassHz)}`);
  }
  const lowpassHz = clampNumber(audio.lowpassHz, 0, 24000, 0);
  if (lowpassHz > 0) {
    filters.push(`lowpass=f=${Math.round(lowpassHz)}`);
  }

  return filters;
}

function buildImageFilterArgs(runtime, project) {
  const recipe = toRecord(toRecord(project.edit).recipe);
  const image = toRecord(recipe.image);
  const filters = [];
  const cropPixels = resolveCropPixels(project);

  if (cropPixels !== null) {
    filters.push(
      `crop=${cropPixels.width}:${cropPixels.height}:${cropPixels.x}:${cropPixels.y}`
    );
  }

  const rotateDegrees = clampNumber(image.rotateDegrees, -360, 360, 0);
  if (rotateDegrees !== 0) {
    filters.push(`rotate=${(rotateDegrees * Math.PI) / 180}:fillcolor=black`);
  }

  const resizeTarget = resolveResizeTarget(
    runtime,
    image.resizePreset,
    image.customWidth,
    image.customHeight
  );
  if (resizeTarget !== null) {
    filters.push(`scale=${resizeTarget.width}:${resizeTarget.height}:flags=lanczos`);
  }

  const brightness = clampNumber(image.brightness, -1, 1, 0);
  const contrast = clampNumber(image.contrast, 0.2, 3, 1);
  if (brightness !== 0 || contrast !== 1) {
    filters.push(`eq=brightness=${brightness}:contrast=${contrast}`);
  }

  const sharpen = clampNumber(image.sharpen, 0, 3, 0);
  if (sharpen > 0) {
    filters.push(`unsharp=5:5:${sharpen}:5:5:0`);
  }

  const blurStrength = clampNumber(image.blurStrength, 0, 3, 0);
  if (blurStrength > 0) {
    filters.push(`boxblur=${Math.max(1, Math.round(blurStrength * 4))}:1`);
  }

  return filters;
}

function buildEditCommand(runtime, project, outputPath, mode) {
  const sourceKind = toRecord(project.source).kind;
  const sourcePath = requirePreparedSource(project);
  const recipe = toRecord(toRecord(project.edit).recipe);
  const common = toRecord(recipe.common);
  const args = ["-y"];

  if (sourceKind === "video") {
    const video = toRecord(recipe.video);
    if (video.trimEnabled === true) {
      args.push("-ss", toFfmpegTimestamp(video.trimStartSeconds, "0"));
      const endSeconds = clampNumber(video.trimEndSeconds, 0, 86400, 0);
      if (endSeconds > 0) {
        args.push("-to", toFfmpegTimestamp(endSeconds, null));
      }
    }
  }

  if (sourceKind === "audio") {
    const audio = toRecord(recipe.audio);
    if (audio.trimEnabled === true) {
      args.push("-ss", toFfmpegTimestamp(audio.trimStartSeconds, "0"));
      const endSeconds = clampNumber(audio.trimEndSeconds, 0, 86400, 0);
      if (endSeconds > 0) {
        args.push("-to", toFfmpegTimestamp(endSeconds, null));
      }
    }
  }

  args.push("-i", sourcePath);

  if (sourceKind === "video") {
    const filters = buildVideoFilterArgs(runtime, project);
    if (filters.length > 0) {
      args.push("-vf", filters.join(","));
    }

    if (toRecord(recipe.video).includeAudio !== true) {
      args.push("-an");
    } else {
      args.push("-c:a", "aac", "-b:a", mode === "preview" ? "128k" : "160k");
    }

    args.push(
      "-c:v",
      "libx264",
      "-preset",
      mode === "preview" ? "veryfast" : "medium",
      "-crf",
      mode === "preview" ? "25" : "22",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath
    );
    return args;
  }

  if (sourceKind === "audio") {
    const filters = buildAudioFilterArgs(project);
    if (filters.length > 0) {
      args.push("-af", filters.join(","));
    }
    if (toRecord(recipe.audio).mono === true) {
      args.push("-ac", "1");
    }
    args.push("-c:a", "pcm_s16le", outputPath);
    return args;
  }

  const filters = buildImageFilterArgs(runtime, project);
  if (filters.length > 0) {
    args.push("-vf", filters.join(","));
  }
  args.push("-frames:v", "1", outputPath);
  return args;
}

function buildEditTargetPath(runtime, project, mode) {
  const extension = getDerivedExtension(project.source.kind);
  const common = toRecord(toRecord(toRecord(project.edit).recipe).common);
  const baseName = sanitizeFileSegment(common.outputNameHint, `${project.slug}-analysis`);

  if (mode === "preview") {
    return `${getProjectEditPreviewDir(runtime, project)}/${baseName}-preview.${extension}`;
  }

  const stamp = Date.now();
  return `${getProjectEditOutputDir(runtime, project)}/${baseName}-${stamp}.${extension}`;
}

function buildEditOutputLabel(project, mode) {
  const baseName = asNonEmptyString(toRecord(toRecord(toRecord(project.edit).recipe).common).outputNameHint);
  const route = baseName || project.name;
  return mode === "preview" ? `${route} Preview` : `${route} Derived Output`;
}

function markEditAsDirty(nextProject, recipeSignature) {
  nextProject.edit.dirty = true;
  nextProject.edit.lastError = null;
  nextProject.edit.lastActionAt = new Date().toISOString();

  const preview = toRecord(nextProject.edit.preview);
  const previewPath = asNonEmptyString(preview.path);
  const previewSignature = asNonEmptyString(preview.recipeSignature);

  nextProject.edit.preview = {
    ...preview,
    status: previewPath ? (previewSignature === recipeSignature ? "ready" : "stale") : "idle",
    error: null,
  };
  markCloseoutAsStale(nextProject, "Edit recipe changed; rerun downstream processing.");
}

function resetEditForCurrentSource(runtime, nextProject) {
  const previousMode = asNonEmptyString(toRecord(nextProject.edit).mode);
  nextProject.edit = createDefaultEditState(runtime.editPresets, nextProject.source.kind);
  if (previousMode === "advanced") {
    nextProject.edit.mode = "advanced";
  }
  markCloseoutAsStale(nextProject, "Source media changed.");
}

function findEditPreset(runtime, project, presetId) {
  const sourceKind = toRecord(project.source).kind;
  const mode = asNonEmptyString(toRecord(project.edit).mode) || "beginner";
  const presetsByKind = toRecord(toRecord(runtime.editPresets).presets);
  const presetList = Array.isArray(toRecord(toRecord(presetsByKind[sourceKind])[mode]))
    ? toRecord(presetsByKind[sourceKind])[mode]
    : [];

  return (
    presetList.find(function (entry) {
      return asNonEmptyString(toRecord(entry).id) === presetId;
    }) || null
  );
}

function applyEditRecipePatch(runtime, nextProject, patch, options) {
  const recipePatch = toRecord(patch);
  nextProject.edit.recipe = mergeObjects(nextProject.edit.recipe, recipePatch);

  const commonPatch = toRecord(recipePatch.common);
  const nextFocusRegionId = asNonEmptyString(toRecord(nextProject.edit.recipe.common).focusRegionId);
  if (nextFocusRegionId && Object.prototype.hasOwnProperty.call(commonPatch, "cropNormalized") === false) {
    nextProject.edit.recipe.common.cropNormalized = getFocusRegionCrop(
      runtime.editPresets,
      nextFocusRegionId
    );
  }

  if (options && typeof options.presetId === "string" && options.presetId.trim() !== "") {
    nextProject.edit.activePresetId = options.presetId.trim();
  }

  markEditAsDirty(nextProject, getEditRecipeSignature(nextProject));
}

async function collectDerivedOutputMetadata(runtime, project, options) {
  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  const executableName = findCompanionExecutableName(ffmpegState, "ffprobe");
  const mimeType = stripMimeParameters(options.mimeType);

  if (ffmpegState.installed !== true || executableName === null) {
    return {
      metadata: normalizeSourceMetadata({
        mimeType: mimeType,
        formatName: mimeType,
        extractedBy: "host-fallback",
        extractedAt: new Date().toISOString(),
      }),
      metadataError: null,
    };
  }

  try {
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: ROOM_ID,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: "ffmpeg",
      executableName: executableName,
      cwd: getProjectEditDir(runtime, project),
      args: [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        options.path,
      ],
      timeoutMs: 15_000,
    });
    const runPayload = toRecord(runResult.run);
    const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
    const stdout = asNonEmptyString(runPayload.stdout);

    if (runPayload.cancelled === true || exitCode !== 0 || stdout === null) {
      throw new Error(asNonEmptyString(runPayload.stderr) || "ffprobe metadata probe failed.");
    }

    return {
      metadata: parseFfprobeMetadata(stdout, project.source.kind, mimeType),
      metadataError: null,
    };
  } catch (error) {
    return {
      metadata: normalizeSourceMetadata({
        mimeType: mimeType,
        formatName: mimeType,
        extractedBy: "host-fallback",
        extractedAt: new Date().toISOString(),
      }),
      metadataError: error instanceof Error ? error.message : String(error),
    };
  }
}

function getActiveEditJobs(runtime, projectId, actionId) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      return {
        jobId: jobId,
        ...toRecord(runtime.jobs[jobId]),
      };
    })
    .filter(function (job) {
      return (
        job.projectId === projectId &&
        String(job.action || "").startsWith("edit-") &&
        (actionId ? job.action === actionId : true)
      );
    });
}

function ensureEditJobSlotAvailable(runtime, projectId, actionId) {
  const activeJobs = getActiveEditJobs(runtime, projectId, actionId);
  if (activeJobs.length > 0) {
    throw new Error("This edit job is already running. Cancel it before starting another one.");
  }
}

async function cancelEditJobsForProject(api, runtime, projectId, requestId, actionId) {
  const activeJobs = getActiveEditJobs(runtime, projectId, actionId);
  for (let index = 0; index < activeJobs.length; index += 1) {
    const job = activeJobs[index];
    await cancelRoomTool(ROOM_ID, job.jobId, requestId);
    pushJobState(api, {
      requestId: requestId,
      jobId: job.jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: job.featureStage || "edit",
      stage: "cancelled",
      message: "Cancelled by operator.",
    });
    clearJob(runtime, job.jobId);
  }
  return activeJobs;
}

function getActiveProcessJobs(runtime, projectId, actionId) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      return {
        jobId: jobId,
        ...toRecord(runtime.jobs[jobId]),
      };
    })
    .filter(function (job) {
      return (
        job.projectId === projectId &&
        String(job.featureStage || "") === "process" &&
        (actionId ? job.action === actionId : true)
      );
    });
}

function ensureProcessJobSlotAvailable(runtime, projectId, actionId) {
  const activeJobs = getActiveProcessJobs(runtime, projectId, actionId);
  if (activeJobs.length > 0) {
    throw new Error("This process job is already running. Cancel it before starting another one.");
  }
}

async function cancelProcessJobsForProject(api, runtime, projectId, requestId, actionId) {
  const activeJobs = getActiveProcessJobs(runtime, projectId, actionId);
  for (let index = 0; index < activeJobs.length; index += 1) {
    const job = activeJobs[index];
    await cancelRoomTool(ROOM_ID, job.jobId, requestId);
    pushJobState(api, {
      requestId: requestId,
      jobId: job.jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: "process",
      stage: "cancelled",
      message: "Cancelled by operator.",
    });
    clearJob(runtime, job.jobId);
  }
  return activeJobs;
}

function getActiveReportJobs(runtime, projectId, actionId) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      return {
        jobId: jobId,
        ...toRecord(runtime.jobs[jobId]),
      };
    })
    .filter(function (job) {
      return (
        job.projectId === projectId &&
        String(job.featureStage || "") === "report" &&
        (actionId ? job.action === actionId : true)
      );
    });
}

function ensureReportJobSlotAvailable(runtime, projectId, actionId) {
  const activeJobs = getActiveReportJobs(runtime, projectId, actionId);
  if (activeJobs.length > 0) {
    throw new Error("This report job is already running. Wait for it or cancel it first.");
  }
}

function buildArtifactEntry(filePath, kind) {
  const normalizedPath = asNonEmptyString(filePath);
  if (normalizedPath === null) {
    return null;
  }
  return {
    kind: kind,
    path: normalizedPath,
    fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
  };
}

async function listArtifactsWithPrefix(dirPath, filePrefix) {
  const entries = await listDirectory(dirPath);
  return entries
    .filter(function (entry) {
      return entry && entry.isDirectory !== true && String(entry.name || "").startsWith(filePrefix);
    })
    .map(function (entry) {
      return entry.path;
    })
    .sort();
}

async function buildAuxiliaryArtifacts(runtime, project, options) {
  const artifactDir =
    options.mode === "preview"
      ? getProjectEditPreviewDir(runtime, project)
      : getProjectEditOutputDir(runtime, project);

  if (project.source.kind === "audio") {
    if (toRecord(toRecord(toRecord(project.edit).recipe).audio).spectrogram !== true) {
      return [];
    }
    const artifactBase = options.baseName;
    const spectrogramPath = `${artifactDir}/${artifactBase}-spectrogram.png`;

    await callRoomTools({
      operation: "tool-run",
      roomId: ROOM_ID,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: "ffmpeg",
      cwd: getProjectEditDir(runtime, project),
      args: [
        "-y",
        "-i",
        options.outputPath,
        "-lavfi",
        "showspectrumpic=s=1600x480:legend=0",
        "-frames:v",
        "1",
        spectrogramPath,
      ],
      timeoutMs: 60_000,
    });

    return [buildArtifactEntry(spectrogramPath, "spectrogram")].filter(Boolean);
  }

  if (project.source.kind === "video" && options.mode === "apply") {
    const frameGrabCount = clampNumber(
      toRecord(toRecord(toRecord(project.edit).recipe).video).frameGrabCount,
      0,
      24,
      0
    );
    const durationSeconds =
      asNumber(toRecord(options.metadata).durationSeconds) ||
      asNumber(toRecord(toRecord(project.source).metadata).durationSeconds);
    if (frameGrabCount > 0 && durationSeconds && durationSeconds > 0) {
      const framePattern = `${artifactDir}/${options.baseName}-frame-%03d.jpg`;
      const fpsValue = Math.max(0.2, frameGrabCount / durationSeconds);

      await callRoomTools({
        operation: "tool-run",
        roomId: ROOM_ID,
        requestId: options.requestId || null,
        jobId: options.jobId || null,
        toolId: "ffmpeg",
        cwd: getProjectEditDir(runtime, project),
        args: [
          "-y",
          "-i",
          options.outputPath,
          "-vf",
          `fps=${fpsValue}`,
          "-frames:v",
          String(frameGrabCount),
          framePattern,
        ],
        timeoutMs: 60_000,
      });

      const createdFrames = await listArtifactsWithPrefix(
        artifactDir,
        `${options.baseName}-frame-`
      );
      return createdFrames
        .map(function (filePath) {
          return buildArtifactEntry(filePath, "frame");
        })
        .filter(Boolean);
    }
  }

  return [];
}

function ensureEditToolReady(runtime) {
  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  if (ffmpegState.installed !== true) {
    throw new Error("Install FFmpeg in settings before using the edit stage.");
  }
}

async function runEditPipeline(api, runtime, requestId, mode) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  requirePreparedSource(project);
  ensureEditToolReady(runtime);
  await ensureProjectDirectories(runtime, project, requestId);
  const action = mode === "preview" ? "edit-preview" : "edit-apply";
  ensureEditJobSlotAvailable(runtime, project.id, action);
  const jobId = `room-edit-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const targetPath = buildEditTargetPath(runtime, project, mode);
  const mimeType = getDerivedMimeType(project.source.kind);
  const recipeSignature = getEditRecipeSignature(project);
  const artifactBaseName = (targetPath.split(/[\\/]/).pop() || "artifact").replace(/\.[^.]+$/, "");

  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: action,
    projectId: project.id,
    toolId: "ffmpeg",
    featureStage: "edit",
  });

  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: action,
    projectId: project.id,
    toolId: "ffmpeg",
    featureStage: "edit",
    stage: "queued",
  });

  await patchActiveProject(runtime, function (nextProject) {
    nextProject.edit.lastError = null;
    nextProject.edit.lastActionAt = new Date().toISOString();
    if (mode === "preview") {
      nextProject.edit.preview = {
        ...toRecord(nextProject.edit.preview),
        status: "generating",
        requestId: requestId,
        jobId: jobId,
        error: null,
      };
    }
    return nextProject;
  });

  try {
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectEditDir(runtime, project),
      args: buildEditCommand(runtime, project, targetPath, mode),
      timeoutMs: 20 * 60 * 1000,
    });
    const runPayload = toRecord(runResult.run);
    const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
    if (runPayload.cancelled === true || exitCode !== 0) {
      throw new Error(asNonEmptyString(runPayload.stderr) || "FFmpeg edit job failed.");
    }

    const targetFileName = targetPath.split(/[\\/]/).pop() || null;
    const metadataResult = await collectDerivedOutputMetadata(runtime, project, {
      requestId: requestId,
      jobId: jobId,
      path: targetPath,
      mimeType: mimeType,
    });
    const artifacts = await buildAuxiliaryArtifacts(runtime, project, {
      requestId: requestId,
      jobId: jobId,
      mode: mode,
      outputPath: targetPath,
      baseName: artifactBaseName,
      metadata: metadataResult.metadata,
    });

    const createdAt = new Date().toISOString();
    await patchActiveProject(runtime, function (nextProject) {
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = createdAt;
      nextProject.edit.dirty = false;

      if (mode === "preview") {
        nextProject.edit.preview = {
          status: "ready",
          outputId: "preview",
          jobId: jobId,
          requestId: requestId,
          path: targetPath,
          fileName: targetFileName,
          mimeType: mimeType,
          metadata: metadataResult.metadata,
          artifacts: artifacts,
          error: metadataResult.metadataError,
          recipeSignature: recipeSignature,
          updatedAt: createdAt,
        };
        return nextProject;
      }

      const outputId = `edit-output-${Date.now()}`;
      const nextOutput = normalizeEditOutput({
        id: outputId,
        kind: project.source.kind,
        path: targetPath,
        fileName: targetFileName,
        mimeType: mimeType,
        createdAt: createdAt,
        recipeSignature: recipeSignature,
        metadata: metadataResult.metadata,
        label: buildEditOutputLabel(project, mode),
        jobId: jobId,
        sourcePath: getPreparedSourcePath(project),
        artifacts: artifacts,
      });

      nextProject.edit.outputs = [nextOutput].concat(
        Array.isArray(nextProject.edit.outputs) ? nextProject.edit.outputs : []
      );
      nextProject.edit.activeOutputId = nextOutput.id;
      nextProject.edit.handoffMode = "derived";
      markProfileAsStale(nextProject, "Edit output changed; rerun the profile preflight.");
      markCloseoutAsStale(nextProject, "Edit output changed; rerun downstream processing.", [
        AUDIO_FEATURE_ID,
      ]);
      const previousPreview = toRecord(nextProject.edit.preview);
      nextProject.edit.preview = {
        ...previousPreview,
        status:
          asNonEmptyString(previousPreview.path) !== null
            ? asNonEmptyString(previousPreview.recipeSignature) === recipeSignature
              ? "ready"
              : "stale"
            : "idle",
      };
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "edit",
      stage: "completed",
      percent: 100,
    });

    return {
      path: targetPath,
      fileName: targetFileName,
      metadata: metadataResult.metadata,
    };
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      nextProject.edit.lastError = error instanceof Error ? error.message : String(error);
      nextProject.edit.lastActionAt = new Date().toISOString();
      if (mode === "preview") {
        nextProject.edit.preview = {
          ...toRecord(nextProject.edit.preview),
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "edit",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

function ensureProfileToolReady(runtime) {
  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  if (ffmpegState.installed !== true) {
    throw new Error("Install FFmpeg in settings before using the profile stage.");
  }
}

function createProfileArtifact(kind, path, label, metadata) {
  const normalizedPath = asNonEmptyString(path);
  if (normalizedPath === null) {
    return null;
  }

  return normalizeProfileArtifact({
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: kind,
    path: normalizedPath,
    fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
    label: label,
    createdAt: new Date().toISOString(),
    metadata: toRecord(metadata),
  });
}

function createProfileSignal(laneId, kind, level, confidence, title, detail, evidenceCount, artifactIds) {
  return normalizeProfileSignal({
    id: `${laneId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    laneId: laneId,
    kind: kind,
    level: level,
    confidence: confidence,
    title: title,
    detail: detail,
    evidenceCount: evidenceCount,
    artifactIds: Array.isArray(artifactIds) ? artifactIds : [],
  });
}

function createProcessArtifact(moduleId, kind, path, label, metadata) {
  const artifact = createProfileArtifact(kind, path, label, metadata);
  if (artifact === null) {
    return null;
  }
  return normalizeProcessArtifact({
    ...artifact,
    moduleId: moduleId,
  });
}

function createProcessFinding(moduleId, kind, level, confidence, title, detail, evidenceCount, artifactIds) {
  return normalizeProcessFinding({
    ...createProfileSignal(moduleId, kind, level, confidence, title, detail, evidenceCount, artifactIds),
    moduleId: moduleId,
  });
}

function parseBlackDetectLog(stderrValue) {
  const matches = String(stderrValue || "").match(/black_duration:([0-9.]+)/g) || [];
  return {
    count: matches.length,
    totalDurationSeconds: matches.reduce(function (total, entry) {
      const match = entry.match(/([0-9.]+)$/);
      return total + Number(match ? match[1] : 0);
    }, 0),
  };
}

function parseFreezeDetectLog(stderrValue) {
  const matches = String(stderrValue || "").match(/freeze_duration:([0-9.]+)/g) || [];
  return {
    count: matches.length,
    totalDurationSeconds: matches.reduce(function (total, entry) {
      const match = entry.match(/([0-9.]+)$/);
      return total + Number(match ? match[1] : 0);
    }, 0),
  };
}

function parseSilenceDetectLog(stderrValue) {
  const matches = String(stderrValue || "").match(/silence_duration: ([0-9.]+)/g) || [];
  return {
    count: matches.length,
    totalDurationSeconds: matches.reduce(function (total, entry) {
      const match = entry.match(/([0-9.]+)$/);
      return total + Number(match ? match[1] : 0);
    }, 0),
  };
}

function parseVolumeDetectLog(stderrValue) {
  const meanMatch = String(stderrValue || "").match(/mean_volume:\s*(-?[0-9.]+)\s*dB/i);
  const maxMatch = String(stderrValue || "").match(/max_volume:\s*(-?[0-9.]+)\s*dB/i);
  return {
    meanVolumeDb: meanMatch ? Number(meanMatch[1]) : null,
    maxVolumeDb: maxMatch ? Number(maxMatch[1]) : null,
  };
}

function parseAspectralStatsText(rawText) {
  const rawMetrics = {};
  String(rawText || "")
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean)
    .forEach(function (line) {
      const match = line.match(/^lavfi\.aspectralstats\.\d+\.([a-z]+)=([^\s]+)$/i);
      if (!match) {
        return;
      }
      const metricId = match[1];
      const numericValue = Number(match[2]);
      if (!Number.isFinite(numericValue)) {
        return;
      }
      if (!rawMetrics[metricId]) {
        rawMetrics[metricId] = [];
      }
      rawMetrics[metricId].push(numericValue);
    });

  return Object.keys(rawMetrics).reduce(function (accumulator, metricId) {
    const samples = Array.isArray(rawMetrics[metricId]) ? rawMetrics[metricId] : [];
    if (samples.length === 0) {
      return accumulator;
    }
    const total = samples.reduce(function (sum, value) {
      return sum + value;
    }, 0);
    accumulator[metricId] = {
      sampleCount: samples.length,
      mean: Number((total / samples.length).toFixed(3)),
      min: Number(Math.min.apply(null, samples).toFixed(3)),
      max: Number(Math.max.apply(null, samples).toFixed(3)),
    };
    return accumulator;
  }, {});
}

function parseCsvTable(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);
  if (lines.length === 0) {
    return {
      header: [],
      rows: [],
    };
  }

  const header = lines[0].split(",").map(function (cell) {
    return cell.trim();
  });
  const rows = lines.slice(1).map(function (line) {
    const values = line.split(",");
    return header.reduce(function (record, columnName, index) {
      record[columnName] = typeof values[index] === "string" ? values[index].trim() : "";
      return record;
    }, {});
  });

  return {
    header: header,
    rows: rows,
  };
}

function buildNumericSummary(values) {
  const samples = Array.isArray(values)
    ? values.filter(function (value) {
        return Number.isFinite(value);
      })
    : [];
  if (samples.length === 0) {
    return null;
  }

  const total = samples.reduce(function (sum, value) {
    return sum + value;
  }, 0);

  return {
    sampleCount: samples.length,
    mean: Number((total / samples.length).toFixed(3)),
    min: Number(Math.min.apply(null, samples).toFixed(3)),
    max: Number(Math.max.apply(null, samples).toFixed(3)),
  };
}

function findProsodyColumn(header, pattern) {
  return (
    (Array.isArray(header) ? header : []).find(function (columnName) {
      return pattern.test(String(columnName || ""));
    }) || null
  );
}

function buildProsodySummaryFromCsv(rawText) {
  const table = parseCsvTable(rawText);
  const header = Array.isArray(table.header) ? table.header : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const timestampKey = findProsodyColumn(header, /timestamp/i);
  const f0Key = findProsodyColumn(header, /(^|[_-])F0/i);
  const loudnessKey = findProsodyColumn(header, /loudness/i);
  const voiceProbKey = findProsodyColumn(header, /voiceprob/i);

  const f0Values = [];
  const loudnessValues = [];
  const voiceProbValues = [];
  let estimatedPauseCount = 0;
  let voicedFrames = 0;
  let totalDurationSeconds = null;
  let previousVoiced = null;
  let firstTimestamp = null;
  let lastTimestamp = null;

  rows.forEach(function (row) {
    const record = toRecord(row);
    const timestampValue = timestampKey ? Number(record[timestampKey]) : NaN;
    const f0Value = f0Key ? Number(record[f0Key]) : NaN;
    const loudnessValue = loudnessKey ? Number(record[loudnessKey]) : NaN;
    const voiceProbValue = voiceProbKey ? Number(record[voiceProbKey]) : NaN;

    if (Number.isFinite(timestampValue)) {
      if (firstTimestamp === null) {
        firstTimestamp = timestampValue;
      }
      lastTimestamp = timestampValue;
    }
    if (Number.isFinite(f0Value)) {
      f0Values.push(f0Value);
    }
    if (Number.isFinite(loudnessValue)) {
      loudnessValues.push(loudnessValue);
    }
    if (Number.isFinite(voiceProbValue)) {
      voiceProbValues.push(voiceProbValue);
      const voiced = voiceProbValue >= 0.5;
      if (voiced) {
        voicedFrames += 1;
      }
      if (previousVoiced === true && voiced === false) {
        estimatedPauseCount += 1;
      }
      previousVoiced = voiced;
    }
  });

  if (typeof firstTimestamp === "number" && typeof lastTimestamp === "number" && lastTimestamp >= firstTimestamp) {
    totalDurationSeconds = Number((lastTimestamp - firstTimestamp).toFixed(3));
  }

  const voicedRatio =
    voiceProbValues.length > 0 ? Number((voicedFrames / voiceProbValues.length).toFixed(3)) : null;
  const numericSummaries = {};

  if (f0Key !== null) {
    const summary = buildNumericSummary(f0Values);
    if (summary !== null) {
      numericSummaries[f0Key] = summary;
    }
  }
  if (loudnessKey !== null) {
    const summary = buildNumericSummary(loudnessValues);
    if (summary !== null) {
      numericSummaries[loudnessKey] = summary;
    }
  }
  if (voiceProbKey !== null) {
    const summary = buildNumericSummary(voiceProbValues);
    if (summary !== null) {
      numericSummaries[voiceProbKey] = summary;
    }
  }

  return {
    columns: header,
    frameCount: rows.length,
    durationSeconds: totalDurationSeconds,
    meanF0Hz:
      f0Key !== null && numericSummaries[f0Key] ? Number(numericSummaries[f0Key].mean.toFixed(2)) : null,
    meanLoudness:
      loudnessKey !== null && numericSummaries[loudnessKey]
        ? Number(numericSummaries[loudnessKey].mean.toFixed(2))
        : null,
    voicedRatio: voicedRatio,
    estimatedPauseCount: voiceProbValues.length > 0 ? estimatedPauseCount : null,
    numericSummaries: numericSummaries,
  };
}

function resolveOpenSmileProsodyRuntime(runtime) {
  const configDir = getAudioAnalysisOpenSmileConfigDir(runtime);
  const configPath = getAudioAnalysisOpenSmileConfigPath(runtime, "prosodyAcf.conf");
  if (configDir === null || configPath === null) {
    return null;
  }
  return {
    configDir: configDir,
    configPath: configPath,
  };
}

async function runOpenSmileProsodyExtraction(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  moduleOutputDir,
  outputLabel
) {
  const openSmileRuntime = resolveOpenSmileProsodyRuntime(runtime);
  if (openSmileRuntime === null) {
    throw new Error("Room-local openSMILE config package is unavailable on this runtime.");
  }

  const contourPath = `${moduleOutputDir}/${artifactBase}-${outputLabel}.csv`;
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "opensmile",
    cwd: openSmileRuntime.configDir,
    args: [
      "-C",
      openSmileRuntime.configPath,
      "-I",
      target.path,
      "-csvoutput",
      contourPath,
      "-appendcsv",
      "0",
      "-nologfile",
      "1",
    ],
    timeoutMs: 3 * 60 * 1000,
  });

  const contourCsv = await readTextFile(contourPath);
  if (asNonEmptyString(contourCsv) === null) {
    throw new Error("openSMILE did not produce a prosody contour CSV.");
  }

  return {
    contourCsv: contourCsv,
    contourPath: contourPath,
    prosodySummary: buildProsodySummaryFromCsv(contourCsv),
  };
}

function buildEmotionHeuristicFromProsody(prosodySummary) {
  const summary = toRecord(prosodySummary);
  const cues = [];
  let score = 0;

  if (typeof summary.meanF0Hz === "number") {
    if (summary.meanF0Hz >= 185) {
      score += 1;
      cues.push("Pitch baseline trends high.");
    } else if (summary.meanF0Hz <= 140) {
      score -= 1;
      cues.push("Pitch baseline trends low.");
    }
  }

  if (typeof summary.voicedRatio === "number") {
    if (summary.voicedRatio >= 0.7) {
      score += 1;
      cues.push("Voiced ratio stays consistently high.");
    } else if (summary.voicedRatio <= 0.45) {
      score -= 1;
      cues.push("Voiced ratio drops across the sample.");
    }
  }

  if (typeof summary.estimatedPauseCount === "number" && typeof summary.durationSeconds === "number" && summary.durationSeconds > 0) {
    const pauseDensity = summary.estimatedPauseCount / Math.max(summary.durationSeconds, 1);
    if (pauseDensity >= 0.45) {
      score -= 1;
      cues.push("Estimated pause density is elevated.");
    } else if (pauseDensity <= 0.12) {
      score += 1;
      cues.push("Estimated pause density stays low.");
    }
  }

  const label =
    score >= 2
      ? "elevated-arousal-candidate"
      : score <= -2
        ? "subdued-arousal-candidate"
        : "steady-arousal-candidate";

  return {
    label: label,
    score: score,
    confidence: Math.abs(score) >= 3 ? "medium" : "low",
    cues: cues,
    disclaimer: "Heuristic only. This module suggests coarse arousal-style labels and is not a factual emotion classifier.",
    prosodySummary: summary,
  };
}

async function runProfileTool(runtime, options) {
  const runResult = await callRoomTools({
    operation: "tool-run",
    roomId: ROOM_ID,
    requestId: options.requestId || null,
    jobId: options.jobId || null,
    toolId: options.toolId,
    executableName: options.executableName || undefined,
    cwd: options.cwd,
    args: options.args,
    timeoutMs: options.timeoutMs,
  });
  const runPayload = toRecord(runResult.run);
  const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
  if (runPayload.cancelled === true || exitCode !== 0) {
    throw new Error(asNonEmptyString(runPayload.stderr) || `${options.toolId} job failed.`);
  }
  return runPayload;
}

async function generateProfileMetadataArtifact(runtime, project, target, artifactBase) {
  const metadataPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-metadata.json`;
  await writeJsonFile(metadataPath, {
    generatedAt: new Date().toISOString(),
    target: {
      requestedMode: target.requestedMode,
      mode: target.mode,
      outputId: target.outputId,
      label: target.label,
      fileName: target.fileName,
      mimeType: target.mimeType,
      path: target.path,
      signature: target.signature,
    },
    metadata: clone(target.metadata || {}),
  });
  return createProfileArtifact("metadata", metadataPath, "Metadata Snapshot", {
    requestedMode: target.requestedMode,
    mode: target.mode,
  });
}

async function generateProfileFrameStrip(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  sampleWindowSeconds,
  tileCount
) {
  const sourceKind = asNonEmptyString(project.source.kind) || "video";
  const outputPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-frames.png`;

  if (sourceKind === "image") {
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: ["-y", "-i", target.path, "-vf", "scale=1280:-1:flags=lanczos", "-frames:v", "1", outputPath],
      timeoutMs: 90_000,
    });
    return createProfileArtifact("frame-strip", outputPath, "Profile Reference Frame", {});
  }

  const normalizedTileCount = Math.max(2, Math.round(asNumber(tileCount) || 4));
  const intervalSeconds = Math.max(1, Math.round((sampleWindowSeconds || 40) / normalizedTileCount));
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProfileDir(runtime, project),
    args: [
      "-y",
      "-i",
      target.path,
      "-vf",
      `fps=1/${intervalSeconds},scale=420:-1:flags=lanczos,tile=${normalizedTileCount}x1`,
      "-frames:v",
      "1",
      outputPath,
    ],
    timeoutMs: 90_000,
  });
  return createProfileArtifact("frame-strip", outputPath, "Frame Strip", {
    tileCount: normalizedTileCount,
    intervalSeconds: intervalSeconds,
  });
}

async function generateProfileSpectrogram(runtime, project, requestId, jobId, target, artifactBase) {
  const outputPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-spectrogram.png`;
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProfileDir(runtime, project),
    args: [
      "-y",
      "-i",
      target.path,
      "-lavfi",
      "showspectrumpic=s=1600x440:legend=0",
      "-frames:v",
      "1",
      outputPath,
    ],
    timeoutMs: 90_000,
  });
  return createProfileArtifact("spectrogram", outputPath, "Spectrogram", {});
}

async function runVideoStructureProbe(runtime, project, requestId, jobId, target) {
  const stderr = asNonEmptyString(
    (
      await runProfileTool(runtime, {
        requestId: requestId,
        jobId: jobId,
        toolId: "ffmpeg",
        cwd: getProjectProfileDir(runtime, project),
        args: [
          "-hide_banner",
          "-i",
          target.path,
          "-vf",
          "blackdetect=d=0.25:pix_th=0.10,freezedetect=n=-40dB:d=0.4",
          "-an",
          "-f",
          "null",
          "-",
        ],
        timeoutMs: 120_000,
      })
    ).stderr
  );
  return {
    black: parseBlackDetectLog(stderr),
    freeze: parseFreezeDetectLog(stderr),
  };
}

async function runAudioStructureProbe(runtime, project, requestId, jobId, target) {
  const silencePayload = await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProfileDir(runtime, project),
    args: ["-hide_banner", "-i", target.path, "-af", "silencedetect=n=-38dB:d=0.35", "-f", "null", "-"],
    timeoutMs: 120_000,
  });
  const volumePayload = await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProfileDir(runtime, project),
    args: ["-hide_banner", "-i", target.path, "-af", "volumedetect", "-f", "null", "-"],
    timeoutMs: 120_000,
  });

  return {
    silence: parseSilenceDetectLog(silencePayload.stderr),
    volume: parseVolumeDetectLog(volumePayload.stderr),
  };
}

async function maybeRunWhisperProfileSample(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  transcriptSampleSeconds
) {
  const profileReadiness = toRecord(toRecord(project.profile).readiness);
  const selectedModel =
    (Array.isArray(profileReadiness.models) ? profileReadiness.models : []).find(function (entry) {
      return toRecord(entry).selected === true;
    }) || null;
  if (!selectedModel || selectedModel.ready !== true) {
    return null;
  }

  const modelPath = asNonEmptyString(selectedModel.path);
  if (modelPath === null) {
    return null;
  }

  const language = asNonEmptyString(selectedModel.language) || "en";
  const sampleWavPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-speech.wav`;
  const transcriptBase = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-transcript`;
  const transcriptPath = `${transcriptBase}.txt`;

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProfileDir(runtime, project),
    args: [
      "-y",
      "-i",
      target.path,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-t",
      String(Math.max(5, Math.round(asNumber(transcriptSampleSeconds) || 45))),
      sampleWavPath,
    ],
    timeoutMs: 120_000,
  });
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "whisper.cpp",
    cwd: getProjectProfileDir(runtime, project),
    args: ["-m", modelPath, "-f", sampleWavPath, "-l", language, "-otxt", "-of", transcriptBase],
    timeoutMs: 8 * 60 * 1000,
  });

  const transcriptText = asNonEmptyString(await readTextFile(transcriptPath));
  if (transcriptText === null) {
    return null;
  }

  const artifact = createProfileArtifact("transcript", transcriptPath, "Transcript Sample", {
    wordCount: transcriptText.split(/\s+/).filter(Boolean).length,
    language: language,
  });

  return {
    text: transcriptText,
    artifact: artifact,
  };
}

function buildSyntheticProfileSignal(signals, sensitivity, artifactIds) {
  const score = signals.reduce(function (total, entry) {
    const signal = toRecord(entry);
    const level = asNonEmptyString(signal.level) || "low";
    return total + (level === "high" ? 3 : level === "medium" ? 2 : 1);
  }, 0);
  const threshold = sensitivity >= 0.68 ? 4 : sensitivity >= 0.5 ? 5 : 6;
  if (score < threshold) {
    return null;
  }

  const level = score >= threshold + 3 ? "high" : "medium";
  const confidence = score >= threshold + 2 ? "medium" : "low";
  return createProfileSignal(
    "synthetic-suspicion",
    "derived",
    level,
    confidence,
    "Composite suspicion score elevated",
    "Multiple weak structure, continuity, or audio anomalies overlap in the sampled profile pass.",
    signals.length,
    artifactIds
  );
}

async function runProfilePreflight(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  ensureProfileToolReady(runtime);
  ensureProfileJobSlotAvailable(runtime, project.id, "profile-run-preflight");
  await ensureProjectDirectories(runtime, project, requestId);

  const projectedProject = clone(project);
  syncProjectFeatureProjections(runtime, projectedProject);
  const readiness = toRecord(projectedProject.profile.readiness);
  if (readiness.stageReady !== true) {
    throw new Error(
      (Array.isArray(readiness.blockers) ? readiness.blockers[0] : null) ||
        "Resolve the profile blockers before running preflight."
    );
  }

  const target = toRecord(readiness.target);
  const artifactBase = sanitizeFileSegment(
    `${project.slug}-${asNonEmptyString(projectedProject.profile.activePresetId) || "profile"}-${Date.now()}`,
    "profile-pass"
  );
  const jobId = `room-profile-preflight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sampleWindowSeconds = asNumber(toRecord(projectedProject.profile.estimate).sampleWindowSeconds) || 45;
  const sourceKind = asNonEmptyString(project.source.kind) || "video";
  const artifactPreferences = normalizeProfileArtifactPreferences(
    toRecord(projectedProject.profile.artifactPreferences),
    runtime.profileCapabilities,
    sourceKind
  );
  const frameTileCount = Math.max(
    2,
    Math.round(
      asNumber(
        toRecord(getProfileFrameDensityRuntimeConfig(runtime, projectedProject.profile.frameSampleDensity))
          .tileCount
      ) || 4
    )
  );
  const transcriptSampleSeconds = clampProfileTranscriptSampleSeconds(
    runtime.profileCapabilities,
    projectedProject.profile.transcriptSampleSeconds
  );

  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "profile-run-preflight",
    projectId: project.id,
    toolId: "ffmpeg",
    featureStage: "profile",
  });
  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "profile-run-preflight",
    projectId: project.id,
    toolId: "ffmpeg",
    featureStage: "profile",
    stage: "queued",
  });

  await patchActiveProject(runtime, function (nextProject) {
    nextProject.profile.lastError = null;
    nextProject.profile.lastActionAt = new Date().toISOString();
    nextProject.profile.preflight = {
      ...createEmptyProfilePreflight(),
      ...toRecord(nextProject.profile.preflight),
      status: "running",
      jobId: jobId,
      requestId: requestId,
      warnings: Array.isArray(readiness.warnings) ? readiness.warnings.slice() : [],
      error: null,
    };
    return nextProject;
  });

  try {
    const artifacts = [];
    const signals = [];
    const metadataArtifact =
      artifactPreferences.metadata === true
        ? await generateProfileMetadataArtifact(runtime, project, target, artifactBase)
        : null;
    if (metadataArtifact) {
      artifacts.push(metadataArtifact);
    }

    if (artifactPreferences["frame-strip"] === true && (sourceKind === "video" || sourceKind === "image")) {
      try {
        const frameArtifact = await generateProfileFrameStrip(
          runtime,
          project,
          requestId,
          jobId,
          target,
          artifactBase,
          sampleWindowSeconds,
          frameTileCount
        );
        if (frameArtifact) {
          artifacts.push(frameArtifact);
        }
      } catch (_error) {
        // Optional artifact.
      }
    }

    if (artifactPreferences.spectrogram === true && (sourceKind === "video" || sourceKind === "audio")) {
      try {
        const spectrogramArtifact = await generateProfileSpectrogram(
          runtime,
          project,
          requestId,
          jobId,
          target,
          artifactBase
        );
        if (spectrogramArtifact) {
          artifacts.push(spectrogramArtifact);
        }
      } catch (_error) {
        // Optional artifact.
      }
    }

    const artifactIds = artifacts.map(function (artifact) {
      return artifact.id;
    });
    const metadata = normalizeSourceMetadata(target.metadata);

    if (
      (Array.isArray(readiness.enabledLaneIds) ? readiness.enabledLaneIds : []).includes("metadata-lineage") &&
      (!metadata || asNonEmptyString(toRecord(metadata).formatName) === null)
    ) {
      signals.push(
        createProfileSignal(
          "metadata-lineage",
          "measured",
          "medium",
          "medium",
          "Metadata lineage is incomplete",
          "The sampled asset is missing a clear container or format declaration from ffprobe.",
          1,
          artifactIds
        )
      );
    }

    if (
      sourceKind === "video" &&
      (Array.isArray(readiness.enabledLaneIds) ? readiness.enabledLaneIds : []).includes("visual-tamper")
    ) {
      const videoProbe = await runVideoStructureProbe(runtime, project, requestId, jobId, target);
      if (videoProbe.freeze.count > 0) {
        signals.push(
          createProfileSignal(
            "visual-tamper",
            "measured",
            videoProbe.freeze.count > 2 ? "high" : "medium",
            "medium",
            "Freeze intervals detected",
            `The sampled window contains ${videoProbe.freeze.count} freeze interval(s).`,
            videoProbe.freeze.count,
            artifactIds
          )
        );
      }
      if (videoProbe.black.count > 0) {
        signals.push(
          createProfileSignal(
            "visual-tamper",
            "measured",
            "low",
            "low",
            "Black interval transitions detected",
            `Black interval analysis found ${videoProbe.black.count} transition(s).`,
            videoProbe.black.count,
            artifactIds
          )
        );
      }
    }

    if (
      (sourceKind === "video" || sourceKind === "audio") &&
      ((Array.isArray(readiness.enabledLaneIds) ? readiness.enabledLaneIds : []).includes("audio-tamper") ||
        (Array.isArray(readiness.enabledLaneIds) ? readiness.enabledLaneIds : []).includes("speech-overlay"))
    ) {
      const audioProbe = await runAudioStructureProbe(runtime, project, requestId, jobId, target);
      if (audioProbe.silence.count > 0) {
        signals.push(
          createProfileSignal(
            "audio-tamper",
            "measured",
            audioProbe.silence.count > 3 ? "medium" : "low",
            "medium",
            "Silence pockets detected",
            `Silence detection found ${audioProbe.silence.count} pocket(s) in the sampled audio path.`,
            audioProbe.silence.count,
            artifactIds
          )
        );
      }
      if (
        typeof audioProbe.volume.meanVolumeDb === "number" &&
        typeof audioProbe.volume.maxVolumeDb === "number" &&
        audioProbe.volume.maxVolumeDb - audioProbe.volume.meanVolumeDb > 18
      ) {
        signals.push(
          createProfileSignal(
            "audio-tamper",
            "heuristic",
            "low",
            "low",
            "Wide loudness spread observed",
            "The sampled loudness spread is wider than a typical continuous dialogue pass.",
            1,
            artifactIds
          )
        );
      }

      try {
        const transcriptResult =
          artifactPreferences.transcript === true
            ? await maybeRunWhisperProfileSample(
                runtime,
                project,
                requestId,
                jobId,
                target,
                artifactBase,
                transcriptSampleSeconds
              )
            : null;
        if (transcriptResult && transcriptResult.artifact) {
          artifacts.push(transcriptResult.artifact);
          artifactIds.push(transcriptResult.artifact.id);
          signals.push(
            createProfileSignal(
              "speech-overlay",
              "measured",
              "low",
              "medium",
              "Transcript sample captured",
              `Whisper sample returned ${
                transcriptResult.text.split(/\s+/).filter(Boolean).length
              } words from the sampled audio window.`,
              1,
              [transcriptResult.artifact.id]
            )
          );
        }
      } catch (_error) {
        // Transcript sampling stays optional in MVP.
      }
    }

    const syntheticSignal = buildSyntheticProfileSignal(
      signals.filter(function (entry) {
        return asNonEmptyString(toRecord(entry).laneId) !== "speech-overlay";
      }),
      clampNumber(projectedProject.profile.sensitivity, 0.1, 1, 0.58),
      artifactIds
    );
    if (syntheticSignal) {
      signals.push(syntheticSignal);
    }

    const completedAt = new Date().toISOString();
    await patchActiveProject(runtime, function (nextProject) {
      nextProject.profile.dirty = false;
      nextProject.profile.lastError = null;
      nextProject.profile.lastActionAt = completedAt;
      nextProject.profile.signals = signals;
      nextProject.profile.artifacts = artifacts;
      nextProject.profile.preflight = {
        status: "ready",
        jobId: jobId,
        requestId: requestId,
        ranAt: completedAt,
        targetSummary: {
          requestedMode: target.requestedMode,
          mode: target.mode,
          outputId: target.outputId,
          signature: target.signature,
          label: target.label,
          fileName: target.fileName,
          mimeType: target.mimeType,
          path: target.path,
        },
        warnings: Array.isArray(readiness.warnings) ? readiness.warnings.slice() : [],
        error: null,
      };
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "profile-run-preflight",
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "profile",
      stage: "completed",
      percent: 100,
    });
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      nextProject.profile.lastError = error instanceof Error ? error.message : String(error);
      nextProject.profile.lastActionAt = new Date().toISOString();
      nextProject.profile.preflight = {
        ...createEmptyProfilePreflight(),
        ...toRecord(nextProject.profile.preflight),
        status: "error",
        jobId: jobId,
        requestId: requestId,
        error: error instanceof Error ? error.message : String(error),
      };
      return nextProject;
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "profile-run-preflight",
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "profile",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

function resolveAudioFeatureTarget(project) {
  const source = toRecord(project.source);
  const activeOutputId = asNonEmptyString(toRecord(project.edit).activeOutputId);
  const activeOutput = findEditOutputById(project, activeOutputId);
  if (
    asNonEmptyString(toRecord(project.edit).handoffMode) === "derived" &&
    activeOutput !== null &&
    asNonEmptyString(toRecord(activeOutput).path) !== null
  ) {
    const output = normalizeEditOutput(activeOutput);
    return {
      requestedMode: "derived",
      mode: "derived",
      outputId: output.id,
      path: output.path,
      fileName: output.fileName,
      mimeType: output.mimeType,
      metadata: normalizeSourceMetadata(output.metadata),
      signature: buildDerivedTargetSignature(output),
      label: output.label || output.fileName || output.id,
      usingFallback: false,
      reason: null,
    };
  }

  return {
    requestedMode: "source",
    mode: "source",
    outputId: null,
    path: asNonEmptyString(source.storedPath),
    fileName: asNonEmptyString(source.storedFileName),
    mimeType: asNonEmptyString(source.mimeType),
    metadata: normalizeSourceMetadata(source.metadata),
    signature: asNonEmptyString(source.storedPath) !== null ? buildSourceTargetSignature(project) : null,
    label: asNonEmptyString(source.storedFileName) || project.name,
    usingFallback: false,
    reason: null,
  };
}

function resolveProcessTarget(project, featureId) {
  if (featureId === AUDIO_FEATURE_ID) {
    return resolveAudioFeatureTarget(project);
  }
  if (featureId === SUBTITLE_FEATURE_ID) {
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
      signature: selectedEntries
        .map(function (entry) {
          return `${entry.id}:${entry.path || entry.fileName}`;
        })
        .join("|"),
      label:
        selectedEntries.length > 1
          ? `${selectedEntries.length} subtitle files`
          : activeEntry
            ? activeEntry.fileName || project.name
            : project.name,
      entries: selectedEntries,
      usingFallback: false,
      reason: null,
    };
  }
  return resolveProfileTarget(project);
}

function createQueuedProcessModule(id, labelKey, title, summary) {
  return normalizeProcessModule({
    id: id,
    labelKey: labelKey,
    title: title,
    status: "queued",
    percent: 0,
    summary: summary || "",
    warnings: [],
    artifactIds: [],
    findingIds: [],
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
      asNonEmptyString(toRecord(project.edit).handoffMode) === "derived"
        ? "Using the selected derived output as the active analysis handoff."
        : "Using the original source as the active analysis handoff."
    )
  );
  modules.push(
    normalizeProcessModule({
      ...createQueuedProcessModule("motion", "mediaAnalysis.process.steps.motion", "Motion Analysis", ""),
      status:
        sourceKind === "video" && enabledLaneIds.includes("visual-tamper")
          ? "queued"
          : sourceKind === "video"
            ? "skipped"
            : "skipped",
      summary:
        sourceKind === "video" && enabledLaneIds.includes("visual-tamper")
          ? "Visual tamper checks will run on the pinned target."
          : "Motion analysis is not active for this target.",
    })
  );
  modules.push(
    normalizeProcessModule({
      ...createQueuedProcessModule("audio", "mediaAnalysis.process.steps.audio", "Audio Sweep", ""),
      status:
        (sourceKind === "video" || sourceKind === "audio") &&
        (enabledLaneIds.includes("audio-tamper") || enabledLaneIds.includes("speech-overlay"))
          ? "queued"
          : "skipped",
      summary:
        sourceKind === "video" || sourceKind === "audio"
          ? "Audio continuity, loudness, and optional transcript checks will run."
          : "Audio sweep is not applicable to this target.",
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

function getSubtitleAnalysisModuleDescriptors(runtime) {
  const modules = toRecord(runtime.subtitleAnalysisCatalog).modules;
  return Array.isArray(modules) ? modules.map(toRecord) : [];
}

function buildSubtitleProcessModules(runtime, target) {
  const capabilities = toRecord(runtime.subtitleAnalysisCapabilities).modules;
  const targetEntries = Array.isArray(target.entries) ? target.entries : [];

  return getSubtitleAnalysisModuleDescriptors(runtime).map(function (entry) {
    const moduleId = asNonEmptyString(entry.id) || `subtitle-module-${Date.now()}`;
    const capability = toRecord(capabilities[moduleId]);
    const configuredStatus = asNonEmptyString(capability.status) || asNonEmptyString(entry.status) || "planned";
    let status = configuredStatus === "ready" || configuredStatus === "implemented" ? "queued" : configuredStatus;
    let summary = "Reserved for the later subtitle rollout.";

    if (targetEntries.length === 0) {
      status = "blocked";
      summary = "Import subtitle files before running subtitle analysis.";
    } else if (configuredStatus === "planned") {
      status = "planned";
      summary = "Reserved for the next subtitle analysis rollout.";
    } else if (configuredStatus === "ready" || configuredStatus === "implemented") {
      summary = "Queued for the local subtitle analysis run.";
    }

    return normalizeProcessModule({
      id: moduleId,
      title: asNonEmptyString(entry.label) || formatIdentifierLabel(moduleId),
      status: status,
      percent: 0,
      summary: summary,
      warnings: [],
      artifactIds: [],
      findingIds: [],
    });
  });
}

function tokenizeSubtitleWords(textValue) {
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "you",
    "your",
    "from",
    "have",
    "are",
    "bir",
    "ve",
    "ile",
    "bu",
    "icin",
    "için",
    "ama",
    "gibi",
    "daha",
    "cok",
    "çok",
    "kadar",
  ]);

  return String(textValue || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .split(/\s+/)
    .map(function (entry) {
      return entry.trim();
    })
    .filter(function (entry) {
      return entry.length >= 3 && stopwords.has(entry) !== true;
    });
}

function buildSubtitleDocumentStats(entry, rawText) {
  const cues = parseSubtitleCues(rawText, entry.format);
  const textLines = cues.flatMap(function (cue) {
    return Array.isArray(cue.textLines) ? cue.textLines : [];
  });
  const lineLengths = textLines.map(function (line) {
    return String(line || "").trim().length;
  });
  const words = tokenizeSubtitleWords(
    cues
      .map(function (cue) {
        return cue.text || "";
      })
      .join(" ")
  );
  const wordFrequency = words.reduce(function (accumulator, word) {
    accumulator[word] = (accumulator[word] || 0) + 1;
    return accumulator;
  }, {});
  let overlapCount = 0;
  let invalidDurationCount = 0;
  let emptyCueCount = 0;
  let totalCps = 0;
  let cpsCount = 0;

  for (let index = 0; index < cues.length; index += 1) {
    const cue = toRecord(cues[index]);
    const nextText = String(cue.text || "").trim();
    const startSeconds = asNumber(cue.startSeconds);
    const endSeconds = asNumber(cue.endSeconds);

    if (nextText === "") {
      emptyCueCount += 1;
    }
    if (startSeconds !== null && endSeconds !== null) {
      if (endSeconds <= startSeconds) {
        invalidDurationCount += 1;
      } else {
        totalCps += nextText.length / Math.max(0.01, endSeconds - startSeconds);
        cpsCount += 1;
      }
      if (index > 0) {
        const previousCue = toRecord(cues[index - 1]);
        if (asNumber(previousCue.endSeconds) !== null && startSeconds < asNumber(previousCue.endSeconds)) {
          overlapCount += 1;
        }
      }
    }
  }

  const topWords = Object.keys(wordFrequency)
    .map(function (word) {
      return {
        word: word,
        count: wordFrequency[word],
      };
    })
    .sort(function (left, right) {
      return right.count - left.count || left.word.localeCompare(right.word);
    })
    .slice(0, 8);

  return {
    entryId: entry.id,
    fileName: entry.fileName,
    format: entry.format,
    language: entry.language,
    cueCount: cues.length,
    lineCount: textLines.length,
    maxLineLength: lineLengths.reduce(function (maxValue, lineLength) {
      return Math.max(maxValue, lineLength);
    }, 0),
    longLineCount: lineLengths.filter(function (lineLength) {
      return lineLength > 42;
    }).length,
    overlapCount: overlapCount,
    invalidDurationCount: invalidDurationCount,
    emptyCueCount: emptyCueCount,
    averageCharsPerLine:
      lineLengths.length > 0
        ? lineLengths.reduce(function (sum, lineLength) {
            return sum + lineLength;
          }, 0) / lineLengths.length
        : 0,
    averageCps: cpsCount > 0 ? totalCps / cpsCount : null,
    wordCount: words.length,
    vocabularySize: Object.keys(wordFrequency).length,
    topWords: topWords,
  };
}

async function buildSubtitleAnalysisStats(runtime, project, target) {
  const entries = Array.isArray(target.entries) ? target.entries : [];
  const documents = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry && entry.path) {
      const rawText = await readSubtitleText(entry.path);
      documents.push(buildSubtitleDocumentStats(entry, rawText));
    }
  }

  const topWords = documents
    .flatMap(function (document) {
      return Array.isArray(document.topWords) ? document.topWords : [];
    })
    .reduce(function (accumulator, entry) {
      accumulator[entry.word] = (accumulator[entry.word] || 0) + (Number(entry.count) || 0);
      return accumulator;
    }, {});

  return {
    documents: documents,
    totalFiles: documents.length,
    totalCues: documents.reduce(function (sum, document) {
      return sum + document.cueCount;
    }, 0),
    totalLines: documents.reduce(function (sum, document) {
      return sum + document.lineCount;
    }, 0),
    longLineCount: documents.reduce(function (sum, document) {
      return sum + document.longLineCount;
    }, 0),
    overlapCount: documents.reduce(function (sum, document) {
      return sum + document.overlapCount;
    }, 0),
    invalidDurationCount: documents.reduce(function (sum, document) {
      return sum + document.invalidDurationCount;
    }, 0),
    emptyCueCount: documents.reduce(function (sum, document) {
      return sum + document.emptyCueCount;
    }, 0),
    averageCharsPerLine:
      documents.length > 0
        ? documents.reduce(function (sum, document) {
            return sum + document.averageCharsPerLine;
          }, 0) / documents.length
        : 0,
    averageCps:
      documents.filter(function (document) {
        return typeof document.averageCps === "number";
      }).length > 0
        ? documents
            .filter(function (document) {
              return typeof document.averageCps === "number";
            })
            .reduce(function (sum, document) {
              return sum + document.averageCps;
            }, 0) /
          documents.filter(function (document) {
            return typeof document.averageCps === "number";
          }).length
        : null,
    uniqueFormats: Array.from(
      new Set(
        documents
          .map(function (document) {
            return asNonEmptyString(document.format);
          })
          .filter(Boolean)
      )
    ),
    uniqueLanguages: Array.from(
      new Set(
        documents
          .map(function (document) {
            return asNonEmptyString(document.language);
          })
          .filter(Boolean)
      )
    ),
    topWords: Object.keys(topWords)
      .map(function (word) {
        return {
          word: word,
          count: topWords[word],
        };
      })
      .sort(function (left, right) {
        return right.count - left.count || left.word.localeCompare(right.word);
      })
      .slice(0, 10),
  };
}

function buildAudioAnalysisModules(runtime, project, target) {
  const catalogModules = getAudioAnalysisModulesForRuntime(runtime);
  const providerState = buildAudioAnalysisProviderState(runtime, project);
  const capabilityState = buildAudioAnalysisCapabilityState(runtime, project, target, providerState);

  return catalogModules.map(function (entry) {
    const moduleId = asNonEmptyString(entry.id) || "audio-module";
    const capabilityEntry = toRecord(capabilityState[moduleId]);
    const status = asNonEmptyString(capabilityEntry.status) || asNonEmptyString(entry.status) || "planned";
    const blockers = normalizeStringArray(capabilityEntry.blockers);
    const warnings = normalizeStringArray(capabilityEntry.warnings);

    if (status === "planned") {
      return normalizeProcessModule({
        id: moduleId,
        labelKey: asNonEmptyString(entry.titleKey),
        title: moduleId,
        status: "planned",
        summary: "Reserved for the later rollout.",
      });
    }
    if (status === "gated") {
      return normalizeProcessModule({
        id: moduleId,
        labelKey: asNonEmptyString(entry.titleKey),
        title: moduleId,
        status: "gated",
        summary:
          warnings[0] || "This module remains capability-gated on the current runtime.",
      });
    }
    if (status === "blocked") {
      return normalizeProcessModule({
        id: moduleId,
        labelKey: asNonEmptyString(entry.titleKey),
        title: moduleId,
        status: "blocked",
        summary:
          blockers[0] || "Resolve the module blockers before starting the run.",
      });
    }
    return normalizeProcessModule({
      id: moduleId,
      labelKey: asNonEmptyString(entry.titleKey),
      title: moduleId,
      status: status === "ready" ? "queued" : status,
      summary:
        status === "ready"
          ? "Queued for the managed audio analysis run."
          : warnings[0] || blockers[0] || "Audio analysis module state is waiting on provider readiness.",
    });
  });
}

function getAudioAnalysisModulesForRuntime(runtime) {
  const modules = toRecord(runtime.audioAnalysisCatalog).modules;
  return Array.isArray(modules) ? modules.map(toRecord) : [];
}

function buildProcessSpeechAvailability(runtime, project) {
  const summaries = buildProfileModelSummary(runtime, project);
  const selected =
    summaries.find(function (entry) {
      return entry.selected === true;
    }) || null;
  const readyModel =
    selected && selected.ready === true
      ? selected
      : summaries.find(function (entry) {
          return toRecord(entry).ready === true;
        }) || null;
  return {
    ready: readyModel !== null,
    model: readyModel,
  };
}

function createEmptyProcessRun(featureId) {
  return createEmptyFeatureProcessRecord(featureId);
}

function updateProcessRecordPercent(record) {
  const modules = Array.isArray(record.modules) ? record.modules.map(toRecord) : [];
  if (modules.length === 0) {
    record.percent = record.status === "ready" ? 100 : 0;
    return record;
  }

  const total = modules.reduce(function (sum, moduleEntry) {
    const status = asNonEmptyString(moduleEntry.status) || "idle";
    if (status === "running" || status === "queued" || status === "idle") {
      return sum + Math.max(0, Math.min(100, Math.round(asNumber(moduleEntry.percent) || 0)));
    }
    return sum + 100;
  }, 0);
  record.percent = Math.max(0, Math.min(100, Math.round(total / modules.length)));
  return record;
}

function updateProcessModule(record, moduleId, patch) {
  const modules = Array.isArray(record.modules) ? record.modules.map(normalizeProcessModule) : [];
  const moduleIndex = modules.findIndex(function (entry) {
    return entry.id === moduleId;
  });
  if (moduleIndex === -1) {
    return record;
  }
  modules[moduleIndex] = normalizeProcessModule({
    ...modules[moduleIndex],
    ...toRecord(patch),
  });
  record.modules = modules;
  return updateProcessRecordPercent(record);
}

function getFeatureProcessJobAction(featureId) {
  return featureId === AUDIO_FEATURE_ID ? "audio-process-run" : "process-run";
}

function getFeatureReportExportAction(featureId) {
  return featureId === AUDIO_FEATURE_ID ? "audio-report-export" : "report-export";
}

function markFeatureProcessStale(project, featureId, reason) {
  const existing = getFeatureProcessRecord(project, featureId);
  setFeatureProcessRecord(project, featureId, {
    ...existing,
    status: existing.completedAt ? "stale" : "idle",
    jobId: null,
    requestId: null,
    runId: existing.runId,
    percent: 0,
    warnings: Array.from(new Set((existing.warnings || []).concat(reason ? [reason] : []))),
    error: null,
  });
  project.process.lastError = null;
  project.process.lastActionAt = new Date().toISOString();
}

function markFeatureReportStale(project, featureId, reason) {
  const existing = getFeatureReportRecord(project, featureId);
  setFeatureReportRecord(project, featureId, {
    ...existing,
    status: existing.generatedAt ? "stale" : "idle",
    warnings: Array.from(new Set((existing.warnings || []).concat(reason ? [reason] : []))),
    error: null,
  });
  project.report.lastError = null;
  project.report.lastActionAt = new Date().toISOString();
}

function markCloseoutAsStale(project, reason, featureIds) {
  const targetFeatures = Array.isArray(featureIds) && featureIds.length > 0 ? featureIds : FEATURE_IDS;
  targetFeatures.forEach(function (featureId) {
    markFeatureProcessStale(project, featureId, reason);
    markFeatureReportStale(project, featureId, reason);
  });
}

async function generateProcessMetadataArtifact(runtime, project, target, artifactBase, outputDir, moduleId) {
  const metadataPath = `${outputDir}/${artifactBase}-metadata.json`;
  await writeJsonFile(metadataPath, {
    generatedAt: new Date().toISOString(),
    target: clone(target),
    metadata: clone(target.metadata || {}),
  });
  return createProcessArtifact(moduleId, "metadata", metadataPath, "Metadata Snapshot", {
    mode: target.mode,
  });
}

function getAudioAnalysisProcessRootDir(runtime, project) {
  return `${getProjectProcessDir(runtime, project)}/audio-analysis`;
}

function getAudioAnalysisModuleProcessDir(runtime, project, moduleId) {
  return `${getAudioAnalysisProcessRootDir(runtime, project)}/${sanitizeFileSegment(moduleId, "audio-module")}`;
}

async function generateProcessSpectrogram(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId) {
  const outputPath = `${outputDir}/${artifactBase}-spectrogram.png`;
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProcessDir(runtime, project),
    args: ["-y", "-i", target.path, "-lavfi", "showspectrumpic=s=1600x440:legend=0", "-frames:v", "1", outputPath],
    timeoutMs: 90_000,
  });
  return createProcessArtifact(moduleId, "spectrogram", outputPath, "Spectrogram", {});
}

async function generateProcessWaveform(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId) {
  const outputPath = `${outputDir}/${artifactBase}-waveform.png`;
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProcessDir(runtime, project),
    args: ["-y", "-i", target.path, "-filter_complex", "showwavespic=s=1600x440:split_channels=0", "-frames:v", "1", outputPath],
    timeoutMs: 90_000,
  });
  return createProcessArtifact(moduleId, "waveform", outputPath, "Waveform", {});
}

async function generateSpectralDescriptorArtifact(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  outputDir,
  moduleId
) {
  const textPath = `${outputDir}/${artifactBase}-spectral.txt`;
  const jsonPath = `${outputDir}/${artifactBase}-spectral.json`;
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProcessDir(runtime, project),
    args: [
      "-y",
      "-i",
      target.path,
      "-af",
      `aspectralstats=measure=centroid+rolloff+flatness+flux,ametadata=mode=print:file=${textPath}:direct=1`,
      "-f",
      "null",
      "-",
    ],
    timeoutMs: 90_000,
  });

  const descriptorSummary = parseAspectralStatsText(await readTextFile(textPath));
  await writeJsonFile(jsonPath, {
    generatedAt: new Date().toISOString(),
    target: clone(target),
    descriptorSummary: descriptorSummary,
  });
  return createProcessArtifact(moduleId, "spectral-descriptors", jsonPath, "Spectral Descriptor Summary", {
    descriptorSummary: descriptorSummary,
  });
}

async function runSignalHealthAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  _artifactBase,
  _moduleOutputDir,
  moduleId
) {
  const audioProbe = await runAudioStructureProbe(runtime, project, requestId, jobId, target);
  const findings = [];
  const warnings = [];

  if (audioProbe.silence.count > 0) {
    findings.push(
      createProcessFinding(
        moduleId,
        "measured",
        audioProbe.silence.count > 3 ? "medium" : "low",
        "medium",
        "Silence pockets detected",
        `Silence detection found ${audioProbe.silence.count} pocket(s) inside the sampled audio path.`,
        audioProbe.silence.count,
        []
      )
    );
  }
  if (typeof audioProbe.volume.meanVolumeDb === "number") {
    warnings.push(`Mean volume: ${audioProbe.volume.meanVolumeDb} dB`);
  }

  return {
    findings: findings,
    artifacts: [],
    warnings: warnings,
    status: "ready",
    summary: "Signal health checks finished on the current target.",
  };
}

async function runSpectralArtifactsAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  moduleOutputDir,
  moduleId
) {
  await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
  await ensureRuntimeDirectory(moduleOutputDir, requestId);

  const spectrogram = await generateProcessSpectrogram(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  );
  const waveform = await generateProcessWaveform(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  );
  const descriptorArtifact = await generateSpectralDescriptorArtifact(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  );
  const artifacts = [spectrogram, waveform, descriptorArtifact].filter(Boolean);

  return {
    findings: descriptorArtifact
      ? [
          createProcessFinding(
            moduleId,
            "derived",
            "low",
            "medium",
            "Spectral descriptor baseline captured",
            "Centroid, rolloff, flatness, and flux summaries were derived from the active audio target.",
            4,
            [descriptorArtifact.id]
          ),
        ]
      : [],
    artifacts: artifacts,
    warnings: [],
    status: "ready",
    summary: "Spectral artifacts and descriptor summaries were generated for the current target.",
  };
}

async function runTranscriptionAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  _moduleOutputDir,
  moduleId
) {
  const speech = buildProcessSpeechAvailability(runtime, project);
  if (!speech.ready) {
    return {
      findings: [],
      artifacts: [],
      warnings: [],
      status: "blocked",
      summary: "Transcript tooling is not ready on this runtime.",
    };
  }

  const transcriptResult = await maybeRunWhisperProfileSample(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    45
  );
  if (transcriptResult && transcriptResult.artifact) {
    const transcriptArtifact = normalizeProcessArtifact({
      ...transcriptResult.artifact,
      moduleId: moduleId,
    });
    return {
      findings: [
        createProcessFinding(
          moduleId,
          "measured",
          "low",
          "medium",
          "Transcript sample captured",
          `Transcript sampling returned ${
            transcriptResult.text.split(/\s+/).filter(Boolean).length
          } words for the active audio target.`,
          1,
          [transcriptArtifact.id]
        ),
      ],
      artifacts: [transcriptArtifact],
      warnings: [],
      status: "ready",
      summary: "Transcript sampling finished for the active target.",
    };
  }

  return {
    findings: [],
    artifacts: [],
    warnings: [],
    status: "ready",
    summary: "Transcript tooling ran without a persisted sample artifact.",
  };
}

async function runProsodyAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  moduleOutputDir,
  moduleId
) {
  await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
  await ensureRuntimeDirectory(moduleOutputDir, requestId);

  if (resolveOpenSmileProsodyRuntime(runtime) === null) {
    return {
      findings: [],
      artifacts: [],
      warnings: ["Room-local openSMILE config package is unavailable on this runtime."],
      status: "blocked",
      summary: "Prosody config assets are missing from the room package.",
    };
  }

  const extraction = await runOpenSmileProsodyExtraction(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    "prosody"
  );
  const contourPath = extraction.contourPath;
  const summaryPath = `${moduleOutputDir}/${artifactBase}-prosody.json`;
  const prosodySummary = extraction.prosodySummary;
  await writeJsonFile(summaryPath, {
    generatedAt: new Date().toISOString(),
    target: clone(target),
    prosodySummary: prosodySummary,
  });

  const contourArtifact = createProcessArtifact(
    moduleId,
    "prosody-contours",
    contourPath,
    "Prosody Contours",
    {
      columnCount: prosodySummary.columns.length,
      frameCount: prosodySummary.frameCount,
    }
  );
  const summaryArtifact = createProcessArtifact(
    moduleId,
    "prosody-summary",
    summaryPath,
    "Prosody Summary",
    {
      prosodySummary: prosodySummary,
    }
  );
  const artifacts = [contourArtifact, summaryArtifact].filter(Boolean);
  const artifactIds = artifacts.map(function (artifact) {
    return artifact.id;
  });
  const detailParts = [
    typeof prosodySummary.frameCount === "number" ? `${prosodySummary.frameCount} frames` : null,
    typeof prosodySummary.meanF0Hz === "number"
      ? `mean F0 ${Number(prosodySummary.meanF0Hz).toFixed(1)} Hz`
      : null,
    typeof prosodySummary.estimatedPauseCount === "number"
      ? `${prosodySummary.estimatedPauseCount} estimated pauses`
      : null,
  ].filter(Boolean);

  return {
    findings: [
      createProcessFinding(
        moduleId,
        "derived",
        "low",
        "medium",
        "Prosody contour baseline captured",
        detailParts.length > 0
          ? `openSMILE produced ${detailParts.join(", ")} for the active audio target.`
          : "openSMILE produced a prosody contour baseline for the active audio target.",
        detailParts.length,
        artifactIds
      ),
    ],
    artifacts: artifacts,
    warnings: [],
    status: "ready",
    summary: "Prosody contours and pacing metrics were generated for the current target.",
  };
}

async function runEmotionHeuristicAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  moduleOutputDir,
  moduleId
) {
  await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
  await ensureRuntimeDirectory(moduleOutputDir, requestId);

  if (resolveOpenSmileProsodyRuntime(runtime) === null) {
    return {
      findings: [],
      artifacts: [],
      warnings: ["Room-local openSMILE config package is unavailable on this runtime."],
      status: "blocked",
      summary: "Emotion heuristics need the same packaged openSMILE config assets as prosody.",
    };
  }

  const extraction = await runOpenSmileProsodyExtraction(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    "emotion-prosody"
  );
  const heuristic = buildEmotionHeuristicFromProsody(extraction.prosodySummary);
  const summaryPath = `${moduleOutputDir}/${artifactBase}-emotion.json`;
  await writeJsonFile(summaryPath, {
    generatedAt: new Date().toISOString(),
    target: clone(target),
    emotionHeuristic: heuristic,
  });

  const summaryArtifact = createProcessArtifact(
    moduleId,
    "emotion-summary",
    summaryPath,
    "Emotion Heuristic Summary",
    {
      emotionHeuristic: heuristic,
    }
  );
  const artifacts = [summaryArtifact].filter(Boolean);
  const artifactIds = artifacts.map(function (artifact) {
    return artifact.id;
  });
  const cueText = Array.isArray(heuristic.cues) && heuristic.cues.length > 0 ? heuristic.cues.join(" ") : null;

  return {
    findings: [
      createProcessFinding(
        moduleId,
        "heuristic",
        "low",
        heuristic.confidence,
        "Heuristic emotion label generated",
        cueText !== null
          ? `${heuristic.label}. ${cueText} ${heuristic.disclaimer}`
          : `${heuristic.label}. ${heuristic.disclaimer}`,
        Array.isArray(heuristic.cues) ? heuristic.cues.length : 0,
        artifactIds
      ),
    ],
    artifacts: artifacts,
    warnings: [heuristic.disclaimer],
    status: "ready",
    summary: "A coarse heuristic emotion label was derived from prosody signals.",
  };
}

async function runSoundEventsAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  moduleOutputDir,
  moduleId
) {
  await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
  await ensureRuntimeDirectory(moduleOutputDir, requestId);

  const yamnetScriptPath = getAudioAnalysisYamnetScriptPath(runtime);
  if (yamnetScriptPath === null) {
    return {
      findings: [],
      artifacts: [],
      warnings: ["Room-local YAMNet helper script is unavailable on this runtime."],
      status: "blocked",
      summary: "YAMNet helper assets are missing from the room package.",
    };
  }

  const wavPath = `${moduleOutputDir}/${artifactBase}-yamnet.wav`;
  const summaryPath = `${moduleOutputDir}/${artifactBase}-sound-events.json`;

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProcessDir(runtime, project),
    args: ["-y", "-i", target.path, "-vn", "-ac", "1", "-ar", "16000", wavPath],
    timeoutMs: 3 * 60 * 1000,
  });

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "yamnet",
    cwd: getAudioAnalysisYamnetDir(runtime) || getProjectProcessDir(runtime, project),
    args: [yamnetScriptPath, "--input", wavPath, "--output", summaryPath, "--top-k", "8", "--threshold", "0.15"],
    timeoutMs: 8 * 60 * 1000,
  });

  const summaryPayload = toRecord(await readJsonFile(summaryPath));
  const topClasses = Array.isArray(summaryPayload.topClasses) ? summaryPayload.topClasses.map(toRecord) : [];
  const headline = topClasses[0] || null;
  const summaryArtifact = createProcessArtifact(
    moduleId,
    "sound-events-summary",
    summaryPath,
    "Sound Events Summary",
    {
      topClasses: topClasses,
      modelVersion: asNonEmptyString(summaryPayload.modelVersion),
      classCount: topClasses.length,
    }
  );
  const artifacts = [summaryArtifact].filter(Boolean);
  const artifactIds = artifacts.map(function (artifact) {
    return artifact.id;
  });
  const warningText =
    asNonEmptyString(summaryPayload.warning) ||
    "YAMNet predictions are broad sound-event suggestions and should be reviewed manually.";

  return {
    findings:
      headline !== null
        ? [
            createProcessFinding(
              moduleId,
              "model",
              "low",
              typeof headline.score === "number" && headline.score >= 0.35 ? "medium" : "low",
              "Top sound event candidates captured",
              `Top class: ${headline.label || headline.className || "unknown"} (${typeof headline.score === "number" ? headline.score.toFixed(3) : "n/a"}). ${warningText}`,
              topClasses.length,
              artifactIds
            ),
          ]
        : [],
    artifacts: artifacts,
    warnings: [warningText],
    status: "ready",
    summary: "Sound event candidates were generated from the active audio target.",
  };
}

async function runSpeakerDiarizationAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  moduleOutputDir,
  moduleId
) {
  await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
  await ensureRuntimeDirectory(moduleOutputDir, requestId);

  const diarizationScriptPath = getAudioAnalysisDiarizationScriptPath(runtime);
  if (diarizationScriptPath === null) {
    return {
      findings: [],
      artifacts: [],
      warnings: ["Room-local diarization helper script is unavailable on this runtime."],
      status: "blocked",
      summary: "Speaker diarization helper assets are missing from the room package.",
    };
  }

  const preparedInputBase = sanitizeFileSegment(`${artifactBase}-speaker-input`, "speaker-input");
  const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
  const summaryPath = `${moduleOutputDir}/${artifactBase}-speaker-diarization.json`;

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProcessDir(runtime, project),
    args: ["-y", "-i", target.path, "-vn", "-ac", "1", "-ar", "16000", preparedInputPath],
    timeoutMs: 4 * 60 * 1000,
  });

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "pyaudioanalysis",
    cwd: getAudioAnalysisDiarizationDir(runtime) || getProjectProcessDir(runtime, project),
    args: [diarizationScriptPath, "--input", preparedInputPath, "--output", summaryPath],
    timeoutMs: 12 * 60 * 1000,
  });

  const summaryPayload = toRecord(await readJsonFile(summaryPath));
  const segments = Array.isArray(summaryPayload.segments) ? summaryPayload.segments.map(toRecord) : [];
  const fallbackApplied = summaryPayload.fallbackApplied === true;
  const effectiveNumSpeakers = asNumber(summaryPayload.effectiveNumSpeakers);
  const diarizationSummary = {
    speakerCount: typeof summaryPayload.speakerCount === "number" ? summaryPayload.speakerCount : null,
    segmentCount: segments.length,
    durationSeconds: asNumber(summaryPayload.durationSeconds),
    purityCluster: asNumber(summaryPayload.purityCluster),
    puritySpeaker: asNumber(summaryPayload.puritySpeaker),
    effectiveNumSpeakers: effectiveNumSpeakers,
    speakerCountMode: asNonEmptyString(summaryPayload.speakerCountMode),
    fallbackApplied: fallbackApplied,
  };
  const summaryArtifact = createProcessArtifact(
    moduleId,
    "speaker-segments-summary",
    summaryPath,
    "Speaker Diarization Summary",
    {
      diarizationSummary: diarizationSummary,
      segments: segments,
    }
  );
  const artifacts = [summaryArtifact].filter(Boolean);
  const artifactIds = artifacts.map(function (artifact) {
    return artifact.id;
  });
  const detailParts = [
    typeof diarizationSummary.speakerCount === "number"
      ? `${diarizationSummary.speakerCount} speakers`
      : null,
    `${segments.length} segments`,
    typeof diarizationSummary.durationSeconds === "number"
      ? `${Number(diarizationSummary.durationSeconds).toFixed(1)}s analyzed`
      : null,
  ].filter(Boolean);
  const fallbackWarning =
    fallbackApplied
      ? "pyAudioAnalysis HMM smoothing failed for this clip, so the room-local diarization helper fell back to a KMeans-only segmentation path."
      : null;
  const reviewWarning =
    "pyAudioAnalysis diarization is a fully local heuristic pipeline; speaker boundaries should be reviewed manually.";
  const warningText = [fallbackWarning, reviewWarning].filter(Boolean).join(" ");

  return {
    findings: [
      createProcessFinding(
        moduleId,
        "descriptor",
        "low",
        "low",
        "Speaker timeline generated",
        detailParts.length > 0
          ? `The local diarization pipeline produced ${detailParts.join(", ")}. ${warningText}`
          : `The local diarization pipeline produced a speaker timeline. ${warningText}`,
        segments.length,
        artifactIds
      ),
    ],
    artifacts: artifacts,
    warnings: [fallbackWarning, reviewWarning].filter(Boolean),
    status: "ready",
    summary: "Speaker diarization generated a local speaker timeline for the active audio target.",
  };
}

async function runSourceSeparationAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  moduleOutputDir,
  moduleId
) {
  await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
  await ensureRuntimeDirectory(moduleOutputDir, requestId);

  const modelName = "htdemucs";
  const preparedInputBase = sanitizeFileSegment(`${artifactBase}-demucs-input`, "demucs-input");
  const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
  const stemDir = `${moduleOutputDir}/separated/${modelName}/${preparedInputBase}`;
  const manifestPath = `${moduleOutputDir}/${artifactBase}-stems.json`;

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProcessDir(runtime, project),
    args: ["-y", "-i", target.path, "-vn", "-ac", "2", "-ar", "44100", preparedInputPath],
    timeoutMs: 4 * 60 * 1000,
  });

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "demucs",
    cwd: moduleOutputDir,
    args: ["-m", "demucs", "-d", "cpu", "-n", modelName, preparedInputPath],
    timeoutMs: 30 * 60 * 1000,
  });

  const stemEntries = await listDirectory(stemDir);
  const stems = stemEntries
    .filter(function (entry) {
      return (
        entry &&
        entry.isDirectory !== true &&
        /\.(wav|mp3|flac|ogg|m4a)$/i.test(String(entry.name || ""))
      );
    })
    .map(function (entry) {
      const fileName = String(entry.name || "");
      return {
        path: entry.path,
        fileName: fileName,
        stemName: fileName.replace(/\.[^.]+$/, "") || fileName,
      };
    });

  if (stems.length === 0) {
    return {
      findings: [],
      artifacts: [],
      warnings: ["Demucs finished without producing any stem files in the expected output directory."],
      status: "failed",
      summary: "Source separation did not produce any isolated stems for the current target.",
    };
  }

  await writeJsonFile(manifestPath, {
    generatedAt: new Date().toISOString(),
    target: clone(target),
    modelName: modelName,
    preparedInputPath: preparedInputPath,
    stemDir: stemDir,
    stems: stems,
  });

  const stemArtifacts = stems
    .map(function (stem) {
      return createProcessArtifact(
        moduleId,
        "isolated-track",
        stem.path,
        `Separated Stem - ${stem.stemName}`,
        {
          stemName: stem.stemName,
          modelName: modelName,
        }
      );
    })
    .filter(Boolean);
  const summaryArtifact = createProcessArtifact(
    moduleId,
    "source-separation-manifest",
    manifestPath,
    "Source Separation Manifest",
    {
      modelName: modelName,
      stemCount: stems.length,
      stemNames: stems.map(function (stem) {
        return stem.stemName;
      }),
    }
  );
  const artifacts = [summaryArtifact].concat(stemArtifacts).filter(Boolean);
  const artifactIds = artifacts.map(function (artifact) {
    return artifact.id;
  });
  const warningText =
    "Demucs stems can contain bleed or musical artifacts, so isolated tracks should be reviewed manually.";

  return {
    findings: [
      createProcessFinding(
        moduleId,
        "model",
        "low",
        "medium",
        "Separated stem bundle generated",
        `Demucs (${modelName}) produced ${stems.length} isolated stem file(s): ${stems
          .map(function (stem) {
            return stem.stemName;
          })
          .join(", ")}. ${warningText}`,
        stems.length,
        artifactIds
      ),
    ],
    artifacts: artifacts,
    warnings: [warningText],
    status: "ready",
    summary: "Source separation generated isolated stems for the active audio target.",
  };
}

async function runMusicRhythmAudioAnalyzer(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  moduleOutputDir,
  moduleId
) {
  await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
  await ensureRuntimeDirectory(moduleOutputDir, requestId);

  const musicScriptPath = getAudioAnalysisMusicScriptPath(runtime);
  if (musicScriptPath === null) {
    return {
      findings: [],
      artifacts: [],
      warnings: ["Room-local music analysis helper script is unavailable on this runtime."],
      status: "blocked",
      summary: "Music analysis helper assets are missing from the room package.",
    };
  }

  const preparedInputBase = sanitizeFileSegment(`${artifactBase}-music-input`, "music-input");
  const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
  const summaryPath = `${moduleOutputDir}/${artifactBase}-music-analysis.json`;

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProcessDir(runtime, project),
    args: ["-y", "-i", target.path, "-vn", "-ac", "1", "-ar", "22050", preparedInputPath],
    timeoutMs: 4 * 60 * 1000,
  });

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "librosa",
    cwd: getAudioAnalysisMusicDir(runtime) || getProjectProcessDir(runtime, project),
    args: [musicScriptPath, "--input", preparedInputPath, "--output", summaryPath],
    timeoutMs: 10 * 60 * 1000,
  });

  const summaryPayload = toRecord(await readJsonFile(summaryPath));
  const musicSummary = toRecord(summaryPayload.musicSummary);
  const essentiaSummary = toRecord(summaryPayload.essentia);
  const summaryArtifact = createProcessArtifact(
    moduleId,
    "music-analysis-summary",
    summaryPath,
    "Music Analysis Summary",
    {
      musicSummary: musicSummary,
      essentia: essentiaSummary,
    }
  );
  const artifacts = [summaryArtifact].filter(Boolean);
  const artifactIds = artifacts.map(function (artifact) {
    return artifact.id;
  });
  const detailParts = [
    typeof musicSummary.tempoBpm === "number"
      ? `${Number(musicSummary.tempoBpm).toFixed(1)} BPM`
      : null,
    typeof musicSummary.dominantPitchClass === "string" &&
    musicSummary.dominantPitchClass.trim() !== ""
      ? `dominant pitch class ${musicSummary.dominantPitchClass}`
      : null,
    typeof musicSummary.beatCount === "number" ? `${musicSummary.beatCount} beat markers` : null,
  ].filter(Boolean);
  const warnings = [];
  if (asNonEmptyString(essentiaSummary.error) !== null) {
    warnings.push(asNonEmptyString(essentiaSummary.error));
  }
  warnings.push(
    "Music and rhythm analysis is descriptor-driven; tonal summaries should be treated as guidance rather than a full musicology readout."
  );

  return {
    findings: [
      createProcessFinding(
        moduleId,
        "descriptor",
        "low",
        essentiaSummary.available === true ? "medium" : "low",
        "Music descriptor summary generated",
        detailParts.length > 0
          ? `The music analysis helper produced ${detailParts.join(", ")} for the active target.`
          : "The music analysis helper produced a descriptor summary for the active target.",
        detailParts.length,
        artifactIds
      ),
    ],
    artifacts: artifacts,
    warnings: warnings.filter(Boolean),
    status: "ready",
    summary: "Music and rhythm descriptors were generated for the active audio target.",
  };
}

function getAudioAnalysisModuleRunner(moduleId) {
  const runners = {
    "signal-health": runSignalHealthAudioAnalyzer,
    "spectral-artifacts": runSpectralArtifactsAudioAnalyzer,
    transcription: runTranscriptionAudioAnalyzer,
    "speaker-diarization": runSpeakerDiarizationAudioAnalyzer,
    prosody: runProsodyAudioAnalyzer,
    emotion: runEmotionHeuristicAudioAnalyzer,
    "sound-events": runSoundEventsAudioAnalyzer,
    "source-separation": runSourceSeparationAudioAnalyzer,
    "music-rhythm-tonal": runMusicRhythmAudioAnalyzer,
  };
  return runners[moduleId] || null;
}

async function runManagedProcess(runtime, project, requestId, jobId, featureId) {
  const target = resolveProcessTarget(project, featureId);
  if (featureId === SUBTITLE_FEATURE_ID) {
    if (!Array.isArray(target.entries) || target.entries.length === 0) {
      throw new Error("Import subtitle files before starting subtitle analysis.");
    }
  } else if (target.path === null) {
    throw new Error("Prepare a valid target before starting the process stage.");
  }

  const outputDir = getProjectProcessDir(runtime, project);
  const artifactBase = sanitizeFileSegment(
    `${project.slug}-${featureId}-${Date.now()}`,
    featureId === AUDIO_FEATURE_ID ? "audio-process" : "media-process"
  );
  const processRecord = createEmptyProcessRun(featureId);
  processRecord.status = "running";
  processRecord.requestId = requestId;
  processRecord.jobId = jobId;
  processRecord.runId = `${featureId}-run-${Date.now()}`;
  processRecord.startedAt = new Date().toISOString();
  processRecord.targetSummary = {
    requestedMode: target.requestedMode,
    mode: target.mode,
    outputId: target.outputId,
    signature: target.signature,
    label: target.label,
    fileName: target.fileName,
    mimeType: target.mimeType,
    path: target.path,
    entryCount: Array.isArray(target.entries) ? target.entries.length : null,
  };
  processRecord.modules =
    featureId === AUDIO_FEATURE_ID
      ? buildAudioAnalysisModules(runtime, project, target)
      : featureId === SUBTITLE_FEATURE_ID
        ? buildSubtitleProcessModules(runtime, target)
      : buildMediaProcessModules(runtime, project, target);

  const findings = [];
  const artifacts = [];
  const warnings = [];

  if (featureId === SUBTITLE_FEATURE_ID) {
    const stats = await buildSubtitleAnalysisStats(runtime, project, target);
    const subtitleProcessDir = getProjectSubtitleProcessDir(runtime, project);
    const summaryPath = `${subtitleProcessDir}/${artifactBase}-subtitle-summary.json`;
    const topWordsPath = `${subtitleProcessDir}/${artifactBase}-top-words.txt`;
    const moduleArtifactIds = {};

    await writeJsonFile(summaryPath, {
      generatedAt: new Date().toISOString(),
      target: clone(processRecord.targetSummary),
      stats: clone(stats),
    });

    const summaryArtifact = createProcessArtifact(
      "batch-summary",
      "subtitle-summary",
      summaryPath,
      "Subtitle Summary",
      {
        totalFiles: stats.totalFiles,
        totalCues: stats.totalCues,
      }
    );
    if (summaryArtifact) {
      artifacts.push(summaryArtifact);
      moduleArtifactIds["batch-summary"] = [summaryArtifact.id];
    }

    if (Array.isArray(stats.topWords) && stats.topWords.length > 0) {
      await writeTextFile(
        topWordsPath,
        stats.topWords
          .map(function (entry) {
            return `${entry.word}\t${entry.count}`;
          })
          .join("\n")
      );
      const topWordsArtifact = createProcessArtifact(
        "lexical-frequency",
        "subtitle-top-words",
        topWordsPath,
        "Top Subtitle Terms",
        {
          topWord: stats.topWords[0] ? stats.topWords[0].word : null,
        }
      );
      if (topWordsArtifact) {
        artifacts.push(topWordsArtifact);
        moduleArtifactIds["lexical-frequency"] = [topWordsArtifact.id];
      }
    }

    for (let index = 0; index < processRecord.modules.length; index += 1) {
      const moduleEntry = toRecord(processRecord.modules[index]);
      const moduleId = asNonEmptyString(moduleEntry.id) || `subtitle-module-${index}`;
      const moduleStatus = asNonEmptyString(moduleEntry.status) || "queued";
      if (["planned", "gated", "blocked", "skipped"].includes(moduleStatus)) {
        continue;
      }

      updateProcessModule(processRecord, moduleId, {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
      });

      const moduleFindings = [];
      let summary = "";

      if (moduleId === "format-qc") {
        summary = `${stats.totalCues} cues checked across ${stats.totalFiles} subtitle file(s).`;
        if (stats.totalCues === 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "high",
              "medium",
              "No subtitle cues were parsed",
              "The current subtitle selection does not expose parseable cues.",
              stats.totalFiles,
              []
            )
          );
        }
        if (stats.emptyCueCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "low",
              "medium",
              "Empty subtitle cues detected",
              `${stats.emptyCueCount} cue(s) contain no visible text after parsing.`,
              stats.emptyCueCount,
              []
            )
          );
        }
      } else if (moduleId === "readability-density") {
        summary = `Average line density is ${Number(stats.averageCharsPerLine || 0).toFixed(1)} chars/line.`;
        if (stats.longLineCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              stats.longLineCount > 12 ? "high" : "medium",
              "medium",
              "Long subtitle lines found",
              `${stats.longLineCount} line(s) exceed the 42 character readability budget.`,
              stats.longLineCount,
              []
            )
          );
        }
        if (typeof stats.averageCps === "number" && stats.averageCps > 17) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              stats.averageCps > 20 ? "high" : "medium",
              "medium",
              "Average subtitle CPS is elevated",
              `Average character density is ${stats.averageCps.toFixed(1)} characters per second.`,
              Math.round(stats.averageCps),
              []
            )
          );
        }
      } else if (moduleId === "cue-timing-structure") {
        summary = `Timing checks found ${stats.overlapCount} overlap(s) and ${stats.invalidDurationCount} invalid duration cue(s).`;
        if (stats.overlapCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "high",
              "medium",
              "Subtitle overlaps detected",
              `${stats.overlapCount} cue overlap(s) were found in the active selection.`,
              stats.overlapCount,
              []
            )
          );
        }
        if (stats.invalidDurationCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "medium",
              "medium",
              "Invalid cue durations detected",
              `${stats.invalidDurationCount} cue(s) have zero or negative duration.`,
              stats.invalidDurationCount,
              []
            )
          );
        }
      } else if (moduleId === "lexical-frequency") {
        const topWord = stats.topWords[0];
        summary =
          topWord && topWord.word
            ? `Top lexical term is "${topWord.word}" with ${topWord.count} hits.`
            : "No lexical frequency signal was extracted from the active selection.";
      } else if (moduleId === "batch-summary") {
        summary = `${stats.totalFiles} file(s), ${stats.totalCues} cues, ${stats.uniqueFormats.join(", ") || "--"} format(s).`;
        if (stats.uniqueLanguages.length > 1) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "derived",
              "low",
              "medium",
              "Multiple subtitle languages detected",
              `The current selection mixes ${stats.uniqueLanguages.join(", ")} subtitle tracks.`,
              stats.uniqueLanguages.length,
              moduleArtifactIds["batch-summary"] || []
            )
          );
        }
      } else {
        summary = "Subtitle analysis module finished on the current selection.";
      }

      moduleFindings.forEach(function (finding) {
        findings.push(normalizeProcessFinding(finding));
      });
      updateProcessModule(processRecord, moduleId, {
        status: "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: summary,
        artifactIds: moduleArtifactIds[moduleId] || [],
        findingIds: moduleFindings.map(function (finding) {
          return finding.id;
        }),
      });
    }
  } else if (featureId === AUDIO_FEATURE_ID) {
    for (let index = 0; index < processRecord.modules.length; index += 1) {
      const moduleEntry = toRecord(processRecord.modules[index]);
      const moduleId = asNonEmptyString(moduleEntry.id) || `audio-module-${index}`;
      const moduleStatus = asNonEmptyString(moduleEntry.status) || "queued";
      if (["planned", "gated", "blocked", "skipped"].includes(moduleStatus)) {
        continue;
      }

      updateProcessModule(processRecord, moduleId, {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
      });

      const moduleRunner = getAudioAnalysisModuleRunner(moduleId);
      if (typeof moduleRunner !== "function") {
        updateProcessModule(processRecord, moduleId, {
          status: "skipped",
          percent: 100,
          completedAt: new Date().toISOString(),
          summary: "A generic audio runner is not registered for this module yet.",
        });
        continue;
      }

      const moduleOutputDir = getAudioAnalysisModuleProcessDir(runtime, project, moduleId);
      const moduleResult = await moduleRunner(
        runtime,
        project,
        requestId,
        jobId,
        target,
        sanitizeFileSegment(`${artifactBase}-${moduleId}`, moduleId),
        moduleOutputDir,
        moduleId
      );

      (Array.isArray(moduleResult.findings) ? moduleResult.findings : []).forEach(function (finding) {
        findings.push(normalizeProcessFinding(finding));
      });
      (Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : []).forEach(function (artifact) {
        artifacts.push(normalizeProcessArtifact(artifact));
      });
      (Array.isArray(moduleResult.warnings) ? moduleResult.warnings : []).forEach(function (warning) {
        warnings.push(String(warning));
      });

      updateProcessModule(processRecord, moduleId, {
        status: asNonEmptyString(moduleResult.status) || "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: asNonEmptyString(moduleResult.summary) || "",
        artifactIds: (Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : [])
          .map(function (artifact) {
            return asNonEmptyString(toRecord(artifact).id);
          })
          .filter(Boolean),
      });
    }
  } else {
    const metadataArtifact = await generateProcessMetadataArtifact(
      runtime,
      project,
      target,
      artifactBase,
      outputDir,
      "intake"
    );
    if (metadataArtifact) {
      artifacts.push(metadataArtifact);
    }
    updateProcessModule(processRecord, "intake", {
      status: "ready",
      percent: 100,
      completedAt: new Date().toISOString(),
      summary: "The active target was pinned and its metadata snapshot was saved.",
      artifactIds: metadataArtifact ? [metadataArtifact.id] : [],
    });

    updateProcessModule(processRecord, "cleanup", {
      status: "ready",
      percent: 100,
      completedAt: new Date().toISOString(),
      summary:
        asNonEmptyString(toRecord(project.edit).handoffMode) === "derived"
          ? "Derived handoff remained selected during the managed run."
          : "The original source remained selected during the managed run.",
    });

    if (toRecord(processRecord.modules.find(function (entry) { return entry.id === "motion"; })).status === "queued") {
      updateProcessModule(processRecord, "motion", {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
      });
      const videoProbe = await runVideoStructureProbe(runtime, project, requestId, jobId, target);
      if (videoProbe.freeze.count > 0) {
        findings.push(
          createProcessFinding(
            "motion",
            "measured",
            videoProbe.freeze.count > 2 ? "high" : "medium",
            "medium",
            "Freeze intervals detected",
            `The managed run found ${videoProbe.freeze.count} freeze interval(s).`,
            videoProbe.freeze.count,
            []
          )
        );
      }
      if (videoProbe.black.count > 0) {
        findings.push(
          createProcessFinding(
            "motion",
            "measured",
            "low",
            "low",
            "Black interval transitions detected",
            `Black interval analysis found ${videoProbe.black.count} transition(s).`,
            videoProbe.black.count,
            []
          )
        );
      }
      updateProcessModule(processRecord, "motion", {
        status: "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: "Video structure checks finished for the active target.",
      });
    }

    if (toRecord(processRecord.modules.find(function (entry) { return entry.id === "audio"; })).status === "queued") {
      updateProcessModule(processRecord, "audio", {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
      });
      const audioProbe = await runAudioStructureProbe(runtime, project, requestId, jobId, target);
      const spectrogram = await generateProcessSpectrogram(
        runtime,
        project,
        requestId,
        jobId,
        target,
        artifactBase,
        outputDir,
        "audio"
      );
      if (spectrogram) {
        artifacts.push(spectrogram);
      }
      if (audioProbe.silence.count > 0) {
        findings.push(
          createProcessFinding(
            "audio",
            "measured",
            audioProbe.silence.count > 3 ? "medium" : "low",
            "medium",
            "Silence pockets detected",
            `Silence detection found ${audioProbe.silence.count} pocket(s) during the managed run.`,
            audioProbe.silence.count,
            spectrogram ? [spectrogram.id] : []
          )
        );
      }
      const speech = buildProcessSpeechAvailability(runtime, project);
      if (speech.ready) {
        try {
          const transcriptResult = await maybeRunWhisperProfileSample(
            runtime,
            project,
            requestId,
            jobId,
            target,
            artifactBase,
            clampProfileTranscriptSampleSeconds(runtime.profileCapabilities, project.profile.transcriptSampleSeconds)
          );
          if (transcriptResult && transcriptResult.artifact) {
            const transcriptArtifact = normalizeProcessArtifact({
              ...transcriptResult.artifact,
              moduleId: "audio",
            });
            artifacts.push(transcriptArtifact);
          }
        } catch (_error) {
          warnings.push("Transcript sampling stayed unavailable during the managed run.");
        }
      }
      updateProcessModule(processRecord, "audio", {
        status: "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: "Audio continuity checks finished for the active target.",
        artifactIds: artifacts
          .filter(function (entry) {
            return asNonEmptyString(entry.moduleId) === "audio";
          })
          .map(function (entry) {
            return entry.id;
          }),
      });
    }

    updateProcessModule(processRecord, "report", {
      status: "ready",
      percent: 100,
      completedAt: new Date().toISOString(),
      summary: "A report-ready summary was synthesized from the managed run.",
    });
  }

  processRecord.findings = findings;
  processRecord.artifacts = artifacts;
  processRecord.warnings = warnings;
  processRecord.status = "ready";
  processRecord.completedAt = new Date().toISOString();
  updateProcessRecordPercent(processRecord);
  return processRecord;
}

function getFindingSeverityRank(level) {
  const nextLevel = asNonEmptyString(level) || "low";
  return nextLevel === "high" ? 3 : nextLevel === "medium" ? 2 : 1;
}

function formatIdentifierLabel(value) {
  const token = asNonEmptyString(value) || "item";
  return token
    .split(/[-_]/)
    .filter(Boolean)
    .map(function (segment) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

function buildAudioAnalysisReportProjection(runtime, project) {
  const projectedProject = clone(project);
  syncProjectAudioAnalysisProjection(runtime, projectedProject);

  const audioAnalysis = normalizeAudioAnalysisState(projectedProject.audioAnalysis, runtime);
  const catalogMap = getAudioAnalysisModulesForRuntime(runtime).reduce(function (accumulator, entry) {
    const moduleId = asNonEmptyString(entry.id);
    if (moduleId !== null) {
      accumulator[moduleId] = entry;
    }
    return accumulator;
  }, {});
  const orderedIds = normalizeStringArray(toRecord(audioAnalysis.analysisCatalog).orderedIds);
  const extraIds = Object.keys(toRecord(audioAnalysis.results)).filter(function (moduleId) {
    return !orderedIds.includes(moduleId);
  });
  const orderedResults = orderedIds.concat(extraIds).map(function (moduleId) {
    return normalizeAudioAnalysisModuleResult(
      toRecord(toRecord(audioAnalysis.results)[moduleId]),
      moduleId,
      toRecord(catalogMap[moduleId])
    );
  });

  return {
    audioAnalysis: audioAnalysis,
    orderedResults: orderedResults,
  };
}

function composeAudioAnalysisReport(runtime, project) {
  const processRecord = getFeatureProcessRecord(project, AUDIO_FEATURE_ID);
  if (processRecord.status !== "ready" && processRecord.status !== "stale") {
    return normalizeFeatureReportRecord(
      {
        ...createEmptyFeatureReportRecord(AUDIO_FEATURE_ID),
        status: processRecord.status === "running" ? "staged" : "idle",
        warnings: processRecord.warnings || [],
      },
      AUDIO_FEATURE_ID
    );
  }

  const projection = buildAudioAnalysisReportProjection(runtime, project);
  const orderedResults = projection.orderedResults;
  const findings = orderedResults
    .flatMap(function (entry) {
      return Array.isArray(entry.signals) ? entry.signals : [];
    })
    .map(normalizeProcessFinding)
    .sort(function (left, right) {
      return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
    });
  const artifactCount = orderedResults.reduce(function (sum, entry) {
    return sum + (Array.isArray(entry.artifacts) ? entry.artifacts.length : 0);
  }, 0);
  const completedCount = orderedResults.filter(function (entry) {
    return ["complete", "stale"].includes(asNonEmptyString(entry.status) || "idle");
  }).length;
  const gatedCount = orderedResults.filter(function (entry) {
    return asNonEmptyString(entry.status) === "gated";
  }).length;
  const plannedCount = orderedResults.filter(function (entry) {
    return asNonEmptyString(entry.status) === "planned";
  }).length;
  const blockedCount = orderedResults.filter(function (entry) {
    return asNonEmptyString(entry.status) === "blocked";
  }).length;
  const warnings = Array.from(
    new Set(
      normalizeStringArray(processRecord.warnings).concat(
        orderedResults.flatMap(function (entry) {
          return normalizeStringArray(entry.warnings);
        })
      )
    )
  );
  const caveats = [];
  if (plannedCount > 0) {
    caveats.push(`${String(plannedCount)} audio module(s) remain planned for the v2 rollout.`);
  }
  if (gatedCount > 0) {
    caveats.push(`${String(gatedCount)} audio module(s) remain capability-gated on the current runtime.`);
  }
  if (blockedCount > 0) {
    caveats.push("Blocked audio modules keep their slot visible until the target and providers are ready.");
  }

  return normalizeFeatureReportRecord(
    {
      featureId: AUDIO_FEATURE_ID,
      status: "ready",
      sourceRunId: processRecord.runId,
      generatedAt: new Date().toISOString(),
      summaryCards: [
        {
          id: "audio-target",
          label: "Target",
          value:
            asNonEmptyString(toRecord(projection.audioAnalysis.source).targetLabel) ||
            asNonEmptyString(toRecord(processRecord.targetSummary).label) ||
            project.name,
        },
        {
          id: "audio-visible-modules",
          label: "Visible modules",
          value: String(orderedResults.length),
        },
        {
          id: "audio-completed-modules",
          label: "Completed modules",
          value: String(completedCount),
        },
        {
          id: "audio-findings",
          label: "Findings",
          value: String(findings.length),
        },
        {
          id: "audio-artifacts",
          label: "Artifacts",
          value: String(artifactCount),
        },
      ],
      findings: findings,
      caveats: caveats,
      warnings: warnings,
      exports: getFeatureReportRecord(project, AUDIO_FEATURE_ID).exports,
      error: null,
    },
    AUDIO_FEATURE_ID
  );
}

function getProcessArtifactByKind(processRecord, kind) {
  return (
    (Array.isArray(processRecord.artifacts) ? processRecord.artifacts.map(normalizeProcessArtifact) : []).find(
      function (entry) {
        return asNonEmptyString(entry.kind) === kind;
      }
    ) || null
  );
}

function formatReportCardLabel(card) {
  const label = asNonEmptyString(toRecord(card).label);
  if (label !== null) {
    return label;
  }
  const labelKey = asNonEmptyString(toRecord(card).labelKey);
  if (labelKey !== null) {
    return formatIdentifierLabel(labelKey.split(".").pop() || labelKey);
  }
  return "Summary";
}

function composeSubtitleAnalysisReport(runtime, project) {
  const processRecord = getFeatureProcessRecord(project, SUBTITLE_FEATURE_ID);
  if (processRecord.status !== "ready" && processRecord.status !== "stale") {
    return normalizeFeatureReportRecord(
      {
        ...createEmptyFeatureReportRecord(SUBTITLE_FEATURE_ID),
        status: processRecord.status === "running" ? "staged" : "idle",
        warnings: processRecord.warnings || [],
      },
      SUBTITLE_FEATURE_ID
    );
  }

  const findings = (Array.isArray(processRecord.findings) ? processRecord.findings : [])
    .map(normalizeProcessFinding)
    .sort(function (left, right) {
      return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
    });
  const modules = Array.isArray(processRecord.modules) ? processRecord.modules.map(normalizeProcessModule) : [];
  const completedCount = modules.filter(function (entry) {
    return ["ready", "stale", "complete"].includes(asNonEmptyString(entry.status) || "idle");
  }).length;
  const plannedCount = getSubtitleAnalysisModuleDescriptors(runtime).filter(function (entry) {
    return asNonEmptyString(entry.status) === "planned";
  }).length;
  const targetEntries = getSubtitleSelectedEntries(project);
  const summaryArtifact = getProcessArtifactByKind(processRecord, "subtitle-summary");
  const lexicalArtifact = getProcessArtifactByKind(processRecord, "subtitle-top-words");
  const lexicalModule =
    modules.find(function (entry) {
      return entry.id === "lexical-frequency";
    }) || null;
  const totalCues =
    asNumber(toRecord(summaryArtifact).metadata.totalCues) ||
    findings.reduce(function (sum, entry) {
      return sum + Math.max(0, Math.round(asNumber(entry.evidenceCount) || 0));
    }, 0) ||
    0;
  const uniqueLanguages = Array.from(
    new Set(
      targetEntries
        .map(function (entry) {
          return asNonEmptyString(toRecord(entry).language);
        })
        .filter(Boolean)
    )
  );
  const topWord =
    asNonEmptyString(toRecord(lexicalArtifact).metadata.topWord) ||
    (typeof toRecord(lexicalModule).summary === "string" &&
    toRecord(lexicalModule).summary.toLowerCase().includes("top lexical term is")
      ? asNonEmptyString(
          toRecord(lexicalModule)
            .summary.replace(/^.*?"/, "")
            .replace(/".*$/, "")
        )
      : null);
  const warnings = Array.from(
    new Set(
      normalizeStringArray(processRecord.warnings).concat(
        modules.flatMap(function (entry) {
          return normalizeStringArray(entry.warnings);
        })
      )
    )
  );
  const caveats = [];

  if (plannedCount > 0) {
    caveats.push(`${plannedCount} subtitle module(s) remain planned for the next rollout.`);
  }
  if (targetEntries.length > 1) {
    caveats.push("Batch subtitle selections summarize the currently selected entries only.");
  }
  if (uniqueLanguages.length === 0) {
    caveats.push("Subtitle language tags are missing on the current selection.");
  }

  return normalizeFeatureReportRecord(
    {
      featureId: SUBTITLE_FEATURE_ID,
      status: "ready",
      sourceRunId: processRecord.runId,
      generatedAt: new Date().toISOString(),
      summaryCards: [
        {
          id: "subtitle-target",
          labelKey: "subtitleAnalysis.report.summaryCards.target",
          value: asNonEmptyString(toRecord(processRecord.targetSummary).label) || project.name,
        },
        {
          id: "subtitle-files",
          labelKey: "subtitleAnalysis.report.summaryCards.files",
          value: String(asNumber(toRecord(processRecord.targetSummary).entryCount) || targetEntries.length || 0),
        },
        {
          id: "subtitle-cues",
          labelKey: "subtitleAnalysis.report.summaryCards.cues",
          value: String(totalCues),
        },
        {
          id: "subtitle-findings",
          labelKey: "subtitleAnalysis.report.summaryCards.findings",
          value: String(findings.length),
        },
        {
          id: "subtitle-languages",
          labelKey: "subtitleAnalysis.report.summaryCards.languages",
          value: uniqueLanguages.length > 0 ? uniqueLanguages.join(", ") : "--",
        },
        {
          id: "subtitle-top-term",
          labelKey: "subtitleAnalysis.report.summaryCards.topTerm",
          value: topWord || "--",
        },
        {
          id: "subtitle-modules",
          labelKey: "subtitleAnalysis.report.summaryCards.modules",
          value: String(completedCount),
        },
      ],
      findings: findings,
      caveats: caveats,
      warnings: warnings,
      exports: getFeatureReportRecord(project, SUBTITLE_FEATURE_ID).exports,
      error: null,
    },
    SUBTITLE_FEATURE_ID
  );
}

function composeFeatureReport(runtime, project, featureId) {
  if (featureId === AUDIO_FEATURE_ID) {
    return composeAudioAnalysisReport(runtime, project);
  }
  if (featureId === SUBTITLE_FEATURE_ID) {
    return composeSubtitleAnalysisReport(runtime, project);
  }

  const processRecord = getFeatureProcessRecord(project, featureId);
  if (processRecord.status !== "ready" && processRecord.status !== "stale") {
    return normalizeFeatureReportRecord(
      {
        ...createEmptyFeatureReportRecord(featureId),
        status: processRecord.status === "running" ? "staged" : "idle",
        warnings: processRecord.warnings || [],
      },
      featureId
    );
  }

  const findings = (Array.isArray(processRecord.findings) ? processRecord.findings : [])
    .map(normalizeProcessFinding)
    .sort(function (left, right) {
      return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
    });
  const topLevel = findings[0] ? asNonEmptyString(findings[0].level) || "low" : "low";
  const caveats = [];
  if (featureId === FEATURE_ID) {
    caveats.push("Process findings remain evidence-led but still reflect heuristic interpretation where noted.");
  } else {
    caveats.push("Planned audio modules remain visible but do not pretend to be implemented.");
  }

  return normalizeFeatureReportRecord(
    {
      featureId: featureId,
      status: "ready",
      sourceRunId: processRecord.runId,
      generatedAt: new Date().toISOString(),
      summaryCards: [
        {
          id: `${featureId}-target`,
          labelKey: "mediaAnalysis.profile.summary.target",
          value: asNonEmptyString(toRecord(processRecord.targetSummary).label) || project.name,
        },
        {
          id: `${featureId}-modules`,
          label: "Modules",
          value: String((Array.isArray(processRecord.modules) ? processRecord.modules : []).length),
        },
        {
          id: `${featureId}-findings`,
          labelKey: "mediaAnalysis.profile.summary.signals",
          value: String(findings.length),
        },
        {
          id: `${featureId}-artifacts`,
          labelKey: "mediaAnalysis.profile.summary.artifacts",
          value: String((Array.isArray(processRecord.artifacts) ? processRecord.artifacts : []).length),
        },
        {
          id: `${featureId}-risk`,
          label: "Top risk",
          value: topLevel,
        },
      ],
      findings: findings,
      caveats: caveats,
      warnings: Array.isArray(processRecord.warnings) ? processRecord.warnings : [],
      exports: getFeatureReportRecord(project, featureId).exports,
      error: null,
    },
    featureId
  );
}

function buildReportMarkdown(runtime, project, featureId, reportRecord) {
  const featureLabel =
    featureId === AUDIO_FEATURE_ID
      ? "Audio Analysis"
      : featureId === SUBTITLE_FEATURE_ID
        ? "Subtitle Analysis"
        : "Media Analysis";
  const lines = [
    `# ${featureLabel} Report`,
    "",
    `Project: ${project.name}`,
    `Generated: ${asNonEmptyString(reportRecord.generatedAt) || new Date().toISOString()}`,
    "",
    "## Summary",
  ];

  (Array.isArray(reportRecord.summaryCards) ? reportRecord.summaryCards : []).forEach(function (card) {
    lines.push(`- ${formatReportCardLabel(card)}: ${card.value || "--"}`);
  });

  if (featureId === AUDIO_FEATURE_ID) {
    const projection = buildAudioAnalysisReportProjection(runtime, project);
    lines.push("", "## Modules");
    projection.orderedResults.forEach(function (result) {
      const metrics = Array.isArray(result.metrics) ? result.metrics : [];
      const metricsSummary = metrics
        .map(function (metric) {
          return `${asNonEmptyString(metric.label) || formatIdentifierLabel(metric.id)}: ${metric.value || "--"}`;
        })
        .join(", ");
      lines.push(
        `- ${formatIdentifierLabel(result.moduleId)}: ${formatIdentifierLabel(result.status || "idle")}${
          result.summary ? ` — ${result.summary}` : ""
        }`
      );
      if (metricsSummary !== "") {
        lines.push(`  Metrics: ${metricsSummary}`);
      }
      if (Array.isArray(result.blockers) && result.blockers.length > 0) {
        lines.push(`  Blockers: ${result.blockers.join(" | ")}`);
      }
      if (Array.isArray(result.warnings) && result.warnings.length > 0) {
        lines.push(`  Warnings: ${result.warnings.join(" | ")}`);
      }
    });
  } else if (featureId === SUBTITLE_FEATURE_ID) {
    lines.push("", "## Modules");
    (Array.isArray(getFeatureProcessRecord(project, featureId).modules)
      ? getFeatureProcessRecord(project, featureId).modules
      : []
    )
      .map(normalizeProcessModule)
      .forEach(function (moduleEntry) {
        lines.push(
          `- ${moduleEntry.title || formatIdentifierLabel(moduleEntry.id)}: ${
            formatIdentifierLabel(moduleEntry.status || "idle")
          }${moduleEntry.summary ? ` — ${moduleEntry.summary}` : ""}`
        );
      });
  }

  lines.push("", "## Findings");
  if (Array.isArray(reportRecord.findings) && reportRecord.findings.length > 0) {
    reportRecord.findings.forEach(function (finding) {
      lines.push(`- ${finding.title || finding.moduleId || "Finding"}: ${finding.detail || ""}`);
    });
  } else {
    lines.push("- No findings were recorded for the active report.");
  }

  if (Array.isArray(reportRecord.caveats) && reportRecord.caveats.length > 0) {
    lines.push("", "## Caveats");
    reportRecord.caveats.forEach(function (entry) {
      lines.push(`- ${entry}`);
    });
  }

  if (Array.isArray(reportRecord.warnings) && reportRecord.warnings.length > 0) {
    lines.push("", "## Warnings");
    reportRecord.warnings.forEach(function (entry) {
      lines.push(`- ${entry}`);
    });
  }

  if (Array.isArray(reportRecord.exports) && reportRecord.exports.length > 0) {
    lines.push("", "## Exports");
    reportRecord.exports.forEach(function (entry) {
      lines.push(`- ${entry.fileName || entry.path || "--"} (${entry.format || "md"}, ${entry.status || "ready"})`);
    });
  }

  return lines.join("\n");
}

async function runFeatureProcess(api, runtime, requestId, featureId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  if (
    featureId !== AUDIO_FEATURE_ID &&
    featureId !== SUBTITLE_FEATURE_ID &&
    asNonEmptyString(toRecord(toRecord(project.profile).preflight).status) !== "ready"
  ) {
    throw new Error("Run the profile preflight before starting the process stage.");
  }

  if (featureId !== SUBTITLE_FEATURE_ID) {
    ensureEditToolReady(runtime);
  }
  await ensureProjectDirectories(runtime, project, requestId);
  const action = getFeatureProcessJobAction(featureId);
  ensureProcessJobSlotAvailable(runtime, project.id, action);
  const jobId = `room-process-${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: action,
    projectId: project.id,
    toolId: "ffmpeg",
    featureStage: "process",
  });
  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: action,
    projectId: project.id,
    toolId: "ffmpeg",
    featureStage: "process",
    stage: "queued",
    percent: 0,
  });

  await patchActiveProject(runtime, function (nextProject) {
    setFeatureProcessRecord(nextProject, featureId, {
      ...createEmptyFeatureProcessRecord(featureId),
      featureId: featureId,
      status: "running",
      jobId: jobId,
      requestId: requestId,
      percent: 0,
    });
    markFeatureReportStale(nextProject, featureId, "A new process run is now in progress.");
    return nextProject;
  });

  try {
    const nextProcessRecord = await runManagedProcess(runtime, clone(project), requestId, jobId, featureId);
    await patchActiveProject(runtime, function (nextProject) {
      setFeatureProcessRecord(nextProject, featureId, nextProcessRecord);
      setFeatureReportRecord(nextProject, featureId, composeFeatureReport(runtime, nextProject, featureId));
      return nextProject;
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "process",
      stage: "completed",
      percent: 100,
    });
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      setFeatureProcessRecord(nextProject, featureId, {
        ...getFeatureProcessRecord(nextProject, featureId),
        status: "error",
        jobId: null,
        requestId: null,
        error: error instanceof Error ? error.message : String(error),
      });
      return nextProject;
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "process",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

async function cancelFeatureProcess(api, runtime, requestId, featureId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }
  const action = getFeatureProcessJobAction(featureId);
  await cancelProcessJobsForProject(api, runtime, project.id, requestId, action);
  await patchActiveProject(runtime, function (nextProject) {
    setFeatureProcessRecord(nextProject, featureId, {
      ...getFeatureProcessRecord(nextProject, featureId),
      status: "cancelled",
      jobId: null,
      requestId: null,
      error: null,
    });
    return nextProject;
  });
}

async function exportFeatureReport(api, runtime, requestId, featureId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  await ensureProjectDirectories(runtime, project, requestId);
  const reportRecord = composeFeatureReport(runtime, project, featureId);
  if (reportRecord.status !== "ready") {
    throw new Error("Run the process stage before exporting a report.");
  }

  const action = getFeatureReportExportAction(featureId);
  ensureReportJobSlotAvailable(runtime, project.id, action);
  const jobId = `room-report-${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: action,
    projectId: project.id,
    featureStage: "report",
  });
  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: action,
    projectId: project.id,
    featureStage: "report",
    stage: "queued",
    percent: 0,
  });

  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${sanitizeFileSegment(project.slug, "project")}-${featureId}-${stamp}.md`;
    const outputPath = `${getProjectReportDir(runtime, project)}/${fileName}`;
    await writeTextFile(outputPath, buildReportMarkdown(runtime, project, featureId, reportRecord));
    const exportEntry = normalizeReportExport({
      format: "md",
      path: outputPath,
      fileName: fileName,
      status: "ready",
    });

    await patchActiveProject(runtime, function (nextProject) {
      const nextReportRecord = composeFeatureReport(runtime, nextProject, featureId);
      nextReportRecord.exports = [exportEntry].concat(
        (Array.isArray(getFeatureReportRecord(nextProject, featureId).exports)
          ? getFeatureReportRecord(nextProject, featureId).exports
          : []
        ).slice(0, 7)
      );
      setFeatureReportRecord(nextProject, featureId, nextReportRecord);
      return nextProject;
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      featureStage: "report",
      stage: "completed",
      percent: 100,
    });
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      setFeatureReportRecord(nextProject, featureId, {
        ...getFeatureReportRecord(nextProject, featureId),
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      return nextProject;
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      featureStage: "report",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

async function handleLocalPick(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  const sourceConfig = getSourceConfig(runtime.sourcePresets, project.source.kind);
  const electronApi = getElectronApi();
  if (electronApi === null || typeof electronApi.showOpenDialog !== "function") {
    throw new Error("File picker is unavailable.");
  }

  const dialogResult = await electronApi.showOpenDialog({
    properties: ["openFile"],
    filters: Array.isArray(sourceConfig.fileDialogFilters) ? sourceConfig.fileDialogFilters : [],
  });

  if (!dialogResult || dialogResult.canceled === true || !Array.isArray(dialogResult.filePaths)) {
    return { cancelled: true };
  }

  const selectedPath = dialogResult.filePaths[0];
  if (typeof selectedPath !== "string" || selectedPath.trim() === "") {
    return { cancelled: true };
  }

  const sourceDir = getProjectSourceDir(runtime, project);
  const copyResult = await electronApi.copyFileTo(selectedPath, sourceDir);
  if (!copyResult || copyResult.success !== true) {
    throw new Error((copyResult && (copyResult.message || copyResult.error)) || "Copy failed.");
  }

  const storedPath = asNonEmptyString(copyResult.path);
  const storedFileName = asNonEmptyString(copyResult.name) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
  const preparedSource = await resolvePreparedSource(runtime, project, {
    requestId: requestId,
    storedPath: storedPath,
    storedFileName: storedFileName,
    mimeType: normalizeMimeType(storedFileName, project.source.kind),
  });

  await patchActiveProject(runtime, function (nextProject) {
    nextProject.source.mode = "local";
    nextProject.source.status = "ready";
    nextProject.source.storedPath = preparedSource.storedPath;
    nextProject.source.storedFileName = preparedSource.storedFileName;
    nextProject.source.mimeType = preparedSource.mimeType;
    nextProject.source.sourceUrl = selectedPath;
    nextProject.source.routeLabel = "Local copy";
    nextProject.source.lastError = null;
    nextProject.source.metadata = preparedSource.metadata;
    nextProject.source.metadataError = preparedSource.metadataError;
    resetEditForCurrentSource(runtime, nextProject);
    resetProfileForCurrentSource(runtime, nextProject, "Source media changed; rerun the profile preflight.");
    return nextProject;
  });

  return {
    storedPath: preparedSource.storedPath,
    storedFileName: preparedSource.storedFileName,
  };
}

async function handleUrlDownload(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  const urlValue = asNonEmptyString(project.source.drafts.urlInput);
  if (urlValue === null) {
    throw new Error("Direct URL is empty.");
  }

  await cancelJobsForProject(runtime, project.id, requestId);

  const fileName = deriveFilename(urlValue, project.source.kind, project.source.drafts.fileNameHint);
  const jobId = `room-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "source-download-url",
    projectId: project.id,
    featureStage: "source",
  });

  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "source-download-url",
    projectId: project.id,
    stage: "queued",
  });

  try {
    const downloadResult = await callRoomTools({
      operation: "download-file",
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      url: urlValue,
      destinationPath: `${getProjectSourceDir(runtime, project)}/${fileName}`,
      overwrite: false,
    });

    const downloaded = toRecord(downloadResult.download);
    const storedPath = asNonEmptyString(downloaded.path);
    const storedFileName =
      asNonEmptyString(downloaded.fileName) ||
      (storedPath ? storedPath.split(/[\\/]/).pop() : null);
    const preparedSource = await resolvePreparedSource(runtime, project, {
      requestId: requestId,
      jobId: jobId,
      storedPath: storedPath,
      storedFileName: storedFileName,
      mimeType:
        asNonEmptyString(downloaded.contentType) ||
        normalizeMimeType(storedFileName, project.source.kind),
    });

    await patchActiveProject(runtime, function (nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.mode = "url";
      nextProject.source.status = "ready";
      nextProject.source.storedPath = preparedSource.storedPath;
      nextProject.source.storedFileName = preparedSource.storedFileName;
      nextProject.source.sourceUrl = urlValue;
      nextProject.source.mimeType = preparedSource.mimeType;
      nextProject.source.routeLabel = "Direct URL";
      nextProject.source.lastError = null;
      nextProject.source.metadata = preparedSource.metadata;
      nextProject.source.metadataError = preparedSource.metadataError;
      resetEditForCurrentSource(runtime, nextProject);
      resetProfileForCurrentSource(runtime, nextProject, "Source media changed; rerun the profile preflight.");
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-url",
      projectId: project.id,
      stage: "completed",
      percent: 100,
    });

    return {
      storedPath: preparedSource.storedPath,
      storedFileName: preparedSource.storedFileName,
    };
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.status = "error";
      nextProject.source.lastError = error instanceof Error ? error.message : String(error);
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-url",
      projectId: project.id,
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

function getResolvedYoutubeSettings(project, sourcePresets) {
  const presetId = asNonEmptyString(project.source.drafts.youtubePreset) || "medium";
  const presetDefaults = getPresetDefaultCustomValues(sourcePresets, presetId);
  if (presetId === "custom") {
    return {
      presetId: presetId,
      values: {
        ...presetDefaults,
        ...toRecord(project.source.drafts.youtubeCustom),
      },
    };
  }
  return {
    presetId: presetId,
    values: presetDefaults,
  };
}

function findYtDlpFinalPath(stdoutValue) {
  const lines = String(stdoutValue || "")
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (/^[A-Za-z]:\\/.test(line) || line.startsWith("/")) {
      return line;
    }
  }

  return null;
}

function buildYtDlpArgs(project, toolState, sourceDir) {
  const settings = getResolvedYoutubeSettings(project, toolState.sourcePresets || {});
  const values = settings.values;
  const args = [
    "--newline",
    "--progress",
    "--print",
    "after_move:filepath",
    "-o",
    `${sourceDir}/%(title).120B-%(id)s.%(ext)s`,
  ];

  let formatValue = asNonEmptyString(values.format) || "best";
  if (
    formatValue.indexOf("+") >= 0 &&
    (!toolState.ffmpeg || toolState.ffmpeg.installed !== true)
  ) {
    formatValue = "best";
  }

  args.push("-f", formatValue);

  const mergeOutputFormat = asNonEmptyString(values.mergeOutputFormat);
  if (mergeOutputFormat && mergeOutputFormat !== "auto") {
    args.push("--merge-output-format", mergeOutputFormat);
  }

  const recodeVideo = asNonEmptyString(values.recodeVideo);
  if (recodeVideo && recodeVideo !== "none") {
    args.push("--recode-video", recodeVideo);
  }

  const audioFormat = asNonEmptyString(values.audioFormat);
  if (audioFormat && audioFormat !== "none") {
    args.push("-x", "--audio-format", audioFormat);
  }

  if (values.writeSubtitles === true) {
    args.push("--write-subs");
  }
  if (values.writeAutoSubtitles === true) {
    args.push("--write-auto-subs");
  }

  const subtitlesLang = asNonEmptyString(values.subtitlesLang);
  if (subtitlesLang) {
    args.push("--sub-langs", subtitlesLang);
  } else if (values.writeSubtitles === true || values.writeAutoSubtitles === true) {
    args.push("--sub-langs", "all");
  }

  const playlistItems = asNonEmptyString(values.playlistItems);
  if (playlistItems) {
    args.push("--playlist-items", playlistItems);
  } else {
    args.push("--no-playlist");
  }

  const limitRate = asNonEmptyString(values.limitRate);
  if (limitRate) {
    args.push("--limit-rate", limitRate);
  }

  const retries = Number(values.retries);
  if (Number.isFinite(retries) && retries > 0) {
    args.push("--retries", String(retries));
  }

  if (
    toolState.ffmpeg &&
    toolState.ffmpeg.installed === true &&
    typeof toolState.ffmpeg.binaryPath === "string" &&
    toolState.ffmpeg.binaryPath.trim() !== ""
  ) {
    const binaryPath = toolState.ffmpeg.binaryPath.replace(/\\/g, "/");
    const separatorIndex = binaryPath.lastIndexOf("/");
    const ffmpegDir = separatorIndex >= 0 ? binaryPath.slice(0, separatorIndex) : binaryPath;
    args.push("--ffmpeg-location", ffmpegDir);
  }

  args.push(project.source.drafts.youtubeUrl);
  return args;
}

async function handleYoutubeDownload(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  const ytDlpState = toRecord(runtime.toolState.tools["yt-dlp"]);
  if (ytDlpState.installed !== true) {
    throw new Error("yt-dlp is not installed.");
  }

  const youtubeUrl = asNonEmptyString(project.source.drafts.youtubeUrl);
  if (youtubeUrl === null) {
    throw new Error("YouTube URL is empty.");
  }

  await cancelJobsForProject(runtime, project.id, requestId);

  const jobId = `room-youtube-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "source-download-youtube",
    projectId: project.id,
    toolId: "yt-dlp",
    featureStage: "source",
  });

  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "source-download-youtube",
    projectId: project.id,
    toolId: "yt-dlp",
    stage: "queued",
  });

  try {
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      toolId: "yt-dlp",
      cwd: getProjectSourceDir(runtime, project),
      args: buildYtDlpArgs(
        project,
        {
          sourcePresets: runtime.sourcePresets,
          ffmpeg: runtime.toolState.tools.ffmpeg,
        },
        getProjectSourceDir(runtime, project)
      ),
      timeoutMs: 45 * 60 * 1000,
    });

    const runPayload = toRecord(runResult.run);
    const storedPath = findYtDlpFinalPath(runPayload.stdout);
    const storedFileName = storedPath ? storedPath.split(/[\\/]/).pop() : null;

    if (!storedPath) {
      throw new Error("yt-dlp finished without a final output path.");
    }

    const preparedSource = await resolvePreparedSource(runtime, project, {
      requestId: requestId,
      jobId: jobId,
      storedPath: storedPath,
      storedFileName: storedFileName,
      mimeType: normalizeMimeType(storedFileName, project.source.kind),
    });

    await patchActiveProject(runtime, function (nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.mode = "youtube";
      nextProject.source.status = "ready";
      nextProject.source.storedPath = preparedSource.storedPath;
      nextProject.source.storedFileName = preparedSource.storedFileName;
      nextProject.source.sourceUrl = youtubeUrl;
      nextProject.source.mimeType = preparedSource.mimeType;
      nextProject.source.routeLabel = "YouTube";
      nextProject.source.lastError = null;
      nextProject.source.metadata = preparedSource.metadata;
      nextProject.source.metadataError = preparedSource.metadataError;
      resetEditForCurrentSource(runtime, nextProject);
      resetProfileForCurrentSource(runtime, nextProject, "Source media changed; rerun the profile preflight.");
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      stage: "completed",
      percent: 100,
    });

    return {
      storedPath: preparedSource.storedPath,
      storedFileName: preparedSource.storedFileName,
    };
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.status = "error";
      nextProject.source.lastError = error instanceof Error ? error.message : String(error);
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

async function patchActiveSubtitleWorkspaceDrafts(runtime, fields) {
  const patch = toRecord(fields);
  if (Object.keys(patch).length === 0) {
    return getActiveProject(runtime);
  }

  return await patchActiveProject(runtime, function (nextProject) {
    const subtitleState = normalizeSubtitleAnalysisState(toRecord(nextProject).subtitleAnalysis, runtime);
    subtitleState.workspace.drafts = {
      ...toRecord(subtitleState.workspace.drafts),
      ...patch,
      durationMinSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMinSeconds")
        ? asNumber(patch.durationMinSeconds)
        : asNumber(toRecord(subtitleState.workspace.drafts).durationMinSeconds),
      durationMaxSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMaxSeconds")
        ? asNumber(patch.durationMaxSeconds)
        : asNumber(toRecord(subtitleState.workspace.drafts).durationMaxSeconds),
      limitCount: Object.prototype.hasOwnProperty.call(patch, "limitCount")
        ? asNumber(patch.limitCount)
        : asNumber(toRecord(subtitleState.workspace.drafts).limitCount),
    };
    subtitleState.workspace.lastError = null;
    subtitleState.workspace.lastActionAt = new Date().toISOString();
    nextProject.subtitleAnalysis = subtitleState;
    return nextProject;
  });
}

function applySubtitleEditPatch(runtime, project, patchValue) {
  const patch = toRecord(patchValue);
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, runtime);
  subtitleState.edit.recipe = mergeObjects(toRecord(subtitleState.edit.recipe), patch);
  subtitleState.edit.recipe.maxCharsPerLine = Math.max(
    24,
    Math.min(64, Math.round(asNumber(toRecord(subtitleState.edit.recipe).maxCharsPerLine) || 42))
  );
  subtitleState.edit.lastError = null;
  subtitleState.edit.lastActionAt = new Date().toISOString();
  project.subtitleAnalysis = subtitleState;
  markFeatureProcessStale(project, SUBTITLE_FEATURE_ID, "Subtitle edit recipe changed.");
  markFeatureReportStale(project, SUBTITLE_FEATURE_ID, "Subtitle edit recipe changed.");
  return project.subtitleAnalysis;
}

async function listSubtitleFilesInDirectory(runtime, dirPath) {
  const entries = await listDirectory(dirPath);
  return entries
    .filter(function (entry) {
      return entry && entry.isDirectory !== true && isSubtitleFileName(runtime, entry.name);
    })
    .sort(function (left, right) {
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
}

async function readSubtitleText(filePath) {
  const rawText = await readTextFile(filePath);
  if (typeof rawText !== "string") {
    throw new Error(`Subtitle file could not be read: ${filePath}`);
  }
  return rawText;
}

function getSubtitleUrlFileName(urlValue, hintValue) {
  const hinted = asNonEmptyString(hintValue);
  if (hinted !== null) {
    return getSubtitleFileExtension(hinted) !== null ? hinted : `${hinted}.srt`;
  }

  try {
    const parsed = new URL(urlValue);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const rawName = pathname.split("/").filter(Boolean).pop();
    if (rawName && isSubtitleFileName({ subtitleSourcePresets: {} }, rawName)) {
      return rawName;
    }
    if (rawName && rawName.indexOf(".") > 0) {
      return rawName;
    }
  } catch (_error) {
    // noop
  }

  return `subtitle-${Date.now()}.srt`;
}

function formatYoutubeDateForTool(value) {
  const normalized = asNonEmptyString(value);
  return normalized !== null ? normalized.replaceAll("-", "") : null;
}

function parseSubtitleLanguageList(value) {
  const normalized = asNonEmptyString(value);
  if (normalized === null || normalized.toLowerCase() === "all") {
    return [];
  }
  return normalized
    .split(/[,\s]+/)
    .map(function (entry) {
      return entry.trim().toLowerCase();
    })
    .filter(Boolean);
}

function parseSubtitleWeekdayFilter(value) {
  const normalized = asNonEmptyString(value);
  if (normalized === null) {
    return [];
  }

  const aliasMap = {
    sun: 0,
    sunday: 0,
    pazar: 0,
    mon: 1,
    monday: 1,
    pazartesi: 1,
    tue: 2,
    tuesday: 2,
    sali: 2,
    salı: 2,
    wed: 3,
    wednesday: 3,
    carsamba: 3,
    çarşamba: 3,
    thu: 4,
    thursday: 4,
    persembe: 4,
    perşembe: 4,
    fri: 5,
    friday: 5,
    cuma: 5,
    sat: 6,
    saturday: 6,
    cumartesi: 6,
  };

  return normalized
    .split(/[,\s]+/)
    .map(function (entry) {
      const token = entry.trim().toLowerCase();
      return Object.prototype.hasOwnProperty.call(aliasMap, token) ? aliasMap[token] : null;
    })
    .filter(function (entry) {
      return typeof entry === "number";
    });
}

function matchesSubtitlePublishedRange(metadata, drafts) {
  const publishedAt =
    asNonEmptyString(metadata.upload_date) ||
    asNonEmptyString(metadata.release_date) ||
    asNonEmptyString(metadata.timestamp);
  if (publishedAt === null) {
    return true;
  }

  const normalizedPublished = publishedAt.replaceAll("-", "").slice(0, 8);
  const after = formatYoutubeDateForTool(drafts.publishedAfter);
  const before = formatYoutubeDateForTool(drafts.publishedBefore);
  if (after !== null && normalizedPublished < after) {
    return false;
  }
  if (before !== null && normalizedPublished > before) {
    return false;
  }
  return true;
}

function matchesSubtitleWeekday(metadata, drafts) {
  const filters = parseSubtitleWeekdayFilter(drafts.weekdays);
  if (filters.length === 0) {
    return true;
  }

  const uploadDate = asNonEmptyString(metadata.upload_date);
  if (uploadDate === null || uploadDate.length < 8) {
    return false;
  }

  const year = Number(uploadDate.slice(0, 4));
  const month = Number(uploadDate.slice(4, 6));
  const day = Number(uploadDate.slice(6, 8));
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return filters.includes(weekday);
}

function matchesSubtitleDuration(metadata, drafts) {
  const durationSeconds = asNumber(metadata.duration);
  const minSeconds = asNumber(drafts.durationMinSeconds);
  const maxSeconds = asNumber(drafts.durationMaxSeconds);
  if (minSeconds === null && maxSeconds === null) {
    return true;
  }
  if (durationSeconds === null) {
    return false;
  }
  if (minSeconds !== null && durationSeconds < minSeconds) {
    return false;
  }
  if (maxSeconds !== null && durationSeconds > maxSeconds) {
    return false;
  }
  return true;
}

function matchesSubtitleShortsMode(metadata, drafts) {
  const shortsMode = asNonEmptyString(drafts.shortsMode) || "all";
  if (shortsMode === "all") {
    return true;
  }

  const webpageUrl = asNonEmptyString(metadata.webpage_url) || "";
  const durationSeconds = asNumber(metadata.duration);
  const isShort = webpageUrl.indexOf("/shorts/") >= 0 || (durationSeconds !== null && durationSeconds <= 180);
  return shortsMode === "only" ? isShort : !isShort;
}

function matchesSubtitleLanguageAvailability(metadata, drafts) {
  const requestedLanguages = parseSubtitleLanguageList(drafts.subtitlesLang);
  const subtitleMode = asNonEmptyString(drafts.subtitleMode) || "manual";
  const manualLanguages = Object.keys(toRecord(metadata.subtitles));
  const autoLanguages = Object.keys(toRecord(metadata.automatic_captions));
  const availableLanguages =
    subtitleMode === "auto"
      ? autoLanguages
      : subtitleMode === "both"
        ? Array.from(new Set(manualLanguages.concat(autoLanguages)))
        : manualLanguages;

  if (requestedLanguages.length === 0) {
    return availableLanguages.length > 0;
  }

  return requestedLanguages.some(function (language) {
    return availableLanguages.some(function (candidate) {
      return candidate === language || candidate.startsWith(`${language}-`) || language.startsWith(`${candidate}-`);
    });
  });
}

function parseSubtitleTitleFilters(value) {
  const normalized = asNonEmptyString(value);
  if (normalized === null) {
    return [];
  }
  return normalized
    .split(/[\n,;]+/)
    .map(function (entry) {
      return entry.trim().toLowerCase();
    })
    .filter(Boolean);
}

function matchesSubtitleTitleFilters(metadata, drafts) {
  const title = `${asNonEmptyString(metadata.title) || ""} ${asNonEmptyString(metadata.description) || ""}`
    .trim()
    .toLowerCase();
  const includeTerms = parseSubtitleTitleFilters(drafts.titleInclude);
  const excludeTerms = parseSubtitleTitleFilters(drafts.titleExclude);

  if (
    includeTerms.length > 0 &&
    includeTerms.some(function (term) {
      return title.includes(term) !== true;
    })
  ) {
    return false;
  }

  return excludeTerms.some(function (term) {
    return title.includes(term);
  }) !== true;
}

function matchesSubtitleLiveMode(metadata, drafts) {
  const liveMode = asNonEmptyString(drafts.liveMode) || "all";
  if (liveMode === "all") {
    return true;
  }

  const liveStatus = String(asNonEmptyString(metadata.live_status) || "").toLowerCase();
  const isLive =
    metadata.is_live === true ||
    liveStatus === "is_live" ||
    liveStatus === "is-upcoming" ||
    liveStatus === "is_upcoming";
  if (liveMode === "only-live") {
    return isLive;
  }
  if (liveMode === "exclude-live") {
    return isLive !== true;
  }
  return true;
}

function needsSubtitleYoutubeMetadataFiltering(drafts) {
  return (
    parseSubtitleWeekdayFilter(drafts.weekdays).length > 0 ||
    asNumber(drafts.durationMinSeconds) !== null ||
    asNumber(drafts.durationMaxSeconds) !== null ||
    (asNonEmptyString(drafts.shortsMode) || "all") !== "all" ||
    (asNonEmptyString(drafts.liveMode) || "all") !== "all" ||
    parseSubtitleTitleFilters(drafts.titleInclude).length > 0 ||
    parseSubtitleTitleFilters(drafts.titleExclude).length > 0
  );
}

function buildSubtitleYoutubeCandidateUrl(entry, fallbackUrl) {
  const record = toRecord(entry);
  return (
    asNonEmptyString(record.webpage_url) ||
    asNonEmptyString(record.original_url) ||
    (asNonEmptyString(record.url) && String(record.url).startsWith("http")
      ? asNonEmptyString(record.url)
      : null) ||
    (asNonEmptyString(record.id) ? `https://www.youtube.com/watch?v=${record.id}` : null) ||
    fallbackUrl
  );
}

function parseToolRunJson(stdoutValue) {
  const trimmed = String(stdoutValue || "").trim();
  if (trimmed === "") {
    return null;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(function (line) {
      return line.startsWith("{") || line.startsWith("[");
    });

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch (_error) {
      // Keep scanning.
    }
  }

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return null;
  }
}

async function runSubtitleYoutubeMetadata(runtime, requestId, jobId, urlValue, flatPlaylist) {
  const runResult = await callRoomTools({
    operation: "tool-run",
    roomId: ROOM_ID,
    requestId: requestId,
    jobId: `${jobId}-${flatPlaylist ? "flat" : "single"}`,
    toolId: "yt-dlp",
    cwd: runtime.paths.storageDir,
    args: flatPlaylist === true
      ? ["--dump-single-json", "--flat-playlist", "--skip-download", urlValue]
      : ["--dump-single-json", "--skip-download", urlValue],
    timeoutMs: 10 * 60 * 1000,
  });

  const payload = parseToolRunJson(toRecord(runResult.run).stdout);
  if (!payload || typeof payload !== "object") {
    throw new Error("yt-dlp metadata output could not be parsed.");
  }
  return payload;
}

function buildSubtitleYoutubeDownloadArgs(runtime, drafts, sourceDir, urlValue, scopeId) {
  const args = [
    "--newline",
    "--progress",
    "--ignore-errors",
    "--skip-download",
    "--sub-format",
    "vtt/srt/ass/best",
    "-o",
    `${sourceDir}/%(title).120B-%(id)s.%(ext)s`,
  ];
  const subtitleMode = asNonEmptyString(drafts.subtitleMode) || "manual";
  const subtitlesLang = asNonEmptyString(drafts.subtitlesLang) || "all";
  const publishedAfter = formatYoutubeDateForTool(drafts.publishedAfter);
  const publishedBefore = formatYoutubeDateForTool(drafts.publishedBefore);
  const playlistItems = asNonEmptyString(drafts.playlistItems);
  const limitCount = asNumber(drafts.limitCount);

  if (subtitleMode === "manual" || subtitleMode === "both") {
    args.push("--write-subs");
  }
  if (subtitleMode === "auto" || subtitleMode === "both") {
    args.push("--write-auto-subs");
  }
  args.push("--sub-langs", subtitlesLang);

  if (toRecord(toRecord(runtime.toolState).tools).ffmpeg?.installed === true) {
    args.push("--convert-subs", "srt");
  }
  if (publishedAfter !== null) {
    args.push("--dateafter", publishedAfter);
  }
  if (publishedBefore !== null) {
    args.push("--datebefore", publishedBefore);
  }
  if (scopeId === "single") {
    args.push("--no-playlist");
  } else if (playlistItems !== null) {
    args.push("--playlist-items", playlistItems);
  }
  if (scopeId !== "single" && limitCount !== null && limitCount > 0) {
    args.push("--playlist-end", String(limitCount));
  }

  args.push(urlValue);
  return args;
}

function getSubtitleAvailableLanguages(metadata) {
  const manualLanguages = Object.keys(toRecord(metadata.subtitles));
  const autoLanguages = Object.keys(toRecord(metadata.automatic_captions));
  return Array.from(new Set(manualLanguages.concat(autoLanguages))).sort();
}

function getSubtitleLiveStatus(metadata) {
  return (
    asNonEmptyString(metadata.live_status) ||
    (metadata.is_live === true ? "live" : metadata.was_live === true ? "post_live" : "offline")
  );
}

function buildSubtitleDiscoveryItem(metadata, candidateUrl, scopeId) {
  const title = asNonEmptyString(metadata.title);
  const videoId = asNonEmptyString(metadata.id);
  return normalizeSubtitleDiscoveryItem(
    {
      id:
        videoId ||
        `subtitle-discovery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: candidateUrl,
      videoId: videoId,
      title: title || candidateUrl || `Subtitle candidate ${scopeId}`,
      channelTitle: asNonEmptyString(metadata.channel) || asNonEmptyString(metadata.uploader),
      publishedAt:
        asNonEmptyString(metadata.upload_date) ||
        asNonEmptyString(metadata.release_date) ||
        asNonEmptyString(metadata.timestamp),
      durationSeconds: asNumber(metadata.duration),
      isShort:
        typeof metadata.is_short === "boolean"
          ? metadata.is_short
          : (asNonEmptyString(metadata.webpage_url) || "").includes("/shorts/") ||
              (asNumber(metadata.duration) !== null && asNumber(metadata.duration) <= 180),
      liveStatus: getSubtitleLiveStatus(metadata),
      subtitleLanguages: getSubtitleAvailableLanguages(metadata),
      metadata: {
        scopeId: scopeId,
      },
    },
    0
  );
}

async function collectSubtitleYoutubeDiscovery(runtime, requestId, jobId, urlValue, scopeId, drafts) {
  const catalog =
    scopeId === "single"
      ? { entries: [await runSubtitleYoutubeMetadata(runtime, requestId, jobId, urlValue, false)] }
      : await runSubtitleYoutubeMetadata(runtime, requestId, jobId, urlValue, true);
  const candidateEntries = Array.isArray(toRecord(catalog).entries) ? toRecord(catalog).entries : [];
  const limitCount = asNumber(drafts.limitCount);
  const slicedCandidates =
    limitCount !== null && limitCount > 0 ? candidateEntries.slice(0, limitCount) : candidateEntries;
  const matchedItems = [];

  for (let index = 0; index < slicedCandidates.length; index += 1) {
    const candidateUrl = buildSubtitleYoutubeCandidateUrl(slicedCandidates[index], urlValue);
    if (candidateUrl === null) {
      continue;
    }

    const metadata =
      scopeId === "single" ? slicedCandidates[index] : await runSubtitleYoutubeMetadata(runtime, requestId, jobId, candidateUrl, false);
    if (
      matchesSubtitlePublishedRange(metadata, drafts) !== true ||
      matchesSubtitleWeekday(metadata, drafts) !== true ||
      matchesSubtitleDuration(metadata, drafts) !== true ||
      matchesSubtitleShortsMode(metadata, drafts) !== true ||
      matchesSubtitleLanguageAvailability(metadata, drafts) !== true ||
      matchesSubtitleLiveMode(metadata, drafts) !== true ||
      matchesSubtitleTitleFilters(metadata, drafts) !== true
    ) {
      continue;
    }

    matchedItems.push(buildSubtitleDiscoveryItem(metadata, candidateUrl, scopeId));
  }

  return {
    totalCandidateCount: slicedCandidates.length,
    items: matchedItems,
  };
}

async function handleSubtitleLocalPick(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  const electronApi = getElectronApi();
  if (project === null) {
    throw new Error("Active project is missing.");
  }
  if (electronApi === null || typeof electronApi.showOpenDialog !== "function") {
    throw new Error("File picker is unavailable.");
  }

  const dialogResult = await electronApi.showOpenDialog({
    properties: ["openFile"],
    filters: Array.isArray(toRecord(runtime.subtitleSourcePresets).fileDialogFilters)
      ? runtime.subtitleSourcePresets.fileDialogFilters
      : [],
  });

  if (!dialogResult || dialogResult.canceled === true || !Array.isArray(dialogResult.filePaths)) {
    return { cancelled: true };
  }

  const selectedPath = asNonEmptyString(dialogResult.filePaths[0]);
  if (selectedPath === null) {
    return { cancelled: true };
  }

  const selectedName = selectedPath.split(/[\\/]/).pop() || selectedPath;
  if (isSubtitleFileName(runtime, selectedName) !== true) {
    throw new Error("Pick a supported subtitle file.");
  }

  const targetDir = getProjectSubtitleSourceDir(runtime, project);
  const copyResult = await electronApi.copyFileTo(selectedPath, targetDir);
  if (!copyResult || copyResult.success !== true) {
    throw new Error((copyResult && (copyResult.message || copyResult.error)) || "Copy failed.");
  }

  const subtitleEntry = createSubtitleEntryRecord(asNonEmptyString(copyResult.path), {
    fileName: asNonEmptyString(copyResult.name) || selectedName,
    sourceType: "local-file",
    sourceUrl: selectedPath,
  });
  await patchActiveProject(runtime, function (nextProject) {
    resetSubtitleDiscovery(runtime, nextProject);
    upsertSubtitleEntries(runtime, nextProject, [subtitleEntry], {
      mode: "local-file",
      activeEntryId: subtitleEntry.id,
      selectedEntryIds: [subtitleEntry.id],
      replaceExisting: false,
    });
    return nextProject;
  });
  return subtitleEntry;
}

async function handleSubtitleFolderPick(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  const electronApi = getElectronApi();
  if (project === null) {
    throw new Error("Active project is missing.");
  }
  if (electronApi === null || typeof electronApi.showOpenDialog !== "function") {
    throw new Error("Folder picker is unavailable.");
  }

  const dialogResult = await electronApi.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (!dialogResult || dialogResult.canceled === true || !Array.isArray(dialogResult.filePaths)) {
    return { cancelled: true };
  }

  const selectedDir = asNonEmptyString(dialogResult.filePaths[0]);
  if (selectedDir === null) {
    return { cancelled: true };
  }

  const directoryEntries = await listSubtitleFilesInDirectory(runtime, selectedDir);
  if (directoryEntries.length === 0) {
    throw new Error("No supported subtitle files were found in the selected folder.");
  }

  const targetDir = getProjectSubtitleSourceDir(runtime, project);
  const importedEntries = [];
  const failedEntries = [];
  for (let index = 0; index < directoryEntries.length; index += 1) {
    const entry = directoryEntries[index];
    const copyResult = await electronApi.copyFileTo(entry.path, targetDir);
    if (!copyResult || copyResult.success !== true) {
      failedEntries.push(
        `${entry.name}: ${(copyResult && (copyResult.message || copyResult.error)) || "Folder copy failed."}`
      );
      continue;
    }
    importedEntries.push(
      createSubtitleEntryRecord(asNonEmptyString(copyResult.path), {
        fileName: asNonEmptyString(copyResult.name) || entry.name,
        sourceType: "local-folder",
        sourceUrl: entry.path,
      })
    );
  }

  if (importedEntries.length === 0) {
    throw new Error(
      failedEntries[0] || "Folder import failed before any subtitle file could be copied."
    );
  }

  await patchActiveProject(runtime, function (nextProject) {
    resetSubtitleDiscovery(runtime, nextProject);
    upsertSubtitleEntries(runtime, nextProject, importedEntries, {
      mode: "local-folder",
      activeEntryId: importedEntries[0] ? importedEntries[0].id : null,
      selectedEntryIds: importedEntries.map(function (entry) {
        return entry.id;
      }),
      replaceExisting: false,
    });
    if (failedEntries.length > 0) {
      const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      subtitleState.workspace.lastError = `Skipped ${failedEntries.length} subtitle file(s) during folder import.`;
      subtitleState.workspace.lastActionAt = new Date().toISOString();
      nextProject.subtitleAnalysis = subtitleState;
    }
    return nextProject;
  });
  return {
    count: importedEntries.length,
    failedCount: failedEntries.length,
  };
}

async function handleSubtitleUrlDownload(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
  const drafts = toRecord(toRecord(subtitleState.workspace).drafts);
  const urlValue = asNonEmptyString(drafts.urlInput);
  if (urlValue === null) {
    throw new Error("Direct subtitle URL is empty.");
  }

  const fileName = getSubtitleUrlFileName(urlValue, drafts.fileNameHint);
  const jobId = `room-subtitle-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "subtitle-source-download-url",
    projectId: project.id,
    featureStage: "source",
  });
  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "subtitle-source-download-url",
    projectId: project.id,
    featureStage: "source",
    stage: "queued",
  });

  try {
    const downloadResult = await callRoomTools({
      operation: "download-file",
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      url: urlValue,
      destinationPath: `${getProjectSubtitleSourceDir(runtime, project)}/${fileName}`,
      overwrite: false,
    });

    const downloaded = toRecord(downloadResult.download);
    const subtitleEntry = createSubtitleEntryRecord(asNonEmptyString(downloaded.path), {
      fileName: asNonEmptyString(downloaded.fileName) || fileName,
      sourceType: "url",
      sourceUrl: urlValue,
      metadata: {
        mimeType: asNonEmptyString(downloaded.contentType) || getSubtitleMimeType(fileName),
      },
    });
    await patchActiveProject(runtime, function (nextProject) {
      resetSubtitleDiscovery(runtime, nextProject);
      upsertSubtitleEntries(runtime, nextProject, [subtitleEntry], {
        mode: "url",
        activeEntryId: subtitleEntry.id,
        selectedEntryIds: [subtitleEntry.id],
        replaceExisting: false,
      });
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-download-url",
      projectId: project.id,
      featureStage: "source",
      stage: "completed",
      percent: 100,
    });
    return subtitleEntry;
  } catch (error) {
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-download-url",
      projectId: project.id,
      featureStage: "source",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

async function handleSubtitleYoutubeDiscovery(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  const ytDlpState = toRecord(toRecord(runtime.toolState).tools)["yt-dlp"];
  if (project === null) {
    throw new Error("Active project is missing.");
  }
  if (toRecord(ytDlpState).installed !== true) {
    throw new Error("yt-dlp is not installed.");
  }

  const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
  const drafts = toRecord(toRecord(subtitleState.workspace).drafts);
  const urlValue = asNonEmptyString(drafts.youtubeUrl);
  const scopeId =
    subtitleState.workspace.mode === "youtube-playlist"
      ? "playlist"
      : subtitleState.workspace.mode === "youtube-channel"
        ? "channel"
        : "single";
  if (urlValue === null) {
    throw new Error("YouTube URL is empty.");
  }

  const jobId = `room-subtitle-youtube-discovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "subtitle-source-discover-youtube",
    projectId: project.id,
    toolId: "yt-dlp",
    featureStage: "source",
  });
  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "subtitle-source-discover-youtube",
    projectId: project.id,
    toolId: "yt-dlp",
    featureStage: "source",
    stage: "queued",
  });

  try {
    const discoveryResult = await collectSubtitleYoutubeDiscovery(runtime, requestId, jobId, urlValue, scopeId, drafts);
    if (discoveryResult.items.length === 0) {
      throw new Error("No videos matched the requested subtitle filters.");
    }

    await patchActiveProject(runtime, function (nextProject) {
      const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      nextSubtitleState.workspace.mode = subtitleState.workspace.mode;
      nextSubtitleState.workspace.lastError = null;
      nextSubtitleState.workspace.lastActionAt = new Date().toISOString();
      nextSubtitleState.discovery = {
        status: "ready",
        scope: scopeId,
        items: discoveryResult.items,
        selectedCandidateIds: discoveryResult.items.map(function (entry) {
          return entry.id;
        }),
        totalCandidateCount: discoveryResult.totalCandidateCount,
        lastError: null,
        lastRunAt: new Date().toISOString(),
        lastDownloadAt: asNonEmptyString(toRecord(nextSubtitleState.discovery).lastDownloadAt),
      };
      nextProject.subtitleAnalysis = nextSubtitleState;
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-discover-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "completed",
      percent: 100,
      message: `${discoveryResult.items.length} subtitle candidate(s) are ready for selection.`,
    });
    return {
      count: discoveryResult.items.length,
      totalCandidateCount: discoveryResult.totalCandidateCount,
    };
  } catch (error) {
    await patchActiveProject(runtime, function (nextProject) {
      const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      nextSubtitleState.discovery = {
        ...createEmptySubtitleDiscoveryState(),
        status: "error",
        scope: scopeId,
        lastError: error instanceof Error ? error.message : String(error),
        lastRunAt: new Date().toISOString(),
      };
      nextSubtitleState.workspace.lastError = error instanceof Error ? error.message : String(error);
      nextSubtitleState.workspace.lastActionAt = new Date().toISOString();
      nextProject.subtitleAnalysis = nextSubtitleState;
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-discover-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

async function handleSubtitleYoutubeDownload(api, runtime, requestId) {
  const project = getActiveProject(runtime);
  const ytDlpState = toRecord(toRecord(runtime.toolState).tools)["yt-dlp"];
  if (project === null) {
    throw new Error("Active project is missing.");
  }
  if (toRecord(ytDlpState).installed !== true) {
    throw new Error("yt-dlp is not installed.");
  }

  const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
  const drafts = toRecord(toRecord(subtitleState.workspace).drafts);
  const urlValue = asNonEmptyString(drafts.youtubeUrl);
  const scopeId =
    subtitleState.workspace.mode === "youtube-playlist"
      ? "playlist"
      : subtitleState.workspace.mode === "youtube-channel"
        ? "channel"
        : "single";
  if (urlValue === null) {
    throw new Error("YouTube URL is empty.");
  }

  const discoveryItems = Array.isArray(toRecord(subtitleState.discovery).items)
    ? toRecord(subtitleState.discovery).items.map(function (entry, index) {
        return normalizeSubtitleDiscoveryItem(entry, index);
      })
    : [];
  const selectedCandidateIds = normalizeStringArray(toRecord(subtitleState.discovery).selectedCandidateIds);
  const selectedCandidates = discoveryItems.filter(function (entry) {
    return selectedCandidateIds.includes(entry.id) && entry.url !== null;
  });
  if (selectedCandidates.length === 0) {
    throw new Error("Run discovery and select at least one video before downloading subtitles.");
  }

  const jobId = `room-subtitle-youtube-download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceDir = getProjectSubtitleSourceDir(runtime, project);
  const beforePaths = new Set(
    (await listSubtitleFilesInDirectory(runtime, sourceDir)).map(function (entry) {
      return entry.path;
    })
  );

  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: "subtitle-source-download-youtube",
    projectId: project.id,
    toolId: "yt-dlp",
    featureStage: "source",
  });
  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: "subtitle-source-download-youtube",
    projectId: project.id,
    toolId: "yt-dlp",
    featureStage: "source",
    stage: "queued",
  });

  try {
    for (let index = 0; index < selectedCandidates.length; index += 1) {
      await callRoomTools({
        operation: "tool-run",
        roomId: ROOM_ID,
        requestId: requestId,
        jobId: `${jobId}-${index}`,
        toolId: "yt-dlp",
        cwd: sourceDir,
        args: buildSubtitleYoutubeDownloadArgs(runtime, drafts, sourceDir, selectedCandidates[index].url, "single"),
        timeoutMs: 20 * 60 * 1000,
      });
    }

    const sourceType =
      scopeId === "channel" ? "youtube-channel" : scopeId === "playlist" ? "youtube-playlist" : "youtube-single";
    const afterEntries = await listSubtitleFilesInDirectory(runtime, sourceDir);
    const importedEntries = afterEntries
      .filter(function (entry) {
        return beforePaths.has(entry.path) !== true;
      })
      .map(function (entry) {
        const matchedDiscovery =
          selectedCandidates.find(function (candidate) {
            const candidateId = asNonEmptyString(candidate.videoId);
            return candidateId !== null && entry.name.includes(candidateId);
          }) ||
          selectedCandidates[0] ||
          null;
        return createSubtitleEntryRecord(entry.path, {
          fileName: entry.name,
          sourceType: sourceType,
          sourceUrl: matchedDiscovery ? matchedDiscovery.url : urlValue,
          publishedAt: matchedDiscovery ? matchedDiscovery.publishedAt : null,
          durationSeconds: matchedDiscovery ? matchedDiscovery.durationSeconds : null,
          isShort: matchedDiscovery ? matchedDiscovery.isShort : null,
          metadata: {
            subtitleLanguages: matchedDiscovery ? matchedDiscovery.subtitleLanguages : [],
          },
        });
      });

    if (importedEntries.length === 0) {
      throw new Error("yt-dlp finished without creating subtitle files.");
    }

    await patchActiveProject(runtime, function (nextProject) {
      upsertSubtitleEntries(runtime, nextProject, importedEntries, {
        mode: subtitleState.workspace.mode,
        activeEntryId: importedEntries[0] ? importedEntries[0].id : null,
        selectedEntryIds: importedEntries.map(function (entry) {
          return entry.id;
        }),
        replaceExisting: false,
      });
      const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      nextSubtitleState.discovery = {
        ...nextSubtitleState.discovery,
        status: "ready",
        scope: scopeId,
        lastError: null,
        lastDownloadAt: new Date().toISOString(),
      };
      nextProject.subtitleAnalysis = nextSubtitleState;
      return nextProject;
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "completed",
      percent: 100,
      message: `${importedEntries.length} subtitle file(s) imported from ${selectedCandidates.length} selected video(s).`,
    });
    return {
      count: importedEntries.length,
      selectedVideoCount: selectedCandidates.length,
    };
  } catch (error) {
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

async function previewSubtitleEdit(runtime, requestId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  const activeEntry = getActiveSubtitleEntry(project);
  if (activeEntry === null || activeEntry.path === null) {
    throw new Error("Pick a subtitle entry before previewing cleanup.");
  }

  const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
  const sourceText = await readSubtitleText(activeEntry.path);
  const outputFormat = resolveSubtitleOutputFormat(activeEntry.format, toRecord(subtitleState.edit.recipe).outputFormat);
  const outputText = transformSubtitleDocument(sourceText, activeEntry.format, subtitleState.edit.recipe, outputFormat);
  const summary = buildSubtitleEditSummary(sourceText, outputText, activeEntry.format, outputFormat);

  await patchActiveProject(runtime, function (nextProject) {
    const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
    nextSubtitleState.edit.preview = {
      status: "ready",
      entryId: activeEntry.id,
      outputText: outputText,
      warnings: summary.maxLineLength > Number(nextSubtitleState.edit.recipe.maxCharsPerLine || 42)
        ? ["Some output lines are still longer than the configured line budget."]
        : [],
      summary: summary,
    };
    nextSubtitleState.edit.lastError = null;
    nextSubtitleState.edit.lastActionAt = new Date().toISOString();
    nextProject.subtitleAnalysis = nextSubtitleState;
    return nextProject;
  });

  void requestId;
  return summary;
}

async function applySubtitleEdit(runtime, requestId) {
  const project = getActiveProject(runtime);
  if (project === null) {
    throw new Error("Active project is missing.");
  }

  const activeEntry = getActiveSubtitleEntry(project);
  if (activeEntry === null || activeEntry.path === null) {
    throw new Error("Pick a subtitle entry before applying cleanup.");
  }

  await ensureProjectDirectories(runtime, project, requestId);
  const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
  const sourceText = await readSubtitleText(activeEntry.path);
  const outputFormat = resolveSubtitleOutputFormat(activeEntry.format, toRecord(subtitleState.edit.recipe).outputFormat);
  const outputText = transformSubtitleDocument(sourceText, activeEntry.format, subtitleState.edit.recipe, outputFormat);
  const summary = buildSubtitleEditSummary(sourceText, outputText, activeEntry.format, outputFormat);
  const outputNameHint = asNonEmptyString(toRecord(subtitleState.edit.recipe).outputNameHint);
  const sourceStem = String(activeEntry.fileName || "subtitle").replace(/\.[^.]+$/, "");
  const outputStem = outputNameHint !== null ? sanitizeFileSegment(outputNameHint, sourceStem) : `${sourceStem}-cleaned`;
  const outputPath = `${getProjectSubtitleEditOutputDir(runtime, project)}/${outputStem}.${outputFormat}`;
  const outputLabel = `${activeEntry.fileName} cleanup`;

  await writeTextFile(outputPath, outputText);
  const outputRecord = normalizeSubtitleOutputRecord(
    {
      id: `subtitle-output-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      entryId: activeEntry.id,
      label: outputLabel,
      format: outputFormat,
      path: outputPath,
      createdAt: new Date().toISOString(),
      summary: summary,
    },
    0
  );

  await patchActiveProject(runtime, function (nextProject) {
    const nextSubtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
    nextSubtitleState.edit.preview = {
      status: "ready",
      entryId: activeEntry.id,
      outputText: outputText,
      warnings: [],
      summary: summary,
    };
    nextSubtitleState.edit.outputs = [outputRecord].concat(
      nextSubtitleState.edit.outputs.filter(function (entry) {
        return asNonEmptyString(toRecord(entry).id) !== outputRecord.id;
      })
    ).map(function (entry, index) {
      return normalizeSubtitleOutputRecord(entry, index);
    }).slice(0, 12);
    nextSubtitleState.edit.lastError = null;
    nextSubtitleState.edit.lastActionAt = new Date().toISOString();
    nextProject.subtitleAnalysis = nextSubtitleState;
    markFeatureProcessStale(nextProject, SUBTITLE_FEATURE_ID, "Subtitle outputs changed.");
    markFeatureReportStale(nextProject, SUBTITLE_FEATURE_ID, "Subtitle outputs changed.");
    return nextProject;
  });

  return outputRecord;
}

function updateToolBusy(runtime, toolId, busy, lastError) {
  runtime.toolState.tools[toolId] = {
    ...createDefaultToolEntry(toolId),
    ...toRecord(runtime.toolState.tools[toolId]),
    toolId: toolId,
    busy: busy === true,
    lastError: lastError || null,
  };
}

async function handleToolMutation(api, runtime, requestId, action, toolId, featureStage) {
  if (getRuntimeToolIds(runtime).includes(toolId) === false) {
    throw new Error(`Unsupported tool: ${toolId}`);
  }

  const operation = action === "tool-update" ? "tool-update" : "tool-install";
  const jobId = `room-tool-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  updateToolBusy(runtime, toolId, true, null);
  registerJob(runtime, {
    jobId: jobId,
    requestId: requestId,
    action: action,
    toolId: toolId,
    featureStage: featureStage || "source",
  });

  pushJobState(api, {
    requestId: requestId,
    jobId: jobId,
    action: action,
    toolId: toolId,
    featureStage: featureStage || "source",
    stage: "queued",
  });

  try {
    const result = await callRoomTools({
      operation: operation,
      roomId: ROOM_ID,
      requestId: requestId,
      jobId: jobId,
      toolId: toolId,
    });

    runtime.toolState.tools[toolId] = {
      ...createDefaultToolEntry(toolId),
      ...toRecord(runtime.toolState.tools[toolId]),
      ...toRecord(result.tool),
      toolId: toolId,
      busy: false,
      lastError: null,
      updateAvailable: false,
      latestVersion: result.tool ? result.tool.version : null,
      latestReleaseTag: result.tool ? result.tool.releaseTag : null,
      latestReleaseName: result.tool ? result.tool.releaseName : null,
      lastCheckedAt: new Date().toISOString(),
    };

    await persistToolState(runtime);
    if (toolId === "whisper.cpp") {
      await refreshProfileModelState(runtime);
    }
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      toolId: toolId,
      featureStage: featureStage || "source",
      stage: "completed",
      percent: 100,
    });
    return result.tool;
  } catch (error) {
    updateToolBusy(runtime, toolId, false, error instanceof Error ? error.message : String(error));
    await persistToolState(runtime);
    if (toolId === "whisper.cpp") {
      await refreshProfileModelState(runtime);
    }
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      toolId: toolId,
      featureStage: featureStage || "source",
      stage: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearJob(runtime, jobId);
  }
}

function updateJobFromProgress(runtime, eventPayload) {
  const jobId = asNonEmptyString(eventPayload.jobId);
  if (!jobId || !runtime.jobs[jobId]) {
    return null;
  }

  const job = runtime.jobs[jobId];
  job.stage = asNonEmptyString(eventPayload.stage) || job.stage;
  if (typeof eventPayload.percent === "number") {
    job.percent = eventPayload.percent;
  } else if (
    typeof eventPayload.bytesReceived === "number" &&
    typeof eventPayload.bytesTotal === "number" &&
    eventPayload.bytesTotal > 0
  ) {
    job.percent = Math.round((eventPayload.bytesReceived / eventPayload.bytesTotal) * 100);
  }
  job.message = asNonEmptyString(eventPayload.message) || job.message;

  if (
    asNonEmptyString(eventPayload.operation) === "tool-run" &&
    (eventPayload.stage === "stdout" || eventPayload.stage === "stderr")
  ) {
    const chunk = asNonEmptyString(eventPayload.chunk);
    if (chunk) {
      const match = chunk.match(/(\d{1,3}(?:\.\d+)?)%/);
      if (match) {
        job.percent = Number(match[1]);
      }
    }
  }

  return {
    requestId: job.requestId,
    jobId: jobId,
    action: job.action,
    projectId: job.projectId,
    toolId: job.toolId,
    featureStage: job.featureStage || null,
    stage: job.stage,
    percent: job.percent,
    message: job.message,
  };
}

function ensureRoomToolsSubscription(api, runtime) {
  const electronApi = getElectronApi();
  if (
    runtime.roomToolsSubscribed === true ||
    electronApi === null ||
    typeof electronApi.onRoomToolsProgress !== "function"
  ) {
    return;
  }

  runtime.roomToolsProgressHandler = function (eventPayload) {
    if (!eventPayload || eventPayload.roomId !== ROOM_ID) {
      return;
    }

    const nextJobPayload = updateJobFromProgress(runtime, toRecord(eventPayload));
    if (!nextJobPayload) {
      return;
    }

    pushJobState(api, nextJobPayload);
    pushSourceState(api, runtime, nextJobPayload.requestId, nextJobPayload.action);
  };

  electronApi.onRoomToolsProgress(runtime.roomToolsProgressHandler);
  runtime.roomToolsSubscribed = true;
}

function tearDownRoomToolsSubscription(runtime) {
  const electronApi = getElectronApi();
  if (
    runtime.roomToolsSubscribed !== true ||
    electronApi === null ||
    typeof electronApi.offRoomToolsProgress !== "function" ||
    typeof runtime.roomToolsProgressHandler !== "function"
  ) {
    return;
  }

  electronApi.offRoomToolsProgress(runtime.roomToolsProgressHandler);
  runtime.roomToolsProgressHandler = null;
  runtime.roomToolsSubscribed = false;
}

async function handleMediaAction(api, runtime, payload) {
  const requestId = asNonEmptyString(payload.requestId) || createRequestId();
  const action = asNonEmptyString(payload.action);
  const actionPayload = toRecord(payload.payload);
  const featureStage = asNonEmptyString(actionPayload.featureStage) || null;
  const featureId =
    asNonEmptyString(actionPayload.featureId) || getFeatureIdFromContext(loadContext(api));

  if (action === null) {
    pushActionResult(api, {
      requestId: requestId,
      success: false,
      action: "",
      error: "Action is missing.",
    });
    return;
  }

  try {
    await ensureHydrated(api, runtime);

    switch (action) {
      case "refresh":
        await refreshToolStatus(runtime, { checkUpdates: false });
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "tools-refresh":
        await refreshToolStatus(runtime, { checkUpdates: true });
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "project-create":
        await createProject(runtime, featureId);
        break;
      case "project-select":
        runtime.activeProjectId = asNonEmptyString(actionPayload.projectId);
        await ensureProjectExists(runtime, featureId);
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "project-delete":
        await deleteProject(runtime, asNonEmptyString(actionPayload.projectId), requestId, featureId);
        break;
      case "subtitle-source-set-mode":
        await patchActiveProject(runtime, function (nextProject) {
          const nextMode =
            asNonEmptyString(actionPayload.mode) ||
            asNonEmptyString(
              toRecord(normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime).workspace).mode
            ) ||
            "local-file";
          const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
          if (subtitleState.workspace.mode !== nextMode) {
            subtitleState.discovery = createEmptySubtitleDiscoveryState();
          }
          subtitleState.workspace.mode = nextMode;
          subtitleState.workspace.lastError = null;
          subtitleState.workspace.lastActionAt = new Date().toISOString();
          nextProject.subtitleAnalysis = subtitleState;
          return nextProject;
        });
        break;
      case "subtitle-source-update-drafts":
        await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
        break;
      case "subtitle-source-pick-local":
        await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
        await handleSubtitleLocalPick(api, runtime, requestId);
        break;
      case "subtitle-source-pick-folder":
        await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
        await handleSubtitleFolderPick(api, runtime, requestId);
        break;
      case "subtitle-source-download-url":
        await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
        await handleSubtitleUrlDownload(api, runtime, requestId);
        break;
      case "subtitle-source-discover-youtube":
        await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
        await handleSubtitleYoutubeDiscovery(api, runtime, requestId);
        break;
      case "subtitle-source-download-youtube":
        await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
        await handleSubtitleYoutubeDownload(api, runtime, requestId);
        break;
      case "subtitle-source-toggle-discovery":
        await patchActiveProject(runtime, function (nextProject) {
          const candidateId = asNonEmptyString(actionPayload.candidateId);
          const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
          const selectedIds = normalizeStringArray(toRecord(subtitleState.discovery).selectedCandidateIds);
          const nextSelectedIds = selectedIds.includes(candidateId)
            ? selectedIds.filter(function (entry) {
                return entry !== candidateId;
              })
            : selectedIds.concat(candidateId);
          subtitleState.discovery.selectedCandidateIds = nextSelectedIds;
          subtitleState.workspace.lastError = null;
          subtitleState.workspace.lastActionAt = new Date().toISOString();
          nextProject.subtitleAnalysis = subtitleState;
          return nextProject;
        });
        break;
      case "subtitle-source-select-all-discovery":
        await patchActiveProject(runtime, function (nextProject) {
          const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
          subtitleState.discovery.selectedCandidateIds = (Array.isArray(toRecord(subtitleState.discovery).items)
            ? toRecord(subtitleState.discovery).items
            : []
          ).map(function (entry, index) {
            return normalizeSubtitleDiscoveryItem(entry, index).id;
          });
          subtitleState.workspace.lastError = null;
          subtitleState.workspace.lastActionAt = new Date().toISOString();
          nextProject.subtitleAnalysis = subtitleState;
          return nextProject;
        });
        break;
      case "subtitle-source-clear-discovery-selection":
        await patchActiveProject(runtime, function (nextProject) {
          const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
          subtitleState.discovery.selectedCandidateIds = [];
          subtitleState.workspace.lastError = null;
          subtitleState.workspace.lastActionAt = new Date().toISOString();
          nextProject.subtitleAnalysis = subtitleState;
          return nextProject;
        });
        break;
      case "subtitle-source-select-entry":
        await patchActiveProject(runtime, function (nextProject) {
          const entryId = asNonEmptyString(actionPayload.entryId);
          const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
          const availableEntries = getSubtitleEntries(nextProject);
          const selectedEntry =
            availableEntries.find(function (entry) {
              return entry.id === entryId;
            }) || null;
          subtitleState.activeEntryId = selectedEntry ? selectedEntry.id : subtitleState.activeEntryId;
          if (selectedEntry) {
            subtitleState.workspace.selection.selectedEntryIds = [selectedEntry.id];
          }
          subtitleState.workspace.lastError = null;
          subtitleState.workspace.lastActionAt = new Date().toISOString();
          nextProject.subtitleAnalysis = subtitleState;
          markFeatureProcessStale(nextProject, SUBTITLE_FEATURE_ID, "Subtitle selection changed.");
          markFeatureReportStale(nextProject, SUBTITLE_FEATURE_ID, "Subtitle selection changed.");
          return nextProject;
        });
        break;
      case "subtitle-source-toggle-selection":
        await patchActiveProject(runtime, function (nextProject) {
          const entryId = asNonEmptyString(actionPayload.entryId);
          const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
          const selectedIds = normalizeStringArray(toRecord(toRecord(subtitleState.workspace).selection).selectedEntryIds);
          const nextSelectedIds = selectedIds.includes(entryId)
            ? selectedIds.filter(function (candidateId) {
                return candidateId !== entryId;
              })
            : selectedIds.concat(entryId);
          subtitleState.workspace.selection.selectedEntryIds = nextSelectedIds;
          if (nextSelectedIds.length > 0) {
            subtitleState.activeEntryId = nextSelectedIds[0];
          }
          subtitleState.workspace.lastError = null;
          subtitleState.workspace.lastActionAt = new Date().toISOString();
          nextProject.subtitleAnalysis = subtitleState;
          markFeatureProcessStale(nextProject, SUBTITLE_FEATURE_ID, "Subtitle batch selection changed.");
          markFeatureReportStale(nextProject, SUBTITLE_FEATURE_ID, "Subtitle batch selection changed.");
          return nextProject;
        });
        break;
      case "source-set-kind":
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.source.kind =
            asNonEmptyString(actionPayload.kind) || getDefaultSourceType(runtime.sourcePresets);
          nextProject.source.mode = getDefaultMode(runtime.sourcePresets, nextProject.source.kind);
          nextProject.source.status = "idle";
          nextProject.source.storedPath = null;
          nextProject.source.storedFileName = null;
          nextProject.source.sourceUrl = null;
          nextProject.source.mimeType = null;
          nextProject.source.routeLabel = null;
          nextProject.source.lastError = null;
          nextProject.source.metadata = null;
          nextProject.source.metadataError = null;
          resetEditForCurrentSource(runtime, nextProject);
          resetProfileForCurrentSource(
            runtime,
            nextProject,
            "Source type changed; rerun the profile preflight."
          );
          return nextProject;
        });
        break;
      case "source-set-mode":
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.source.mode =
            asNonEmptyString(actionPayload.mode) || getDefaultMode(runtime.sourcePresets, nextProject.source.kind);
          nextProject.source.lastError = null;
          return nextProject;
        });
        break;
      case "source-update-draft":
        await patchActiveProjectDrafts(runtime, actionPayload.fields);
        break;
      case "source-pick-local":
        await patchActiveProjectDrafts(runtime, actionPayload.fields);
        await handleLocalPick(api, runtime, requestId);
        break;
      case "source-download-url":
        await patchActiveProjectDrafts(runtime, actionPayload.fields);
        await handleUrlDownload(api, runtime, requestId);
        break;
      case "source-download-youtube":
        await patchActiveProjectDrafts(runtime, actionPayload.fields);
        await handleYoutubeDownload(api, runtime, requestId);
        break;
      case "edit-set-mode":
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.edit.mode = asNonEmptyString(actionPayload.mode) === "advanced" ? "advanced" : "beginner";
          nextProject.edit.lastError = null;
          nextProject.edit.lastActionAt = new Date().toISOString();
          return nextProject;
        });
        break;
      case "subtitle-edit-apply-preset":
        await patchActiveProject(runtime, function (nextProject) {
          const presetId = asNonEmptyString(actionPayload.presetId) || getDefaultSubtitleEditPresetId(runtime);
          const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
          subtitleState.edit.presetId = presetId;
          subtitleState.edit.recipe = getDefaultSubtitleEditRecipe(runtime, presetId);
          subtitleState.edit.preview = {
            status: "idle",
            entryId: null,
            outputText: "",
            warnings: [],
            summary: null,
          };
          subtitleState.edit.lastError = null;
          subtitleState.edit.lastActionAt = new Date().toISOString();
          nextProject.subtitleAnalysis = subtitleState;
          markFeatureProcessStale(nextProject, SUBTITLE_FEATURE_ID, "Subtitle preset changed.");
          markFeatureReportStale(nextProject, SUBTITLE_FEATURE_ID, "Subtitle preset changed.");
          return nextProject;
        });
        break;
      case "subtitle-edit-update-recipe":
        await patchActiveProject(runtime, function (nextProject) {
          applySubtitleEditPatch(runtime, nextProject, actionPayload.patch || actionPayload.fields);
          return nextProject;
        });
        break;
      case "subtitle-edit-preview":
        if (Object.keys(toRecord(actionPayload.patch)).length > 0) {
          await patchActiveProject(runtime, function (nextProject) {
            applySubtitleEditPatch(runtime, nextProject, actionPayload.patch);
            return nextProject;
          });
        }
        await previewSubtitleEdit(runtime, requestId);
        break;
      case "subtitle-edit-apply":
        if (Object.keys(toRecord(actionPayload.patch)).length > 0) {
          await patchActiveProject(runtime, function (nextProject) {
            applySubtitleEditPatch(runtime, nextProject, actionPayload.patch);
            return nextProject;
          });
        }
        await applySubtitleEdit(runtime, requestId);
        break;
      case "edit-apply-preset":
        await patchActiveProject(runtime, function (nextProject) {
          const presetId = asNonEmptyString(actionPayload.presetId);
          const preset = findEditPreset(runtime, nextProject, presetId);
          if (!presetId || !preset) {
            throw new Error("Requested edit preset is unavailable for the current source.");
          }

          const currentMode = asNonEmptyString(toRecord(nextProject.edit).mode) || "beginner";
          const preservedCommon = {
            outputNameHint: asNonEmptyString(toRecord(toRecord(nextProject.edit.recipe).common).outputNameHint) || "",
            notes: asNonEmptyString(toRecord(toRecord(nextProject.edit.recipe).common).notes) || "",
          };

          nextProject.edit = createDefaultEditState(runtime.editPresets, nextProject.source.kind);
          nextProject.edit.mode = currentMode;
          nextProject.edit.recipe.common.outputNameHint = preservedCommon.outputNameHint;
          nextProject.edit.recipe.common.notes = preservedCommon.notes;
          applyEditRecipePatch(runtime, nextProject, toRecord(preset).patch, {
            presetId: presetId,
          });
          return nextProject;
        });
        break;
      case "edit-update-recipe":
        await patchActiveProject(runtime, function (nextProject) {
          applyEditRecipePatch(
            runtime,
            nextProject,
            toRecord(actionPayload.patch || actionPayload.fields),
            {}
          );
          return nextProject;
        });
        break;
      case "edit-set-output":
        await patchActiveProject(runtime, function (nextProject) {
          const outputId = asNonEmptyString(actionPayload.outputId);
          const outputs = Array.isArray(nextProject.edit.outputs) ? nextProject.edit.outputs : [];
          const hasOutput = outputs.some(function (entry) {
            return asNonEmptyString(toRecord(entry).id) === outputId;
          });

          nextProject.edit.activeOutputId = hasOutput ? outputId : null;
          if (hasOutput !== true) {
            nextProject.edit.handoffMode = "source";
          }
          nextProject.edit.lastError = null;
          nextProject.edit.lastActionAt = new Date().toISOString();
          markProfileAsStale(
            nextProject,
            "Derived output selection changed; rerun the profile preflight.",
            { clearTargetOutput: hasOutput !== true }
          );
          markCloseoutAsStale(nextProject, "Derived output selection changed.", [AUDIO_FEATURE_ID]);
          return nextProject;
        });
        break;
      case "edit-set-handoff":
        await patchActiveProject(runtime, function (nextProject) {
          const requestedMode = asNonEmptyString(actionPayload.mode) === "derived" ? "derived" : "source";
          if (
            requestedMode === "derived" &&
            asNonEmptyString(nextProject.edit.activeOutputId) === null
          ) {
            throw new Error("Generate and select a derived output before enabling derived handoff.");
          }

          nextProject.edit.handoffMode = requestedMode;
          nextProject.edit.lastError = null;
          nextProject.edit.lastActionAt = new Date().toISOString();
          markCloseoutAsStale(nextProject, "Downstream handoff changed.");
          return nextProject;
        });
        break;
      case "edit-preview":
        if (Object.keys(toRecord(actionPayload.patch)).length > 0) {
          await patchActiveProject(runtime, function (nextProject) {
            applyEditRecipePatch(runtime, nextProject, toRecord(actionPayload.patch), {});
            return nextProject;
          });
        }
        await runEditPipeline(api, runtime, requestId, "preview");
        break;
      case "edit-apply":
        if (Object.keys(toRecord(actionPayload.patch)).length > 0) {
          await patchActiveProject(runtime, function (nextProject) {
            applyEditRecipePatch(runtime, nextProject, toRecord(actionPayload.patch), {});
            return nextProject;
          });
        }
        await runEditPipeline(api, runtime, requestId, "apply");
        break;
      case "edit-cancel-preview":
        if (getActiveProject(runtime) === null) {
          throw new Error("Active project is missing.");
        }
        await cancelEditJobsForProject(api, runtime, getActiveProject(runtime).id, requestId, "edit-preview");
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.edit.lastError = null;
          nextProject.edit.lastActionAt = new Date().toISOString();
          nextProject.edit.preview = {
            ...toRecord(nextProject.edit.preview),
            status:
              asNonEmptyString(toRecord(nextProject.edit.preview).path) !== null ? "stale" : "idle",
            jobId: null,
            requestId: null,
          };
          return nextProject;
        });
        break;
      case "edit-cancel-apply":
        if (getActiveProject(runtime) === null) {
          throw new Error("Active project is missing.");
        }
        await cancelEditJobsForProject(api, runtime, getActiveProject(runtime).id, requestId, "edit-apply");
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.edit.lastError = null;
          nextProject.edit.lastActionAt = new Date().toISOString();
          return nextProject;
        });
        break;
      case "profile-set-mode":
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.profile.mode =
            asNonEmptyString(actionPayload.mode) === "advanced" ? "advanced" : "beginner";
          nextProject.profile.lastError = null;
          nextProject.profile.lastActionAt = new Date().toISOString();
          return nextProject;
        });
        break;
      case "profile-apply-preset":
        await patchActiveProject(runtime, function (nextProject) {
          const presetId = asNonEmptyString(actionPayload.presetId);
          const preset = findProfilePreset(runtime.profilePresets, nextProject.source.kind, presetId);
          if (!presetId || !preset) {
            throw new Error("Requested profile preset is unavailable for the current source.");
          }

          const nextProfile = applyProfilePresetPatch(
            runtime.profilePresets,
            runtime.profileModels,
            runtime.profileCapabilities,
            nextProject.source.kind,
            toRecord(nextProject.profile),
            presetId
          );
          nextProject.profile = {
            ...toRecord(nextProject.profile),
            ...nextProfile,
            targetOutputId:
              asNonEmptyString(nextProfile.targetAssetMode) === "derived"
                ? asNonEmptyString(actionPayload.outputId) ||
                  asNonEmptyString(nextProfile.targetOutputId) ||
                  asNonEmptyString(nextProject.edit.activeOutputId)
                : null,
            dirty: true,
            lastError: null,
            lastActionAt: new Date().toISOString(),
          };
          markProfileAsStale(nextProject, "Profile preset changed; rerun the preflight.");
          return nextProject;
        });
        break;
      case "profile-update":
        await patchActiveProject(runtime, function (nextProject) {
          const patch = toRecord(actionPayload.patch || actionPayload.fields);
          nextProject.profile = {
            ...toRecord(nextProject.profile),
            ...patch,
            artifactPreferences: normalizeProfileArtifactPreferences(
              {
                ...toRecord(toRecord(nextProject.profile).artifactPreferences),
                ...toRecord(patch.artifactPreferences),
              },
              runtime.profileCapabilities,
              asNonEmptyString(nextProject.source.kind) || "video"
            ),
            laneSelection: {
              ...toRecord(toRecord(nextProject.profile).laneSelection),
              ...toRecord(patch.laneSelection),
            },
            sensitivity: clampNumber(
              patch.sensitivity,
              0.1,
              1,
              clampNumber(toRecord(nextProject.profile).sensitivity, 0.1, 1, 0.58)
            ),
            depth:
              ["quick", "balanced", "deep"].includes(asNonEmptyString(patch.depth))
                ? asNonEmptyString(patch.depth)
                : asNonEmptyString(toRecord(nextProject.profile).depth) || "balanced",
            frameSampleDensity:
              ["sparse", "balanced", "dense"].includes(asNonEmptyString(patch.frameSampleDensity))
                ? asNonEmptyString(patch.frameSampleDensity)
                : asNonEmptyString(toRecord(nextProject.profile).frameSampleDensity) || "balanced",
            transcriptSampleSeconds: clampProfileTranscriptSampleSeconds(
              runtime.profileCapabilities,
              Object.prototype.hasOwnProperty.call(patch, "transcriptSampleSeconds")
                ? patch.transcriptSampleSeconds
                : toRecord(nextProject.profile).transcriptSampleSeconds
            ),
            lastError: null,
            lastActionAt: new Date().toISOString(),
          };
          markProfileAsStale(nextProject, "Profile controls changed; rerun the preflight.");
          return nextProject;
        });
        break;
      case "profile-set-target":
        await patchActiveProject(runtime, function (nextProject) {
          const requestedMode = asNonEmptyString(actionPayload.mode) === "derived" ? "derived" : "source";
          const requestedOutputId =
            requestedMode === "derived"
              ? asNonEmptyString(actionPayload.outputId) || asNonEmptyString(nextProject.edit.activeOutputId)
              : null;
          nextProject.profile.targetAssetMode = requestedMode;
          nextProject.profile.targetOutputId = requestedOutputId;
          nextProject.profile.lastError = null;
          nextProject.profile.lastActionAt = new Date().toISOString();
          markProfileAsStale(
            nextProject,
            requestedMode === "derived"
              ? "Target asset moved to a derived output; rerun the preflight."
              : "Target asset moved back to the source; rerun the preflight."
          );
          return nextProject;
        });
        break;
      case "profile-set-model":
        await patchActiveProject(runtime, function (nextProject) {
          const requestedModelId = asNonEmptyString(actionPayload.modelId);
          if (
            requestedModelId !== null &&
            toRecord(getProfileModelDescriptorMap(runtime)[requestedModelId]).fileName === undefined
          ) {
            throw new Error("Requested speech model is unavailable.");
          }
          nextProject.profile.modelId = requestedModelId;
          nextProject.profile.lastError = null;
          nextProject.profile.lastActionAt = new Date().toISOString();
          markProfileAsStale(nextProject, "Speech model selection changed; rerun the preflight.");
          return nextProject;
        });
        break;
      case "profile-run-preflight":
        await runProfilePreflight(api, runtime, requestId);
        break;
      case "profile-cancel-preflight":
        if (getActiveProject(runtime) === null) {
          throw new Error("Active project is missing.");
        }
        await cancelProfileJobsForProject(
          api,
          runtime,
          getActiveProject(runtime).id,
          requestId,
          "profile-run-preflight"
        );
        await patchActiveProject(runtime, function (nextProject) {
          nextProject.profile.lastError = null;
          nextProject.profile.lastActionAt = new Date().toISOString();
          nextProject.profile.preflight = {
            ...createEmptyProfilePreflight(),
            ...toRecord(nextProject.profile.preflight),
            status:
              asNonEmptyString(toRecord(nextProject.profile.preflight).ranAt) !== null
                ? "stale"
                : "idle",
            jobId: null,
            requestId: null,
            error: null,
          };
          return nextProject;
        });
        break;
      case "profile-model-install":
        await installProfileModel(api, runtime, requestId, asNonEmptyString(actionPayload.modelId));
        break;
      case "profile-model-remove":
        await removeProfileModel(runtime, requestId, asNonEmptyString(actionPayload.modelId));
        break;
      case "process-run":
      case "audio-process-run":
        await runFeatureProcess(api, runtime, requestId, featureId);
        break;
      case "process-cancel":
      case "audio-process-cancel":
        await cancelFeatureProcess(api, runtime, requestId, featureId);
        break;
      case "report-export":
      case "audio-report-export":
        await exportFeatureReport(api, runtime, requestId, featureId);
        break;
      case "tool-install":
        await handleToolMutation(
          api,
          runtime,
          requestId,
          action,
          asNonEmptyString(actionPayload.toolId),
          featureStage || "source"
        );
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "tool-update":
        await handleToolMutation(
          api,
          runtime,
          requestId,
          action,
          asNonEmptyString(actionPayload.toolId),
          featureStage || "source"
        );
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      default:
        throw new Error(`Unsupported media action: ${action}`);
    }

    await persistToolState(runtime);
    await persistProfileModelState(runtime);
    pushMediaState(api, runtime, requestId, action);
    pushActionResult(api, {
      requestId: requestId,
      success: true,
      action: action,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.log("warn", `Laboratory media action failed: ${action} -> ${message}`);
    pushMediaState(api, runtime, requestId, action);
    pushActionResult(api, {
      requestId: requestId,
      success: false,
      action: action,
      error: message,
    });
  }
}

module.exports = {
  activate: function activate(api) {
    const runtime = createRuntimeState();
    api.log("info", "Laboratory media analysis host activated.");
    saveContext(api, {});
    ensureRoomToolsSubscription(api, runtime);

    return {
      onRoomReady: function onRoomReady(payload) {
        saveContext(api, payload);
        void ensureHydrated(api, runtime)
          .then(function () {
            pushMediaState(api, runtime, null);
          })
          .catch(function (error) {
            api.log(
              "warn",
              `Laboratory media host bootstrap failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          });
      },
      onRoomEvent: function onRoomEvent(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return;
        }

        if (payload.type === "host-context") {
          saveContext(api, payload);
          return;
        }

        if (payload.type === "source-action" || payload.type === "media-action") {
          void handleMediaAction(api, runtime, toRecord(payload.payload));
        }
      },
      dispose: function dispose() {
        tearDownRoomToolsSubscription(runtime);
        api.log("info", "Laboratory media analysis host disposed.");
      },
    };
  },
};
