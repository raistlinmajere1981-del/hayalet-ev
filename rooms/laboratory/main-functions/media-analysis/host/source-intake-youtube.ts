export function createMediaYoutubeSourceIntakeRuntime(deps) {
  const {
    asNonEmptyString,
    callRoomTools,
    cancelJobsForProject,
    clearJob,
    getActiveProject,
    getPresetDefaultCustomValues,
    getProjectSourceDir,
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
    handleYoutubeDownload,
  };
}
