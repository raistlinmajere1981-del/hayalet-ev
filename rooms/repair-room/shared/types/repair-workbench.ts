import type {
  RepairAiMarkLifecycleState,
  RepairImagePoint,
  RepairWorkbenchDrawTool,
} from "./repair-event.js";

export type RepairWorkbenchTool =
  | "select"
  | "pan"
  | "zoom-in"
  | "zoom-out"
  | RepairWorkbenchDrawTool
  | "freeze-frame"
  | "snapshot"
  | "ruler";

export type RepairOverlayLayerId =
  | "grid"
  | "ai-marks"
  | "annotations"
  | "measurement-pins"
  | "focus"
  | "operator-annotations"
  | "ai-annotations"
  | "measurements"
  | "risks"
  | "notes"
  | "knowledge";

export type RepairReplayMode = "live" | "replay" | "paused" | "freeze";

export type RepairOperationalMode = "live" | "replay" | "freeze" | "investigation";

export type RepairContextualCursor =
  | "inspect"
  | "annotate"
  | "measurement"
  | "pan"
  | "ai-focus"
  | "replay-scrub-lock";

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
  replayMode: RepairReplayMode;
  replaySpeed: number;
  isPlaying: boolean;
  liveEdgeMs: number;
}

export interface RepairOverlaySelectionState {
  hoveredEventId: string | null;
  selectedEventIds: string[];
  inspectorEventId: string | null;
  focusJumpEventId: string | null;
}

export interface RepairAiMarkRuntimeState {
  eventId: string;
  lifecycleState: RepairAiMarkLifecycleState;
  priority: number;
  clusteredWith: string[];
}

export interface RepairMeasurementEvidenceState {
  eventId: string;
  reference: string;
  groupLabel: string;
  history: string[];
  previousDisplay: string | null;
  currentDisplay: string;
  pinAt: RepairImagePoint | null;
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
  selection: RepairOverlaySelectionState;
  contextualCursor: RepairContextualCursor;
  operationalMode: RepairOperationalMode;
  aiMarks: RepairAiMarkRuntimeState[];
  measurementEvidence: RepairMeasurementEvidenceState[];
  focusMode: boolean;
}
