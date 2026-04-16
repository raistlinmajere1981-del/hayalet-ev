import {
  asLabRecord,
  asNonEmptyString,
  clampPercent,
  createLabEventId
} from "../models/lab-types.js";
function getEventSeverityFromStage(stage) {
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
    case "source-download-url":
      return "URL kaynagi indiriliyor";
    case "source-download-youtube":
      return "YouTube kaynagi hazirlaniyor";
    case "source-pick-local":
      return "Yerel dosya iceri aliniyor";
    case "edit-preview":
    case "subtitle-edit-preview":
      return "Preview uretiliyor";
    case "edit-apply":
      return "Duzenlenmis cikti uretiliyor";
    case "profile-run-preflight":
      return "On kontrol calistiriliyor";
    case "process-run":
    case "audio-process-run":
      return "Islem hattı calistiriliyor";
    case "process-cancel":
    case "audio-process-cancel":
      return "Calisma iptal ediliyor";
    case "report-export":
    case "audio-report-export":
      return "Raporlar disa aktariliyor";
    default:
      return action || "Islem";
  }
}
function getModuleId(record) {
  return asNonEmptyString(record["moduleId"]) || asNonEmptyString(record["toolId"]) || asNonEmptyString(record["featureStage"]);
}
export function buildLifecycleEvents(payload) {
  const record = asLabRecord(payload);
  const action = asNonEmptyString(record["action"]);
  const stage = asNonEmptyString(record["stage"]);
  const success = typeof record["success"] === "boolean" ? record["success"] : null;
  const detail = asNonEmptyString(record["message"]) || asNonEmptyString(record["error"]);
  const progress = clampPercent(record["percent"]);
  const moduleId = getModuleId(record);
  if (action === null) {
    return [];
  }
  if (action === "edit-preview" || action === "subtitle-edit-preview") {
    if (stage === "completed" || success === true) {
      return [{ type: "preview-completed", action, detail }];
    }
    if (stage === "failed" || stage === "cancelled" || success === false) {
      return [{ type: "preview-failed", action, detail }];
    }
    return [
      progress !== null ? { type: "preview-progress", action, detail, progress } : { type: "preview-started", action, detail }
    ];
  }
  if (action === "profile-run-preflight") {
    if (stage === "completed" || success === true) {
      return [{ type: "preflight-completed", action, detail }];
    }
    if (stage === "failed" || stage === "cancelled" || success === false) {
      return [{ type: "preflight-failed", action, detail }];
    }
    return [{ type: "preflight-started", action, detail }];
  }
  if (action === "process-run" || action === "audio-process-run") {
    if (stage === "cancelled") {
      return [{ type: "run-cancelled", action, detail }];
    }
    if (success === false) {
      return moduleId ? [{ type: "module-failed", action, moduleId, detail }] : [{ type: "run-failed", action, detail }];
    }
    if (moduleId) {
      if (stage === "skipped") {
        return [{ type: "module-skipped", action, moduleId, detail }];
      }
      if (stage === "completed" || success === true) {
        return [{ type: "module-finished", action, moduleId, detail }];
      }
      if (stage === "failed") {
        return [{ type: "module-failed", action, moduleId, detail }];
      }
      return [
        progress !== null ? { type: "module-progress", action, moduleId, detail, progress } : { type: "module-started", action, moduleId, detail }
      ];
    }
    return [{ type: "run-started", action, detail }];
  }
  if (action === "process-cancel" || action === "audio-process-cancel") {
    return [{ type: "run-cancelled", action, detail }];
  }
  return [];
}
export function buildJobFeedEvent(payload) {
  const record = asLabRecord(payload);
  const action = asNonEmptyString(record["action"]);
  const stage = asNonEmptyString(record["stage"]);
  if (action === null) {
    return null;
  }
  const detail = asNonEmptyString(record["message"]);
  const progress = clampPercent(record["percent"]);
  const progressLabel = progress !== null && stage !== "completed" ? ` • ${String(progress)}%` : "";
  const baseMessage = `${getActionLabel(action)} • ${stage || "queued"}${progressLabel}`;
  return {
    id: createLabEventId("job"),
    kind: "job",
    severity: getEventSeverityFromStage(stage),
    message: baseMessage,
    detail,
    timestamp: Date.now(),
    source: "host",
    action,
    stage
  };
}
export function buildRequestResultFeedEvent(payload) {
  const record = asLabRecord(payload);
  const action = asNonEmptyString(record["action"]);
  if (action === null) {
    return null;
  }
  const success = record["success"] === true;
  const error = asNonEmptyString(record["error"]);
  return {
    id: createLabEventId("request"),
    kind: "request-result",
    severity: success ? "success" : "error",
    message: success ? `${getActionLabel(action)} tamamlandi` : `${getActionLabel(action)} hata verdi`,
    detail: error,
    timestamp: Date.now(),
    source: "host",
    action,
    stage: success ? "completed" : "failed"
  };
}
