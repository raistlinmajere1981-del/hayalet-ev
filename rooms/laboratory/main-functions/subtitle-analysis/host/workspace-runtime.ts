export function createSubtitleWorkspaceRuntime(deps: any) {
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
    toRecord,
  } = deps;

  async function patchActiveSubtitleWorkspaceDrafts(runtime: any, fields: any) {
    const patch = toRecord(fields);
    if (Object.keys(patch).length === 0) {
      return getActiveProject(runtime);
    }

    return await patchActiveProject(runtime, function (nextProject: any) {
      const subtitleState = normalizeSubtitleAnalysisState(
        toRecord(nextProject).subtitleAnalysis,
        runtime
      );
      subtitleState.workspace.drafts = {
        ...toRecord(subtitleState.workspace.drafts),
        ...patch,
        durationMinSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMinSeconds")
          ? asNumber(patch.durationMinSeconds)
          : asNumber(toRecord(subtitleState.workspace.drafts).durationMinSeconds),
        durationMaxSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMaxSeconds")
          ? asNumber(patch.durationMaxSeconds)
          : asNumber(toRecord(subtitleState.workspace.drafts).durationMaxSeconds),
        limitCount: Object.prototype.hasOwnProperty.call(patch, "limitCount")
          ? asNumber(patch.limitCount)
          : asNumber(toRecord(subtitleState.workspace.drafts).limitCount),
      };
      subtitleState.workspace.lastError = null;
      subtitleState.workspace.lastActionAt = new Date().toISOString();
      nextProject.subtitleAnalysis = subtitleState;
      return nextProject;
    });
  }

  function applySubtitleEditPatch(runtime: any, project: any, patchValue: any) {
    const patch = toRecord(patchValue);
    const subtitleState = normalizeSubtitleAnalysisState(
      toRecord(project).subtitleAnalysis,
      runtime
    );
    subtitleState.edit.recipe = mergeObjects(toRecord(subtitleState.edit.recipe), patch);
    subtitleState.edit.recipe.maxCharsPerLine = Math.max(
      24,
      Math.min(64, Math.round(asNumber(toRecord(subtitleState.edit.recipe).maxCharsPerLine) || 42))
    );
    subtitleState.edit.lastError = null;
    subtitleState.edit.lastActionAt = new Date().toISOString();
    project.subtitleAnalysis = subtitleState;
    markFeatureProcessStale(project, subtitleFeatureId, "Subtitle edit recipe changed.");
    markFeatureReportStale(project, subtitleFeatureId, "Subtitle edit recipe changed.");
    return project.subtitleAnalysis;
  }

  async function listSubtitleFilesInDirectory(runtime: any, dirPath: any) {
    const entries = await listDirectory(dirPath);
    return entries
      .filter(function (entry: any) {
        return entry && entry.isDirectory !== true && isSubtitleFileName(runtime, entry.name);
      })
      .sort(function (left: any, right: any) {
        return String(left.name || "").localeCompare(String(right.name || ""));
      });
  }

  async function readSubtitleText(filePath: any) {
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
    readSubtitleText,
  };
}
