import type {
  SceneCharacterThemeDefinition,
  SceneLoadingThemeDefinition,
  SceneRoomId,
  SceneRoomThemeDefinition,
} from "../scene/schema.js";
import type { SceneLayoutConfig } from "../scene/layout/index.js";

export interface SceneThemeSourceDefinition {
  themeId: string;
  loading: SceneLoadingThemeDefinition;
  characters: SceneCharacterThemeDefinition;
  rooms: Record<SceneRoomId, SceneRoomThemeDefinition>;
  maps: Record<SceneRoomId, SceneLayoutConfig>;
}
