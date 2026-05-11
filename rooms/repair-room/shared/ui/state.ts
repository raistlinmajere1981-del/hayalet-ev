import type {
  RepairAiAdaptationHints,
  RepairChatState,
  RepairEvent,
  RepairKnowledgePack,
  RepairLayoutState,
  RepairMeasurementState,
  RepairOperatorProfile,
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
}
