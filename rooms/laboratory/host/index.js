const ROOM_ID = "laboratory";
const FEATURE_ID = "media-analysis";
const MEDIA_STAGES = ["source", "edit", "profile", "process", "report"];
const PROJECT_SCHEMA_VERSION = 1;

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
      typeof source.featureId === "string" && source.featureId.trim() !== ""
        ? source.featureId.trim()
        : FEATURE_ID,
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

async function ensureProjectDirectories(runtime, project, requestId) {
  const dirPaths = [
    getProjectDir(runtime, project),
    getProjectSourceDir(runtime, project),
    getProjectDerivedDir(runtime, project),
    getProjectEditDir(runtime, project),
    getProjectEditPreviewDir(runtime, project),
    getProjectEditOutputDir(runtime, project),
    getProjectProfileDir(runtime, project),
    getProjectProfilePreflightDir(runtime, project),
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
    ensureDirectoryMarker(getProjectSourceDir(runtime, project)),
    ensureDirectoryMarker(getProjectDerivedDir(runtime, project)),
    ensureDirectoryMarker(getProjectEditPreviewDir(runtime, project)),
    ensureDirectoryMarker(getProjectEditOutputDir(runtime, project)),
    ensureDirectoryMarker(getProjectProfilePreflightDir(runtime, project)),
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
    toolchainManifest: null,
    sourcePresets: null,
    projectSchema: null,
    ytDlpForm: null,
    editPresets: null,
    editCapabilities: null,
    profilePresets: null,
    profileCapabilities: null,
    profileModels: null,
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

function createProjectRecord(sourcePresets, editPresets, profilePresets, profileModels, profileCapabilities) {
  const now = new Date().toISOString();
  const kind = getDefaultSourceType(sourcePresets);
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
  };
}

function normalizeProject(rawValue, sourcePresets, editPresets, profilePresets, profileModels, profileCapabilities) {
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

function getProjectDerivedDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/derived`;
}

function getProjectEditDir(runtime, project) {
  return `${getProjectDerivedDir(runtime, project)}/edit`;
}

function getProjectEditPreviewDir(runtime, project) {
  return `${getProjectEditDir(runtime, project)}/preview`;
}

function getProjectEditOutputDir(runtime, project) {
  return `${getProjectEditDir(runtime, project)}/output`;
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
  };
}

function serializeProject(project) {
  if (project === null) {
    return null;
  }

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

function buildProjectedProjects(runtime) {
  return runtime.projects.map(function (project) {
    const nextProject = clone(project);
    syncProjectProfileProjection(runtime, nextProject);
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
      stageSupport: stageSupport,
    };
  });
}

function buildMediaSnapshot(runtime) {
  const projectedProjects = buildProjectedProjects(runtime);
  const activeProject =
    projectedProjects.find(function (project) {
      return project.id === runtime.activeProjectId;
    }) || null;

  return {
    roomId: ROOM_ID,
    featureId: FEATURE_ID,
    ready: runtime.hydrated,
    stages: MEDIA_STAGES.slice(),
    sourcePresets: clone(runtime.sourcePresets || {}),
    ytDlpForm: clone(runtime.ytDlpForm || {}),
    editPresets: clone(runtime.editPresets || {}),
    editCapabilities: clone(runtime.editCapabilities || {}),
    profilePresets: clone(runtime.profilePresets || {}),
    profileCapabilities: clone(runtime.profileCapabilities || {}),
    profileModels: clone(runtime.profileModels || {}),
    toolRegistry: buildToolRegistry(runtime),
    profileModelState: clone(runtime.profileModelState || {}),
    projects: projectedProjects.map(serializeProjectSummary),
    activeProjectId: runtime.activeProjectId,
    activeProject: serializeProject(activeProject),
    toolState: clone(runtime.toolState),
    jobs: serializeJobs(runtime),
  };
}

function buildSourceSnapshot(runtime) {
  return buildMediaSnapshot(runtime);
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
    actionId.startsWith("project-") ||
    actionId.startsWith("tool-")
  );
}

function pushMediaState(api, runtime, requestId, action) {
  const payload = {
    requestId: requestId || null,
    action: action || null,
    snapshot: buildMediaSnapshot(runtime),
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

  runtime.toolchainManifest = toolchainManifest || {};
  runtime.sourcePresets = sourcePresets || {};
  runtime.projectSchema = projectSchema || {};
  runtime.ytDlpForm = ytDlpForm || {};
  runtime.editPresets = editPresets || {};
  runtime.editCapabilities = editCapabilities || {};
  runtime.profilePresets = profilePresets || {};
  runtime.profileCapabilities = profileCapabilities || {};
  runtime.profileModels = profileModels || {};
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
        runtime.profileCapabilities
      );
      syncProjectProfileProjection(runtime, normalizedProject);
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

async function ensureProjectExists(runtime) {
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
    runtime.profileCapabilities
  );
  syncProjectProfileProjection(runtime, project);
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
    await ensureProjectExists(runtime);
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
    runtime.profileCapabilities
  );
  syncProjectProfileProjection(runtime, nextProject);
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

async function createProject(runtime) {
  const project = createProjectRecord(
    runtime.sourcePresets,
    runtime.editPresets,
    runtime.profilePresets,
    runtime.profileModels,
    runtime.profileCapabilities
  );
  syncProjectProfileProjection(runtime, project);
  await ensureProjectDirectories(runtime, project, null);
  await saveProject(runtime, project);
  runtime.projects.unshift(project);
  runtime.activeProjectId = project.id;
  return project;
}

async function deleteProject(runtime, projectId, requestId) {
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
  await ensureProjectExists(runtime);
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
}

function resetEditForCurrentSource(runtime, nextProject) {
  const previousMode = asNonEmptyString(toRecord(nextProject.edit).mode);
  nextProject.edit = createDefaultEditState(runtime.editPresets, nextProject.source.kind);
  if (previousMode === "advanced") {
    nextProject.edit.mode = "advanced";
  }
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
  syncProjectProfileProjection(runtime, projectedProject);
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
        await createProject(runtime);
        break;
      case "project-select":
        runtime.activeProjectId = asNonEmptyString(actionPayload.projectId);
        await ensureProjectExists(runtime);
        await refreshActiveProjectMetadata(runtime, requestId);
        break;
      case "project-delete":
        await deleteProject(runtime, asNonEmptyString(actionPayload.projectId), requestId);
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
      onRoomReady: function onRoomReady() {
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
