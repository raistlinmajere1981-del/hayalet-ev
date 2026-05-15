export type RepairPanelId =
  | "session-rail"
  | "workbench-stage"
  | "tactical-feed"
  | "session-wizard"
  | "knowledge-pack"
  | "visual-timeline"
  | "operator-profile"
  | "chat"
  | "measurement"
  | "room-sync";

export type RepairOperatorProfileTabId = "overview" | "tools" | "skills" | "preferences";

export type RepairOperationalProfile = "novice" | "advanced";

export type RepairAmbientListeningState = "idle" | "listening" | "muted";

export type RepairSpokenGuidanceMode = "silent" | "brief" | "step-by-step";

export interface RepairVoiceGuidanceState {
  ambientListeningState: RepairAmbientListeningState;
  spokenGuidanceMode: RepairSpokenGuidanceMode;
  handsBusyMode: boolean;
}

export interface RepairAttentionBudgetState {
  windowMs: number;
  maxAiInterruptions: number;
}

export interface RepairLayoutState {
  collapsedPanels: Record<RepairPanelId, boolean>;
  pinnedPanels: Record<RepairPanelId, boolean>;
  operationalProfile: RepairOperationalProfile;
  voiceGuidance: RepairVoiceGuidanceState;
  attentionBudget: RepairAttentionBudgetState;
  operatorProfileTabId: RepairOperatorProfileTabId;
  focusMode: boolean;
  ambientClock: string;
}
