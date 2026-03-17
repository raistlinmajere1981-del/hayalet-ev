import type { SceneCharacterKind } from "./scene-character-role.js";
import type { SceneCharacterSlot } from "./scene-character-state.js";

export const ENTRANCE_SCENE_LABEL_FONT_PRESETS = [
  "display",
  "inscription",
  "classic",
  "sans",
  "rounded",
  "condensed",
  "mono",
] as const;

export type EntranceSceneLabelFontPreset = (typeof ENTRANCE_SCENE_LABEL_FONT_PRESETS)[number];

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

const STORAGE_KEY = "entrance-scene-map-draft-v1";

export const DEFAULT_ENTRANCE_SCENE_MAP: EntranceSceneMap = {
  referenceSize: {
    width: 1920,
    height: 1080,
  },
  hotspots: [
    {
      id: "door-analyze",
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
      id: "door-archives",
      labelKey: "sideNav.archivesLabel",
      leftPx: 476,
      topPx: 483,
      widthPx: 167,
      heightPx: 273,
      labelCenterXPx: 555,
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

      action: { type: "navigate", page: "archives" },
    },
    {
      id: "door-whisper",
      labelKey: "sideNav.whisperLabel",
      leftPx: 480,
      topPx: 162,
      widthPx: 146,
      heightPx: 227,
      labelCenterXPx: 561,
      labelTopPx: 108,
      labelWidthPx: 303,
      labelHeightPx: 45,
      labelRotateDeg: 0,
      labelFontSizePx: 24,
      labelLetterSpacingPx: 1,
      labelFontPreset: "display",
      frameVariant: "upper",
      frameRotateDeg: -0.8,
      framePerspectiveDeg: 0,
      frameHoverGlowHueDeg: 33,
      frameHoverGlowAlpha: 0.34,

      labelFramePerspectiveDeg: 0,
      action: { type: "navigate", page: "whisper" },
    },
    {
      id: "door-assistant",
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
      action: { type: "settings", panel: "theme" },
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

export function normalizeEntranceSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  const defaultMap = DEFAULT_ENTRANCE_SCENE_MAP;
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

export function serializeEntranceSceneMap(sceneMap: EntranceSceneMap): string {
  return JSON.stringify(sceneMap, null, 2);
}

export function loadEntranceSceneMapDraft(): EntranceSceneMap | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw.trim() === "") {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<EntranceSceneMap>;
    if (
      parsed.referenceSize === undefined ||
      !Array.isArray(parsed.hotspots) ||
      !Array.isArray(parsed.characterAnchors)
    ) {
      return null;
    }
    return normalizeEntranceSceneMap(parsed);
  } catch {
    return null;
  }
}

export function saveEntranceSceneMapDraft(sceneMap: EntranceSceneMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeEntranceSceneMap(sceneMap));
  } catch {
    // Ignore draft persistence failures in constrained environments.
  }
}

export function clearEntranceSceneMapDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore draft persistence failures in constrained environments.
  }
}
