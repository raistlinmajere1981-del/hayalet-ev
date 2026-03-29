export function createMediaProjectActionRuntime(deps) {
  const {
    asNonEmptyString,
    cancelFeatureProcess,
    createProject: createProjectRecord,
    deleteProject: deleteProjectRecord,
    ensureProjectExists,
    exportFeatureReport,
    handleToolMutation,
    refreshActiveProjectMetadata,
    refreshToolStatus,
    runFeatureProcess,
  } = deps;

  async function refresh(runtime, requestId, checkUpdates) {
    await refreshToolStatus(runtime, {
      checkUpdates: checkUpdates === true,
    });
    return refreshActiveProjectMetadata(runtime, requestId);
  }

  async function createProject(runtime, featureId) {
    return createProjectRecord(runtime, featureId);
  }

  async function selectProject(runtime, requestId, featureId, actionPayload) {
    runtime.activeProjectId = asNonEmptyString(actionPayload.projectId);
    await ensureProjectExists(runtime, featureId);
    return refreshActiveProjectMetadata(runtime, requestId);
  }

  async function deleteProject(runtime, requestId, featureId, actionPayload) {
    return deleteProjectRecord(runtime, asNonEmptyString(actionPayload.projectId), requestId, featureId);
  }

  async function runProcess(api, runtime, requestId, featureId) {
    return runFeatureProcess(api, runtime, requestId, featureId);
  }

  async function cancelProcess(api, runtime, requestId, featureId) {
    return cancelFeatureProcess(api, runtime, requestId, featureId);
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
      asNonEmptyString(actionPayload.toolId),
      featureStage || "source"
    );
    return refreshActiveProjectMetadata(runtime, requestId);
  }

  return {
    cancelProcess,
    createProject,
    deleteProject,
    exportReport,
    mutateTool,
    refresh,
    runProcess,
    selectProject,
  };
}
