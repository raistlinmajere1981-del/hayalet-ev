export function createMediaProfileProjectionRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    buildDerivedTargetSignature,
    buildProfileModelSummary,
    buildProfileToolSummary,
    buildSourceTargetSignature,
    clampProfileTranscriptSampleSeconds,
    clone,
    createDefaultProfileState,
    createEmptyProfilePreflight,
    findEditOutputById,
    findProfilePreset,
    getCompatibleProfileLaneIds,
    getDefaultProfileModelId,
    getEnabledProfileLaneIds,
    getProfileDepthConfig,
    getProfileFrameDensityRuntimeConfig,
    getProfileLaneMap,
    getProfileModelDescriptorMap,
    getStageSupport,
    getToolManifest,
    normalizeEditOutput,
    normalizeProfileArtifactPreferences,
    normalizeProfileState,
    normalizeSourceMetadata,
    toRecord
  } = deps;
  function resolveProfileTarget(project) {
    const profile = toRecord(project.profile);
    const source = toRecord(project.source);
    const requestedMode = asNonEmptyString(profile.targetAssetMode) === "derived" ? "derived" : "source";
    const sourcePath = asNonEmptyString(source.storedPath);
    const sourceFileName = asNonEmptyString(source.storedFileName);
    const sourceMetadata = normalizeSourceMetadata(source.metadata);
    const sourceTarget = {
      requestedMode,
      mode: "source",
      outputId: null,
      path: sourcePath,
      fileName: sourceFileName,
      mimeType: asNonEmptyString(source.mimeType),
      metadata: sourceMetadata,
      signature: sourcePath !== null ? buildSourceTargetSignature(project) : null,
      label: sourceFileName || project.name,
      usingFallback: false,
      reason: null
    };
    if (requestedMode !== "derived") {
      return sourceTarget;
    }
    const outputId = asNonEmptyString(profile.targetOutputId);
    const pinnedOutput = findEditOutputById(project, outputId);
    if (pinnedOutput !== null && asNonEmptyString(toRecord(pinnedOutput).path) !== null) {
      const output = normalizeEditOutput(pinnedOutput);
      return {
        requestedMode,
        mode: "derived",
        outputId: output.id,
        path: output.path,
        fileName: output.fileName,
        mimeType: output.mimeType,
        metadata: normalizeSourceMetadata(output.metadata),
        signature: buildDerivedTargetSignature(output),
        label: output.label || output.fileName || output.id,
        usingFallback: false,
        reason: null
      };
    }
    return {
      ...sourceTarget,
      requestedMode,
      outputId,
      usingFallback: true,
      reason: outputId === null ? "Choose a derived output to keep the profile target pinned." : "Pinned derived output is unavailable. Falling back to the saved source."
    };
  }
  function buildProfileReadiness(runtime, project) {
    const sourceKind = asNonEmptyString(toRecord(project.source).kind) || "video";
    const profile = toRecord(project.profile);
    const enabledLaneIds = getCompatibleProfileLaneIds(runtime.profilePresets, sourceKind).filter(function(laneId) {
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
    const selectedModel = modelSummaries.find(function(entry) {
      return entry.selected === true;
    }) || null;
    if (target.path === null) {
      blockers.push("Prepare a source or derived output before building the profile.");
    }
    if (target.usingFallback === true && target.reason) {
      warnings.push(target.reason);
    }
    const laneSummaries = enabledLaneIds.map(function(laneId) {
      const lane = toRecord(laneMap[laneId]);
      const laneRequired = Array.isArray(lane.requiredTools) ? lane.requiredTools : [];
      const laneOptional = Array.isArray(lane.optionalTools) ? lane.optionalTools : [];
      const laneWarnings = [];
      laneRequired.forEach(function(toolId) {
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
      laneOptional.forEach(function(toolId) {
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
      const missingRequired = laneRequired.filter(function(toolId) {
        return toRecord(requiredToolMap[toolId]).ready !== true;
      });
      if (missingRequired.length > 0) {
        blockers.push(
          `${asNonEmptyString(lane.labelKey) || laneId} requires ${missingRequired.map(function(toolId) {
            return asNonEmptyString(toRecord(requiredToolMap[toolId]).displayName) || toolId;
          }).join(", ")}.`
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
        laneId,
        labelKey: asNonEmptyString(lane.labelKey),
        summaryKey: asNonEmptyString(lane.summaryKey),
        supportLevel: missingRequired.length > 0 ? "blocked" : laneWarnings.length > 0 ? "degraded" : "ready",
        requiredTools: laneRequired,
        optionalTools: laneOptional,
        artifactKinds: Array.isArray(lane.artifactKinds) ? lane.artifactKinds.slice() : [],
        warnings: laneWarnings
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
        metadata: clone(target.metadata || {})
      },
      enabledLaneIds,
      enabledLaneCount: enabledLaneIds.length,
      requiredTools: requiredToolIds.map(function(toolId) {
        return requiredToolMap[toolId];
      }),
      optionalTools: optionalToolIds.map(function(toolId) {
        return optionalToolMap[toolId];
      }),
      models: modelSummaries,
      lanes: laneSummaries,
      blockers: Array.from(new Set(blockers)),
      warnings: Array.from(new Set(warnings))
    };
  }
  function buildProfileEstimate(runtime, project, readiness) {
    const profile = toRecord(project.profile);
    const sourceKind = asNonEmptyString(toRecord(project.source).kind) || "video";
    const depthConfig = getProfileDepthConfig(runtime, profile.depth);
    const frameDensityConfig = getProfileFrameDensityRuntimeConfig(runtime, profile.frameSampleDensity);
    const enabledLaneIds = Array.isArray(toRecord(readiness).enabledLaneIds) ? readiness.enabledLaneIds : getEnabledProfileLaneIds(runtime, project);
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
    enabledLaneIds.forEach(function(laneId) {
      const lane = toRecord(laneMap[laneId]);
      (Array.isArray(lane.artifactKinds) ? lane.artifactKinds : []).forEach(function(artifactKind) {
        if (artifactPreferences[artifactKind] !== true) {
          return;
        }
        if (artifactKinds.includes(artifactKind) === false) {
          artifactKinds.push(artifactKind);
        }
      });
    });
    let runtimeSeconds = (sourceKind === "video" ? 18 : sourceKind === "audio" ? 14 : 10) + enabledLaneIds.length * 8 + (asNonEmptyString(profile.depth) === "deep" ? 28 : asNonEmptyString(profile.depth) === "quick" ? 8 : 16);
    runtimeSeconds += Math.max(0, Math.round(asNumber(frameDensityConfig.tileCount) || 4) - 2) * 2;
    if (enabledLaneIds.includes("speech-overlay")) {
      const selectedModel = (Array.isArray(toRecord(readiness).models) ? readiness.models : []).find(function(entry) {
        return toRecord(entry).selected === true;
      }) || null;
      runtimeSeconds += artifactPreferences.transcript === true ? selectedModel && selectedModel.ready === true ? Math.max(8, Math.round(transcriptSampleSeconds / 3)) : 5 : 0;
    }
    return {
      runtimeSeconds,
      artifactCount: Math.min(artifactBudget, artifactKinds.length),
      sampleWindowSeconds: Number.isFinite(sampleWindowSeconds) ? sampleWindowSeconds : null
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
    compatibleLaneIds.forEach(function(laneId) {
      laneSelection[laneId] = toRecord(profile.laneSelection)[laneId] === true;
    });
    if (compatibleLaneIds.length > 0 && compatibleLaneIds.every(function(laneId) {
      return laneSelection[laneId] !== true;
    })) {
      compatibleLaneIds.forEach(function(laneId) {
        laneSelection[laneId] = toRecord(defaults.laneSelection)[laneId] === true;
      });
    }
    const requestedTargetMode = asNonEmptyString(profile.targetAssetMode) === "derived" ? "derived" : "source";
    const requestedModelId = asNonEmptyString(profile.modelId);
    const requestedModelDescriptor = toRecord(getProfileModelDescriptorMap(runtime)[requestedModelId]);
    const requestedModelKinds = Array.isArray(requestedModelDescriptor.mediaKinds) ? requestedModelDescriptor.mediaKinds : [];
    const fallbackModelId = getDefaultProfileModelId(runtime.profileModels, project.source.kind);
    const resolvedProfile = {
      ...profile,
      activePresetId: findProfilePreset(runtime.profilePresets, project.source.kind, profile.activePresetId) !== null ? profile.activePresetId : defaults.activePresetId,
      targetAssetMode: requestedTargetMode,
      targetOutputId: requestedTargetMode === "derived" ? asNonEmptyString(profile.targetOutputId) : null,
      modelId: requestedModelId && (requestedModelKinds.length === 0 || requestedModelKinds.includes(project.source.kind)) ? requestedModelId : fallbackModelId,
      laneSelection
    };
    const target = resolveProfileTarget({
      ...project,
      profile: resolvedProfile
    });
    const existingPreflight = {
      ...createEmptyProfilePreflight(),
      ...toRecord(resolvedProfile.preflight)
    };
    const previousTargetSummary = toRecord(existingPreflight.targetSummary);
    const previousSignature = asNonEmptyString(previousTargetSummary.signature);
    const nextSignature = asNonEmptyString(target.signature);
    const signatureChanged = previousSignature !== nextSignature;
    if (existingPreflight.status !== "running") {
      existingPreflight.targetSummary = nextSignature === null ? null : {
        requestedMode: target.requestedMode,
        mode: target.mode,
        outputId: target.outputId,
        signature: nextSignature,
        label: target.label,
        fileName: target.fileName,
        mimeType: target.mimeType,
        path: target.path
      };
      if (signatureChanged === true || target.usingFallback === true && asNonEmptyString(existingPreflight.ranAt) !== null) {
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
      profile: resolvedProfile
    });
    resolvedProfile.estimate = buildProfileEstimate(
      runtime,
      {
        ...project,
        profile: resolvedProfile
      },
      resolvedProfile.readiness
    );
    resolvedProfile.dirty = resolvedProfile.dirty === true || signatureChanged === true || target.usingFallback === true || asNonEmptyString(toRecord(resolvedProfile.preflight).status) !== "ready";
    project.profile = resolvedProfile;
    return project;
  }
  return {
    buildProfileEstimate,
    buildProfileReadiness,
    resolveProfileTarget,
    syncProjectProfileProjection
  };
}
