import {
  REPAIR_DOCK_LAYOUT_PANEL_IDS,
  REPAIR_MAIN_LAYOUT_PANEL_IDS,
  type RepairDockLayoutPanelId,
  type RepairPanelId,
  type RepairPanelSizeState,
} from "../../shared/types/index.js";

export const REPAIR_DOCK_PANEL_IDS = REPAIR_DOCK_LAYOUT_PANEL_IDS;

type RepairDockCollapsedPanels = Partial<Record<RepairPanelId, boolean>>;
type RepairPanelWeightMap<PanelId extends string> = Partial<Record<PanelId, number>>;

const REPAIR_DOCK_PANEL_MIN_TRACKS: Record<RepairDockLayoutPanelId, string> = {
  chat: "var(--repair-px-220)",
  measurement: "var(--repair-px-220)",
};

export interface RepairDockLayoutProjection {
  visiblePanelIds: RepairDockLayoutPanelId[];
  gridTemplateColumns: string;
}

function formatRepairLayoutWeight(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  const normalized = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
  const rounded = Math.round(normalized * 1000) / 1000;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}fr`;
}

function getRepairWeightedGridTemplateColumns<PanelId extends string>(
  panelIds: readonly PanelId[],
  panelSizes: RepairPanelWeightMap<PanelId> = {},
  minTracks: Partial<Record<PanelId, string>> = {}
): string {
  if (panelIds.length === 0) return "none";
  return panelIds
    .map((panelId) => {
      const weight = formatRepairLayoutWeight(panelSizes[panelId]);
      const minTrack = minTracks[panelId] ?? "0px";
      return `minmax(${minTrack}, ${weight})`;
    })
    .join(" ");
}

export function getRepairVisibleDockPanelIds(
  collapsedPanels: RepairDockCollapsedPanels = {},
  dockPanelIds: readonly RepairDockLayoutPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairDockLayoutPanelId[] {
  return dockPanelIds.filter((panelId) => collapsedPanels[panelId] !== true);
}

export function getRepairMainGridTemplateColumns(
  collapsedPanels: RepairDockCollapsedPanels = {},
  mainColumnSizes: RepairPanelSizeState["mainColumns"]
): string {
  return REPAIR_MAIN_LAYOUT_PANEL_IDS.map((panelId) => {
    if (collapsedPanels[panelId] === true) return "0";
    return formatRepairLayoutWeight(mainColumnSizes[panelId]);
  }).join(" ");
}

export function getRepairDockGridTemplateColumns(
  visiblePanelCountOrIds: number | readonly RepairDockLayoutPanelId[],
  dockColumnSizes:
    | RepairPanelSizeState["dockColumns"]
    | RepairPanelWeightMap<RepairDockLayoutPanelId> = {}
): string {
  if (typeof visiblePanelCountOrIds === "number") {
    const normalizedCount =
      Number.isFinite(visiblePanelCountOrIds) && visiblePanelCountOrIds > 0
        ? Math.floor(visiblePanelCountOrIds)
        : 0;
    if (normalizedCount === 0) return "none";
    return Array.from({ length: normalizedCount }, () => "1fr").join(" ");
  }
  return getRepairWeightedGridTemplateColumns(
    visiblePanelCountOrIds,
    dockColumnSizes,
    REPAIR_DOCK_PANEL_MIN_TRACKS
  );
}

export function getRepairDockLayoutProjection(
  collapsedPanels: RepairDockCollapsedPanels = {},
  dockPanelIds: readonly RepairDockLayoutPanelId[] = REPAIR_DOCK_PANEL_IDS,
  dockColumnSizes:
    | RepairPanelSizeState["dockColumns"]
    | RepairPanelWeightMap<RepairDockLayoutPanelId> = {}
): RepairDockLayoutProjection {
  const visiblePanelIds = getRepairVisibleDockPanelIds(collapsedPanels, dockPanelIds);
  return {
    visiblePanelIds,
    gridTemplateColumns: getRepairDockGridTemplateColumns(visiblePanelIds, dockColumnSizes),
  };
}
