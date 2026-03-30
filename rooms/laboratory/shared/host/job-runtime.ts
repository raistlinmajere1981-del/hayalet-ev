type JobRuntimeDeps = {
  roomId: string;
  toRecord: (value: unknown) => Record<string, unknown>;
  cancelRoomTool: (roomId: string, jobId: string, requestId: string) => Promise<unknown>;
  clearJob: (runtime: Record<string, unknown>, jobId: string) => void;
  pushJobState: (api: unknown, payload: Record<string, unknown>) => void;
};

type JobRuntime = {
  jobs: Record<string, unknown>;
};

type JobEntry = {
  jobId: string;
  action: string | null;
  projectId: string | null;
  toolId: string | null;
  featureStage: string | null;
};

export function createLaboratoryJobRuntime(deps: JobRuntimeDeps) {
  const { roomId, toRecord, cancelRoomTool, clearJob, pushJobState } = deps;

  function collectJobs(runtime: JobRuntime, predicate: (job: JobEntry) => boolean): JobEntry[] {
    return Object.keys(runtime.jobs)
      .map(function (jobId: any) {
        return {
          jobId: jobId,
          ...toRecord(runtime.jobs[jobId]),
        } as JobEntry;
      })
      .filter(predicate);
  }

  function cancelFeatureJobs(
    api: unknown,
    runtime: JobRuntime,
    activeJobs: JobEntry[],
    requestId: string,
    resolveFeatureStage: string | ((job: JobEntry) => string)
  ) {
    return Promise.all(
      activeJobs.map(async function (job: JobEntry) {
        await cancelRoomTool(roomId, job.jobId, requestId);
        pushJobState(api, {
          requestId: requestId,
          jobId: job.jobId,
          action: job.action,
          projectId: job.projectId,
          toolId: job.toolId,
          featureStage:
            typeof resolveFeatureStage === "function"
              ? resolveFeatureStage(job)
              : resolveFeatureStage,
          stage: "cancelled",
          message: "Cancelled by operator.",
        });
        clearJob(runtime, job.jobId);
      })
    );
  }

  function getActiveProfileJobs(
    runtime: JobRuntime,
    projectId: string,
    actionId: string | undefined
  ) {
    return collectJobs(runtime, function (job: JobEntry) {
      return (
        job.projectId === projectId &&
        String(job.action || "").startsWith("profile-") &&
        (actionId ? job.action === actionId : true)
      );
    });
  }

  function ensureProfileJobSlotAvailable(
    runtime: JobRuntime,
    projectId: string,
    actionId: string | undefined
  ) {
    const activeJobs = getActiveProfileJobs(runtime, projectId, actionId);
    if (activeJobs.length > 0) {
      throw new Error(
        "This profile job is already running. Cancel it before starting another one."
      );
    }
  }

  async function cancelProfileJobsForProject(
    api: unknown,
    runtime: JobRuntime,
    projectId: string,
    requestId: string,
    actionId: string | undefined
  ) {
    const activeJobs = getActiveProfileJobs(runtime, projectId, actionId);
    await cancelFeatureJobs(api, runtime, activeJobs, requestId, "profile");
    return activeJobs;
  }

  function getActiveEditJobs(runtime: JobRuntime, projectId: string, actionId: string | undefined) {
    return collectJobs(runtime, function (job: JobEntry) {
      return (
        job.projectId === projectId &&
        String(job.action || "").startsWith("edit-") &&
        (actionId ? job.action === actionId : true)
      );
    });
  }

  function ensureEditJobSlotAvailable(
    runtime: JobRuntime,
    projectId: string,
    actionId: string | undefined
  ) {
    const activeJobs = getActiveEditJobs(runtime, projectId, actionId);
    if (activeJobs.length > 0) {
      throw new Error("This edit job is already running. Cancel it before starting another one.");
    }
  }

  async function cancelEditJobsForProject(
    api: unknown,
    runtime: JobRuntime,
    projectId: string,
    requestId: string,
    actionId: string | undefined
  ) {
    const activeJobs = getActiveEditJobs(runtime, projectId, actionId);
    await cancelFeatureJobs(api, runtime, activeJobs, requestId, function (job: JobEntry) {
      return job.featureStage || "edit";
    });
    return activeJobs;
  }

  function getActiveProcessJobs(
    runtime: JobRuntime,
    projectId: string,
    actionId: string | undefined
  ) {
    return collectJobs(runtime, function (job: JobEntry) {
      return (
        job.projectId === projectId &&
        String(job.featureStage || "") === "process" &&
        (actionId ? job.action === actionId : true)
      );
    });
  }

  function ensureProcessJobSlotAvailable(
    runtime: JobRuntime,
    projectId: string,
    actionId: string | undefined
  ) {
    const activeJobs = getActiveProcessJobs(runtime, projectId, actionId);
    if (activeJobs.length > 0) {
      throw new Error(
        "This process job is already running. Cancel it before starting another one."
      );
    }
  }

  async function cancelProcessJobsForProject(
    api: unknown,
    runtime: JobRuntime,
    projectId: string,
    requestId: string,
    actionId: string | undefined
  ) {
    const activeJobs = getActiveProcessJobs(runtime, projectId, actionId);
    await cancelFeatureJobs(api, runtime, activeJobs, requestId, "process");
    return activeJobs;
  }

  function getActiveReportJobs(
    runtime: JobRuntime,
    projectId: string,
    actionId: string | undefined
  ) {
    return collectJobs(runtime, function (job: JobEntry) {
      return (
        job.projectId === projectId &&
        String(job.featureStage || "") === "report" &&
        (actionId ? job.action === actionId : true)
      );
    });
  }

  function ensureReportJobSlotAvailable(
    runtime: JobRuntime,
    projectId: string,
    actionId: string | undefined
  ) {
    const activeJobs = getActiveReportJobs(runtime, projectId, actionId);
    if (activeJobs.length > 0) {
      throw new Error("This report job is already running. Wait for it or cancel it first.");
    }
  }

  return {
    cancelEditJobsForProject,
    cancelProcessJobsForProject,
    cancelProfileJobsForProject,
    ensureEditJobSlotAvailable,
    ensureProcessJobSlotAvailable,
    ensureProfileJobSlotAvailable,
    ensureReportJobSlotAvailable,
  };
}
