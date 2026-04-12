export function createMediaEditArtifactRuntime(deps) {
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
    toRecord
  } = deps;
  function toProjectEditRecord(value) {
    return toRecord(value);
  }
  function toProjectEditRecipeRecord(value) {
    return toRecord(value);
  }
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toAudioEditRecipeRecord(value) {
    return toRecord(value);
  }
  function toVideoEditRecipeRecord(value) {
    return toRecord(value);
  }
  function toArtifactOptionsRecord(value) {
    return toRecord(value);
  }
  function isArtifactEntry(entry) {
    return entry !== null;
  }
  function buildArtifactEntry(filePath, kind) {
    const normalizedPath = asNonEmptyString(filePath);
    if (normalizedPath === null) {
      return null;
    }
    return {
      kind,
      path: normalizedPath,
      fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath
    };
  }
  async function listArtifactsWithPrefix(dirPath, filePrefix) {
    const entries = await listDirectory(dirPath);
    return entries.filter(function(entry) {
      return entry.isDirectory !== true && String(entry.name || "").startsWith(filePrefix);
    }).map(function(entry) {
      return typeof entry.path === "string" ? entry.path : "";
    }).filter(Boolean).sort();
  }
  async function buildAuxiliaryArtifacts(runtime, project, options) {
    const artifactOptions = toArtifactOptionsRecord(options);
    const projectSource = toProjectSourceRecord(project.source);
    const projectEdit = toProjectEditRecord(project.edit);
    const recipe = toProjectEditRecipeRecord(projectEdit.recipe);
    const artifactDir = artifactOptions.mode === "preview" ? getProjectEditPreviewDir(runtime, project) : getProjectEditOutputDir(runtime, project);
    if (projectSource.kind === "audio") {
      if (toAudioEditRecipeRecord(recipe.audio).spectrogram !== true) {
        return [];
      }
      const artifactBase = asNonEmptyString(artifactOptions.baseName) || "artifact";
      const spectrogramPath = `${artifactDir}/${artifactBase}-spectrogram.png`;
      await callRoomTools({
        operation: "tool-run",
        roomId,
        requestId: artifactOptions.requestId || null,
        jobId: artifactOptions.jobId || null,
        toolId: "ffmpeg",
        cwd: getProjectEditDir(runtime, project),
        args: [
          "-y",
          "-i",
          String(artifactOptions.outputPath || ""),
          "-lavfi",
          "showspectrumpic=s=1600x480:legend=0",
          "-frames:v",
          "1",
          spectrogramPath
        ],
        timeoutMs: 6e4
      });
      return [buildArtifactEntry(spectrogramPath, "spectrogram")].filter(isArtifactEntry);
    }
    if (projectSource.kind === "video" && artifactOptions.mode === "apply") {
      const frameGrabCount = clampNumber(
        toVideoEditRecipeRecord(recipe.video).frameGrabCount,
        0,
        24,
        0
      );
      const durationSeconds = asNumber(toArtifactOptionsRecord(artifactOptions.metadata)["durationSeconds"]) || asNumber(toRecord(projectSource.metadata)["durationSeconds"]);
      if (frameGrabCount > 0 && durationSeconds && durationSeconds > 0) {
        const artifactBase = asNonEmptyString(artifactOptions.baseName) || "artifact";
        const framePattern = `${artifactDir}/${artifactBase}-frame-%03d.jpg`;
        const fpsValue = Math.max(0.2, frameGrabCount / durationSeconds);
        await callRoomTools({
          operation: "tool-run",
          roomId,
          requestId: artifactOptions.requestId || null,
          jobId: artifactOptions.jobId || null,
          toolId: "ffmpeg",
          cwd: getProjectEditDir(runtime, project),
          args: [
            "-y",
            "-i",
            String(artifactOptions.outputPath || ""),
            "-vf",
            `fps=${fpsValue}`,
            "-frames:v",
            String(frameGrabCount),
            framePattern
          ],
          timeoutMs: 6e4
        });
        const createdFrames = await listArtifactsWithPrefix(artifactDir, `${artifactBase}-frame-`);
        return createdFrames.map(function(filePath) {
          return buildArtifactEntry(filePath, "frame");
        }).filter(isArtifactEntry);
      }
    }
    return [];
  }
  return {
    buildAuxiliaryArtifacts
  };
}
