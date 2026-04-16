import { asLabRecord } from "../models/lab-types.js";
import {
  buildJobFeedEvent,
  buildLifecycleEvents,
  buildRequestResultFeedEvent,
} from "../services/pipeline-runner.js";
import type { LabStoreEvent } from "../models/lab-types.js";

type LabBridgeDeps = {
  emit: (event: LabStoreEvent) => void;
};

export function createLabHostBridge(deps: LabBridgeDeps) {
  function handleHostMessage(message: unknown) {
    const record = asLabRecord(message);
    const type = typeof record["type"] === "string" ? (record["type"] as string) : "";
    const payload = asLabRecord(record["payload"]);
    const resolvedPayload = Object.keys(payload).length > 0 ? payload : record;

    if (type === "source-state") {
      deps.emit({
        type: "source-snapshot-received",
        payload: resolvedPayload["snapshot"] && typeof resolvedPayload["snapshot"] === "object"
          ? asLabRecord(resolvedPayload["snapshot"])
          : resolvedPayload,
      });
      return;
    }

    if (type === "host-context") {
      deps.emit({
        type: "context-received",
        payload: resolvedPayload,
      });
      return;
    }

    if (type === "media-state") {
      deps.emit({
        type: "snapshot-received",
        payload: resolvedPayload["snapshot"] && typeof resolvedPayload["snapshot"] === "object"
          ? asLabRecord(resolvedPayload["snapshot"])
          : resolvedPayload,
      });
      return;
    }

    if (type === "media-job") {
      buildLifecycleEvents(resolvedPayload).forEach(deps.emit);
      deps.emit({
        type: "job-received",
        payload: resolvedPayload,
        event: buildJobFeedEvent(resolvedPayload),
      });
      return;
    }

    if (type === "source-job") {
      const stage = typeof resolvedPayload["stage"] === "string" ? resolvedPayload["stage"] : "";
      const action = typeof resolvedPayload["action"] === "string" ? resolvedPayload["action"] : "source-probe";
      const detail = typeof resolvedPayload["message"] === "string" ? resolvedPayload["message"] : null;
      if (stage === "completed") {
        deps.emit({
          type: "source-probe-completed",
          action,
          detail,
        });
        return;
      }
      if (stage === "failed" || stage === "cancelled") {
        deps.emit({
          type: "source-probe-failed",
          action,
          detail,
        });
        return;
      }
      deps.emit({
        type: "source-probe-progress",
        action,
        detail,
        progress: typeof resolvedPayload["percent"] === "number" ? (resolvedPayload["percent"] as number) : null,
      });
      return;
    }

    if (type === "source-action-result") {
      const action = typeof resolvedPayload["action"] === "string" ? resolvedPayload["action"] : "source-probe";
      const detail = typeof resolvedPayload["error"] === "string"
        ? resolvedPayload["error"]
        : typeof resolvedPayload["message"] === "string"
          ? resolvedPayload["message"]
          : null;
      deps.emit(
        resolvedPayload["success"] === true
          ? {
              type: "source-probe-completed",
              action,
              detail,
            }
          : {
              type: "source-probe-failed",
              action,
              detail,
            }
      );
      return;
    }

    if (type === "media-action-result") {
      buildLifecycleEvents(resolvedPayload).forEach(deps.emit);
      deps.emit({
        type: "request-result-received",
        payload: resolvedPayload,
        event: buildRequestResultFeedEvent(resolvedPayload),
      });
    }
  }

  return {
    handleHostMessage,
  };
}
