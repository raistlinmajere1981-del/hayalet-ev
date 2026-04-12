export function createLaboratoryRoomToolsProgressRuntime(deps) {
  const roomId = deps.roomId;
  const asNonEmptyString = deps.asNonEmptyString;
  const toRecord = deps.toRecord;
  const getElectronApi = deps.getElectronApi;
  const pushJobState = deps.pushJobState;
  const pushSourceState = deps.pushSourceState;
  function updateJobFromProgress(runtime, eventPayload) {
    const jobId = asNonEmptyString(eventPayload.jobId);
    if (!jobId || !runtime.jobs[jobId]) {
      return null;
    }
    const job = runtime.jobs[jobId];
    job.stage = asNonEmptyString(eventPayload.stage) || job.stage;
    if (typeof eventPayload.percent === "number") {
      job.percent = eventPayload.percent;
    } else if (typeof eventPayload.bytesReceived === "number" && typeof eventPayload.bytesTotal === "number" && eventPayload.bytesTotal > 0) {
      job.percent = Math.round(eventPayload.bytesReceived / eventPayload.bytesTotal * 100);
    }
    job.message = asNonEmptyString(eventPayload.message) || job.message;
    if (asNonEmptyString(eventPayload.operation) === "tool-run" && (eventPayload.stage === "stdout" || eventPayload.stage === "stderr")) {
      const chunk = asNonEmptyString(eventPayload.chunk);
      if (chunk) {
        const match = chunk.match(/(\d{1,3}(?:\.\d+)?)%/);
        if (match) {
          job.percent = Number(match[1]);
        }
      }
    }
    return {
      requestId: job.requestId,
      jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: job.featureStage || null,
      stage: job.stage,
      percent: job.percent,
      message: job.message
    };
  }
  function ensureRoomToolsSubscription(api, runtime) {
    const electronApi = getElectronApi();
    if (runtime.roomToolsSubscribed === true || electronApi === null || typeof electronApi.onRoomToolsProgress !== "function") {
      return;
    }
    runtime.roomToolsProgressHandler = function(eventPayload) {
      const payload = toRecord(eventPayload);
      if (!eventPayload || payload.roomId !== roomId) {
        return;
      }
      const nextJobPayload = updateJobFromProgress(runtime, payload);
      if (!nextJobPayload) {
        return;
      }
      pushJobState(api, nextJobPayload);
      pushSourceState(api, runtime, nextJobPayload.requestId, nextJobPayload.action);
    };
    electronApi.onRoomToolsProgress(runtime.roomToolsProgressHandler);
    runtime.roomToolsSubscribed = true;
  }
  function tearDownRoomToolsSubscription(runtime) {
    const electronApi = getElectronApi();
    if (runtime.roomToolsSubscribed !== true || electronApi === null || typeof electronApi.offRoomToolsProgress !== "function" || typeof runtime.roomToolsProgressHandler !== "function") {
      return;
    }
    electronApi.offRoomToolsProgress(runtime.roomToolsProgressHandler);
    runtime.roomToolsProgressHandler = null;
    runtime.roomToolsSubscribed = false;
  }
  return {
    ensureRoomToolsSubscription,
    tearDownRoomToolsSubscription,
    updateJobFromProgress
  };
}
