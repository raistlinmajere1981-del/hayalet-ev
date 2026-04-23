import { findLabAssetById } from "../../../shared/host/lab-assets.js";
export function createMediaLocalSourceIntakeRuntime(deps) {
  const {
    asNonEmptyString,
    getActiveProject,
    getElectronApi,
    getProjectSourceDir,
    getSourceConfig,
    normalizeMimeType,
    patchActiveProject,
    resetEditForCurrentSource,
    resetProfileForCurrentSource,
    resolvePreparedSource
  } = deps;
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(
      (entry) => typeof entry === "string" && entry.trim() !== ""
    );
  }
  function toRecord(value) {
    if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
      return value;
    }
    return {};
  }
  function setProjectSource(project, updater) {
    const nextSource = project.source;
    updater(nextSource);
    project.source = nextSource;
  }
  function getProjectSourceKind(project) {
    return typeof project.source.kind === "string" && project.source.kind.trim() !== "" ? project.source.kind : "video";
  }
  function inferAssetSourceKind(asset, fallbackKind) {
    const metadata = toRecord(asset.metadata);
    const metadataKind = asNonEmptyString(metadata["kind"]) || asNonEmptyString(metadata["sourceKind"]);
    if (metadataKind === "video" || metadataKind === "audio" || metadataKind === "image") {
      return metadataKind;
    }
    if (asset.type === "audio") {
      return "audio";
    }
    if (asset.type === "frame" || asset.type === "image") {
      return "image";
    }
    if (asset.type === "clip" || asset.type === "source") {
      return "video";
    }
    return fallbackKind;
  }
  async function handleLocalPick(_api, runtime, requestId) {
    const project = getActiveProject(runtime);
    const sourceConfig = getSourceConfig(runtime.sourcePresets, project.source.kind);
    const electronApi = getElectronApi();
    if (electronApi === null || typeof electronApi.showOpenDialog !== "function") {
      throw new Error("File picker is unavailable.");
    }
    const dialogResult = await electronApi.showOpenDialog({
      properties: ["openFile"],
      filters: Array.isArray(sourceConfig.fileDialogFilters) ? sourceConfig.fileDialogFilters : []
    });
    const selectedPath = asNonEmptyString(toStringArray(dialogResult.filePaths)[0]);
    if (dialogResult.canceled === true || selectedPath === null) {
      return { cancelled: true };
    }
    const sourceDir = getProjectSourceDir(runtime, project);
    const copyResult = await electronApi.copyFileTo(selectedPath, sourceDir);
    if (copyResult.success !== true) {
      throw new Error(
        typeof copyResult.message === "string" && copyResult.message || typeof copyResult.error === "string" && copyResult.error || "Copy failed."
      );
    }
    const storedPath = asNonEmptyString(copyResult.path);
    const storedFileName = asNonEmptyString(copyResult.name) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
    const preparedSource = await resolvePreparedSource(runtime, project, {
      requestId,
      storedPath,
      storedFileName,
      mimeType: normalizeMimeType(storedFileName, getProjectSourceKind(project))
    });
    await patchActiveProject(runtime, function(nextProject) {
      setProjectSource(nextProject, function(nextSource) {
        nextSource["mode"] = "local";
        nextSource["status"] = "ready";
        nextSource["storedPath"] = preparedSource.storedPath;
        nextSource["storedFileName"] = preparedSource.storedFileName;
        nextSource["mimeType"] = preparedSource.mimeType;
        nextSource["sourceUrl"] = selectedPath;
        nextSource["routeLabel"] = "Local copy";
        nextSource["lastError"] = null;
        nextSource["metadata"] = preparedSource.metadata;
        nextSource["metadataError"] = preparedSource.metadataError;
      });
      resetEditForCurrentSource(runtime, nextProject);
      resetProfileForCurrentSource(
        runtime,
        nextProject,
        "Source media changed; rerun the profile preflight."
      );
      return nextProject;
    });
    return {
      storedPath: preparedSource.storedPath,
      storedFileName: preparedSource.storedFileName
    };
  }
  async function handleAssetAsSource(_api, runtime, requestId, assetId) {
    const project = getActiveProject(runtime);
    const asset = findLabAssetById(project, assetId);
    if (asset === null) {
      throw new Error("Asset is not registered in this project.");
    }
    const assetPath = asNonEmptyString(asset.localPath);
    if (assetPath === null) {
      throw new Error("Only local project assets can be used as a source.");
    }
    const electronApi = getElectronApi();
    if (electronApi === null || typeof electronApi.copyFileTo !== "function") {
      throw new Error("Asset source import is unavailable.");
    }
    const sourceKind = inferAssetSourceKind(asset, getProjectSourceKind(project));
    const sourceDir = getProjectSourceDir(runtime, project);
    const copyResult = await electronApi.copyFileTo(assetPath, sourceDir);
    if (copyResult.success !== true) {
      throw new Error(
        typeof copyResult.message === "string" && copyResult.message || typeof copyResult.error === "string" && copyResult.error || "Asset copy failed."
      );
    }
    const storedPath = asNonEmptyString(copyResult.path);
    const storedFileName = asNonEmptyString(copyResult.name) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
    const preparedProject = {
      ...project,
      source: {
        ...project.source,
        kind: sourceKind
      }
    };
    const preparedSource = await resolvePreparedSource(runtime, preparedProject, {
      requestId,
      storedPath,
      storedFileName,
      mimeType: normalizeMimeType(storedFileName, sourceKind)
    });
    await patchActiveProject(runtime, function(nextProject) {
      const derivedFromSourceId = asNonEmptyString(asset.sourceId);
      const derivedFromRunId = asNonEmptyString(asset.runId);
      setProjectSource(nextProject, function(nextSource) {
        nextSource["kind"] = sourceKind;
        nextSource["mode"] = "local";
        nextSource["status"] = "ready";
        nextSource["storedPath"] = preparedSource.storedPath;
        nextSource["storedFileName"] = preparedSource.storedFileName;
        nextSource["mimeType"] = preparedSource.mimeType;
        nextSource["sourceUrl"] = assetPath;
        nextSource["routeLabel"] = "Asset reuse";
        nextSource["lastError"] = null;
        nextSource["metadata"] = {
          ...toRecord(preparedSource.metadata),
          derivedFromAssetId: asset.id,
          ...derivedFromSourceId === null ? {} : { derivedFromSourceId },
          ...derivedFromRunId === null ? {} : { derivedFromRunId },
          originAssetId: asset.id,
          originAssetType: asset.type
        };
        nextSource["metadataError"] = preparedSource.metadataError;
      });
      resetEditForCurrentSource(runtime, nextProject);
      resetProfileForCurrentSource(
        runtime,
        nextProject,
        "Source asset changed; rerun the profile preflight."
      );
      return nextProject;
    });
    return {
      assetId: asset.id,
      storedPath: preparedSource.storedPath,
      storedFileName: preparedSource.storedFileName
    };
  }
  return {
    handleAssetAsSource,
    handleLocalPick
  };
}
