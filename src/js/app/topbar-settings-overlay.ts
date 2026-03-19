import { AppState } from "../modules/app-state.js";
import { AppI18n } from "../modules/i18n/index.js";
import { shellT } from "./shell-i18n.js";
import {
  EntranceSceneEditor,
  type EntranceSceneEditorSelection,
} from "../pages/entrance/scene/scene-editor.js";
import { resolveSceneAvatarSource } from "../pages/entrance/scene/scene-avatar.js";
import { applySceneDebugFlag } from "../pages/entrance/scene/scene-debug.js";
import {
  getSceneHotspotLabelId,
  getSceneNodeKindForHotspot,
  hasSceneHotspotLabel,
  isSceneDebugSelectionForCharacter,
  isSceneDebugSelectionForHotspot,
  type EntranceSceneHotspotConfig,
  type EntranceSceneMap,
} from "../pages/entrance/scene/scene-map.js";
import { createSceneDebugStore } from "../scene/debug-store.js";
import {
  getActiveSceneDebugRoomId,
  isSceneDebugRoomId,
  SCENE_DEBUG_ROOMS,
  setActiveSceneDebugRoomId,
} from "../scene/scene-debug-rooms.js";
import { SceneAlphaWindowFrameController } from "../scene/alpha-window.js";
import { bindSceneBackZones } from "../scene/back-zone.js";
import { getCoverSceneProjection } from "../scene/projection.js";
import { syncSceneViewRuntime } from "../scene/runtime.js";
import {
  getSceneCharacterRoleConfig,
  getSceneRoomBackgroundSrc,
  getSceneRoomPanelSrc,
} from "../scene/theme-pack.js";
import { isSceneUiMode } from "../ui/ui-mode.js";
import { syncOverlayScrollLock } from "./overlay-scroll-lock.js";

const SETTINGS_PANELS = ["theme", "accounts", "backup", "rooms", "live-log"] as const;
const SETTINGS_SCENE_HOTSPOT_SELECTORS = {
  "door-close": "#settings-scene-door-hotspot",
  "panel-theme": '[data-settings-scene-panel="theme"]',
  "panel-accounts": '[data-settings-scene-panel="accounts"]',
  "panel-backup": '[data-settings-scene-panel="backup"]',
  "panel-rooms": '[data-settings-scene-panel="rooms"]',
  "panel-live-log": '[data-settings-scene-panel="live-log"]',
} as const;

type SettingsPanelId = (typeof SETTINGS_PANELS)[number];
type SettingsSceneHotspotId = keyof typeof SETTINGS_SCENE_HOTSPOT_SELECTORS;
type SettingsPanelHotspotId = Exclude<SettingsSceneHotspotId, "door-close">;

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

function isSettingsSceneHotspotId(value: string): value is SettingsSceneHotspotId {
  return value in SETTINGS_SCENE_HOTSPOT_SELECTORS;
}

function toSettingsPanelHotspotId(panelId: SettingsPanelId): SettingsPanelHotspotId {
  return `panel-${panelId}` as SettingsPanelHotspotId;
}

function resolveSettingsPanelId(value: string | null | undefined): SettingsPanelId | null {
  return value !== null && value !== undefined && isSettingsPanelId(value) ? value : null;
}

function getFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = value?.trim() ?? "";
    if (normalized !== "") {
      return normalized;
    }
  }

  return null;
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
    if (panelOpen) {
      this.alphaFrameController.refresh();
    }
    this.syncActiveDebugRoom(true);
    this.renderHotspots();
    void this.renderCharacter();
    this.editor?.refresh();
  }

  private bindSceneEvents(): void {
    this.getHotspotElement("door-close")?.addEventListener("click", () => {
      this.handleHotspotInteraction("door-close");
    });

    SETTINGS_PANELS.forEach((panelId) => {
      const element = this.getHotspotElement(toSettingsPanelHotspotId(panelId));
      element?.addEventListener("click", () => {
        this.handleHotspotInteraction(`panel-${panelId}`);
      });
    });

    bindSceneBackZones(this.root, () => {
      this.onReturnToRoom();
    });
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
        document.dispatchEvent(
          new CustomEvent("navigate-page", {
            detail: { page: roomId },
          })
        );
      },
      updateHotspot: (id, updater): void => {
        this.sceneMap.hotspots = this.sceneMap.hotspots.map((hotspot) =>
          hotspot.id === id ? updater(hotspot) : hotspot
        );
        this.persistSceneMapDraft();
        this.renderHotspots();
        this.editor?.refresh();
      },
      updateLabelNode: (id, updater): void => {
        this.sceneMap.hotspots = this.sceneMap.hotspots.map((hotspot) =>
          getSceneHotspotLabelId(hotspot.id) === id ? updater(hotspot) : hotspot
        );
        this.persistSceneMapDraft();
        this.renderHotspots();
        this.editor?.refresh();
      },
      updateCharacterAnchor: (id, updater): void => {
        this.sceneMap.characterAnchors = this.sceneMap.characterAnchors.map((anchor) =>
          anchor.id === id ? updater(anchor) : anchor
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

  private resolveHotspot(hotspotId: string): EntranceSceneHotspotConfig | null {
    return this.sceneMap.hotspots.find((hotspot) => hotspot.id === hotspotId) ?? null;
  }

  private resolveHotspotLabel(hotspot: EntranceSceneHotspotConfig): string {
    const customLabel =
      typeof hotspot.labelCustomText === "string" ? hotspot.labelCustomText.trim() : "";
    if (customLabel !== "") {
      return customLabel;
    }

    if (hotspot.labelKey !== "") {
      return shellT(hotspot.labelKey);
    }

    return hotspot.id;
  }

  private getHotspotElement(hotspotId: string): HTMLButtonElement | null {
    if (!isSettingsSceneHotspotId(hotspotId)) {
      return null;
    }

    const element = this.root.querySelector(SETTINGS_SCENE_HOTSPOT_SELECTORS[hotspotId]);
    return element instanceof HTMLButtonElement ? element : null;
  }

  private renderHotspots(): void {
    const projection = this.getSceneProjection();

    this.sceneMap.hotspots.forEach((hotspot) => {
      const button = this.getHotspotElement(hotspot.id);
      if (button === null) {
        return;
      }

      const labelText = this.resolveHotspotLabel(hotspot);
      const showLabel = hasSceneHotspotLabel(hotspot);
      const selected = isSceneDebugSelectionForHotspot(this.editorSelection, hotspot);
      const label = button.querySelector<HTMLElement>(".settings-scene__hotspot-label");

      button.dataset["hotspotId"] = hotspot.id;
      button.classList.toggle("is-selected", selected);
      button.style.left = `${projection.offsetX + hotspot.leftPx * projection.scale}px`;
      button.style.top = `${projection.offsetY + hotspot.topPx * projection.scale}px`;
      button.style.width = `${hotspot.widthPx * projection.scale}px`;
      button.style.height = `${hotspot.heightPx * projection.scale}px`;
      button.ariaLabel = labelText;

      if (label !== null) {
        label.textContent = showLabel ? labelText : "";
        label.hidden = !showLabel;
        label.classList.toggle("is-selected", selected);
      }
    });
  }

  private handleHotspotInteraction(hotspotId: string): void {
    const hotspot = this.resolveHotspot(hotspotId);
    if (hotspot === null) {
      return;
    }

    if (this.isEditorActive()) {
      this.editorSelection = {
        kind: getSceneNodeKindForHotspot(hotspot),
        id: hotspot.id,
      };
      this.editor?.refresh();
      this.renderHotspots();
      return;
    }

    this.handleHotspotAction(hotspot);
  }

  private handleHotspotAction(hotspot: EntranceSceneHotspotConfig): void {
    if (hotspot.action.type === "settings-scene-close") {
      this.onClose();
      return;
    }

    if (hotspot.action.type === "settings") {
      if (hotspot.action.panel === null) {
        this.onReturnToRoom();
        return;
      }

      this.onOpenPanel(hotspot.action.panel);
      return;
    }
  }

  private persistSceneMapDraft(): void {
    SETTINGS_SCENE_DEBUG_STORE.saveDraft(this.sceneMap);
  }

  private async renderCharacter(): Promise<void> {
    if (!this.state.open || !isSceneUiMode()) {
      return;
    }

    const anchor = this.sceneMap.characterAnchors.find((item) => item.id === "anchor-user") ?? null;
    if (anchor === null) {
      this.characterLayer.replaceChildren();
      return;
    }

    const renderToken = ++this.characterRenderToken;
    const roleConfig = getSceneCharacterRoleConfig("user");
    const label = AppState.getNickname("user");
    const avatarSource = await resolveSceneAvatarSource(
      getFirstNonEmpty(AppState.getAvatar("user"), "src/assets/user.png", "src/assets/default.png")
    );

    if (renderToken !== this.characterRenderToken) {
      return;
    }

    const projection = this.getSceneProjection();
    const depth = Number.isFinite(anchor.depth) ? Math.max(1, anchor.depth) : 1;
    const sceneCharacter = document.createElement("div");
    sceneCharacter.className = "settings-scene__character entrance-scene__character is-connected";
    sceneCharacter.dataset["characterId"] = "scene-user";
    sceneCharacter.dataset["anchorId"] = anchor.id;
    sceneCharacter.dataset["kind"] = "user";
    sceneCharacter.dataset["role"] = "user";
    sceneCharacter.classList.toggle(
      "is-selected",
      isSceneDebugSelectionForCharacter(this.editorSelection, anchor)
    );
    sceneCharacter.style.setProperty(
      "--scene-character-left",
      `${projection.offsetX + anchor.leftPx * projection.scale}px`
    );
    sceneCharacter.style.setProperty(
      "--scene-character-bottom",
      `${projection.offsetY + anchor.bottomPx * projection.scale}px`
    );
    sceneCharacter.style.setProperty("--scene-character-scale", String(anchor.scale));
    sceneCharacter.style.setProperty("--scene-character-depth", String(depth));
    sceneCharacter.style.setProperty(
      "--scene-character-depth-scale",
      String(this.getDepthScale(depth))
    );
    sceneCharacter.style.setProperty("--scene-character-body-scale", String(roleConfig.bodyScale));
    sceneCharacter.style.setProperty("--scene-character-head-top", `${roleConfig.headTopPct}%`);
    sceneCharacter.style.setProperty("--scene-character-head-left", `${roleConfig.headLeftPct}%`);
    sceneCharacter.style.setProperty("--scene-character-head-size", `${roleConfig.headSizePct}%`);
    sceneCharacter.style.setProperty(
      "--scene-character-avatar-scale",
      String(roleConfig.avatarScale)
    );

    if (this.isEditorActive()) {
      sceneCharacter.tabIndex = 0;
      sceneCharacter.role = "button";
      sceneCharacter.setAttribute("aria-label", label);
    } else {
      sceneCharacter.tabIndex = -1;
      sceneCharacter.removeAttribute("role");
      sceneCharacter.removeAttribute("aria-label");
    }

    const stage = document.createElement("div");
    stage.className = "entrance-scene__character-stage";

    const body = document.createElement("img");
    body.className = "entrance-scene__character-body";
    body.src = roleConfig.bodySrc;
    body.alt = "";
    body.ariaHidden = "true";
    stage.appendChild(body);

    const head = document.createElement("span");
    head.className = "entrance-scene__character-head";
    head.ariaHidden = "true";
    if (avatarSource !== null) {
      const avatar = document.createElement("img");
      avatar.className = "entrance-scene__character-avatar";
      avatar.src = avatarSource;
      avatar.alt = "";
      avatar.ariaHidden = "true";
      head.appendChild(avatar);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "entrance-scene__character-head-fallback";
      fallback.ariaHidden = "true";
      fallback.textContent = toHeadLabel(label);
      head.appendChild(fallback);
    }
    stage.appendChild(head);

    const characterLabel = document.createElement("span");
    characterLabel.className = "entrance-scene__character-label";
    characterLabel.textContent = label;

    const anchorMarker = document.createElement("span");
    anchorMarker.className = "entrance-scene__character-anchor-marker";
    anchorMarker.ariaHidden = String(!this.sceneDebugEnabled);
    anchorMarker.textContent = anchor.id;

    sceneCharacter.append(stage, characterLabel, anchorMarker);
    sceneCharacter.addEventListener("click", () => {
      if (!this.isEditorActive()) {
        return;
      }

      this.editorSelection = { kind: "character", id: anchor.id };
      this.editor?.refresh();
      void this.renderCharacter();
    });
    sceneCharacter.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      if (!this.isEditorActive()) {
        return;
      }

      this.editorSelection = { kind: "character", id: anchor.id };
      this.editor?.refresh();
      void this.renderCharacter();
    });
    this.characterLayer.replaceChildren(sceneCharacter);
  }
}

export function setupSettingsHub(): void {
  const overlay = document.getElementById("settings-hub-overlay");
  const backdrop = document.getElementById("settings-hub-backdrop");
  const openButton = document.getElementById("topbar-settings-open");
  const closeButton = document.getElementById("settings-hub-close");
  const classicLayout = overlay?.querySelector<HTMLElement>(".settings-hub-layout") ?? null;
  const panelsContainer = overlay?.querySelector<HTMLElement>(".settings-hub-panels") ?? null;
  const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".settings-hub-tab"));
  const panels = Array.from(document.querySelectorAll<HTMLElement>(".settings-hub-panel"));
  const sceneRoot = document.getElementById("settings-scene-root");
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
    overlay == null ||
    backdrop == null ||
    openButton == null ||
    closeButton == null ||
    classicLayout == null ||
    panelsContainer == null ||
    tabButtons.length === 0 ||
    panels.length === 0 ||
    sceneRoot == null ||
    sceneEditorHost == null ||
    sceneRoomView == null ||
    scenePanelView == null ||
    scenePanelSlot == null ||
    sceneBackground == null ||
    scenePanelArt == null ||
    sceneCharacters == null
  ) {
    return;
  }

  let isOpen = false;
  let activePanel: SettingsPanelId = "theme";
  let visiblePanel: SettingsPanelId | null = null;

  const sceneController = new SettingsSceneController({
    overlay,
    root: sceneRoot,
    editorHost: sceneEditorHost,
    classicLayout,
    panelsContainer,
    roomView: sceneRoomView,
    panelView: scenePanelView,
    panelSlot: scenePanelSlot,
    background: sceneBackground,
    panelArt: scenePanelArt,
    characterLayer: sceneCharacters,
    onClose: (): void => {
      close();
    },
    onOpenPanel: (panelId: SettingsPanelId): void => {
      selectPanel(panelId);
    },
    onReturnToRoom: (): void => {
      showRoom();
    },
  });

  const syncActivePanelUi = (): void => {
    tabButtons.forEach((button) => {
      const panelId = resolveSettingsPanelId(button.dataset["settingsPanel"]);
      const isActive = panelId !== null && panelId === visiblePanel;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach((panel) => {
      const panelId = resolveSettingsPanelId(panel.dataset["settingsPanel"]);
      const isActive = panelId !== null && panelId === visiblePanel;
      panel.classList.toggle("is-active", isActive);
      panel.classList.toggle("is-hidden", !isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
      panel.toggleAttribute("hidden", !isActive);
    });
  };

  const syncSceneUi = (): void => {
    sceneController.sync({ open: isOpen, activePanel: visiblePanel });
  };

  const emitState = (): void => {
    dispatchSettingsHubState({ open: isOpen, activePanel: visiblePanel });
  };

  const showRoom = (): void => {
    visiblePanel = null;
    syncActivePanelUi();
    syncSceneUi();
    if (isOpen) {
      emitState();
    }
  };

  const open = (requestedPanel: SettingsPanelId | null): void => {
    isOpen = true;
    visiblePanel = isSceneUiMode() ? requestedPanel : (requestedPanel ?? activePanel);
    if (visiblePanel !== null) {
      activePanel = visiblePanel;
    }

    overlay.classList.remove("is-hidden");
    overlay.setAttribute("aria-hidden", "false");
    syncOverlayScrollLock();
    syncActivePanelUi();
    syncSceneUi();
    emitState();
  };

  const close = (): void => {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    visiblePanel = null;
    overlay.classList.add("is-hidden");
    overlay.setAttribute("aria-hidden", "true");
    syncOverlayScrollLock();
    syncActivePanelUi();
    syncSceneUi();
    emitState();
  };

  const selectPanel = (panelId: SettingsPanelId): void => {
    activePanel = panelId;
    visiblePanel = panelId;
    syncActivePanelUi();
    syncSceneUi();

    if (isOpen) {
      emitState();
      return;
    }

    open(panelId);
  };

  sceneController.init();

  openButton.addEventListener("click", () => {
    if (isOpen) {
      close();
      return;
    }

    open(isSceneUiMode() ? null : activePanel);
  });

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const panelId = resolveSettingsPanelId(button.dataset["settingsPanel"]);
      if (panelId !== null) {
        selectPanel(panelId);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      close();
    }
  });

  document.addEventListener("settings-hub:open", ((
    event: CustomEvent<{ panel?: string | null } | undefined>
  ) => {
    const requestedPanel = resolveSettingsPanelId(event.detail?.panel);
    open(isSceneUiMode() ? requestedPanel : (requestedPanel ?? activePanel));
  }) as EventListener);

  document.addEventListener("settings-hub:close", () => {
    close();
  });

  syncActivePanelUi();
  syncSceneUi();
}
