import { getProjectSubtitleSourceDir } from "../../../shared/host/project-paths.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryRuntimeRecord = LaboratoryRecord & {
  subtitleSourcePresets?: unknown;
};
type LaboratoryProjectSubtitleSourceDirRuntime = Parameters<typeof getProjectSubtitleSourceDir>[0];
type LaboratoryProjectSubtitleSourceDirProject = Parameters<typeof getProjectSubtitleSourceDir>[1];

type LaboratoryProjectRecord = LaboratoryRecord & {
  id?: unknown;
  slug?: unknown;
  subtitleAnalysis?: unknown;
};

type LaboratorySubtitleWorkspaceRecord = LaboratoryRecord & {
  drafts?: unknown;
  lastActionAt?: unknown;
  lastError?: unknown;
};

type LaboratorySubtitleStateRecord = LaboratoryRecord & {
  workspace?: unknown;
};

type LaboratorySubtitleEntryRecord = LaboratoryRecord & {
  id?: unknown;
};

type LaboratoryDirectoryEntry = {
  isDirectory: boolean;
  name: string;
  path: string;
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

type SubtitleSourceIntakeRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  callRoomTools: (payload: LaboratoryRecord) => Promise<LaboratoryRecord>;
  createSubtitleEntryRecord: (
    filePath: string,
    options: LaboratoryRecord
  ) => LaboratorySubtitleEntryRecord;
  getActiveProject: (runtime: LaboratoryRuntimeRecord) => LaboratoryProjectRecord | null;
  getElectronApi: () => LaboratoryElectronApi | null;
  getSubtitleMimeType: (fileName: string) => string | null;
  isSubtitleFileName: (runtime: LaboratoryRuntimeRecord, fileName: string) => boolean;
  listSubtitleFilesInDirectory: (
    runtime: LaboratoryRuntimeRecord,
    dirPath: string
  ) => Promise<LaboratoryDirectoryEntry[]>;
  normalizeSubtitleAnalysisState: (
    rawValue: unknown,
    runtime: LaboratoryRuntimeRecord
  ) => LaboratorySubtitleStateRecord;
  patchActiveProject: (
    runtime: LaboratoryRuntimeRecord,
    updater: (project: LaboratoryProjectRecord) => LaboratoryProjectRecord
  ) => Promise<unknown>;
  pushJobState: (api: unknown, payload: LaboratoryRecord) => void;
  registerJob: (runtime: LaboratoryRuntimeRecord, options: LaboratoryRecord) => unknown;
  resetSubtitleDiscovery: (
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord
  ) => void;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
  upsertSubtitleEntries: (
    runtime: LaboratoryRuntimeRecord,
    project: LaboratoryProjectRecord,
    incomingEntries: LaboratorySubtitleEntryRecord[],
    options: LaboratoryRecord
  ) => void;
};

export function createSubtitleSourceIntakeRuntime(deps: SubtitleSourceIntakeRuntimeDeps) {
  const {
    asNonEmptyString,
    callRoomTools,
    createSubtitleEntryRecord,
    getActiveProject,
    getElectronApi,
    getSubtitleMimeType,
    isSubtitleFileName,
    listSubtitleFilesInDirectory,
    normalizeSubtitleAnalysisState,
    patchActiveProject,
    pushJobState,
    registerJob,
    resetSubtitleDiscovery,
    roomId,
    toRecord,
    upsertSubtitleEntries,
  } = deps;

  function toWorkspaceRecord(value: unknown): LaboratorySubtitleWorkspaceRecord {
    return toRecord(value);
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
    );
  }

  function getProjectId(project: LaboratoryProjectRecord): string {
    const projectId = asNonEmptyString(project.id);
    if (projectId === null) {
      throw new Error("Active project id is missing.");
    }
    return projectId;
  }

  function asProjectSubtitleSourceDirRuntime(
    runtime: LaboratoryRuntimeRecord
  ): LaboratoryProjectSubtitleSourceDirRuntime {
    return runtime as unknown as LaboratoryProjectSubtitleSourceDirRuntime;
  }

  function asProjectSubtitleSourceDirProject(
    project: LaboratoryProjectRecord
  ): LaboratoryProjectSubtitleSourceDirProject {
    return project as unknown as LaboratoryProjectSubtitleSourceDirProject;
  }

  function getSubtitleUrlFileName(urlValue: string, hintValue: unknown) {
    const hinted = asNonEmptyString(hintValue);
    if (hinted !== null) {
      return getSubtitleMimeType(hinted) !== null ? hinted : `${hinted}.srt`;
    }

    try {
      const parsed = new URL(urlValue);
      const pathname = decodeURIComponent(parsed.pathname || "");
      const rawName = pathname.split("/").filter(Boolean).pop();
      if (rawName && isSubtitleFileName({ subtitleSourcePresets: {} }, rawName)) {
        return rawName;
      }
      if (rawName && rawName.indexOf(".") > 0) {
        return rawName;
      }
    } catch (_error) {
      // noop
    }

    return `subtitle-${Date.now()}.srt`;
  }

  async function handleLocalPick(
    api: unknown,
    runtime: LaboratoryRuntimeRecord,
    requestId: string
  ) {
    const project = getActiveProject(runtime);
    const electronApi = getElectronApi();
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (electronApi === null) {
      throw new Error("File picker is unavailable.");
    }

    const subtitleSourcePresets = toRecord(runtime.subtitleSourcePresets);
    const dialogResult = await electronApi.showOpenDialog({
      properties: ["openFile"],
      filters: Array.isArray(subtitleSourcePresets["fileDialogFilters"])
        ? subtitleSourcePresets["fileDialogFilters"]
        : [],
    });

    const selectedPath = asNonEmptyString(toStringArray(dialogResult.filePaths)[0]);
    if (dialogResult.canceled === true || selectedPath === null) {
      return { cancelled: true };
    }

    const selectedName = selectedPath.split(/[\\/]/).pop() || selectedPath;
    if (isSubtitleFileName(runtime, selectedName) !== true) {
      throw new Error("Pick a supported subtitle file.");
    }

    const targetDir = getProjectSubtitleSourceDir(
      asProjectSubtitleSourceDirRuntime(runtime),
      asProjectSubtitleSourceDirProject(project)
    );
    const copyResult = await electronApi.copyFileTo(selectedPath, targetDir);
    const copiedPath = asNonEmptyString(copyResult.path);
    if (copyResult.success !== true || copiedPath === null) {
      throw new Error(
        (typeof copyResult.message === "string" && copyResult.message) ||
          (typeof copyResult.error === "string" && copyResult.error) ||
          "Copy failed."
      );
    }

    const subtitleEntry = createSubtitleEntryRecord(copiedPath, {
      fileName: asNonEmptyString(copyResult.name) || selectedName,
      sourceType: "local-file",
      sourceUrl: selectedPath,
    });
    await patchActiveProject(runtime, function (nextProject) {
      resetSubtitleDiscovery(runtime, nextProject);
      upsertSubtitleEntries(runtime, nextProject, [subtitleEntry], {
        mode: "local-file",
        activeEntryId: subtitleEntry.id,
        selectedEntryIds: [subtitleEntry.id],
        replaceExisting: false,
      });
      return nextProject;
    });
    void api;
    void requestId;
    return subtitleEntry;
  }

  async function handleFolderPick(
    api: unknown,
    runtime: LaboratoryRuntimeRecord,
    requestId: string
  ) {
    const project = getActiveProject(runtime);
    const electronApi = getElectronApi();
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (electronApi === null) {
      throw new Error("Folder picker is unavailable.");
    }

    const dialogResult = await electronApi.showOpenDialog({
      properties: ["openDirectory"],
    });
    const selectedDir = asNonEmptyString(toStringArray(dialogResult.filePaths)[0]);
    if (dialogResult.canceled === true || selectedDir === null) {
      return { cancelled: true };
    }

    const directoryEntries = await listSubtitleFilesInDirectory(runtime, selectedDir);
    if (directoryEntries.length === 0) {
      throw new Error("No supported subtitle files were found in the selected folder.");
    }

    const targetDir = getProjectSubtitleSourceDir(
      asProjectSubtitleSourceDirRuntime(runtime),
      asProjectSubtitleSourceDirProject(project)
    );
    const importedEntries: LaboratorySubtitleEntryRecord[] = [];
    const failedEntries: string[] = [];
    for (let index = 0; index < directoryEntries.length; index += 1) {
      const entry = directoryEntries.at(index);
      if (!entry) {
        continue;
      }
      // eslint-disable-next-line no-await-in-loop -- NOTE: keep folder imports ordered for stable failure reporting.
      const copyResult = await electronApi.copyFileTo(entry.path, targetDir);
      const copiedPath = asNonEmptyString(copyResult.path);
      if (copyResult.success !== true || copiedPath === null) {
        failedEntries.push(
          `${entry.name}: ${
            (typeof copyResult.message === "string" && copyResult.message) ||
            (typeof copyResult.error === "string" && copyResult.error) ||
            "Folder copy failed."
          }`
        );
        continue;
      }
      importedEntries.push(
        createSubtitleEntryRecord(copiedPath, {
          fileName: asNonEmptyString(copyResult.name) || entry.name,
          sourceType: "local-folder",
          sourceUrl: entry.path,
        })
      );
    }

    if (importedEntries.length === 0) {
      throw new Error(
        failedEntries[0] || "Folder import failed before any subtitle file could be copied."
      );
    }

    await patchActiveProject(runtime, function (nextProject) {
      resetSubtitleDiscovery(runtime, nextProject);
      upsertSubtitleEntries(runtime, nextProject, importedEntries, {
        mode: "local-folder",
        activeEntryId: importedEntries[0]?.id || null,
        selectedEntryIds: importedEntries
          .map(function (entry) {
            return asNonEmptyString(entry.id);
          })
          .filter((entry): entry is string => entry !== null),
        replaceExisting: false,
      });
      if (failedEntries.length > 0) {
        const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
        const workspace = toWorkspaceRecord(subtitleState.workspace);
        workspace.lastError = `Skipped ${failedEntries.length} subtitle file(s) during folder import.`;
        workspace.lastActionAt = new Date().toISOString();
        subtitleState.workspace = workspace;
        nextProject.subtitleAnalysis = subtitleState;
      }
      return nextProject;
    });
    void api;
    void requestId;
    return {
      count: importedEntries.length,
      failedCount: failedEntries.length,
    };
  }

  async function handleUrlDownload(
    api: unknown,
    runtime: LaboratoryRuntimeRecord,
    requestId: string
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const projectId = getProjectId(project);
    const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const drafts = toRecord(toWorkspaceRecord(subtitleState.workspace).drafts);
    const urlValue = asNonEmptyString(drafts["urlInput"]);
    if (urlValue === null) {
      throw new Error("Direct subtitle URL is empty.");
    }

    const fileName = getSubtitleUrlFileName(urlValue, drafts["fileNameHint"]);
    const jobId = `room-subtitle-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: "subtitle-source-download-url",
      projectId: projectId,
      featureStage: "source",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-download-url",
      projectId: projectId,
      featureStage: "source",
      stage: "queued",
    });

    try {
      const downloadResult = await callRoomTools({
        operation: "download-file",
        roomId: roomId,
        requestId: requestId,
        jobId: jobId,
        url: urlValue,
        destinationPath: `${getProjectSubtitleSourceDir(
          asProjectSubtitleSourceDirRuntime(runtime),
          asProjectSubtitleSourceDirProject(project)
        )}/${fileName}`,
        overwrite: false,
      });

      const downloaded = toRecord(downloadResult["download"]);
      const downloadedPath = asNonEmptyString(downloaded["path"]);
      if (downloadedPath === null) {
        throw new Error("Downloaded subtitle path is missing.");
      }

      const subtitleEntry = createSubtitleEntryRecord(downloadedPath, {
        fileName: asNonEmptyString(downloaded["fileName"]) || fileName,
        sourceType: "url",
        sourceUrl: urlValue,
        metadata: {
          mimeType: asNonEmptyString(downloaded["contentType"]) || getSubtitleMimeType(fileName),
        },
      });
      await patchActiveProject(runtime, function (nextProject) {
        resetSubtitleDiscovery(runtime, nextProject);
        upsertSubtitleEntries(runtime, nextProject, [subtitleEntry], {
          mode: "url",
          activeEntryId: subtitleEntry.id,
          selectedEntryIds: [subtitleEntry.id],
          replaceExisting: false,
        });
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "subtitle-source-download-url",
        projectId: projectId,
        featureStage: "source",
        stage: "completed",
        percent: 100,
      });
      return subtitleEntry;
    } catch (error) {
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "subtitle-source-download-url",
        projectId: projectId,
        featureStage: "source",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  return {
    handleFolderPick: handleFolderPick,
    handleLocalPick: handleLocalPick,
    handleUrlDownload: handleUrlDownload,
  };
}
