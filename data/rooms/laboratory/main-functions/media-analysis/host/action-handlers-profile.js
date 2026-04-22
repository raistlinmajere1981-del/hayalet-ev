export function createMediaProfileActionRuntime(deps) {
  const {
    applyProfilePresetPatch,
    asNonEmptyString,
    cancelProfileJobsForProject,
    clampNumber,
    clampProfileTranscriptSampleSeconds,
    createEmptyProfilePreflight,
    findProfilePreset,
    getActiveProject,
    markProfileAsStale,
    normalizeProfileArtifactPreferences,
    patchActiveProject,
    runProfilePreflight,
    toRecord
  } = deps;
  async function setProfileMode(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      nextProject["profile"]["mode"] = asNonEmptyString(actionPayload["mode"]) === "advanced" ? "advanced" : "beginner";
      nextProject["profile"]["lastError"] = null;
      nextProject["profile"]["lastActionAt"] = (/* @__PURE__ */ new Date()).toISOString();
      return nextProject;
    });
  }
  async function applyProfilePreset(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const presetId = asNonEmptyString(actionPayload["presetId"]);
      const preset = findProfilePreset(
        runtime["profilePresets"],
        nextProject["source"]["kind"],
        presetId
      );
      const nextProfile = applyProfilePresetPatch(
        runtime["profilePresets"],
        runtime["profileModels"],
        runtime["profileCapabilities"],
        nextProject["source"]["kind"],
        toRecord(nextProject["profile"]),
        presetId
      );
      if (!presetId || !preset || !nextProfile) {
        throw new Error("Requested profile preset is unavailable for the current source.");
      }
      nextProject["profile"] = {
        ...toRecord(nextProject["profile"]),
        ...nextProfile,
        targetOutputId: asNonEmptyString(nextProfile["targetAssetMode"]) === "derived" ? asNonEmptyString(actionPayload["outputId"]) || asNonEmptyString(nextProfile["targetOutputId"]) || asNonEmptyString(nextProject["edit"]["activeOutputId"]) : null,
        dirty: true,
        lastError: null,
        lastActionAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      markProfileAsStale(nextProject, "Profile preset changed; rerun the preflight.");
      return nextProject;
    });
  }
  async function updateProfile(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const patch = toRecord(actionPayload["patch"] || actionPayload["fields"]);
      nextProject["profile"] = {
        ...toRecord(nextProject["profile"]),
        ...patch,
        artifactPreferences: normalizeProfileArtifactPreferences(
          {
            ...toRecord(toRecord(nextProject["profile"])["artifactPreferences"]),
            ...toRecord(patch["artifactPreferences"])
          },
          runtime["profileCapabilities"],
          asNonEmptyString(nextProject["source"]["kind"]) || "video"
        ),
        laneSelection: {
          ...toRecord(toRecord(nextProject["profile"])["laneSelection"]),
          ...toRecord(patch["laneSelection"])
        },
        sensitivity: clampNumber(
          patch["sensitivity"],
          0.1,
          1,
          clampNumber(toRecord(nextProject["profile"])["sensitivity"], 0.1, 1, 0.58)
        ),
        depth: ["quick", "balanced", "deep"].includes(asNonEmptyString(patch["depth"])) ? asNonEmptyString(patch["depth"]) : asNonEmptyString(toRecord(nextProject["profile"])["depth"]) || "balanced",
        frameSampleDensity: ["sparse", "balanced", "dense"].includes(
          asNonEmptyString(patch["frameSampleDensity"])
        ) ? asNonEmptyString(patch["frameSampleDensity"]) : asNonEmptyString(toRecord(nextProject["profile"])["frameSampleDensity"]) || "balanced",
        transcriptSampleSeconds: clampProfileTranscriptSampleSeconds(
          runtime["profileCapabilities"],
          Object.prototype.hasOwnProperty.call(patch, "transcriptSampleSeconds") ? patch["transcriptSampleSeconds"] : toRecord(nextProject["profile"])["transcriptSampleSeconds"]
        ),
        lastError: null,
        lastActionAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      markProfileAsStale(nextProject, "Profile controls changed; rerun the preflight.");
      return nextProject;
    });
  }
  async function setProfileTarget(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const requestedMode = asNonEmptyString(actionPayload["mode"]) === "derived" ? "derived" : "source";
      const requestedOutputId = requestedMode === "derived" ? asNonEmptyString(actionPayload["outputId"]) || asNonEmptyString(nextProject["edit"]["activeOutputId"]) : null;
      nextProject["profile"]["targetAssetMode"] = requestedMode;
      nextProject["profile"]["targetOutputId"] = requestedOutputId;
      nextProject["profile"]["lastError"] = null;
      nextProject["profile"]["lastActionAt"] = (/* @__PURE__ */ new Date()).toISOString();
      markProfileAsStale(
        nextProject,
        requestedMode === "derived" ? "Target asset moved to a derived output; rerun the preflight." : "Target asset moved back to the source; rerun the preflight."
      );
      return nextProject;
    });
  }
  async function setProfileModel(runtime, actionPayload) {
    void runtime;
    void actionPayload;
    throw new Error("Transcript model selection moved to Settings > User > Speech Runtime.");
  }
  async function runProfile(api, runtime, requestId) {
    return runProfilePreflight(api, runtime, requestId);
  }
  async function cancelProfile(api, runtime, requestId) {
    const activeProject = getActiveProject(runtime);
    if (activeProject === null) {
      throw new Error("Active project is missing.");
    }
    const activeProjectId = asNonEmptyString(activeProject["id"]);
    if (activeProjectId === null) {
      throw new Error("Active project id is missing.");
    }
    await cancelProfileJobsForProject(
      api,
      runtime,
      activeProjectId,
      requestId,
      "profile-run-preflight"
    );
    return patchActiveProject(runtime, function(nextProject) {
      nextProject["profile"]["lastError"] = null;
      nextProject["profile"]["lastActionAt"] = (/* @__PURE__ */ new Date()).toISOString();
      nextProject["profile"]["preflight"] = {
        ...createEmptyProfilePreflight(),
        ...toRecord(nextProject["profile"]["preflight"]),
        status: asNonEmptyString(toRecord(nextProject["profile"]["preflight"])["ranAt"]) !== null ? "stale" : "idle",
        jobId: null,
        requestId: null,
        error: null
      };
      return nextProject;
    });
  }
  async function installProfile(api, runtime, requestId, actionPayload) {
    void api;
    void runtime;
    void requestId;
    void actionPayload;
    throw new Error("Transcript model installs moved to Settings > User > Speech Runtime.");
  }
  async function removeProfile(runtime, requestId, actionPayload) {
    void runtime;
    void requestId;
    void actionPayload;
    throw new Error("Transcript model removal moved to Settings > User > Speech Runtime.");
  }
  return {
    applyProfilePreset,
    cancelProfile,
    installProfile,
    removeProfile,
    runProfile,
    setProfileMode,
    setProfileModel,
    setProfileTarget,
    updateProfile
  };
}
