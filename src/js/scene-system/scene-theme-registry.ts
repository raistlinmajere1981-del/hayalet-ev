import { CASTLE_THEME_SOURCE } from "@theme-source/castle/manifest.js";

import type { SceneRoomId } from "../scene/schema.js";
import type { SceneLayoutConfig } from "../scene/layout/index.js";

import type { SceneThemeSourceDefinition } from "./theme-source-contract.js";

export const ACTIVE_SCENE_THEME = CASTLE_THEME_SOURCE as unknown as SceneThemeSourceDefinition;

export function getActiveSceneTheme(): SceneThemeSourceDefinition {
  return ACTIVE_SCENE_THEME;
}

export function getSceneThemeId(): string {
  return ACTIVE_SCENE_THEME.themeId;
}

export function getSceneRoomLayout(roomId: SceneRoomId): SceneLayoutConfig {
  return ACTIVE_SCENE_THEME.maps[roomId];
}

export function getSceneRoomSourcePath(roomId: SceneRoomId): string {
  return `shared/themes/${getSceneThemeId()}/maps/${roomId}.scene.json`;
}
