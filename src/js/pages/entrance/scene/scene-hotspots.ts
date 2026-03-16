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
  labelKey: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  labelLeftPct: number;
  labelTopPct: number;
  labelWidthPct: number;
  labelRotateDeg: number;
  action: EntranceSceneHotspotAction;
}

export const ENTRANCE_SCENE_HOTSPOTS: readonly EntranceSceneHotspotConfig[] = [
  {
    id: "door-analyze",
    labelKey: "sideNav.analyzeLabel",
    leftPct: 3.8,
    topPct: 43.2,
    widthPct: 9.6,
    heightPct: 28.2,
    labelLeftPct: 13.6,
    labelTopPct: 36.9,
    labelWidthPct: 18.8,
    labelRotateDeg: -10,
    action: { type: "navigate", page: "analyze" },
  },
  {
    id: "door-archives",
    labelKey: "sideNav.archivesLabel",
    leftPct: 24.6,
    topPct: 46.1,
    widthPct: 9.8,
    heightPct: 27.8,
    labelLeftPct: 28.8,
    labelTopPct: 41.1,
    labelWidthPct: 17.8,
    labelRotateDeg: -3,
    action: { type: "navigate", page: "archives" },
  },
  {
    id: "door-whisper",
    labelKey: "sideNav.whisperLabel",
    leftPct: 20.9,
    topPct: 15.4,
    widthPct: 6.2,
    heightPct: 16.8,
    labelLeftPct: 31.6,
    labelTopPct: 11.8,
    labelWidthPct: 18.8,
    labelRotateDeg: 0,
    action: { type: "navigate", page: "whisper" },
  },
  {
    id: "door-assistant",
    labelKey: "sideNav.assistantLabel",
    leftPct: 72.9,
    topPct: 15.4,
    widthPct: 6.2,
    heightPct: 16.8,
    labelLeftPct: 68.4,
    labelTopPct: 11.8,
    labelWidthPct: 18.8,
    labelRotateDeg: 0,
    action: { type: "navigate", page: "assistant" },
  },
  {
    id: "door-server",
    labelKey: "sideNav.serverLabel",
    leftPct: 65.8,
    topPct: 46.1,
    widthPct: 9.8,
    heightPct: 27.8,
    labelLeftPct: 71.2,
    labelTopPct: 41.1,
    labelWidthPct: 17.8,
    labelRotateDeg: 3,
    action: { type: "navigate", page: "server" },
  },
  {
    id: "door-settings",
    labelKey: "settingsHub.openButton",
    leftPct: 86.8,
    topPct: 43.2,
    widthPct: 9.6,
    heightPct: 28.2,
    labelLeftPct: 88.2,
    labelTopPct: 36.9,
    labelWidthPct: 18.8,
    labelRotateDeg: 10,
    action: { type: "settings", panel: "theme" },
  },
] as const;
