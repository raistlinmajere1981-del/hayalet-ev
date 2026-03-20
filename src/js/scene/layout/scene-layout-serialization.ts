import type {
  EntranceSceneBackAction,
  EntranceSceneBackConfig,
  EntranceSceneCharacterConfig,
  EntranceSceneInteractiveAction,
  EntranceSceneInteractiveConfig,
  EntranceSceneMap,
} from "./scene-layout-state.js";
import {
  DEFAULT_ANALYZE_SCENE_MAP,
  DEFAULT_ASSISTANT_SCENE_MAP,
  DEFAULT_ENTRANCE_SCENE_MAP,
  DEFAULT_ROOMS_SCENE_MAP,
  DEFAULT_SERVER_SCENE_MAP,
  DEFAULT_SETTINGS_SCENE_MAP,
} from "./scene-layout-state.js";
import type { SceneNodeFrameDefinition, SceneNodeLabelDefinition, SceneNodeRect } from "../schema.js";

export function cloneEntranceSceneMap(
  source: EntranceSceneMap = DEFAULT_ENTRANCE_SCENE_MAP
): EntranceSceneMap {
  return {
    characterRosterPreset: source.characterRosterPreset,
    referenceSize: { ...source.referenceSize },
    interactives: source.interactives.map((interactive) => ({
      ...interactive,
      action: { ...interactive.action },
      rect: { ...interactive.rect },
      frame: { ...interactive.frame },
      label: { ...interactive.label },
    })),
    backs: source.backs.map((back) => ({
      ...back,
      action: { ...back.action },
      rect: { ...back.rect },
      label: { ...back.label },
    })),
    characters: source.characters.map((character) => ({ ...character })),
  };
}

function normalizeLabel(
  partial: Partial<SceneNodeLabelDefinition>,
  fallback: SceneNodeLabelDefinition
): SceneNodeLabelDefinition {
  return {
    ...fallback,
    ...partial,
  };
}

function normalizeRect(partial: Partial<SceneNodeRect>, fallback: SceneNodeRect): SceneNodeRect {
  return {
    ...fallback,
    ...partial,
  };
}

function normalizeFrame(
  partial: Partial<SceneNodeFrameDefinition>,
  fallback: SceneNodeFrameDefinition
): SceneNodeFrameDefinition {
  return {
    ...fallback,
    ...partial,
  };
}

function normalizeInteractive(
  partial: Partial<EntranceSceneInteractiveConfig>,
  fallback: EntranceSceneInteractiveConfig
): EntranceSceneInteractiveConfig {
  return {
    ...fallback,
    ...partial,
    action: {
      ...fallback.action,
      ...(partial.action ?? {}),
    } as EntranceSceneInteractiveAction,
    rect: normalizeRect(partial.rect ?? {}, fallback.rect),
    frame: normalizeFrame(partial.frame ?? {}, fallback.frame),
    label: normalizeLabel(partial.label ?? {}, fallback.label),
  };
}

function normalizeBack(
  partial: Partial<EntranceSceneBackConfig>,
  fallback: EntranceSceneBackConfig
): EntranceSceneBackConfig {
  return {
    ...fallback,
    ...partial,
    action: {
      ...fallback.action,
      ...(partial.action ?? {}),
    } as EntranceSceneBackAction,
    rect: normalizeRect(partial.rect ?? {}, fallback.rect),
    label: normalizeLabel(partial.label ?? {}, fallback.label),
  };
}

function normalizeCharacter(
  partial: Partial<EntranceSceneCharacterConfig>,
  fallback: EntranceSceneCharacterConfig
): EntranceSceneCharacterConfig {
  return {
    ...fallback,
    ...partial,
  };
}

function normalizeSceneMap(
  source: Partial<EntranceSceneMap>,
  defaultMap: EntranceSceneMap
): EntranceSceneMap {
  const interactiveById = new Map<string, Partial<EntranceSceneInteractiveConfig>>(
    (Array.isArray(source.interactives)
      ? (source.interactives as Array<Partial<EntranceSceneInteractiveConfig>>)
      : []
    )
      .filter((item) => typeof item.id === "string")
      .map((item) => [item.id as string, item])
  );
  const backById = new Map<string, Partial<EntranceSceneBackConfig>>(
    (Array.isArray(source.backs) ? (source.backs as Array<Partial<EntranceSceneBackConfig>>) : [])
      .filter((item) => typeof item.id === "string")
      .map((item) => [item.id as string, item])
  );
  const characterById = new Map<string, Partial<EntranceSceneCharacterConfig>>(
    (Array.isArray(source.characters)
      ? (source.characters as Array<Partial<EntranceSceneCharacterConfig>>)
      : []
    )
      .filter((item) => typeof item.id === "string")
      .map((item) => [item.id as string, item])
  );

  return {
    characterRosterPreset: source.characterRosterPreset ?? defaultMap.characterRosterPreset,
    referenceSize: {
      width: source.referenceSize?.width ?? defaultMap.referenceSize.width,
      height: source.referenceSize?.height ?? defaultMap.referenceSize.height,
    },
    interactives: defaultMap.interactives.map((fallback) =>
      normalizeInteractive(interactiveById.get(fallback.id) ?? {}, fallback)
    ),
    backs: defaultMap.backs.map((fallback) => normalizeBack(backById.get(fallback.id) ?? {}, fallback)),
    characters: defaultMap.characters.map((fallback) =>
      normalizeCharacter(characterById.get(fallback.id) ?? {}, fallback)
    ),
  };
}

export function normalizeEntranceSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  return normalizeSceneMap(source, DEFAULT_ENTRANCE_SCENE_MAP);
}

export function normalizeAssistantSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  return normalizeSceneMap(source, DEFAULT_ASSISTANT_SCENE_MAP);
}

export function normalizeAnalyzeSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  return normalizeSceneMap(source, DEFAULT_ANALYZE_SCENE_MAP);
}

export function normalizeRoomsSceneMap(source: Partial<EntranceSceneMap>): EntranceSceneMap {
  return normalizeSceneMap(source, DEFAULT_ROOMS_SCENE_MAP);
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
