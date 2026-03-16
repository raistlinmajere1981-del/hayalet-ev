import loadingDoor01 from "../../assets/themes/castle/loading/loading_door_01.webp";
import loadingDoor02 from "../../assets/themes/castle/loading/loading_door_02.webp";
import loadingDoor03 from "../../assets/themes/castle/loading/loading_door_03.webp";
import loadingDoor04 from "../../assets/themes/castle/loading/loading_door_04.webp";
import entranceBackground from "../../assets/themes/castle/entrance/entrance_bg_main.webp";
import aiBodyBase from "../../assets/themes/castle/characters/ai/ai_body_base.webp";
import assistantBodyBase from "../../assets/themes/castle/characters/assistant/assistant_body_base.webp";
import humanBodyBase from "../../assets/themes/castle/characters/human/human_body_base.webp";
import userBodyBase from "../../assets/themes/castle/characters/user/user_body_base.webp";

import type {
  SceneCharacterRole,
  SceneCharacterRoleConfig,
} from "../pages/entrance/scene/scene-character-role.js";

const SCENE_CHARACTER_ROLE_CONFIG: Record<SceneCharacterRole, SceneCharacterRoleConfig> = {
  ai: {
    bodySrc: aiBodyBase,
    bodyScale: 0.94,
    headTopPct: 29.5,
    headLeftPct: 50,
    headSizePct: 47.5,
    avatarScale: 1.08,
  },
  assistant: {
    bodySrc: assistantBodyBase,
    bodyScale: 0.82,
    headTopPct: 30,
    headLeftPct: 50,
    headSizePct: 46,
    avatarScale: 1.06,
  },
  human: {
    bodySrc: humanBodyBase,
    bodyScale: 0.86,
    headTopPct: 28.5,
    headLeftPct: 50,
    headSizePct: 45,
    avatarScale: 1.04,
  },
  user: {
    bodySrc: userBodyBase,
    bodyScale: 0.84,
    headTopPct: 29,
    headLeftPct: 50,
    headSizePct: 46,
    avatarScale: 1.05,
  },
};

export const SCENE_THEME_CONFIG = {
  themeId: "castle",
  loading: {
    frameDurationMs: 180,
    frames: [loadingDoor01, loadingDoor02, loadingDoor03, loadingDoor04],
  },
  entrance: {
    backgroundSrc: entranceBackground,
    characterRoles: SCENE_CHARACTER_ROLE_CONFIG,
    fallbackCharacterRole: "ai" as SceneCharacterRole,
  },
} as const;

export function getSceneCharacterRoleConfig(role: SceneCharacterRole): SceneCharacterRoleConfig {
  return (
    SCENE_THEME_CONFIG.entrance.characterRoles[role] ??
    SCENE_THEME_CONFIG.entrance.characterRoles[SCENE_THEME_CONFIG.entrance.fallbackCharacterRole]
  );
}
