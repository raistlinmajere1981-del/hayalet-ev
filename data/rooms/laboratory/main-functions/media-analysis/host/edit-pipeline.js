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
    toRecord
  } = deps;
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toProjectEditRecord(value) {
    return toRecord(value);
  }
  function toPreviewRecord(value) {
    return toRecord(value);
  }
  function toRunPayloadRecord(value) {
    return toRecord(value);
  }
  function toEditOutputRecord(value) {
    return toRecord(value);
  }
  function toString(value) {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  function getProjectId(project) {
    return toString(project.id) || "unknown-project";
  }
  function getSourceKind(project) {
    return toString(toProjectSourceRecord(project.source).kind) || "video";
  }
  async function runEditPipeline(api, runtime, requestId, mode) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    requirePreparedSource(project);
    ensureEditToolReady(runtime);
    await ensureProjectDirectories(runtime, project, requestId);
    const projectId = getProjectId(project);
    const action = mode === "preview" ? "edit-preview" : "edit-apply";
    ensureEditJobSlotAvailable(runtime, projectId, action);
    const jobId = `room-edit-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const targetPath = buildEditTargetPath(runtime, project, mode);
    const mimeType = getDerivedMimeType(getSourceKind(project));
    const recipeSignature = getEditRecipeSignature(project);
    const artifactBaseName = (targetPath.split(/[\\/]/).pop() || "artifact").replace(
      /\.[^.]+$/,
      ""
    );
    registerJob(runtime, {
      action,
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg"
    });
    pushJobState(api, {
      action,
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg"
    });
    await patchActiveProject(runtime, function(nextProject) {
      const nextEdit = toProjectEditRecord(nextProject.edit);
      nextProject.edit = nextEdit;
      nextEdit.lastError = null;
      nextEdit.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      if (mode === "preview") {
        nextEdit.preview = {
          ...toPreviewRecord(nextEdit.preview),
          error: null,
          jobId,
          requestId,
          status: "generating"
        };
      }
      return nextProject;
    });
    try {
      const runResult = await callRoomTools({
        args: buildEditCommand(runtime, project, targetPath, mode),
        cwd: getProjectEditDir(runtime, project),
        jobId,
        operation: "tool-run",
        requestId,
        roomId,
        timeoutMs: 20 * 60 * 1e3,
        toolId: "ffmpeg"
      });
      const runPayload = toRunPayloadRecord(toRecord(runResult)["run"]);
      const exitCode = typeof runPayload.exitCode === "number" && Number.isFinite(runPayload.exitCode) ? runPayload.exitCode : 0;
      const stderr = toString(runPayload.stderr);
      if (runPayload.cancelled === true || exitCode !== 0) {
        throw new Error(stderr || "FFmpeg edit job failed.");
      }
      const targetFileName = targetPath.split(/[\\/]/).pop() || null;
      const metadataResult = await collectDerivedOutputMetadata(runtime, project, {
        jobId,
        mimeType,
        path: targetPath,
        requestId
      });
      const artifacts = await buildAuxiliaryArtifacts(runtime, project, {
        baseName: artifactBaseName,
        jobId,
        metadata: metadataResult.metadata,
        mode,
        outputPath: targetPath,
        requestId
      });
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await patchActiveProject(runtime, function(nextProject) {
        const nextEdit = toProjectEditRecord(nextProject.edit);
        nextProject.edit = nextEdit;
        nextEdit.lastError = null;
        nextEdit.lastActionAt = createdAt;
        nextEdit.dirty = false;
        if (mode === "preview") {
          nextEdit.preview = {
            artifacts,
            error: metadataResult.metadataError,
            fileName: targetFileName,
            jobId,
            metadata: metadataResult.metadata,
            mimeType,
            outputId: "preview",
            path: targetPath,
            recipeSignature,
            requestId,
            status: "ready",
            updatedAt: createdAt
          };
          return nextProject;
        }
        const outputId = `edit-output-${Date.now()}`;
        const nextOutput = toEditOutputRecord(
          normalizeEditOutput({
            artifacts,
            createdAt,
            fileName: targetFileName,
            id: outputId,
            jobId,
            kind: getSourceKind(project),
            label: buildEditOutputLabel(project, mode),
            metadata: metadataResult.metadata,
            mimeType,
            path: targetPath,
            recipeSignature,
            sourcePath: getPreparedSourcePath(project)
          })
        );
        const existingOutputs = Array.isArray(nextEdit.outputs) ? nextEdit.outputs : [];
        nextEdit.outputs = [nextOutput].concat(existingOutputs);
        nextEdit.activeOutputId = toString(nextOutput.id);
        nextEdit.handoffMode = "derived";
        markProfileAsStale(nextProject, "Edit output changed; rerun the profile preflight.");
        markCloseoutAsStale(nextProject, "Edit output changed; rerun downstream processing.", [
          audioFeatureId
        ]);
        const previousPreview = toPreviewRecord(nextEdit.preview);
        nextEdit.preview = {
          ...previousPreview,
          status: toString(previousPreview.path) !== null ? toString(previousPreview.recipeSignature) === recipeSignature ? "ready" : "stale" : "idle"
        };
        return nextProject;
      });
      pushJobState(api, {
        action,
        featureStage: "edit",
        jobId,
        percent: 100,
        projectId,
        requestId,
        stage: "completed",
        toolId: "ffmpeg"
      });
      return {
        fileName: targetFileName,
        metadata: metadataResult.metadata,
        path: targetPath
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await patchActiveProject(runtime, function(nextProject) {
        const nextEdit = toProjectEditRecord(nextProject.edit);
        nextProject.edit = nextEdit;
        nextEdit.lastError = errorMessage;
        nextEdit.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
        if (mode === "preview") {
          nextEdit.preview = {
            ...toPreviewRecord(nextEdit.preview),
            error: errorMessage,
            status: "error"
          };
        }
        return nextProject;
      });
      pushJobState(api, {
        action,
        featureStage: "edit",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg"
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  return {
    runEditPipeline
  };
}
