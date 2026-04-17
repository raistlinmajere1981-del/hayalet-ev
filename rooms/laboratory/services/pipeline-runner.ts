import {
  asLabRecord,
  asNonEmptyString,
  clampPercent,
  createLabEventId,
} from "../models/lab-types.js";
import type { LabEventFeedItem, LabEventSeverity } from "../models/lab-types.js";

function getEventSeverityFromStage(stage: string | null): LabEventSeverity {
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

function getActionLabel(action: string | null): string {
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

function getModuleId(record: Record<string, unknown>) {
  return asNonEmptyString(record["moduleId"]);
}

function resolveEventScope(record: Record<string, unknown>): "global" | "run" {
  const explicitScope = asNonEmptyString(record["scope"]);
  if (explicitScope === "run" || explicitScope === "global") {
    return explicitScope;
  }
  const action = asNonEmptyString(record["action"]) || "";
  const featureStage = asNonEmptyString(record["featureStage"]) || "";
  if (featureStage === "process" || action.includes("process")) {
    return "run";
  }
  return "global";
}

export function buildJobFeedEvent(payload: unknown): LabEventFeedItem | null {
  const record = asLabRecord(payload);
  const action = asNonEmptyString(record["action"]);
  const stage = asNonEmptyString(record["stage"]);
  const moduleId = getModuleId(record);
  if (action === null) {
    return null;
  }

  const detail = asNonEmptyString(record["message"]);
  const progress = clampPercent(record["percent"]);
  const progressLabel = progress !== null && stage !== "completed" ? ` • ${String(progress)}%` : "";
  const baseMessage = `${getActionLabel(action)} • ${stage || "queued"}${progressLabel}`;

  return {
    id: createLabEventId("job"),
    kind: "activity",
    severity: getEventSeverityFromStage(stage),
    message: baseMessage,
    detail,
    timestamp: Date.now(),
    source: "host",
    action,
    stage,
    scope: resolveEventScope(record),
    moduleId,
    rawLine: null,
  };
}

export function buildRequestResultFeedEvent(payload: unknown): LabEventFeedItem | null {
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
    message: success
      ? `${getActionLabel(action)} tamamlandi`
      : `${getActionLabel(action)} hata verdi`,
    detail: error,
    timestamp: Date.now(),
    source: "host",
    action,
    stage: success ? "completed" : "failed",
    scope: resolveEventScope(record),
    moduleId: getModuleId(record),
    rawLine: null,
  };
}
