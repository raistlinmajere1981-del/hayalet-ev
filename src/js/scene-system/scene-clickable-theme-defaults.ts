import { SCENE_CLICKABLE_DEFAULTS as CASTLE_SCENE_CLICKABLE_DEFAULTS } from "@theme-source/castle/scene-clickable-defaults.js";

import type { SceneClickableThemeDefinition } from "../scene/schema.js";

import { cloneSceneClickableTheme } from "./scene-clickable-theme-core.js";
import { getSceneThemeId } from "./scene-layout-registry.js";

export function getSceneDefaultClickableTheme(): SceneClickableThemeDefinition {
  switch (getSceneThemeId()) {
    case "castle":
    default:
      return cloneSceneClickableTheme(CASTLE_SCENE_CLICKABLE_DEFAULTS);
  }
}
