import type { RepairEvent } from "../../shared/types/index.js";

export function formatOffset(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `+${minutes}:${seconds}`;
}

export function formatTimelineText(value: string): string {
  return value
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
    .trim();
}

function formatEventToolLabel(tool: string): string {
  switch (tool) {
    case "rect":
      return "Box";
    case "freehand":
      return "Draw";
    case "measurement-pin":
      return "Probe";
    case "freeze-frame":
      return "Freeze";
    default:
      return formatTimelineText(tool);
  }
}

export function getEventLabel(event: RepairEvent): string {
  switch (event.kind) {
    case "ai-mark":
      return formatTimelineText(event.severity);
    case "measurement":
      return event.reference ?? event.channel;
    case "risk-flag":
      return "Risk";
    case "snapshot":
      return "Snapshot";
    case "annotation":
      return formatEventToolLabel(event.tool);
    case "freeze-frame":
      return "Freeze";
    case "note":
      return "Note";
    case "session-start":
      return "Start";
    case "ai-mark-lifecycle":
      return "Assistant state";
    case "investigation-region-created":
      return "Area";
    case "investigation-region-updated":
      return "Area";
    default:
      return "Event";
  }
}
