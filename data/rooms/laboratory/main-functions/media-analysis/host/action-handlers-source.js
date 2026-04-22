function isLaboratoryRecord(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}
function toProjectRecord(value) {
  const projectRecord = isLaboratoryRecord(value) ? value : {};
  const sourceRecord = isLaboratoryRecord(projectRecord["source"]) ? projectRecord["source"] : {};
  return {
    ...projectRecord,
    source: sourceRecord
  };
}
export function createMediaSourceActionRuntime(deps) {
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
    resetProfileForCurrentSource
  } = deps;
  async function setSourceKind(runtime, actionPayload) {
    return patchActiveProject(runtime, function(project) {
      const nextProject = toProjectRecord(project);
      nextProject.source.kind = asNonEmptyString(actionPayload["kind"]) || getDefaultSourceType(runtime["sourcePresets"]);
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
  async function setSourceMode(runtime, actionPayload) {
    return patchActiveProject(runtime, function(project) {
      const nextProject = toProjectRecord(project);
      nextProject.source.mode = asNonEmptyString(actionPayload["mode"]) || getDefaultMode(runtime["sourcePresets"], nextProject.source.kind);
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
  async function updateDrafts(runtime, fields) {
    return patchActiveProjectDrafts(runtime, fields);
  }
  async function pickLocal(api, runtime, requestId, actionPayload) {
    await patchActiveProjectDrafts(runtime, actionPayload["fields"]);
    return handleLocalPick(api, runtime, requestId);
  }
  async function downloadUrl(api, runtime, requestId, actionPayload) {
    await patchActiveProjectDrafts(runtime, actionPayload["fields"]);
    return handleUrlDownload(api, runtime, requestId);
  }
  async function downloadYoutube(api, runtime, requestId, actionPayload) {
    await patchActiveProjectDrafts(runtime, actionPayload["fields"]);
    return handleYoutubeDownload(api, runtime, requestId);
  }
  return {
    downloadUrl,
    downloadYoutube,
    pickLocal,
    setSourceKind,
    setSourceMode,
    updateDrafts
  };
}
