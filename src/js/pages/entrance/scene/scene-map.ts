import type { SceneCharacterKind } from "./scene-character-role.js";
import type { SceneCharacterSlot } from "./scene-character-state.js";
import type {
  SceneCharacterNodeDefinition,
  SceneDoorNodeDefinition,
  SceneLabelNodeDefinition,
  SceneNavigateAction,
  SceneNodeAction,
  SceneNodeDefinition,
  SceneNodeKind,
  SceneObjectNodeDefinition,
  SceneRoomDefinition,
  SceneRoomId,
  SceneScreenAction,
  SceneSettingsAction,
  SceneSettingsSceneCloseAction,
  SceneWhisperAction,
} from "../../../scene/schema.js";
import { SCENE_LABEL_FONT_PRESETS } from "../../../scene/schema.js";

export const ENTRANCE_SCENE_LABEL_FONT_PRESETS = SCENE_LABEL_FONT_PRESETS;

export type EntranceSceneLabelFontPreset = (typeof ENTRANCE_SCENE_LABEL_FONT_PRESETS)[number];
export type EntranceSceneHotspotActionNavigate = SceneNavigateAction;
export type EntranceSceneHotspotActionSettings = SceneSettingsAction;
export type EntranceSceneHotspotActionSettingsSceneClose = SceneSettingsSceneCloseAction;
export type EntranceSceneHotspotActionScreen = SceneScreenAction;
export type EntranceSceneHotspotActionWhisper = SceneWhisperAction;
export type EntranceSceneHotspotAction = SceneNodeAction;
export type SceneHotspotNodeKind =
  | SceneDoorNodeDefinition["kind"]
  | SceneObjectNodeDefinition["kind"];

export interface EntranceSceneHotspotConfig {
  id: string;
  nodeKind: SceneHotspotNodeKind;
  showLabel: boolean;
  labelKey: string;
  labelCustomText?: string;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  labelCenterXPx: number;
  labelTopPx: number;
  labelWidthPx: number;
  labelHeightPx: number;
  labelRotateDeg: number;
  labelFontSizePx: number;
  labelLetterSpacingPx: number;
  labelFontPreset: EntranceSceneLabelFontPreset;
  frameVariant: "flat" | "upper" | "left-angled" | "right-angled";
  frameRotateDeg: number;
  framePerspectiveDeg: number;
  frameHoverGlowHueDeg: number;
  frameHoverGlowAlpha: number;

  labelFramePerspectiveDeg: number;
  action: EntranceSceneHotspotAction;
}

export interface EntranceSceneCharacterAnchorConfig {
  id: string;
  kind: SceneCharacterKind;
  preferredSlot?: SceneCharacterSlot;
  leftPx: number;
  bottomPx: number;
  scale: number;
  depth: number;
}

export interface EntranceSceneMap {
  referenceSize: {
    width: number;
    height: number;
  };
  hotspots: EntranceSceneHotspotConfig[];
  characterAnchors: EntranceSceneCharacterAnchorConfig[];
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
  targetHotspotId?: string;
}

export const DEFAULT_ENTRANCE_SCENE_MAP: EntranceSceneMap = {
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  hotspots: [
    {
      id: "door-analyze",
      nodeKind: "door",
      showLabel: true,
      labelKey: "sideNav.analyzeLabel",
      leftPx: 171,
      topPx: 480,
      widthPx: 169,
      heightPx: 279,
      labelCenterXPx: 223,
      labelTopPx: 476,
      labelWidthPx: 323,
      labelHeightPx: 46,
      labelRotateDeg: 13,
      labelFontSizePx: 24,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "left-angled",
      frameRotateDeg: -2.5,
      framePerspectiveDeg: 14,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,

      labelFramePerspectiveDeg: 0,
      action: { type: "navigate", page: "analyze" },
    },
    {
      id: "door-assistant",
      nodeKind: "door",
      showLabel: true,
      labelKey: "sideNav.assistantLabel",
      leftPx: 1296,
      topPx: 162,
      widthPx: 146,
      heightPx: 227,
      labelCenterXPx: 1382,
      labelTopPx: 108,
      labelWidthPx: 307,
      labelHeightPx: 45,
      labelRotateDeg: 0,
      labelFontSizePx: 24,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "upper",
      frameRotateDeg: 0.8,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,

      action: { type: "navigate", page: "assistant" },
    },
    {
      id: "door-server",
      nodeKind: "door",
      showLabel: true,
      labelKey: "sideNav.serverLabel",
      leftPx: 1302,
      topPx: 570,
      widthPx: 144,
      heightPx: 238,
      labelCenterXPx: 1367,
      labelTopPx: 509,
      labelWidthPx: 307,
      labelHeightPx: 44,
      labelRotateDeg: 0,
      labelFontSizePx: 24,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,

      labelFramePerspectiveDeg: 0,
      action: { type: "navigate", page: "server" },
    },
    {
      id: "door-settings",
      nodeKind: "door",
      showLabel: true,
      labelKey: "settingsHub.openButton",
      leftPx: 1613,
      topPx: 518,
      widthPx: 169,
      heightPx: 279,
      labelCenterXPx: 1695,
      labelTopPx: 476,
      labelWidthPx: 323,
      labelHeightPx: 46,
      labelRotateDeg: -14,
      labelFontSizePx: 24,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "right-angled",
      frameRotateDeg: 2.5,
      framePerspectiveDeg: -14,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,

      labelFramePerspectiveDeg: 0,
      action: { type: "settings", panel: null },
    },
  ],
  characterAnchors: [
    {
      id: "anchor-user",
      kind: "user",
      leftPx: 154,
      bottomPx: 108,
      scale: 0.9,
      depth: 1,
    },
    {
      id: "anchor-ai-left-outer",
      kind: "ai",
      leftPx: 422,
      bottomPx: 162,
      scale: 0.82,
      depth: 2,
    },
    {
      id: "anchor-ai1-primary",
      kind: "ai",
      preferredSlot: "ai1",
      leftPx: 653,
      bottomPx: 151,
      scale: 0.84,
      depth: 3,
    },
    {
      id: "anchor-assistant",
      kind: "assistant",
      preferredSlot: "ai0",
      leftPx: 1152,
      bottomPx: 140,
      scale: 0.66,
      depth: 4,
    },
    {
      id: "anchor-us1",
      kind: "us1",
      preferredSlot: "us1",
      leftPx: 1363,
      bottomPx: 108,
      scale: 0.82,
      depth: 5,
    },
    {
      id: "anchor-ai2-primary",
      kind: "ai",
      preferredSlot: "ai2",
      leftPx: 1594,
      bottomPx: 151,
      scale: 0.84,
      depth: 6,
    },
    {
      id: "anchor-ai-right-outer",
      kind: "ai",
      leftPx: 1766,
      bottomPx: 162,
      scale: 0.82,
      depth: 7,
    },
  ],
};

export const DEFAULT_ASSISTANT_SCENE_MAP: EntranceSceneMap = {
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  hotspots: [
    {
      id: "door-entrance",
      nodeKind: "object",
      showLabel: false,
      labelKey: "sideNav.entranceLabel",
      labelCustomText: "Entrance",
      leftPx: 134,
      topPx: 238,
      widthPx: 250,
      heightPx: 518,
      labelCenterXPx: 259,
      labelTopPx: 712,
      labelWidthPx: 260,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 22,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "left-angled",
      frameRotateDeg: -1.5,
      framePerspectiveDeg: 10,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "navigate", page: "entrance" },
    },
    {
      id: "screen-primary",
      nodeKind: "object",
      showLabel: false,
      labelKey: "",
      labelCustomText: "Open screen",
      leftPx: 845,
      topPx: 346,
      widthPx: 346,
      heightPx: 194,
      labelCenterXPx: 1018,
      labelTopPx: 500,
      labelWidthPx: 260,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 22,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "screen", screen: "primary" },
    },
  ],
  characterAnchors: [
    {
      id: "anchor-ai0",
      kind: "assistant",
      preferredSlot: "ai0",
      leftPx: 691,
      bottomPx: 108,
      scale: 0.66,
      depth: 4,
    },
  ],
};

export const DEFAULT_ANALYZE_SCENE_MAP: EntranceSceneMap = {
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  hotspots: [
    {
      id: "door-entrance",
      nodeKind: "object",
      showLabel: false,
      labelKey: "",
      labelCustomText: "Entrance",
      leftPx: 132,
      topPx: 178,
      widthPx: 252,
      heightPx: 616,
      labelCenterXPx: 258,
      labelTopPx: 144,
      labelWidthPx: 244,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 22,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "left-angled",
      frameRotateDeg: -1.5,
      framePerspectiveDeg: 10,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "navigate", page: "entrance" },
    },
    {
      id: "screen-primary",
      nodeKind: "object",
      showLabel: false,
      labelKey: "",
      labelCustomText: "Analyze",
      leftPx: 760,
      topPx: 392,
      widthPx: 400,
      heightPx: 224,
      labelCenterXPx: 960,
      labelTopPx: 634,
      labelWidthPx: 260,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 22,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "screen", screen: "primary" },
    },
    {
      id: "screen-archive",
      nodeKind: "object",
      showLabel: false,
      labelKey: "",
      labelCustomText: "Archive",
      leftPx: 1234,
      topPx: 246,
      widthPx: 284,
      heightPx: 306,
      labelCenterXPx: 1376,
      labelTopPx: 208,
      labelWidthPx: 240,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 22,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "screen", screen: "archive" },
    },
  ],
  characterAnchors: [
    {
      id: "anchor-user",
      kind: "user",
      leftPx: 482,
      bottomPx: 102,
      scale: 0.88,
      depth: 2,
    },
    {
      id: "anchor-ai1-primary",
      kind: "ai",
      preferredSlot: "ai1",
      leftPx: 768,
      bottomPx: 130,
      scale: 0.8,
      depth: 3,
    },
    {
      id: "anchor-us1",
      kind: "us1",
      preferredSlot: "us1",
      leftPx: 1046,
      bottomPx: 112,
      scale: 0.8,
      depth: 4,
    },
    {
      id: "anchor-ai2-primary",
      kind: "ai",
      preferredSlot: "ai2",
      leftPx: 1326,
      bottomPx: 128,
      scale: 0.82,
      depth: 5,
    },
  ],
};

export const DEFAULT_SETTINGS_SCENE_MAP: EntranceSceneMap = {
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  hotspots: [
    {
      id: "door-close",
      nodeKind: "object",
      showLabel: false,
      labelKey: "common.close",
      leftPx: 173,
      topPx: 194,
      widthPx: 221,
      heightPx: 626,
      labelCenterXPx: 284,
      labelTopPx: 154,
      labelWidthPx: 220,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 22,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "left-angled",
      frameRotateDeg: -1.5,
      framePerspectiveDeg: 10,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "settings-scene-close" },
    },
    {
      id: "panel-theme",
      nodeKind: "object",
      showLabel: false,
      labelKey: "settingsHub.nav.theme",
      leftPx: 1190,
      topPx: 216,
      widthPx: 202,
      heightPx: 184,
      labelCenterXPx: 1291,
      labelTopPx: 176,
      labelWidthPx: 220,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 18,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "settings", panel: "theme" },
    },
    {
      id: "panel-accounts",
      nodeKind: "object",
      showLabel: false,
      labelKey: "settingsHub.nav.accounts",
      leftPx: 576,
      topPx: 302,
      widthPx: 240,
      heightPx: 194,
      labelCenterXPx: 696,
      labelTopPx: 262,
      labelWidthPx: 220,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 18,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "settings", panel: "accounts" },
    },
    {
      id: "panel-backup",
      nodeKind: "object",
      showLabel: false,
      labelKey: "settingsHub.nav.backup",
      leftPx: 1402,
      topPx: 486,
      widthPx: 192,
      heightPx: 216,
      labelCenterXPx: 1498,
      labelTopPx: 446,
      labelWidthPx: 220,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 18,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "settings", panel: "backup" },
    },
    {
      id: "panel-rooms",
      nodeKind: "object",
      showLabel: false,
      labelKey: "settingsHub.nav.rooms",
      leftPx: 384,
      topPx: 529,
      widthPx: 250,
      heightPx: 227,
      labelCenterXPx: 509,
      labelTopPx: 489,
      labelWidthPx: 220,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 18,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "settings", panel: "rooms" },
    },
    {
      id: "panel-live-log",
      nodeKind: "object",
      showLabel: false,
      labelKey: "settingsHub.nav.liveLog",
      leftPx: 1037,
      topPx: 605,
      widthPx: 269,
      heightPx: 194,
      labelCenterXPx: 1172,
      labelTopPx: 565,
      labelWidthPx: 240,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 18,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "settings", panel: "live-log" },
    },
  ],
  characterAnchors: [
    {
      id: "anchor-user",
      kind: "user",
      leftPx: 937,
      bottomPx: 113,
      scale: 0.92,
      depth: 4,
    },
  ],
};

export const DEFAULT_SERVER_SCENE_MAP: EntranceSceneMap = {
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  hotspots: [
    {
      id: "door-entrance",
      nodeKind: "object",
      showLabel: false,
      labelKey: "sideNav.entranceLabel",
      labelCustomText: "Entrance",
      leftPx: 77,
      topPx: 194,
      widthPx: 307,
      heightPx: 605,
      labelCenterXPx: 228,
      labelTopPx: 156,
      labelWidthPx: 220,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 22,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "left-angled",
      frameRotateDeg: -1.5,
      framePerspectiveDeg: 10,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "navigate", page: "entrance" },
    },
    {
      id: "screen-primary",
      nodeKind: "object",
      showLabel: false,
      labelKey: "",
      labelCustomText: "Open terminal",
      leftPx: 864,
      topPx: 324,
      widthPx: 346,
      heightPx: 259,
      labelCenterXPx: 1037,
      labelTopPx: 588,
      labelWidthPx: 240,
      labelHeightPx: 40,
      labelRotateDeg: 0,
      labelFontSizePx: 22,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "flat",
      frameRotateDeg: 0,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,
      labelFramePerspectiveDeg: 0,
      action: { type: "screen", screen: "primary" },
    },
  ],
  characterAnchors: [
    {
      id: "anchor-ai1-primary",
      kind: "ai",
      preferredSlot: "ai1",
      leftPx: 672,
      bottomPx: 124,
      scale: 0.86,
      depth: 3,
    },
    {
      id: "anchor-ai2-primary",
      kind: "ai",
      preferredSlot: "ai2",
      leftPx: 1210,
      bottomPx: 113,
      scale: 0.84,
      depth: 5,
    },
  ],
};

export function getSceneNodeKindForHotspot(
  hotspot: EntranceSceneHotspotConfig
): SceneDoorNodeDefinition["kind"] | SceneObjectNodeDefinition["kind"] {
  return hotspot.nodeKind;
}

export function getSceneHotspotLabelId(hotspotId: string): string {
  return `${hotspotId}-label`;
}

export function hasSceneHotspotLabel(hotspot: EntranceSceneHotspotConfig): boolean {
  return (
    hotspot.showLabel && (hotspot.labelKey !== "" || (hotspot.labelCustomText?.trim() ?? "") !== "")
  );
}

function getSceneDebugNodeLabel(hotspot: EntranceSceneHotspotConfig): string {
  const customLabel = hotspot.labelCustomText?.trim() ?? "";
  if (customLabel !== "") {
    return customLabel;
  }

  if (hotspot.labelKey !== "") {
    return hotspot.labelKey;
  }

  return hotspot.id;
}

function toSceneHotspotNode(
  hotspot: EntranceSceneHotspotConfig
): SceneDoorNodeDefinition | SceneObjectNodeDefinition {
  const node = {
    id: hotspot.id,
    kind: getSceneNodeKindForHotspot(hotspot),
    action: hotspot.action,
    rect: {
      leftPx: hotspot.leftPx,
      topPx: hotspot.topPx,
      widthPx: hotspot.widthPx,
      heightPx: hotspot.heightPx,
    },
    frame: {
      variant: hotspot.frameVariant,
      rotateDeg: hotspot.frameRotateDeg,
      perspectiveDeg: hotspot.framePerspectiveDeg,
      hoverGlowHueDeg: hotspot.frameHoverGlowHueDeg,
      hoverGlowAlpha: hotspot.frameHoverGlowAlpha,
    },
    labelId: hasSceneHotspotLabel(hotspot) ? getSceneHotspotLabelId(hotspot.id) : null,
  };

  return node.kind === "door"
    ? (node as SceneDoorNodeDefinition)
    : (node as SceneObjectNodeDefinition);
}

function toSceneLabelNode(hotspot: EntranceSceneHotspotConfig): SceneLabelNodeDefinition | null {
  if (!hasSceneHotspotLabel(hotspot)) {
    return null;
  }

  return {
    id: getSceneHotspotLabelId(hotspot.id),
    kind: "label",
    targetNodeId: hotspot.id,
    textKey: hotspot.labelKey,
    ...(hotspot.labelCustomText !== undefined ? { customText: hotspot.labelCustomText } : {}),
    centerXPx: hotspot.labelCenterXPx,
    topPx: hotspot.labelTopPx,
    widthPx: hotspot.labelWidthPx,
    heightPx: hotspot.labelHeightPx,
    rotateDeg: hotspot.labelRotateDeg,
    fontSizePx: hotspot.labelFontSizePx,
    letterSpacingPx: hotspot.labelLetterSpacingPx,
    fontPreset: hotspot.labelFontPreset,
    framePerspectiveDeg: hotspot.labelFramePerspectiveDeg,
  };
}

function toSceneCharacterNode(
  anchor: EntranceSceneCharacterAnchorConfig
): SceneCharacterNodeDefinition {
  return {
    id: anchor.id,
    kind: "character",
    characterKind: anchor.kind,
    ...(anchor.preferredSlot !== undefined ? { preferredSlot: anchor.preferredSlot } : {}),
    leftPx: anchor.leftPx,
    bottomPx: anchor.bottomPx,
    scale: anchor.scale,
    depth: anchor.depth,
  };
}

export function buildSceneNodesFromMap(sceneMap: EntranceSceneMap): SceneNodeDefinition[] {
  const nodes: SceneNodeDefinition[] = [];

  sceneMap.hotspots.forEach((hotspot) => {
    nodes.push(toSceneHotspotNode(hotspot));
    const labelNode = toSceneLabelNode(hotspot);
    if (labelNode !== null) {
      nodes.push(labelNode);
    }
  });

  sceneMap.characterAnchors.forEach((anchor) => {
    nodes.push(toSceneCharacterNode(anchor));
  });

  return nodes;
}

export function listSceneDebugNodes(sceneMap: EntranceSceneMap): SceneDebugNodeListEntry[] {
  const nodes: SceneDebugNodeListEntry[] = [];

  sceneMap.hotspots.forEach((hotspot) => {
    nodes.push({
      kind: getSceneNodeKindForHotspot(hotspot),
      id: hotspot.id,
      label: hotspot.id,
    });

    if (hasSceneHotspotLabel(hotspot)) {
      nodes.push({
        kind: "label",
        id: getSceneHotspotLabelId(hotspot.id),
        label: `${getSceneHotspotLabelId(hotspot.id)} · ${getSceneDebugNodeLabel(hotspot)}`,
        targetHotspotId: hotspot.id,
      });
    }
  });

  sceneMap.characterAnchors.forEach((anchor) => {
    nodes.push({
      kind: "character",
      id: anchor.id,
      label: anchor.id,
    });
  });

  return nodes;
}

export function resolveSceneHotspotForSelection(
  sceneMap: EntranceSceneMap,
  selection: SceneDebugNodeSelection
): EntranceSceneHotspotConfig | null {
  if (selection === null || selection.kind === "character") {
    return null;
  }

  if (selection.kind === "label") {
    return (
      sceneMap.hotspots.find((hotspot) => getSceneHotspotLabelId(hotspot.id) === selection.id) ??
      null
    );
  }

  return (
    sceneMap.hotspots.find(
      (hotspot) =>
        hotspot.id === selection.id && getSceneNodeKindForHotspot(hotspot) === selection.kind
    ) ?? null
  );
}

export function resolveSceneCharacterForSelection(
  sceneMap: EntranceSceneMap,
  selection: SceneDebugNodeSelection
): EntranceSceneCharacterAnchorConfig | null {
  if (selection?.kind !== "character") {
    return null;
  }

  return sceneMap.characterAnchors.find((anchor) => anchor.id === selection.id) ?? null;
}

export function isSceneDebugSelectionForHotspot(
  selection: SceneDebugNodeSelection,
  hotspot: EntranceSceneHotspotConfig
): boolean {
  if (selection === null) {
    return false;
  }

  if (selection.kind === "label") {
    return selection.id === getSceneHotspotLabelId(hotspot.id);
  }

  if (selection.kind === "character") {
    return false;
  }

  return selection.id === hotspot.id && selection.kind === getSceneNodeKindForHotspot(hotspot);
}

export function isSceneDebugSelectionForCharacter(
  selection: SceneDebugNodeSelection,
  anchor: { id: string }
): boolean {
  return selection?.kind === "character" && selection.id === anchor.id;
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

export function cloneEntranceSceneMap(
  source: EntranceSceneMap = DEFAULT_ENTRANCE_SCENE_MAP
): EntranceSceneMap {
  return {
    referenceSize: { ...source.referenceSize },
    hotspots: source.hotspots.map((hotspot) => ({
      ...hotspot,
      action: { ...hotspot.action },
    })),
    characterAnchors: source.characterAnchors.map((anchor) => ({ ...anchor })),
  };
}

function normalizeHotspot(
  partial: Partial<EntranceSceneHotspotConfig>,
  fallback: EntranceSceneHotspotConfig
): EntranceSceneHotspotConfig {
  return {
    ...fallback,
    ...partial,
    action: {
      ...fallback.action,
      ...(partial.action ?? {}),
    } as EntranceSceneHotspotAction,
  };
}

function normalizeCharacterAnchor(
  partial: Partial<EntranceSceneCharacterAnchorConfig>,
  fallback: EntranceSceneCharacterAnchorConfig
): EntranceSceneCharacterAnchorConfig {
  return {
    ...fallback,
    ...partial,
  };
}

function normalizeSceneMap(
  source: Partial<EntranceSceneMap>,
  defaultMap: EntranceSceneMap
): EntranceSceneMap {
  const hotspotById = new Map<string, Partial<EntranceSceneHotspotConfig>>(
    (Array.isArray(source.hotspots)
      ? (source.hotspots as Array<Partial<EntranceSceneHotspotConfig>>)
      : []
    )
      .filter((item) => typeof item.id === "string")
      .map((item) => [item.id as string, item])
  );
  const anchorById = new Map<string, Partial<EntranceSceneCharacterAnchorConfig>>(
    (Array.isArray(source.characterAnchors)
      ? (source.characterAnchors as Array<Partial<EntranceSceneCharacterAnchorConfig>>)
      : []
    )
      .filter((item) => typeof item.id === "string")
      .map((item) => [item.id as string, item])
  );

  return {
    referenceSize: {
      width: source.referenceSize?.width ?? defaultMap.referenceSize.width,
      height: source.referenceSize?.height ?? defaultMap.referenceSize.height,
    },
    hotspots: defaultMap.hotspots.map((fallback) =>
      normalizeHotspot(hotspotById.get(fallback.id) ?? {}, fallback)
    ),
    characterAnchors: defaultMap.characterAnchors.map((fallback) =>
      normalizeCharacterAnchor(anchorById.get(fallback.id) ?? {}, fallback)
    ),
  };
}

export function normalizeEntranceSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  return normalizeSceneMap(source, DEFAULT_ENTRANCE_SCENE_MAP);
}

export function normalizeAssistantSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  const normalized = normalizeSceneMap(source, DEFAULT_ASSISTANT_SCENE_MAP);
  normalized.characterAnchors = normalized.characterAnchors.map((anchor) => {
    if (
      anchor.id === "anchor-ai0" &&
      anchor.leftPx === 691 &&
      anchor.bottomPx === 108 &&
      anchor.depth === 4 &&
      anchor.scale === 1
    ) {
      return {
        ...anchor,
        scale: DEFAULT_ASSISTANT_SCENE_MAP.characterAnchors[0]?.scale ?? 0.66,
      };
    }

    return anchor;
  });
  return normalized;
}

export function normalizeAnalyzeSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  return normalizeSceneMap(source, DEFAULT_ANALYZE_SCENE_MAP);
}

export function normalizeSettingsSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  return normalizeSceneMap(source, DEFAULT_SETTINGS_SCENE_MAP);
}

export function normalizeServerSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  return normalizeSceneMap(source, DEFAULT_SERVER_SCENE_MAP);
}

export function serializeEntranceSceneMap(sceneMap: EntranceSceneMap): string {
  return JSON.stringify(sceneMap, null, 2);
}
