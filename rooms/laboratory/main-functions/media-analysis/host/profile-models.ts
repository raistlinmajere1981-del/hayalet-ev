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
    updateProfileModelEntry,
  } = deps;

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

    await ensureRuntimeDirectory(getProfileModelsDir(runtime), requestId);

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
        roomId: roomId,
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
          roomId: roomId,
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
        roomId: roomId,
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

  async function refreshProfileModelStateWithStorage(runtime) {
    const modelDir = getProfileModelsDir(runtime);
    try {
      await ensureRuntimeDirectory(modelDir, null);
    } catch (_error) {
      // noop; caller may handle fallback directory creation elsewhere
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

  return {
    buildProfileModelSummary,
    buildProfileToolSummary,
    evaluateProfileModelCompatibility,
    getCurrentRuntimePlatformKey,
    installProfileModel,
    refreshProfileModelStateWithStorage,
    removeProfileModel,
    verifyProfileModel,
  };
}
