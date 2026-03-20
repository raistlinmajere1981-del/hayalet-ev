export const SCENE_ROOM_IDS = [
  "entrance",
  "analyze",
  "assistant",
  "server",
  "rooms",
  "settings",
] as const;

export type SceneRoomId = (typeof SCENE_ROOM_IDS)[number];
export type SceneDebugEditableRoomId = SceneRoomId;

export function isSceneRoomId(value: string | null | undefined): value is SceneRoomId {
  return value !== null && value !== undefined && SCENE_ROOM_IDS.includes(value as SceneRoomId);
}

export const SCENE_NODE_KINDS = ["object", "character"] as const;
export type SceneNodeKind = (typeof SCENE_NODE_KINDS)[number];

export function isSceneNodeKind(value: string | null | undefined): value is SceneNodeKind {
  return value !== null && value !== undefined && SCENE_NODE_KINDS.includes(value as SceneNodeKind);
}

export const SCENE_LABEL_FONT_PRESETS = [
  "display",
  "inscription",
  "classic",
  "sans",
  "rounded",
  "condensed",
  "mono",
] as const;

export type SceneLabelFontPreset = (typeof SCENE_LABEL_FONT_PRESETS)[number];

export const SCENE_CHARACTER_ROSTER_PRESETS = [
  "all-characters",
  "connected-plus-user",
  "assistant-only",
  "user-only",
] as const;

export type SceneCharacterRosterPreset = (typeof SCENE_CHARACTER_ROSTER_PRESETS)[number];

export type SceneCharacterRole = "ai" | "assistant" | "human" | "user";
export type SceneCharacterKind = "ai" | "assistant" | "us1" | "user";
export type SceneCharacterSlot = "ai0" | "ai1" | "ai2" | "us1";

export interface SceneNavigateAction {
  type: "navigate";
  page: Exclude<SceneRoomId, "settings">;
}

export interface SceneSettingsAction {
  type: "settings";
  panel: "theme" | "accounts" | "backup" | "rooms" | "live-log" | null;
}

export interface SceneSettingsSceneCloseAction {
  type: "settings-scene-close";
}

export interface SceneScreenAction {
  type: "screen";
  screen: "primary" | "archive";
}

export interface SceneWhisperAction {
  type: "whisper";
}

export interface SceneBackAction {
  type: "back";
  target: "room";
}

export type SceneInteractiveAction =
  | SceneNavigateAction
  | SceneSettingsAction
  | SceneSettingsSceneCloseAction
  | SceneScreenAction
  | SceneWhisperAction;

export type SceneObjectAction = SceneInteractiveAction | SceneBackAction;
export type SceneNodeAction = SceneObjectAction;

export interface SceneNodeRect {
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
}

export interface SceneNodeFrameDefinition {
  variant: "flat" | "upper" | "left-angled" | "right-angled";
  rotateDeg: number;
  perspectiveDeg: number;
  hoverGlowHueDeg: number;
  hoverGlowAlpha: number;
}

export interface SceneNodeLabelDefinition {
  visible: boolean;
  textKey: string;
  customText?: string;
  centerXPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  rotateDeg: number;
  fontSizePx: number;
  letterSpacingPx: number;
  fontPreset: SceneLabelFontPreset;
  framePerspectiveDeg: number;
}

export type SceneObjectRole = "hotspot" | "back";

export interface SceneObjectNodeDefinition {
  id: string;
  kind: "object";
  role: SceneObjectRole;
  viewId: string | null;
  action: SceneObjectAction;
  rect: SceneNodeRect;
  frame: SceneNodeFrameDefinition;
  label: SceneNodeLabelDefinition;
}

export interface SceneCharacterNodeDefinition {
  id: string;
  kind: "character";
  characterKind: string;
  preferredSlot?: string;
  leftPx: number;
  bottomPx: number;
  scale: number;
  depth: number;
}

export type SceneNodeDefinition = SceneObjectNodeDefinition | SceneCharacterNodeDefinition;

export interface SceneRoomDefinition {
  id: SceneRoomId;
  page: SceneRoomId;
  referenceSize: {
    width: number;
    height: number;
  };
  nodes: SceneNodeDefinition[];
}

export interface SceneCharacterVisualConfig {
  bodySrc: string;
  bodyScale: number;
  headTopPct: number;
  headLeftPct: number;
  headSizePct: number;
  avatarScale: number;
}

export type SceneCharacterRoleConfig = SceneCharacterVisualConfig;

export interface SceneLoadingThemeDefinition {
  frameDurationMs: number;
  frames: string[];
}

export interface SceneCharacterThemeDefinition {
  roles: Record<string, SceneCharacterVisualConfig>;
  fallbackRole: string;
}

export interface SceneThemeViewDefinition {
  backgroundSrc?: string;
  panelArtSrc?: string;
}

export interface SceneRoomThemeDefinition {
  backgroundSrc: string;
  panels?: Record<string, string>;
  views?: Record<string, SceneThemeViewDefinition>;
}

export interface SceneDebugThemeDefinition {
  defaultRoomId: SceneDebugEditableRoomId;
  editableRoomIds: readonly SceneDebugEditableRoomId[];
  draftStorageKeys: Record<SceneDebugEditableRoomId, string>;
}

export interface SceneThemePack {
  themeId: string;
  loading: SceneLoadingThemeDefinition;
  characters: SceneCharacterThemeDefinition;
  rooms: Record<SceneRoomId, SceneRoomThemeDefinition>;
}
