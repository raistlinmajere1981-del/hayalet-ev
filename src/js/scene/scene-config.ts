import loadingDoor01 from "../../assets/themes/castle/loading/loading_door_01.webp";
import loadingDoor02 from "../../assets/themes/castle/loading/loading_door_02.webp";
import loadingDoor03 from "../../assets/themes/castle/loading/loading_door_03.webp";
import loadingDoor04 from "../../assets/themes/castle/loading/loading_door_04.webp";
import entranceBackground from "../../assets/themes/castle/entrance/entrance_bg_main.webp";
import settingsBackground from "../../assets/themes/castle/settings/settings_bg_main.webp";
import settingsThemePanel from "../../assets/themes/castle/settings/settings_theme.webp";
import settingsAccountsPanel from "../../assets/themes/castle/settings/settings_accounts.webp";
import settingsBackupPanel from "../../assets/themes/castle/settings/settings_backup.webp";
import settingsRoomsPanel from "../../assets/themes/castle/settings/settings_rooms.webp";
import settingsLogViewPanel from "../../assets/themes/castle/settings/settings_log_view.webp";
import serverBackground from "../../assets/themes/castle/server/server_bg_main.webp";
import serverTerminalPanel from "../../assets/themes/castle/server/server_terminal.webp";
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
    bodyScale: 0.8,
    headTopPct: 31,
    headLeftPct: 50,
    headSizePct: 60,
    avatarScale: 1,
  },
  assistant: {
    bodySrc: assistantBodyBase,
    bodyScale: 0.8,
    headTopPct: 33,
    headLeftPct: 50,
    headSizePct: 38,
    avatarScale: 1,
  },
  human: {
    bodySrc: humanBodyBase,
    bodyScale: 1.2,
    headTopPct: 16,
    headLeftPct: 50,
    headSizePct: 70,
    avatarScale: 1,
  },
  user: {
    bodySrc: userBodyBase,
    bodyScale: 1.2,
    headTopPct: 13,
    headLeftPct: 50,
    headSizePct: 25,
    avatarScale: 1,
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
  settings: {
    backgroundSrc: settingsBackground,
    panels: {
      theme: settingsThemePanel,
      accounts: settingsAccountsPanel,
      backup: settingsBackupPanel,
      rooms: settingsRoomsPanel,
      "live-log": settingsLogViewPanel,
    },
  },
  server: {
    backgroundSrc: serverBackground,
    panelArtSrc: serverTerminalPanel,
  },
} as const;

export function getSceneCharacterRoleConfig(role: SceneCharacterRole): SceneCharacterRoleConfig {
  return SCENE_THEME_CONFIG.entrance.characterRoles[role];
}
