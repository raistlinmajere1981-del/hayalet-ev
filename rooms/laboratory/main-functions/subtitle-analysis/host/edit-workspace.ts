type LaboratoryRecord = Record<string, unknown>;

type LaboratoryRuntimeRecord = LaboratoryRecord;

type LaboratoryProjectRecord = LaboratoryRecord & {
  subtitleAnalysis?: unknown;
};

type LaboratorySubtitleEntryRecord = LaboratoryRecord & {
  fileName?: unknown;
  format?: unknown;
  id?: unknown;
  path?: unknown;
};

type LaboratorySubtitleOutputRecord = LaboratoryRecord & {
  id?: string;
};

type LaboratorySubtitleEditRecipeRecord = LaboratoryRecord & {
  maxCharsPerLine?: unknown;
  outputNameHint?: unknown;
};

type LaboratorySubtitleEditRecord = LaboratoryRecord & {
  lastActionAt?: unknown;
  lastError?: unknown;
  outputs?: unknown;
  preview?: unknown;
  recipe?: unknown;
};

type LaboratorySubtitleStateRecord = LaboratoryRecord & {
  edit?: unknown;
};

type LaboratorySubtitleSummaryRecord = LaboratoryRecord & {
  maxLineLength?: number;
};

type SubtitleEditWorkspaceRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  buildSubtitleEditSummary: (
    sourceText: string,
    outputText: string,
    inputFormat: unknown,
    outputFormat: string
  ) => LaboratorySubtitleSummaryRecord;
  ensureProjectDirectories: (
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord,
    requestId: string
  ) => Promise<unknown> | unknown;
  getActiveProject: (runtime: LaboratoryRuntimeRecord) => LaboratoryProjectRecord | null;
  getActiveSubtitleEntry: (
    project: LaboratoryProjectRecord
  ) => LaboratorySubtitleEntryRecord | null;
  getProjectSubtitleEditOutputDir: (
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord
  ) => string;
  markFeatureProcessStale: (
    project: LaboratoryProjectRecord,
    featureId: string,
    reason: string
  ) => unknown;
  markFeatureReportStale: (
    project: LaboratoryProjectRecord,
    featureId: string,
    reason: string
  ) => unknown;
  normalizeSubtitleAnalysisState: (
    rawValue: unknown,
    runtime: LaboratoryRuntimeRecord
  ) => LaboratorySubtitleStateRecord;
  normalizeSubtitleOutputRecord: (
    rawValue: unknown,
    index: number
  ) => LaboratorySubtitleOutputRecord;
  patchActiveProject: (
    runtime: LaboratoryRuntimeRecord,
    updater: (project: LaboratoryProjectRecord) => LaboratoryProjectRecord
  ) => Promise<unknown>;
  readSubtitleText: (filePath: string) => Promise<string>;
  resolveSubtitleOutputFormat: (inputFormat: unknown, requestedFormat: unknown) => string;
  sanitizeFileSegment: (value: string, fallbackValue: string) => string;
  subtitleFeatureId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
  transformSubtitleDocument: (
    sourceText: string,
    inputFormat: unknown,
    recipe: LaboratoryRecord,
    outputFormat: string
  ) => string;
  writeTextFile: (filePath: string, content: string) => Promise<unknown> | unknown;
};

export function createSubtitleEditWorkspaceRuntime(deps: SubtitleEditWorkspaceRuntimeDeps) {
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

  function toSubtitleEditRecord(value: unknown): LaboratorySubtitleEditRecord {
    return toRecord(value);
  }

  function toSubtitleEditRecipeRecord(value: unknown): LaboratorySubtitleEditRecipeRecord {
    return toRecord(value);
  }

  function getActiveEntryPath(entry: LaboratorySubtitleEntryRecord): string | null {
    return asNonEmptyString(entry.path);
  }

  function normalizeOutputEntries(value: unknown): LaboratorySubtitleOutputRecord[] {
    return Array.isArray(value)
      ? value.map(function (entry, index) {
          return normalizeSubtitleOutputRecord(entry, index);
        })
      : [];
  }

  async function previewEdit(runtime: LaboratoryRuntimeRecord, requestId: string) {
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

    await patchActiveProject(runtime, function (nextProject) {
      const nextSubtitleState = normalizeSubtitleAnalysisState(
        nextProject.subtitleAnalysis,
        runtime
      );
      const nextEditState = toSubtitleEditRecord(nextSubtitleState.edit);
      const nextRecipe = toSubtitleEditRecipeRecord(nextEditState.recipe);
      nextEditState.preview = {
        status: "ready",
        entryId: activeEntry.id,
        outputText: outputText,
        warnings:
          (summary.maxLineLength || 0) > Number(nextRecipe.maxCharsPerLine || 42)
            ? ["Some output lines are still longer than the configured line budget."]
            : [],
        summary: summary,
      };
      nextEditState.lastError = null;
      nextEditState.lastActionAt = new Date().toISOString();
      nextSubtitleState.edit = nextEditState;
      nextProject.subtitleAnalysis = nextSubtitleState;
      return nextProject;
    });

    void requestId;
    return summary;
  }

  async function applyEdit(runtime: LaboratoryRuntimeRecord, requestId: string) {
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

    await patchActiveProject(runtime, function (nextProject) {
      const nextSubtitleState = normalizeSubtitleAnalysisState(
        nextProject.subtitleAnalysis,
        runtime
      );
      const nextEditState = toSubtitleEditRecord(nextSubtitleState.edit);
      nextEditState.preview = {
        status: "ready",
        entryId: activeEntry.id,
        outputText: outputText,
        warnings: [],
        summary: summary,
      };
      nextEditState.outputs = [outputRecord]
        .concat(
          normalizeOutputEntries(nextEditState.outputs).filter(function (entry) {
            return entry.id !== outputRecord.id;
          })
        )
        .slice(0, 12);
      nextEditState.lastError = null;
      nextEditState.lastActionAt = new Date().toISOString();
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
    previewEdit,
  };
}
