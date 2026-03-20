import type { PageController } from "../app/types.js";
import { shellT } from "../app/shell-i18n.js";
import { AppI18n } from "../modules/i18n/index.js";
import { dispatchSceneAction } from "../scene/action-dispatcher.js";
import {
  applySceneDebugFlag,
  createSceneDebugStore,
  EntranceSceneEditor,
  type EntranceSceneEditorSelection,
  getActiveSceneDebugRoomId,
  isSceneDebugEnabled,
  SCENE_DEBUG_ROOMS,
} from "../scene/debug/index.js";
import {
  buildSceneCharacterRoster,
  resolveSceneAvatarSource,
} from "../scene/characters/index.js";
import type { EntranceSceneMap } from "../scene/layout/index.js";
import {
  getSceneInteractiveNodesForView,
  resolveSceneNodeLabelText,
} from "../scene/layout/index.js";
import { navigateToScenePage, openSceneSettingsPanel } from "../scene/navigation.js";
import { getCoverSceneProjectionFromElement, type SceneProjection } from "../scene/projection.js";
import { renderSceneCharacterLayer } from "../scene/renderers/character-layer.js";
import { renderSceneInteractiveLayer } from "../scene/renderers/interactive-layer.js";
import { syncSceneViewRuntime } from "../scene/runtime.js";
import { getSceneRoomBackgroundSrc } from "../scene/theme/scene-theme-assets.js";
import { isSceneUiMode } from "../ui/ui-mode.js";

const ROOMS_SCENE_DEBUG_STORE = createSceneDebugStore("rooms");

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
  private sceneMap: EntranceSceneMap = ROOMS_SCENE_DEBUG_STORE.cloneDefault();
  private editor: EntranceSceneEditor | null = null;
  private editorSelection: EntranceSceneEditorSelection = null;
  private resizeObserver: ResizeObserver | null = null;
  private characterRenderToken = 0;
  private localeUnsub: (() => void) | null = null;

  init(): void {
    this.sceneDebugEnabled = applySceneDebugFlag();
    this.sceneMap =
      (this.sceneDebugEnabled ? ROOMS_SCENE_DEBUG_STORE.loadDraft() : null) ??
      ROOMS_SCENE_DEBUG_STORE.cloneDefault();
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

    this.editor = new EntranceSceneEditor(editorHost, {
      isActive: (): boolean => this.isSceneDebugActive(),
      getSceneMap: (): EntranceSceneMap => this.sceneMap,
      getSelection: (): EntranceSceneEditorSelection => this.editorSelection,
      getRoomOptions: (): Array<{ id: string; label: string }> =>
        SCENE_DEBUG_ROOMS.map((room) => ({
          id: room.id,
          label: shellT(room.labelKey),
        })),
      getActiveRoomId: (): string => "rooms",
      setSelection: (selection): void => {
        this.editorSelection = selection;
        this.editor?.refresh();
        this.renderHotspots();
        void this.renderCharacters();
      },
      navigateToRoom: (roomId: string): void => {
        if (roomId === "settings") {
          openSceneSettingsPanel(null);
          return;
        }

        navigateToScenePage(roomId);
      },
      updateInteractive: (id, updater): void => {
        this.sceneMap.interactives = this.sceneMap.interactives.map((interactive) =>
          interactive.id === id ? updater(interactive) : interactive
        );
        this.persistSceneMapDraft();
        this.renderHotspots();
        this.editor?.refresh();
      },
      updateBack: (id, updater): void => {
        this.sceneMap.backs = this.sceneMap.backs.map((back) =>
          back.id === id ? updater(back) : back
        );
        this.persistSceneMapDraft();
        this.renderHotspots();
        this.editor?.refresh();
      },
      updateCharacter: (id, updater): void => {
        this.sceneMap.characters = this.sceneMap.characters.map((character) =>
          character.id === id ? updater(character) : character
        );
        this.persistSceneMapDraft();
        void this.renderCharacters();
        this.editor?.refresh();
      },
      resetDraft: (): void => {
        this.sceneMap = ROOMS_SCENE_DEBUG_STORE.cloneDefault();
        ROOMS_SCENE_DEBUG_STORE.clearDraft();
        this.editorSelection = null;
        this.renderHotspots();
        void this.renderCharacters();
        this.editor?.refresh();
      },
      copySceneMap: async (): Promise<void> => {
        try {
          await ROOMS_SCENE_DEBUG_STORE.copyToClipboard(this.sceneMap);
        } catch {
          console.info("Rooms scene map copy failed.");
        }
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

    renderSceneInteractiveLayer({
      layer: hotspotLayer,
      nodes: getSceneInteractiveNodesForView(this.sceneMap),
      projection: this.getSceneProjection(),
      cssVarPrefix: "scene-hotspot",
      classNames: {
        item: "entrance-scene__hotspot-item",
        button: "entrance-scene__hotspot",
        label: "entrance-scene__hotspot-label",
      },
      selection: this.editorSelection,
      resolveLabel: (node) => resolveSceneNodeLabelText(node, shellT),
      onActivate: (node) => {
        this.handleInteractive(node.id);
      },
    });
  }

  private async renderCharacters(): Promise<void> {
    const characterLayer = this.getCharacterLayer();
    if (characterLayer === null || !isSceneUiMode()) {
      return;
    }

    const characters = buildSceneCharacterRoster(
      this.sceneMap.characters,
      this.sceneMap.characterRosterPreset
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

  private handleInteractive(id: string): void {
    const interactive = this.sceneMap.interactives.find((node) => node.id === id) ?? null;
    if (interactive === null) {
      return;
    }

    if (this.editor !== null) {
      this.editorSelection = { kind: "interactive", id: interactive.id };
      this.editor.refresh();
      this.renderHotspots();
      return;
    }

    dispatchSceneAction(interactive.action, {
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

  private persistSceneMapDraft(): void {
    ROOMS_SCENE_DEBUG_STORE.saveDraft(this.sceneMap);
  }

  private isSceneDebugActive(): boolean {
    return (
      isSceneUiMode() &&
      (getActiveSceneDebugRoomId() ?? document.documentElement.getAttribute("data-active-page")) ===
        "rooms"
    );
  }

  private getDepthScale(depth: number): number {
    const normalizedDepth = Math.max(1, Number.isFinite(depth) ? depth : 1);
    const scaled = 1 - (normalizedDepth - 1) * 0.02;
    return Number(Math.max(0.75, scaled).toFixed(3));
  }

  private getSceneProjection(): SceneProjection {
    return getCoverSceneProjectionFromElement(this.getRoot(), this.sceneMap.referenceSize);
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
