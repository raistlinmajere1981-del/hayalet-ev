import type { RepairEvent } from "../../shared/types/index.js";

export type RepairTimelineTextFn = (
  path: string[],
  fallback: string,
  params?: Record<string, string | number>
) => string;

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

const EVENT_KIND_LABELS: Partial<Record<RepairEvent["kind"], [string[], string]>> = {
  annotation: [["timeline", "kinds", "annotation"], "Anotasyon"],
  "ai-mark": [["timeline", "kinds", "aiMark"], "AI İşareti"],
  "ai-mark-lifecycle": [["timeline", "kinds", "aiMarkLifecycle"], "Asistan Durumu"],
  "freeze-frame": [["timeline", "kinds", "freezeFrame"], "Donuk Kare"],
  "investigation-region-created": [["timeline", "kinds", "area"], "Alan"],
  "investigation-region-updated": [["timeline", "kinds", "area"], "Alan"],
  measurement: [["timeline", "kinds", "measurement"], "Ölçüm"],
  note: [["timeline", "kinds", "note"], "Not"],
  "risk-flag": [["timeline", "kinds", "risk"], "Risk Bayrağı"],
  "session-start": [["timeline", "kinds", "sessionStart"], "Oturum Başlangıcı"],
  snapshot: [["timeline", "kinds", "snapshot"], "Kare"],
};

function readText(
  text: RepairTimelineTextFn | undefined,
  path: string[],
  fallback: string
): string {
  return text === undefined ? fallback : text(path, fallback);
}

export function getEventKindLabel(event: RepairEvent, text?: RepairTimelineTextFn): string {
  const entry = EVENT_KIND_LABELS[event.kind] ?? [["timeline", "kinds", "event"], "Event"];
  return readText(text, entry[0], entry[1]);
}

function formatEventToolLabel(tool: string, text?: RepairTimelineTextFn): string {
  switch (tool) {
    case "rect":
      return readText(text, ["workbench", "tools", "rect", "label"], "Kutu");
    case "freehand":
      return readText(text, ["workbench", "tools", "freehand", "label"], "Çiz");
    case "measurement-pin":
      return readText(text, ["workbench", "tools", "measurement-pin", "label"], "Prob");
    case "freeze-frame":
      return readText(text, ["workbench", "tools", "freeze-frame", "label"], "Dondur");
    case "text":
      return readText(text, ["workbench", "tools", "text", "label"], "Metin");
    case "arrow":
      return readText(text, ["workbench", "tools", "arrow", "label"], "Ok");
    case "ruler":
      return readText(text, ["workbench", "tools", "ruler", "label"], "Cetvel");
    default:
      return formatTimelineText(tool);
  }
}

export function getEventLabel(event: RepairEvent, text?: RepairTimelineTextFn): string {
  switch (event.kind) {
    case "ai-mark":
      return readText(
        text,
        ["feed", "severity", event.severity],
        formatTimelineText(event.severity)
      );
    case "measurement":
      return event.reference ?? event.channel;
    case "risk-flag":
      return readText(text, ["timeline", "labels", "risk"], "Risk");
    case "snapshot":
      return readText(text, ["timeline", "labels", "snapshot"], "Kare");
    case "annotation":
      return formatEventToolLabel(event.tool, text);
    case "freeze-frame":
      return readText(text, ["timeline", "labels", "freezeFrame"], "Dondur");
    case "note":
      return readText(text, ["timeline", "labels", "note"], "Not");
    case "session-start":
      return readText(text, ["timeline", "labels", "sessionStart"], "Başlangıç");
    case "ai-mark-lifecycle":
      return readText(text, ["timeline", "labels", "assistantState"], "Asistan durumu");
    case "investigation-region-created":
      return readText(text, ["timeline", "labels", "area"], "Alan");
    case "investigation-region-updated":
      return readText(text, ["timeline", "labels", "area"], "Alan");
    default:
      return readText(text, ["timeline", "labels", "event"], "Olay");
  }
}
