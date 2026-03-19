import { isSceneRoomId, SCENE_ROOM_IDS, type SceneRoomId } from "./schema.js";

export type SceneDebugRoomId = SceneRoomId;

const SCENE_DEBUG_ROOM_ATTRIBUTE = "data-scene-debug-room";
const SCENE_DEBUG_ROOM_LABEL_KEYS: Record<SceneDebugRoomId, string> = {
  entrance: "sideNav.entranceLabel",
  analyze: "sideNav.analyzeLabel",
  assistant: "sideNav.assistantLabel",
  server: "sideNav.serverLabel",
  rooms: "sideNav.roomsLabel",
  settings: "settingsHub.openButton",
};

export interface SceneDebugRoomDefinition {
  id: SceneDebugRoomId;
  page: SceneDebugRoomId;
  labelKey: string;
}

export function isSceneDebugRoomId(value: string | null | undefined): value is SceneDebugRoomId {
  return isSceneRoomId(value);
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
  ...SCENE_ROOM_IDS.map((roomId) => ({
    id: roomId,
    page: roomId,
    labelKey: SCENE_DEBUG_ROOM_LABEL_KEYS[roomId],
  })),
];
