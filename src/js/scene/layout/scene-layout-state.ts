import analyzeSceneMap from "@theme-source/castle/maps/analyze.scene.json";
import assistantSceneMap from "@theme-source/castle/maps/assistant.scene.json";
import entranceSceneMap from "@theme-source/castle/maps/entrance.scene.json";
import roomsSceneMap from "@theme-source/castle/maps/rooms.scene.json";
import serverSceneMap from "@theme-source/castle/maps/server.scene.json";
import settingsSceneMap from "@theme-source/castle/maps/settings.scene.json";

import type {
  SceneBackNodeDefinition,
  SceneCharacterKind,
  SceneCharacterPlacementNodeDefinition,
  SceneCharacterSlot,
  SceneInteractiveNodeDefinition,
  SceneInteractiveAction,
  SceneLayoutDefinition,
  SceneNodeDefinition,
  SceneNodeKind,
  SceneRoomDefinition,
  SceneRoomId,
} from "../schema.js";
import { SCENE_LABEL_FONT_PRESETS } from "../schema.js";

export const SCENE_LAYOUT_LABEL_FONT_PRESETS = SCENE_LABEL_FONT_PRESETS;

export type SceneLayoutLabelFontPreset = (typeof SCENE_LAYOUT_LABEL_FONT_PRESETS)[number];
export type SceneInteractiveConfigAction = SceneInteractiveAction;

export type SceneInteractiveConfig = SceneInteractiveNodeDefinition;

export type SceneBackConfig = SceneBackNodeDefinition;

export interface SceneCharacterPlacementConfig extends SceneCharacterPlacementNodeDefinition {
  characterKind: SceneCharacterKind;
  preferredSlot?: SceneCharacterSlot;
}

export interface SceneLayoutConfig extends SceneLayoutDefinition {
  interactives: SceneInteractiveConfig[];
  backs: SceneBackConfig[];
  characters: SceneCharacterPlacementConfig[];
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

function asSceneLayoutConfig(source: unknown): SceneLayoutConfig {
  return source as SceneLayoutConfig;
}

export const DEFAULT_ENTRANCE_SCENE_LAYOUT = asSceneLayoutConfig(entranceSceneMap);
export const DEFAULT_ANALYZE_SCENE_LAYOUT = asSceneLayoutConfig(analyzeSceneMap);
export const DEFAULT_ASSISTANT_SCENE_LAYOUT = asSceneLayoutConfig(assistantSceneMap);
export const DEFAULT_SERVER_SCENE_LAYOUT = asSceneLayoutConfig(serverSceneMap);
export const DEFAULT_ROOMS_SCENE_LAYOUT = asSceneLayoutConfig(roomsSceneMap);
export const DEFAULT_SETTINGS_SCENE_LAYOUT = asSceneLayoutConfig(settingsSceneMap);

export const DEFAULT_SCENE_LAYOUTS: Record<SceneRoomId, SceneLayoutConfig> = {
  entrance: DEFAULT_ENTRANCE_SCENE_LAYOUT,
  analyze: DEFAULT_ANALYZE_SCENE_LAYOUT,
  assistant: DEFAULT_ASSISTANT_SCENE_LAYOUT,
  server: DEFAULT_SERVER_SCENE_LAYOUT,
  rooms: DEFAULT_ROOMS_SCENE_LAYOUT,
  settings: DEFAULT_SETTINGS_SCENE_LAYOUT,
};

export function getSceneInteractiveNodesForView(
  sceneLayout: SceneLayoutConfig,
  viewId: string | null = null
): SceneInteractiveConfig[] {
  return sceneLayout.interactives.filter((interactive) => interactive.viewId === viewId);
}

export function getSceneBackNodeForView(
  sceneLayout: SceneLayoutConfig,
  viewId: string
): SceneBackConfig | null {
  return sceneLayout.backs.find((back) => back.viewId === viewId) ?? null;
}

export function hasSceneNodeLabel(node: SceneInteractiveConfig | SceneBackConfig): boolean {
  if (!node.label.visible) {
    return false;
  }

  return node.label.textKey !== "" || (node.label.customText?.trim() ?? "") !== "";
}

function getSceneDebugNodeLabel(
  node: SceneInteractiveConfig | SceneBackConfig | SceneCharacterPlacementConfig
): string {
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
  node: SceneInteractiveConfig | SceneBackConfig,
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

export function buildSceneNodesFromLayout(sceneLayout: SceneLayoutConfig): SceneNodeDefinition[] {
  return [...sceneLayout.interactives, ...sceneLayout.backs, ...sceneLayout.characters];
}

export function listSceneDebugNodes(sceneLayout: SceneLayoutConfig): SceneDebugNodeListEntry[] {
  return buildSceneNodesFromLayout(sceneLayout).map((node) => ({
    kind: node.kind,
    id: node.id,
    label: getSceneDebugNodeLabel(
      node as SceneInteractiveConfig | SceneBackConfig | SceneCharacterPlacementConfig
    ),
    ...("viewId" in node ? { viewId: node.viewId } : {}),
  }));
}

export function resolveSceneInteractiveForSelection(
  sceneLayout: SceneLayoutConfig,
  selection: SceneDebugNodeSelection
): SceneInteractiveConfig | null {
  if (selection?.kind !== "interactive") {
    return null;
  }

  return sceneLayout.interactives.find((interactive) => interactive.id === selection.id) ?? null;
}

export function resolveSceneBackForSelection(
  sceneLayout: SceneLayoutConfig,
  selection: SceneDebugNodeSelection
): SceneBackConfig | null {
  if (selection?.kind !== "back") {
    return null;
  }

  return sceneLayout.backs.find((back) => back.id === selection.id) ?? null;
}

export function resolveSceneCharacterForSelection(
  sceneLayout: SceneLayoutConfig,
  selection: SceneDebugNodeSelection
): SceneCharacterPlacementConfig | null {
  if (selection?.kind !== "character") {
    return null;
  }

  return sceneLayout.characters.find((character) => character.id === selection.id) ?? null;
}

export function isSceneDebugSelectionForInteractive(
  selection: SceneDebugNodeSelection,
  interactive: SceneInteractiveConfig
): boolean {
  return selection?.kind === "interactive" && selection.id === interactive.id;
}

export function isSceneDebugSelectionForBack(
  selection: SceneDebugNodeSelection,
  back: SceneBackConfig
): boolean {
  return selection?.kind === "back" && selection.id === back.id;
}

export function isSceneDebugSelectionForCharacter(
  selection: SceneDebugNodeSelection,
  character: Pick<SceneCharacterPlacementConfig, "id">
): boolean {
  return selection?.kind === "character" && selection.id === character.id;
}

export function buildSceneRoomDefinition(
  roomId: SceneRoomId,
  sceneLayout: SceneLayoutConfig
): SceneRoomDefinition {
  return {
    id: roomId,
    page: roomId,
    referenceSize: {
      width: sceneLayout.referenceSize.width,
      height: sceneLayout.referenceSize.height,
    },
    nodes: buildSceneNodesFromLayout(sceneLayout),
  };
}
