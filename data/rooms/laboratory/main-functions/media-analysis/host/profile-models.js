export function createMediaProfileModelRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    createDefaultProfileModelEntry,
    getProfileModelDescriptor,
    getProfileModelDescriptorMap,
    getStageSupport,
    getToolManifest,
    listSharedTranscriptModels,
    persistProfileModelState,
    readSharedTranscriptStatus,
    toRecord,
    updateProfileModelEntry
  } = deps;
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toToolRecord(value) {
    return toRecord(value);
  }
  function toToolDetailsRecord(value) {
    return toRecord(value);
  }
  function toProfileModelStateRecord(value) {
    return toRecord(value);
  }
  function toProfileModelEntryRecord(value) {
    return toRecord(value);
  }
  function toProfileModelDescriptorRecord(value) {
    return toRecord(value);
  }
  function toRuntimeCompatibilityRecord(value) {
    return toRecord(value);
  }
  function toSharedTranscriptModelStatusRecord(value) {
    return toRecord(value);
  }
  function getToolMap(runtime) {
    return toRecord(toRecord(runtime.toolState)["tools"]);
  }
  function getToolRecord(runtime, toolId) {
    return toToolRecord(getToolMap(runtime)[toolId]);
  }
  function getProfileModelStateMap(runtime) {
    return toRecord(toProfileModelStateRecord(runtime.profileModelState).models);
  }
  function getProfileModelDescriptorRecord(runtime, modelId) {
    return toProfileModelDescriptorRecord(getProfileModelDescriptor(runtime, modelId));
  }
  function getSharedTranscriptModelMap(entries) {
    if (!Array.isArray(entries)) {
      return {};
    }
    return entries.reduce(function(accumulator, entry) {
      const model = toSharedTranscriptModelStatusRecord(entry);
      const modelId = asNonEmptyString(model.modelId);
      if (modelId !== null) {
        accumulator[modelId] = model;
      }
      return accumulator;
    }, {});
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return asNonEmptyString(entry);
    }).filter((entry) => entry !== null);
  }
  function getCurrentRuntimePlatformKey(runtime) {
    const preferredToolIds = ["whisper.cpp", "ffmpeg", "yt-dlp"];
    for (let index = 0; index < preferredToolIds.length; index += 1) {
      const toolId = preferredToolIds[index];
      if (!toolId) {
        continue;
      }
      const details = toToolDetailsRecord(getToolRecord(runtime, toolId).details);
      const platformKey = asNonEmptyString(details.platformKey);
      if (platformKey !== null) {
        return platformKey;
      }
    }
    return null;
  }
  function evaluateProfileModelCompatibility(runtime, descriptor, whisperSummary) {
    const runtimeCompatibility = toRuntimeCompatibilityRecord(descriptor.runtimeCompatibility);
    const supportedPlatforms = toStringArray(runtimeCompatibility.platforms);
    const runtimePlatformKey = getCurrentRuntimePlatformKey(runtime);
    const requiresBinarySupport = runtimeCompatibility.requiresBinarySupport === true;
    let runtimeCompatible = true;
    let compatibilityReason = null;
    if (supportedPlatforms.length > 0) {
      if (runtimePlatformKey === null) {
        runtimeCompatible = false;
        compatibilityReason = "Runtime platform could not be resolved yet.";
      } else if (!supportedPlatforms.includes(runtimePlatformKey)) {
        runtimeCompatible = false;
        compatibilityReason = `This model is not declared for ${runtimePlatformKey}.`;
      }
    }
    if (runtimeCompatible && requiresBinarySupport && whisperSummary.platformSupported !== true) {
      runtimeCompatible = false;
      compatibilityReason = "Whisper.cpp is unavailable on this runtime platform.";
    }
    return {
      cleanupPolicy: toRecord(descriptor.cleanupPolicy),
      compatibilityReason,
      runtimeCompatible,
      runtimePlatformKey,
      supportedPlatforms
    };
  }
  function buildProfileToolSummary(runtime, toolId, supportLevel) {
    const tool = getToolRecord(runtime, toolId);
    const manifest = getToolManifest(runtime, toolId);
    const details = toToolDetailsRecord(tool.details);
    const displayName = asNonEmptyString(toRecord(manifest)["displayName"]) || toolId;
    const platformSupported = details.platformSupported !== false;
    const installed = tool.installed === true;
    return {
      binaryPath: asNonEmptyString(tool.binaryPath),
      busy: tool.busy === true,
      displayName,
      installed,
      lastError: asNonEmptyString(tool.lastError) || (platformSupported === false ? asNonEmptyString(details.supportError) : null),
      platformSupported,
      ready: supportLevel === "unsupported" ? false : platformSupported && installed,
      supportLevel: supportLevel || "unsupported",
      toolId,
      version: asNonEmptyString(tool.version)
    };
  }
  function buildProfileModelSummary(runtime, project) {
    const source = toProjectSourceRecord(project.source);
    const sourceKind = asNonEmptyString(source.kind) || "video";
    const selectedModelId = asNonEmptyString(
      toProfileModelStateRecord(runtime.profileModelState).activeModelId
    );
    const whisperManifest = getToolManifest(runtime, "whisper.cpp");
    const whisperSupport = getStageSupport(whisperManifest, "profile");
    const whisperSummary = buildProfileToolSummary(runtime, "whisper.cpp", whisperSupport);
    const storedModels = getProfileModelStateMap(runtime);
    return Object.keys(getProfileModelDescriptorMap(runtime)).filter(function(modelId) {
      const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
      const mediaKinds = toStringArray(descriptor.mediaKinds);
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    }).map(function(modelId) {
      const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
      const stored = toProfileModelEntryRecord(storedModels[modelId]);
      const expectedBytes = asNumber(descriptor.expectedBytes);
      const sizeBytes = asNumber(stored.sizeBytes);
      const checksumValid = stored.installed === true && stored.checksumValid === true;
      const compatibility = evaluateProfileModelCompatibility(
        runtime,
        descriptor,
        whisperSummary
      );
      return {
        binaryReady: whisperSummary.ready,
        binarySupported: whisperSummary.platformSupported,
        busy: stored.busy === true,
        checksumSha1: asNonEmptyString(stored.checksumSha1),
        checksumValid,
        cleanupPolicy: compatibility.cleanupPolicy,
        compatibilityReason: compatibility.compatibilityReason,
        expectedBytes,
        expectedSha1: asNonEmptyString(descriptor.expectedSha1),
        fileName: asNonEmptyString(descriptor.fileName),
        installed: stored.installed === true,
        labelKey: asNonEmptyString(descriptor.labelKey),
        language: asNonEmptyString(descriptor.language) || "en",
        lastError: asNonEmptyString(stored.lastError),
        lastVerifiedAt: asNonEmptyString(stored.lastVerifiedAt),
        modelId,
        path: asNonEmptyString(stored.path),
        quantization: asNonEmptyString(descriptor.quantization) || "f16",
        ready: whisperSummary.ready && checksumValid && compatibility.runtimeCompatible,
        runtimeCompatible: compatibility.runtimeCompatible,
        runtimePlatformKey: compatibility.runtimePlatformKey,
        selected: modelId === selectedModelId,
        sizeBytes,
        summaryKey: asNonEmptyString(descriptor.summaryKey),
        supportedPlatforms: compatibility.supportedPlatforms
      };
    });
  }
  async function verifyProfileModel(runtime, modelId) {
    const sharedModelMap = getSharedTranscriptModelMap(await listSharedTranscriptModels());
    const sharedModel = toSharedTranscriptModelStatusRecord(sharedModelMap[modelId]);
    const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
    const fileName = asNonEmptyString(sharedModel.fileName) || asNonEmptyString(descriptor.fileName);
    const filePath = asNonEmptyString(sharedModel.path);
    const checksumValid = sharedModel.checksumValid === true;
    const nextEntry = updateProfileModelEntry(runtime, modelId, {
      checksumSha1: null,
      checksumValid,
      expectedBytes: asNumber(sharedModel.expectedBytes) ?? asNumber(descriptor.expectedBytes),
      expectedSha1: asNonEmptyString(sharedModel.expectedSha1) ?? asNonEmptyString(descriptor.expectedSha1),
      fileName,
      installed: sharedModel.installed === true,
      lastError: asNonEmptyString(sharedModel.lastError) || (checksumValid ? null : "Downloaded model failed checksum verification."),
      lastVerifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      path: filePath,
      sizeBytes: asNumber(sharedModel.sizeBytes)
    });
    await persistProfileModelState(runtime);
    if (nextEntry.installed !== true) {
      throw new Error(`Profile model ${modelId} is not installed on the shared transcript runtime.`);
    }
    if (checksumValid !== true) {
      throw new Error("Downloaded model failed checksum verification.");
    }
    return nextEntry;
  }
  async function installProfileModel(api, runtime, requestId, modelId) {
    void api;
    void runtime;
    void requestId;
    void modelId;
    throw new Error("Transcript model installs moved to Settings > User > Speech Runtime.");
  }
  async function removeProfileModel(runtime, requestId, modelId) {
    void runtime;
    void requestId;
    void modelId;
    throw new Error("Transcript model removal moved to Settings > User > Speech Runtime.");
  }
  async function refreshProfileModelStateWithStorage(runtime) {
    const sharedStatusMap = getSharedTranscriptModelMap(await listSharedTranscriptModels());
    const sharedStatus = toRecord(await readSharedTranscriptStatus());
    const currentState = toProfileModelStateRecord(runtime.profileModelState);
    const storedModels = getProfileModelStateMap(runtime);
    const nextModels = {};
    Object.keys(getProfileModelDescriptorMap(runtime)).forEach(function(modelId) {
      const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
      const current = toProfileModelEntryRecord(storedModels[modelId]);
      const sharedModel = toSharedTranscriptModelStatusRecord(sharedStatusMap[modelId]);
      const fileName = asNonEmptyString(sharedModel.fileName) || asNonEmptyString(descriptor.fileName);
      const installed = sharedModel.installed === true;
      const lastError = asNonEmptyString(sharedModel.lastError);
      nextModels[modelId] = {
        ...createDefaultProfileModelEntry(modelId),
        ...current,
        busy: false,
        checksumSha1: installed ? asNonEmptyString(current.checksumSha1) : null,
        checksumValid: installed && sharedModel.checksumValid === true,
        expectedBytes: asNumber(sharedModel.expectedBytes) ?? asNumber(descriptor.expectedBytes),
        expectedSha1: asNonEmptyString(sharedModel.expectedSha1) ?? asNonEmptyString(descriptor.expectedSha1),
        fileName,
        installed,
        lastError: installed ? lastError : null,
        lastVerifiedAt: installed ? asNonEmptyString(current.lastVerifiedAt) : null,
        modelId,
        path: installed ? asNonEmptyString(sharedModel.path) : null,
        sizeBytes: installed ? asNumber(sharedModel.sizeBytes) : null
      };
    });
    runtime.profileModelState = {
      activeLanguage: asNonEmptyString(sharedStatus["activeLanguage"]),
      activeModelId: asNonEmptyString(sharedStatus["modelId"]),
      activeVariant: asNonEmptyString(sharedStatus["activeVariant"]),
      models: nextModels,
      schemaVersion: 1,
      updatedAt: currentState.updatedAt
    };
    await persistProfileModelState(runtime);
  }
  return {
    buildProfileModelSummary,
    buildProfileToolSummary,
    evaluateProfileModelCompatibility,
    getCurrentRuntimePlatformKey,
    installProfileModel,
    refreshProfileModelStateWithStorage,
    removeProfileModel,
    verifyProfileModel
  };
}
