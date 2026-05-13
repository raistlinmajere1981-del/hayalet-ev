import type {
  RepairAiAdaptationHints,
  RepairChatState,
  RepairEvent,
  RepairImageRect,
  RepairKnowledgePack,
  RepairMeasurementEvidenceState,
  RepairLayoutState,
  RepairMeasurementState,
  RepairOperatorProfile,
  RepairOperationalMode,
  RepairSession,
  RepairSessionListItem,
  RepairWizardState,
  RepairWorkbenchState,
} from "../types/index.js";

export type RepairUiPhase =
  | "initializing"
  | "idle"
  | "wizard-active"
  | "session-active"
  | "session-paused";

export interface RepairTacticalFeedItem {
  eventId: string;
  occurredAt: string;
  relativeLabel: string;
  severity: "info" | "suggestion" | "action" | "risk";
  badge: string;
  body: string;
}

export interface RepairKnowledgePackPanelState {
  pack: RepairKnowledgePack | null;
  attachedToSessionId: string | null;
  previewTabId: "schematic-preview" | "board-view" | "notes";
  focusedSpatialRefId: string | null;
}

export interface RepairReplayProjection {
  playheadMs: number;
  replayMode: RepairWorkbenchState["timeline"]["replayMode"];
  visibleEvents: RepairEvent[];
  overlayEvents: RepairEvent[];
  tacticalFeed: RepairTacticalFeedItem[];
  measurementEvidence: RepairMeasurementEvidenceState[];
  aiMarkEventIds: string[];
  activeSnapshotEventId: string | null;
  activeFreezeFrameEventId: string | null;
  focusSuggestionEventId: string | null;
  knowledgeRegions: Array<{
    id: string;
    label: string;
    region: RepairImageRect;
  }>;
  operationalMode: RepairOperationalMode;
}

export interface RepairUiState {
  phase: RepairUiPhase;
  sessions: {
    activeId: string | null;
    list: RepairSessionListItem[];
    detail: RepairSession | null;
  };
  workbench: RepairWorkbenchState;
  tacticalFeed: RepairTacticalFeedItem[];
  wizard: RepairWizardState;
  knowledgePack: RepairKnowledgePackPanelState;
  operatorProfile: {
    profile: RepairOperatorProfile;
    adaptation: RepairAiAdaptationHints;
    isDirty: boolean;
  };
  measurement: RepairMeasurementState;
  chat: RepairChatState;
  layout: RepairLayoutState;
  ambient: {
    nowIso: string;
    sessionDurationMs: number;
  };
}

export interface RepairUiSnapshotMeta {
  schemaVersion: number;
  generatedAt: string;
  events: RepairEvent[];
  replay: RepairReplayProjection;
}
