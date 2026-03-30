type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProjectRecord = LaboratoryRecord & {
  subtitleAnalysis?: unknown;
};

type LaboratorySubtitleEntryRecord = LaboratoryRecord & {
  id?: unknown;
};

type LaboratorySubtitleWorkspaceSelectionRecord = LaboratoryRecord & {
  selectedEntryIds?: unknown;
};

type LaboratorySubtitleWorkspaceRecord = LaboratoryRecord & {
  lastActionAt?: unknown;
  lastError?: unknown;
  mode?: unknown;
  selection?: unknown;
};

type LaboratorySubtitleDiscoveryRecord = LaboratoryRecord & {
  items?: unknown;
  selectedCandidateIds?: unknown;
};

type LaboratorySubtitleEditRecord = LaboratoryRecord & {
  lastActionAt?: unknown;
  lastError?: unknown;
  presetId?: unknown;
  preview?: unknown;
  recipe?: unknown;
};

type LaboratorySubtitleStateRecord = LaboratoryRecord & {
  activeEntryId?: unknown;
  discovery?: unknown;
  edit?: unknown;
  workspace?: unknown;
};

type LaboratorySubtitleDiscoveryItemRecord = LaboratoryRecord & {
  id?: unknown;
};

type SubtitleActionRuntimeDeps = {
  applySubtitleEdit: (runtime: LaboratoryRecord, requestId: string) => Promise<unknown>;
  applySubtitleEditPatch: (
    runtime: LaboratoryRecord,
    project: LaboratoryProjectRecord,
    patchValue: unknown
  ) => unknown;
  asNonEmptyString: (value: unknown) => string | null;
  createEmptySubtitleDiscoveryState: () => LaboratoryRecord;
  getDefaultSubtitleEditPresetId: (runtime: LaboratoryRecord) => string;
  getDefaultSubtitleEditRecipe: (runtime: LaboratoryRecord, presetId: string) => LaboratoryRecord;
  getSubtitleEntries: (project: LaboratoryProjectRecord) => LaboratorySubtitleEntryRecord[];
  handleSubtitleFolderPick: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  handleSubtitleLocalPick: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  handleSubtitleUrlDownload: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  handleSubtitleYoutubeDiscovery: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  handleSubtitleYoutubeDownload: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  markFeatureProcessStale: (
    project: LaboratoryProjectRecord,
    featureId: string,
    reason: string
  ) => unknown;
  markFeatureReportStale: (
    project: LaboratoryProjectRecord,
    featureId: string,
    reason: string
  ) => unknown;
  normalizeStringArray: (value: unknown) => string[];
  normalizeSubtitleAnalysisState: (
    rawValue: unknown,
    runtime: LaboratoryRecord
  ) => LaboratorySubtitleStateRecord;
  normalizeSubtitleDiscoveryItem: (
    rawValue: unknown,
    index: number
  ) => LaboratorySubtitleDiscoveryItemRecord;
  patchActiveProject: (
    runtime: LaboratoryRecord,
    updater: (project: LaboratoryProjectRecord) => LaboratoryProjectRecord
  ) => Promise<unknown>;
  patchActiveSubtitleWorkspaceDrafts: (
    runtime: LaboratoryRecord,
    fields: unknown
  ) => Promise<unknown>;
  previewSubtitleEdit: (runtime: LaboratoryRecord, requestId: string) => Promise<unknown>;
  subtitleFeatureId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createSubtitleActionRuntime(deps: SubtitleActionRuntimeDeps) {
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
    toRecord,
  } = deps;

  function toProjectRecord(value: unknown): LaboratoryProjectRecord {
    return toRecord(value);
  }

  function toWorkspaceRecord(value: unknown): LaboratorySubtitleWorkspaceRecord {
    return toRecord(value);
  }

  function toDiscoveryRecord(value: unknown): LaboratorySubtitleDiscoveryRecord {
    return toRecord(value);
  }

  function toEditRecord(value: unknown): LaboratorySubtitleEditRecord {
    return toRecord(value);
  }

  function toSelectionRecord(value: unknown): LaboratorySubtitleWorkspaceSelectionRecord {
    return toRecord(value);
  }

  function toSubtitleStateRecord(
    project: LaboratoryProjectRecord,
    runtime: LaboratoryRecord
  ): LaboratorySubtitleStateRecord {
    return normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
  }

  function updateWorkspaceActionMeta(subtitleState: LaboratorySubtitleStateRecord) {
    const workspace = toWorkspaceRecord(subtitleState.workspace);
    workspace.lastError = null;
    workspace.lastActionAt = new Date().toISOString();
    subtitleState.workspace = workspace;
  }

  function markSubtitleStateAsStale(project: LaboratoryProjectRecord, reason: string) {
    markFeatureProcessStale(project, subtitleFeatureId, reason);
    markFeatureReportStale(project, subtitleFeatureId, reason);
  }

  function patchSubtitleProject(
    runtime: LaboratoryRecord,
    updateSubtitleState: (
      project: LaboratoryProjectRecord,
      subtitleState: LaboratorySubtitleStateRecord
    ) => LaboratorySubtitleStateRecord
  ) {
    return patchActiveProject(runtime, function (nextProject) {
      const nextProjectRecord = toProjectRecord(nextProject);
      const subtitleState = toSubtitleStateRecord(nextProjectRecord, runtime);
      nextProjectRecord.subtitleAnalysis = updateSubtitleState(nextProjectRecord, subtitleState);
      return nextProjectRecord;
    });
  }

  async function setSourceMode(runtime: LaboratoryRecord, actionPayload: LaboratoryRecord) {
    return patchSubtitleProject(runtime, function (_project, subtitleState) {
      const workspace = toWorkspaceRecord(subtitleState.workspace);
      const nextMode =
        asNonEmptyString(actionPayload["mode"]) || asNonEmptyString(workspace.mode) || "local-file";
      if (workspace.mode !== nextMode) {
        subtitleState.discovery = createEmptySubtitleDiscoveryState();
      }
      workspace.mode = nextMode;
      subtitleState.workspace = workspace;
      updateWorkspaceActionMeta(subtitleState);
      return subtitleState;
    });
  }

  async function updateDrafts(runtime: LaboratoryRecord, fields: LaboratoryRecord) {
    return patchActiveSubtitleWorkspaceDrafts(runtime, fields);
  }

  async function pickLocal(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleLocalPick(api, runtime, requestId);
  }

  async function pickFolder(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleFolderPick(api, runtime, requestId);
  }

  async function downloadUrl(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleUrlDownload(api, runtime, requestId);
  }

  async function discoverYoutube(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleYoutubeDiscovery(api, runtime, requestId);
  }

  async function downloadYoutube(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    await patchActiveSubtitleWorkspaceDrafts(runtime, actionPayload["fields"]);
    return handleSubtitleYoutubeDownload(api, runtime, requestId);
  }

  async function toggleDiscovery(runtime: LaboratoryRecord, actionPayload: LaboratoryRecord) {
    return patchSubtitleProject(runtime, function (_project, subtitleState) {
      const candidateId = asNonEmptyString(actionPayload["candidateId"]);
      const discovery = toDiscoveryRecord(subtitleState.discovery);
      const selectedIds = normalizeStringArray(discovery.selectedCandidateIds);
      const nextSelectedIds =
        candidateId === null
          ? selectedIds
          : selectedIds.includes(candidateId)
            ? selectedIds.filter(function (entry) {
                return entry !== candidateId;
              })
            : selectedIds.concat(candidateId);
      discovery.selectedCandidateIds = nextSelectedIds;
      subtitleState.discovery = discovery;
      updateWorkspaceActionMeta(subtitleState);
      return subtitleState;
    });
  }

  async function selectAllDiscovery(runtime: LaboratoryRecord) {
    return patchSubtitleProject(runtime, function (_project, subtitleState) {
      const discovery = toDiscoveryRecord(subtitleState.discovery);
      const items = Array.isArray(discovery.items) ? discovery.items : [];
      discovery.selectedCandidateIds = items
        .map(function (entry, index) {
          return asNonEmptyString(normalizeSubtitleDiscoveryItem(entry, index).id);
        })
        .filter((entry): entry is string => entry !== null);
      subtitleState.discovery = discovery;
      updateWorkspaceActionMeta(subtitleState);
      return subtitleState;
    });
  }

  async function clearDiscoverySelection(runtime: LaboratoryRecord) {
    return patchSubtitleProject(runtime, function (_project, subtitleState) {
      const discovery = toDiscoveryRecord(subtitleState.discovery);
      discovery.selectedCandidateIds = [];
      subtitleState.discovery = discovery;
      updateWorkspaceActionMeta(subtitleState);
      return subtitleState;
    });
  }

  async function selectEntry(runtime: LaboratoryRecord, actionPayload: LaboratoryRecord) {
    return patchSubtitleProject(runtime, function (project, subtitleState) {
      const entryId = asNonEmptyString(actionPayload["entryId"]);
      const availableEntries = getSubtitleEntries(project);
      const selectedEntry =
        availableEntries.find(function (entry) {
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

  async function toggleSelection(runtime: LaboratoryRecord, actionPayload: LaboratoryRecord) {
    return patchSubtitleProject(runtime, function (project, subtitleState) {
      const entryId = asNonEmptyString(actionPayload["entryId"]);
      const workspace = toWorkspaceRecord(subtitleState.workspace);
      const selection = toSelectionRecord(workspace.selection);
      const selectedIds = normalizeStringArray(selection.selectedEntryIds);
      const nextSelectedIds =
        entryId === null
          ? selectedIds
          : selectedIds.includes(entryId)
            ? selectedIds.filter(function (candidateId) {
                return candidateId !== entryId;
              })
            : selectedIds.concat(entryId);
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

  async function applyEditPreset(runtime: LaboratoryRecord, actionPayload: LaboratoryRecord) {
    return patchSubtitleProject(runtime, function (project, subtitleState) {
      const presetId =
        asNonEmptyString(actionPayload["presetId"]) || getDefaultSubtitleEditPresetId(runtime);
      const edit = toEditRecord(subtitleState.edit);
      edit.presetId = presetId;
      edit.recipe = getDefaultSubtitleEditRecipe(runtime, presetId);
      edit.preview = {
        status: "idle",
        entryId: null,
        outputText: "",
        warnings: [],
        summary: null,
      };
      edit.lastError = null;
      edit.lastActionAt = new Date().toISOString();
      subtitleState.edit = edit;
      markSubtitleStateAsStale(project, "Subtitle preset changed.");
      return subtitleState;
    });
  }

  async function updateEditRecipe(runtime: LaboratoryRecord, actionPayload: LaboratoryRecord) {
    return patchActiveProject(runtime, function (nextProject) {
      const nextProjectRecord = toProjectRecord(nextProject);
      applySubtitleEditPatch(
        runtime,
        nextProjectRecord,
        actionPayload["patch"] || actionPayload["fields"]
      );
      return nextProjectRecord;
    });
  }

  async function previewEdit(
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    const patch = toRecord(actionPayload["patch"]);
    if (Object.keys(patch).length > 0) {
      await patchActiveProject(runtime, function (nextProject) {
        const nextProjectRecord = toProjectRecord(nextProject);
        applySubtitleEditPatch(runtime, nextProjectRecord, patch);
        return nextProjectRecord;
      });
    }
    return previewSubtitleEdit(runtime, requestId);
  }

  async function applyEdit(
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    const patch = toRecord(actionPayload["patch"]);
    if (Object.keys(patch).length > 0) {
      await patchActiveProject(runtime, function (nextProject) {
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
    updateEditRecipe,
  };
}
