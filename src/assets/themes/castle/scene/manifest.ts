import type { SceneThemePack } from "../../../../js/scene/schema.js";

import analyzeArchivePanel from "../analyze/analyze_archive.webp";
import analyzeBackground from "../analyze/analyze_main_bg.webp";
import analyzeTablePanel from "../analyze/analyze_table.webp";
import assistantBackground from "../assistant/assistant_bg_main.webp";
import assistantScreen from "../assistant/assistant_screen.webp";
import aiBodyBase from "../characters/ai/ai_body_base.webp";
import assistantBodyBase from "../characters/assistant/assistant_body_base.webp";
import humanBodyBase from "../characters/human/human_body_base.webp";
import userBodyBase from "../characters/user/user_body_base.webp";
import entranceBackground from "../entrance/entrance_bg_main.webp";
import entranceWhisperBackground from "../entrance/entrance_whisper.webp";
import loadingDoor01 from "../loading/loading_door_01.webp";
import loadingDoor02 from "../loading/loading_door_02.webp";
import loadingDoor03 from "../loading/loading_door_03.webp";
import loadingDoor04 from "../loading/loading_door_04.webp";
import serverBackground from "../server/server_bg_main.webp";
import serverTerminalPanel from "../server/server_terminal.webp";
import settingsAccountsPanel from "../settings/settings_accounts.webp";
import settingsBackupPanel from "../settings/settings_backup.webp";
import settingsBackground from "../settings/settings_bg_main.webp";
import settingsLogViewPanel from "../settings/settings_log_view.webp";
import settingsRoomsPanel from "../settings/settings_rooms.webp";
import settingsThemePanel from "../settings/settings_theme.webp";

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
  ui: {
    backZones: {
      revealMode: "hover-and-focus",
      sides: ["left", "right"],
      labels: {
        left: "back",
        right: "back",
      },
    },
  },
  debug: {
    defaultRoomId: "entrance",
    editableRoomIds: ["entrance", "analyze", "assistant", "server", "settings"],
    draftStorageKeys: {
      entrance: "entrance-scene-map-draft-v1",
      analyze: "analyze-scene-map-draft-v1",
      assistant: "assistant-scene-map-draft-v1",
      server: "server-scene-map-draft-v1",
      settings: "settings-scene-map-draft-v1",
    },
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
