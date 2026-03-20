import { SCENE_CLICKABLE_DEFAULTS } from "@theme-source/castle/scene-clickable-defaults.js";
import { CASTLE_SCENE_LAYOUTS, CASTLE_SCENE_THEME_ID } from "@theme-source/castle/scene-layouts.js";

import type { SceneThemeRegistration } from "./scene-theme-registry-contract.js";

const BUILTIN_SCENE_THEME_REGISTRATIONS: SceneThemeRegistration[] = [
  {
    themeId: CASTLE_SCENE_THEME_ID,
    label: "Castle",
    sourceKind: "built-in",
    sourceRoot: `shared/themes/${CASTLE_SCENE_THEME_ID}`,
    maps: CASTLE_SCENE_LAYOUTS,
    clickableDefaults: SCENE_CLICKABLE_DEFAULTS,
  },
];

export function getBuiltInSceneThemeRegistrations(): SceneThemeRegistration[] {
  return [...BUILTIN_SCENE_THEME_REGISTRATIONS];
}
