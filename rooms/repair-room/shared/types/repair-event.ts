export type RepairEventSource = "operator" | "ai" | "instrument" | "system";

export type RepairAiSeverity = "info" | "suggestion" | "action" | "risk";

export type RepairAnnotationTool =
  | "rect"
  | "circle"
  | "freehand"
  | "arrow"
  | "text"
  | "measurement-pin";

export interface RepairImageRect {
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
}

export interface RepairImagePoint {
  xPx: number;
  yPx: number;
}

export interface RepairEventBase {
  id: string;
  sessionId: string;
  occurredAt: string;
  source: RepairEventSource;
  linkedEventIds: string[];
}

export interface RepairSnapshotEvent extends RepairEventBase {
  kind: "snapshot";
  thumbnailSrc: string | null;
  caption: string;
}

export interface RepairAiMarkEvent extends RepairEventBase {
  kind: "ai-mark";
  severity: RepairAiSeverity;
  region: RepairImageRect | null;
  rationale: string;
  protocolKey: string | null;
  dismissed: boolean;
}

export interface RepairMeasurementEvent extends RepairEventBase {
  kind: "measurement";
  instrumentId: string;
  channel: string;
  mode: string;
  range: string;
  value: number | null;
  rawDisplay: string;
  unit: string;
  pinAt: RepairImagePoint | null;
  reference: string | null;
}

export interface RepairAnnotationEvent extends RepairEventBase {
  kind: "annotation";
  tool: RepairAnnotationTool;
  region: RepairImageRect | null;
  point: RepairImagePoint | null;
  label: string;
  color: string;
}

export interface RepairNoteEvent extends RepairEventBase {
  kind: "note";
  author: "operator" | "ai";
  text: string;
}

export interface RepairFreezeFrameEvent extends RepairEventBase {
  kind: "freeze-frame";
  durationMs: number;
  reason: string;
}

export interface RepairRiskFlagEvent extends RepairEventBase {
  kind: "risk-flag";
  severity: RepairAiSeverity;
  message: string;
  region: RepairImageRect | null;
  acknowledged: boolean;
}

export interface RepairSessionStartEvent extends RepairEventBase {
  kind: "session-start";
  title: string;
}

export type RepairEvent =
  | RepairSnapshotEvent
  | RepairAiMarkEvent
  | RepairMeasurementEvent
  | RepairAnnotationEvent
  | RepairNoteEvent
  | RepairFreezeFrameEvent
  | RepairRiskFlagEvent
  | RepairSessionStartEvent;

export type RepairEventKind = RepairEvent["kind"];

export function isRepairAiEvent(
  event: RepairEvent
): event is RepairAiMarkEvent | RepairRiskFlagEvent {
  return event.kind === "ai-mark" || event.kind === "risk-flag";
}
