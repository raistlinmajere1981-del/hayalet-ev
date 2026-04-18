export function createSubtitleWorkspaceRuntime(deps) {
  const {
    asNumber,
    getActiveProject,
    isSubtitleFileName,
    listDirectory,
    markFeatureProcessStale,
    markFeatureReportStale,
    mergeObjects,
    normalizeSubtitleAnalysisState,
    patchActiveProject,
    readTextFile,
    subtitleFeatureId,
    toRecord
  } = deps;
  function toSubtitleWorkspaceRecord(value) {
    return toRecord(value);
  }
  function toWorkspaceDraftsRecord(value) {
    return toRecord(value);
  }
  function toSubtitleEditRecord(value) {
    return toRecord(value);
  }
  async function patchActiveSubtitleWorkspaceDrafts(runtime, fields) {
    const patch = toRecord(fields);
    if (Object.keys(patch).length === 0) {
      return getActiveProject(runtime);
    }
    return await patchActiveProject(runtime, function(nextProject) {
      const subtitleState = normalizeSubtitleAnalysisState(
        toRecord(nextProject)["subtitleAnalysis"],
        runtime
      );
      const workspace = toSubtitleWorkspaceRecord(subtitleState.workspace);
      const drafts = toWorkspaceDraftsRecord(workspace.drafts);
      workspace.drafts = {
        ...drafts,
        ...patch,
        durationMinSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMinSeconds") ? asNumber(patch["durationMinSeconds"]) : asNumber(drafts["durationMinSeconds"]),
        durationMaxSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMaxSeconds") ? asNumber(patch["durationMaxSeconds"]) : asNumber(drafts["durationMaxSeconds"]),
        limitCount: Object.prototype.hasOwnProperty.call(patch, "limitCount") ? asNumber(patch["limitCount"]) : asNumber(drafts["limitCount"])
      };
      workspace.lastError = null;
      workspace.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      subtitleState.workspace = workspace;
      nextProject["subtitleAnalysis"] = subtitleState;
      return nextProject;
    });
  }
  function applySubtitleEditPatch(runtime, project, patchValue) {
    const patch = toRecord(patchValue);
    const subtitleState = normalizeSubtitleAnalysisState(
      toRecord(project)["subtitleAnalysis"],
      runtime
    );
    const editState = toSubtitleEditRecord(subtitleState.edit);
    const nextRecipe = mergeObjects(toRecord(editState.recipe), patch);
    nextRecipe["maxCharsPerLine"] = Math.max(
      24,
      Math.min(64, Math.round(asNumber(toRecord(nextRecipe)["maxCharsPerLine"]) || 42))
    );
    editState.recipe = nextRecipe;
    editState.lastError = null;
    editState.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
    subtitleState.edit = editState;
    project["subtitleAnalysis"] = subtitleState;
    markFeatureProcessStale(project, subtitleFeatureId, "Subtitle edit recipe changed.");
    markFeatureReportStale(project, subtitleFeatureId, "Subtitle edit recipe changed.");
    return project["subtitleAnalysis"];
  }
  async function listSubtitleFilesInDirectory(runtime, dirPath) {
    const entries = await listDirectory(dirPath);
    return entries.filter(function(entry) {
      return entry.isDirectory !== true && isSubtitleFileName(runtime, entry.name);
    }).sort(function(left, right) {
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }
  async function readSubtitleText(filePath) {
    const rawText = await readTextFile(filePath);
    if (typeof rawText !== "string") {
      throw new Error(`Subtitle file could not be read: ${filePath}`);
    }
    return rawText;
  }
  return {
    applySubtitleEditPatch,
    listSubtitleFilesInDirectory,
    patchActiveSubtitleWorkspaceDrafts,
    readSubtitleText
  };
}
