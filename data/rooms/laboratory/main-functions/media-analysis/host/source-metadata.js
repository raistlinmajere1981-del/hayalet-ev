export function createMediaSourceMetadataRuntime(deps) {
  const {
    asNumber,
    asNonEmptyString,
    callRoomTools,
    ensureProjectDirectories,
    findCompanionExecutableName,
    getActiveProject,
    getProjectEditDir,
    getProjectSourceDir,
    normalizeSourceMetadata,
    patchActiveProject,
    roomId,
    stripMimeParameters,
    toRecord,
    validateSourceCandidate
  } = deps;
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toToolRecord(value) {
    return toRecord(value);
  }
  function getToolMap(runtime) {
    return toRecord(toRecord(runtime.toolState)["tools"]);
  }
  function getSourceRecord(project) {
    return toProjectSourceRecord(project.source);
  }
  function getSourceKind(project) {
    return asNonEmptyString(getSourceRecord(project).kind) || "video";
  }
  function buildFallbackMetadata(mimeType) {
    const normalizedMimeType = stripMimeParameters(mimeType);
    return normalizeSourceMetadata({
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      extractedBy: "host-fallback",
      formatName: normalizedMimeType,
      mimeType: normalizedMimeType
    });
  }
  function parseFfprobeMetadata(stdout, kind, mimeType) {
    const parsedPayload = JSON.parse(stdout);
    const payload = toRecord(parsedPayload);
    const format = toRecord(payload["format"]);
    const streams = Array.isArray(payload["streams"]) ? payload["streams"].map(function(entry) {
      return toRecord(entry);
    }) : [];
    const emptyStream = {};
    const videoStream = streams.find(function(stream) {
      return asNonEmptyString(stream["codec_type"]) === "video";
    }) || streams.find(function(stream) {
      return asNumber(stream["width"]) !== null || asNumber(stream["height"]) !== null;
    }) || emptyStream;
    const audioStream = streams.find(function(stream) {
      return asNonEmptyString(stream["codec_type"]) === "audio";
    }) || emptyStream;
    const durationSeconds = asNumber(format["duration"]) || asNumber(videoStream["duration"]) || asNumber(audioStream["duration"]);
    const videoCodec = asNonEmptyString(videoStream["codec_name"]);
    const audioCodec = asNonEmptyString(audioStream["codec_name"]);
    let codec = videoCodec || audioCodec;
    if (kind === "audio") {
      codec = audioCodec;
    } else if (kind === "video" && videoCodec && audioCodec) {
      codec = `${videoCodec} + ${audioCodec}`;
    }
    return normalizeSourceMetadata({
      audioCodec,
      bitRate: asNumber(format["bit_rate"]) || asNumber(audioStream["bit_rate"]) || asNumber(videoStream["bit_rate"]),
      codec,
      durationSeconds,
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      extractedBy: "ffprobe",
      formatName: asNonEmptyString(format["format_long_name"]) || asNonEmptyString(format["format_name"]),
      height: asNumber(videoStream["height"]),
      mimeType: stripMimeParameters(mimeType),
      sizeBytes: asNumber(format["size"]),
      streamCount: streams.length,
      videoCodec,
      width: asNumber(videoStream["width"])
    });
  }
  async function deleteOwnedSourceFile(filePath, requestId) {
    const targetPath = asNonEmptyString(filePath);
    if (targetPath === null) {
      return;
    }
    try {
      await callRoomTools({
        operation: "delete-path",
        recursive: false,
        requestId: requestId || null,
        roomId,
        targetPath
      });
    } catch (_error) {
    }
  }
  async function collectStoredSourceMetadata(runtime, project, options) {
    const ffmpegState = toToolRecord(getToolMap(runtime)["ffmpeg"]);
    if (ffmpegState.installed !== true) {
      return {
        metadata: buildFallbackMetadata(options.mimeType),
        metadataError: null
      };
    }
    const executableName = findCompanionExecutableName(ffmpegState, "ffprobe");
    if (executableName === null) {
      return {
        metadata: buildFallbackMetadata(options.mimeType),
        metadataError: null
      };
    }
    try {
      await ensureProjectDirectories(runtime, project, options.requestId || null);
      const runResult = await callRoomTools({
        args: [
          "-v",
          "quiet",
          "-print_format",
          "json",
          "-show_format",
          "-show_streams",
          options.storedPath
        ],
        cwd: getProjectSourceDir(runtime, project),
        executableName,
        jobId: options.jobId || null,
        operation: "tool-run",
        requestId: options.requestId || null,
        roomId,
        timeoutMs: 15e3,
        toolId: "ffmpeg"
      });
      const runPayload = toRecord(toRecord(runResult)["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" && Number.isFinite(runPayload["exitCode"]) ? runPayload["exitCode"] : 0;
      const stdout = asNonEmptyString(runPayload["stdout"]);
      if (runPayload["cancelled"] === true || exitCode !== 0 || stdout === null) {
        throw new Error(
          asNonEmptyString(runPayload["stderr"]) || "ffprobe did not return structured metadata."
        );
      }
      return {
        metadata: parseFfprobeMetadata(stdout, getSourceKind(project), options.mimeType),
        metadataError: null
      };
    } catch (error) {
      return {
        metadata: buildFallbackMetadata(options.mimeType),
        metadataError: error instanceof Error ? error.message : String(error)
      };
    }
  }
  async function collectDerivedOutputMetadata(runtime, project, options) {
    const ffmpegState = toToolRecord(getToolMap(runtime)["ffmpeg"]);
    const executableName = findCompanionExecutableName(ffmpegState, "ffprobe");
    if (ffmpegState.installed !== true || executableName === null) {
      return {
        metadata: buildFallbackMetadata(options.mimeType),
        metadataError: null
      };
    }
    try {
      const runResult = await callRoomTools({
        args: [
          "-v",
          "quiet",
          "-print_format",
          "json",
          "-show_format",
          "-show_streams",
          options.path
        ],
        cwd: getProjectEditDir(runtime, project),
        executableName,
        jobId: options.jobId || null,
        operation: "tool-run",
        requestId: options.requestId || null,
        roomId,
        timeoutMs: 15e3,
        toolId: "ffmpeg"
      });
      const runPayload = toRecord(toRecord(runResult)["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" && Number.isFinite(runPayload["exitCode"]) ? runPayload["exitCode"] : 0;
      const stdout = asNonEmptyString(runPayload["stdout"]);
      if (runPayload["cancelled"] === true || exitCode !== 0 || stdout === null) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffprobe metadata probe failed.");
      }
      return {
        metadata: parseFfprobeMetadata(stdout, getSourceKind(project), options.mimeType),
        metadataError: null
      };
    } catch (error) {
      return {
        metadata: buildFallbackMetadata(options.mimeType),
        metadataError: error instanceof Error ? error.message : String(error)
      };
    }
  }
  async function resolvePreparedSource(runtime, project, options) {
    const storedPath = asNonEmptyString(options.storedPath);
    const storedFileName = asNonEmptyString(options.storedFileName);
    if (storedPath === null || storedFileName === null) {
      throw new Error("Saved source file is missing.");
    }
    const validation = validateSourceCandidate(
      runtime,
      getSourceKind(project),
      storedFileName,
      options.mimeType
    );
    if (validation.valid !== true) {
      await deleteOwnedSourceFile(storedPath, options.requestId);
      throw new Error(validation.error || "Saved file is not a supported media source.");
    }
    const metadataResult = await collectStoredSourceMetadata(runtime, project, {
      jobId: options.jobId,
      mimeType: validation.mimeType,
      requestId: options.requestId,
      storedPath
    });
    return {
      metadata: metadataResult.metadata,
      metadataError: metadataResult.metadataError,
      mimeType: validation.mimeType || null,
      storedFileName,
      storedPath
    };
  }
  async function refreshActiveProjectMetadata(runtime, requestId) {
    const project = getActiveProject(runtime);
    const source = project ? getSourceRecord(project) : null;
    if (project === null || source === null || asNonEmptyString(source.storedPath) === null || asNonEmptyString(source.storedFileName) === null) {
      return null;
    }
    const ffmpegState = toToolRecord(getToolMap(runtime)["ffmpeg"]);
    if (ffmpegState.installed !== true) {
      return null;
    }
    const currentMetadata = normalizeSourceMetadata(source.metadata);
    if (currentMetadata && currentMetadata["extractedBy"] === "ffprobe") {
      return currentMetadata;
    }
    const validation = validateSourceCandidate(
      runtime,
      getSourceKind(project),
      source.storedFileName,
      source.mimeType
    );
    if (validation.valid !== true) {
      return null;
    }
    const metadataResult = await collectStoredSourceMetadata(runtime, project, {
      mimeType: validation.mimeType,
      requestId,
      storedPath: source.storedPath
    });
    const projectId = asNonEmptyString(project.id);
    await patchActiveProject(runtime, function(nextProject) {
      if (projectId !== null && asNonEmptyString(nextProject.id) !== projectId) {
        return nextProject;
      }
      const nextSource = getSourceRecord(nextProject);
      nextProject.source = nextSource;
      nextSource.mimeType = validation.mimeType || null;
      nextSource.metadata = metadataResult.metadata;
      nextSource["metadataError"] = metadataResult.metadataError;
      return nextProject;
    });
    return metadataResult.metadata;
  }
  return {
    collectDerivedOutputMetadata,
    collectStoredSourceMetadata,
    deleteOwnedSourceFile,
    refreshActiveProjectMetadata,
    resolvePreparedSource
  };
}
