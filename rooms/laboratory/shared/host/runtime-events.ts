export function createLaboratoryRuntimeEvents(deps) {
  const {
    asNonEmptyString,
    defaultFeatureId,
    getFeatureIdFromContext,
    loadContext,
    roomSnapshotRuntime,
  } = deps;

  function buildMediaSnapshot(runtime, featureId) {
    return roomSnapshotRuntime.buildMediaSnapshot(runtime, featureId);
  }

  function buildSourceSnapshot(runtime) {
    return roomSnapshotRuntime.buildMediaSnapshot(runtime, defaultFeatureId);
  }

  function notifyRoom(api, type, payload) {
    api.notifyRoom(type, payload || {});
  }

  function isSourceCompatibleAction(action) {
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

  function pushMediaState(api, runtime, requestId, action) {
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

  function pushSourceState(api, runtime, requestId, action) {
    pushMediaState(api, runtime, requestId, action);
  }

  function pushActionResult(api, payload) {
    notifyRoom(api, "media-action-result", payload);
    if (isSourceCompatibleAction(payload && payload.action)) {
      notifyRoom(api, "source-action-result", payload);
    }
  }

  function pushJobState(api, payload) {
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
