export function createMediaSourceActionRuntime(deps: any) {
  const {
    asNonEmptyString,
    getDefaultMode,
    getDefaultSourceType,
    handleLocalPick,
    handleUrlDownload,
    handleYoutubeDownload,
    patchActiveProject,
    patchActiveProjectDrafts,
    resetEditForCurrentSource,
    resetProfileForCurrentSource,
  } = deps;

  async function setSourceKind(runtime: any, actionPayload: Record<string, unknown>) {
    return patchActiveProject(runtime, function (nextProject: any) {
      nextProject.source.kind =
        asNonEmptyString(actionPayload["kind"]) || getDefaultSourceType(runtime.sourcePresets);
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

  async function setSourceMode(runtime: any, actionPayload: Record<string, unknown>) {
    return patchActiveProject(runtime, function (nextProject: any) {
      nextProject.source.mode =
        asNonEmptyString(actionPayload["mode"]) ||
        getDefaultMode(runtime.sourcePresets, nextProject.source.kind);
      nextProject.source.lastError = null;
      return nextProject;
    });
  }

  async function updateDrafts(runtime: any, fields: Record<string, unknown>) {
    return patchActiveProjectDrafts(runtime, fields);
  }

  async function pickLocal(
    api: any,
    runtime: any,
    requestId: string,
    actionPayload: Record<string, unknown>
  ) {
    await patchActiveProjectDrafts(runtime, actionPayload["fields"]);
    return handleLocalPick(api, runtime, requestId);
  }

  async function downloadUrl(
    api: any,
    runtime: any,
    requestId: string,
    actionPayload: Record<string, unknown>
  ) {
    await patchActiveProjectDrafts(runtime, actionPayload["fields"]);
    return handleUrlDownload(api, runtime, requestId);
  }

  async function downloadYoutube(
    api: any,
    runtime: any,
    requestId: string,
    actionPayload: Record<string, unknown>
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
  };
}
