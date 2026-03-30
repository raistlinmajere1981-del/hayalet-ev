export function createMediaUrlSourceIntakeRuntime(deps: any) {
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
    toRecord,
  } = deps;

  async function handleUrlDownload(api: any, runtime: any, requestId: any) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const urlValue = asNonEmptyString(project.source.drafts.urlInput);
    if (urlValue === null) {
      throw new Error("Direct URL is empty.");
    }

    await cancelJobsForProject(runtime, project.id, requestId);

    const fileName = deriveFilename(
      urlValue,
      project.source.kind,
      project.source.drafts.fileNameHint
    );
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
      const storedFileName =
        asNonEmptyString(downloaded.fileName) ||
        (storedPath ? storedPath.split(/[\\/]/).pop() : null);
      const preparedSource = await resolvePreparedSource(runtime, project, {
        requestId: requestId,
        jobId: jobId,
        storedPath: storedPath,
        storedFileName: storedFileName,
        mimeType:
          asNonEmptyString(downloaded.contentType) ||
          normalizeMimeType(storedFileName, project.source.kind),
      });

      await patchActiveProject(runtime, function (nextProject: any) {
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
        resetProfileForCurrentSource(
          runtime,
          nextProject,
          "Source media changed; rerun the profile preflight."
        );
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
      await patchActiveProject(runtime, function (nextProject: any) {
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

  return {
    handleUrlDownload,
  };
}
