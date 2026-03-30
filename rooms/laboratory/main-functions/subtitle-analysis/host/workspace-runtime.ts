type LaboratoryRecord = Record<string, unknown>;

type LaboratoryRuntimeRecord = LaboratoryRecord;

type LaboratoryProjectRecord = LaboratoryRecord & {
  subtitleAnalysis?: unknown;
};

type LaboratorySubtitleWorkspaceDraftsRecord = LaboratoryRecord & {
  durationMaxSeconds?: unknown;
  durationMinSeconds?: unknown;
  limitCount?: unknown;
};

type LaboratorySubtitleWorkspaceRecord = LaboratoryRecord & {
  drafts?: unknown;
  lastActionAt?: unknown;
  lastError?: unknown;
};

type LaboratorySubtitleEditRecord = LaboratoryRecord & {
  lastActionAt?: unknown;
  lastError?: unknown;
  recipe?: unknown;
};

type LaboratorySubtitleStateRecord = LaboratoryRecord & {
  edit?: unknown;
  workspace?: unknown;
};

type LaboratoryDirectoryEntry = {
  isDirectory: boolean;
  name: string;
  path: string;
};

type SubtitleWorkspaceRuntimeDeps = {
  asNumber: (value: unknown) => number | null;
  getActiveProject: (runtime: LaboratoryRuntimeRecord) => LaboratoryProjectRecord | null;
  isSubtitleFileName: (runtime: LaboratoryRuntimeRecord, fileName: string) => boolean;
  listDirectory: (dirPath: string) => Promise<LaboratoryDirectoryEntry[]>;
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
  mergeObjects: (baseValue: LaboratoryRecord, patchValue: LaboratoryRecord) => LaboratoryRecord;
  normalizeSubtitleAnalysisState: (
    rawValue: unknown,
    runtime: LaboratoryRuntimeRecord
  ) => LaboratorySubtitleStateRecord;
  patchActiveProject: (
    runtime: LaboratoryRuntimeRecord,
    updater: (project: LaboratoryProjectRecord) => LaboratoryProjectRecord
  ) => Promise<LaboratoryProjectRecord>;
  readTextFile: (filePath: string) => Promise<string>;
  subtitleFeatureId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createSubtitleWorkspaceRuntime(deps: SubtitleWorkspaceRuntimeDeps) {
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

  function toSubtitleWorkspaceRecord(value: unknown): LaboratorySubtitleWorkspaceRecord {
    return toRecord(value);
  }

  function toWorkspaceDraftsRecord(value: unknown): LaboratorySubtitleWorkspaceDraftsRecord {
    return toRecord(value);
  }

  function toSubtitleEditRecord(value: unknown): LaboratorySubtitleEditRecord {
    return toRecord(value);
  }

  async function patchActiveSubtitleWorkspaceDrafts(
    runtime: LaboratoryRuntimeRecord,
    fields: unknown
  ) {
    const patch = toRecord(fields);
    if (Object.keys(patch).length === 0) {
      return getActiveProject(runtime);
    }

    return await patchActiveProject(runtime, function (nextProject) {
      const subtitleState = normalizeSubtitleAnalysisState(
        toRecord(nextProject)["subtitleAnalysis"],
        runtime
      );
      const workspace = toSubtitleWorkspaceRecord(subtitleState.workspace);
      const drafts = toWorkspaceDraftsRecord(workspace.drafts);
      workspace.drafts = {
        ...drafts,
        ...patch,
        durationMinSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMinSeconds")
          ? asNumber(patch["durationMinSeconds"])
          : asNumber(drafts["durationMinSeconds"]),
        durationMaxSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMaxSeconds")
          ? asNumber(patch["durationMaxSeconds"])
          : asNumber(drafts["durationMaxSeconds"]),
        limitCount: Object.prototype.hasOwnProperty.call(patch, "limitCount")
          ? asNumber(patch["limitCount"])
          : asNumber(drafts["limitCount"]),
      };
      workspace.lastError = null;
      workspace.lastActionAt = new Date().toISOString();
      subtitleState.workspace = workspace;
      nextProject["subtitleAnalysis"] = subtitleState;
      return nextProject;
    });
  }

  function applySubtitleEditPatch(
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord,
    patchValue: unknown
  ) {
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
    editState.lastActionAt = new Date().toISOString();
    subtitleState.edit = editState;
    project["subtitleAnalysis"] = subtitleState;
    markFeatureProcessStale(project, subtitleFeatureId, "Subtitle edit recipe changed.");
    markFeatureReportStale(project, subtitleFeatureId, "Subtitle edit recipe changed.");
    return project["subtitleAnalysis"];
  }

  async function listSubtitleFilesInDirectory(runtime: LaboratoryRuntimeRecord, dirPath: string) {
    const entries = await listDirectory(dirPath);
    return entries
      .filter(function (entry) {
        return entry.isDirectory !== true && isSubtitleFileName(runtime, entry.name);
      })
      .sort(function (left, right) {
        return String(left.name || "").localeCompare(String(right.name || ""));
      });
  }

  async function readSubtitleText(filePath: string) {
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
