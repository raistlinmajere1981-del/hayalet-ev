type LaboratoryRecord = Record<string, unknown>;

type LaboratoryRuntimeEventsApi = {
  notifyRoom: (type: string, payload: LaboratoryRecord) => void;
};

type LaboratoryRuntimeEventsDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  defaultFeatureId: string;
  getFeatureIdFromContext: (context: unknown) => string;
  loadContext: (api: LaboratoryRuntimeEventsApi) => unknown;
  roomSnapshotRuntime: {
    buildMediaSnapshot: (runtime: unknown, featureId: string, workbenchSource?: unknown) => unknown;
  };
};

export function createLaboratoryRuntimeEvents(deps: LaboratoryRuntimeEventsDeps) {
  const {
    asNonEmptyString,
    defaultFeatureId,
    getFeatureIdFromContext,
    loadContext,
    roomSnapshotRuntime,
  } = deps;

  function toRecord(value: unknown): LaboratoryRecord {
    return value !== null && typeof value === "object" && Array.isArray(value) === false
      ? (value as LaboratoryRecord)
      : {};
  }

  function buildMediaSnapshot(runtime: unknown, featureId: string, workbenchSource: unknown = {}) {
    return roomSnapshotRuntime.buildMediaSnapshot(runtime, featureId, workbenchSource);
  }

  function buildSourceSnapshot(runtime: unknown) {
    return roomSnapshotRuntime.buildMediaSnapshot(runtime, defaultFeatureId);
  }

  function notifyRoom(
    api: LaboratoryRuntimeEventsApi,
    type: string,
    payload: LaboratoryRecord | null | undefined
  ) {
    api.notifyRoom(type, payload ?? {});
  }

  function isSourceCompatibleAction(action: unknown) {
    const actionId = asNonEmptyString(action);
    if (actionId === null) {
      return true;
    }
    return (
      actionId === "refresh" ||
      actionId === "tools-refresh" ||
      actionId.startsWith("source-") ||
      actionId.startsWith("subtitle-source-") ||
      actionId.startsWith("project-") ||
      actionId.startsWith("tool-")
    );
  }

  function pushMediaState(
    api: LaboratoryRuntimeEventsApi,
    runtime: unknown,
    requestId: string | null | undefined,
    action: unknown
  ) {
    const context = loadContext(api);
    const contextRecord = toRecord(context);
    const featureId = getFeatureIdFromContext(context);
    const payload = {
      requestId: requestId ?? null,
      action: asNonEmptyString(action),
      snapshot: buildMediaSnapshot(runtime, featureId, contextRecord["workbench"]),
    };

    notifyRoom(api, "media-state", payload);
    if (isSourceCompatibleAction(action)) {
      notifyRoom(api, "source-state", payload);
    }
  }

  function pushSourceState(
    api: LaboratoryRuntimeEventsApi,
    runtime: unknown,
    requestId: string | null | undefined,
    action: unknown
  ) {
    pushMediaState(api, runtime, requestId, action);
  }

  function pushActionResult(api: LaboratoryRuntimeEventsApi, payload: LaboratoryRecord) {
    notifyRoom(api, "media-action-result", payload);
    if (isSourceCompatibleAction(payload["action"])) {
      notifyRoom(api, "source-action-result", payload);
    }
  }

  function pushJobState(api: LaboratoryRuntimeEventsApi, payload: LaboratoryRecord) {
    notifyRoom(api, "media-job", payload);
    if (isSourceCompatibleAction(payload["action"])) {
      notifyRoom(api, "source-job", payload);
    }
  }

  return {
    buildMediaSnapshot,
    buildSourceSnapshot,
    isSourceCompatibleAction,
    notifyRoom,
    pushActionResult,
    pushJobState,
    pushMediaState,
    pushSourceState,
  };
}
