import { AppState } from "../modules/app-state.js";
import { AppI18n } from "../modules/i18n/index.js";
import { resolveSceneAvatarSource } from "../pages/entrance/scene/scene-avatar.js";
import { getSceneCharacterRoleConfig, SCENE_THEME_CONFIG } from "../scene/scene-config.js";
import { isSceneUiMode } from "../ui/ui-mode.js";

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

class SettingsSceneController {
  private overlay: HTMLElement;
  private root: HTMLElement;
  private classicLayout: HTMLElement;
  private panelsContainer: HTMLElement;
  private roomView: HTMLElement;
  private panelView: HTMLElement;
  private panelSlot: HTMLElement;
  private background: HTMLImageElement;
  private panelArt: HTMLImageElement;
  private characterLayer: HTMLElement;
  private onClose: () => void;
  private onOpenPanel: (panelId: SettingsPanelId) => void;
  private onReturnToRoom: () => void;
  private state: SettingsSceneState = { open: false, activePanel: null };
  private panelsPlaceholder: Comment | null = null;
  private characterRenderToken = 0;

  constructor(deps: SettingsSceneControllerDeps) {
    this.overlay = deps.overlay;
    this.root = deps.root;
    this.classicLayout = deps.classicLayout;
    this.panelsContainer = deps.panelsContainer;
    this.roomView = deps.roomView;
    this.panelView = deps.panelView;
    this.panelSlot = deps.panelSlot;
    this.background = deps.background;
    this.panelArt = deps.panelArt;
    this.characterLayer = deps.characterLayer;
    this.onClose = deps.onClose;
    this.onOpenPanel = deps.onOpenPanel;
    this.onReturnToRoom = deps.onReturnToRoom;
  }

  init(): void {
    this.background.src = SCENE_THEME_CONFIG.settings.backgroundSrc;
    this.background.alt = "";
    this.bindSceneEvents();

    AppState.subscribe(() => {
      void this.renderCharacter();
    });
    AppI18n.subscribe(() => {
      void this.renderCharacter();
    });
  }

  sync(nextState: SettingsSceneState): void {
    this.state = nextState;

    const sceneActive = nextState.open && isSceneUiMode();
    const panelOpen = sceneActive && nextState.activePanel !== null;

    this.overlay.classList.toggle("is-scene-mode", sceneActive);
    this.root.hidden = !sceneActive;
    this.root.setAttribute("aria-hidden", String(!sceneActive));
    this.classicLayout.classList.toggle("is-hidden", sceneActive);
    this.roomView.hidden = !sceneActive || panelOpen;
    this.roomView.setAttribute("aria-hidden", String(!sceneActive || panelOpen));
    this.panelView.classList.toggle("is-active", panelOpen);
    this.panelView.setAttribute("aria-hidden", String(!panelOpen));
    this.panelSlot.toggleAttribute("hidden", !panelOpen);

    if (!sceneActive) {
      this.restorePanelsContainer();
      return;
    }

    this.movePanelsToSceneSlot();
    this.syncPanelArt(nextState.activePanel);
    void this.renderCharacter();
  }

  private bindSceneEvents(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-settings-scene-panel]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const panelId = resolveSettingsPanelId(button.dataset["settingsScenePanel"]);
          if (panelId !== null) {
            this.onOpenPanel(panelId);
          }
        });
      });

    document.getElementById("settings-scene-door-hotspot")?.addEventListener("click", () => {
      this.onClose();
    });

    document.getElementById("settings-scene-exit-left")?.addEventListener("click", () => {
      this.onReturnToRoom();
    });

    document.getElementById("settings-scene-exit-right")?.addEventListener("click", () => {
      this.onReturnToRoom();
    });
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
      return;
    }

    this.panelArt.src = SCENE_THEME_CONFIG.settings.panels[panelId];
    this.panelArt.alt = "";
    this.panelSlot.dataset["settingsPanel"] = panelId;
  }

  private async renderCharacter(): Promise<void> {
    if (!this.state.open || !isSceneUiMode()) {
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

    const sceneCharacter = document.createElement("div");
    sceneCharacter.className = "settings-scene__character entrance-scene__character";
    sceneCharacter.dataset["kind"] = "user";
    sceneCharacter.dataset["role"] = "user";
    sceneCharacter.style.setProperty("--scene-character-left", "48.8%");
    sceneCharacter.style.setProperty("--scene-character-bottom", "10.5%");
    sceneCharacter.style.setProperty("--scene-character-scale", "0.92");
    sceneCharacter.style.setProperty("--scene-character-depth", "4");
    sceneCharacter.style.setProperty("--scene-character-depth-scale", "0.94");
    sceneCharacter.style.setProperty("--scene-character-body-scale", String(roleConfig.bodyScale));
    sceneCharacter.style.setProperty("--scene-character-head-top", `${roleConfig.headTopPct}%`);
    sceneCharacter.style.setProperty("--scene-character-head-left", `${roleConfig.headLeftPct}%`);
    sceneCharacter.style.setProperty("--scene-character-head-size", `${roleConfig.headSizePct}%`);
    sceneCharacter.style.setProperty(
      "--scene-character-avatar-scale",
      String(roleConfig.avatarScale)
    );

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

    sceneCharacter.append(stage, characterLabel);
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
    document.body.classList.add("is-scroll-locked");
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
    document.body.classList.remove("is-scroll-locked");
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
