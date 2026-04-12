export function createSubtitleEditWorkspaceRuntime(deps) {
  const {
    asNonEmptyString,
    buildSubtitleEditSummary,
    ensureProjectDirectories,
    getActiveProject,
    getActiveSubtitleEntry,
    getProjectSubtitleEditOutputDir,
    markFeatureProcessStale,
    markFeatureReportStale,
    normalizeSubtitleAnalysisState,
    normalizeSubtitleOutputRecord,
    patchActiveProject,
    readSubtitleText,
    resolveSubtitleOutputFormat,
    sanitizeFileSegment,
    subtitleFeatureId,
    toRecord,
    transformSubtitleDocument,
    writeTextFile
  } = deps;
  function toSubtitleEditRecord(value) {
    return toRecord(value);
  }
  function toSubtitleEditRecipeRecord(value) {
    return toRecord(value);
  }
  function getActiveEntryPath(entry) {
    return asNonEmptyString(entry.path);
  }
  function normalizeOutputEntries(value) {
    return Array.isArray(value) ? value.map(function(entry, index) {
      return normalizeSubtitleOutputRecord(entry, index);
    }) : [];
  }
  async function previewEdit(runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const activeEntry = getActiveSubtitleEntry(project);
    const activeEntryPath = activeEntry ? getActiveEntryPath(activeEntry) : null;
    if (activeEntry === null || activeEntryPath === null) {
      throw new Error("Pick a subtitle entry before previewing cleanup.");
    }
    const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const editState = toSubtitleEditRecord(subtitleState.edit);
    const recipe = toSubtitleEditRecipeRecord(editState.recipe);
    const sourceText = await readSubtitleText(activeEntryPath);
    const outputFormat = resolveSubtitleOutputFormat(activeEntry.format, recipe["outputFormat"]);
    const outputText = transformSubtitleDocument(
      sourceText,
      activeEntry.format,
      recipe,
      outputFormat
    );
    const summary = buildSubtitleEditSummary(
      sourceText,
      outputText,
      activeEntry.format,
      outputFormat
    );
    await patchActiveProject(runtime, function(nextProject) {
      const nextSubtitleState = normalizeSubtitleAnalysisState(
        nextProject.subtitleAnalysis,
        runtime
      );
      const nextEditState = toSubtitleEditRecord(nextSubtitleState.edit);
      const nextRecipe = toSubtitleEditRecipeRecord(nextEditState.recipe);
      nextEditState.preview = {
        status: "ready",
        entryId: activeEntry.id,
        outputText,
        warnings: (summary.maxLineLength || 0) > Number(nextRecipe.maxCharsPerLine || 42) ? ["Some output lines are still longer than the configured line budget."] : [],
        summary
      };
      nextEditState.lastError = null;
      nextEditState.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextSubtitleState.edit = nextEditState;
      nextProject.subtitleAnalysis = nextSubtitleState;
      return nextProject;
    });
    void requestId;
    return summary;
  }
  async function applyEdit(runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const activeEntry = getActiveSubtitleEntry(project);
    const activeEntryPath = activeEntry ? getActiveEntryPath(activeEntry) : null;
    if (activeEntry === null || activeEntryPath === null) {
      throw new Error("Pick a subtitle entry before applying cleanup.");
    }
    await ensureProjectDirectories(runtime, project, requestId);
    const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const editState = toSubtitleEditRecord(subtitleState.edit);
    const recipe = toSubtitleEditRecipeRecord(editState.recipe);
    const sourceText = await readSubtitleText(activeEntryPath);
    const outputFormat = resolveSubtitleOutputFormat(activeEntry.format, recipe["outputFormat"]);
    const outputText = transformSubtitleDocument(
      sourceText,
      activeEntry.format,
      recipe,
      outputFormat
    );
    const summary = buildSubtitleEditSummary(
      sourceText,
      outputText,
      activeEntry.format,
      outputFormat
    );
    const outputNameHint = asNonEmptyString(recipe.outputNameHint);
    const sourceStem = String(activeEntry.fileName || "subtitle").replace(/\.[^.]+$/, "");
    const outputStem = outputNameHint !== null ? sanitizeFileSegment(outputNameHint, sourceStem) : `${sourceStem}-cleaned`;
    const outputPath = `${getProjectSubtitleEditOutputDir(runtime, project)}/${outputStem}.${outputFormat}`;
    const outputLabel = `${activeEntry.fileName} cleanup`;
    await writeTextFile(outputPath, outputText);
    const outputRecord = normalizeSubtitleOutputRecord(
      {
        id: `subtitle-output-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        entryId: activeEntry.id,
        label: outputLabel,
        format: outputFormat,
        path: outputPath,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary
      },
      0
    );
    await patchActiveProject(runtime, function(nextProject) {
      const nextSubtitleState = normalizeSubtitleAnalysisState(
        nextProject.subtitleAnalysis,
        runtime
      );
      const nextEditState = toSubtitleEditRecord(nextSubtitleState.edit);
      nextEditState.preview = {
        status: "ready",
        entryId: activeEntry.id,
        outputText,
        warnings: [],
        summary
      };
      nextEditState.outputs = [outputRecord].concat(
        normalizeOutputEntries(nextEditState.outputs).filter(function(entry) {
          return entry.id !== outputRecord.id;
        })
      ).slice(0, 12);
      nextEditState.lastError = null;
      nextEditState.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextSubtitleState.edit = nextEditState;
      nextProject.subtitleAnalysis = nextSubtitleState;
      markFeatureProcessStale(nextProject, subtitleFeatureId, "Subtitle outputs changed.");
      markFeatureReportStale(nextProject, subtitleFeatureId, "Subtitle outputs changed.");
      return nextProject;
    });
    return outputRecord;
  }
  return {
    applyEdit,
    previewEdit
  };
}
