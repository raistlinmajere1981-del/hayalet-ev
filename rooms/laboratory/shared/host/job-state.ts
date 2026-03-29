type LaboratoryJobStateRecord = {
  requestId: string | null;
  action: string;
  projectId: string | null;
  toolId: string | null;
  featureStage: string | null;
  stage: "queued";
  percent: number | null;
  message: string | null;
};

type LaboratoryRuntimeWithJobs = {
  jobs: Record<string, LaboratoryJobStateRecord | undefined>;
};

type LaboratoryJobRegistrationOptions = {
  jobId: string;
  requestId?: string | null;
  action: string;
  projectId?: string | null;
  toolId?: string | null;
  featureStage?: string | null;
};

type LaboratoryJobStateRuntimeDeps = {
  cancelRoomTool: (
    roomId: string,
    jobId: string,
    requestId: string,
  ) => Promise<unknown>;
  roomId: string;
};

export function createLaboratoryJobStateRuntime(
  deps: LaboratoryJobStateRuntimeDeps,
) {
  const { cancelRoomTool, roomId } = deps;

  function createRequestId() {
    return `lab-source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function registerJob(
    runtime: LaboratoryRuntimeWithJobs,
    options: LaboratoryJobRegistrationOptions,
  ): LaboratoryJobStateRecord {
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

  function clearJob(runtime: LaboratoryRuntimeWithJobs, jobId: string): void {
    delete runtime.jobs[jobId];
  }

  async function cancelJobsForProject(
    runtime: LaboratoryRuntimeWithJobs,
    projectId: string,
    requestId: string,
  ): Promise<void> {
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
