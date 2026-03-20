import { isSceneRoomId, SCENE_ROOM_IDS, type SceneRoomId } from "../scene/schema.js";
import { navigateToScenePage, openSceneSettingsPanel } from "../scene/navigation.js";
import { isSceneUiMode } from "../ui/ui-mode.js";

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

export function getSceneDebugRoomOptions(
  translate: (key: string) => string
): Array<{ id: SceneDebugRoomId; label: string }> {
  return SCENE_DEBUG_ROOMS.map((room) => ({
    id: room.id,
    label: translate(room.labelKey),
  }));
}

export function isSceneDebugRoomActive(roomId: SceneDebugRoomId): boolean {
  if (!isSceneUiMode()) {
    return false;
  }

  const activeRoomId = getActiveSceneDebugRoomId();
  const fallbackRoomId = document.documentElement.getAttribute("data-active-page");
  return (activeRoomId ?? fallbackRoomId) === roomId;
}

export function openSceneDebugRoom(roomId: SceneDebugRoomId): void {
  if (roomId === "settings") {
    openSceneSettingsPanel(null);
    return;
  }

  navigateToScenePage(roomId);
}
