export function createMediaUrlSourceIntakeRuntime(deps) {
  const {
    asNonEmptyString,
    callRoomTools,
    cancelJobsForProject,
    clearJob,
    deriveFilename,
    getActiveProject,
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
  function toProjectSourceDraftsRecord(value) {
    return toRecord(value);
  }
  function toDownloadedFileRecord(value) {
    return toRecord(value);
  }
  function getProjectId(project) {
    return asNonEmptyString(project.id);
  }
  function getProjectSourceKind(project) {
    const sourceRecord = toProjectSourceRecord(project.source);
    return typeof sourceRecord.kind === "string" && sourceRecord.kind.trim() !== "" ? sourceRecord.kind : "video";
  }
  function getProjectDrafts(project) {
    return toProjectSourceDraftsRecord(toProjectSourceRecord(project.source).drafts);
  }
  function setProjectSource(project, updater) {
    const nextSource = toProjectSourceRecord(project["source"]);
    updater(nextSource);
    project["source"] = nextSource;
  }
  async function handleUrlDownload(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const projectId = getProjectId(project);
    const sourceDrafts = getProjectDrafts(project);
    const urlValue = asNonEmptyString(sourceDrafts.urlInput);
    if (urlValue === null) {
      throw new Error("Direct URL is empty.");
    }
    await cancelJobsForProject(runtime, projectId, requestId);
    const fileName = deriveFilename(
      urlValue,
      getProjectSourceKind(project),
      sourceDrafts.fileNameHint
    );
    const jobId = `room-url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId,
      requestId,
      action: "source-download-url",
      projectId,
      featureStage: "source"
    });
    pushJobState(api, {
      requestId,
      jobId,
      action: "source-download-url",
      projectId,
      stage: "queued"
    });
    try {
      const downloadResult = await callRoomTools({
        operation: "download-file",
        roomId,
        requestId,
        jobId,
        url: urlValue,
        destinationPath: `${getProjectSourceDir(runtime, project)}/${fileName}`,
        overwrite: false
      });
      const downloaded = toDownloadedFileRecord(toRecord(downloadResult)["download"]);
      const storedPath = asNonEmptyString(downloaded.path);
      const storedFileName = asNonEmptyString(downloaded.fileName) || (storedPath ? storedPath.split(/[\\/]/).pop() : null);
      const preparedSource = await resolvePreparedSource(runtime, project, {
        requestId,
        jobId,
        storedPath,
        storedFileName,
        mimeType: asNonEmptyString(downloaded.contentType) || normalizeMimeType(storedFileName, getProjectSourceKind(project))
      });
      await patchActiveProject(runtime, function(nextProject) {
        if (nextProject.id !== project.id) {
          return nextProject;
        }
        setProjectSource(nextProject, function(nextSource) {
          nextSource["mode"] = "url";
          nextSource["status"] = "ready";
          nextSource["storedPath"] = preparedSource.storedPath;
          nextSource["storedFileName"] = preparedSource.storedFileName;
          nextSource["sourceUrl"] = urlValue;
          nextSource["mimeType"] = preparedSource.mimeType;
          nextSource["routeLabel"] = "Direct URL";
          nextSource["lastError"] = null;
          nextSource["metadata"] = preparedSource.metadata;
          nextSource["metadataError"] = preparedSource.metadataError;
        });
        resetEditForCurrentSource(runtime, nextProject);
        resetProfileForCurrentSource(
          runtime,
          nextProject,
          "Source media changed; rerun the profile preflight."
        );
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action: "source-download-url",
        projectId,
        stage: "completed",
        percent: 100
      });
      return {
        storedPath: preparedSource.storedPath,
        storedFileName: preparedSource.storedFileName
      };
    } catch (error) {
      await patchActiveProject(runtime, function(nextProject) {
        if (nextProject.id !== project.id) {
          return nextProject;
        }
        setProjectSource(nextProject, function(nextSource) {
          nextSource["status"] = "error";
          nextSource["lastError"] = error instanceof Error ? error.message : String(error);
        });
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action: "source-download-url",
        projectId,
        stage: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  return {
    handleUrlDownload
  };
}
