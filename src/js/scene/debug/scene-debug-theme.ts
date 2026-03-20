import { CASTLE_SCENE_DEBUG_THEME } from "./castle-scene-debug-theme.js";

import type { SceneDebugEditableRoomId, SceneDebugThemeDefinition } from "../schema.js";

export const ACTIVE_SCENE_DEBUG_THEME = CASTLE_SCENE_DEBUG_THEME;

export function getSceneDebugThemeConfig(): SceneDebugThemeDefinition {
  return ACTIVE_SCENE_DEBUG_THEME;
}

export function getSceneDebugDraftStorageKey(roomId: SceneDebugEditableRoomId): string {
  return ACTIVE_SCENE_DEBUG_THEME.draftStorageKeys[roomId];
}
