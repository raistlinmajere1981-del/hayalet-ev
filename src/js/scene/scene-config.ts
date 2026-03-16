import loadingDoor01 from "../../assets/themes/castle/loading/loading_door_01.webp";
import loadingDoor02 from "../../assets/themes/castle/loading/loading_door_02.webp";
import loadingDoor03 from "../../assets/themes/castle/loading/loading_door_03.webp";
import loadingDoor04 from "../../assets/themes/castle/loading/loading_door_04.webp";
import entranceBackground from "../../assets/themes/castle/entrance/entrance_bg_main.webp";
import characterBodyBase from "../../assets/themes/castle/characters/ai/ai_body_base.webp";

export const SCENE_THEME_CONFIG = {
  themeId: "castle",
  loading: {
    frameDurationMs: 180,
    frames: [loadingDoor01, loadingDoor02, loadingDoor03, loadingDoor04],
  },
  entrance: {
    backgroundSrc: entranceBackground,
    characterBodySrc: characterBodyBase,
  },
} as const;
