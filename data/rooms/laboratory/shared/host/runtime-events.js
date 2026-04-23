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
function isCustomProcessEventKind(kind) {
  return kind === "analysis-scope-updated" || kind === "live-finding" || kind === "preview-artifact" || kind === "module-progress" || kind === "module-warning" || kind === "module-artifact" || kind === "interactive-adjustment-applied";
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
  const throttleState = /* @__PURE__ */ new Map();
  const throttleWindowMs = 500;
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
  function buildThrottleKey(api, payload) {
    const throttleWindow = asNonEmptyString(payload["throttleWindow"]);
    const kind = asNonEmptyString(payload["kind"]);
    if (throttleWindow === null || kind === null || isCustomProcessEventKind(kind) !== true) {
      return null;
    }
    const featureId = getFeatureIdFromContext(loadContext(api));
    const moduleId = asNonEmptyString(payload["moduleId"]) || "global";
    return `${featureId}:${kind}:${moduleId}:${throttleWindow}`;
  }
  function applyThrottleMetadata(api, payload) {
    const throttleKey = buildThrottleKey(api, payload);
    if (throttleKey === null) {
      return payload;
    }
    const nextTimestamp = typeof payload["timestamp"] === "number" ? payload["timestamp"] : Date.now();
    const currentEntry = throttleState.get(throttleKey) || {
      lastEmittedAt: 0,
      suppressedCount: 0
    };
    if (currentEntry.lastEmittedAt > 0 && nextTimestamp - currentEntry.lastEmittedAt < throttleWindowMs) {
      throttleState.set(throttleKey, {
        lastEmittedAt: currentEntry.lastEmittedAt,
        suppressedCount: currentEntry.suppressedCount + 1
      });
      return null;
    }
    const batchedCount = currentEntry.suppressedCount + 1;
    throttleState.set(throttleKey, {
      lastEmittedAt: nextTimestamp,
      suppressedCount: 0
    });
    if (batchedCount <= 1) {
      return payload;
    }
    const detail = asNonEmptyString(payload["detail"]);
    return {
      ...payload,
      batchedCount,
      detail: detail !== null ? `${detail} (${batchedCount} updates batched)` : `${batchedCount} updates batched.`
    };
  }
  function emitEvent(api, payload) {
    const throttledPayload = applyThrottleMetadata(api, payload);
    if (throttledPayload === null) {
      return;
    }
    notifyRoom(api, "lab-event", {
      ...throttledPayload,
      id: typeof throttledPayload["id"] === "string" ? throttledPayload["id"] : `lab-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: typeof throttledPayload["kind"] === "string" ? throttledPayload["kind"] : "activity",
      severity: typeof throttledPayload["severity"] === "string" ? throttledPayload["severity"] : getEventSeverity(asNonEmptyString(throttledPayload["stage"])),
      message: typeof throttledPayload["message"] === "string" ? throttledPayload["message"] : getActionLabel(asNonEmptyString(throttledPayload["action"])),
      detail: typeof throttledPayload["detail"] === "string" ? throttledPayload["detail"] : null,
      timestamp: typeof throttledPayload["timestamp"] === "number" ? throttledPayload["timestamp"] : Date.now(),
      source: typeof throttledPayload["source"] === "string" ? throttledPayload["source"] : "host",
      action: asNonEmptyString(throttledPayload["action"]),
      stage: asNonEmptyString(throttledPayload["stage"]),
      scope: throttledPayload["scope"] === "run" || String(asNonEmptyString(throttledPayload["action"]) || "").includes("process") ? "run" : "global",
      moduleId: asNonEmptyString(throttledPayload["moduleId"]),
      rawLine: typeof throttledPayload["rawLine"] === "string" ? throttledPayload["rawLine"] : null
    });
  }
  function buildJobEventPayload(payload) {
    const action = asNonEmptyString(payload["action"]);
    const stage = asNonEmptyString(payload["stage"]);
    const detail = asNonEmptyString(payload["message"]);
    const kind = asNonEmptyString(payload["kind"]);
    const requestId = asNonEmptyString(payload["requestId"]);
    const jobId = asNonEmptyString(payload["jobId"]);
    const projectId = asNonEmptyString(payload["projectId"]);
    if (isCustomProcessEventKind(kind)) {
      return {
        ...payload,
        kind,
        severity: typeof payload["severity"] === "string" ? payload["severity"] : getEventSeverity(stage),
        message: typeof payload["message"] === "string" ? payload["message"] : getActionLabel(action),
        detail: asNonEmptyString(payload["detail"]) || detail,
        action,
        stage,
        moduleId: asNonEmptyString(payload["moduleId"]),
        requestId,
        jobId,
        projectId,
        scope: String(action || "").includes("process") ? "run" : "global"
      };
    }
    const baseLabel = getActionLabel(action);
    return {
      kind: payload["kind"],
      severity: getEventSeverity(stage),
      message: stage === "queued" ? `${baseLabel} kuyruğa alındı` : stage === "completed" ? `${baseLabel} tamamlandı` : stage === "failed" ? `${baseLabel} hata verdi` : stage === "cancelled" ? `${baseLabel} iptal edildi` : `${baseLabel} başladı`,
      detail,
      action,
      stage,
      moduleId: asNonEmptyString(payload["moduleId"]),
      requestId,
      jobId,
      projectId,
      scope: String(action || "").includes("process") ? "run" : "global"
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
      requestId: asNonEmptyString(payload["requestId"]),
      jobId: asNonEmptyString(payload["jobId"]),
      projectId: asNonEmptyString(payload["projectId"]),
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
