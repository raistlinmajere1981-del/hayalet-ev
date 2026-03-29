export function createMediaEditActionRuntime(deps) {
  const {
    applyEditRecipePatch,
    asNonEmptyString,
    audioFeatureId,
    cancelEditJobsForProject,
    createDefaultEditState,
    findEditPreset,
    getActiveProject,
    markCloseoutAsStale,
    markProfileAsStale,
    patchActiveProject,
    runEditPipeline,
    toRecord,
  } = deps;

  async function setEditMode(runtime, actionPayload) {
    return patchActiveProject(runtime, function (nextProject) {
      nextProject.edit.mode =
        asNonEmptyString(actionPayload.mode) === "advanced" ? "advanced" : "beginner";
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

  return {
    applyEdit,
    applyEditPreset,
    cancelApply,
    cancelPreview,
    previewEdit,
    setEditHandoff,
    setEditMode,
    setEditOutput,
    updateEditRecipe,
  };
}
