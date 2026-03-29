// @ts-nocheck
import { getProjectSubtitleSourceDir } from "../../../shared/host/project-paths.js";

export function createSubtitleSourceIntakeRuntime(deps) {
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

  function getSubtitleUrlFileName(urlValue, hintValue) {
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

  async function handleLocalPick(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    const electronApi = getElectronApi();
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (electronApi === null || typeof electronApi.showOpenDialog !== "function") {
      throw new Error("File picker is unavailable.");
    }

    const dialogResult = await electronApi.showOpenDialog({
      properties: ["openFile"],
      filters: Array.isArray(toRecord(runtime.subtitleSourcePresets).fileDialogFilters)
        ? runtime.subtitleSourcePresets.fileDialogFilters
        : [],
    });

    if (!dialogResult || dialogResult.canceled === true || !Array.isArray(dialogResult.filePaths)) {
      return { cancelled: true };
    }

    const selectedPath = asNonEmptyString(dialogResult.filePaths[0]);
    if (selectedPath === null) {
      return { cancelled: true };
    }

    const selectedName = selectedPath.split(/[\\/]/).pop() || selectedPath;
    if (isSubtitleFileName(runtime, selectedName) !== true) {
      throw new Error("Pick a supported subtitle file.");
    }

    const targetDir = getProjectSubtitleSourceDir(runtime, project);
    const copyResult = await electronApi.copyFileTo(selectedPath, targetDir);
    if (!copyResult || copyResult.success !== true) {
      throw new Error((copyResult && (copyResult.message || copyResult.error)) || "Copy failed.");
    }

    const subtitleEntry = createSubtitleEntryRecord(asNonEmptyString(copyResult.path), {
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

  async function handleFolderPick(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    const electronApi = getElectronApi();
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    if (electronApi === null || typeof electronApi.showOpenDialog !== "function") {
      throw new Error("Folder picker is unavailable.");
    }

    const dialogResult = await electronApi.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (!dialogResult || dialogResult.canceled === true || !Array.isArray(dialogResult.filePaths)) {
      return { cancelled: true };
    }

    const selectedDir = asNonEmptyString(dialogResult.filePaths[0]);
    if (selectedDir === null) {
      return { cancelled: true };
    }

    const directoryEntries = await listSubtitleFilesInDirectory(runtime, selectedDir);
    if (directoryEntries.length === 0) {
      throw new Error("No supported subtitle files were found in the selected folder.");
    }

    const targetDir = getProjectSubtitleSourceDir(runtime, project);
    const importedEntries = [];
    const failedEntries = [];
    for (let index = 0; index < directoryEntries.length; index += 1) {
      const entry = directoryEntries[index];
      const copyResult = await electronApi.copyFileTo(entry.path, targetDir);
      if (!copyResult || copyResult.success !== true) {
        failedEntries.push(
          `${entry.name}: ${(copyResult && (copyResult.message || copyResult.error)) || "Folder copy failed."}`
        );
        continue;
      }
      importedEntries.push(
        createSubtitleEntryRecord(asNonEmptyString(copyResult.path), {
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
        activeEntryId: importedEntries[0] ? importedEntries[0].id : null,
        selectedEntryIds: importedEntries.map(function (entry) {
          return entry.id;
        }),
        replaceExisting: false,
      });
      if (failedEntries.length > 0) {
        const subtitleState = normalizeSubtitleAnalysisState(nextProject.subtitleAnalysis, runtime);
        subtitleState.workspace.lastError = `Skipped ${failedEntries.length} subtitle file(s) during folder import.`;
        subtitleState.workspace.lastActionAt = new Date().toISOString();
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

  async function handleUrlDownload(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const drafts = toRecord(toRecord(subtitleState.workspace).drafts);
    const urlValue = asNonEmptyString(drafts.urlInput);
    if (urlValue === null) {
      throw new Error("Direct subtitle URL is empty.");
    }

    const fileName = getSubtitleUrlFileName(urlValue, drafts.fileNameHint);
    const jobId = `room-subtitle-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: "subtitle-source-download-url",
      projectId: project.id,
      featureStage: "source",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "subtitle-source-download-url",
      projectId: project.id,
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
        destinationPath: `${getProjectSubtitleSourceDir(runtime, project)}/${fileName}`,
        overwrite: false,
      });

      const downloaded = toRecord(downloadResult.download);
      const subtitleEntry = createSubtitleEntryRecord(asNonEmptyString(downloaded.path), {
        fileName: asNonEmptyString(downloaded.fileName) || fileName,
        sourceType: "url",
        sourceUrl: urlValue,
        metadata: {
          mimeType: asNonEmptyString(downloaded.contentType) || getSubtitleMimeType(fileName),
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
        projectId: project.id,
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
        projectId: project.id,
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
