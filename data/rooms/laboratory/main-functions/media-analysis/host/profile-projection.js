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
  function toProjectProfileRecord(value) {
    return toRecord(value);
  }
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toProfileLaneRecord(value) {
    return toRecord(value);
  }
  function toProfileToolSummaryRecord(value) {
    return toRecord(value);
  }
  function toProfileModelSummaryRecord(value) {
    return toRecord(value);
  }
  function toProfilePreflightRecord(value) {
    return toRecord(value);
  }
  function toProfileTargetSummaryRecord(value) {
    return toRecord(value);
  }
  function toNormalizedEditOutputRecord(value) {
    return toRecord(value);
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return asNonEmptyString(entry);
    }).filter((entry) => entry !== null);
  }
  function getProjectName(project) {
    return asNonEmptyString(project.name) || "--";
  }
  function getSourceKind(project) {
    return asNonEmptyString(toProjectSourceRecord(project.source).kind) || "video";
  }
  function getProfile(project) {
    return toProjectProfileRecord(project.profile);
  }
  function getSource(project) {
    return toProjectSourceRecord(project.source);
  }
  function resolveProfileTarget(project) {
    const profile = getProfile(project);
    const source = getSource(project);
    const requestedMode = asNonEmptyString(profile.targetAssetMode) === "derived" ? "derived" : "source";
    const sourcePath = asNonEmptyString(source.storedPath);
    const sourceFileName = asNonEmptyString(source.storedFileName);
    const sourceMetadata = normalizeSourceMetadata(source.metadata);
    const sourceTarget = {
      fileName: sourceFileName,
      label: sourceFileName || getProjectName(project),
      metadata: sourceMetadata,
      mimeType: asNonEmptyString(source.mimeType),
      mode: "source",
      outputId: null,
      path: sourcePath,
      reason: null,
      requestedMode,
      signature: sourcePath !== null ? buildSourceTargetSignature(project) : null,
      usingFallback: false
    };
    if (requestedMode !== "derived") {
      return sourceTarget;
    }
    const outputId = asNonEmptyString(profile.targetOutputId);
    const pinnedOutput = findEditOutputById(project, outputId);
    const pinnedOutputRecord = toNormalizedEditOutputRecord(pinnedOutput);
    if (pinnedOutput !== null && asNonEmptyString(pinnedOutputRecord.path) !== null) {
      const output = toNormalizedEditOutputRecord(normalizeEditOutput(pinnedOutput));
      return {
        fileName: asNonEmptyString(output.fileName),
        label: asNonEmptyString(output.label) || asNonEmptyString(output.fileName) || asNonEmptyString(output.id) || "--",
        metadata: normalizeSourceMetadata(output.metadata),
        mimeType: asNonEmptyString(output.mimeType),
        mode: "derived",
        outputId: asNonEmptyString(output.id),
        path: asNonEmptyString(output.path),
        reason: null,
        requestedMode,
        signature: buildDerivedTargetSignature(output),
        usingFallback: false
      };
    }
    return {
      ...sourceTarget,
      outputId,
      reason: outputId === null ? "Choose a derived output to keep the profile target pinned." : "Pinned derived output is unavailable. Falling back to the saved source.",
      requestedMode,
      usingFallback: true
    };
  }
  function buildProfileReadiness(runtime, project) {
    const sourceKind = getSourceKind(project);
    const profile = getProfile(project);
    const enabledLaneIds = getCompatibleProfileLaneIds(runtime.profilePresets, sourceKind).filter(
      function(laneId) {
        return toRecord(profile.laneSelection)[laneId] === true;
      }
    );
    const target = resolveProfileTarget(project);
    const laneMap = getProfileLaneMap(runtime.profilePresets);
    const requiredToolIds = [];
    const optionalToolIds = [];
    const blockers = [];
    const warnings = [];
    const requiredToolMap = {};
    const optionalToolMap = {};
    const modelSummaries = buildProfileModelSummary(runtime, project).map(
      toProfileModelSummaryRecord
    );
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
      const lane = toProfileLaneRecord(laneMap[laneId]);
      const laneRequired = toStringArray(lane.requiredTools);
      const laneOptional = toStringArray(lane.optionalTools);
      const laneWarnings = [];
      laneRequired.forEach(function(toolId) {
        if (!requiredToolIds.includes(toolId)) {
          requiredToolIds.push(toolId);
        }
        if (!requiredToolMap[toolId]) {
          requiredToolMap[toolId] = toProfileToolSummaryRecord(
            buildProfileToolSummary(
              runtime,
              toolId,
              getStageSupport(getToolManifest(runtime, toolId), "profile")
            )
          );
        }
      });
      laneOptional.forEach(function(toolId) {
        if (!optionalToolIds.includes(toolId)) {
          optionalToolIds.push(toolId);
        }
        if (!optionalToolMap[toolId]) {
          optionalToolMap[toolId] = toProfileToolSummaryRecord(
            buildProfileToolSummary(
              runtime,
              toolId,
              getStageSupport(getToolManifest(runtime, toolId), "profile")
            )
          );
        }
      });
      const missingRequired = laneRequired.filter(function(toolId) {
        const requiredSummary = requiredToolMap[toolId];
        return requiredSummary ? requiredSummary.ready !== true : true;
      });
      if (missingRequired.length > 0) {
        blockers.push(
          `${asNonEmptyString(lane.labelKey) || laneId} requires ${missingRequired.map(function(toolId) {
            const requiredSummary = requiredToolMap[toolId];
            return asNonEmptyString(requiredSummary?.displayName) || toolId;
          }).join(", ")}.`
        );
      }
      if (laneOptional.includes("whisper.cpp")) {
        const whisperSummary = optionalToolMap["whisper.cpp"] || null;
        if (!whisperSummary || whisperSummary.ready !== true) {
          laneWarnings.push(
            "Speech transcript sampling is unavailable until Whisper.cpp is ready."
          );
        } else if (selectedModel && selectedModel.runtimeCompatible === false && asNonEmptyString(selectedModel.compatibilityReason)) {
          laneWarnings.push(asNonEmptyString(selectedModel.compatibilityReason) || "");
        } else if (selectedModel === null || selectedModel.ready !== true) {
          laneWarnings.push("Install and verify a Whisper model to unlock transcript sampling.");
        }
      }
      warnings.push(...laneWarnings);
      return {
        artifactKinds: toStringArray(lane.artifactKinds),
        labelKey: asNonEmptyString(lane.labelKey),
        laneId,
        optionalTools: laneOptional,
        requiredTools: laneRequired,
        summaryKey: asNonEmptyString(lane.summaryKey),
        supportLevel: missingRequired.length > 0 ? "blocked" : laneWarnings.length > 0 ? "degraded" : "ready",
        warnings: laneWarnings
      };
    });
    return {
      blockers: Array.from(new Set(blockers)),
      enabledLaneCount: enabledLaneIds.length,
      enabledLaneIds,
      lanes: laneSummaries,
      models: modelSummaries,
      optionalTools: optionalToolIds.map(function(toolId) {
        return optionalToolMap[toolId];
      }).filter((entry) => entry !== void 0),
      requiredTools: requiredToolIds.map(function(toolId) {
        return requiredToolMap[toolId];
      }).filter((entry) => entry !== void 0),
      stageReady: blockers.length === 0,
      target: {
        ...target,
        metadata: toRecord(clone(target.metadata))
      },
      warnings: Array.from(new Set(warnings))
    };
  }
  function buildProfileEstimate(runtime, project, readiness) {
    const profile = getProfile(project);
    const sourceKind = getSourceKind(project);
    const depthConfig = getProfileDepthConfig(runtime, profile.depth);
    const frameDensityConfig = getProfileFrameDensityRuntimeConfig(
      runtime,
      profile.frameSampleDensity
    );
    const enabledLaneIds = readiness.enabledLaneIds.length > 0 ? readiness.enabledLaneIds : getEnabledProfileLaneIds(runtime, project);
    const laneMap = getProfileLaneMap(runtime.profilePresets);
    const artifactBudget = Math.max(1, Math.round(asNumber(depthConfig["artifactBudget"]) || 3));
    const targetMetadata = normalizeSourceMetadata(readiness.target.metadata);
    const durationSeconds = asNumber(targetMetadata["durationSeconds"]);
    const sampleWindowSeconds = Math.min(
      durationSeconds || Number.MAX_SAFE_INTEGER,
      Math.max(12, Math.round(asNumber(depthConfig["sampleWindowSeconds"]) || 60))
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
      const lane = toProfileLaneRecord(laneMap[laneId]);
      toStringArray(lane.artifactKinds).forEach(function(artifactKind) {
        if (artifactPreferences[artifactKind] !== true) {
          return;
        }
        if (!artifactKinds.includes(artifactKind)) {
          artifactKinds.push(artifactKind);
        }
      });
    });
    let runtimeSeconds = (sourceKind === "video" ? 18 : sourceKind === "audio" ? 14 : 10) + enabledLaneIds.length * 8 + (asNonEmptyString(profile.depth) === "deep" ? 28 : asNonEmptyString(profile.depth) === "quick" ? 8 : 16);
    runtimeSeconds += Math.max(0, Math.round(asNumber(frameDensityConfig["tileCount"]) || 4) - 2) * 2;
    if (enabledLaneIds.includes("speech-overlay")) {
      const selectedModel = readiness.models.find(function(entry) {
        return entry.selected === true;
      }) || null;
      runtimeSeconds += artifactPreferences["transcript"] === true ? selectedModel && selectedModel.ready === true ? Math.max(8, Math.round(transcriptSampleSeconds / 3)) : 5 : 0;
    }
    return {
      artifactCount: Math.min(artifactBudget, artifactKinds.length),
      runtimeSeconds,
      sampleWindowSeconds: Number.isFinite(sampleWindowSeconds) ? sampleWindowSeconds : null
    };
  }
  function syncProjectProfileProjection(runtime, project) {
    const sourceKind = getSourceKind(project);
    const defaults = toProjectProfileRecord(
      createDefaultProfileState(
        runtime.profilePresets,
        runtime.profileModels,
        runtime.profileCapabilities,
        sourceKind
      )
    );
    const profile = toProjectProfileRecord(
      normalizeProfileState(
        project.profile,
        runtime.profilePresets,
        runtime.profileModels,
        runtime.profileCapabilities,
        sourceKind
      )
    );
    const compatibleLaneIds = getCompatibleProfileLaneIds(runtime.profilePresets, sourceKind);
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
    const requestedModelDescriptor = requestedModelId !== null ? toRecord(getProfileModelDescriptorMap(runtime)[requestedModelId]) : {};
    const requestedModelKinds = toStringArray(requestedModelDescriptor["mediaKinds"]);
    const fallbackModelId = getDefaultProfileModelId(runtime.profileModels, sourceKind);
    const resolvedProfile = {
      ...profile,
      activePresetId: findProfilePreset(runtime.profilePresets, sourceKind, profile.activePresetId) !== null ? profile.activePresetId : defaults.activePresetId,
      laneSelection,
      modelId: requestedModelId && (requestedModelKinds.length === 0 || requestedModelKinds.includes(sourceKind)) ? requestedModelId : fallbackModelId,
      targetAssetMode: requestedTargetMode,
      targetOutputId: requestedTargetMode === "derived" ? asNonEmptyString(profile.targetOutputId) : null
    };
    const target = resolveProfileTarget({
      ...project,
      profile: resolvedProfile
    });
    const existingPreflight = toProfilePreflightRecord({
      ...createEmptyProfilePreflight(),
      ...toRecord(resolvedProfile.preflight)
    });
    const previousTargetSummary = toProfileTargetSummaryRecord(existingPreflight.targetSummary);
    const previousSignature = asNonEmptyString(previousTargetSummary.signature);
    const nextSignature = asNonEmptyString(target.signature);
    const signatureChanged = previousSignature !== nextSignature;
    if (existingPreflight.status !== "running") {
      existingPreflight.targetSummary = nextSignature === null ? null : {
        fileName: target.fileName,
        label: target.label,
        mimeType: target.mimeType,
        mode: target.mode,
        outputId: target.outputId,
        path: target.path,
        requestedMode: target.requestedMode,
        signature: nextSignature
      };
      if (signatureChanged === true || target.usingFallback === true && asNonEmptyString(existingPreflight.ranAt) !== null) {
        existingPreflight.status = asNonEmptyString(existingPreflight.ranAt) !== null ? "stale" : "idle";
        existingPreflight.jobId = null;
        existingPreflight.requestId = null;
        existingPreflight.error = null;
        existingPreflight.warnings = Array.from(
          new Set(
            toStringArray(existingPreflight.warnings).concat(target.reason ? [target.reason] : [])
          )
        );
      }
    }
    resolvedProfile["targetAssetSignature"] = nextSignature;
    resolvedProfile.preflight = existingPreflight;
    resolvedProfile["readiness"] = buildProfileReadiness(runtime, {
      ...project,
      profile: resolvedProfile
    });
    resolvedProfile["estimate"] = buildProfileEstimate(
      runtime,
      {
        ...project,
        profile: resolvedProfile
      },
      resolvedProfile["readiness"]
    );
    resolvedProfile.dirty = resolvedProfile.dirty === true || signatureChanged === true || target.usingFallback === true || asNonEmptyString(toProfilePreflightRecord(resolvedProfile["preflight"]).status) !== "ready";
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
