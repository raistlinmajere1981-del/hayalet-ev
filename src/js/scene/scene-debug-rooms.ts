export type SceneDebugRoomId = "entrance" | "assistant" | "settings";

const SCENE_DEBUG_ROOM_ATTRIBUTE = "data-scene-debug-room";

export interface SceneDebugRoomDefinition {
  id: SceneDebugRoomId;
  page: SceneDebugRoomId;
  labelKey: string;
}

export function isSceneDebugRoomId(value: string | null | undefined): value is SceneDebugRoomId {
  return value === "entrance" || value === "assistant" || value === "settings";
}

export function getActiveSceneDebugRoomId(): SceneDebugRoomId | null {
  if (typeof document === "undefined") {
    return null;
  }

  const value = document.documentElement.getAttribute(SCENE_DEBUG_ROOM_ATTRIBUTE);
  return isSceneDebugRoomId(value) ? value : null;
}

export function setActiveSceneDebugRoomId(roomId: SceneDebugRoomId | null): void {
  if (typeof document === "undefined") {
    return;
  }

  if (roomId === null) {
    document.documentElement.removeAttribute(SCENE_DEBUG_ROOM_ATTRIBUTE);
    return;
  }

  document.documentElement.setAttribute(SCENE_DEBUG_ROOM_ATTRIBUTE, roomId);
}

export const SCENE_DEBUG_ROOMS: readonly SceneDebugRoomDefinition[] = [
  {
    id: "entrance",
    page: "entrance",
    labelKey: "sideNav.entranceLabel",
  },
  {
    id: "assistant",
    page: "assistant",
    labelKey: "sideNav.assistantLabel",
  },
  {
    id: "settings",
    page: "settings",
    labelKey: "settingsHub.openButton",
  },
];
