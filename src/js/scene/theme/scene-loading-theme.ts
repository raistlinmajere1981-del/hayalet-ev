import type { SceneLoadingThemeDefinition } from "../schema.js";

import { getSceneThemePack } from "./scene-theme-registry.js";

export function getSceneLoadingTheme(): SceneLoadingThemeDefinition {
  return getSceneThemePack().loading;
}
