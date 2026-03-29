export function createSubtitleActionRuntime(deps) {
  const {
    applySubtitleEdit,
    applySubtitleEditPatch,
    asNonEmptyString,
    createEmptySubtitleDiscoveryState,
    getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe,
    getSubtitleEntries,
    handleSubtitleFolderPick,
    handleSubtitleLocalPick,
    handleSubtitleUrlDownload,
    handleSubtitleYoutubeDiscovery,
    handleSubtitleYoutubeDownload,
    markFeatureProcessStale,
    markFeatureReportStale,
    normalizeStringArray,
    normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem,
    patchActiveProject,
    patchActiveSubtitleWorkspaceDrafts,
    previewSubtitleEdit,
    subtitleFeatureId,
    toRecord
  } = deps;
  async function setSourceMode(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const nextMode = asNonEmptyString(actionPayload.mode) || asNonEmptyString(
        toRecord(normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime).workspace).mode
      ) || "local-file";
      const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      if (subtitleState.workspace.mode !== nextMode) {
        subtitleState.discovery = createEmptySubtitleDiscoveryState();
      }
      subtitleState.workspace.mode = nextMode;
      subtitleState.workspace.lastError = null;
      subtitleState.workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProject.subtitleAnalysis = subtitleState;
      return nextProject;
    });
  }
  async function updateDrafts(runtime, fields) {
    return patchActiveSubtitleWorkspaceDrafts(runtime, fields);
  }
  async function pickLocal(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
    return handleSubtitleLocalPick(api, runtime, requestId);
  }
  async function pickFolder(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
    return handleSubtitleFolderPick(api, runtime, requestId);
  }
  async function downloadUrl(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
    return handleSubtitleUrlDownload(api, runtime, requestId);
  }
  async function discoverYoutube(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
    return handleSubtitleYoutubeDiscovery(api, runtime, requestId);
  }
  async function downloadYoutube(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload.fields);
    return handleSubtitleYoutubeDownload(api, runtime, requestId);
  }
  async function toggleDiscovery(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const candidateId = asNonEmptyString(actionPayload.candidateId);
      const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      const selectedIds = normalizeStringArray(toRecord(subtitleState.discovery).selectedCandidateIds);
      const nextSelectedIds = selectedIds.includes(candidateId) ? selectedIds.filter(function(entry) {
        return entry !== candidateId;
      }) : selectedIds.concat(candidateId);
      subtitleState.discovery.selectedCandidateIds = nextSelectedIds;
      subtitleState.workspace.lastError = null;
      subtitleState.workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProject.subtitleAnalysis = subtitleState;
      return nextProject;
    });
  }
  async function selectAllDiscovery(runtime) {
    return patchActiveProject(runtime, function(nextProject) {
      const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      subtitleState.discovery.selectedCandidateIds = (Array.isArray(toRecord(subtitleState.discovery).items) ? toRecord(subtitleState.discovery).items : []).map(function(entry, index) {
        return normalizeSubtitleDiscoveryItem(entry, index).id;
      });
      subtitleState.workspace.lastError = null;
      subtitleState.workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProject.subtitleAnalysis = subtitleState;
      return nextProject;
    });
  }
  async function clearDiscoverySelection(runtime) {
    return patchActiveProject(runtime, function(nextProject) {
      const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      subtitleState.discovery.selectedCandidateIds = [];
      subtitleState.workspace.lastError = null;
      subtitleState.workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProject.subtitleAnalysis = subtitleState;
      return nextProject;
    });
  }
  async function selectEntry(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const entryId = asNonEmptyString(actionPayload.entryId);
      const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      const availableEntries = getSubtitleEntries(nextProject);
      const selectedEntry = availableEntries.find(function(entry) {
        return entry.id === entryId;
      }) || null;
      subtitleState.activeEntryId = selectedEntry ? selectedEntry.id : subtitleState.activeEntryId;
      if (selectedEntry) {
        subtitleState.workspace.selection.selectedEntryIds = [selectedEntry.id];
      }
      subtitleState.workspace.lastError = null;
      subtitleState.workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProject.subtitleAnalysis = subtitleState;
      markFeatureProcessStale(nextProject, subtitleFeatureId, "Subtitle selection changed.");
      markFeatureReportStale(nextProject, subtitleFeatureId, "Subtitle selection changed.");
      return nextProject;
    });
  }
  async function toggleSelection(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const entryId = asNonEmptyString(actionPayload.entryId);
      const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      const selectedIds = normalizeStringArray(
        toRecord(toRecord(subtitleState.workspace).selection).selectedEntryIds
      );
      const nextSelectedIds = selectedIds.includes(entryId) ? selectedIds.filter(function(candidateId) {
        return candidateId !== entryId;
      }) : selectedIds.concat(entryId);
      subtitleState.workspace.selection.selectedEntryIds = nextSelectedIds;
      if (nextSelectedIds.length > 0) {
        subtitleState.activeEntryId = nextSelectedIds[0];
      }
      subtitleState.workspace.lastError = null;
      subtitleState.workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProject.subtitleAnalysis = subtitleState;
      markFeatureProcessStale(nextProject, subtitleFeatureId, "Subtitle batch selection changed.");
      markFeatureReportStale(nextProject, subtitleFeatureId, "Subtitle batch selection changed.");
      return nextProject;
    });
  }
  async function applyEditPreset(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const presetId = asNonEmptyString(actionPayload.presetId) || getDefaultSubtitleEditPresetId(runtime);
      const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
      subtitleState.edit.presetId = presetId;
      subtitleState.edit.recipe = getDefaultSubtitleEditRecipe(runtime, presetId);
      subtitleState.edit.preview = {
        status: "idle",
        entryId: null,
        outputText: "",
        warnings: [],
        summary: null
      };
      subtitleState.edit.lastError = null;
      subtitleState.edit.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProject.subtitleAnalysis = subtitleState;
      markFeatureProcessStale(nextProject, subtitleFeatureId, "Subtitle preset changed.");
      markFeatureReportStale(nextProject, subtitleFeatureId, "Subtitle preset changed.");
      return nextProject;
    });
  }
  async function updateEditRecipe(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      applySubtitleEditPatch(runtime, nextProject, actionPayload.patch || actionPayload.fields);
      return nextProject;
    });
  }
  async function previewEdit(runtime, requestId, actionPayload) {
    if (Object.keys(toRecord(actionPayload.patch)).length > 0) {
      await patchActiveProject(runtime, function(nextProject) {
        applySubtitleEditPatch(runtime, nextProject, actionPayload.patch);
        return nextProject;
      });
    }
    return previewSubtitleEdit(runtime, requestId);
  }
  async function applyEdit(runtime, requestId, actionPayload) {
    if (Object.keys(toRecord(actionPayload.patch)).length > 0) {
      await patchActiveProject(runtime, function(nextProject) {
        applySubtitleEditPatch(runtime, nextProject, actionPayload.patch);
        return nextProject;
      });
    }
    return applySubtitleEdit(runtime, requestId);
  }
  return {
    applyEdit,
    applyEditPreset,
    clearDiscoverySelection,
    discoverYoutube,
    downloadUrl,
    downloadYoutube,
    pickFolder,
    pickLocal,
    previewEdit,
    selectAllDiscovery,
    selectEntry,
    setSourceMode,
    toggleDiscovery,
    toggleSelection,
    updateDrafts,
    updateEditRecipe
  };
}
