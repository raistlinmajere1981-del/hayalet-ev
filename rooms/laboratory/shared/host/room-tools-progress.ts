type LaboratoryRecord = Record<string, unknown>;

type LaboratoryJobRecord = LaboratoryRecord & {
  action: string | null;
  bytesReceived: number | null;
  bytesTotal: number | null;
  featureStage: string | null;
  message: string | null;
  operation: string | null;
  percent: number | null;
  projectId: string | null;
  requestId: string | null;
  stage: string | null;
  toolId: string | null;
};

type LaboratoryRuntimeWithJobs = LaboratoryRecord & {
  jobs: Record<string, LaboratoryJobRecord | undefined>;
  roomToolsProgressHandler: ((eventPayload: unknown) => void) | null;
  roomToolsSubscribed: boolean;
};

type LaboratoryRoomToolsEventPayload = LaboratoryRecord & {
  action?: unknown;
  bytesReceived?: unknown;
  bytesTotal?: unknown;
  chunk?: unknown;
  featureStage?: unknown;
  jobId?: unknown;
  message?: unknown;
  operation?: unknown;
  percent?: unknown;
  projectId?: unknown;
  requestId?: unknown;
  roomId?: unknown;
  stage?: unknown;
  toolId?: unknown;
};

type LaboratoryRoomToolsProgressPayload = {
  action: string | null;
  bytesReceived: number | null;
  bytesTotal: number | null;
  featureStage: string | null;
  jobId: string;
  message: string | null;
  operation: string | null;
  percent: number | null;
  projectId: string | null;
  requestId: string | null;
  stage: string | null;
  toolId: string | null;
};

type LaboratoryElectronApi = {
  offRoomToolsProgress?: ((handler: (eventPayload: unknown) => void) => void) | undefined;
  onRoomToolsProgress?: ((handler: (eventPayload: unknown) => void) => void) | undefined;
};

type LaboratoryRoomToolsProgressRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  getElectronApi: () => LaboratoryElectronApi | null;
  pushJobState: (api: unknown, payload: LaboratoryRoomToolsProgressPayload) => void;
  pushSourceState: (
    api: unknown,
    runtime: LaboratoryRuntimeWithJobs,
    requestId: string | null,
    action: string | null
  ) => void;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryRoomToolsProgressRuntime(
  deps: LaboratoryRoomToolsProgressRuntimeDeps
) {
  const roomId = deps.roomId;
  const asNonEmptyString = deps.asNonEmptyString;
  const toRecord = deps.toRecord;
  const getElectronApi = deps.getElectronApi;
  const pushJobState = deps.pushJobState;
  const pushSourceState = deps.pushSourceState;

  function updateJobFromProgress(
    runtime: LaboratoryRuntimeWithJobs,
    eventPayload: LaboratoryRoomToolsEventPayload
  ): LaboratoryRoomToolsProgressPayload | null {
    const jobId = asNonEmptyString(eventPayload.jobId);
    if (!jobId || !runtime.jobs[jobId]) {
      return null;
    }

    const job = runtime.jobs[jobId];
    job.stage = asNonEmptyString(eventPayload.stage) || job.stage;
    job.operation = asNonEmptyString(eventPayload.operation) || job.operation;
    if (typeof eventPayload.bytesReceived === "number") {
      job.bytesReceived = eventPayload.bytesReceived;
    }
    if (typeof eventPayload.bytesTotal === "number") {
      job.bytesTotal = eventPayload.bytesTotal;
    }
    if (typeof eventPayload.percent === "number") {
      job.percent = eventPayload.percent;
    } else if (
      typeof eventPayload.bytesReceived === "number" &&
      typeof eventPayload.bytesTotal === "number" &&
      eventPayload.bytesTotal > 0
    ) {
      job.percent = Math.round((eventPayload.bytesReceived / eventPayload.bytesTotal) * 100);
    }
    job.message = asNonEmptyString(eventPayload.message) || job.message;

    if (
      asNonEmptyString(eventPayload.operation) === "tool-run" &&
      (eventPayload.stage === "stdout" || eventPayload.stage === "stderr")
    ) {
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
      jobId: jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: job.featureStage || null,
      operation: job.operation || null,
      stage: job.stage,
      percent: job.percent,
      bytesReceived: job.bytesReceived,
      bytesTotal: job.bytesTotal,
      message: job.message,
    };
  }

  function ensureRoomToolsSubscription(api: unknown, runtime: LaboratoryRuntimeWithJobs): void {
    const electronApi = getElectronApi();
    if (
      runtime.roomToolsSubscribed === true ||
      electronApi === null ||
      typeof electronApi.onRoomToolsProgress !== "function"
    ) {
      return;
    }

    runtime.roomToolsProgressHandler = function (eventPayload: unknown) {
      const payload = toRecord(eventPayload) as LaboratoryRoomToolsEventPayload;
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

  function tearDownRoomToolsSubscription(runtime: LaboratoryRuntimeWithJobs): void {
    const electronApi = getElectronApi();
    if (
      runtime.roomToolsSubscribed !== true ||
      electronApi === null ||
      typeof electronApi.offRoomToolsProgress !== "function" ||
      typeof runtime.roomToolsProgressHandler !== "function"
    ) {
      return;
    }

    electronApi.offRoomToolsProgress(runtime.roomToolsProgressHandler);
    runtime.roomToolsProgressHandler = null;
    runtime.roomToolsSubscribed = false;
  }

  return {
    ensureRoomToolsSubscription: ensureRoomToolsSubscription,
    tearDownRoomToolsSubscription: tearDownRoomToolsSubscription,
    updateJobFromProgress: updateJobFromProgress,
  };
}
