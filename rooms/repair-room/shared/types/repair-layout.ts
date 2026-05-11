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

export interface RepairLayoutState {
  collapsedPanels: Record<RepairPanelId, boolean>;
  pinnedPanels: Record<RepairPanelId, boolean>;
  operatorProfileTabId: RepairOperatorProfileTabId;
  focusMode: boolean;
  ambientClock: string;
}
