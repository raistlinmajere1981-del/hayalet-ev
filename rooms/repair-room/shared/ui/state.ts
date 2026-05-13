import type {
  RepairAiAdaptationHints,
  RepairChatState,
  RepairEvent,
  RepairImageRect,
  RepairInvestigationRegion,
  RepairKnowledgePack,
  RepairMeasurementEvidenceState,
  RepairLayoutState,
  RepairMeasurementState,
  RepairOperatorProfile,
  RepairOperationalMode,
  RepairOverlayEntityRef,
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

export interface RepairKnowledgeRegionProjection {
  id: string;
  label: string;
  region: RepairImageRect;
  source: "common-failure" | "test-point" | "resource";
  linkedEventIds: string[];
  relatedMeasurementIds: string[];
  relatedAiMarkIds: string[];
}

export interface RepairTemporarySpatialRegion {
  id: string;
  label: string;
  region: RepairImageRect;
  source: "knowledge-spatial-ref" | "focus-preview";
  sourceRef: RepairOverlayEntityRef;
  knowledgeSpatialRefId: string | null;
  linkedEventIds: string[];
  relatedMeasurementIds: string[];
  relatedAiMarkIds: string[];
}

export type RepairMeasurementRelationshipKind =
  | "rail"
  | "previous-event"
  | "investigation-group"
  | "linked-annotation"
  | "linked-ai-mark";

export interface RepairMeasurementRelationship {
  id: string;
  kind: RepairMeasurementRelationshipKind;
  from: RepairOverlayEntityRef;
  to: RepairOverlayEntityRef;
  label: string;
  strength: number;
  eventIds: string[];
}

export interface RepairTimelineDensityBucket {
  bucketStartMs: number;
  bucketEndMs: number;
  eventCount: number;
  spatialEventCount: number;
  measurementCount: number;
  aiMarkCount: number;
  regionCount: number;
  density: number;
}

export interface RepairSpatialFocusState {
  ref: RepairOverlayEntityRef;
  label: string;
  region: RepairImageRect | null;
  linkedEventIds: string[];
  relatedMeasurementIds: string[];
  relatedAiMarkIds: string[];
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
  knowledgeRegions: RepairKnowledgeRegionProjection[];
  investigationRegions: RepairInvestigationRegion[];
  temporarySpatialRegions: RepairTemporarySpatialRegion[];
  measurementRelationships: RepairMeasurementRelationship[];
  timelineDensity: RepairTimelineDensityBucket[];
  activeSpatialFocus: RepairSpatialFocusState | null;
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
