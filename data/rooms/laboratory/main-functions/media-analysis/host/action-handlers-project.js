import { removeLabAssetById } from "../../../shared/host/lab-assets.js";
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
    patchActiveProject,
    refreshActiveProjectMetadata,
    refreshToolStatus,
    runFeatureProcess,
    updateAllTools
  } = deps;
  async function refresh(runtime, requestId) {
    runtime.activeProjectId = null;
    await refreshToolStatus(runtime);
    return refreshActiveProjectMetadata(runtime, requestId);
  }
  async function refreshTools(runtime) {
    return refreshToolStatus(runtime);
  }
  async function createProject(runtime, featureId) {
    return createProjectRecord(runtime, featureId);
  }
  async function clearProject(runtime, requestId) {
    runtime.activeProjectId = null;
    return refreshActiveProjectMetadata(runtime, requestId);
  }
  async function selectProject(runtime, requestId, featureId, actionPayload) {
    const rawResetSourceState = actionPayload["resetSourceState"];
    const resetSourceState = typeof rawResetSourceState === "object" && rawResetSourceState !== null ? rawResetSourceState : null;
    runtime.activeProjectId = asNonEmptyString(actionPayload["projectId"]);
    await ensureProjectExists(runtime, featureId);
    if (resetSourceState !== null && Object.keys(resetSourceState).length > 0) {
      await patchActiveProject(runtime, function(project) {
        return {
          ...project,
          source: {
            ...resetSourceState
          }
        };
      });
    }
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
  async function renameProject(runtime, requestId, _featureId, actionPayload) {
    const newName = asNonEmptyString(actionPayload["name"]);
    if (newName) {
      await deps.patchActiveProject(runtime, function(project) {
        return {
          ...project,
          name: newName
        };
      });
    }
    return refreshActiveProjectMetadata(runtime, requestId);
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
  async function removeAsset(runtime, requestId, actionPayload) {
    const assetId = asNonEmptyString(actionPayload["assetId"]) || asNonEmptyString(actionPayload["id"]);
    if (assetId === null) {
      throw new Error("Asset id is required.");
    }
    await patchActiveProject(runtime, function(project) {
      return {
        ...project,
        assets: removeLabAssetById(project["assets"], assetId)
      };
    });
    return refreshActiveProjectMetadata(runtime, requestId);
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
    return null;
  }
  async function checkTool(api, runtime, requestId, actionPayload, featureStage) {
    const toolId = asNonEmptyString(actionPayload["toolId"]);
    if (toolId === null) {
      throw new Error("Tool id is required.");
    }
    await checkToolUpdates(api, runtime, requestId, toolId, featureStage || "source");
    return null;
  }
  async function updateTools(api, runtime, requestId, featureStage) {
    await updateAllTools(api, runtime, requestId, featureStage || "source");
    return null;
  }
  return {
    cancelJob,
    cancelProcess,
    checkTool,
    clearProject,
    createProject,
    deleteProject,
    exportReport,
    mutateTool,
    removeAsset,
    refresh,
    refreshTools,
    renameProject,
    runProcess,
    selectProject,
    updateTools
  };
}
