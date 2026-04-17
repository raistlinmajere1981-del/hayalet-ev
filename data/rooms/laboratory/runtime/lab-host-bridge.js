import { asLabRecord } from "../models/lab-types.js";
export function createLabHostBridge(deps) {
  function handleHostMessage(message) {
    const record = asLabRecord(message);
    const type = typeof record["type"] === "string" ? record["type"] : "";
    const payload = asLabRecord(record["payload"]);
    const resolvedPayload = Object.keys(payload).length > 0 ? payload : record;
    if (type === "source-state") {
      deps.emit({
        type: "source-snapshot-received",
        payload: resolvedPayload["snapshot"] && typeof resolvedPayload["snapshot"] === "object" ? asLabRecord(resolvedPayload["snapshot"]) : resolvedPayload
      });
      return;
    }
    if (type === "host-context") {
      deps.emit({
        type: "context-received",
        payload: resolvedPayload
      });
      return;
    }
    if (type === "media-state") {
      deps.emit({
        type: "snapshot-received",
        payload: resolvedPayload["snapshot"] && typeof resolvedPayload["snapshot"] === "object" ? asLabRecord(resolvedPayload["snapshot"]) : resolvedPayload
      });
      return;
    }
    if (type === "lab-event") {
      deps.emit({
        type: "host-event-received",
        event: resolvedPayload
      });
      return;
    }
  }
  return {
    handleHostMessage
  };
}
