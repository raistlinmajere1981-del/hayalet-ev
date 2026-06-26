import type { RepairPanelId } from "../../shared/types/index.js";

export const REPAIR_DOCK_PANEL_IDS = [
  "chat",
  "measurement",
  "room-sync",
] as const satisfies readonly RepairPanelId[];

type RepairDockCollapsedPanels = Partial<Record<RepairPanelId, boolean>>;

export interface RepairDockLayoutProjection {
  visiblePanelIds: RepairPanelId[];
  gridTemplateColumns: string;
}

export function getRepairVisibleDockPanelIds(
  collapsedPanels: RepairDockCollapsedPanels = {},
  dockPanelIds: readonly RepairPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairPanelId[] {
  return dockPanelIds.filter((panelId) => collapsedPanels[panelId] !== true);
}

export function getRepairDockGridTemplateColumns(visiblePanelCount: number): string {
  const normalizedCount =
    Number.isFinite(visiblePanelCount) && visiblePanelCount > 0 ? Math.floor(visiblePanelCount) : 0;
  if (normalizedCount === 0) return "none";
  return Array.from({ length: normalizedCount }, () => "1fr").join(" ");
}

export function getRepairDockLayoutProjection(
  collapsedPanels: RepairDockCollapsedPanels = {},
  dockPanelIds: readonly RepairPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairDockLayoutProjection {
  const visiblePanelIds = getRepairVisibleDockPanelIds(collapsedPanels, dockPanelIds);
  return {
    visiblePanelIds,
    gridTemplateColumns: getRepairDockGridTemplateColumns(visiblePanelIds.length),
  };
}
