import type { RepairAnnotationTool } from "./repair-event.js";

export type RepairWorkbenchTool =
  | "select"
  | "pan"
  | "zoom-in"
  | "zoom-out"
  | RepairAnnotationTool
  | "freeze-frame"
  | "snapshot"
  | "ruler";

export type RepairOverlayLayerId =
  | "grid"
  | "ai-marks"
  | "annotations"
  | "measurement-pins"
  | "focus";

export interface RepairWorkbenchViewport {
  zoom: number;
  panXPx: number;
  panYPx: number;
}

export interface RepairWorkbenchCursor {
  xPx: number;
  yPx: number;
  gridX: number;
  gridY: number;
}

export interface RepairTimelineState {
  playheadMs: number;
  zoom: number;
  rangeStartMs: number | null;
  rangeEndMs: number | null;
  autoFollowLive: boolean;
}

export interface RepairWorkbenchState {
  activeTool: RepairWorkbenchTool;
  isFrozen: boolean;
  frozenAt: string | null;
  viewport: RepairWorkbenchViewport;
  timeline: RepairTimelineState;
  cursor: RepairWorkbenchCursor | null;
  visibleLayers: Record<RepairOverlayLayerId, boolean>;
  hoveredEventId: string | null;
  focusedEventId: string | null;
  focusMode: boolean;
}
