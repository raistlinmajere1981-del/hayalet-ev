import { getSceneDebugDraftStorageKey } from "./scene-debug-theme.js";
import type { SceneDebugEditableRoomId } from "../schema.js";
import {
  cloneEntranceSceneMap,
  DEFAULT_ANALYZE_SCENE_MAP,
  DEFAULT_ASSISTANT_SCENE_MAP,
  DEFAULT_ENTRANCE_SCENE_MAP,
  DEFAULT_ROOMS_SCENE_MAP,
  DEFAULT_SERVER_SCENE_MAP,
  DEFAULT_SETTINGS_SCENE_MAP,
  normalizeAnalyzeSceneMap,
  normalizeAssistantSceneMap,
  normalizeEntranceSceneMap,
  normalizeRoomsSceneMap,
  normalizeServerSceneMap,
  normalizeSettingsSceneMap,
  serializeEntranceSceneMap,
  type EntranceSceneMap,
} from "../layout/index.js";

interface SceneDebugStoreConfig {
  defaultMap: EntranceSceneMap;
  storageKey: string;
  normalizer: (source: Partial<EntranceSceneMap>) => EntranceSceneMap;
}

export interface SceneDebugStore {
  roomId: SceneDebugEditableRoomId;
  cloneDefault(): EntranceSceneMap;
  loadDraft(): EntranceSceneMap | null;
  saveDraft(sceneMap: EntranceSceneMap): void;
  clearDraft(): void;
  serialize(sceneMap: EntranceSceneMap): string;
  copyToClipboard(sceneMap: EntranceSceneMap): Promise<void>;
}

const SCENE_DEBUG_STORE_CONFIG: Record<SceneDebugEditableRoomId, SceneDebugStoreConfig> = {
  entrance: {
    defaultMap: DEFAULT_ENTRANCE_SCENE_MAP,
    storageKey: getSceneDebugDraftStorageKey("entrance"),
    normalizer: normalizeEntranceSceneMap,
  },
  analyze: {
    defaultMap: DEFAULT_ANALYZE_SCENE_MAP,
    storageKey: getSceneDebugDraftStorageKey("analyze"),
    normalizer: normalizeAnalyzeSceneMap,
  },
  assistant: {
    defaultMap: DEFAULT_ASSISTANT_SCENE_MAP,
    storageKey: getSceneDebugDraftStorageKey("assistant"),
    normalizer: normalizeAssistantSceneMap,
  },
  server: {
    defaultMap: DEFAULT_SERVER_SCENE_MAP,
    storageKey: getSceneDebugDraftStorageKey("server"),
    normalizer: normalizeServerSceneMap,
  },
  rooms: {
    defaultMap: DEFAULT_ROOMS_SCENE_MAP,
    storageKey: getSceneDebugDraftStorageKey("rooms"),
    normalizer: normalizeRoomsSceneMap,
  },
  settings: {
    defaultMap: DEFAULT_SETTINGS_SCENE_MAP,
    storageKey: getSceneDebugDraftStorageKey("settings"),
    normalizer: normalizeSettingsSceneMap,
  },
};

function loadSceneDebugDraft(config: SceneDebugStoreConfig): EntranceSceneMap | null {
  try {
    const raw = window.localStorage.getItem(config.storageKey);
    if (raw === null || raw.trim() === "") {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<EntranceSceneMap>;
    if (
      parsed.referenceSize === undefined ||
      !Array.isArray(parsed.interactives) ||
      !Array.isArray(parsed.backs) ||
      !Array.isArray(parsed.characters)
    ) {
      return null;
    }

    return config.normalizer(parsed);
  } catch {
    return null;
  }
}

function saveSceneDebugDraft(config: SceneDebugStoreConfig, sceneMap: EntranceSceneMap): void {
  try {
    window.localStorage.setItem(config.storageKey, serializeEntranceSceneMap(sceneMap));
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
    cloneDefault(): EntranceSceneMap {
      return cloneEntranceSceneMap(config.defaultMap);
    },
    loadDraft(): EntranceSceneMap | null {
      return loadSceneDebugDraft(config);
    },
    saveDraft(sceneMap: EntranceSceneMap): void {
      saveSceneDebugDraft(config, sceneMap);
    },
    clearDraft(): void {
      clearSceneDebugDraft(config);
    },
    serialize(sceneMap: EntranceSceneMap): string {
      return serializeEntranceSceneMap(sceneMap);
    },
    async copyToClipboard(sceneMap: EntranceSceneMap): Promise<void> {
      await navigator.clipboard.writeText(serializeEntranceSceneMap(sceneMap));
    },
  };
}
