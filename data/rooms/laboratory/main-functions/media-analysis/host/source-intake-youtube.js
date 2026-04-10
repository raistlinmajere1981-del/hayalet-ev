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
    toRecord
  } = deps;
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toSourceDraftsRecord(value) {
    return toRecord(value);
  }
  function toToolRecord(value) {
    return toRecord(value);
  }
  function toString(value) {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  function getProjectId(project) {
    return toString(project.id) || "unknown-project";
  }
  function getProjectSource(project) {
    return toProjectSourceRecord(project.source);
  }
  function getSourceDrafts(project) {
    return toSourceDraftsRecord(getProjectSource(project).drafts);
  }
  function getToolMap(runtime) {
    return toRecord(toRecord(runtime.toolState)["tools"]);
  }
  function getYoutubeToolState(runtime) {
    return toToolRecord(getToolMap(runtime)["yt-dlp"]);
  }
  function getFfmpegToolState(runtime) {
    return toToolRecord(getToolMap(runtime)["ffmpeg"]);
  }
  function getResolvedYoutubeSettings(project, sourcePresets) {
    const drafts = getSourceDrafts(project);
    const presetId = asNonEmptyString(drafts["youtubePreset"]) || "medium";
    const presetDefaults = getPresetDefaultCustomValues(sourcePresets, presetId);
    if (presetId === "custom") {
      return {
        presetId,
        values: {
          ...presetDefaults,
          ...toRecord(drafts["youtubeCustom"])
        }
      };
    }
    return {
      presetId,
      values: presetDefaults
    };
  }
  function findYtDlpFinalPath(stdoutValue) {
    const lines = String(stdoutValue || "").split(/\r?\n/).map(function(line) {
      return line.trim();
    }).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (!line) {
        continue;
      }
      if (/^[A-Za-z]:\\/.test(line) || line.startsWith("/")) {
        return line;
      }
    }
    return null;
  }
  function buildYtDlpArgs(project, toolState, sourceDir) {
    const settings = getResolvedYoutubeSettings(project, toolState.sourcePresets);
    const values = settings.values;
    const youtubeUrl = asNonEmptyString(getSourceDrafts(project)["youtubeUrl"]);
    const args = [
      "--newline",
      "--progress",
      "--print",
      "after_move:filepath",
      "-o",
      `${sourceDir}/%(title).120B-%(id)s.%(ext)s`
    ];
    let formatValue = asNonEmptyString(values["format"]) || "best";
    if (formatValue.indexOf("+") >= 0 && toolState.ffmpeg.installed !== true) {
      formatValue = "best";
    }
    args.push("-f", formatValue);
    const mergeOutputFormat = asNonEmptyString(values["mergeOutputFormat"]);
    if (mergeOutputFormat && mergeOutputFormat !== "auto") {
      args.push("--merge-output-format", mergeOutputFormat);
    }
    const recodeVideo = asNonEmptyString(values["recodeVideo"]);
    if (recodeVideo && recodeVideo !== "none") {
      args.push("--recode-video", recodeVideo);
    }
    const audioFormat = asNonEmptyString(values["audioFormat"]);
    if (audioFormat && audioFormat !== "none") {
      args.push("-x", "--audio-format", audioFormat);
    }
    if (values["writeSubtitles"] === true) {
      args.push("--write-subs");
    }
    if (values["writeAutoSubtitles"] === true) {
      args.push("--write-auto-subs");
    }
    const subtitlesLang = asNonEmptyString(values["subtitlesLang"]);
    if (subtitlesLang) {
      args.push("--sub-langs", subtitlesLang);
    } else if (values["writeSubtitles"] === true || values["writeAutoSubtitles"] === true) {
      args.push("--sub-langs", "all");
    }
    const playlistItems = asNonEmptyString(values["playlistItems"]);
    if (playlistItems) {
      args.push("--playlist-items", playlistItems);
    } else {
      args.push("--no-playlist");
    }
    const limitRate = asNonEmptyString(values["limitRate"]);
    if (limitRate) {
      args.push("--limit-rate", limitRate);
    }
    const retries = Number(values["retries"]);
    if (Number.isFinite(retries) && retries > 0) {
      args.push("--retries", String(retries));
    }
    if (toolState.ffmpeg.installed === true && typeof toolState.ffmpeg.binaryPath === "string" && toolState.ffmpeg.binaryPath.trim() !== "") {
      const binaryPath = toolState.ffmpeg.binaryPath.replace(/\\/g, "/");
      const separatorIndex = binaryPath.lastIndexOf("/");
      const ffmpegDir = separatorIndex >= 0 ? binaryPath.slice(0, separatorIndex) : binaryPath;
      args.push("--ffmpeg-location", ffmpegDir);
    }
    if (youtubeUrl !== null) {
      args.push(youtubeUrl);
    }
    return args;
  }
  async function handleYoutubeDownload(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const projectId = getProjectId(project);
    const ytDlpState = getYoutubeToolState(runtime);
    if (ytDlpState.installed !== true) {
      throw new Error("yt-dlp is not installed.");
    }
    const source = getProjectSource(project);
    const drafts = toSourceDraftsRecord(source.drafts);
    const youtubeUrl = asNonEmptyString(drafts.youtubeUrl);
    if (youtubeUrl === null) {
      throw new Error("YouTube URL is empty.");
    }
    await cancelJobsForProject(runtime, projectId, requestId);
    const jobId = `room-youtube-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "source-download-youtube",
      featureStage: "source",
      jobId,
      projectId,
      requestId,
      toolId: "yt-dlp"
    });
    pushJobState(api, {
      action: "source-download-youtube",
      featureStage: "source",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "yt-dlp"
    });
    try {
      const sourceDir = getProjectSourceDir(runtime, project);
      const runResult = await callRoomTools({
        args: buildYtDlpArgs(
          project,
          {
            ffmpeg: getFfmpegToolState(runtime),
            sourcePresets: toRecord(runtime.sourcePresets)
          },
          sourceDir
        ),
        cwd: sourceDir,
        jobId,
        operation: "tool-run",
        requestId,
        roomId,
        timeoutMs: 45 * 60 * 1e3,
        toolId: "yt-dlp"
      });
      const runPayload = toRecord(toRecord(runResult)["run"]);
      const storedPath = findYtDlpFinalPath(runPayload["stdout"]);
      const storedFileName = storedPath ? storedPath.split(/[\\/]/).pop() || null : null;
      if (!storedPath) {
        throw new Error("yt-dlp finished without a final output path.");
      }
      const preparedSource = await resolvePreparedSource(runtime, project, {
        jobId,
        mimeType: normalizeMimeType(storedFileName, toString(source["kind"]) || "video"),
        requestId,
        storedFileName,
        storedPath
      });
      await patchActiveProject(runtime, function(nextProject) {
        if (toString(nextProject.id) !== projectId) {
          return nextProject;
        }
        const nextSource = toProjectSourceRecord(nextProject.source);
        nextProject.source = nextSource;
        nextSource["mode"] = "youtube";
        nextSource["status"] = "ready";
        nextSource["storedPath"] = preparedSource.storedPath;
        nextSource["storedFileName"] = preparedSource.storedFileName;
        nextSource["sourceUrl"] = youtubeUrl;
        nextSource["mimeType"] = preparedSource.mimeType;
        nextSource["routeLabel"] = "YouTube";
        nextSource["lastError"] = null;
        nextSource["metadata"] = preparedSource.metadata;
        nextSource["metadataError"] = preparedSource.metadataError;
        resetEditForCurrentSource(runtime, nextProject);
        resetProfileForCurrentSource(
          runtime,
          nextProject,
          "Source media changed; rerun the profile preflight."
        );
        return nextProject;
      });
      pushJobState(api, {
        action: "source-download-youtube",
        jobId,
        percent: 100,
        projectId,
        requestId,
        stage: "completed",
        toolId: "yt-dlp"
      });
      return {
        storedFileName: preparedSource.storedFileName,
        storedPath: preparedSource.storedPath
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await patchActiveProject(runtime, function(nextProject) {
        if (toString(nextProject.id) !== projectId) {
          return nextProject;
        }
        const nextSource = toProjectSourceRecord(nextProject.source);
        nextProject.source = nextSource;
        nextSource["status"] = "error";
        nextSource["lastError"] = errorMessage;
        return nextProject;
      });
      pushJobState(api, {
        action: "source-download-youtube",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "yt-dlp"
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
    handleYoutubeDownload
  };
}
