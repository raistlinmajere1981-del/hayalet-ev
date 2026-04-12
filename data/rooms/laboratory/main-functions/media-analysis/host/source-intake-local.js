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
  function setProjectSource(project, updater) {
    const nextSource = project.source;
    updater(nextSource);
    project.source = nextSource;
  }
  function getProjectSourceKind(project) {
    return typeof project.source.kind === "string" && project.source.kind.trim() !== "" ? project.source.kind : "video";
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
  return {
    handleLocalPick
  };
}
