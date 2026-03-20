import { FileManager } from "../modules/file-manager.js";
import {
  cloneSceneLayout,
  parseSceneLayoutDraft,
  serializeSceneLayout,
  type SceneLayoutConfig,
} from "../scene/layout/index.js";
import type { SceneClickableThemeDefinition, SceneDebugEditableRoomId } from "../scene/schema.js";
import {
  getSceneClickableTheme,
  parseSceneClickableThemeDraft,
  serializeSceneClickableThemeDraft,
  serializeSceneClickableThemeSource,
} from "../scene-system/index.js";
import {
  getSceneClickableDefaultsSourcePath,
  getSceneRoomLayout,
  getSceneRoomSourcePath,
  getSceneThemeId,
} from "../scene-system/scene-layout-registry.js";

interface SceneDebugStoreConfig {
  storageKey: string;
  sourcePath: string;
}

interface SceneDebugThemeStoreConfig {
  storageKey: string;
  sourcePath: string;
}

export interface SceneDebugStore {
  roomId: SceneDebugEditableRoomId;
  getSourcePath(): string;
  cloneDefault(): SceneLayoutConfig;
  loadDraft(): SceneLayoutConfig | null;
  saveDraft(sceneLayout: SceneLayoutConfig): void;
  clearDraft(): void;
  serialize(sceneLayout: SceneLayoutConfig): string;
  copyToClipboard(sceneLayout: SceneLayoutConfig): Promise<void>;
  saveSource(sceneLayout: SceneLayoutConfig): Promise<boolean>;
}

export interface SceneDebugThemeStore {
  getSourcePath(): string;
  cloneDefault(): SceneClickableThemeDefinition;
  loadDraft(): SceneClickableThemeDefinition | null;
  saveDraft(sceneClickableTheme: SceneClickableThemeDefinition): void;
  clearDraft(): void;
  serialize(sceneClickableTheme: SceneClickableThemeDefinition): string;
  copyToClipboard(sceneClickableTheme: SceneClickableThemeDefinition): Promise<void>;
  saveSource(sceneClickableTheme: SceneClickableThemeDefinition): Promise<boolean>;
}

const SCENE_EDITOR_DRAFT_VERSION = "v2";
const SCENE_CLICKABLE_THEME_DRAFT_VERSION = "v1";

function getSceneDebugDraftStorageKey(roomId: SceneDebugEditableRoomId): string {
  return `scene-editor:${getSceneThemeId()}:${roomId}:draft:${SCENE_EDITOR_DRAFT_VERSION}`;
}

function getSceneDebugStoreConfig(roomId: SceneDebugEditableRoomId): SceneDebugStoreConfig {
  return {
    storageKey: getSceneDebugDraftStorageKey(roomId),
    sourcePath: getSceneRoomSourcePath(roomId),
  };
}

function getSceneDebugThemeDraftStorageKey(): string {
  return `scene-editor:${getSceneThemeId()}:clickable-defaults:draft:${SCENE_CLICKABLE_THEME_DRAFT_VERSION}`;
}

function getSceneDebugThemeStoreConfig(): SceneDebugThemeStoreConfig {
  return {
    storageKey: getSceneDebugThemeDraftStorageKey(),
    sourcePath: getSceneClickableDefaultsSourcePath(),
  };
}

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

function loadSceneDebugThemeDraft(
  config: SceneDebugThemeStoreConfig
): SceneClickableThemeDefinition | null {
  try {
    const raw = window.localStorage.getItem(config.storageKey);
    if (raw === null || raw.trim() === "") {
      return null;
    }

    return parseSceneClickableThemeDraft(raw);
  } catch {
    return null;
  }
}

function saveSceneDebugThemeDraft(
  config: SceneDebugThemeStoreConfig,
  sceneClickableTheme: SceneClickableThemeDefinition
): void {
  try {
    window.localStorage.setItem(config.storageKey, serializeSceneClickableThemeDraft(sceneClickableTheme));
  } catch {
    // Ignore draft persistence failures in constrained environments.
  }
}

function clearSceneDebugThemeDraft(config: SceneDebugThemeStoreConfig): void {
  try {
    window.localStorage.removeItem(config.storageKey);
  } catch {
    // Ignore draft persistence failures in constrained environments.
  }
}

export function createSceneDebugStore(roomId: SceneDebugEditableRoomId): SceneDebugStore {
  const config = getSceneDebugStoreConfig(roomId);

  return {
    roomId,
    getSourcePath(): string {
      return config.sourcePath;
    },
    cloneDefault(): SceneLayoutConfig {
      return cloneSceneLayout(getSceneRoomLayout(roomId));
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
    async saveSource(sceneLayout: SceneLayoutConfig): Promise<boolean> {
      const savedPath = await FileManager.writeFileAtomic(
        config.sourcePath,
        `${serializeSceneLayout(sceneLayout)}\n`,
        "utf-8"
      );
      return savedPath !== "";
    },
  };
}

export function createSceneDebugThemeStore(): SceneDebugThemeStore {
  const config = getSceneDebugThemeStoreConfig();

  return {
    getSourcePath(): string {
      return config.sourcePath;
    },
    cloneDefault(): SceneClickableThemeDefinition {
      return getSceneClickableTheme();
    },
    loadDraft(): SceneClickableThemeDefinition | null {
      return loadSceneDebugThemeDraft(config);
    },
    saveDraft(sceneClickableTheme: SceneClickableThemeDefinition): void {
      saveSceneDebugThemeDraft(config, sceneClickableTheme);
    },
    clearDraft(): void {
      clearSceneDebugThemeDraft(config);
    },
    serialize(sceneClickableTheme: SceneClickableThemeDefinition): string {
      return serializeSceneClickableThemeDraft(sceneClickableTheme);
    },
    async copyToClipboard(sceneClickableTheme: SceneClickableThemeDefinition): Promise<void> {
      await navigator.clipboard.writeText(serializeSceneClickableThemeDraft(sceneClickableTheme));
    },
    async saveSource(sceneClickableTheme: SceneClickableThemeDefinition): Promise<boolean> {
      const savedPath = await FileManager.writeFileAtomic(
        config.sourcePath,
        serializeSceneClickableThemeSource(sceneClickableTheme),
        "utf-8"
      );
      return savedPath !== "";
    },
  };
}
