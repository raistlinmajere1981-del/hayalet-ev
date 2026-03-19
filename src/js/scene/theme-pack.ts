import { CASTLE_SCENE_THEME_PACK } from "../../assets/themes/castle/scene/manifest.js";

import type {
  SceneCharacterRole,
  SceneCharacterRoleConfig,
} from "../pages/entrance/scene/scene-character-role.js";
import type {
  SceneBackZoneThemeDefinition,
  SceneDebugEditableRoomId,
  SceneDebugThemeDefinition,
  SceneRoomId,
  SceneThemePack,
  SceneThemeViewDefinition,
} from "./schema.js";

export const ACTIVE_SCENE_THEME_PACK = CASTLE_SCENE_THEME_PACK;

function getSceneRoomTheme(roomId: SceneRoomId): SceneThemePack["rooms"][SceneRoomId] {
  return ACTIVE_SCENE_THEME_PACK.rooms[roomId];
}

export function getSceneThemePack(): SceneThemePack {
  return ACTIVE_SCENE_THEME_PACK;
}

export function getSceneThemeId(): string {
  return ACTIVE_SCENE_THEME_PACK.themeId;
}

export function getSceneLoadingTheme(): SceneThemePack["loading"] {
  return ACTIVE_SCENE_THEME_PACK.loading;
}

export function getSceneBackZonePolicy(): SceneBackZoneThemeDefinition {
  return ACTIVE_SCENE_THEME_PACK.ui.backZones;
}

export function getSceneDebugThemeConfig(): SceneDebugThemeDefinition {
  return ACTIVE_SCENE_THEME_PACK.debug;
}

export function getSceneDebugDraftStorageKey(roomId: SceneDebugEditableRoomId): string {
  return ACTIVE_SCENE_THEME_PACK.debug.draftStorageKeys[roomId];
}

export function getSceneRoomBackgroundSrc(roomId: SceneRoomId): string {
  return getSceneRoomTheme(roomId).backgroundSrc;
}

export function getSceneRoomViewDefinition(
  roomId: SceneRoomId,
  viewId: string
): SceneThemeViewDefinition | null {
  return getSceneRoomTheme(roomId).views?.[viewId] ?? null;
}

export function getSceneRoomViewBackgroundSrc(
  roomId: SceneRoomId,
  viewId: string,
  fallbackToRoomBackground = true
): string | null {
  const backgroundSrc = getSceneRoomTheme(roomId).views?.[viewId]?.backgroundSrc ?? null;
  if (backgroundSrc !== null) {
    return backgroundSrc;
  }

  return fallbackToRoomBackground ? getSceneRoomBackgroundSrc(roomId) : null;
}

export function getSceneRoomViewPanelArtSrc(roomId: SceneRoomId, viewId: string): string | null {
  return getSceneRoomTheme(roomId).views?.[viewId]?.panelArtSrc ?? null;
}

export function getSceneRoomPanelSrc(roomId: SceneRoomId, panelId: string): string | null {
  return getSceneRoomTheme(roomId).panels?.[panelId] ?? null;
}

export function getSceneCharacterRoleConfig(role: SceneCharacterRole): SceneCharacterRoleConfig {
  return ACTIVE_SCENE_THEME_PACK.characters.roles[role] as SceneCharacterRoleConfig;
}
