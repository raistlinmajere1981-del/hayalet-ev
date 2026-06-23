import type { RepairPanelId } from "../../shared/types/index.js";

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
  dockPanelIds: readonly RepairPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairPanelId[] {
  return [...dockPanelIds];
}

export function getRepairDockGridTemplateColumns(visiblePanelCount: number): string {
  const normalizedCount =
    Number.isFinite(visiblePanelCount) && visiblePanelCount > 0 ? Math.floor(visiblePanelCount) : 0;
  if (normalizedCount === 0) return "none";
  return Array.from({ length: normalizedCount }, () => "1fr").join(" ");
}

export function getRepairDockLayoutProjection(
  dockPanelIds: readonly RepairPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairDockLayoutProjection {
  const visiblePanelIds = getRepairVisibleDockPanelIds(dockPanelIds);
  return {
    visiblePanelIds,
    gridTemplateColumns: getRepairDockGridTemplateColumns(visiblePanelIds.length),
  };
}
