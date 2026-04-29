type LaboratoryRecord = Record<string, unknown>;

type LaboratoryMediaYoutubeRuntime = LaboratoryRecord & {
  sourcePresets?: unknown;
  toolState?: unknown;
};

type LaboratoryProjectRecord = LaboratoryRecord & {
  id?: unknown;
  source?: unknown;
};

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  drafts?: unknown;
  kind?: unknown;
};

type LaboratorySourceDraftsRecord = LaboratoryRecord & {
  youtubeCaptureMode?: unknown;
  youtubeCustom?: unknown;
  youtubePreset?: unknown;
  youtubeUrl?: unknown;
};

type LaboratoryToolRecord = LaboratoryRecord & {
  binaryPath?: unknown;
  installed?: unknown;
};

type LaboratoryToolStateRecord = {
  ffmpeg: LaboratoryToolRecord;
  sourcePresets: LaboratoryRecord;
};

type LaboratoryPreparedSource = {
  metadata: unknown;
  metadataError: string | null;
  mimeType: string | null;
  storedFileName: string | null;
  storedPath: string | null;
};

type LaboratoryYoutubeSettings = {
  presetId: string;
  values: LaboratoryRecord;
};

type LaboratoryMediaYoutubeSourceIntakeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  cancelJobsForProject: (
    runtime: LaboratoryMediaYoutubeRuntime,
    projectId: string,
    requestId: string
  ) => Promise<unknown>;
  clearJob: (runtime: LaboratoryMediaYoutubeRuntime, jobId: string) => void;
  getActiveProject: (runtime: LaboratoryMediaYoutubeRuntime) => LaboratoryProjectRecord | null;
  getPresetDefaultCustomValues: (sourcePresets: unknown, presetId: string) => LaboratoryRecord;
  getProjectSourceDir: (
    runtime: LaboratoryMediaYoutubeRuntime,
    project: LaboratoryProjectRecord
  ) => string;
  normalizeMimeType: (fileName: unknown, kind: string) => string;
  patchActiveProject: (
    runtime: LaboratoryMediaYoutubeRuntime,
    updater: (project: LaboratoryProjectRecord) => LaboratoryProjectRecord
  ) => Promise<unknown>;
  pushJobState: (api: unknown, payload: LaboratoryRecord) => void;
  registerJob: (runtime: LaboratoryMediaYoutubeRuntime, payload: LaboratoryRecord) => void;
  resetEditForCurrentSource: (
    runtime: LaboratoryMediaYoutubeRuntime,
    project: LaboratoryProjectRecord
  ) => void;
  resetProfileForCurrentSource: (
    runtime: LaboratoryMediaYoutubeRuntime,
    project: LaboratoryProjectRecord,
    reason: string
  ) => void;
  resolvePreparedSource: (
    runtime: LaboratoryMediaYoutubeRuntime,
    project: LaboratoryProjectRecord,
    options: LaboratoryRecord
  ) => Promise<LaboratoryPreparedSource>;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createMediaYoutubeSourceIntakeRuntime(
  deps: LaboratoryMediaYoutubeSourceIntakeDeps
) {
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

  function toProjectSourceRecord(value: unknown): LaboratoryProjectSourceRecord {
    return toRecord(value);
  }

  function toSourceDraftsRecord(value: unknown): LaboratorySourceDraftsRecord {
    return toRecord(value);
  }

  function toToolRecord(value: unknown): LaboratoryToolRecord {
    return toRecord(value);
  }

  function toString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }

  function getProjectId(project: LaboratoryProjectRecord): string {
    return toString(project.id) || "unknown-project";
  }

  function getProjectSource(project: LaboratoryProjectRecord): LaboratoryProjectSourceRecord {
    return toProjectSourceRecord(project.source);
  }

  function getSourceDrafts(project: LaboratoryProjectRecord): LaboratorySourceDraftsRecord {
    return toSourceDraftsRecord(getProjectSource(project).drafts);
  }

  function getToolMap(
    runtime: LaboratoryMediaYoutubeRuntime
  ): Record<string, LaboratoryToolRecord> {
    return toRecord(toRecord(runtime.toolState)["tools"]) as Record<string, LaboratoryToolRecord>;
  }

  function getYoutubeToolState(runtime: LaboratoryMediaYoutubeRuntime): LaboratoryToolRecord {
    return toToolRecord(getToolMap(runtime)["yt-dlp"]);
  }

  function getFfmpegToolState(runtime: LaboratoryMediaYoutubeRuntime): LaboratoryToolRecord {
    return toToolRecord(getToolMap(runtime)["ffmpeg"]);
  }

  function getResolvedYoutubeSettings(
    project: LaboratoryProjectRecord,
    sourcePresets: unknown
  ): LaboratoryYoutubeSettings {
    const drafts = getSourceDrafts(project);
    const presetId = asNonEmptyString(drafts["youtubePreset"]) || "medium";
    const presetDefaults = getPresetDefaultCustomValues(sourcePresets, presetId);
    if (presetId === "custom") {
      return {
        presetId: presetId,
        values: {
          ...presetDefaults,
          ...toRecord(drafts["youtubeCustom"]),
        },
      };
    }
    return {
      presetId: presetId,
      values: presetDefaults,
    };
  }

  function findYtDlpFinalPath(stdoutValue: unknown) {
    const lines = String(stdoutValue || "")
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);

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

  function buildYtDlpArgs(
    project: LaboratoryProjectRecord,
    toolState: LaboratoryToolStateRecord,
    sourceDir: string
  ) {
    const settings = getResolvedYoutubeSettings(project, toolState.sourcePresets);
    const values = settings.values;
    const drafts = getSourceDrafts(project);
    const youtubeUrl = asNonEmptyString(drafts["youtubeUrl"]);
    const captureMode = asNonEmptyString(drafts["youtubeCaptureMode"]) || "video+audio";
    const isAudioOnly = captureMode === "audio-only";
    const isVideoOnly = captureMode === "video-only";
    const args = [
      "--newline",
      "--progress",
      "--print",
      "after_move:filepath",
      "-o",
      `${sourceDir}/%(title).120B-%(id)s.%(ext)s`,
    ];

    if (isAudioOnly) {
      args.push("-x");
      const audioFormat = asNonEmptyString(values["audioFormat"]);
      if (audioFormat && audioFormat !== "none") {
        args.push("--audio-format", audioFormat);
      } else {
        args.push("--audio-format", "best");
      }
      const audioQuality = asNonEmptyString(values["audioQuality"]);
      if (audioQuality && audioQuality !== "best") {
        args.push("--audio-quality", audioQuality);
      }
    } else if (isVideoOnly) {
      args.push("-f", "bestvideo");
      const mergeOutputFormat = asNonEmptyString(values["mergeOutputFormat"]);
      if (mergeOutputFormat && mergeOutputFormat !== "auto") {
        args.push("--merge-output-format", mergeOutputFormat);
      }
      const recodeVideo = asNonEmptyString(values["recodeVideo"]);
      if (recodeVideo && recodeVideo !== "none") {
        args.push("--recode-video", recodeVideo);
      }
    } else {
      let formatValue = asNonEmptyString(values["format"]) || "bestvideo*+bestaudio/best";
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
        const audioQuality = asNonEmptyString(values["audioQuality"]);
        if (audioQuality && audioQuality !== "best") {
          args.push("--audio-quality", audioQuality);
        }
      }
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

    if (
      toolState.ffmpeg.installed === true &&
      typeof toolState.ffmpeg.binaryPath === "string" &&
      toolState.ffmpeg.binaryPath.trim() !== ""
    ) {
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

  async function handleYoutubeDownload(
    api: unknown,
    runtime: LaboratoryMediaYoutubeRuntime,
    requestId: string
  ) {
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
    const captureMode = asNonEmptyString(drafts.youtubeCaptureMode) || "video+audio";
    const draftKind = asNonEmptyString(drafts["kind"]);
    const derivedSourceKind =
      captureMode === "audio-only"
        ? "audio"
        : draftKind === "video" || draftKind === "audio" || draftKind === "image"
          ? draftKind
          : toString(source["kind"]) || "video";

    await cancelJobsForProject(runtime, projectId, requestId);

    const jobId = `room-youtube-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "source-download-youtube",
      featureStage: "source",
      jobId: jobId,
      projectId: projectId,
      requestId: requestId,
      toolId: "yt-dlp",
    });

    pushJobState(api, {
      action: "source-download-youtube",
      featureStage: "source",
      jobId: jobId,
      projectId: projectId,
      requestId: requestId,
      stage: "queued",
      toolId: "yt-dlp",
    });

    try {
      const sourceDir = getProjectSourceDir(runtime, project);
      const runResult = await callRoomTools({
        args: buildYtDlpArgs(
          project,
          {
            ffmpeg: getFfmpegToolState(runtime),
            sourcePresets: toRecord(runtime.sourcePresets),
          },
          sourceDir
        ),
        cwd: sourceDir,
        jobId: jobId,
        operation: "tool-run",
        requestId: requestId,
        roomId: roomId,
        timeoutMs: 45 * 60 * 1000,
        toolId: "yt-dlp",
      });

      const runPayload = toRecord(toRecord(runResult)["run"]);
      const storedPath = findYtDlpFinalPath(runPayload["stdout"]);
      const storedFileName = storedPath ? storedPath.split(/[\\/]/).pop() || null : null;
      if (!storedPath) {
        throw new Error("yt-dlp finished without a final output path.");
      }

      const preparedSource = await resolvePreparedSource(runtime, project, {
        jobId: jobId,
        mimeType: normalizeMimeType(storedFileName, derivedSourceKind),
        requestId: requestId,
        storedFileName: storedFileName,
        storedPath: storedPath,
      });

      await patchActiveProject(runtime, function (nextProject) {
        if (toString(nextProject.id) !== projectId) {
          return nextProject;
        }
        const nextSource = toProjectSourceRecord(nextProject.source);
        nextProject.source = nextSource;
        nextSource["kind"] = derivedSourceKind;
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
        jobId: jobId,
        percent: 100,
        projectId: projectId,
        requestId: requestId,
        stage: "completed",
        toolId: "yt-dlp",
      });

      return {
        storedFileName: preparedSource.storedFileName,
        storedPath: preparedSource.storedPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await patchActiveProject(runtime, function (nextProject) {
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
        jobId: jobId,
        message: errorMessage,
        projectId: projectId,
        requestId: requestId,
        stage: "failed",
        toolId: "yt-dlp",
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
