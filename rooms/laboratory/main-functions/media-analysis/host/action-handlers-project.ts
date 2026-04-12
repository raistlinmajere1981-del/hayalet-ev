type MediaProjectActionApi = Record<string, unknown>;
type MediaProjectRuntimeRecord = {
  activeProjectId?: string | null;
} & Record<string, unknown>;

type ProjectDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  cancelFeatureProcess: (
    api: MediaProjectActionApi,
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    featureId: string | null,
    workbenchSource?: unknown
  ) => Promise<unknown>;
  createProject: (runtime: MediaProjectRuntimeRecord, featureId: string | null) => Promise<unknown>;
  deleteProject: (
    runtime: MediaProjectRuntimeRecord,
    projectId: string | null,
    requestId: string,
    featureId: string | null
  ) => Promise<unknown>;
  ensureProjectExists: (
    runtime: MediaProjectRuntimeRecord,
    featureId: string | null
  ) => Promise<unknown>;
  exportFeatureReport: (
    api: MediaProjectActionApi,
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    featureId: string | null
  ) => Promise<unknown>;
  handleToolMutation: (
    api: MediaProjectActionApi,
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    action: string | null,
    toolId: string,
    featureStage: string | null
  ) => Promise<unknown>;
  refreshActiveProjectMetadata: (
    runtime: MediaProjectRuntimeRecord,
    requestId: string
  ) => Promise<unknown>;
  refreshToolStatus: (
    runtime: MediaProjectRuntimeRecord,
    options: { checkUpdates: boolean }
  ) => Promise<unknown>;
  runFeatureProcess: (
    api: MediaProjectActionApi,
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    featureId: string | null,
    workbenchSource?: unknown
  ) => Promise<unknown>;
};

export function createMediaProjectActionRuntime(deps: ProjectDeps) {
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

  async function refresh(
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    checkUpdates: boolean
  ) {
    await refreshToolStatus(runtime, {
      checkUpdates: checkUpdates === true,
    });
    return refreshActiveProjectMetadata(runtime, requestId);
  }

  async function createProject(runtime: MediaProjectRuntimeRecord, featureId: string | null) {
    return createProjectRecord(runtime, featureId);
  }

  async function selectProject(
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    featureId: string | null,
    actionPayload: Record<string, unknown>
  ) {
    runtime.activeProjectId = asNonEmptyString(actionPayload["projectId"]);
    await ensureProjectExists(runtime, featureId);
    return refreshActiveProjectMetadata(runtime, requestId);
  }

  async function deleteProject(
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    featureId: string | null,
    actionPayload: Record<string, unknown>
  ) {
    return deleteProjectRecord(
      runtime,
      asNonEmptyString(actionPayload["projectId"]),
      requestId,
      featureId
    );
  }

  async function runProcess(
    api: MediaProjectActionApi,
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    featureId: string | null,
    workbenchSource?: unknown
  ) {
    return runFeatureProcess(api, runtime, requestId, featureId, workbenchSource);
  }

  async function cancelProcess(
    api: MediaProjectActionApi,
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    featureId: string | null,
    workbenchSource?: unknown
  ) {
    return cancelFeatureProcess(api, runtime, requestId, featureId, workbenchSource);
  }

  async function exportReport(
    api: MediaProjectActionApi,
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    featureId: string | null
  ) {
    return exportFeatureReport(api, runtime, requestId, featureId);
  }

  async function mutateTool(
    api: MediaProjectActionApi,
    runtime: MediaProjectRuntimeRecord,
    requestId: string,
    action: string | null,
    actionPayload: Record<string, unknown>,
    featureStage: string
  ) {
    await handleToolMutation(
      api,
      runtime,
      requestId,
      action,
      asNonEmptyString(actionPayload["toolId"]) as string,
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
