export type SceneDebugRoomId = "entrance" | "assistant";

export interface SceneDebugRoomDefinition {
  id: SceneDebugRoomId;
  page: SceneDebugRoomId;
  labelKey: string;
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
];
