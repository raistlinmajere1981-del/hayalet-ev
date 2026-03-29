// @ts-nocheck
export function createMediaEditPipelineRuntime(deps) {
  const {
    audioFeatureId,
    buildAuxiliaryArtifacts,
    buildEditCommand,
    buildEditOutputLabel,
    buildEditTargetPath,
    callRoomTools,
    clearJob,
    collectDerivedOutputMetadata,
    ensureEditJobSlotAvailable,
    ensureEditToolReady,
    ensureProjectDirectories,
    getActiveProject,
    getDerivedMimeType,
    getEditRecipeSignature,
    getPreparedSourcePath,
    getProjectEditDir,
    markCloseoutAsStale,
    markProfileAsStale,
    normalizeEditOutput,
    patchActiveProject,
    pushJobState,
    registerJob,
    requirePreparedSource,
    roomId,
    toRecord,
  } = deps;

  async function runEditPipeline(api, runtime, requestId, mode) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    requirePreparedSource(project);
    ensureEditToolReady(runtime);
    await ensureProjectDirectories(runtime, project, requestId);
    const action = mode === "preview" ? "edit-preview" : "edit-apply";
    ensureEditJobSlotAvailable(runtime, project.id, action);
    const jobId = `room-edit-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const targetPath = buildEditTargetPath(runtime, project, mode);
    const mimeType = getDerivedMimeType(project.source.kind);
    const recipeSignature = getEditRecipeSignature(project);
    const artifactBaseName = (targetPath.split(/[\\/]/).pop() || "artifact").replace(/\.[^.]+$/, "");

    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: action,
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "edit",
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "edit",
      stage: "queued",
    });

    await patchActiveProject(runtime, function (nextProject) {
      nextProject.edit.lastError = null;
      nextProject.edit.lastActionAt = new Date().toISOString();
      if (mode === "preview") {
        nextProject.edit.preview = {
          ...toRecord(nextProject.edit.preview),
          status: "generating",
          requestId: requestId,
          jobId: jobId,
          error: null,
        };
      }
      return nextProject;
    });

    try {
      const runResult = await callRoomTools({
        operation: "tool-run",
        roomId: roomId,
        requestId: requestId,
        jobId: jobId,
        toolId: "ffmpeg",
        cwd: getProjectEditDir(runtime, project),
        args: buildEditCommand(runtime, project, targetPath, mode),
        timeoutMs: 20 * 60 * 1000,
      });
      const runPayload = toRecord(runResult.run);
      const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
      if (runPayload.cancelled === true || exitCode !== 0) {
        throw new Error(runPayload.stderr && String(runPayload.stderr).trim() !== "" ? runPayload.stderr : "FFmpeg edit job failed.");
      }

      const targetFileName = targetPath.split(/[\\/]/).pop() || null;
      const metadataResult = await collectDerivedOutputMetadata(runtime, project, {
        requestId: requestId,
        jobId: jobId,
        path: targetPath,
        mimeType: mimeType,
      });
      const artifacts = await buildAuxiliaryArtifacts(runtime, project, {
        requestId: requestId,
        jobId: jobId,
        mode: mode,
        outputPath: targetPath,
        baseName: artifactBaseName,
        metadata: metadataResult.metadata,
      });

      const createdAt = new Date().toISOString();
      await patchActiveProject(runtime, function (nextProject) {
        nextProject.edit.lastError = null;
        nextProject.edit.lastActionAt = createdAt;
        nextProject.edit.dirty = false;

        if (mode === "preview") {
          nextProject.edit.preview = {
            status: "ready",
            outputId: "preview",
            jobId: jobId,
            requestId: requestId,
            path: targetPath,
            fileName: targetFileName,
            mimeType: mimeType,
            metadata: metadataResult.metadata,
            artifacts: artifacts,
            error: metadataResult.metadataError,
            recipeSignature: recipeSignature,
            updatedAt: createdAt,
          };
          return nextProject;
        }

        const outputId = `edit-output-${Date.now()}`;
        const nextOutput = normalizeEditOutput({
          id: outputId,
          kind: project.source.kind,
          path: targetPath,
          fileName: targetFileName,
          mimeType: mimeType,
          createdAt: createdAt,
          recipeSignature: recipeSignature,
          metadata: metadataResult.metadata,
          label: buildEditOutputLabel(project, mode),
          jobId: jobId,
          sourcePath: getPreparedSourcePath(project),
          artifacts: artifacts,
        });

        nextProject.edit.outputs = [nextOutput].concat(
          Array.isArray(nextProject.edit.outputs) ? nextProject.edit.outputs : []
        );
        nextProject.edit.activeOutputId = nextOutput.id;
        nextProject.edit.handoffMode = "derived";
        markProfileAsStale(nextProject, "Edit output changed; rerun the profile preflight.");
        markCloseoutAsStale(nextProject, "Edit output changed; rerun downstream processing.", [audioFeatureId]);
        const previousPreview = toRecord(nextProject.edit.preview);
        nextProject.edit.preview = {
          ...previousPreview,
          status:
            previousPreview.path && String(previousPreview.path).trim() !== ""
              ? previousPreview.recipeSignature === recipeSignature
                ? "ready"
                : "stale"
              : "idle",
        };
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project.id,
        toolId: "ffmpeg",
        featureStage: "edit",
        stage: "completed",
        percent: 100,
      });

      return {
        path: targetPath,
        fileName: targetFileName,
        metadata: metadataResult.metadata,
      };
    } catch (error) {
      await patchActiveProject(runtime, function (nextProject) {
        nextProject.edit.lastError = error instanceof Error ? error.message : String(error);
        nextProject.edit.lastActionAt = new Date().toISOString();
        if (mode === "preview") {
          nextProject.edit.preview = {
            ...toRecord(nextProject.edit.preview),
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          };
        }
        return nextProject;
      });

      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project.id,
        toolId: "ffmpeg",
        featureStage: "edit",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    runEditPipeline,
  };
}
