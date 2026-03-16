export interface EntranceSceneHotspotActionNavigate {
  type: "navigate";
  page: "analyze" | "archives" | "server" | "whisper" | "assistant";
}

export interface EntranceSceneHotspotActionSettings {
  type: "settings";
  panel: "theme" | "accounts" | "backup" | "rooms" | "live-log";
}

export type EntranceSceneHotspotAction =
  | EntranceSceneHotspotActionNavigate
  | EntranceSceneHotspotActionSettings;

export interface EntranceSceneHotspotConfig {
  id: string;
  label: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  action: EntranceSceneHotspotAction;
}

export const ENTRANCE_SCENE_HOTSPOTS: readonly EntranceSceneHotspotConfig[] = [
  {
    id: "door-analyze",
    label: "Analyze",
    leftPct: 5.5,
    topPct: 45.5,
    widthPct: 10.5,
    heightPct: 22.5,
    action: { type: "navigate", page: "analyze" },
  },
  {
    id: "door-archives",
    label: "Archives",
    leftPct: 17.5,
    topPct: 43.5,
    widthPct: 11.5,
    heightPct: 22,
    action: { type: "navigate", page: "archives" },
  },
  {
    id: "door-whisper",
    label: "Whisper",
    leftPct: 29.5,
    topPct: 42.5,
    widthPct: 11.5,
    heightPct: 21,
    action: { type: "navigate", page: "whisper" },
  },
  {
    id: "door-assistant",
    label: "Assistant",
    leftPct: 58.5,
    topPct: 42.5,
    widthPct: 11.5,
    heightPct: 21,
    action: { type: "navigate", page: "assistant" },
  },
  {
    id: "door-server",
    label: "Server",
    leftPct: 70.5,
    topPct: 43.5,
    widthPct: 11.5,
    heightPct: 22,
    action: { type: "navigate", page: "server" },
  },
  {
    id: "door-settings",
    label: "Settings",
    leftPct: 82.5,
    topPct: 45.5,
    widthPct: 10.5,
    heightPct: 22.5,
    action: { type: "settings", panel: "theme" },
  },
] as const;
