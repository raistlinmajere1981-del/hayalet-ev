import type { RepairWorkbenchTool } from "../../shared/types/index.js";

export interface RepairOverlayToolDefinition {
  id: RepairWorkbenchTool;
  label: string;
  title: string;
  action: "select" | "view" | "draw" | "event" | "toggle";
}

export const REPAIR_OVERLAY_TOOLS: RepairOverlayToolDefinition[] = [
  { id: "select", label: "SEL", title: "Select overlay item", action: "select" },
  { id: "pan", label: "PAN", title: "Pan workbench view", action: "view" },
  { id: "zoom-in", label: "Z+", title: "Zoom in", action: "view" },
  { id: "zoom-out", label: "Z-", title: "Zoom out", action: "view" },
  { id: "rect", label: "RCT", title: "Add rectangular annotation", action: "draw" },
  { id: "freehand", label: "FRH", title: "Add freehand annotation", action: "draw" },
  { id: "text", label: "TXT", title: "Add text note", action: "draw" },
  { id: "measurement-pin", label: "PIN", title: "Add measurement pin", action: "event" },
  { id: "arrow", label: "ARW", title: "Add arrow marker", action: "draw" },
  { id: "ruler", label: "RUL", title: "Measure board distance", action: "view" },
  { id: "freeze-frame", label: "FRZ", title: "Freeze frame", action: "toggle" },
  { id: "snapshot", label: "SNP", title: "Capture snapshot", action: "event" },
];

export function isRepairOverlayDrawTool(tool: RepairWorkbenchTool): boolean {
  return tool === "rect" || tool === "freehand" || tool === "text" || tool === "arrow";
}
