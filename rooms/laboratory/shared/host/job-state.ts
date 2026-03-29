// @ts-nocheck
export function createLaboratoryJobStateRuntime(deps) {
  const { cancelRoomTool, roomId } = deps;

  function createRequestId() {
    return `lab-source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function registerJob(runtime, options) {
    runtime.jobs[options.jobId] = {
      requestId: options.requestId || null,
      action: options.action,
      projectId: options.projectId || null,
      toolId: options.toolId || null,
      featureStage: options.featureStage || null,
      stage: "queued",
      percent: null,
      message: null,
    };
    return runtime.jobs[options.jobId];
  }

  function clearJob(runtime, jobId) {
    delete runtime.jobs[jobId];
  }

  async function cancelJobsForProject(runtime, projectId, requestId) {
    const jobIds = Object.keys(runtime.jobs);
    for (let index = 0; index < jobIds.length; index += 1) {
      const jobId = jobIds[index];
      const job = runtime.jobs[jobId];
      if (job && job.projectId === projectId) {
        await cancelRoomTool(roomId, jobId, requestId);
        clearJob(runtime, jobId);
      }
    }
  }

  return {
    cancelJobsForProject,
    clearJob,
    createRequestId,
    registerJob,
  };
}
