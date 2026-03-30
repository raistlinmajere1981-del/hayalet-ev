type LaboratoryRecord = Record<string, unknown>;

type LaboratoryMediaLocalRuntime = LaboratoryRecord & {
  sourcePresets?: unknown;
};

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  kind?: unknown;
};

type LaboratoryProjectRecord = LaboratoryRecord & {
  source: LaboratoryProjectSourceRecord;
};

type LaboratorySourceConfigRecord = LaboratoryRecord & {
  fileDialogFilters?: unknown;
};

type LaboratoryPreparedSource = {
  metadata: unknown;
  metadataError: string | null;
  mimeType: string | null;
  storedFileName: string | null;
  storedPath: string | null;
};

type LaboratoryOpenDialogResult = LaboratoryRecord & {
  canceled?: unknown;
  filePaths?: unknown;
};

type LaboratoryCopyFileResult = LaboratoryRecord & {
  error?: unknown;
  message?: unknown;
  name?: unknown;
  path?: unknown;
  success?: unknown;
};

type LaboratoryElectronApi = {
  copyFileTo: (sourcePath: string, destinationDir: string) => Promise<LaboratoryCopyFileResult>;
  showOpenDialog: (options: LaboratoryRecord) => Promise<LaboratoryOpenDialogResult>;
};

type MediaLocalSourceIntakeRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  getActiveProject: (runtime: LaboratoryMediaLocalRuntime) => LaboratoryProjectRecord;
  getElectronApi: () => LaboratoryElectronApi | null;
  getProjectSourceDir: (
    runtime: LaboratoryMediaLocalRuntime,
    project: LaboratoryProjectRecord
  ) => string;
  getSourceConfig: (
    sourcePresets: unknown,
    sourceKind: unknown
  ) => LaboratorySourceConfigRecord;
  normalizeMimeType: (fileName: unknown, kind: string) => string;
  patchActiveProject: (
    runtime: LaboratoryMediaLocalRuntime,
    updater: (project: LaboratoryProjectRecord) => LaboratoryProjectRecord
  ) => Promise<unknown>;
  resetEditForCurrentSource: (
    runtime: LaboratoryMediaLocalRuntime,
    project: LaboratoryProjectRecord
  ) => void;
  resetProfileForCurrentSource: (
    runtime: LaboratoryMediaLocalRuntime,
    project: LaboratoryProjectRecord,
    reason: string
  ) => void;
  resolvePreparedSource: (
    runtime: LaboratoryMediaLocalRuntime,
    project: LaboratoryProjectRecord,
    options: LaboratoryRecord
  ) => Promise<LaboratoryPreparedSource>;
};

export function createMediaLocalSourceIntakeRuntime(deps: MediaLocalSourceIntakeRuntimeDeps) {
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
    resolvePreparedSource,
  } = deps;

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  }

  function setProjectSource(
    project: LaboratoryProjectRecord,
    updater: (source: LaboratoryProjectSourceRecord) => void
  ) {
    const nextSource = project.source;
    updater(nextSource);
    project.source = nextSource;
  }

  function getProjectSourceKind(project: LaboratoryProjectRecord): string {
    return typeof project.source.kind === "string" && project.source.kind.trim() !== ""
      ? project.source.kind
      : "video";
  }

  async function handleLocalPick(
    _api: unknown,
    runtime: LaboratoryMediaLocalRuntime,
    requestId: string
  ) {
    const project = getActiveProject(runtime);
    const sourceConfig = getSourceConfig(runtime.sourcePresets, project.source.kind);
    const electronApi = getElectronApi();
    if (electronApi === null || typeof electronApi.showOpenDialog !== "function") {
      throw new Error("File picker is unavailable.");
    }

    const dialogResult = await electronApi.showOpenDialog({
      properties: ["openFile"],
      filters: Array.isArray(sourceConfig.fileDialogFilters) ? sourceConfig.fileDialogFilters : [],
    });

    const selectedPath = asNonEmptyString(toStringArray(dialogResult.filePaths)[0]);
    if (dialogResult.canceled === true || selectedPath === null) {
      return { cancelled: true };
    }

    const sourceDir = getProjectSourceDir(runtime, project);
    const copyResult = await electronApi.copyFileTo(selectedPath, sourceDir);
    if (copyResult.success !== true) {
      throw new Error(
        (typeof copyResult.message === "string" && copyResult.message) ||
          (typeof copyResult.error === "string" && copyResult.error) ||
          "Copy failed."
      );
    }

    const storedPath = asNonEmptyString(copyResult.path);
    const storedFileName =
      asNonEmptyString(copyResult.name) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
    const preparedSource = await resolvePreparedSource(runtime, project, {
      requestId: requestId,
      storedPath: storedPath,
      storedFileName: storedFileName,
      mimeType: normalizeMimeType(storedFileName, getProjectSourceKind(project)),
    });

    await patchActiveProject(runtime, function (nextProject) {
      setProjectSource(nextProject, function (nextSource) {
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
      storedFileName: preparedSource.storedFileName,
    };
  }

  return {
    handleLocalPick,
  };
}
