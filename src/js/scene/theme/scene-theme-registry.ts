import { CASTLE_SCENE_THEME_PACK } from "../../../assets/themes/castle/scene/manifest.js";

import type { SceneThemePack } from "../schema.js";

export const ACTIVE_SCENE_THEME_PACK = CASTLE_SCENE_THEME_PACK;

export function getSceneThemePack(): SceneThemePack {
  return ACTIVE_SCENE_THEME_PACK;
}

export function getSceneThemeId(): string {
  return ACTIVE_SCENE_THEME_PACK.themeId;
}
