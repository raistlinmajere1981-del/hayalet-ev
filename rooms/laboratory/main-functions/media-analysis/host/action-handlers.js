export function createMediaActionRuntime(deps) {
  const {
    applyEditRecipePatch,
    applyProfilePresetPatch,
    asNonEmptyString,
    audioFeatureId,
    cancelEditJobsForProject,
    cancelProfileJobsForProject,
    clampNumber,
    clampProfileTranscriptSampleSeconds,
    createEmptyProfilePreflight,
    createDefaultEditState,
    createProject: createProjectRecord,
    deleteProject: deleteProjectRecord,
    ensureProjectExists,
    exportFeatureReport,
    findEditPreset,
    findProfilePreset,
    getProfileModelDescriptorMap,
    getActiveProject,
    getDefaultMode,
    getDefaultSourceType,
    handleLocalPick,
    handleToolMutation,
    handleUrlDownload,
    handleYoutubeDownload,
    installProfileModel,
    markCloseoutAsStale,
    markProfileAsStale,
    normalizeProfileArtifactPreferences,
    patchActiveProject,
    patchActiveProjectDrafts,
    refreshActiveProjectMetadata,
    refreshToolStatus,
    removeProfileModel,
    resetEditForCurrentSource,
    resetProfileForCurrentSource,
    runFeatureProcess,
    runEditPipeline,
    cancelFeatureProcess,
    runProfilePreflight,
    toRecord,
  } = deps;

  async function setSourceKind(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
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
  }

  async function setSourceMode(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
      nextProject.source.mode =
        asNonEmptyString(actionPayload.mode) || getDefaultMode(runtime.sourcePresets, nextProject.source.kind);
      nextProject.source.lastError = null;
      return nextProject;
    });
  }

  async function updateDrafts(runtime, fields) {
    return patchActiveProjectDrafts(runtime, fields);
  }

  async function pickLocal(api, runtime, requestId, actionPayload) {
    await patchActiveProjectDrafts(runtime, actionPayload.fields);
    return handleLocalPick(api, runtime, requestId);
  }

  async function downloadUrl(api, runtime, requestId, actionPayload) {
    await patchActiveProjectDrafts(runtime, actionPayload.fields);
    return handleUrlDownload(api, runtime, requestId);
  }

  async function downloadYoutube(api, runtime, requestId, actionPayload) {
    await patchActiveProjectDrafts(runtime, actionPayload.fields);
    return handleYoutubeDownload(api, runtime, requestId);
  }

  async function setEditMode(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
      nextProject.edit.mode = asNonEmptyString(actionPayload.mode) === "advanced" ? "advanced" : "beginner";
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      return nextProject;
    });
  }

  async function applyEditPreset(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
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
  }

  async function updateEditRecipe(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
      applyEditRecipePatch(runtime, nextProject, toRecord(actionPayload.patch || actionPayload.fields), {});
      return nextProject;
    });
  }

  async function setEditOutput(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
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
      markCloseoutAsStale(nextProject, "Derived output selection changed.", [audioFeatureId]);
      return nextProject;
    });
  }

  async function setEditHandoff(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
      const requestedMode = asNonEmptyString(actionPayload.mode) === "derived" ? "derived" : "source";
      if (requestedMode === "derived" && asNonEmptyString(nextProject.edit.activeOutputId) === null) {
        throw new Error("Generate and select a derived output before enabling derived handoff.");
      }

      nextProject.edit.handoffMode = requestedMode;
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      markCloseoutAsStale(nextProject, "Downstream handoff changed.");
      return nextProject;
    });
  }

  async function previewEdit(api, runtime, requestId, actionPayload) {
    if (Object.keys(toRecord(actionPayload.patch)).length > 0) {
      await patchActiveProject(runtime, function (nextProject) {
        applyEditRecipePatch(runtime, nextProject, toRecord(actionPayload.patch), {});
        return nextProject;
      });
    }
    return runEditPipeline(api, runtime, requestId, "preview");
  }

  async function applyEdit(api, runtime, requestId, actionPayload) {
    if (Object.keys(toRecord(actionPayload.patch)).length > 0) {
      await patchActiveProject(runtime, function (nextProject) {
        applyEditRecipePatch(runtime, nextProject, toRecord(actionPayload.patch), {});
        return nextProject;
      });
    }
    return runEditPipeline(api, runtime, requestId, "apply");
  }

  async function cancelPreview(api, runtime, requestId) {
    if (getActiveProject(runtime) === null) {
      throw new Error("Active project is missing.");
    }
    await cancelEditJobsForProject(api, runtime, getActiveProject(runtime).id, requestId, "edit-preview");
    return patchActiveProject(runtime, function (nextProject) {
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      nextProject.edit.preview = {
        ...toRecord(nextProject.edit.preview),
        status: asNonEmptyString(toRecord(nextProject.edit.preview).path) !== null ? "stale" : "idle",
        jobId: null,
        requestId: null,
      };
      return nextProject;
    });
  }

  async function cancelApply(api, runtime, requestId) {
    if (getActiveProject(runtime) === null) {
      throw new Error("Active project is missing.");
    }
    await cancelEditJobsForProject(api, runtime, getActiveProject(runtime).id, requestId, "edit-apply");
    return patchActiveProject(runtime, function (nextProject) {
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      return nextProject;
    });
  }

  async function setProfileMode(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
      nextProject.profile.mode =
        asNonEmptyString(actionPayload.mode) === "advanced" ? "advanced" : "beginner";
      nextProject.profile.lastError = null;
      nextProject.profile.lastActionAt = new Date().toISOString();
      return nextProject;
    });
  }

  async function applyProfilePreset(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
      const presetId = asNonEmptyString(actionPayload.presetId);
      const preset = findProfilePreset(runtime.profilePresets, nextProject.source.kind, presetId);
      const nextProfile = applyProfilePresetPatch(
        runtime.profilePresets,
        runtime.profileModels,
        runtime.profileCapabilities,
        nextProject.source.kind,
        toRecord(nextProject.profile),
        presetId
      );
      if (!presetId || !preset || !nextProfile) {
        throw new Error("Requested profile preset is unavailable for the current source.");
      }
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
  }

  async function updateProfile(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
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
  }

  async function setProfileTarget(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
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
  }

  async function setProfileModel(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
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
  }

  async function runProfile(api, runtime, requestId) {
    return runProfilePreflight(api, runtime, requestId);
  }

  async function cancelProfile(api, runtime, requestId) {
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
    return patchActiveProject(runtime, function (nextProject) {
      nextProject.profile.lastError = null;
      nextProject.profile.lastActionAt = new Date().toISOString();
      nextProject.profile.preflight = {
        ...createEmptyProfilePreflight(),
        ...toRecord(nextProject.profile.preflight),
        status:
          asNonEmptyString(toRecord(nextProject.profile.preflight).ranAt) !== null ? "stale" : "idle",
        jobId: null,
        requestId: null,
        error: null,
      };
      return nextProject;
    });
  }

  async function installProfile(api, runtime, requestId, actionPayload) {
    return installProfileModel(api, runtime, requestId, asNonEmptyString(actionPayload.modelId));
  }

  async function removeProfile(runtime, requestId, actionPayload) {
    return removeProfileModel(runtime, requestId, asNonEmptyString(actionPayload.modelId));
  }

  async function refresh(runtime, requestId, checkUpdates) {
    await refreshToolStatus(runtime, {
      checkUpdates: checkUpdates === true,
    });
    return refreshActiveProjectMetadata(runtime, requestId);
  }

  async function createProject(runtime, featureId) {
    return createProjectRecord(runtime, featureId);
  }

  async function selectProject(runtime, requestId, featureId, actionPayload) {
    runtime.activeProjectId = asNonEmptyString(actionPayload.projectId);
    await ensureProjectExists(runtime, featureId);
    return refreshActiveProjectMetadata(runtime, requestId);
  }

  async function deleteProject(runtime, requestId, featureId, actionPayload) {
    return deleteProjectRecord(runtime, asNonEmptyString(actionPayload.projectId), requestId, featureId);
  }

  async function runProcess(api, runtime, requestId, featureId) {
    return runFeatureProcess(api, runtime, requestId, featureId);
  }

  async function cancelProcess(api, runtime, requestId, featureId) {
    return cancelFeatureProcess(api, runtime, requestId, featureId);
  }

  async function exportReport(api, runtime, requestId, featureId) {
    return exportFeatureReport(api, runtime, requestId, featureId);
  }

  async function mutateTool(api, runtime, requestId, action, actionPayload, featureStage) {
    await handleToolMutation(
      api,
      runtime,
      requestId,
      action,
      asNonEmptyString(actionPayload.toolId),
      featureStage || "source"
    );
    return refreshActiveProjectMetadata(runtime, requestId);
  }

  return {
    applyEdit,
    applyEditPreset,
    applyProfilePreset,
    cancelApply,
    cancelProfile,
    cancelPreview,
    downloadUrl,
    downloadYoutube,
    exportReport,
    installProfile,
    mutateTool,
    pickLocal,
    previewEdit,
    removeProfile,
    refresh,
    runProfile,
    runProcess,
    cancelProcess,
    createProject,
    deleteProject,
    selectProject,
    setEditHandoff,
    setEditMode,
    setEditOutput,
    setProfileMode,
    setProfileModel,
    setProfileTarget,
    setSourceKind,
    setSourceMode,
    updateProfile,
    updateDrafts,
    updateEditRecipe,
  };
}
