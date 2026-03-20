import type { SceneRoomId, SceneRoomThemeDefinition, SceneThemeViewDefinition } from "../scene/schema.js";

import {
  getSceneThemeAssetEntryRuntimeSource,
  getSceneThemeAssetTransparentWindow,
} from "../scene-editor/scene-theme-asset-state.js";
import { getActiveSceneTheme } from "./scene-theme-registry.js";

export function getSceneRoomTheme(roomId: SceneRoomId): SceneRoomThemeDefinition {
  return getActiveSceneTheme().rooms[roomId];
}

export function getSceneRoomBackgroundSrc(roomId: SceneRoomId): string {
  return getSceneThemeAssetEntryRuntimeSource(roomId, "background") ?? getSceneRoomTheme(roomId).backgroundSrc;
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
  const backgroundSrc =
    getSceneThemeAssetEntryRuntimeSource(roomId, "view-background", viewId) ??
    getSceneRoomViewDefinition(roomId, viewId)?.backgroundSrc ??
    null;
  if (backgroundSrc !== null) {
    return backgroundSrc;
  }

  return fallbackToRoomBackground ? getSceneRoomBackgroundSrc(roomId) : null;
}

export function getSceneRoomViewPanelArtSrc(roomId: SceneRoomId, viewId: string): string | null {
  return (
    getSceneThemeAssetEntryRuntimeSource(roomId, "view-panel-art", viewId) ??
    getSceneRoomViewDefinition(roomId, viewId)?.panelArtSrc ??
    null
  );
}

export function getSceneRoomPanelSrc(roomId: SceneRoomId, panelId: string): string | null {
  return getSceneThemeAssetEntryRuntimeSource(roomId, "panel", panelId) ?? getSceneRoomTheme(roomId).panels?.[panelId] ?? null;
}

export function getSceneRoomViewPanelTransparentWindow(
  roomId: SceneRoomId,
  viewId: string
) {
  return getSceneThemeAssetTransparentWindow(roomId, "view-panel-art", viewId);
}

export function getSceneRoomPanelTransparentWindow(roomId: SceneRoomId, panelId: string) {
  return getSceneThemeAssetTransparentWindow(roomId, "panel", panelId);
}
