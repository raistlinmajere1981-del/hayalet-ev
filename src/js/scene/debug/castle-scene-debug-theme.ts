import type { SceneDebugThemeDefinition } from "../schema.js";

export const CASTLE_SCENE_DEBUG_THEME = {
  defaultRoomId: "entrance",
  editableRoomIds: ["entrance", "analyze", "assistant", "server", "rooms", "settings"],
  draftStorageKeys: {
    entrance: "entrance-scene-map-draft-v1",
    analyze: "analyze-scene-map-draft-v1",
    assistant: "assistant-scene-map-draft-v1",
    server: "server-scene-map-draft-v1",
    rooms: "rooms-scene-map-draft-v1",
    settings: "settings-scene-map-draft-v1",
  },
} satisfies SceneDebugThemeDefinition;
