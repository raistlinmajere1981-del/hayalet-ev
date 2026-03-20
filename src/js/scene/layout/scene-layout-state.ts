import type {
  SceneCharacterKind,
  SceneCharacterRosterPreset,
  SceneCharacterSlot,
  SceneCharacterNodeDefinition,
  SceneObjectAction,
  SceneObjectNodeDefinition,
  SceneObjectRole,
  SceneNodeDefinition,
  SceneNodeKind,
  SceneNodeLabelDefinition,
  SceneNodeRect,
  SceneNodeFrameDefinition,
  SceneRoomDefinition,
  SceneRoomId,
} from "../schema.js";
import { SCENE_LABEL_FONT_PRESETS } from "../schema.js";

export const ENTRANCE_SCENE_LABEL_FONT_PRESETS = SCENE_LABEL_FONT_PRESETS;

export type EntranceSceneLabelFontPreset = (typeof ENTRANCE_SCENE_LABEL_FONT_PRESETS)[number];
export type SceneObjectConfigAction = SceneObjectAction;

export interface SceneObjectConfig extends SceneObjectNodeDefinition {
  viewId: string | null;
}

export interface EntranceSceneCharacterConfig extends SceneCharacterNodeDefinition {
  characterKind: SceneCharacterKind;
  preferredSlot?: SceneCharacterSlot;
}

export interface EntranceSceneMap {
  characterRosterPreset: SceneCharacterRosterPreset;
  referenceSize: {
    width: number;
    height: number;
  };
  objects: SceneObjectConfig[];
  characters: EntranceSceneCharacterConfig[];
}

export type SceneDebugSelectableNodeKind = SceneNodeKind;

export type SceneDebugNodeSelection = {
  kind: SceneDebugSelectableNodeKind;
  id: string;
} | null;

export interface SceneDebugNodeListEntry {
  kind: SceneDebugSelectableNodeKind;
  id: string;
  label: string;
  viewId?: string | null;
}

function createRect(
  leftPx: number,
  topPx: number,
  widthPx: number,
  heightPx: number
): SceneNodeRect {
  return {
    leftPx,
    topPx,
    widthPx,
    heightPx,
  };
}

function createFrame(
  variant: SceneNodeFrameDefinition["variant"],
  rotateDeg: number,
  perspectiveDeg: number,
  hoverGlowHueDeg: number,
  hoverGlowAlpha: number
): SceneNodeFrameDefinition {
  return {
    variant,
    rotateDeg,
    perspectiveDeg,
    hoverGlowHueDeg,
    hoverGlowAlpha,
  };
}

function createLabel(options: {
  visible?: boolean;
  textKey: string;
  customText?: string;
  centerXPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  rotateDeg?: number;
  fontSizePx: number;
  letterSpacingPx: number;
  fontPreset?: EntranceSceneLabelFontPreset;
  framePerspectiveDeg?: number;
}): SceneNodeLabelDefinition {
  return {
    visible: options.visible ?? true,
    textKey: options.textKey,
    ...(options.customText !== undefined ? { customText: options.customText } : {}),
    centerXPx: options.centerXPx,
    topPx: options.topPx,
    widthPx: options.widthPx,
    heightPx: options.heightPx,
    rotateDeg: options.rotateDeg ?? 0,
    fontSizePx: options.fontSizePx,
    letterSpacingPx: options.letterSpacingPx,
    fontPreset: options.fontPreset ?? "display",
    framePerspectiveDeg: options.framePerspectiveDeg ?? 0,
  };
}

function createObject(
  id: string,
  action: SceneObjectConfigAction,
  rect: SceneNodeRect,
  frame: SceneNodeFrameDefinition,
  label: SceneNodeLabelDefinition,
  options: {
    role?: SceneObjectRole;
    viewId?: string | null;
  } = {}
): SceneObjectConfig {
  return {
    id,
    kind: "object",
    role: options.role ?? (action.type === "back" ? "back" : "hotspot"),
    viewId: options.viewId ?? null,
    action,
    rect,
    frame,
    label,
  };
}

function createCharacter(
  id: string,
  characterKind: SceneCharacterKind,
  leftPx: number,
  bottomPx: number,
  scale: number,
  depth: number,
  preferredSlot?: SceneCharacterSlot
): EntranceSceneCharacterConfig {
  return {
    id,
    kind: "character",
    characterKind,
    ...(preferredSlot !== undefined ? { preferredSlot } : {}),
    leftPx,
    bottomPx,
    scale,
    depth,
  };
}

function createEdgeBackLabel(topPx: number = 490): SceneNodeLabelDefinition {
  return createLabel({
    textKey: "settingsHub.scene.returnRoom",
    centerXPx: 58,
    topPx,
    widthPx: 180,
    heightPx: 40,
    fontSizePx: 18,
    letterSpacingPx: 1,
  });
}

function createEdgeBackRect(widthPx: number = 116, heightPx: number = 1080): SceneNodeRect {
  return createRect(0, 0, widthPx, heightPx);
}

export const DEFAULT_ENTRANCE_SCENE_MAP: EntranceSceneMap = {
  characterRosterPreset: "all-characters",
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  objects: [
    createObject(
      "door-analyze",
      { type: "navigate", page: "analyze" },
      createRect(171, 480, 169, 279),
      createFrame("left-angled", -2.5, 14, 33, 0.34),
      createLabel({
        textKey: "sideNav.analyzeLabel",
        centerXPx: 223,
        topPx: 476,
        widthPx: 323,
        heightPx: 46,
        rotateDeg: 13,
        fontSizePx: 24,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "door-assistant",
      { type: "navigate", page: "assistant" },
      createRect(1296, 162, 146, 227),
      createFrame("upper", 0.8, 0, 33, 0.34),
      createLabel({
        textKey: "sideNav.assistantLabel",
        centerXPx: 1382,
        topPx: 108,
        widthPx: 307,
        heightPx: 45,
        fontSizePx: 24,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "door-server",
      { type: "navigate", page: "server" },
      createRect(1302, 570, 144, 238),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "sideNav.serverLabel",
        centerXPx: 1367,
        topPx: 509,
        widthPx: 307,
        heightPx: 44,
        fontSizePx: 24,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "door-settings",
      { type: "settings", panel: null },
      createRect(1613, 518, 169, 279),
      createFrame("right-angled", 2.5, -14, 33, 0.34),
      createLabel({
        textKey: "settingsHub.openButton",
        centerXPx: 1695,
        topPx: 476,
        widthPx: 323,
        heightPx: 46,
        rotateDeg: -14,
        fontSizePx: 24,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "hatch-rooms",
      { type: "navigate", page: "rooms" },
      createRect(224, 646, 428, 304),
      createFrame("left-angled", -5, 14, 33, 0.34),
      createLabel({
        textKey: "sideNav.roomsLabel",
        centerXPx: 436,
        topPx: 598,
        widthPx: 300,
        heightPx: 44,
        rotateDeg: -10,
        fontSizePx: 22,
        letterSpacingPx: 1,
        framePerspectiveDeg: -8,
      })
    ),
    createObject(
      "board-whisper",
      { type: "whisper" },
      createRect(362, 512, 396, 246),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "panels.whisper",
        centerXPx: 560,
        topPx: 468,
        widthPx: 272,
        heightPx: 42,
        fontSizePx: 20,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "back-whisper",
      { type: "back", target: "room" },
      createEdgeBackRect(116),
      createFrame("flat", 0, 0, 33, 0.34),
      createEdgeBackLabel(502),
      {
        viewId: "whisper",
      }
    ),
  ],
  characters: [
    createCharacter("anchor-user", "user", 154, 108, 0.9, 1),
    createCharacter("anchor-ai-left-outer", "ai", 422, 162, 0.82, 2),
    createCharacter("anchor-ai1-primary", "ai", 653, 151, 0.84, 3, "ai1"),
    createCharacter("anchor-assistant", "assistant", 1152, 140, 0.66, 4, "ai0"),
    createCharacter("anchor-us1", "us1", 1363, 108, 0.82, 5, "us1"),
    createCharacter("anchor-ai2-primary", "ai", 1594, 151, 0.84, 6, "ai2"),
    createCharacter("anchor-ai-right-outer", "ai", 1766, 162, 0.82, 7),
  ],
};

export const DEFAULT_ASSISTANT_SCENE_MAP: EntranceSceneMap = {
  characterRosterPreset: "assistant-only",
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  objects: [
    createObject(
      "door-entrance",
      { type: "navigate", page: "entrance" },
      createRect(134, 238, 250, 518),
      createFrame("left-angled", -1.5, 10, 33, 0.34),
      createLabel({
        textKey: "sideNav.entranceLabel",
        customText: "Entrance",
        centerXPx: 259,
        topPx: 712,
        widthPx: 260,
        heightPx: 40,
        fontSizePx: 22,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "screen-primary",
      { type: "screen", screen: "primary" },
      createRect(845, 346, 346, 194),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "",
        customText: "Open screen",
        centerXPx: 1018,
        topPx: 500,
        widthPx: 260,
        heightPx: 40,
        fontSizePx: 22,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "back-primary",
      { type: "back", target: "room" },
      createEdgeBackRect(116),
      createFrame("flat", 0, 0, 33, 0.34),
      createEdgeBackLabel(),
      {
        viewId: "primary",
      }
    ),
  ],
  characters: [createCharacter("anchor-ai0", "assistant", 691, 108, 0.66, 4, "ai0")],
};

export const DEFAULT_ANALYZE_SCENE_MAP: EntranceSceneMap = {
  characterRosterPreset: "connected-plus-user",
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  objects: [
    createObject(
      "door-entrance",
      { type: "navigate", page: "entrance" },
      createRect(842, 286, 240, 328),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "sideNav.entranceLabel",
        customText: "Entrance",
        centerXPx: 962,
        topPx: 244,
        widthPx: 280,
        heightPx: 42,
        fontSizePx: 22,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "screen-primary",
      { type: "screen", screen: "primary" },
      createRect(644, 654, 632, 246),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "",
        customText: "Open table",
        centerXPx: 960,
        topPx: 616,
        widthPx: 300,
        heightPx: 40,
        fontSizePx: 22,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "screen-archive",
      { type: "screen", screen: "archive" },
      createRect(1540, 206, 308, 440),
      createFrame("right-angled", 1.5, -12, 33, 0.34),
      createLabel({
        textKey: "",
        customText: "Open archive",
        centerXPx: 1694,
        topPx: 164,
        widthPx: 260,
        heightPx: 40,
        fontSizePx: 22,
        letterSpacingPx: 1,
        framePerspectiveDeg: -8,
      })
    ),
    createObject(
      "back-table",
      { type: "back", target: "room" },
      createEdgeBackRect(116),
      createFrame("flat", 0, 0, 33, 0.34),
      createEdgeBackLabel(),
      {
        viewId: "table",
      }
    ),
    createObject(
      "back-archive",
      { type: "back", target: "room" },
      createEdgeBackRect(116),
      createFrame("flat", 0, 0, 33, 0.34),
      createEdgeBackLabel(),
      {
        viewId: "archive",
      }
    ),
  ],
  characters: [
    createCharacter("anchor-user", "user", 482, 102, 0.88, 2),
    createCharacter("anchor-ai1-primary", "ai", 768, 130, 0.8, 3, "ai1"),
    createCharacter("anchor-us1", "us1", 1046, 112, 0.8, 4, "us1"),
    createCharacter("anchor-ai2-primary", "ai", 1326, 128, 0.82, 5, "ai2"),
  ],
};

export const DEFAULT_SETTINGS_SCENE_MAP: EntranceSceneMap = {
  characterRosterPreset: "user-only",
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  objects: [
    createObject(
      "door-close",
      { type: "settings-scene-close" },
      createRect(173, 194, 221, 626),
      createFrame("left-angled", -1.5, 10, 33, 0.34),
      createLabel({
        textKey: "common.close",
        centerXPx: 284,
        topPx: 154,
        widthPx: 220,
        heightPx: 40,
        fontSizePx: 22,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "panel-theme",
      { type: "settings", panel: "theme" },
      createRect(1190, 216, 202, 184),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "settingsHub.nav.theme",
        centerXPx: 1291,
        topPx: 176,
        widthPx: 220,
        heightPx: 40,
        fontSizePx: 18,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "panel-accounts",
      { type: "settings", panel: "accounts" },
      createRect(576, 302, 240, 194),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "settingsHub.nav.accounts",
        centerXPx: 696,
        topPx: 262,
        widthPx: 220,
        heightPx: 40,
        fontSizePx: 18,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "panel-backup",
      { type: "settings", panel: "backup" },
      createRect(1402, 486, 192, 216),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "settingsHub.nav.backup",
        centerXPx: 1498,
        topPx: 446,
        widthPx: 220,
        heightPx: 40,
        fontSizePx: 18,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "panel-rooms",
      { type: "settings", panel: "rooms" },
      createRect(384, 529, 250, 227),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "settingsHub.nav.rooms",
        centerXPx: 509,
        topPx: 489,
        widthPx: 220,
        heightPx: 40,
        fontSizePx: 18,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "panel-live-log",
      { type: "settings", panel: "live-log" },
      createRect(1037, 605, 269, 194),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "settingsHub.nav.liveLog",
        centerXPx: 1172,
        topPx: 565,
        widthPx: 240,
        heightPx: 40,
        fontSizePx: 18,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "back-panel",
      { type: "back", target: "room" },
      createEdgeBackRect(116),
      createFrame("flat", 0, 0, 33, 0.34),
      createEdgeBackLabel(),
      {
        viewId: "panel",
      }
    ),
  ],
  characters: [createCharacter("anchor-user", "user", 937, 113, 0.92, 4)],
};

export const DEFAULT_ROOMS_SCENE_MAP: EntranceSceneMap = {
  characterRosterPreset: "user-only",
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  objects: [
    createObject(
      "door-entrance",
      { type: "navigate", page: "entrance" },
      createRect(848, 202, 228, 270),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "sideNav.entranceLabel",
        centerXPx: 962,
        topPx: 154,
        widthPx: 284,
        heightPx: 42,
        fontSizePx: 22,
        letterSpacingPx: 1,
      })
    ),
  ],
  characters: [],
};

export const DEFAULT_SERVER_SCENE_MAP: EntranceSceneMap = {
  characterRosterPreset: "connected-plus-user",
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  objects: [
    createObject(
      "door-entrance",
      { type: "navigate", page: "entrance" },
      createRect(77, 194, 307, 605),
      createFrame("left-angled", -1.5, 10, 33, 0.34),
      createLabel({
        textKey: "sideNav.entranceLabel",
        customText: "Entrance",
        centerXPx: 228,
        topPx: 156,
        widthPx: 220,
        heightPx: 40,
        fontSizePx: 22,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "screen-primary",
      { type: "screen", screen: "primary" },
      createRect(864, 324, 346, 259),
      createFrame("flat", 0, 0, 33, 0.34),
      createLabel({
        textKey: "",
        customText: "Open terminal",
        centerXPx: 1037,
        topPx: 588,
        widthPx: 240,
        heightPx: 40,
        fontSizePx: 22,
        letterSpacingPx: 1,
      })
    ),
    createObject(
      "back-primary",
      { type: "back", target: "room" },
      createEdgeBackRect(116),
      createFrame("flat", 0, 0, 33, 0.34),
      createEdgeBackLabel(),
      {
        viewId: "primary",
      }
    ),
  ],
  characters: [
    createCharacter("anchor-ai1-primary", "ai", 672, 124, 0.86, 3, "ai1"),
    createCharacter("anchor-ai2-primary", "ai", 1210, 113, 0.84, 5, "ai2"),
  ],
};

export function getSceneObjectNodesForView(
  sceneMap: EntranceSceneMap,
  viewId: string | null = null
): SceneObjectConfig[] {
  return sceneMap.objects.filter((object) => object.viewId === viewId);
}

export function getSceneBackObjectForView(
  sceneMap: EntranceSceneMap,
  viewId: string
): SceneObjectConfig | null {
  return (
    sceneMap.objects.find(
      (object) => object.viewId === viewId && (object.role === "back" || object.action.type === "back")
    ) ?? null
  );
}

export function hasSceneNodeLabel(node: SceneObjectConfig): boolean {
  if (!node.label.visible) {
    return false;
  }

  return node.label.textKey !== "" || (node.label.customText?.trim() ?? "") !== "";
}

function getSceneDebugNodeLabel(node: SceneObjectConfig | EntranceSceneCharacterConfig): string {
  if (node.kind === "character") {
    return node.id;
  }

  const customLabel = node.label.customText?.trim() ?? "";
  if (customLabel !== "") {
    return customLabel;
  }

  if (node.label.textKey !== "") {
    return node.label.textKey;
  }

  return node.id;
}

export function resolveSceneNodeLabelText(
  node: SceneObjectConfig,
  translate: (key: string) => string
): string {
  const customLabel = node.label.customText?.trim() ?? "";
  if (customLabel !== "") {
    return customLabel;
  }

  if (node.label.textKey !== "") {
    return translate(node.label.textKey);
  }

  return node.id;
}

export function buildSceneNodesFromMap(sceneMap: EntranceSceneMap): SceneNodeDefinition[] {
  return [...sceneMap.objects, ...sceneMap.characters];
}

export function listSceneDebugNodes(sceneMap: EntranceSceneMap): SceneDebugNodeListEntry[] {
  return buildSceneNodesFromMap(sceneMap).map((node) => ({
    kind: node.kind,
    id: node.id,
    label: getSceneDebugNodeLabel(node as SceneObjectConfig | EntranceSceneCharacterConfig),
    ...("viewId" in node ? { viewId: node.viewId } : {}),
  }));
}

export function resolveSceneObjectForSelection(
  sceneMap: EntranceSceneMap,
  selection: SceneDebugNodeSelection
): SceneObjectConfig | null {
  if (selection?.kind !== "object") {
    return null;
  }

  return sceneMap.objects.find((object) => object.id === selection.id) ?? null;
}

export function resolveSceneCharacterForSelection(
  sceneMap: EntranceSceneMap,
  selection: SceneDebugNodeSelection
): EntranceSceneCharacterConfig | null {
  if (selection?.kind !== "character") {
    return null;
  }

  return sceneMap.characters.find((character) => character.id === selection.id) ?? null;
}

export function isSceneDebugSelectionForObject(
  selection: SceneDebugNodeSelection,
  object: SceneObjectConfig
): boolean {
  return selection?.kind === "object" && selection.id === object.id;
}

export function isSceneDebugSelectionForCharacter(
  selection: SceneDebugNodeSelection,
  character: Pick<EntranceSceneCharacterConfig, "id">
): boolean {
  return selection?.kind === "character" && selection.id === character.id;
}

export function buildSceneRoomDefinition(
  roomId: SceneRoomId,
  sceneMap: EntranceSceneMap
): SceneRoomDefinition {
  return {
    id: roomId,
    page: roomId,
    referenceSize: {
      width: sceneMap.referenceSize.width,
      height: sceneMap.referenceSize.height,
    },
    nodes: buildSceneNodesFromMap(sceneMap),
  };
}
