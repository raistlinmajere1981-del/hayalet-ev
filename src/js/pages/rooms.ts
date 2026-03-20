import type { PageController } from "../app/types.js";
import { shellT } from "../app/shell-i18n.js";
import { AppI18n } from "../modules/i18n/index.js";
import { dispatchSceneAction } from "../scene/action-dispatcher.js";
import {
  applySceneDebugFlag,
  createSceneDebugStore,
  createSceneDebugThemeStore,
  SceneLayoutEditor,
  type SceneLayoutEditorSelection,
  getSceneDebugRoomOptions,
  isSceneDebugRoomActive,
  isSceneDebugEnabled,
  openSceneDebugRoom,
} from "../scene-editor/index.js";
import {
  buildSceneCharacterRoster,
  resolveSceneAvatarSource,
} from "../scene/characters/index.js";
import type { SceneClickableThemeDefinition } from "../scene/schema.js";
import type { SceneLayoutConfig } from "../scene/layout/index.js";
import {
  getSceneObjectNodesForView,
  resolveSceneNodeLabelText,
} from "../scene/layout/index.js";
import { navigateToScenePage, openSceneSettingsPanel } from "../scene/navigation.js";
import { getCoverSceneProjectionFromElement, type SceneProjection } from "../scene/projection.js";
import { renderSceneCharacterLayer } from "../scene/renderers/character-layer.js";
import { renderSceneObjectLayer } from "../scene/renderers/object-layer.js";
import { syncSceneViewRuntime } from "../scene/runtime.js";
import { getSceneRoomBackgroundSrc } from "../scene-system/index.js";
import { isSceneUiMode } from "../ui/ui-mode.js";

const ROOMS_SCENE_DEBUG_STORE = createSceneDebugStore("rooms");
const ROOMS_SCENE_DEBUG_THEME_STORE = createSceneDebugThemeStore();

const ELEMENT_IDS = {
  root: "rooms-scene-root",
  background: "rooms-scene-background",
  hotspotLayer: "rooms-scene-hotspots",
  characterLayer: "rooms-scene-characters",
  editorHost: "rooms-scene-editor-host",
  classicShell: "rooms-classic-shell",
} as const;

export class RoomsController implements PageController {
  private sceneDebugEnabled = false;
  private sceneLayout: SceneLayoutConfig = ROOMS_SCENE_DEBUG_STORE.cloneDefault();
  private sceneClickableTheme: SceneClickableThemeDefinition =
    ROOMS_SCENE_DEBUG_THEME_STORE.cloneDefault();
  private editor: SceneLayoutEditor | null = null;
  private editorSelection: SceneLayoutEditorSelection = null;
  private resizeObserver: ResizeObserver | null = null;
  private characterRenderToken = 0;
  private localeUnsub: (() => void) | null = null;

  init(): void {
    this.sceneDebugEnabled = applySceneDebugFlag();
    this.sceneLayout =
      (this.sceneDebugEnabled ? ROOMS_SCENE_DEBUG_STORE.loadDraft() : null) ??
      ROOMS_SCENE_DEBUG_STORE.cloneDefault();
    this.sceneClickableTheme =
      (this.sceneDebugEnabled ? ROOMS_SCENE_DEBUG_THEME_STORE.loadDraft() : null) ??
      ROOMS_SCENE_DEBUG_THEME_STORE.cloneDefault();
    this.setupSceneDebug();
    this.renderBackground();
    this.observeLayout();
    this.localeUnsub ??= AppI18n.subscribe(() => {
      this.renderHotspots();
      void this.renderCharacters();
      this.editor?.refresh();
    });
    this.syncScene();
  }

  onShow(): void {
    this.syncScene();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.localeUnsub?.();
    this.localeUnsub = null;
  }

  private setupSceneDebug(): void {
    const editorHost = this.getEditorHost();
    if (editorHost === null) {
      this.editor = null;
      return;
    }

    if (!this.sceneDebugEnabled) {
      editorHost.replaceChildren();
      this.editor = null;
      return;
    }

    this.editor = new SceneLayoutEditor(editorHost, {
      isActive: (): boolean => this.isSceneDebugActive(),
      getSceneLayout: (): SceneLayoutConfig => this.sceneLayout,
      getSceneClickableTheme: (): SceneClickableThemeDefinition => this.sceneClickableTheme,
      getSelection: (): SceneLayoutEditorSelection => this.editorSelection,
      getRoomOptions: (): Array<{ id: string; label: string }> => getSceneDebugRoomOptions(shellT),
      getActiveRoomId: (): string => "rooms",
      setSelection: (selection): void => {
        this.editorSelection = selection;
        this.editor?.refresh();
        this.renderHotspots();
        void this.renderCharacters();
      },
      navigateToRoom: (roomId: string): void => {
        openSceneDebugRoom(roomId as never);
      },
      updateObject: (id, updater): void => {
        this.sceneLayout.objects = this.sceneLayout.objects.map((sceneObject) =>
          sceneObject.id === id ? updater(sceneObject) : sceneObject
        );
        this.persistSceneLayoutDraft();
        this.renderHotspots();
        this.editor?.refresh();
      },
      updateBack: (): void => {
        return;
      },
      updateCharacter: (id, updater): void => {
        this.sceneLayout.characters = this.sceneLayout.characters.map((character) =>
          character.id === id ? updater(character) : character
        );
        this.persistSceneLayoutDraft();
        void this.renderCharacters();
        this.editor?.refresh();
      },
      resetDraft: (): void => {
        this.sceneLayout = ROOMS_SCENE_DEBUG_STORE.cloneDefault();
        ROOMS_SCENE_DEBUG_STORE.clearDraft();
        this.editorSelection = null;
        this.renderHotspots();
        void this.renderCharacters();
        this.editor?.refresh();
      },
      copySceneLayout: async (): Promise<void> => {
        try {
          await ROOMS_SCENE_DEBUG_STORE.copyToClipboard(this.sceneLayout);
        } catch {
          console.info("Rooms scene layout copy failed.");
        }
      },
      saveSceneLayoutToSource: async (): Promise<void> => {
        await ROOMS_SCENE_DEBUG_STORE.saveSource(this.sceneLayout);
      },
      updateSceneClickableTheme: (updater): void => {
        this.sceneClickableTheme = updater(this.sceneClickableTheme);
        ROOMS_SCENE_DEBUG_THEME_STORE.saveDraft(this.sceneClickableTheme);
        this.renderHotspots();
        this.editor?.refresh();
      },
      resetSceneClickableThemeDraft: (): void => {
        this.sceneClickableTheme = ROOMS_SCENE_DEBUG_THEME_STORE.cloneDefault();
        ROOMS_SCENE_DEBUG_THEME_STORE.clearDraft();
        this.renderHotspots();
        this.editor?.refresh();
      },
      copySceneClickableTheme: async (): Promise<void> => {
        try {
          await ROOMS_SCENE_DEBUG_THEME_STORE.copyToClipboard(this.sceneClickableTheme);
        } catch {
          console.info("Rooms scene clickable theme copy failed.");
        }
      },
      saveSceneClickableThemeToSource: async (): Promise<void> => {
        await ROOMS_SCENE_DEBUG_THEME_STORE.saveSource(this.sceneClickableTheme);
      },
    });
    this.editor.refresh();
  }

  private syncScene(): void {
    const sceneActive = isSceneUiMode();
    syncSceneViewRuntime({
      elements: {
        root: this.getRoot(),
        view: null,
        classicLayout: this.getClassicShell(),
      },
      state: {
        sceneActive,
        viewOpen: false,
      },
    });

    if (!sceneActive) {
      return;
    }

    this.renderBackground();
    this.renderHotspots();
    void this.renderCharacters();
    this.editor?.refresh();
  }

  private renderBackground(): void {
    const background = this.getBackground();
    if (background === null) {
      return;
    }

    background.src = getSceneRoomBackgroundSrc("rooms");
    background.alt = "";
  }

  private renderHotspots(): void {
    const hotspotLayer = this.getHotspotLayer();
    if (hotspotLayer === null) {
      return;
    }

    renderSceneObjectLayer({
      layer: hotspotLayer,
      nodes: getSceneObjectNodesForView(this.sceneLayout),
      themeDefaults: this.sceneClickableTheme.object,
      projection: this.getSceneProjection(),
      cssVarPrefix: "scene-hotspot",
      classNames: {
        item: "entrance-scene__hotspot-item",
        button: "entrance-scene__hotspot",
        label: "entrance-scene__hotspot-label",
      },
      selection: this.editorSelection,
      clickableLabels: true,
      resolveLabel: (node) => resolveSceneNodeLabelText(node, shellT),
      onActivate: (node) => {
        this.handleObject(node.id);
      },
    });
  }

  private async renderCharacters(): Promise<void> {
    const characterLayer = this.getCharacterLayer();
    if (characterLayer === null || !isSceneUiMode()) {
      return;
    }

    const characters = buildSceneCharacterRoster(
      this.sceneLayout.characters,
      this.sceneLayout.characterRosterPreset
    );
    if (characters.length === 0) {
      characterLayer.replaceChildren();
      return;
    }

    const renderToken = ++this.characterRenderToken;
    await renderSceneCharacterLayer({
      layer: characterLayer,
      characters,
      projection: this.getSceneProjection(),
      sceneDebugEnabled: isSceneDebugEnabled(),
      interactive: this.editor !== null,
      selectedCharacterId:
        this.editorSelection?.kind === "character" ? this.editorSelection.id : null,
      isStale: () => renderToken !== this.characterRenderToken,
      getDepthScale: (depth) => this.getDepthScale(depth),
      resolveAvatarSource: async (character) => {
        return await resolveSceneAvatarSource(character.avatarSource);
      },
      getNodeClassName: (character) => `entrance-scene__character is-${character.state}`,
      getFallbackHeadLabel: (character) => character.headLabel ?? "?",
      onActivate: (character) => {
        if (this.editor === null) {
          return;
        }
        this.editorSelection = { kind: "character", id: character.anchorId };
        this.editor.refresh();
        void this.renderCharacters();
      },
    });
  }

  private handleObject(id: string): void {
    const sceneObject = this.sceneLayout.objects.find((node) => node.id === id) ?? null;
    if (sceneObject === null) {
      return;
    }

    if (this.editor !== null) {
      this.editorSelection = { kind: "object", id: sceneObject.id };
      this.editor.refresh();
      this.renderHotspots();
      return;
    }

    dispatchSceneAction(sceneObject.action, {
      onNavigate: (page) => {
        navigateToScenePage(page);
      },
      onSettings: (action) => {
        openSceneSettingsPanel(action.panel);
      },
      onSettingsSceneClose: () => {},
      onScreen: () => {},
      onWhisper: () => {},
      onBack: () => {},
    });
  }

  private observeLayout(): void {
    const root = this.getRoot();
    if (root === null || typeof ResizeObserver === "undefined") {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      if (!isSceneUiMode()) {
        return;
      }
      this.renderHotspots();
      void this.renderCharacters();
      this.editor?.refresh();
    });
    this.resizeObserver.observe(root);
  }

  private persistSceneLayoutDraft(): void {
    ROOMS_SCENE_DEBUG_STORE.saveDraft(this.sceneLayout);
  }

  private isSceneDebugActive(): boolean {
    return isSceneDebugRoomActive("rooms");
  }

  private getDepthScale(depth: number): number {
    const normalizedDepth = Math.max(1, Number.isFinite(depth) ? depth : 1);
    const scaled = 1 - (normalizedDepth - 1) * 0.02;
    return Number(Math.max(0.75, scaled).toFixed(3));
  }

  private getSceneProjection(): SceneProjection {
    return getCoverSceneProjectionFromElement(this.getRoot(), this.sceneLayout.referenceSize);
  }

  private getRoot(): HTMLElement | null {
    return document.getElementById(ELEMENT_IDS.root);
  }

  private getBackground(): HTMLImageElement | null {
    return document.getElementById(ELEMENT_IDS.background) as HTMLImageElement | null;
  }

  private getHotspotLayer(): HTMLElement | null {
    return document.getElementById(ELEMENT_IDS.hotspotLayer);
  }

  private getCharacterLayer(): HTMLElement | null {
    return document.getElementById(ELEMENT_IDS.characterLayer);
  }

  private getEditorHost(): HTMLElement | null {
    return document.getElementById(ELEMENT_IDS.editorHost);
  }

  private getClassicShell(): HTMLElement | null {
    return document.getElementById(ELEMENT_IDS.classicShell);
  }
}
