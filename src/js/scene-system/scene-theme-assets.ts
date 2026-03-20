import type { SceneRoomId, SceneRoomThemeDefinition, SceneThemeViewDefinition } from "../scene/schema.js";

import { getActiveSceneTheme } from "./scene-theme-registry.js";

export function getSceneRoomTheme(roomId: SceneRoomId): SceneRoomThemeDefinition {
  return getActiveSceneTheme().rooms[roomId];
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
  const backgroundSrc = getSceneRoomViewDefinition(roomId, viewId)?.backgroundSrc ?? null;
  if (backgroundSrc !== null) {
    return backgroundSrc;
  }

  return fallbackToRoomBackground ? getSceneRoomBackgroundSrc(roomId) : null;
}

export function getSceneRoomViewPanelArtSrc(roomId: SceneRoomId, viewId: string): string | null {
  return getSceneRoomViewDefinition(roomId, viewId)?.panelArtSrc ?? null;
}

export function getSceneRoomPanelSrc(roomId: SceneRoomId, panelId: string): string | null {
  return getSceneRoomTheme(roomId).panels?.[panelId] ?? null;
}
