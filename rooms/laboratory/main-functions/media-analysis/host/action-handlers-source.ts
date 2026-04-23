type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  kind?: unknown;
  lastError?: unknown;
  metadata?: unknown;
  metadataError?: unknown;
  mimeType?: unknown;
  mode?: unknown;
  routeLabel?: unknown;
  sourceUrl?: unknown;
  status?: unknown;
  storedFileName?: unknown;
  storedPath?: unknown;
};

type LaboratoryProjectRecord = LaboratoryRecord & {
  source: LaboratoryProjectSourceRecord;
};

type MediaSourceActionRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  getDefaultMode: (sourcePresets: unknown, sourceKind: unknown) => string;
  getDefaultSourceType: (sourcePresets: unknown) => string;
  handleLocalPick: (api: unknown, runtime: LaboratoryRecord, requestId: string) => Promise<unknown>;
  handleAssetAsSource: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    assetId: string
  ) => Promise<unknown>;
  handleUrlDownload: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  handleYoutubeDownload: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  patchActiveProject: (
    runtime: LaboratoryRecord,
    patcher: (project: LaboratoryRecord) => LaboratoryRecord
  ) => Promise<unknown>;
  patchActiveProjectDrafts: (runtime: LaboratoryRecord, fields: unknown) => Promise<unknown>;
  resetEditForCurrentSource: (runtime: LaboratoryRecord, project: LaboratoryRecord) => void;
  resetProfileForCurrentSource: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    reason: string
  ) => void;
};

function isLaboratoryRecord(value: unknown): value is LaboratoryRecord {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function toProjectRecord(value: unknown): LaboratoryProjectRecord {
  const projectRecord = isLaboratoryRecord(value) ? value : {};
  const sourceRecord = isLaboratoryRecord(projectRecord["source"]) ? projectRecord["source"] : {};
  return {
    ...projectRecord,
    source: sourceRecord,
  };
}

export function createMediaSourceActionRuntime(deps: MediaSourceActionRuntimeDeps) {
  const {
    asNonEmptyString,
    getDefaultMode,
    getDefaultSourceType,
    handleAssetAsSource,
    handleLocalPick,
    handleUrlDownload,
    handleYoutubeDownload,
    patchActiveProject,
    patchActiveProjectDrafts,
    resetEditForCurrentSource,
    resetProfileForCurrentSource,
  } = deps;

  async function setSourceKind(runtime: LaboratoryRecord, actionPayload: LaboratoryRecord) {
    return patchActiveProject(runtime, function (project) {
      const nextProject = toProjectRecord(project);
      nextProject.source.kind =
        asNonEmptyString(actionPayload["kind"]) || getDefaultSourceType(runtime["sourcePresets"]);
      nextProject.source.mode = getDefaultMode(runtime["sourcePresets"], nextProject.source.kind);
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

  async function setSourceMode(runtime: LaboratoryRecord, actionPayload: LaboratoryRecord) {
    return patchActiveProject(runtime, function (project) {
      const nextProject = toProjectRecord(project);
      nextProject.source.mode =
        asNonEmptyString(actionPayload["mode"]) ||
        getDefaultMode(runtime["sourcePresets"], nextProject.source.kind);
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
        "Source import method changed; rerun the profile preflight."
      );
      return nextProject;
    });
  }

  async function updateDrafts(runtime: LaboratoryRecord, fields: LaboratoryRecord) {
    return patchActiveProjectDrafts(runtime, fields);
  }

  async function pickLocal(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    await patchActiveProjectDrafts(runtime, actionPayload["fields"]);
    return handleLocalPick(api, runtime, requestId);
  }

  async function useAssetAsSource(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    const assetId =
      asNonEmptyString(actionPayload["assetId"]) || asNonEmptyString(actionPayload["id"]);
    if (assetId === null) {
      throw new Error("Asset id is required.");
    }
    return handleAssetAsSource(api, runtime, requestId, assetId);
  }

  async function downloadUrl(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    await patchActiveProjectDrafts(runtime, actionPayload["fields"]);
    return handleUrlDownload(api, runtime, requestId);
  }

  async function downloadYoutube(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    await patchActiveProjectDrafts(runtime, actionPayload["fields"]);
    return handleYoutubeDownload(api, runtime, requestId);
  }

  return {
    downloadUrl,
    downloadYoutube,
    pickLocal,
    setSourceKind,
    setSourceMode,
    updateDrafts,
    useAssetAsSource,
  };
}
