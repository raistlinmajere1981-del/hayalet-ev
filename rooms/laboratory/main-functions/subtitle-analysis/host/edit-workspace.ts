export function createSubtitleEditWorkspaceRuntime(deps: any) {
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
    writeTextFile,
  } = deps;

  async function previewEdit(runtime: any, requestId: any) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const activeEntry = getActiveSubtitleEntry(project);
    if (activeEntry === null || activeEntry.path === null) {
      throw new Error("Pick a subtitle entry before previewing cleanup.");
    }

    const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const sourceText = await readSubtitleText(activeEntry.path);
    const outputFormat = resolveSubtitleOutputFormat(
      activeEntry.format,
      toRecord(subtitleState.edit.recipe).outputFormat
    );
    const outputText = transformSubtitleDocument(
      sourceText,
      activeEntry.format,
      subtitleState.edit.recipe,
      outputFormat
    );
    const summary = buildSubtitleEditSummary(
      sourceText,
      outputText,
      activeEntry.format,
      outputFormat
    );

    await patchActiveProject(runtime, function (nextProject: any) {
      const nextSubtitleState = normalizeSubtitleAnalysisState(
        nextProject.subtitleAnalysis,
        runtime
      );
      nextSubtitleState.edit.preview = {
        status: "ready",
        entryId: activeEntry.id,
        outputText: outputText,
        warnings:
          summary.maxLineLength > Number(nextSubtitleState.edit.recipe.maxCharsPerLine || 42)
            ? ["Some output lines are still longer than the configured line budget."]
            : [],
        summary: summary,
      };
      nextSubtitleState.edit.lastError = null;
      nextSubtitleState.edit.lastActionAt = new Date().toISOString();
      nextProject.subtitleAnalysis = nextSubtitleState;
      return nextProject;
    });

    void requestId;
    return summary;
  }

  async function applyEdit(runtime: any, requestId: any) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const activeEntry = getActiveSubtitleEntry(project);
    if (activeEntry === null || activeEntry.path === null) {
      throw new Error("Pick a subtitle entry before applying cleanup.");
    }

    await ensureProjectDirectories(runtime, project, requestId);
    const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const sourceText = await readSubtitleText(activeEntry.path);
    const outputFormat = resolveSubtitleOutputFormat(
      activeEntry.format,
      toRecord(subtitleState.edit.recipe).outputFormat
    );
    const outputText = transformSubtitleDocument(
      sourceText,
      activeEntry.format,
      subtitleState.edit.recipe,
      outputFormat
    );
    const summary = buildSubtitleEditSummary(
      sourceText,
      outputText,
      activeEntry.format,
      outputFormat
    );
    const outputNameHint = asNonEmptyString(toRecord(subtitleState.edit.recipe).outputNameHint);
    const sourceStem = String(activeEntry.fileName || "subtitle").replace(/\.[^.]+$/, "");
    const outputStem =
      outputNameHint !== null
        ? sanitizeFileSegment(outputNameHint, sourceStem)
        : `${sourceStem}-cleaned`;
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
        createdAt: new Date().toISOString(),
        summary: summary,
      },
      0
    );

    await patchActiveProject(runtime, function (nextProject: any) {
      const nextSubtitleState = normalizeSubtitleAnalysisState(
        nextProject.subtitleAnalysis,
        runtime
      );
      nextSubtitleState.edit.preview = {
        status: "ready",
        entryId: activeEntry.id,
        outputText: outputText,
        warnings: [],
        summary: summary,
      };
      nextSubtitleState.edit.outputs = [outputRecord]
        .concat(
          nextSubtitleState.edit.outputs.filter(function (entry: any) {
            return asNonEmptyString(toRecord(entry).id) !== outputRecord.id;
          })
        )
        .map(function (entry: any, index: any) {
          return normalizeSubtitleOutputRecord(entry, index);
        })
        .slice(0, 12);
      nextSubtitleState.edit.lastError = null;
      nextSubtitleState.edit.lastActionAt = new Date().toISOString();
      nextProject.subtitleAnalysis = nextSubtitleState;
      markFeatureProcessStale(nextProject, subtitleFeatureId, "Subtitle outputs changed.");
      markFeatureReportStale(nextProject, subtitleFeatureId, "Subtitle outputs changed.");
      return nextProject;
    });

    return outputRecord;
  }

  return {
    applyEdit,
    previewEdit,
  };
}
