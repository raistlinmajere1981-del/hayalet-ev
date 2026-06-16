import type { RepairPanelId } from "../../shared/types/index.js";
import type { RepairGuidanceProjection } from "../../shared/ui/state.js";

export const REPAIR_DOCK_PANEL_IDS = [
  "measurement",
  "chat",
  "room-sync",
] as const satisfies readonly RepairPanelId[];

export interface RepairDockLayoutProjection {
  visiblePanelIds: RepairPanelId[];
  gridTemplateColumns: string;
}

export function getRepairVisibleDockPanelIds(
  panels: RepairGuidanceProjection["panelVisibility"]["panels"],
  dockPanelIds: readonly RepairPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairPanelId[] {
  return dockPanelIds.filter((panelId) => panels[panelId] !== "hidden");
}

export function getRepairDockGridTemplateColumns(visiblePanelCount: number): string {
  const normalizedCount =
    Number.isFinite(visiblePanelCount) && visiblePanelCount > 0 ? Math.floor(visiblePanelCount) : 0;
  if (normalizedCount === 0) return "none";
  return Array.from({ length: normalizedCount }, () => "1fr").join(" ");
}

export function getRepairDockLayoutProjection(
  panels: RepairGuidanceProjection["panelVisibility"]["panels"],
  dockPanelIds: readonly RepairPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairDockLayoutProjection {
  const visiblePanelIds = getRepairVisibleDockPanelIds(panels, dockPanelIds);
  return {
    visiblePanelIds,
    gridTemplateColumns: getRepairDockGridTemplateColumns(visiblePanelIds.length),
  };
}
