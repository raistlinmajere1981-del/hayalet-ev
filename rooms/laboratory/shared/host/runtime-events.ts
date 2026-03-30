export function createLaboratoryRuntimeEvents(deps: any) {
  const {
    asNonEmptyString,
    defaultFeatureId,
    getFeatureIdFromContext,
    loadContext,
    roomSnapshotRuntime,
  } = deps;

  function buildMediaSnapshot(runtime: any, featureId: any) {
    return roomSnapshotRuntime.buildMediaSnapshot(runtime, featureId);
  }

  function buildSourceSnapshot(runtime: any) {
    return roomSnapshotRuntime.buildMediaSnapshot(runtime, defaultFeatureId);
  }

  function notifyRoom(api: any, type: any, payload: any) {
    api.notifyRoom(type, payload || {});
  }

  function isSourceCompatibleAction(action: any) {
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

  function pushMediaState(api: any, runtime: any, requestId: any, action: any) {
    const featureId = getFeatureIdFromContext(loadContext(api));
    const payload = {
      requestId: requestId || null,
      action: action || null,
      snapshot: buildMediaSnapshot(runtime, featureId),
    };

    notifyRoom(api, "media-state", payload);
    if (isSourceCompatibleAction(action)) {
      notifyRoom(api, "source-state", payload);
    }
  }

  function pushSourceState(api: any, runtime: any, requestId: any, action: any) {
    pushMediaState(api, runtime, requestId, action);
  }

  function pushActionResult(api: any, payload: any) {
    notifyRoom(api, "media-action-result", payload);
    if (isSourceCompatibleAction(payload && payload.action)) {
      notifyRoom(api, "source-action-result", payload);
    }
  }

  function pushJobState(api: any, payload: any) {
    notifyRoom(api, "media-job", payload);
    if (isSourceCompatibleAction(payload && payload.action)) {
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
