export type RepairPanelId =
  | "session-rail"
  | "workbench-stage"
  | "tactical-feed"
  | "session-wizard"
  | "knowledge-pack"
  | "visual-timeline"
  | "operator-profile"
  | "repair-settings"
  | "chat"
  | "measurement"
  | "room-sync";

export type RepairOperatorProfileTabId = "tools" | "skills" | "preferences" | "controls";

export type RepairSettingsOverlayTabId = "repair-controls" | "bench-operator";

export type RepairOperationalProfile = "novice" | "advanced";

export type RepairAmbientListeningState = "idle" | "listening" | "muted";

export type RepairSpokenGuidanceMode = "silent" | "brief" | "step-by-step";

export type RepairDictationRoute = "local" | "android";

export type RepairTtsRoute = "local" | "android";

export type RepairCameraFeedPreference = "manual" | "android-feed";

export type RepairDictationSubmitMode = "composer" | "send";

export interface RepairVoiceGuidanceState {
  ambientListeningState: RepairAmbientListeningState;
  spokenGuidanceMode: RepairSpokenGuidanceMode;
  handsBusyMode: boolean;
}

export interface RepairInteractionSettingsState {
  androidCompanionEnabled: boolean;
  dictationRoute: RepairDictationRoute;
  ttsRoute: RepairTtsRoute;
  cameraFeedPreference: RepairCameraFeedPreference;
  dictationSubmitMode: RepairDictationSubmitMode;
  autoReadAiReplies: boolean;
}

export interface RepairAttentionBudgetState {
  windowMs: number;
  maxAiInterruptions: number;
}

export interface RepairLayoutState {
  collapsedPanels: Record<RepairPanelId, boolean>;
  operationalProfile: RepairOperationalProfile;
  voiceGuidance: RepairVoiceGuidanceState;
  interactionSettings: RepairInteractionSettingsState;
  attentionBudget: RepairAttentionBudgetState;
  operatorProfileTabId: RepairOperatorProfileTabId;
  settingsOverlayOpen: boolean;
  settingsOverlayTabId: RepairSettingsOverlayTabId;
  focusMode: boolean;
  ambientClock: string;
}
