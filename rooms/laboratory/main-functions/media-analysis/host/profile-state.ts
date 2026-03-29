// @ts-nocheck
export function createMediaProfileStateRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    clampNumber,
    createEmptyProfileEstimate,
    createEmptyProfilePreflight,
    createEmptyProfileReadiness,
    findProfilePreset,
    getCompatibleProfileLaneIds,
    getDefaultProfileModelId,
    getDefaultProfilePresetId,
    getProfileArtifactPreferenceMap,
    getProfileLaneMap,
    markCloseoutAsStale,
    mediaFeatureId,
    toRecord,
  } = deps;

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

  function applyProfilePresetPatch(
    profilePresets,
    profileModels,
    profileCapabilities,
    sourceKind,
    profileState,
    presetId
  ) {
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
    const defaultSensitivity = clampNumber(toRecord(profilePresets).defaultSensitivity, 0.1, 1, 0.58);
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
      frameSampleDensity: asNonEmptyString(toRecord(defaultSampling).defaultFrameDensity) || "balanced",
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
    const modelId = asNonEmptyString(source.modelId) || getDefaultProfileModelId(profileModels, sourceKind);

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
      signals: Array.isArray(source.signals) ? source.signals.map(normalizeProfileSignal) : [],
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
    markCloseoutAsStale(nextProject, reason, [mediaFeatureId]);
  }

  function getProfileDepthConfig(runtime, depthId) {
    const depthModes = toRecord(toRecord(runtime.profileCapabilities).depthModes);
    return toRecord(depthModes[asNonEmptyString(depthId) || "balanced"]);
  }

  function getProfileFrameDensityRuntimeConfig(runtime, densityId) {
    return getProfileFrameDensityConfig(runtime.profileCapabilities, densityId);
  }

  function getEnabledProfileLaneIds(runtime, project) {
    const sourceKind = asNonEmptyString(toRecord(project.source).kind) || "video";
    const compatibleLaneIds = getCompatibleProfileLaneIds(runtime.profilePresets, sourceKind);
    const laneSelection = toRecord(toRecord(project.profile).laneSelection);

    return compatibleLaneIds.filter(function (laneId) {
      return laneSelection[laneId] === true;
    });
  }

  return {
    applyProfilePresetPatch,
    clampProfileTranscriptSampleSeconds,
    createDefaultProfileState,
    getEnabledProfileLaneIds,
    getProfileDepthConfig,
    getProfileFrameDensityRuntimeConfig,
    normalizeProfileArtifact,
    normalizeProfileArtifactPreferences,
    normalizeProfileSignal,
    normalizeProfileState,
    markProfileAsStale,
    resetProfileForCurrentSource,
  };
}
