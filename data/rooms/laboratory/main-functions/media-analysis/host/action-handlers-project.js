export function createMediaProjectActionRuntime(deps) {
  const {
    asNonEmptyString,
    cancelJobById,
    cancelFeatureProcess,
    checkToolUpdates,
    createProject: createProjectRecord,
    deleteProject: deleteProjectRecord,
    ensureProjectExists,
    exportFeatureReport,
    handleToolMutation,
    refreshActiveProjectMetadata,
    refreshToolStatus,
    runFeatureProcess,
    updateAllTools
  } = deps;
  async function refresh(runtime, requestId) {
    await refreshToolStatus(runtime);
    return refreshActiveProjectMetadata(runtime, requestId);
  }
  async function createProject(runtime, featureId) {
    return createProjectRecord(runtime, featureId);
  }
  async function selectProject(runtime, requestId, featureId, actionPayload) {
    runtime.activeProjectId = asNonEmptyString(actionPayload["projectId"]);
    await ensureProjectExists(runtime, featureId);
    return refreshActiveProjectMetadata(runtime, requestId);
  }
  async function deleteProject(runtime, requestId, featureId, actionPayload) {
    return deleteProjectRecord(
      runtime,
      asNonEmptyString(actionPayload["projectId"]),
      requestId,
      featureId
    );
  }
  async function runProcess(api, runtime, requestId, featureId, workbenchSource) {
    return runFeatureProcess(api, runtime, requestId, featureId, workbenchSource);
  }
  async function cancelProcess(api, runtime, requestId, featureId, workbenchSource) {
    return cancelFeatureProcess(api, runtime, requestId, featureId, workbenchSource);
  }
  async function cancelJob(api, runtime, requestId, actionPayload) {
    const jobId = asNonEmptyString(actionPayload["jobId"]);
    if (jobId !== null) {
      await cancelJobById(api, runtime, jobId, requestId);
    }
    return refreshActiveProjectMetadata(runtime, requestId);
  }
  async function exportReport(api, runtime, requestId, featureId) {
    return exportFeatureReport(api, runtime, requestId, featureId);
  }
  async function mutateTool(api, runtime, requestId, action, actionPayload, featureStage) {
    await handleToolMutation(
      api,
      runtime,
      requestId,
      action,
      asNonEmptyString(actionPayload["toolId"]),
      featureStage || "source"
    );
    return refreshActiveProjectMetadata(runtime, requestId);
  }
  async function checkTool(api, runtime, requestId, actionPayload, featureStage) {
    const toolId = asNonEmptyString(actionPayload["toolId"]);
    if (toolId === null) {
      throw new Error("Tool id is required.");
    }
    await checkToolUpdates(api, runtime, requestId, toolId, featureStage || "source");
    return refreshActiveProjectMetadata(runtime, requestId);
  }
  async function updateTools(api, runtime, requestId, featureStage) {
    await updateAllTools(api, runtime, requestId, featureStage || "source");
    return refreshActiveProjectMetadata(runtime, requestId);
  }
  return {
    cancelJob,
    cancelProcess,
    checkTool,
    createProject,
    deleteProject,
    exportReport,
    mutateTool,
    refresh,
    runProcess,
    selectProject,
    updateTools
  };
}
