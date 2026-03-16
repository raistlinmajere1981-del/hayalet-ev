import { AppState } from "../../../modules/app-state.js";
import { SCENE_THEME_CONFIG } from "../../../scene/scene-config.js";

import {
  getSceneCharacterState,
  type SceneCharacterSlot,
  type SceneCharacterState,
} from "./scene-character-state.js";

interface SceneCharacterAnchor {
  id: string;
  slot: SceneCharacterSlot;
  fallbackLabel: string;
  leftPct: number;
  bottomPct: number;
  scale: number;
}

export interface SceneCharacterDescriptor {
  id: string;
  slot: SceneCharacterSlot;
  label: string;
  headLabel: string;
  leftPct: number;
  bottomPct: number;
  scale: number;
  state: SceneCharacterState;
  variant: "assigned" | "placeholder";
  bodySrc: string;
}

const SCENE_CHARACTER_ANCHORS: readonly SceneCharacterAnchor[] = [
  { id: "character-ai1", slot: "ai1", fallbackLabel: "AI1", leftPct: 28, bottomPct: 22, scale: 1 },
  {
    id: "character-ai0",
    slot: "ai0",
    fallbackLabel: "Assistant",
    leftPct: 40,
    bottomPct: 28,
    scale: 1.08,
  },
  { id: "character-us1", slot: "us1", fallbackLabel: "US1", leftPct: 56, bottomPct: 21, scale: 1 },
  { id: "character-ai2", slot: "ai2", fallbackLabel: "AI2", leftPct: 68, bottomPct: 22, scale: 1 },
] as const;

function isAssignedSceneCharacter(slot: SceneCharacterSlot): boolean {
  if (slot === "us1") {
    return AppState.hasUs1Identity();
  }

  return AppState.getAccountForSlot(slot) !== null;
}

function toHeadLabel(label: string): string {
  const compact = label.replace(/\s+/g, "").trim().toUpperCase();
  return compact.slice(0, 2) || "?";
}

export function buildSceneCharacterRoster(): SceneCharacterDescriptor[] {
  return SCENE_CHARACTER_ANCHORS.map((anchor) => {
    const assigned = isAssignedSceneCharacter(anchor.slot);
    const label = assigned ? AppState.getNickname(anchor.slot) : anchor.fallbackLabel;

    return {
      id: anchor.id,
      slot: anchor.slot,
      label,
      headLabel: toHeadLabel(label),
      leftPct: anchor.leftPct,
      bottomPct: anchor.bottomPct,
      scale: anchor.scale,
      state: getSceneCharacterState(anchor.slot),
      variant: assigned ? "assigned" : "placeholder",
      bodySrc: SCENE_THEME_CONFIG.entrance.characterBodySrc,
    };
  });
}
