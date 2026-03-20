import { AppState } from "../../../modules/app-state.js";
import { AppI18n } from "../../../modules/i18n/index.js";
import { TrafficManager } from "../../../modules/traffic-manager.js";
import { shellT } from "../../../app/shell-i18n.js";
import { dispatchSceneAction } from "../../../scene/action-dispatcher.js";
import {
  applySceneDebugFlag,
  createSceneDebugStore,
  EntranceSceneEditor,
  type EntranceSceneEditorSelection,
  getActiveSceneDebugRoomId,
  isSceneDebugEnabled,
  SCENE_DEBUG_ROOMS,
} from "../../../scene/debug/index.js";
import {
  buildSceneCharacterRoster,
  resolveSceneAvatarSource,
  type SceneCharacterDescriptor,
} from "../../../scene/characters/index.js";
import type { EntranceSceneMap } from "../../../scene/layout/index.js";
import {
  getSceneInteractiveNodesForView,
  resolveSceneNodeLabelText,
} from "../../../scene/layout/index.js";
import { navigateToScenePage, openSceneSettingsPanel } from "../../../scene/navigation.js";
import { getCoverSceneProjection } from "../../../scene/projection.js";
import { renderSceneCharacterLayer } from "../../../scene/renderers/character-layer.js";
import { renderSceneInteractiveLayer } from "../../../scene/renderers/interactive-layer.js";
import { getSceneRoomBackgroundSrc } from "../../../scene/theme/scene-theme-assets.js";
import { isSceneUiMode } from "../../../ui/ui-mode.js";

import { SceneCharacterMenu } from "./scene-character-menu.js";
import type { SceneEntranceBridge } from "./scene-entrance-bridge.js";

const ELEMENT_IDS = {
  root: "entrance-scene-root",
  background: "entrance-scene-background",
  hotspotLayer: "entrance-scene-hotspots",
  characterLayer: "entrance-scene-characters",
  editorHost: "entrance-scene-editor-host",
  menuHost: "entrance-scene-menu-host",
} as const;

const ENTRANCE_SCENE_DEBUG_STORE = createSceneDebugStore("entrance");

export class EntranceSceneController {
  bridge: SceneEntranceBridge;
  root: HTMLElement | null = null;
  background: HTMLImageElement | null = null;
  hotspotLayer: HTMLElement | null = null;
  characterLayer: HTMLElement | null = null;
  editorHost: HTMLElement | null = null;
  menuHost: HTMLElement | null = null;
  menu: SceneCharacterMenu | null = null;
  editor: EntranceSceneEditor | null = null;
  resizeObserver: ResizeObserver | null = null;
  trafficUnsub: (() => void) | null = null;
  appStateUnsub: (() => void) | null = null;
  localeUnsub: (() => void) | null = null;
  characterRenderToken = 0;
  openCharacterId: string | null = null;
  characters = new Map<string, SceneCharacterDescriptor>();
  sceneMap = ENTRANCE_SCENE_DEBUG_STORE.cloneDefault();
  sceneDebugEnabled = false;
  editorSelection: EntranceSceneEditorSelection = null;

  constructor(bridge: SceneEntranceBridge) {
    this.bridge = bridge;
  }

  init(): void {
    this.sceneDebugEnabled = applySceneDebugFlag();
    this.root = document.getElementById(ELEMENT_IDS.root);
    this.background = document.getElementById(ELEMENT_IDS.background) as HTMLImageElement | null;
    this.hotspotLayer = document.getElementById(ELEMENT_IDS.hotspotLayer);
    this.characterLayer = document.getElementById(ELEMENT_IDS.characterLayer);
    this.editorHost = document.getElementById(ELEMENT_IDS.editorHost);
    this.menuHost = document.getElementById(ELEMENT_IDS.menuHost);
    this.sceneMap =
      (this.sceneDebugEnabled ? ENTRANCE_SCENE_DEBUG_STORE.loadDraft() : null) ??
      ENTRANCE_SCENE_DEBUG_STORE.cloneDefault();
    if (this.menuHost !== null) {
      this.menu = new SceneCharacterMenu(this.menuHost, this.bridge, {
        onClose: (): void => {
          this.openCharacterId = null;
          this.syncOpenMenuAnchor();
        },
      });
    }
    if (this.sceneDebugEnabled && this.editorHost !== null) {
      this.editor = new EntranceSceneEditor(this.editorHost, {
        isActive: (): boolean =>
          isSceneUiMode() &&
          (getActiveSceneDebugRoomId() ??
            document.documentElement.getAttribute("data-active-page")) === "entrance",
        getSceneMap: (): EntranceSceneMap => this.sceneMap,
        getSelection: (): EntranceSceneEditorSelection => this.editorSelection,
        getRoomOptions: (): Array<{ id: string; label: string }> =>
          SCENE_DEBUG_ROOMS.map((room) => ({
            id: room.id,
            label: shellT(room.labelKey),
          })),
        getActiveRoomId: (): string => "entrance",
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
          this.sceneMap = ENTRANCE_SCENE_DEBUG_STORE.cloneDefault();
          ENTRANCE_SCENE_DEBUG_STORE.clearDraft();
          this.editorSelection = null;
          this.renderHotspots();
          void this.renderCharacters();
          this.editor?.refresh();
        },
        copySceneMap: async (): Promise<void> => {
          try {
            await ENTRANCE_SCENE_DEBUG_STORE.copyToClipboard(this.sceneMap);
          } catch {
            console.info("Scene map copy failed.");
          }
        },
      });
      this.editor.refresh();
    }

    this.renderStatic();
    this.subscribeRuntimeSignals();
    this.observeLayout();
    this.syncScene();
  }

  onShow(): void {
    this.syncScene();
  }

  onHide(): void {
    this.menu?.close(false);
    this.openCharacterId = null;
  }

  syncScene(): void {
    if (this.root === null) {
      return;
    }

    const sceneActive = isSceneUiMode();
    this.root.hidden = !sceneActive;
    this.root.setAttribute("aria-hidden", String(!sceneActive));

    if (!sceneActive) {
      this.menu?.close(false);
      this.openCharacterId = null;
      return;
    }

    this.renderBackground();
    this.renderHotspots();
    void this.renderCharacters();
    this.editor?.refresh();
  }

  private renderStatic(): void {
    this.renderBackground();
    this.renderHotspots();
    void this.renderCharacters();
    this.editor?.refresh();
  }

  private subscribeRuntimeSignals(): void {
    this.trafficUnsub ??= TrafficManager.onUpdate(() => {
      void this.renderCharacters();
    });

    this.appStateUnsub ??= AppState.subscribe(() => {
      void this.renderCharacters();
    });

    this.localeUnsub ??= AppI18n.subscribe(() => {
      this.renderHotspots();
      this.syncOpenMenuAnchor();
      this.editor?.refresh();
    });
  }

  private renderBackground(): void {
    if (this.background !== null) {
      this.background.src = getSceneRoomBackgroundSrc("entrance");
      this.background.alt = "";
    }
  }

  private renderHotspots(): void {
    if (this.hotspotLayer === null) {
      return;
    }

    renderSceneInteractiveLayer({
      layer: this.hotspotLayer,
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

  private observeLayout(): void {
    if (this.root === null || typeof ResizeObserver === "undefined") {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      if (!isSceneUiMode()) {
        return;
      }
      this.renderHotspots();
      void this.renderCharacters();
      this.syncOpenMenuAnchor();
      this.editor?.refresh();
    });
    this.resizeObserver.observe(this.root);
  }

  private getSceneProjection(): {
    offsetX: number;
    offsetY: number;
    scale: number;
  } {
    return getCoverSceneProjection({
      surfaceWidth: this.root?.clientWidth ?? 0,
      surfaceHeight: this.root?.clientHeight ?? 0,
      referenceWidth: this.sceneMap.referenceSize.width,
      referenceHeight: this.sceneMap.referenceSize.height,
    });
  }

  private getDepthScale(depth: number): number {
    const safeDepth = Number.isFinite(depth) ? depth : 1;
    const normalizedDepth = Math.max(1, safeDepth);
    const scaled = 1 - (normalizedDepth - 1) * 0.02;
    return Number(Math.max(0.75, scaled).toFixed(3));
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
      onWhisper: () => {
        navigateToScenePage("whisper");
      },
      onBack: () => {},
    });
  }

  private async renderCharacters(): Promise<void> {
    if (this.characterLayer === null || !isSceneUiMode()) {
      return;
    }

    const renderToken = ++this.characterRenderToken;
    const characters = buildSceneCharacterRoster(
      this.sceneMap.characters,
      this.sceneMap.characterRosterPreset
    );
    this.characters = new Map(characters.map((character) => [character.id, character]));
    await renderSceneCharacterLayer({
      layer: this.characterLayer,
      characters,
      projection: this.getSceneProjection(),
      sceneDebugEnabled: isSceneDebugEnabled(),
      interactive: true,
      selectedCharacterId:
        this.editorSelection?.kind === "character" ? this.editorSelection.id : null,
      menuOpenCharacterId: this.openCharacterId,
      isStale: () => renderToken !== this.characterRenderToken,
      getDepthScale: (depth) => this.getDepthScale(depth),
      resolveAvatarSource: async (character) => {
        return await resolveSceneAvatarSource(character.avatarSource);
      },
      getNodeClassName: (character) => `entrance-scene__character is-${character.state}`,
      getFallbackHeadLabel: (character) => character.headLabel ?? "?",
      onActivate: (character, anchorElement) => {
        if (this.editor !== null) {
          this.editorSelection = { kind: "character", id: character.anchorId };
          this.editor.refresh();
          void this.renderCharacters();
          return;
        }
        this.toggleCharacterMenu(character, anchorElement);
      },
    });
    this.syncOpenMenuAnchor();
  }

  private persistSceneMapDraft(): void {
    ENTRANCE_SCENE_DEBUG_STORE.saveDraft(this.sceneMap);
  }

  private toggleCharacterMenu(
    character: SceneCharacterDescriptor,
    anchorElement: HTMLElement
  ): void {
    if (this.menu === null) {
      return;
    }

    if (this.openCharacterId === character.id) {
      this.menu.close();
      return;
    }

    this.openCharacterId = character.id;
    this.menu.open(character, anchorElement);
    this.syncOpenMenuAnchor();
  }

  private syncOpenMenuAnchor(): void {
    if (this.characterLayer === null) {
      return;
    }

    this.characterLayer
      .querySelectorAll<HTMLElement>(".entrance-scene__character")
      .forEach((node) => {
        node.classList.toggle("is-menu-open", node.dataset["characterId"] === this.openCharacterId);
        node.setAttribute(
          "aria-expanded",
          String(node.dataset["characterId"] === this.openCharacterId)
        );
      });

    if (this.menu === null || this.openCharacterId === null) {
      return;
    }

    const character = this.characters.get(this.openCharacterId) ?? null;
    const selector = `[data-character-id="${this.escapeForAttribute(this.openCharacterId)}"]`;
    const anchorElement = this.characterLayer.querySelector<HTMLElement>(selector);

    if (character === null || anchorElement === null) {
      this.menu.close();
      return;
    }

    this.menu.refresh(character, anchorElement);
  }

  private escapeForAttribute(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
}
