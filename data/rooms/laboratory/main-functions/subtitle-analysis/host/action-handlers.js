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
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toWorkspaceRecord(value) {
    return toRecord(value);
  }
  function toDiscoveryRecord(value) {
    return toRecord(value);
  }
  function toEditRecord(value) {
    return toRecord(value);
  }
  function toSelectionRecord(value) {
    return toRecord(value);
  }
  function toSubtitleStateRecord(project, runtime) {
    return normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
  }
  function updateWorkspaceActionMeta(subtitleState) {
    const workspace = toWorkspaceRecord(subtitleState.workspace);
    workspace.lastError = null;
    workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
    subtitleState.workspace = workspace;
  }
  function markSubtitleStateAsStale(project, reason) {
    markFeatureProcessStale(project, subtitleFeatureId, reason);
    markFeatureReportStale(project, subtitleFeatureId, reason);
  }
  function patchSubtitleProject(runtime, updateSubtitleState) {
    return patchActiveProject(runtime, function(nextProject) {
      const nextProjectRecord = toProjectRecord(nextProject);
      const subtitleState = toSubtitleStateRecord(nextProjectRecord, runtime);
      nextProjectRecord.subtitleAnalysis = updateSubtitleState(nextProjectRecord, subtitleState);
      return nextProjectRecord;
    });
  }
  async function setSourceMode(runtime, actionPayload) {
    return patchSubtitleProject(runtime, function(_project, subtitleState) {
      const workspace = toWorkspaceRecord(subtitleState.workspace);
      const nextMode = asNonEmptyString(actionPayload["mode"]) || asNonEmptyString(workspace.mode) || "local-file";
      if (workspace.mode !== nextMode) {
        subtitleState.discovery = createEmptySubtitleDiscoveryState();
      }
      workspace.mode = nextMode;
      subtitleState.workspace = workspace;
      updateWorkspaceActionMeta(subtitleState);
      return subtitleState;
    });
  }
  async function updateDrafts(runtime, fields) {
    return patchActiveSubtitleWorkspaceDrafts(runtime, fields);
  }
  async function pickLocal(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleLocalPick(api, runtime, requestId);
  }
  async function pickFolder(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleFolderPick(api, runtime, requestId);
  }
  async function downloadUrl(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleUrlDownload(api, runtime, requestId);
  }
  async function discoverYoutube(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleYoutubeDiscovery(api, runtime, requestId);
  }
  async function downloadYoutube(api, runtime, requestId, actionPayload) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleYoutubeDownload(api, runtime, requestId);
  }
  async function toggleDiscovery(runtime, actionPayload) {
    return patchSubtitleProject(runtime, function(_project, subtitleState) {
      const candidateId = asNonEmptyString(actionPayload["candidateId"]);
      const discovery = toDiscoveryRecord(subtitleState.discovery);
      const selectedIds = normalizeStringArray(discovery.selectedCandidateIds);
      const nextSelectedIds = candidateId === null ? selectedIds : selectedIds.includes(candidateId) ? selectedIds.filter(function(entry) {
        return entry !== candidateId;
      }) : selectedIds.concat(candidateId);
      discovery.selectedCandidateIds = nextSelectedIds;
      subtitleState.discovery = discovery;
      updateWorkspaceActionMeta(subtitleState);
      return subtitleState;
    });
  }
  async function selectAllDiscovery(runtime) {
    return patchSubtitleProject(runtime, function(_project, subtitleState) {
      const discovery = toDiscoveryRecord(subtitleState.discovery);
      const items = Array.isArray(discovery.items) ? discovery.items : [];
      discovery.selectedCandidateIds = items.map(function(entry, index) {
        return asNonEmptyString(normalizeSubtitleDiscoveryItem(entry, index).id);
      }).filter((entry) => entry !== null);
      subtitleState.discovery = discovery;
      updateWorkspaceActionMeta(subtitleState);
      return subtitleState;
    });
  }
  async function clearDiscoverySelection(runtime) {
    return patchSubtitleProject(runtime, function(_project, subtitleState) {
      const discovery = toDiscoveryRecord(subtitleState.discovery);
      discovery.selectedCandidateIds = [];
      subtitleState.discovery = discovery;
      updateWorkspaceActionMeta(subtitleState);
      return subtitleState;
    });
  }
  async function selectEntry(runtime, actionPayload) {
    return patchSubtitleProject(runtime, function(project, subtitleState) {
      const entryId = asNonEmptyString(actionPayload["entryId"]);
      const availableEntries = getSubtitleEntries(project);
      const selectedEntry = availableEntries.find(function(entry) {
        return asNonEmptyString(entry.id) === entryId;
      }) || null;
      if (selectedEntry) {
        subtitleState.activeEntryId = selectedEntry.id;
        const workspace = toWorkspaceRecord(subtitleState.workspace);
        const selection = toSelectionRecord(workspace.selection);
        selection.selectedEntryIds = [selectedEntry.id];
        workspace.selection = selection;
        subtitleState.workspace = workspace;
      }
      updateWorkspaceActionMeta(subtitleState);
      markSubtitleStateAsStale(project, "Subtitle selection changed.");
      return subtitleState;
    });
  }
  async function toggleSelection(runtime, actionPayload) {
    return patchSubtitleProject(runtime, function(project, subtitleState) {
      const entryId = asNonEmptyString(actionPayload["entryId"]);
      const workspace = toWorkspaceRecord(subtitleState.workspace);
      const selection = toSelectionRecord(workspace.selection);
      const selectedIds = normalizeStringArray(selection.selectedEntryIds);
      const nextSelectedIds = entryId === null ? selectedIds : selectedIds.includes(entryId) ? selectedIds.filter(function(candidateId) {
        return candidateId !== entryId;
      }) : selectedIds.concat(entryId);
      selection.selectedEntryIds = nextSelectedIds;
      workspace.selection = selection;
      subtitleState.workspace = workspace;
      if (nextSelectedIds.length > 0) {
        subtitleState.activeEntryId = nextSelectedIds[0];
      }
      updateWorkspaceActionMeta(subtitleState);
      markSubtitleStateAsStale(project, "Subtitle batch selection changed.");
      return subtitleState;
    });
  }
  async function applyEditPreset(runtime, actionPayload) {
    return patchSubtitleProject(runtime, function(project, subtitleState) {
      const presetId = asNonEmptyString(actionPayload["presetId"]) || getDefaultSubtitleEditPresetId(runtime);
      const edit = toEditRecord(subtitleState.edit);
      edit.presetId = presetId;
      edit.recipe = getDefaultSubtitleEditRecipe(runtime, presetId);
      edit.preview = {
        status: "idle",
        entryId: null,
        outputText: "",
        warnings: [],
        summary: null
      };
      edit.lastError = null;
      edit.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      subtitleState.edit = edit;
      markSubtitleStateAsStale(project, "Subtitle preset changed.");
      return subtitleState;
    });
  }
  async function updateEditRecipe(runtime, actionPayload) {
    return patchActiveProject(runtime, function(nextProject) {
      const nextProjectRecord = toProjectRecord(nextProject);
      applySubtitleEditPatch(
        runtime,
        nextProjectRecord,
        actionPayload["patch"] || actionPayload["fields"]
      );
      return nextProjectRecord;
    });
  }
  async function previewEdit(runtime, requestId, actionPayload) {
    const patch = toRecord(actionPayload["patch"]);
    if (Object.keys(patch).length > 0) {
      await patchActiveProject(runtime, function(nextProject) {
        const nextProjectRecord = toProjectRecord(nextProject);
        applySubtitleEditPatch(runtime, nextProjectRecord, patch);
        return nextProjectRecord;
      });
    }
    return previewSubtitleEdit(runtime, requestId);
  }
  async function applyEdit(runtime, requestId, actionPayload) {
    const patch = toRecord(actionPayload["patch"]);
    if (Object.keys(patch).length > 0) {
      await patchActiveProject(runtime, function(nextProject) {
        const nextProjectRecord = toProjectRecord(nextProject);
        applySubtitleEditPatch(runtime, nextProjectRecord, patch);
        return nextProjectRecord;
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
