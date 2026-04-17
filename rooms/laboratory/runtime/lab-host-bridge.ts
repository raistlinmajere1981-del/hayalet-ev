import { asLabRecord } from "../models/lab-types.js";
import type { LabEventFeedItem, LabStoreEvent } from "../models/lab-types.js";

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
        payload:
          resolvedPayload["snapshot"] && typeof resolvedPayload["snapshot"] === "object"
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
        payload:
          resolvedPayload["snapshot"] && typeof resolvedPayload["snapshot"] === "object"
            ? asLabRecord(resolvedPayload["snapshot"])
            : resolvedPayload,
      });
      return;
    }

    if (type === "lab-event") {
      deps.emit({
        type: "host-event-received",
        event: resolvedPayload as unknown as LabEventFeedItem,
      });
      return;
    }
  }

  return {
    handleHostMessage,
  };
}
