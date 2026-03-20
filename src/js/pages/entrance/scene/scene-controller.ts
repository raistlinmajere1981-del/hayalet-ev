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
import type { SceneLayoutConfig } from "../../../scene/layout/index.js";
import {
  getSceneBackNodeForView,
  getSceneInteractiveNodesForView,
  resolveSceneNodeLabelText,
} from "../../../scene/layout/index.js";
import { navigateToScenePage, openSceneSettingsPanel } from "../../../scene/navigation.js";
import { getCoverSceneProjection } from "../../../scene/projection.js";
import { renderSceneBackLayer } from "../../../scene/renderers/back-layer.js";
import { renderSceneCharacterLayer } from "../../../scene/renderers/character-layer.js";
import { renderSceneInteractiveLayer } from "../../../scene/renderers/interactive-layer.js";
import {
  getSceneRoomBackgroundSrc,
  getSceneRoomViewBackgroundSrc,
} from "../../../scene/theme/scene-theme-assets.js";
import {
  SCENE_TOOL_CLOSE_EVENT,
  SCENE_TOOL_HOST_HIDE_EVENT,
  SCENE_TOOL_HOST_SHOW_EVENT,
  SCENE_TOOL_OPEN_EVENT,
  type SceneToolEventDetail,
} from "../../../scene/tool-pages.js";
import { syncSceneViewRuntime } from "../../../scene/runtime.js";
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
  viewRoot: "entrance-scene-view",
  viewBackground: "entrance-scene-view-background",
  viewSlot: "entrance-scene-view-slot",
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
  viewRoot: HTMLElement | null = null;
  viewBackground: HTMLImageElement | null = null;
  viewSlot: HTMLElement | null = null;
  menu: SceneCharacterMenu | null = null;
  editor: EntranceSceneEditor | null = null;
  resizeObserver: ResizeObserver | null = null;
  trafficUnsub: (() => void) | null = null;
  appStateUnsub: (() => void) | null = null;
  localeUnsub: (() => void) | null = null;
  characterRenderToken = 0;
  openCharacterId: string | null = null;
  characters = new Map<string, SceneCharacterDescriptor>();
  sceneLayout = ENTRANCE_SCENE_DEBUG_STORE.cloneDefault();
  sceneDebugEnabled = false;
  editorSelection: EntranceSceneEditorSelection = null;
  activeViewId: "whisper" | null = null;
  whisperPlaceholder: Comment | null = null;

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
    this.viewRoot = document.getElementById(ELEMENT_IDS.viewRoot);
    this.viewBackground = document.getElementById(ELEMENT_IDS.viewBackground) as HTMLImageElement | null;
    this.viewSlot = document.getElementById(ELEMENT_IDS.viewSlot);
    this.sceneLayout =
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
        getSceneLayout: (): SceneLayoutConfig => this.sceneLayout,
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
          this.sceneLayout.interactives = this.sceneLayout.interactives.map((interactive) =>
            interactive.id === id ? updater(interactive) : interactive
          );
          this.persistSceneLayoutDraft();
          this.renderHotspots();
          this.editor?.refresh();
        },
        updateBack: (id, updater): void => {
          this.sceneLayout.backs = this.sceneLayout.backs.map((back) =>
            back.id === id ? updater(back) : back
          );
          this.persistSceneLayoutDraft();
          this.syncViewState();
          this.renderHotspots();
          this.editor?.refresh();
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
          this.sceneLayout = ENTRANCE_SCENE_DEBUG_STORE.cloneDefault();
          ENTRANCE_SCENE_DEBUG_STORE.clearDraft();
          this.editorSelection = null;
          this.renderHotspots();
          void this.renderCharacters();
          this.editor?.refresh();
        },
        copySceneLayout: async (): Promise<void> => {
          try {
            await ENTRANCE_SCENE_DEBUG_STORE.copyToClipboard(this.sceneLayout);
          } catch {
            console.info("Scene layout copy failed.");
          }
        },
      });
      this.editor.refresh();
    }

    this.renderStatic();
    this.subscribeRuntimeSignals();
    this.bindSceneToolEvents();
    this.observeLayout();
    this.syncScene();
  }

  onShow(): void {
    this.syncScene();
  }

  onHide(): void {
    this.setActiveView(null);
    this.menu?.close(false);
    this.openCharacterId = null;
  }

  syncScene(): void {
    if (this.root === null) {
      return;
    }

    const sceneActive = isSceneUiMode();
    syncSceneViewRuntime({
      elements: {
        root: this.root,
        view: this.viewRoot,
        viewSlot: this.viewSlot,
      },
      state: {
        sceneActive,
        viewOpen: this.activeViewId !== null,
      },
    });

    if (!sceneActive) {
      this.restoreWhisperPage();
      this.menu?.close(false);
      this.openCharacterId = null;
      return;
    }

    this.renderBackground();
    this.renderHotspots();
    this.syncViewState();
    void this.renderCharacters();
    this.editor?.refresh();
  }

  private renderStatic(): void {
    this.renderBackground();
    this.renderHotspots();
    this.syncViewState();
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
      this.syncViewState();
      this.syncOpenMenuAnchor();
      this.editor?.refresh();
    });
  }

  private bindSceneToolEvents(): void {
    document.addEventListener(SCENE_TOOL_OPEN_EVENT, ((event: CustomEvent<SceneToolEventDetail>) => {
      if (event.detail.tool === "whisper") {
        this.setActiveView("whisper");
      }
    }) as EventListener);

    document.addEventListener(SCENE_TOOL_CLOSE_EVENT, ((event: CustomEvent<SceneToolEventDetail>) => {
      if (event.detail.tool === "whisper") {
        this.setActiveView(null);
      }
    }) as EventListener);
  }

  private renderBackground(): void {
    if (this.background !== null) {
      this.background.src = getSceneRoomBackgroundSrc("entrance");
      this.background.alt = "";
    }

    if (this.viewBackground !== null) {
      this.viewBackground.src = getSceneRoomViewBackgroundSrc("entrance", "whisper") ?? "";
      this.viewBackground.alt = "";
    }
  }

  private renderHotspots(): void {
    if (this.hotspotLayer === null) {
      return;
    }

    renderSceneInteractiveLayer({
      layer: this.hotspotLayer,
      nodes: getSceneInteractiveNodesForView(this.sceneLayout),
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
      this.syncViewState();
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
      referenceWidth: this.sceneLayout.referenceSize.width,
      referenceHeight: this.sceneLayout.referenceSize.height,
    });
  }

  private getDepthScale(depth: number): number {
    const safeDepth = Number.isFinite(depth) ? depth : 1;
    const normalizedDepth = Math.max(1, safeDepth);
    const scaled = 1 - (normalizedDepth - 1) * 0.02;
    return Number(Math.max(0.75, scaled).toFixed(3));
  }

  private handleInteractive(id: string): void {
    const interactive = this.sceneLayout.interactives.find((node) => node.id === id) ?? null;
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
        this.setActiveView("whisper");
      },
      onBack: () => {
        this.setActiveView(null);
      },
    });
  }

  private async renderCharacters(): Promise<void> {
    if (this.characterLayer === null || !isSceneUiMode()) {
      return;
    }

    const renderToken = ++this.characterRenderToken;
    const characters = buildSceneCharacterRoster(
      this.sceneLayout.characters,
      this.sceneLayout.characterRosterPreset
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

  private persistSceneLayoutDraft(): void {
    ENTRANCE_SCENE_DEBUG_STORE.saveDraft(this.sceneLayout);
  }

  private setActiveView(viewId: "whisper" | null): void {
    this.activeViewId = viewId;
    this.syncScene();
  }

  private syncViewState(): void {
    if (!(this.viewRoot instanceof HTMLElement)) {
      return;
    }

    if (this.activeViewId === "whisper") {
      this.mountWhisperPage();
    } else {
      this.restoreWhisperPage();
    }

    renderSceneBackLayer({
      host: this.viewRoot,
      node:
        isSceneUiMode() && this.activeViewId !== null
          ? getSceneBackNodeForView(this.sceneLayout, this.activeViewId)
          : null,
      projection: this.getSceneProjection(),
      resolveLabel: (node) => resolveSceneNodeLabelText(node, shellT),
      onActivate: (node) => {
        if (this.editor !== null) {
          this.editorSelection = { kind: "back", id: node.id };
          this.editor.refresh();
          return;
        }

        dispatchSceneAction(node.action, {
          onNavigate: () => {},
          onSettings: () => {},
          onSettingsSceneClose: () => {},
          onScreen: () => {},
          onWhisper: () => {},
          onBack: () => {
            this.setActiveView(null);
          },
        });
      },
    });
  }

  private mountWhisperPage(): void {
    const page = document.getElementById("page-whisper");
    if (!(this.viewSlot instanceof HTMLElement) || !(page instanceof HTMLElement)) {
      return;
    }

    const wasEmbedded = page.dataset["sceneEmbedded"] === "true";
    if (page.parentElement !== this.viewSlot) {
      if (this.whisperPlaceholder === null && page.parentNode !== null) {
        this.whisperPlaceholder = document.createComment("entrance-scene-whisper-placeholder");
        page.parentNode.insertBefore(this.whisperPlaceholder, page);
      }
      this.viewSlot.appendChild(page);
    }

    page.dataset["sceneEmbedded"] = "true";
    page.classList.remove("is-hidden");
    page.hidden = false;
    if (!wasEmbedded) {
      document.dispatchEvent(
        new CustomEvent<SceneToolEventDetail>(SCENE_TOOL_HOST_SHOW_EVENT, {
          detail: { tool: "whisper" },
        })
      );
    }
  }

  private restoreWhisperPage(): void {
    const page = document.getElementById("page-whisper");
    if (!(page instanceof HTMLElement)) {
      return;
    }

    const wasEmbedded = page.dataset["sceneEmbedded"] === "true";
    if (
      this.whisperPlaceholder?.parentNode !== null &&
      this.whisperPlaceholder?.parentNode !== undefined
    ) {
      this.whisperPlaceholder.parentNode.insertBefore(page, this.whisperPlaceholder.nextSibling);
    }

    if (wasEmbedded) {
      delete page.dataset["sceneEmbedded"];
      document.dispatchEvent(
        new CustomEvent<SceneToolEventDetail>(SCENE_TOOL_HOST_HIDE_EVENT, {
          detail: { tool: "whisper" },
        })
      );
    }

    page.classList.add("is-hidden");
    page.hidden = true;
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
