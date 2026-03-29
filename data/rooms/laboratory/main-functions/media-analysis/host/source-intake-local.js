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
  async function handleLocalPick(api, runtime, requestId) {
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
    if (!dialogResult || dialogResult.canceled === true || !Array.isArray(dialogResult.filePaths)) {
      return { cancelled: true };
    }
    const selectedPath = dialogResult.filePaths[0];
    if (typeof selectedPath !== "string" || selectedPath.trim() === "") {
      return { cancelled: true };
    }
    const sourceDir = getProjectSourceDir(runtime, project);
    const copyResult = await electronApi.copyFileTo(selectedPath, sourceDir);
    if (!copyResult || copyResult.success !== true) {
      throw new Error(copyResult && (copyResult.message || copyResult.error) || "Copy failed.");
    }
    const storedPath = asNonEmptyString(copyResult.path);
    const storedFileName = asNonEmptyString(copyResult.name) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
    const preparedSource = await resolvePreparedSource(runtime, project, {
      requestId,
      storedPath,
      storedFileName,
      mimeType: normalizeMimeType(storedFileName, project.source.kind)
    });
    await patchActiveProject(runtime, function(nextProject) {
      nextProject.source.mode = "local";
      nextProject.source.status = "ready";
      nextProject.source.storedPath = preparedSource.storedPath;
      nextProject.source.storedFileName = preparedSource.storedFileName;
      nextProject.source.mimeType = preparedSource.mimeType;
      nextProject.source.sourceUrl = selectedPath;
      nextProject.source.routeLabel = "Local copy";
      nextProject.source.lastError = null;
      nextProject.source.metadata = preparedSource.metadata;
      nextProject.source.metadataError = preparedSource.metadataError;
      resetEditForCurrentSource(runtime, nextProject);
      resetProfileForCurrentSource(runtime, nextProject, "Source media changed; rerun the profile preflight.");
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
