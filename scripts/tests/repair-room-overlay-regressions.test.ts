import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPAIR_UI_COMMANDS } from "../../rooms/repair-room/shared/repair-constants.ts";
import { createRepairDefaultGuidanceProjection } from "../../rooms/repair-room/shared/ui/state.ts";
import { createInitialRepairRuntimeState } from "../../rooms/repair-room/host/state/repair-runtime-state.ts";
import { createRepairUiSnapshot } from "../../rooms/repair-room/host/state/repair-selectors.ts";
import { resolveRepairAssetUrl } from "../../rooms/repair-room/ui/repair-asset-url.ts";
import {
  REPAIR_DOCK_PANEL_IDS,
  getRepairDockLayoutProjection,
} from "../../rooms/repair-room/ui/repair-room-ui-runtime.ts";
import { renderRepairSettingsPanel } from "../../rooms/repair-room/ui/panels/repair-settings-panel.ts";
import { renderChatPanel } from "../../rooms/repair-room/ui/panels/chat-panel.ts";
import { renderWorkbenchStagePanel } from "../../rooms/repair-room/ui/panels/workbench-stage-panel.ts";
import { renderOperatorProfilePanel } from "../../rooms/repair-room/ui/panels/operator-profile-panel.ts";
import {
  getContainedImageFrame,
  imagePointToStagePoint,
  imageRectToStageRect,
  stagePointToImagePoint,
} from "../../rooms/repair-room/ui/overlay/overlay-coords.ts";
import {
  applyRepairOverlaySelectionMode,
  getRepairFocusFrame,
  getRepairMarqueeSelection,
  getRepairSnapAssist,
  repairImageRectsIntersect,
} from "../../rooms/repair-room/ui/overlay/overlay-geometry.ts";

function countGridTemplateTracks(template: string): number {
  if (template === "none") return 0;
  return template.trim().split(/\s+/).filter(Boolean).length;
}

function readRepairUiStyleText(): string {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  const entry = readFileSync(join(uiRoot, "style.css"), "utf8");
  const imported = [...entry.matchAll(/@import "\.\/styles\/([^"]+)";/g)]
    .map((match) => readFileSync(join(uiRoot, "styles", match[1] ?? ""), "utf8"))
    .join("\n");
  return `${entry}\n${imported}`;
}

function readRepairUiRuntimeText(): string {
  const uiRoot = join(process.cwd(), "rooms/repair-room/ui");
  return [
    "repair-room-ui-runtime.ts",
    "runtime/actions.ts",
    "runtime/capture-status-handlers.ts",
    "runtime/dictation-composer.ts",
    "runtime/measurement-dom.ts",
    "runtime/overlay-runtime.ts",
    "runtime/panel-signatures.ts",
    "runtime/sync-inspector-dom.ts",
    "runtime/tactical-feed-dom.ts",
    "runtime/visual-timeline-dom.ts",
  ]
    .map((relativePath) => readFileSync(join(uiRoot, relativePath), "utf8"))
    .join("\n");
}

class RepairFakeElement {
  children: RepairFakeElement[] = [];
  parentElement: RepairFakeElement | null = null;
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  innerHTML = "";
  type = "";
  title = "";
  value = "";
  draggable = true;
  style: Record<string, string> = {};

  constructor(readonly tagName: string) {}

  append(...children: RepairFakeElement[]): void {
    children.forEach((child) => {
      child.parentElement = this;
      this.children.push(child);
    });
  }
}

class RepairFakeDocument {
  createElement(tagName: string): RepairFakeElement {
    return new RepairFakeElement(tagName.toLowerCase());
  }
}

function findRepairFakeElements(
  root: RepairFakeElement,
  predicate: (element: RepairFakeElement) => boolean
): RepairFakeElement[] {
  const matches: RepairFakeElement[] = [];
  if (predicate(root)) matches.push(root);
  root.children.forEach((child) => {
    matches.push(...findRepairFakeElements(child, predicate));
  });
  return matches;
}
