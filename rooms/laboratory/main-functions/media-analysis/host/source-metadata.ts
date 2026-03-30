export function createMediaSourceMetadataRuntime(deps: any) {
  const asNumber = deps["asNumber"];
  const asNonEmptyString = deps["asNonEmptyString"];
  const callRoomTools = deps["callRoomTools"];
  const ensureProjectDirectories = deps["ensureProjectDirectories"];
  const findCompanionExecutableName = deps["findCompanionExecutableName"];
  const getActiveProject = deps["getActiveProject"];
  const getProjectEditDir = deps["getProjectEditDir"];
  const getProjectSourceDir = deps["getProjectSourceDir"];
  const normalizeSourceMetadata = deps["normalizeSourceMetadata"];
  const patchActiveProject = deps["patchActiveProject"];
  const roomId = deps["roomId"];
  const stripMimeParameters = deps["stripMimeParameters"];
  const toRecord = deps["toRecord"];
  const validateSourceCandidate = deps["validateSourceCandidate"];

  function buildFallbackMetadata(mimeType: unknown) {
    const normalizedMimeType = stripMimeParameters(mimeType);
    return normalizeSourceMetadata({
      mimeType: normalizedMimeType,
      formatName: normalizedMimeType,
      extractedBy: "host-fallback",
      extractedAt: new Date().toISOString(),
    });
  }

  function parseFfprobeMetadata(stdout: string, kind: string, mimeType: unknown) {
    const payload = toRecord(JSON.parse(stdout));
    const format = toRecord(payload["format"]);
    const streams: Record<string, unknown>[] = Array.isArray(payload["streams"])
      ? payload["streams"].map(toRecord)
      : [];
    const emptyStream: Record<string, unknown> = {};
    const videoStream =
      streams.find(function (stream: Record<string, unknown>) {
        return asNonEmptyString(stream["codec_type"]) === "video";
      }) ||
      streams.find(function (stream: Record<string, unknown>) {
        return asNumber(stream["width"]) !== null || asNumber(stream["height"]) !== null;
      }) ||
      emptyStream;
    const audioStream =
      streams.find(function (stream: Record<string, unknown>) {
        return asNonEmptyString(stream["codec_type"]) === "audio";
      }) || emptyStream;
    const durationSeconds =
      asNumber(format["duration"]) || asNumber(videoStream["duration"]) || asNumber(audioStream["duration"]);
    const videoCodec = asNonEmptyString(videoStream["codec_name"]);
    const audioCodec = asNonEmptyString(audioStream["codec_name"]);
    let codec = videoCodec || audioCodec;

    if (kind === "audio") {
      codec = audioCodec;
    } else if (kind === "video" && videoCodec && audioCodec) {
      codec = `${videoCodec} + ${audioCodec}`;
    }

    return normalizeSourceMetadata({
      durationSeconds: durationSeconds,
      width: asNumber(videoStream["width"]),
      height: asNumber(videoStream["height"]),
      codec: codec,
      videoCodec: videoCodec,
      audioCodec: audioCodec,
      formatName: asNonEmptyString(format["format_long_name"]) || asNonEmptyString(format["format_name"]),
      bitRate:
        asNumber(format["bit_rate"]) ||
        asNumber(audioStream["bit_rate"]) ||
        asNumber(videoStream["bit_rate"]),
      sizeBytes: asNumber(format["size"]),
      streamCount: streams.length,
      mimeType: stripMimeParameters(mimeType),
      extractedBy: "ffprobe",
      extractedAt: new Date().toISOString(),
    });
  }

  async function deleteOwnedSourceFile(filePath: unknown, requestId: unknown) {
    const targetPath = asNonEmptyString(filePath);
    if (targetPath === null) {
      return;
    }

    try {
      await callRoomTools({
        operation: "delete-path",
        roomId: roomId,
        requestId: requestId || null,
        targetPath: targetPath,
        recursive: false,
      });
    } catch (_error) {
      // noop
    }
  }

  async function collectStoredSourceMetadata(
    runtime: any,
    project: any,
    options: Record<string, unknown>
  ) {
    const ffmpegState = toRecord(runtime["toolState"]["tools"]["ffmpeg"]);

    if (ffmpegState["installed"] !== true) {
      return {
        metadata: buildFallbackMetadata(options["mimeType"]),
        metadataError: null,
      };
    }

    const executableName = findCompanionExecutableName(ffmpegState, "ffprobe");
    if (executableName === null) {
      return {
        metadata: buildFallbackMetadata(options["mimeType"]),
        metadataError: null,
      };
    }

    try {
      await ensureProjectDirectories(runtime, project, options["requestId"] || null);
      const runResult = await callRoomTools({
        operation: "tool-run",
        roomId: roomId,
        requestId: options["requestId"] || null,
        jobId: options["jobId"] || null,
        toolId: "ffmpeg",
        executableName: executableName,
        cwd: getProjectSourceDir(runtime, project),
        args: [
          "-v",
          "quiet",
          "-print_format",
          "json",
          "-show_format",
          "-show_streams",
          options["storedPath"],
        ],
        timeoutMs: 15_000,
      });
      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      const stdout = asNonEmptyString(runPayload["stdout"]);

      if (runPayload["cancelled"] === true || exitCode !== 0 || stdout === null) {
        throw new Error(
          asNonEmptyString(runPayload["stderr"]) || "ffprobe did not return structured metadata."
        );
      }

      return {
        metadata: parseFfprobeMetadata(stdout, project["source"]["kind"], options["mimeType"]),
        metadataError: null,
      };
    } catch (error) {
      return {
        metadata: buildFallbackMetadata(options["mimeType"]),
        metadataError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function collectDerivedOutputMetadata(
    runtime: any,
    project: any,
    options: Record<string, unknown>
  ) {
    const ffmpegState = toRecord(runtime["toolState"]["tools"]["ffmpeg"]);
    const executableName = findCompanionExecutableName(ffmpegState, "ffprobe");

    if (ffmpegState["installed"] !== true || executableName === null) {
      return {
        metadata: buildFallbackMetadata(options["mimeType"]),
        metadataError: null,
      };
    }

    try {
      const runResult = await callRoomTools({
        operation: "tool-run",
        roomId: roomId,
        requestId: options["requestId"] || null,
        jobId: options["jobId"] || null,
        toolId: "ffmpeg",
        executableName: executableName,
        cwd: getProjectEditDir(runtime, project),
        args: [
          "-v",
          "quiet",
          "-print_format",
          "json",
          "-show_format",
          "-show_streams",
          options["path"],
        ],
        timeoutMs: 15_000,
      });
      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      const stdout = asNonEmptyString(runPayload["stdout"]);

      if (runPayload["cancelled"] === true || exitCode !== 0 || stdout === null) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffprobe metadata probe failed.");
      }

      return {
        metadata: parseFfprobeMetadata(stdout, project["source"]["kind"], options["mimeType"]),
        metadataError: null,
      };
    } catch (error) {
      return {
        metadata: buildFallbackMetadata(options["mimeType"]),
        metadataError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function resolvePreparedSource(
    runtime: any,
    project: any,
    options: Record<string, unknown>
  ) {
    const storedPath = asNonEmptyString(options["storedPath"]);
    const storedFileName = asNonEmptyString(options["storedFileName"]);
    const sourceKind = project["source"]["kind"];

    if (storedPath === null || storedFileName === null) {
      throw new Error("Saved source file is missing.");
    }

    const validation = validateSourceCandidate(
      runtime,
      sourceKind,
      storedFileName,
      options["mimeType"]
    );
    if (validation.valid !== true) {
      await deleteOwnedSourceFile(storedPath, options["requestId"]);
      throw new Error(validation.error);
    }

    const metadataResult = await collectStoredSourceMetadata(runtime, project, {
      requestId: options["requestId"],
      jobId: options["jobId"],
      storedPath: storedPath,
      mimeType: validation.mimeType,
    });

    return {
      storedPath: storedPath,
      storedFileName: storedFileName,
      mimeType: validation.mimeType,
      metadata: metadataResult.metadata,
      metadataError: metadataResult.metadataError,
    };
  }

  async function refreshActiveProjectMetadata(runtime: any, requestId: string) {
    const project = getActiveProject(runtime);
    if (
      project === null ||
      asNonEmptyString(project["source"]["storedPath"]) === null ||
      asNonEmptyString(project["source"]["storedFileName"]) === null
    ) {
      return null;
    }

    const ffmpegState = toRecord(runtime["toolState"]["tools"]["ffmpeg"]);
    if (ffmpegState["installed"] !== true) {
      return null;
    }

    const currentMetadata = normalizeSourceMetadata(project["source"]["metadata"]);
    if (currentMetadata && currentMetadata["extractedBy"] === "ffprobe") {
      return currentMetadata;
    }

    const validation = validateSourceCandidate(
      runtime,
      project["source"]["kind"],
      project["source"]["storedFileName"],
      project["source"]["mimeType"]
    );
    if (validation.valid !== true) {
      return null;
    }

    const metadataResult = await collectStoredSourceMetadata(runtime, project, {
      requestId: requestId,
      storedPath: project["source"]["storedPath"],
      mimeType: validation.mimeType,
    });

    await patchActiveProject(runtime, function (nextProject: any) {
      if (nextProject.id !== project.id) {
        return nextProject;
      }
      nextProject["source"]["mimeType"] = validation.mimeType;
      nextProject["source"]["metadata"] = metadataResult.metadata;
      nextProject["source"]["metadataError"] = metadataResult.metadataError;
      return nextProject;
    });

    return metadataResult.metadata;
  }

  return {
    collectDerivedOutputMetadata,
    collectStoredSourceMetadata,
    deleteOwnedSourceFile,
    refreshActiveProjectMetadata,
    resolvePreparedSource,
  };
}
