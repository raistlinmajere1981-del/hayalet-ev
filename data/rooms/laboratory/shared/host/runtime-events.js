function getEventSeverity(stage) {
  if (stage === "failed") {
    return "error";
  }
  if (stage === "cancelled") {
    return "warning";
  }
  if (stage === "completed") {
    return "success";
  }
  return "info";
}
function getActionLabel(action) {
  switch (action) {
    case null:
      return "İşlem";
    case "source-download-url":
      return "URL kaynağı indiriliyor";
    case "source-download-youtube":
      return "YouTube kaynağı hazırlanıyor";
    case "source-pick-local":
      return "Yerel kaynak içeri alınıyor";
    case "edit-preview":
    case "subtitle-edit-preview":
      return "Önizleme hazırlanıyor";
    case "profile-run-preflight":
      return "Ön kontrol çalışıyor";
    case "process-run":
    case "audio-process-run":
      return "Analiz çalışıyor";
    case "process-cancel":
    case "audio-process-cancel":
      return "Analiz iptal ediliyor";
    case "report-export":
    case "audio-report-export":
      return "Rapor dışa aktarılıyor";
    case "tool-install":
      return "Araç kurulumu çalışıyor";
    case "tool-update":
      return "Araç güncellemesi çalışıyor";
    case "tool-check-updates":
      return "Araç güncellemesi kontrol ediliyor";
    default:
      return action || "İşlem";
  }
}
export function createLaboratoryRuntimeEvents(deps) {
  const {
    asNonEmptyString,
    defaultFeatureId,
    getFeatureIdFromContext,
    loadContext,
    roomSnapshotRuntime
  } = deps;
  function toRecord(value) {
    return value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
  }
  function buildMediaSnapshot(runtime, featureId, workbenchSource = {}) {
    return roomSnapshotRuntime.buildMediaSnapshot(runtime, featureId, workbenchSource);
  }
  function buildSourceSnapshot(runtime) {
    return roomSnapshotRuntime.buildMediaSnapshot(runtime, defaultFeatureId);
  }
  function notifyRoom(api, type, payload) {
    api.notifyRoom(type, payload ?? {});
  }
  function emitEvent(api, payload) {
    notifyRoom(api, "lab-event", {
      id: typeof payload["id"] === "string" ? payload["id"] : `lab-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: typeof payload["kind"] === "string" ? payload["kind"] : "activity",
      severity: typeof payload["severity"] === "string" ? payload["severity"] : getEventSeverity(asNonEmptyString(payload["stage"])),
      message: typeof payload["message"] === "string" ? payload["message"] : getActionLabel(asNonEmptyString(payload["action"])),
      detail: typeof payload["detail"] === "string" ? payload["detail"] : null,
      timestamp: typeof payload["timestamp"] === "number" ? payload["timestamp"] : Date.now(),
      source: typeof payload["source"] === "string" ? payload["source"] : "host",
      action: asNonEmptyString(payload["action"]),
      stage: asNonEmptyString(payload["stage"]),
      scope: payload["scope"] === "run" || asNonEmptyString(payload["featureStage"]) === "process" ? "run" : "global",
      moduleId: asNonEmptyString(payload["moduleId"]),
      rawLine: typeof payload["rawLine"] === "string" ? payload["rawLine"] : null
    });
  }
  function buildJobEventPayload(payload) {
    const action = asNonEmptyString(payload["action"]);
    const stage = asNonEmptyString(payload["stage"]);
    const detail = asNonEmptyString(payload["message"]);
    const baseLabel = getActionLabel(action);
    return {
      kind: payload["kind"],
      severity: getEventSeverity(stage),
      message: stage === "queued" ? `${baseLabel} kuyruğa alındı` : stage === "completed" ? `${baseLabel} tamamlandı` : stage === "failed" ? `${baseLabel} hata verdi` : stage === "cancelled" ? `${baseLabel} iptal edildi` : `${baseLabel} başladı`,
      detail,
      action,
      stage,
      moduleId: asNonEmptyString(payload["moduleId"]),
      scope: asNonEmptyString(payload["featureStage"]) === "process" || String(action || "").includes("process") ? "run" : "global"
    };
  }
  function buildActionResultEventPayload(payload) {
    const action = asNonEmptyString(payload["action"]);
    const success = payload["success"] === true;
    return {
      kind: "request-result",
      severity: success ? "success" : "error",
      message: success ? `${getActionLabel(action)} tamamlandı` : `${getActionLabel(action)} hata verdi`,
      detail: asNonEmptyString(payload["error"]) || asNonEmptyString(payload["message"]),
      action,
      stage: success ? "completed" : "failed",
      scope: String(action || "").includes("process") ? "run" : "global"
    };
  }
  function isSourceCompatibleAction(action) {
    const actionId = asNonEmptyString(action);
    if (actionId === null) {
      return true;
    }
    return actionId === "refresh" || actionId === "tools-refresh" || actionId.startsWith("source-") || actionId.startsWith("subtitle-source-") || actionId.startsWith("project-") || actionId.startsWith("tool-");
  }
  function pushMediaState(api, runtime, requestId, action) {
    const context = loadContext(api);
    const contextRecord = toRecord(context);
    const featureId = getFeatureIdFromContext(context);
    const payload = {
      requestId: requestId ?? null,
      action: asNonEmptyString(action),
      snapshot: buildMediaSnapshot(runtime, featureId, contextRecord["workbench"])
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
    emitEvent(api, buildActionResultEventPayload(payload));
  }
  function pushJobState(api, payload) {
    if (payload["suppressCanonicalEvent"] !== true) {
      emitEvent(api, buildJobEventPayload(payload));
    }
  }
  return {
    buildMediaSnapshot,
    buildSourceSnapshot,
    emitEvent,
    isSourceCompatibleAction,
    notifyRoom,
    pushActionResult,
    pushJobState,
    pushMediaState,
    pushSourceState
  };
}
