import type { SceneThemePack } from "../schema.js";

import analyzeArchivePanel from "../../../assets/themes/castle/analyze/analyze_archive.webp";
import analyzeBackground from "../../../assets/themes/castle/analyze/analyze_main_bg.webp";
import analyzeTablePanel from "../../../assets/themes/castle/analyze/analyze_table.webp";
import assistantBackground from "../../../assets/themes/castle/assistant/assistant_bg_main.webp";
import assistantScreen from "../../../assets/themes/castle/assistant/assistant_screen.webp";
import aiBodyBase from "../../../assets/themes/castle/characters/ai/ai_body_base.webp";
import assistantBodyBase from "../../../assets/themes/castle/characters/assistant/assistant_body_base.webp";
import humanBodyBase from "../../../assets/themes/castle/characters/human/human_body_base.webp";
import userBodyBase from "../../../assets/themes/castle/characters/user/user_body_base.webp";
import entranceBackground from "../../../assets/themes/castle/entrance/entrance_bg_main.webp";
import entranceWhisperBackground from "../../../assets/themes/castle/entrance/entrance_whisper.webp";
import loadingDoor01 from "../../../assets/themes/castle/loading/loading_door_01.webp";
import loadingDoor02 from "../../../assets/themes/castle/loading/loading_door_02.webp";
import loadingDoor03 from "../../../assets/themes/castle/loading/loading_door_03.webp";
import loadingDoor04 from "../../../assets/themes/castle/loading/loading_door_04.webp";
import roomsBackground from "../../../assets/themes/castle/rooms/rooms_bg_main.webp";
import serverBackground from "../../../assets/themes/castle/server/server_bg_main.webp";
import serverTerminalPanel from "../../../assets/themes/castle/server/server_terminal.webp";
import settingsAccountsPanel from "../../../assets/themes/castle/settings/settings_accounts.webp";
import settingsBackupPanel from "../../../assets/themes/castle/settings/settings_backup.webp";
import settingsBackground from "../../../assets/themes/castle/settings/settings_bg_main.webp";
import settingsLogViewPanel from "../../../assets/themes/castle/settings/settings_log_view.webp";
import settingsRoomsPanel from "../../../assets/themes/castle/settings/settings_rooms.webp";
import settingsThemePanel from "../../../assets/themes/castle/settings/settings_theme.webp";

export const CASTLE_SCENE_THEME_PACK = {
  themeId: "castle",
  loading: {
    frameDurationMs: 180,
    frames: [loadingDoor01, loadingDoor02, loadingDoor03, loadingDoor04],
  },
  characters: {
    roles: {
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
    },
    fallbackRole: "ai",
  },
  rooms: {
    entrance: {
      backgroundSrc: entranceBackground,
      views: {
        whisper: {
          backgroundSrc: entranceWhisperBackground,
        },
      },
    },
    analyze: {
      backgroundSrc: analyzeBackground,
      panels: {
        archive: analyzeArchivePanel,
        table: analyzeTablePanel,
      },
    },
    assistant: {
      backgroundSrc: assistantBackground,
      views: {
        primary: {
          panelArtSrc: assistantScreen,
        },
      },
    },
    server: {
      backgroundSrc: serverBackground,
      views: {
        primary: {
          panelArtSrc: serverTerminalPanel,
        },
      },
    },
    rooms: {
      backgroundSrc: roomsBackground,
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
  },
} satisfies SceneThemePack;
