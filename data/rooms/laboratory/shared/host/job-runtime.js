export function createLaboratoryJobRuntime(deps) {
  const { roomId, toRecord, cancelRoomTool, clearJob, pushJobState } = deps;
  function collectJobs(runtime, predicate) {
    return Object.keys(runtime.jobs).map(function(jobId) {
      return {
        jobId,
        ...toRecord(runtime.jobs[jobId])
      };
    }).filter(predicate);
  }
  function cancelFeatureJobs(api, runtime, activeJobs, requestId, resolveFeatureStage) {
    return Promise.all(
      activeJobs.map(async function(job) {
        await cancelRoomTool(roomId, job.jobId, requestId);
        pushJobState(api, {
          requestId,
          jobId: job.jobId,
          action: job.action,
          projectId: job.projectId,
          toolId: job.toolId,
          featureStage: typeof resolveFeatureStage === "function" ? resolveFeatureStage(job) : resolveFeatureStage,
          stage: "cancelled",
          message: "Cancelled by operator."
        });
        clearJob(runtime, job.jobId);
      })
    );
  }
  function getActiveProfileJobs(runtime, projectId, actionId) {
    return collectJobs(runtime, function(job) {
      return job.projectId === projectId && String(job.action || "").startsWith("profile-") && (actionId ? job.action === actionId : true);
    });
  }
  function ensureProfileJobSlotAvailable(runtime, projectId, actionId) {
    const activeJobs = getActiveProfileJobs(runtime, projectId, actionId);
    if (activeJobs.length > 0) {
      throw new Error("This profile job is already running. Cancel it before starting another one.");
    }
  }
  async function cancelProfileJobsForProject(api, runtime, projectId, requestId, actionId) {
    const activeJobs = getActiveProfileJobs(runtime, projectId, actionId);
    await cancelFeatureJobs(api, runtime, activeJobs, requestId, "profile");
    return activeJobs;
  }
  function getActiveEditJobs(runtime, projectId, actionId) {
    return collectJobs(runtime, function(job) {
      return job.projectId === projectId && String(job.action || "").startsWith("edit-") && (actionId ? job.action === actionId : true);
    });
  }
  function ensureEditJobSlotAvailable(runtime, projectId, actionId) {
    const activeJobs = getActiveEditJobs(runtime, projectId, actionId);
    if (activeJobs.length > 0) {
      throw new Error("This edit job is already running. Cancel it before starting another one.");
    }
  }
  async function cancelEditJobsForProject(api, runtime, projectId, requestId, actionId) {
    const activeJobs = getActiveEditJobs(runtime, projectId, actionId);
    await cancelFeatureJobs(api, runtime, activeJobs, requestId, function(job) {
      return job.featureStage || "edit";
    });
    return activeJobs;
  }
  function getActiveProcessJobs(runtime, projectId, actionId) {
    return collectJobs(runtime, function(job) {
      return job.projectId === projectId && String(job.featureStage || "") === "process" && (actionId ? job.action === actionId : true);
    });
  }
  function ensureProcessJobSlotAvailable(runtime, projectId, actionId) {
    const activeJobs = getActiveProcessJobs(runtime, projectId, actionId);
    if (activeJobs.length > 0) {
      throw new Error("This process job is already running. Cancel it before starting another one.");
    }
  }
  async function cancelProcessJobsForProject(api, runtime, projectId, requestId, actionId) {
    const activeJobs = getActiveProcessJobs(runtime, projectId, actionId);
    await cancelFeatureJobs(api, runtime, activeJobs, requestId, "process");
    return activeJobs;
  }
  function getActiveReportJobs(runtime, projectId, actionId) {
    return collectJobs(runtime, function(job) {
      return job.projectId === projectId && String(job.featureStage || "") === "report" && (actionId ? job.action === actionId : true);
    });
  }
  function ensureReportJobSlotAvailable(runtime, projectId, actionId) {
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
    ensureReportJobSlotAvailable
  };
}
