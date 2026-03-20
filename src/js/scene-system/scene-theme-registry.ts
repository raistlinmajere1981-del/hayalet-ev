import { CASTLE_THEME_SOURCE } from "@theme-source/castle/manifest.js";

import type { SceneThemeSourceDefinition } from "./theme-source-contract.js";

export const ACTIVE_SCENE_THEME = CASTLE_THEME_SOURCE as unknown as SceneThemeSourceDefinition;

export function getActiveSceneTheme(): SceneThemeSourceDefinition {
  return ACTIVE_SCENE_THEME;
}
