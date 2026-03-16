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
    leftPct: 8.8,
    topPct: 43.8,
    widthPct: 9.4,
    heightPct: 26.5,
    labelLeftPct: 11.5,
    labelTopPct: 44,
    labelWidthPct: 17.5,
    labelRotateDeg: 13,
    action: { type: "navigate", page: "analyze" },
  },
  {
    id: "door-archives",
    labelKey: "sideNav.archivesLabel",
    leftPct: 24.3,
    topPct: 44.2,
    widthPct: 9.4,
    heightPct: 26.4,
    labelLeftPct: 29,
    labelTopPct: 47.5,
    labelWidthPct: 16.8,
    labelRotateDeg: 0,
    action: { type: "navigate", page: "archives" },
  },
  {
    id: "door-whisper",
    labelKey: "sideNav.whisperLabel",
    leftPct: 25.1,
    topPct: 10.8,
    widthPct: 7.8,
    heightPct: 21.8,
    labelLeftPct: 29,
    labelTopPct: 10,
    labelWidthPct: 16.5,
    labelRotateDeg: 0,
    action: { type: "navigate", page: "whisper" },
  },
  {
    id: "door-assistant",
    labelKey: "sideNav.assistantLabel",
    leftPct: 68.1,
    topPct: 10.8,
    widthPct: 7.8,
    heightPct: 21.8,
    labelLeftPct: 71.5,
    labelTopPct: 10,
    labelWidthPct: 16.8,
    labelRotateDeg: 0,
    action: { type: "navigate", page: "assistant" },
  },
  {
    id: "door-server",
    labelKey: "sideNav.serverLabel",
    leftPct: 66.3,
    topPct: 44.2,
    widthPct: 9.4,
    heightPct: 26.4,
    labelLeftPct: 71.5,
    labelTopPct: 47.5,
    labelWidthPct: 16.8,
    labelRotateDeg: 0,
    action: { type: "navigate", page: "server" },
  },
  {
    id: "door-settings",
    labelKey: "settingsHub.openButton",
    leftPct: 81.8,
    topPct: 43.8,
    widthPct: 9.4,
    heightPct: 26.5,
    labelLeftPct: 88.5,
    labelTopPct: 44,
    labelWidthPct: 17.5,
    labelRotateDeg: -14,
    action: { type: "settings", panel: "theme" },
  },
] as const;
