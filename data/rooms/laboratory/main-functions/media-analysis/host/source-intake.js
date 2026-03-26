export function createMediaSourceIntakeRuntime(deps) {
  const {
    asNonEmptyString,
    callRoomTools,
    cancelJobsForProject,
    clearJob,
    deriveFilename,
    getActiveProject,
    getElectronApi,
    getPresetDefaultCustomValues,
    getProjectSourceDir,
    getSourceConfig,
    normalizeMimeType,
    patchActiveProject,
    pushJobState,
    registerJob,
    resetEditForCurrentSource,
    resetProfileForCurrentSource,
    resolvePreparedSource,
    roomId,
    toRecord,
  } = deps;

  async function handleLocalPick(api, runtime, requestId) {
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

    if (!dialogResult || dialogResult.canceled === true || !Array.isArray(dialogResult.filePaths)) {
      return { cancelled: true };
    }

    const selectedPath = dialogResult.filePaths[0];
    if (typeof selectedPath !== "string" || selectedPath.trim() === "") {
      return { cancelled: true };
    }

    const sourceDir = getProjectSourceDir(runtime, project);
    const copyResult = await electronApi.copyFileTo(selectedPath, sourceDir);
    if (!copyResult || copyResult.success !== true) {
      throw new Error((copyResult && (copyResult.message || copyResult.error)) || "Copy failed.");
    }

    const storedPath = asNonEmptyString(copyResult.path);
    const storedFileName = asNonEmptyString(copyResult.name) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
    const preparedSource = await resolvePreparedSource(runtime, project, {
      requestId: requestId,
      storedPath: storedPath,
      storedFileName: storedFileName,
      mimeType: normalizeMimeType(storedFileName, project.source.kind),
    });

    await patchActiveProject(runtime, function (nextProject) {
      nextProject.source.mode = "local";
      nextProject.source.status = "ready";
      nextProject.source.storedPath = preparedSource.storedPath;
      nextProject.source.storedFileName = preparedSource.storedFileName;
      nextProject.source.mimeType = preparedSource.mimeType;
      nextProject.source.sourceUrl = selectedPath;
      nextProject.source.routeLabel = "Local copy";
      nextProject.source.lastError = null;
      nextProject.source.metadata = preparedSource.metadata;
      nextProject.source.metadataError = preparedSource.metadataError;
      resetEditForCurrentSource(runtime, nextProject);
      resetProfileForCurrentSource(runtime, nextProject, "Source media changed; rerun the profile preflight.");
      return nextProject;
    });

    return {
      storedPath: preparedSource.storedPath,
      storedFileName: preparedSource.storedFileName,
    };
  }

  async function handleUrlDownload(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const urlValue = asNonEmptyString(project.source.drafts.urlInput);
    if (urlValue === null) {
      throw new Error("Direct URL is empty.");
    }

    await cancelJobsForProject(runtime, project.id, requestId);

    const fileName = deriveFilename(urlValue, project.source.kind, project.source.drafts.fileNameHint);
    const jobId = `room-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: "source-download-url",
      projectId: project.id,
      featureStage: "source",
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-url",
      projectId: project.id,
      stage: "queued",
    });

    try {
      const downloadResult = await callRoomTools({
        operation: "download-file",
        roomId: roomId,
        requestId: requestId,
        jobId: jobId,
        url: urlValue,
        destinationPath: `${getProjectSourceDir(runtime, project)}/${fileName}`,
        overwrite: false,
      });

      const downloaded = toRecord(downloadResult.download);
      const storedPath = asNonEmptyString(downloaded.path);
      const storedFileName = asNonEmptyString(downloaded.fileName) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
      const preparedSource = await resolvePreparedSource(runtime, project, {
        requestId: requestId,
        jobId: jobId,
        storedPath: storedPath,
        storedFileName: storedFileName,
        mimeType: asNonEmptyString(downloaded.contentType) || normalizeMimeType(storedFileName, project.source.kind),
      });

      await patchActiveProject(runtime, function (nextProject) {
        if (nextProject.id !== project.id) {
          return nextProject;
        }
        nextProject.source.mode = "url";
        nextProject.source.status = "ready";
        nextProject.source.storedPath = preparedSource.storedPath;
        nextProject.source.storedFileName = preparedSource.storedFileName;
        nextProject.source.sourceUrl = urlValue;
        nextProject.source.mimeType = preparedSource.mimeType;
        nextProject.source.routeLabel = "Direct URL";
        nextProject.source.lastError = null;
        nextProject.source.metadata = preparedSource.metadata;
        nextProject.source.metadataError = preparedSource.metadataError;
        resetEditForCurrentSource(runtime, nextProject);
        resetProfileForCurrentSource(runtime, nextProject, "Source media changed; rerun the profile preflight.");
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "source-download-url",
        projectId: project.id,
        stage: "completed",
        percent: 100,
      });

      return {
        storedPath: preparedSource.storedPath,
        storedFileName: preparedSource.storedFileName,
      };
    } catch (error) {
      await patchActiveProject(runtime, function (nextProject) {
        if (nextProject.id !== project.id) {
          return nextProject;
        }
        nextProject.source.status = "error";
        nextProject.source.lastError = error instanceof Error ? error.message : String(error);
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "source-download-url",
        projectId: project.id,
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  function getResolvedYoutubeSettings(project, sourcePresets) {
    const presetId = asNonEmptyString(project.source.drafts.youtubePreset) || "medium";
    const presetDefaults = getPresetDefaultCustomValues(sourcePresets, presetId);
    if (presetId === "custom") {
      return {
        presetId: presetId,
        values: {
          ...presetDefaults,
          ...toRecord(project.source.drafts.youtubeCustom),
        },
      };
    }
    return {
      presetId: presetId,
      values: presetDefaults,
    };
  }

  function findYtDlpFinalPath(stdoutValue) {
    const lines = String(stdoutValue || "")
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (/^[A-Za-z]:\\/.test(line) || line.startsWith("/")) {
        return line;
      }
    }

    return null;
  }

  function buildYtDlpArgs(project, toolState, sourceDir) {
    const settings = getResolvedYoutubeSettings(project, toolState.sourcePresets || {});
    const values = settings.values;
    const args = [
      "--newline",
      "--progress",
      "--print",
      "after_move:filepath",
      "-o",
      `${sourceDir}/%(title).120B-%(id)s.%(ext)s`,
    ];

    let formatValue = asNonEmptyString(values.format) || "best";
    if (formatValue.indexOf("+") >= 0 && (!toolState.ffmpeg || toolState.ffmpeg.installed !== true)) {
      formatValue = "best";
    }

    args.push("-f", formatValue);

    const mergeOutputFormat = asNonEmptyString(values.mergeOutputFormat);
    if (mergeOutputFormat && mergeOutputFormat !== "auto") {
      args.push("--merge-output-format", mergeOutputFormat);
    }

    const recodeVideo = asNonEmptyString(values.recodeVideo);
    if (recodeVideo && recodeVideo !== "none") {
      args.push("--recode-video", recodeVideo);
    }

    const audioFormat = asNonEmptyString(values.audioFormat);
    if (audioFormat && audioFormat !== "none") {
      args.push("-x", "--audio-format", audioFormat);
    }

    if (values.writeSubtitles === true) {
      args.push("--write-subs");
    }
    if (values.writeAutoSubtitles === true) {
      args.push("--write-auto-subs");
    }

    const subtitlesLang = asNonEmptyString(values.subtitlesLang);
    if (subtitlesLang) {
      args.push("--sub-langs", subtitlesLang);
    } else if (values.writeSubtitles === true || values.writeAutoSubtitles === true) {
      args.push("--sub-langs", "all");
    }

    const playlistItems = asNonEmptyString(values.playlistItems);
    if (playlistItems) {
      args.push("--playlist-items", playlistItems);
    } else {
      args.push("--no-playlist");
    }

    const limitRate = asNonEmptyString(values.limitRate);
    if (limitRate) {
      args.push("--limit-rate", limitRate);
    }

    const retries = Number(values.retries);
    if (Number.isFinite(retries) && retries > 0) {
      args.push("--retries", String(retries));
    }

    if (
      toolState.ffmpeg &&
      toolState.ffmpeg.installed === true &&
      typeof toolState.ffmpeg.binaryPath === "string" &&
      toolState.ffmpeg.binaryPath.trim() !== ""
    ) {
      const binaryPath = toolState.ffmpeg.binaryPath.replace(/\\/g, "/");
      const separatorIndex = binaryPath.lastIndexOf("/");
      const ffmpegDir = separatorIndex >= 0 ? binaryPath.slice(0, separatorIndex) : binaryPath;
      args.push("--ffmpeg-location", ffmpegDir);
    }

    args.push(project.source.drafts.youtubeUrl);
    return args;
  }

  async function handleYoutubeDownload(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const ytDlpState = toRecord(runtime.toolState.tools["yt-dlp"]);
    if (ytDlpState.installed !== true) {
      throw new Error("yt-dlp is not installed.");
    }

    const youtubeUrl = asNonEmptyString(project.source.drafts.youtubeUrl);
    if (youtubeUrl === null) {
      throw new Error("YouTube URL is empty.");
    }

    await cancelJobsForProject(runtime, project.id, requestId);

    const jobId = `room-youtube-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: "source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      featureStage: "source",
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: "source-download-youtube",
      projectId: project.id,
      toolId: "yt-dlp",
      stage: "queued",
    });

    try {
      const runResult = await callRoomTools({
        operation: "tool-run",
        roomId: roomId,
        requestId: requestId,
        jobId: jobId,
        toolId: "yt-dlp",
        cwd: getProjectSourceDir(runtime, project),
        args: buildYtDlpArgs(
          project,
          {
            sourcePresets: runtime.sourcePresets,
            ffmpeg: runtime.toolState.tools.ffmpeg,
          },
          getProjectSourceDir(runtime, project)
        ),
        timeoutMs: 45 * 60 * 1000,
      });

      const runPayload = toRecord(runResult.run);
      const storedPath = findYtDlpFinalPath(runPayload.stdout);
      const storedFileName = storedPath ? storedPath.split(/[\\/]/).pop() : null;

      if (!storedPath) {
        throw new Error("yt-dlp finished without a final output path.");
      }

      const preparedSource = await resolvePreparedSource(runtime, project, {
        requestId: requestId,
        jobId: jobId,
        storedPath: storedPath,
        storedFileName: storedFileName,
        mimeType: normalizeMimeType(storedFileName, project.source.kind),
      });

      await patchActiveProject(runtime, function (nextProject) {
        if (nextProject.id !== project.id) {
          return nextProject;
        }
        nextProject.source.mode = "youtube";
        nextProject.source.status = "ready";
        nextProject.source.storedPath = preparedSource.storedPath;
        nextProject.source.storedFileName = preparedSource.storedFileName;
        nextProject.source.sourceUrl = youtubeUrl;
        nextProject.source.mimeType = preparedSource.mimeType;
        nextProject.source.routeLabel = "YouTube";
        nextProject.source.lastError = null;
        nextProject.source.metadata = preparedSource.metadata;
        nextProject.source.metadataError = preparedSource.metadataError;
        resetEditForCurrentSource(runtime, nextProject);
        resetProfileForCurrentSource(runtime, nextProject, "Source media changed; rerun the profile preflight.");
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "source-download-youtube",
        projectId: project.id,
        toolId: "yt-dlp",
        stage: "completed",
        percent: 100,
      });

      return {
        storedPath: preparedSource.storedPath,
        storedFileName: preparedSource.storedFileName,
      };
    } catch (error) {
      await patchActiveProject(runtime, function (nextProject) {
        if (nextProject.id !== project.id) {
          return nextProject;
        }
        nextProject.source.status = "error";
        nextProject.source.lastError = error instanceof Error ? error.message : String(error);
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: "source-download-youtube",
        projectId: project.id,
        toolId: "yt-dlp",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    buildYtDlpArgs,
    findYtDlpFinalPath,
    getResolvedYoutubeSettings,
    handleLocalPick,
    handleUrlDownload,
    handleYoutubeDownload,
  };
}
