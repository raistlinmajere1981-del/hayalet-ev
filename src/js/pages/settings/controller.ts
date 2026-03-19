import { AppState } from "../../modules/app-state.js";
import { AppI18n } from "../../modules/i18n/index.js";
import { shellT } from "../../app/shell-i18n.js";
import { closeExternalPage, navigateMainShellPage } from "../shared/external-page.js";
import { dispatchSceneAction } from "../../scene/action-dispatcher.js";
import {
  EntranceSceneEditor,
  type EntranceSceneEditorSelection,
} from "../entrance/scene/scene-editor.js";
import { resolveSceneAvatarSource } from "../entrance/scene/scene-avatar.js";
import { applySceneDebugFlag } from "../entrance/scene/scene-debug.js";
import { buildSceneCharacterRoster } from "../entrance/scene/scene-character-roster.js";
import {
  getSceneBackNodeForView,
  getSceneInteractiveNodesForView,
  resolveSceneNodeLabelText,
  type EntranceSceneMap,
} from "../entrance/scene/scene-map.js";
import { createSceneDebugStore } from "../../scene/debug-store.js";
import {
  getActiveSceneDebugRoomId,
  isSceneDebugRoomId,
  SCENE_DEBUG_ROOMS,
  setActiveSceneDebugRoomId,
} from "../../scene/scene-debug-rooms.js";
import { SceneAlphaWindowFrameController } from "../../scene/alpha-window.js";
import { getCoverSceneProjection } from "../../scene/projection.js";
import { renderSceneBackLayer } from "../../scene/renderers/back-layer.js";
import { renderSceneCharacterLayer } from "../../scene/renderers/character-layer.js";
import { renderSceneInteractiveLayer } from "../../scene/renderers/interactive-layer.js";
import { syncSceneViewRuntime } from "../../scene/runtime.js";
import { getSceneRoomBackgroundSrc, getSceneRoomPanelSrc } from "../../scene/theme-pack.js";
import { isSceneUiMode } from "../../ui/ui-mode.js";

const SETTINGS_PANELS = ["theme", "accounts", "backup", "rooms", "live-log"] as const;

type SettingsPanelId = (typeof SETTINGS_PANELS)[number];

interface SettingsHubState {
  open: boolean;
  activePanel: SettingsPanelId | null;
}

interface SettingsSceneState {
  open: boolean;
  activePanel: SettingsPanelId | null;
}

interface SettingsSceneControllerDeps {
  overlay: HTMLElement;
  root: HTMLElement;
  hotspotLayer: HTMLElement;
  editorHost: HTMLElement;
  classicLayout: HTMLElement;
  panelsContainer: HTMLElement;
  roomView: HTMLElement;
  panelView: HTMLElement;
  panelSlot: HTMLElement;
  background: HTMLImageElement;
  panelArt: HTMLImageElement;
  characterLayer: HTMLElement;
  onClose: () => void;
  onOpenPanel: (panelId: SettingsPanelId) => void;
  onReturnToRoom: () => void;
}

function isSettingsPanelId(value: string): value is SettingsPanelId {
  return SETTINGS_PANELS.includes(value as SettingsPanelId);
}

export function resolveSettingsPanelId(value: string | null | undefined): SettingsPanelId | null {
  return value !== null && value !== undefined && isSettingsPanelId(value) ? value : null;
}

function toHeadLabel(label: string): string {
  const compact = label.replace(/\s+/g, "").trim().toUpperCase();
  const head = compact.slice(0, 2);
  return head === "" ? "?" : head;
}

function dispatchSettingsHubState(state: SettingsHubState): void {
  document.dispatchEvent(
    new CustomEvent<SettingsHubState>("settings-hub:state-change", {
      detail: state,
    })
  );
}

const SETTINGS_SCENE_DEBUG_STORE = createSceneDebugStore("settings");

class SettingsSceneController {
  private overlay: HTMLElement;
  private root: HTMLElement;
  private hotspotLayer: HTMLElement;
  private editorHost: HTMLElement;
  private classicLayout: HTMLElement;
  private panelsContainer: HTMLElement;
  private roomView: HTMLElement;
  private panelView: HTMLElement;
  private panelSlot: HTMLElement;
  private background: HTMLImageElement;
  private panelArt: HTMLImageElement;
  private characterLayer: HTMLElement;
  private alphaFrameController: SceneAlphaWindowFrameController;
  private onClose: () => void;
  private onOpenPanel: (panelId: SettingsPanelId) => void;
  private onReturnToRoom: () => void;
  private state: SettingsSceneState = { open: false, activePanel: null };
  private panelsPlaceholder: Comment | null = null;
  private sceneMap: EntranceSceneMap = SETTINGS_SCENE_DEBUG_STORE.cloneDefault();
  private sceneDebugEnabled = false;
  private editorSelection: EntranceSceneEditorSelection = null;
  private editor: EntranceSceneEditor | null = null;
  private characterRenderToken = 0;

  constructor(deps: SettingsSceneControllerDeps) {
    this.overlay = deps.overlay;
    this.root = deps.root;
    this.hotspotLayer = deps.hotspotLayer;
    this.editorHost = deps.editorHost;
    this.classicLayout = deps.classicLayout;
    this.panelsContainer = deps.panelsContainer;
    this.roomView = deps.roomView;
    this.panelView = deps.panelView;
    this.panelSlot = deps.panelSlot;
    this.background = deps.background;
    this.panelArt = deps.panelArt;
    this.characterLayer = deps.characterLayer;
    this.alphaFrameController = new SceneAlphaWindowFrameController({
      image: deps.panelArt,
      container: deps.panelView,
      target: deps.panelView,
      variablePrefix: "settings-scene",
    });
    this.onClose = deps.onClose;
    this.onOpenPanel = deps.onOpenPanel;
    this.onReturnToRoom = deps.onReturnToRoom;
  }

  init(): void {
    this.sceneDebugEnabled = applySceneDebugFlag();
    this.sceneMap =
      (this.sceneDebugEnabled ? SETTINGS_SCENE_DEBUG_STORE.loadDraft() : null) ??
      SETTINGS_SCENE_DEBUG_STORE.cloneDefault();
    this.background.src = getSceneRoomBackgroundSrc("settings");
    this.background.alt = "";
    this.bindSceneEvents();
    this.setupEditor();

    AppState.subscribe(() => {
      void this.renderCharacter();
    });
    AppI18n.subscribe(() => {
      this.renderHotspots();
      this.editor?.refresh();
      void this.renderCharacter();
    });
  }

  sync(nextState: SettingsSceneState): void {
    this.state = nextState;

    const sceneActive = nextState.open && isSceneUiMode();
    const panelOpen = sceneActive && nextState.activePanel !== null;

    syncSceneViewRuntime({
      elements: {
        root: this.root,
        roomView: this.roomView,
        view: this.panelView,
        overlay: this.overlay,
        classicLayout: this.classicLayout,
        viewSlot: this.panelSlot,
      },
      state: {
        sceneActive,
        viewOpen: panelOpen,
        viewActiveClass: "is-active",
        overlayActiveClass: "is-scene-mode",
        classicLayoutHiddenClass: "is-hidden",
      },
    });

    if (!sceneActive) {
      this.restorePanelsContainer();
      this.syncActiveDebugRoom(false);
      return;
    }

    this.movePanelsToSceneSlot();
    this.syncPanelArt(nextState.activePanel);
    renderSceneBackLayer({
      host: this.panelView,
      node: panelOpen ? getSceneBackNodeForView(this.sceneMap, "panel") : null,
      projection: this.getSceneProjection(),
      resolveLabel: (node) => resolveSceneNodeLabelText(node, shellT),
      onActivate: () => {
        if (this.isEditorActive()) {
          const back = getSceneBackNodeForView(this.sceneMap, "panel");
          if (back !== null) {
            this.editorSelection = { kind: "back", id: back.id };
            this.editor?.refresh();
          }
          return;
        }

        this.onReturnToRoom();
      },
    });
    if (panelOpen) {
      this.alphaFrameController.refresh();
    }
    this.syncActiveDebugRoom(true);
    this.renderHotspots();
    void this.renderCharacter();
    this.editor?.refresh();
  }

  private bindSceneEvents(): void {
    return;
  }

  private setupEditor(): void {
    if (!this.sceneDebugEnabled) {
      this.editorHost.replaceChildren();
      this.editor = null;
      return;
    }

    this.editor = new EntranceSceneEditor(this.editorHost, {
      isActive: (): boolean => this.isEditorActive(),
      getSceneMap: (): EntranceSceneMap => this.sceneMap,
      getSelection: (): EntranceSceneEditorSelection => this.editorSelection,
      getRoomOptions: (): Array<{ id: string; label: string }> =>
        SCENE_DEBUG_ROOMS.map((room) => ({
          id: room.id,
          label: shellT(room.labelKey),
        })),
      getActiveRoomId: (): string => "settings",
      setSelection: (selection): void => {
        this.editorSelection = selection;
        this.editor?.refresh();
        this.renderHotspots();
        void this.renderCharacter();
      },
      navigateToRoom: (roomId: string): void => {
        if (roomId === "settings") {
          this.onReturnToRoom();
          return;
        }

        this.onClose();
        navigateMainShellPage(roomId);
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
        this.sync(this.state);
        this.renderHotspots();
        this.editor?.refresh();
      },
      updateCharacter: (id, updater): void => {
        this.sceneMap.characters = this.sceneMap.characters.map((character) =>
          character.id === id ? updater(character) : character
        );
        this.persistSceneMapDraft();
        void this.renderCharacter();
        this.editor?.refresh();
      },
      resetDraft: (): void => {
        this.sceneMap = SETTINGS_SCENE_DEBUG_STORE.cloneDefault();
        SETTINGS_SCENE_DEBUG_STORE.clearDraft();
        this.editorSelection = null;
        this.renderHotspots();
        void this.renderCharacter();
        this.editor?.refresh();
      },
      copySceneMap: async (): Promise<void> => {
        try {
          await SETTINGS_SCENE_DEBUG_STORE.copyToClipboard(this.sceneMap);
        } catch {
          console.info("Settings scene map copy failed.");
        }
      },
    });
    this.editor.refresh();
  }

  private movePanelsToSceneSlot(): void {
    if (this.panelsContainer.parentElement === this.panelSlot) {
      return;
    }

    if (this.panelsPlaceholder === null && this.panelsContainer.parentNode !== null) {
      this.panelsPlaceholder = document.createComment("settings-hub-panels-placeholder");
      this.panelsContainer.parentNode.insertBefore(this.panelsPlaceholder, this.panelsContainer);
    }

    this.panelSlot.appendChild(this.panelsContainer);
  }

  private restorePanelsContainer(): void {
    if (
      this.panelsPlaceholder?.parentNode === null ||
      this.panelsPlaceholder?.parentNode === undefined
    ) {
      return;
    }

    this.panelsPlaceholder.parentNode.insertBefore(
      this.panelsContainer,
      this.panelsPlaceholder.nextSibling
    );
  }

  private syncPanelArt(panelId: SettingsPanelId | null): void {
    if (panelId === null) {
      this.panelArt.removeAttribute("src");
      this.panelArt.alt = "";
      delete this.panelSlot.dataset["settingsPanel"];
      this.alphaFrameController.clear();
      return;
    }

    this.panelArt.src = getSceneRoomPanelSrc("settings", panelId) ?? "";
    this.panelArt.alt = "";
    this.panelSlot.dataset["settingsPanel"] = panelId;
    this.alphaFrameController.refresh();
  }

  private syncActiveDebugRoom(sceneActive: boolean): void {
    if (!this.sceneDebugEnabled) {
      return;
    }

    if (sceneActive) {
      setActiveSceneDebugRoomId("settings");
      return;
    }

    const currentPage = document.documentElement.getAttribute("data-active-page");
    if (currentPage !== "settings" && isSceneDebugRoomId(currentPage)) {
      setActiveSceneDebugRoomId(currentPage);
      return;
    }

    setActiveSceneDebugRoomId(null);
  }

  private isEditorActive(): boolean {
    return (
      this.sceneDebugEnabled &&
      this.state.open &&
      isSceneUiMode() &&
      (getActiveSceneDebugRoomId() ?? document.documentElement.getAttribute("data-active-page")) ===
        "settings"
    );
  }

  private getSceneProjection(): {
    offsetX: number;
    offsetY: number;
    scale: number;
  } {
    const surfaceWidth = this.root.clientWidth;
    const surfaceHeight = this.root.clientHeight;
    return getCoverSceneProjection({
      surfaceWidth,
      surfaceHeight,
      referenceWidth: this.sceneMap.referenceSize.width,
      referenceHeight: this.sceneMap.referenceSize.height,
    });
  }

  private getDepthScale(depth: number): number {
    const normalizedDepth = Math.max(1, Number.isFinite(depth) ? depth : 1);
    const scaled = 1 - (normalizedDepth - 1) * 0.02;
    return Number(Math.max(0.75, scaled).toFixed(3));
  }

  private renderHotspots(): void {
    renderSceneInteractiveLayer({
      layer: this.hotspotLayer,
      nodes: getSceneInteractiveNodesForView(this.sceneMap),
      projection: this.getSceneProjection(),
      cssVarPrefix: "settings-scene-hotspot",
      classNames: {
        item: "settings-scene__hotspot-item",
        button: "settings-scene__hotspot",
        label: "settings-scene__hotspot-label",
      },
      selection: this.editorSelection,
      resolveLabel: (node) => resolveSceneNodeLabelText(node, shellT),
      onActivate: (node) => {
        this.handleInteractive(node.id);
      },
    });
  }

  private handleInteractive(id: string): void {
    const interactive = this.sceneMap.interactives.find((node) => node.id === id) ?? null;
    if (interactive === null) {
      return;
    }

    if (this.isEditorActive()) {
      this.editorSelection = { kind: "interactive", id: interactive.id };
      this.editor?.refresh();
      this.renderHotspots();
      return;
    }

    dispatchSceneAction(interactive.action, {
      onNavigate: (page) => {
        this.onClose();
        navigateMainShellPage(page);
      },
      onSettings: (action) => {
        if (action.panel === null) {
          this.onReturnToRoom();
          return;
        }

        this.onOpenPanel(action.panel);
      },
      onSettingsSceneClose: () => {
        this.onClose();
      },
      onScreen: () => {},
      onWhisper: () => {},
      onBack: () => {
        this.onReturnToRoom();
      },
    });
  }

  private persistSceneMapDraft(): void {
    SETTINGS_SCENE_DEBUG_STORE.saveDraft(this.sceneMap);
  }

  private async renderCharacter(): Promise<void> {
    if (!this.state.open || !isSceneUiMode()) {
      return;
    }

    const characters = buildSceneCharacterRoster(
      this.sceneMap.characters,
      this.sceneMap.characterRosterPreset
    );
    if (characters.length === 0) {
      this.characterLayer.replaceChildren();
      return;
    }

    const renderToken = ++this.characterRenderToken;
    await renderSceneCharacterLayer({
      layer: this.characterLayer,
      characters,
      projection: this.getSceneProjection(),
      sceneDebugEnabled: this.sceneDebugEnabled,
      interactive: this.isEditorActive(),
      selectedCharacterId:
        this.editorSelection?.kind === "character" ? this.editorSelection.id : null,
      isStale: () => renderToken !== this.characterRenderToken,
      getDepthScale: (depth) => this.getDepthScale(depth),
      resolveAvatarSource: async (character) => {
        return await resolveSceneAvatarSource(character.avatarSource);
      },
      getNodeClassName: (character) =>
        `settings-scene__character entrance-scene__character is-${character.state}`,
      getFallbackHeadLabel: (character) => character.headLabel ?? toHeadLabel(character.label),
      onActivate: (character) => {
        if (!this.isEditorActive()) {
          return;
        }

        this.editorSelection = { kind: "character", id: character.anchorId };
        this.editor?.refresh();
        void this.renderCharacter();
      },
    });
  }
}

export class SettingsPageController {
  private page: HTMLElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private classicLayout: HTMLElement | null = null;
  private panelsContainer: HTMLElement | null = null;
  private tabButtons: HTMLButtonElement[] = [];
  private panels: HTMLElement[] = [];
  private sceneController: SettingsSceneController | null = null;
  private isOpen = false;
  private activePanel: SettingsPanelId = "theme";
  private visiblePanel: SettingsPanelId | null = null;
  private initialized = false;

  init(): void {
    if (this.initialized) {
      return;
    }

    this.page = document.getElementById("page-settings");
    this.closeButton = document.getElementById("settings-hub-close") as HTMLButtonElement | null;
    this.classicLayout = this.page?.querySelector<HTMLElement>(".settings-hub-layout") ?? null;
    this.panelsContainer = this.page?.querySelector<HTMLElement>(".settings-hub-panels") ?? null;
    this.tabButtons = Array.from(
      this.page?.querySelectorAll<HTMLButtonElement>(".settings-hub-tab") ?? []
    );
    this.panels = Array.from(this.page?.querySelectorAll<HTMLElement>(".settings-hub-panel") ?? []);
    const sceneRoot = document.getElementById("settings-scene-root");
    const sceneHotspots = document.getElementById("settings-scene-hotspots");
    const sceneEditorHost = document.getElementById("settings-scene-editor-host");
    const sceneRoomView = document.getElementById("settings-scene-room-view");
    const scenePanelView = document.getElementById("settings-scene-panel-view");
    const scenePanelSlot = document.getElementById("settings-scene-panel-slot");
    const sceneBackground = document.getElementById(
      "settings-scene-background"
    ) as HTMLImageElement | null;
    const scenePanelArt = document.getElementById(
      "settings-scene-panel-art"
    ) as HTMLImageElement | null;
    const sceneCharacters = document.getElementById("settings-scene-characters");

    if (
      this.page === null ||
      this.closeButton === null ||
      this.classicLayout === null ||
      this.panelsContainer === null ||
      this.tabButtons.length === 0 ||
      this.panels.length === 0 ||
      sceneRoot === null ||
      sceneHotspots === null ||
      sceneEditorHost === null ||
      sceneRoomView === null ||
      scenePanelView === null ||
      scenePanelSlot === null ||
      sceneBackground === null ||
      scenePanelArt === null ||
      sceneCharacters === null
    ) {
      return;
    }

    this.sceneController = new SettingsSceneController({
      overlay: this.page,
      root: sceneRoot,
      hotspotLayer: sceneHotspots,
      editorHost: sceneEditorHost,
      classicLayout: this.classicLayout,
      panelsContainer: this.panelsContainer,
      roomView: sceneRoomView,
      panelView: scenePanelView,
      panelSlot: scenePanelSlot,
      background: sceneBackground,
      panelArt: scenePanelArt,
      characterLayer: sceneCharacters,
      onClose: (): void => {
        this.close();
      },
      onOpenPanel: (panelId: SettingsPanelId): void => {
        this.selectPanel(panelId);
      },
      onReturnToRoom: (): void => {
        this.showRoom();
      },
    });
    this.sceneController.init();

    this.closeButton.addEventListener("click", () => {
      this.close();
    });

    this.tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const panelId = resolveSettingsPanelId(button.dataset["settingsPanel"]);
        if (panelId !== null) {
          this.selectPanel(panelId);
        }
      });
    });

    document.addEventListener("settings-hub:open", ((
      event: CustomEvent<{ panel?: string | null } | undefined>
    ) => {
      const requestedPanel = resolveSettingsPanelId(event.detail?.panel);
      this.open(isSceneUiMode() ? requestedPanel : (requestedPanel ?? this.activePanel));
    }) as EventListener);

    document.addEventListener("settings-hub:close", () => {
      this.close();
    });

    this.initialized = true;
    this.syncActivePanelUi();
    this.syncSceneUi();
  }

  show(requestedPanel: SettingsPanelId | null = null): void {
    this.isOpen = true;
    this.visiblePanel = isSceneUiMode() ? requestedPanel : (requestedPanel ?? this.activePanel);
    if (this.visiblePanel !== null) {
      this.activePanel = this.visiblePanel;
    }
    document.documentElement.setAttribute("data-active-page", "settings");
    this.syncActivePanelUi();
    this.syncSceneUi();
    this.emitState();
  }

  onShow(): void {
    this.show(this.activePanel);
  }

  hide(): void {
    this.isOpen = false;
    this.visiblePanel = null;
    document.documentElement.removeAttribute("data-active-page");
    this.syncActivePanelUi();
    this.syncSceneUi();
    this.emitState();
  }

  onHide(): void {
    this.hide();
  }

  private syncActivePanelUi(): void {
    this.tabButtons.forEach((button) => {
      const panelId = resolveSettingsPanelId(button.dataset["settingsPanel"]);
      const isActive = panelId !== null && panelId === this.visiblePanel;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    this.panels.forEach((panel) => {
      const panelId = resolveSettingsPanelId(panel.dataset["settingsPanel"]);
      const isActive = panelId !== null && panelId === this.visiblePanel;
      panel.classList.toggle("is-active", isActive);
      panel.classList.toggle("is-hidden", !isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
      panel.toggleAttribute("hidden", !isActive);
    });
  }

  private syncSceneUi(): void {
    this.sceneController?.sync({ open: this.isOpen, activePanel: this.visiblePanel });
  }

  private emitState(): void {
    dispatchSettingsHubState({ open: this.isOpen, activePanel: this.visiblePanel });
  }

  private showRoom(): void {
    this.visiblePanel = null;
    this.syncActivePanelUi();
    this.syncSceneUi();
    if (this.isOpen) {
      this.emitState();
    }
  }

  private open(requestedPanel: SettingsPanelId | null): void {
    this.show(requestedPanel);
  }

  private close(): void {
    closeExternalPage();
  }

  private selectPanel(panelId: SettingsPanelId): void {
    this.activePanel = panelId;
    this.visiblePanel = panelId;
    this.syncActivePanelUi();
    this.syncSceneUi();
    if (this.isOpen) {
      this.emitState();
      return;
    }

    this.open(panelId);
  }
}
