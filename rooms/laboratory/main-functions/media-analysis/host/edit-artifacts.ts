export function createMediaEditArtifactRuntime(deps: any) {
  const {
    asNonEmptyString,
    asNumber,
    callRoomTools,
    clampNumber,
    getProjectEditDir,
    getProjectEditOutputDir,
    getProjectEditPreviewDir,
    listDirectory,
    roomId,
    toRecord,
  } = deps;

  function buildArtifactEntry(filePath: any, kind: any) {
    const normalizedPath = asNonEmptyString(filePath);
    if (normalizedPath === null) {
      return null;
    }
    return {
      kind: kind,
      path: normalizedPath,
      fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
    };
  }

  async function listArtifactsWithPrefix(dirPath: any, filePrefix: any) {
    const entries = await listDirectory(dirPath);
    return entries
      .filter(function (entry: any) {
        return (
          entry && entry.isDirectory !== true && String(entry.name || "").startsWith(filePrefix)
        );
      })
      .map(function (entry: any) {
        return entry.path;
      })
      .sort();
  }

  async function buildAuxiliaryArtifacts(runtime: any, project: any, options: any) {
    const artifactDir =
      options.mode === "preview"
        ? getProjectEditPreviewDir(runtime, project)
        : getProjectEditOutputDir(runtime, project);

    if (project.source.kind === "audio") {
      if (toRecord(toRecord(toRecord(project.edit).recipe).audio).spectrogram !== true) {
        return [];
      }
      const artifactBase = options.baseName;
      const spectrogramPath = `${artifactDir}/${artifactBase}-spectrogram.png`;

      await callRoomTools({
        operation: "tool-run",
        roomId: roomId,
        requestId: options.requestId || null,
        jobId: options.jobId || null,
        toolId: "ffmpeg",
        cwd: getProjectEditDir(runtime, project),
        args: [
          "-y",
          "-i",
          options.outputPath,
          "-lavfi",
          "showspectrumpic=s=1600x480:legend=0",
          "-frames:v",
          "1",
          spectrogramPath,
        ],
        timeoutMs: 60_000,
      });

      return [buildArtifactEntry(spectrogramPath, "spectrogram")].filter(Boolean);
    }

    if (project.source.kind === "video" && options.mode === "apply") {
      const frameGrabCount = clampNumber(
        toRecord(toRecord(toRecord(project.edit).recipe).video).frameGrabCount,
        0,
        24,
        0
      );
      const durationSeconds =
        asNumber(toRecord(options.metadata).durationSeconds) ||
        asNumber(toRecord(toRecord(project.source).metadata).durationSeconds);
      if (frameGrabCount > 0 && durationSeconds && durationSeconds > 0) {
        const framePattern = `${artifactDir}/${options.baseName}-frame-%03d.jpg`;
        const fpsValue = Math.max(0.2, frameGrabCount / durationSeconds);

        await callRoomTools({
          operation: "tool-run",
          roomId: roomId,
          requestId: options.requestId || null,
          jobId: options.jobId || null,
          toolId: "ffmpeg",
          cwd: getProjectEditDir(runtime, project),
          args: [
            "-y",
            "-i",
            options.outputPath,
            "-vf",
            `fps=${fpsValue}`,
            "-frames:v",
            String(frameGrabCount),
            framePattern,
          ],
          timeoutMs: 60_000,
        });

        const createdFrames = await listArtifactsWithPrefix(
          artifactDir,
          `${options.baseName}-frame-`
        );
        return createdFrames
          .map(function (filePath: any) {
            return buildArtifactEntry(filePath, "frame");
          })
          .filter(Boolean);
      }
    }

    return [];
  }

  return {
    buildAuxiliaryArtifacts,
  };
}
