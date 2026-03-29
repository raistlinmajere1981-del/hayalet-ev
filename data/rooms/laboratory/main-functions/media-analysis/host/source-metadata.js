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
  function buildFallbackMetadata(mimeType) {
    const normalizedMimeType = stripMimeParameters(mimeType);
    return normalizeSourceMetadata({
      mimeType: normalizedMimeType,
      formatName: normalizedMimeType,
      extractedBy: "host-fallback",
      extractedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  function parseFfprobeMetadata(stdout, kind, mimeType) {
    const payload = toRecord(JSON.parse(stdout));
    const format = toRecord(payload.format);
    const streams = Array.isArray(payload.streams) ? payload.streams.map(toRecord) : [];
    const videoStream = streams.find(function(stream) {
      return asNonEmptyString(stream.codec_type) === "video";
    }) || streams.find(function(stream) {
      return asNumber(stream.width) !== null || asNumber(stream.height) !== null;
    }) || {};
    const audioStream = streams.find(function(stream) {
      return asNonEmptyString(stream.codec_type) === "audio";
    }) || {};
    const durationSeconds = asNumber(format.duration) || asNumber(videoStream.duration) || asNumber(audioStream.duration);
    const videoCodec = asNonEmptyString(videoStream.codec_name);
    const audioCodec = asNonEmptyString(audioStream.codec_name);
    let codec = videoCodec || audioCodec;
    if (kind === "audio") {
      codec = audioCodec;
    } else if (kind === "video" && videoCodec && audioCodec) {
      codec = `${videoCodec} + ${audioCodec}`;
    }
    return normalizeSourceMetadata({
      durationSeconds,
      width: asNumber(videoStream.width),
      height: asNumber(videoStream.height),
      codec,
      videoCodec,
      audioCodec,
      formatName: asNonEmptyString(format.format_long_name) || asNonEmptyString(format.format_name),
      bitRate: asNumber(format.bit_rate) || asNumber(audioStream.bit_rate) || asNumber(videoStream.bit_rate),
      sizeBytes: asNumber(format.size),
      streamCount: streams.length,
      mimeType: stripMimeParameters(mimeType),
      extractedBy: "ffprobe",
      extractedAt: (/* @__PURE__ */ new Date()).toISOString()
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
        roomId,
        requestId: requestId || null,
        targetPath,
        recursive: false
      });
    } catch (_error) {
    }
  }
  async function collectStoredSourceMetadata(runtime, project, options) {
    const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
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
        operation: "tool-run",
        roomId,
        requestId: options.requestId || null,
        jobId: options.jobId || null,
        toolId: "ffmpeg",
        executableName,
        cwd: getProjectSourceDir(runtime, project),
        args: ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", options.storedPath],
        timeoutMs: 15e3
      });
      const runPayload = toRecord(runResult.run);
      const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
      const stdout = asNonEmptyString(runPayload.stdout);
      if (runPayload.cancelled === true || exitCode !== 0 || stdout === null) {
        throw new Error(
          asNonEmptyString(runPayload.stderr) || "ffprobe did not return structured metadata."
        );
      }
      return {
        metadata: parseFfprobeMetadata(stdout, project.source.kind, options.mimeType),
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
    const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
    const executableName = findCompanionExecutableName(ffmpegState, "ffprobe");
    if (ffmpegState.installed !== true || executableName === null) {
      return {
        metadata: buildFallbackMetadata(options.mimeType),
        metadataError: null
      };
    }
    try {
      const runResult = await callRoomTools({
        operation: "tool-run",
        roomId,
        requestId: options.requestId || null,
        jobId: options.jobId || null,
        toolId: "ffmpeg",
        executableName,
        cwd: getProjectEditDir(runtime, project),
        args: ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", options.path],
        timeoutMs: 15e3
      });
      const runPayload = toRecord(runResult.run);
      const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
      const stdout = asNonEmptyString(runPayload.stdout);
      if (runPayload.cancelled === true || exitCode !== 0 || stdout === null) {
        throw new Error(asNonEmptyString(runPayload.stderr) || "ffprobe metadata probe failed.");
      }
      return {
        metadata: parseFfprobeMetadata(stdout, project.source.kind, options.mimeType),
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
    const sourceKind = project.source.kind;
    if (storedPath === null || storedFileName === null) {
      throw new Error("Saved source file is missing.");
    }
    const validation = validateSourceCandidate(runtime, sourceKind, storedFileName, options.mimeType);
    if (validation.valid !== true) {
      await deleteOwnedSourceFile(storedPath, options.requestId);
      throw new Error(validation.error);
    }
    const metadataResult = await collectStoredSourceMetadata(runtime, project, {
      requestId: options.requestId,
      jobId: options.jobId,
      storedPath,
      mimeType: validation.mimeType
    });
    return {
      storedPath,
      storedFileName,
      mimeType: validation.mimeType,
      metadata: metadataResult.metadata,
      metadataError: metadataResult.metadataError
    };
  }
  async function refreshActiveProjectMetadata(runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null || asNonEmptyString(project.source.storedPath) === null || asNonEmptyString(project.source.storedFileName) === null) {
      return null;
    }
    const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
    if (ffmpegState.installed !== true) {
      return null;
    }
    const currentMetadata = normalizeSourceMetadata(project.source.metadata);
    if (currentMetadata && currentMetadata.extractedBy === "ffprobe") {
      return currentMetadata;
    }
    const validation = validateSourceCandidate(
      runtime,
      project.source.kind,
      project.source.storedFileName,
      project.source.mimeType
    );
    if (validation.valid !== true) {
      return null;
    }
    const metadataResult = await collectStoredSourceMetadata(runtime, project, {
      requestId,
      storedPath: project.source.storedPath,
      mimeType: validation.mimeType
    });
    await patchActiveProject(runtime, function(nextProject) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject.source.mimeType = validation.mimeType;
      nextProject.source.metadata = metadataResult.metadata;
      nextProject.source.metadataError = metadataResult.metadataError;
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
