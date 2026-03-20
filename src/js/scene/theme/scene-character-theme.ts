import type {
  SceneCharacterRole,
  SceneCharacterRoleConfig,
  SceneCharacterThemeDefinition,
} from "../schema.js";

import { getSceneThemePack } from "./scene-theme-registry.js";

export function getSceneCharacterTheme(): SceneCharacterThemeDefinition {
  return getSceneThemePack().characters;
}

export function getSceneCharacterRoleConfig(role: SceneCharacterRole): SceneCharacterRoleConfig {
  const characterTheme = getSceneCharacterTheme();
  const roleConfig = characterTheme.roles[role];
  const fallbackConfig = characterTheme.roles[characterTheme.fallbackRole];

  return (roleConfig ?? fallbackConfig) as SceneCharacterRoleConfig;
}
