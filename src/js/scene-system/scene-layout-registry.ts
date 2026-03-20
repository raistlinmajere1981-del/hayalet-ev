import { CASTLE_SCENE_LAYOUTS, CASTLE_SCENE_THEME_ID } from "@theme-source/castle/scene-layouts.js";

import type { SceneRoomId } from "../scene/schema.js";
import type { SceneLayoutConfig } from "../scene/layout/index.js";

export const ACTIVE_SCENE_THEME_ID = CASTLE_SCENE_THEME_ID;
export const ACTIVE_SCENE_LAYOUTS =
  CASTLE_SCENE_LAYOUTS as unknown as Record<SceneRoomId, SceneLayoutConfig>;

export function getSceneThemeId(): string {
  return ACTIVE_SCENE_THEME_ID;
}

export function getSceneRoomLayout(roomId: SceneRoomId): SceneLayoutConfig {
  return ACTIVE_SCENE_LAYOUTS[roomId];
}

export function getSceneRoomSourcePath(roomId: SceneRoomId): string {
  return `shared/themes/${getSceneThemeId()}/maps/${roomId}.scene.json`;
}

export function getSceneClickableDefaultsSourcePath(): string {
  return `shared/themes/${getSceneThemeId()}/scene-clickable-defaults.ts`;
}
