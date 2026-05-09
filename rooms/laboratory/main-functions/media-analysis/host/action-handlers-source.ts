import { findLabAssetById } from "../../../shared/host/lab-assets.js";
import { resetLaboratoryWorkbenchForSourceActivation } from "../../../shared/host/runtime-primitives.js";
import {
  inferLabAssetSourceKind,
  inferLabSourceKindFromUrl,
} from "../../../shared/lab-asset-kind.js";
import type { LabAsset } from "../../../models/lab-types.js";

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
  getActiveProject: (runtime: LaboratoryRecord) => LaboratoryRecord;
  getDefaultMode: (sourcePresets: unknown, sourceKind: unknown) => string;
  getDefaultSourceType: (sourcePresets: unknown) => string;
  handleLocalPick: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    localFields?: unknown
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
  handleYoutubeProbe: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    url: string
  ) => Promise<unknown>;
  patchActiveProject: (
    runtime: LaboratoryRecord,
    patcher: (project: LaboratoryRecord) => LaboratoryRecord
  ) => Promise<unknown>;
  patchActiveProjectDrafts: (runtime: LaboratoryRecord, fields: unknown) => Promise<unknown>;
  refreshActiveProjectMetadata: (runtime: LaboratoryRecord, requestId: string) => Promise<unknown>;
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

function toRecord(value: unknown): LaboratoryRecord {
  return isLaboratoryRecord(value) ? value : {};
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
    getActiveProject,
    getDefaultMode,
    getDefaultSourceType,
    handleLocalPick,
    handleUrlDownload,
    handleYoutubeDownload,
    handleYoutubeProbe,
    patchActiveProject,
    patchActiveProjectDrafts,
    refreshActiveProjectMetadata,
    resetEditForCurrentSource,
    resetProfileForCurrentSource,
  } = deps;

  function inferMimeType(fileName: string | null, sourceKind: string): string | null {
    const lowerName = String(fileName || "").toLowerCase();
    if (sourceKind === "audio") {
      if (lowerName.endsWith(".m4a")) return "audio/mp4";
      if (lowerName.endsWith(".wav")) return "audio/wav";
      if (lowerName.endsWith(".flac")) return "audio/flac";
      if (lowerName.endsWith(".ogg")) return "audio/ogg";
      if (lowerName.endsWith(".aac")) return "audio/aac";
      return "audio/mpeg";
    }
    if (sourceKind === "image") {
      if (lowerName.endsWith(".png")) return "image/png";
      if (lowerName.endsWith(".webp")) return "image/webp";
      if (lowerName.endsWith(".gif")) return "image/gif";
      if (lowerName.endsWith(".bmp")) return "image/bmp";
      return "image/jpeg";
    }
    if (lowerName.endsWith(".webm")) return "video/webm";
    if (lowerName.endsWith(".mov")) return "video/quicktime";
    if (lowerName.endsWith(".mkv")) return "video/x-matroska";
    if (lowerName.endsWith(".avi")) return "video/x-msvideo";
    if (lowerName.endsWith(".m4v")) return "video/x-m4v";
    return "video/mp4";
  }

  function getBasename(path: string) {
    return path.split(/[\\/]/).pop() || path;
  }

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
      nextProject["workbench"] = resetLaboratoryWorkbenchForSourceActivation(
        nextProject["workbench"]
      );
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
      nextProject["workbench"] = resetLaboratoryWorkbenchForSourceActivation(
        nextProject["workbench"]
      );
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
    return handleLocalPick(api, runtime, requestId, actionPayload["fields"]);
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

  function isYoutubeUrl(value: string) {
    try {
      const parsedUrl = new URL(value);
      const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
      return (
        host === "youtu.be" ||
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "youtube-nocookie.com"
      );
    } catch {
      return false;
    }
  }

  async function checkProjectImportUrl(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    actionPayload: LaboratoryRecord
  ) {
    const fields = toRecord(actionPayload["fields"]);
    await patchActiveProjectDrafts(runtime, fields);
    const urlInput = asNonEmptyString(fields["urlInput"]);
    if (urlInput === null) {
      throw new Error("URL is required.");
    }
    if (isYoutubeUrl(urlInput) === true) {
      return handleYoutubeProbe(api, runtime, requestId, urlInput);
    }
    return {
      url: urlInput,
      isYoutube: false,
      kind: inferLabSourceKindFromUrl(urlInput),
    };
  }

  async function prepareRemoteAssetSource(
    runtime: LaboratoryRecord,
    asset: LabAsset,
    sourceKind: "video" | "audio" | "image",
    sourceUrl: string,
    mode: "url" | "youtube"
  ) {
    await patchActiveProject(runtime, function (project) {
      const nextProject = toProjectRecord(project);
      nextProject.source.kind = sourceKind;
      nextProject.source.mode = mode;
      nextProject.source.status = "idle";
      nextProject.source.storedPath = null;
      nextProject.source.storedFileName = null;
      nextProject.source.sourceUrl = null;
      nextProject.source.mimeType = null;
      nextProject.source.routeLabel = null;
      nextProject.source.lastError = null;
      nextProject.source.metadata = {
        ...toRecord(asset.metadata),
        originAssetId: asset.id,
        originAssetType: asset.type,
      };
      nextProject.source.metadataError = null;
      nextProject["workbench"] = resetLaboratoryWorkbenchForSourceActivation(
        nextProject["workbench"]
      );
      resetEditForCurrentSource(runtime, nextProject);
      resetProfileForCurrentSource(
        runtime,
        nextProject,
        "Source asset changed; rerun the profile preflight."
      );
      return nextProject;
    });
    await patchActiveProjectDrafts(runtime, {
      kind: sourceKind,
      mode,
      urlInput: sourceUrl,
      youtubeUrl: sourceUrl,
    });
  }

  async function activateLocalAssetSource(
    runtime: LaboratoryRecord,
    requestId: string,
    asset: LabAsset,
    sourceKind: "video" | "audio" | "image",
    localPath: string
  ) {
    const storedFileName = asNonEmptyString(asset.name) || getBasename(localPath);
    const mimeType =
      asNonEmptyString(toRecord(asset.metadata)["mimeType"]) ||
      inferMimeType(storedFileName, sourceKind);
    await patchActiveProject(runtime, function (project) {
      const nextProject = toProjectRecord(project);
      const assetMetadata = toRecord(asset.metadata);
      nextProject.source.mode = "local";
      nextProject.source.kind = sourceKind;
      nextProject.source.status = "ready";
      nextProject.source.storedPath = localPath;
      nextProject.source.storedFileName = storedFileName;
      nextProject.source.mimeType = mimeType;
      nextProject.source.sourceUrl = asNonEmptyString(asset.url) || localPath;
      nextProject.source.routeLabel = "Asset reuse";
      nextProject.source.lastError = null;
      nextProject.source.metadata = {
        ...assetMetadata,
        derivedFromAssetId: asset.id,
        kind: sourceKind,
        originAssetId: asset.id,
        originAssetType: asset.type,
      };
      nextProject.source.metadataError = null;
      nextProject.source["sourceAssetId"] = asset.id;
      nextProject["workbench"] = resetLaboratoryWorkbenchForSourceActivation(
        nextProject["workbench"]
      );
      resetEditForCurrentSource(runtime, nextProject);
      resetProfileForCurrentSource(
        runtime,
        nextProject,
        "Source asset changed; rerun the profile preflight."
      );
      return nextProject;
    });
    await refreshActiveProjectMetadata(runtime, requestId);
    return {
      assetId: asset.id,
      sourceKind,
      storedPath: localPath,
    };
  }

  async function activateAssetSource(
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
    const project = toProjectRecord(getActiveProject(runtime));
    const asset = findLabAssetById(project, assetId);
    if (asset === null) {
      throw new Error("Selected project asset is not registered in this project.");
    }
    const sourceKind = inferLabAssetSourceKind(asset);
    if (sourceKind === null) {
      throw new Error("Selected project asset is not a supported media source.");
    }

    const localPath = asNonEmptyString(asset.localPath);
    if (localPath !== null) {
      return activateLocalAssetSource(runtime, requestId, asset, sourceKind, localPath);
    }

    const sourceUrl = asNonEmptyString(asset.url);
    if (sourceUrl === null || /^https?:\/\//i.test(sourceUrl) !== true) {
      throw new Error("Selected project asset is not available as an importable source.");
    }

    if (isYoutubeUrl(sourceUrl) === true) {
      await prepareRemoteAssetSource(runtime, asset, sourceKind, sourceUrl, "youtube");
      return handleYoutubeDownload(api, runtime, requestId);
    }
    await prepareRemoteAssetSource(runtime, asset, sourceKind, sourceUrl, "url");
    return handleUrlDownload(api, runtime, requestId);
  }

  return {
    activateAssetSource,
    checkProjectImportUrl,
    downloadUrl,
    downloadYoutube,
    pickLocal,
    setSourceKind,
    setSourceMode,
    updateDrafts,
  };
}
