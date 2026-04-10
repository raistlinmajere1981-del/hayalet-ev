export function createMediaProfileModelRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    callRoomTools,
    clearJob,
    createDefaultProfileModelEntry,
    digestSha1,
    ensureRuntimeDirectory,
    getActiveProject,
    getProfileModelDescriptor,
    getProfileModelDescriptorMap,
    getProfileModelsDir,
    getStageSupport,
    getToolManifest,
    listDirectory,
    persistProfileModelState,
    pushJobState,
    readBinaryFileBytes,
    refreshProfileModelState,
    registerJob,
    roomId,
    toRecord,
    updateProfileModelBusy,
    updateProfileModelEntry
  } = deps;
  function toProjectProfileRecord(value) {
    return toRecord(value);
  }
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
  function toDirectoryEntryRecord(value) {
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
  function getProjectId(project) {
    return project ? asNonEmptyString(project.id) : null;
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
    const profile = toProjectProfileRecord(project.profile);
    const sourceKind = asNonEmptyString(source.kind) || "video";
    const selectedModelId = asNonEmptyString(profile.modelId);
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
    const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
    const storedModel = toProfileModelEntryRecord(getProfileModelStateMap(runtime)[modelId]);
    const fileName = asNonEmptyString(descriptor.fileName);
    const filePath = asNonEmptyString(storedModel.path) || (fileName ? `${getProfileModelsDir(runtime)}/${fileName}` : null);
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
    const checksumValid = (expectedSha1 === null || expectedSha1 === checksumSha1) && (expectedBytes === null || expectedBytes === sizeBytes);
    const nextEntry = updateProfileModelEntry(runtime, modelId, {
      checksumSha1,
      checksumValid,
      expectedBytes,
      expectedSha1,
      fileName,
      installed: true,
      lastError: checksumValid ? null : "Downloaded model failed checksum verification.",
      lastVerifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      path: filePath,
      sizeBytes
    });
    await persistProfileModelState(runtime);
    if (checksumValid !== true) {
      throw new Error("Downloaded model failed checksum verification.");
    }
    return nextEntry;
  }
  async function installProfileModel(api, runtime, requestId, modelId) {
    const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
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
      throw new Error(
        compatibility.compatibilityReason || "This model is not compatible with the current runtime."
      );
    }
    const project = getActiveProject(runtime);
    const projectId = getProjectId(project);
    const jobId = `room-profile-model-${modelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const modelsDir = getProfileModelsDir(runtime);
    const targetPath = `${modelsDir}/${fileName}`;
    await ensureRuntimeDirectory(modelsDir, requestId);
    updateProfileModelBusy(runtime, modelId, true, null);
    await persistProfileModelState(runtime);
    registerJob(runtime, {
      action: "profile-model-install",
      featureStage: "profile",
      jobId,
      projectId,
      requestId,
      toolId: "whisper.cpp"
    });
    pushJobState(api, {
      action: "profile-model-install",
      featureStage: "profile",
      jobId,
      message: fileName,
      projectId,
      requestId,
      stage: "queued",
      toolId: "whisper.cpp"
    });
    try {
      await callRoomTools({
        destinationPath: targetPath,
        jobId,
        operation: "download-file",
        overwrite: true,
        requestId,
        roomId,
        url: downloadUrl
      });
      await refreshProfileModelState(runtime);
      const verifiedModel = await verifyProfileModel(runtime, modelId);
      updateProfileModelBusy(runtime, modelId, false, null);
      await persistProfileModelState(runtime);
      pushJobState(api, {
        action: "profile-model-install",
        featureStage: "profile",
        jobId,
        message: asNonEmptyString(verifiedModel.fileName) || modelId,
        percent: 100,
        projectId,
        requestId,
        stage: "completed",
        toolId: "whisper.cpp"
      });
      return verifiedModel;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateProfileModelBusy(runtime, modelId, false, message);
      await persistProfileModelState(runtime);
      try {
        await callRoomTools({
          operation: "delete-path",
          recursive: false,
          requestId,
          roomId,
          targetPath
        });
      } catch (_cleanupError) {
      }
      pushJobState(api, {
        action: "profile-model-install",
        featureStage: "profile",
        jobId,
        message,
        projectId,
        requestId,
        stage: "failed",
        toolId: "whisper.cpp"
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
      await refreshProfileModelState(runtime);
    }
  }
  async function removeProfileModel(runtime, requestId, modelId) {
    const modelState = toProfileModelEntryRecord(getProfileModelStateMap(runtime)[modelId]);
    const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
    const descriptorFileName = asNonEmptyString(descriptor.fileName);
    const targetPath = asNonEmptyString(modelState.path) || (descriptorFileName ? `${getProfileModelsDir(runtime)}/${descriptorFileName}` : null);
    if (targetPath !== null) {
      await callRoomTools({
        operation: "delete-path",
        recursive: false,
        requestId,
        roomId,
        targetPath
      });
    }
    updateProfileModelEntry(runtime, modelId, {
      checksumSha1: null,
      checksumValid: false,
      installed: false,
      lastError: null,
      lastVerifiedAt: null,
      path: targetPath,
      sizeBytes: null
    });
    await refreshProfileModelState(runtime);
    await persistProfileModelState(runtime);
  }
  async function refreshProfileModelStateWithStorage(runtime) {
    const modelDir = getProfileModelsDir(runtime);
    try {
      await ensureRuntimeDirectory(modelDir, null);
    } catch (_error) {
    }
    const directoryEntries = (await listDirectory(modelDir)).map(toDirectoryEntryRecord);
    const currentState = toProfileModelStateRecord(runtime.profileModelState);
    const storedModels = getProfileModelStateMap(runtime);
    const nextModels = {};
    Object.keys(getProfileModelDescriptorMap(runtime)).forEach(function(modelId) {
      const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
      const fileName = asNonEmptyString(descriptor.fileName);
      const current = toProfileModelEntryRecord(storedModels[modelId]);
      const fileEntry = fileName === null ? null : directoryEntries.find(function(entry) {
        return entry.isDirectory !== true && asNonEmptyString(entry.name) === fileName;
      }) || null;
      nextModels[modelId] = {
        ...createDefaultProfileModelEntry(modelId),
        ...current,
        busy: false,
        checksumSha1: fileEntry ? asNonEmptyString(current.checksumSha1) : null,
        checksumValid: fileEntry ? current.checksumValid === true : false,
        expectedBytes: asNumber(descriptor.expectedBytes),
        expectedSha1: asNonEmptyString(descriptor.expectedSha1),
        fileName,
        installed: Boolean(fileEntry),
        lastError: fileEntry ? asNonEmptyString(current.lastError) : null,
        lastVerifiedAt: fileEntry ? asNonEmptyString(current.lastVerifiedAt) : null,
        modelId,
        path: fileEntry ? asNonEmptyString(fileEntry.path) : fileName ? `${modelDir}/${fileName}` : null,
        sizeBytes: fileEntry ? asNumber(current.sizeBytes) : null
      };
    });
    runtime.profileModelState = {
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
