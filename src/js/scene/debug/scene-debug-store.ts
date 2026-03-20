import { getSceneDebugDraftStorageKey } from "./scene-debug-theme.js";
import type { SceneDebugEditableRoomId } from "../schema.js";
import {
  cloneSceneLayout,
  DEFAULT_ANALYZE_SCENE_LAYOUT,
  DEFAULT_ASSISTANT_SCENE_LAYOUT,
  DEFAULT_ENTRANCE_SCENE_LAYOUT,
  DEFAULT_ROOMS_SCENE_LAYOUT,
  DEFAULT_SERVER_SCENE_LAYOUT,
  DEFAULT_SETTINGS_SCENE_LAYOUT,
  parseSceneLayoutDraft,
  serializeSceneLayout,
  type SceneLayoutConfig,
} from "../layout/index.js";

interface SceneDebugStoreConfig {
  defaultLayout: SceneLayoutConfig;
  storageKey: string;
}

export interface SceneDebugStore {
  roomId: SceneDebugEditableRoomId;
  cloneDefault(): SceneLayoutConfig;
  loadDraft(): SceneLayoutConfig | null;
  saveDraft(sceneLayout: SceneLayoutConfig): void;
  clearDraft(): void;
  serialize(sceneLayout: SceneLayoutConfig): string;
  copyToClipboard(sceneLayout: SceneLayoutConfig): Promise<void>;
}

const SCENE_DEBUG_STORE_CONFIG: Record<SceneDebugEditableRoomId, SceneDebugStoreConfig> = {
  entrance: {
    defaultLayout: DEFAULT_ENTRANCE_SCENE_LAYOUT,
    storageKey: getSceneDebugDraftStorageKey("entrance"),
  },
  analyze: {
    defaultLayout: DEFAULT_ANALYZE_SCENE_LAYOUT,
    storageKey: getSceneDebugDraftStorageKey("analyze"),
  },
  assistant: {
    defaultLayout: DEFAULT_ASSISTANT_SCENE_LAYOUT,
    storageKey: getSceneDebugDraftStorageKey("assistant"),
  },
  server: {
    defaultLayout: DEFAULT_SERVER_SCENE_LAYOUT,
    storageKey: getSceneDebugDraftStorageKey("server"),
  },
  rooms: {
    defaultLayout: DEFAULT_ROOMS_SCENE_LAYOUT,
    storageKey: getSceneDebugDraftStorageKey("rooms"),
  },
  settings: {
    defaultLayout: DEFAULT_SETTINGS_SCENE_LAYOUT,
    storageKey: getSceneDebugDraftStorageKey("settings"),
  },
};

function loadSceneDebugDraft(config: SceneDebugStoreConfig): SceneLayoutConfig | null {
  try {
    const raw = window.localStorage.getItem(config.storageKey);
    if (raw === null || raw.trim() === "") {
      return null;
    }

    return parseSceneLayoutDraft(raw);
  } catch {
    return null;
  }
}

function saveSceneDebugDraft(config: SceneDebugStoreConfig, sceneLayout: SceneLayoutConfig): void {
  try {
    window.localStorage.setItem(config.storageKey, serializeSceneLayout(sceneLayout));
  } catch {
    // Ignore draft persistence failures in constrained environments.
  }
}

function clearSceneDebugDraft(config: SceneDebugStoreConfig): void {
  try {
    window.localStorage.removeItem(config.storageKey);
  } catch {
    // Ignore draft persistence failures in constrained environments.
  }
}

export function createSceneDebugStore(roomId: SceneDebugEditableRoomId): SceneDebugStore {
  const config = SCENE_DEBUG_STORE_CONFIG[roomId];

  return {
    roomId,
    cloneDefault(): SceneLayoutConfig {
      return cloneSceneLayout(config.defaultLayout);
    },
    loadDraft(): SceneLayoutConfig | null {
      return loadSceneDebugDraft(config);
    },
    saveDraft(sceneLayout: SceneLayoutConfig): void {
      saveSceneDebugDraft(config, sceneLayout);
    },
    clearDraft(): void {
      clearSceneDebugDraft(config);
    },
    serialize(sceneLayout: SceneLayoutConfig): string {
      return serializeSceneLayout(sceneLayout);
    },
    async copyToClipboard(sceneLayout: SceneLayoutConfig): Promise<void> {
      await navigator.clipboard.writeText(serializeSceneLayout(sceneLayout));
    },
  };
}
