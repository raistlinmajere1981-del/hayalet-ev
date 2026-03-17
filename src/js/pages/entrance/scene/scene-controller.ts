import { AppState } from "../../../modules/app-state.js";
import { AppI18n } from "../../../modules/i18n/index.js";
import { TrafficManager } from "../../../modules/traffic-manager.js";
import { shellT } from "../../../app/shell-i18n.js";
import { SCENE_DEBUG_ROOMS } from "../../../scene/scene-debug-rooms.js";
import { SCENE_THEME_CONFIG } from "../../../scene/scene-config.js";
import { isSceneUiMode } from "../../../ui/ui-mode.js";

import { resolveSceneAvatarSource } from "./scene-avatar.js";
import { EntranceSceneEditor, type EntranceSceneEditorSelection } from "./scene-editor.js";
import { SceneCharacterMenu } from "./scene-character-menu.js";
import { applySceneDebugFlag, isSceneDebugEnabled } from "./scene-debug.js";
import {
  clearEntranceSceneMapDraft,
  cloneEntranceSceneMap,
  DEFAULT_ENTRANCE_SCENE_MAP,
  type EntranceSceneLabelFontPreset,
  type EntranceSceneMap,
  loadEntranceSceneMapDraft,
  saveEntranceSceneMapDraft,
  serializeEntranceSceneMap,
  type EntranceSceneHotspotConfig,
} from "./scene-map.js";
import {
  buildSceneCharacterRoster,
  type SceneCharacterDescriptor,
} from "./scene-character-roster.js";
import type { SceneEntranceBridge } from "./scene-entrance-bridge.js";

const ELEMENT_IDS = {
  root: "entrance-scene-root",
  background: "entrance-scene-background",
  hotspotLayer: "entrance-scene-hotspots",
  characterLayer: "entrance-scene-characters",
  editorHost: "entrance-scene-editor-host",
  menuHost: "entrance-scene-menu-host",
} as const;

const HOTSPOT_LABEL_FONT_FAMILIES: Record<EntranceSceneLabelFontPreset, string> = {
  display: "var(--font-scene-display)",
  inscription: "var(--font-scene-inscription)",
  classic: "var(--font-scene-classic)",
  sans: "var(--font-scene-sans)",
  rounded: "var(--font-scene-rounded)",
  condensed: "var(--font-scene-condensed)",
  mono: "var(--font-scene-mono)",
};

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
  sceneMap = cloneEntranceSceneMap();
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
      loadEntranceSceneMapDraft() ?? cloneEntranceSceneMap(DEFAULT_ENTRANCE_SCENE_MAP);
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
          isSceneUiMode() && document.documentElement.getAttribute("data-active-page") === "entrance",
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
          document.dispatchEvent(
            new CustomEvent("navigate-page", {
              detail: { page: roomId },
            })
          );
        },
        supportsHotspotLabels: (): boolean => true,
        updateHotspot: (id, updater): void => {
          this.sceneMap.hotspots = this.sceneMap.hotspots.map((hotspot) =>
            hotspot.id === id ? updater(hotspot) : hotspot
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
          void this.renderCharacters();
          this.editor?.refresh();
        },
        resetDraft: (): void => {
          this.sceneMap = cloneEntranceSceneMap(DEFAULT_ENTRANCE_SCENE_MAP);
          clearEntranceSceneMapDraft();
          this.editorSelection = null;
          this.renderHotspots();
          void this.renderCharacters();
          this.editor?.refresh();
        },
        copySceneMap: async (): Promise<void> => {
          try {
            await navigator.clipboard.writeText(serializeEntranceSceneMap(this.sceneMap));
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
    if (this.background === null) {
      return;
    }

    this.background.src = SCENE_THEME_CONFIG.entrance.backgroundSrc;
    this.background.alt = "";
  }

  private resolveHotspotLabel(hotspot: EntranceSceneHotspotConfig): string {
    const customLabel =
      typeof hotspot.labelCustomText === "string" ? hotspot.labelCustomText.trim() : "";
    if (customLabel !== "") {
      return customLabel;
    }
    return shellT(hotspot.labelKey);
  }

  private resolveHotspotLabelFont(hotspot: EntranceSceneHotspotConfig): string {
    return HOTSPOT_LABEL_FONT_FAMILIES[hotspot.labelFontPreset] ?? "var(--font-scene-sans)";
  }

  private renderHotspots(): void {
    if (this.hotspotLayer === null) {
      return;
    }

    const projection = this.getSceneProjection();
    const fragment = document.createDocumentFragment();

    this.sceneMap.hotspots.forEach((hotspot) => {
      const labelText = this.resolveHotspotLabel(hotspot);
      const hotspotSelected =
        this.editorSelection?.kind === "hotspot" && this.editorSelection.id === hotspot.id;
      const wrapper = document.createElement("div");
      wrapper.className = "entrance-scene__hotspot-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "entrance-scene__hotspot";
      button.dataset["hotspotId"] = hotspot.id;
      button.dataset["debugLabel"] = labelText;
      button.dataset["frameVariant"] = hotspot.frameVariant;
      button.classList.toggle("is-selected", hotspotSelected);
      button.style.setProperty("--scene-hotspot-frame-rotate", `${hotspot.frameRotateDeg}deg`);
      button.style.setProperty(
        "--scene-hotspot-frame-perspective",
        `${hotspot.framePerspectiveDeg}deg`
      );
      button.style.setProperty(
        "--scene-hotspot-hover-glow-hue",
        `${hotspot.frameHoverGlowHueDeg}deg`
      );
      button.style.setProperty(
        "--scene-hotspot-hover-glow-alpha",
        `${hotspot.frameHoverGlowAlpha}`
      );

      button.style.setProperty(
        "--scene-hotspot-left",
        `${projection.offsetX + hotspot.leftPx * projection.scale}px`
      );
      button.style.setProperty(
        "--scene-hotspot-top",
        `${projection.offsetY + hotspot.topPx * projection.scale}px`
      );
      button.style.setProperty("--scene-hotspot-width", `${hotspot.widthPx * projection.scale}px`);
      button.style.setProperty(
        "--scene-hotspot-height",
        `${hotspot.heightPx * projection.scale}px`
      );
      button.ariaLabel = labelText;
      button.addEventListener("click", () => {
        this.handleHotspotInteraction(hotspot);
      });

      const label = document.createElement("span");
      label.className = "entrance-scene__hotspot-label";
      label.classList.toggle("is-selected", hotspotSelected);
      label.textContent = labelText;
      label.ariaHidden = "true";
      label.dataset["hotspotId"] = hotspot.id;
      label.style.setProperty(
        "--scene-hotspot-label-left",
        `${projection.offsetX + hotspot.labelCenterXPx * projection.scale}px`
      );
      label.style.setProperty(
        "--scene-hotspot-label-top",
        `${projection.offsetY + hotspot.labelTopPx * projection.scale}px`
      );
      label.style.setProperty(
        "--scene-hotspot-label-width",
        `${hotspot.labelWidthPx * projection.scale}px`
      );
      label.style.setProperty(
        "--scene-hotspot-label-height",
        `${hotspot.labelHeightPx * projection.scale}px`
      );
      label.style.setProperty("--scene-hotspot-label-rotate", `${hotspot.labelRotateDeg}deg`);
      label.style.setProperty(
        "--scene-hotspot-label-frame-perspective",
        `${hotspot.labelFramePerspectiveDeg}deg`
      );
      label.style.setProperty(
        "--scene-hotspot-label-font-size",
        `${hotspot.labelFontSizePx * projection.scale}px`
      );
      label.style.setProperty(
        "--scene-hotspot-label-letter-spacing",
        `${hotspot.labelLetterSpacingPx * projection.scale}px`
      );
      label.style.setProperty(
        "--scene-hotspot-label-font-family",
        this.resolveHotspotLabelFont(hotspot)
      );
      label.addEventListener("click", () => {
        this.handleHotspotInteraction(hotspot);
      });

      wrapper.append(button, label);
      fragment.appendChild(wrapper);
    });

    this.hotspotLayer.replaceChildren(fragment);
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
    const surfaceWidth = this.root?.clientWidth ?? 0;
    const surfaceHeight = this.root?.clientHeight ?? 0;
    if (surfaceWidth <= 0 || surfaceHeight <= 0) {
      return { offsetX: 0, offsetY: 0, scale: 1 };
    }

    const scale = Math.max(
      surfaceWidth / this.sceneMap.referenceSize.width,
      surfaceHeight / this.sceneMap.referenceSize.height
    );

    return {
      offsetX: (surfaceWidth - this.sceneMap.referenceSize.width * scale) / 2,
      offsetY: (surfaceHeight - this.sceneMap.referenceSize.height * scale) / 2,
      scale,
    };
  }

  private getDepthScale(depth: number): number {
    const safeDepth = Number.isFinite(depth) ? depth : 1;
    const normalizedDepth = Math.max(1, safeDepth);
    const scaled = 1 - (normalizedDepth - 1) * 0.02;
    return Number(Math.max(0.75, scaled).toFixed(3));
  }


  private handleHotspotAction(hotspot: EntranceSceneHotspotConfig): void {
    if (hotspot.action.type === "settings") {
      document.dispatchEvent(
        new CustomEvent("settings-hub:open", {
          detail: { panel: hotspot.action.panel },
        })
      );
      return;
    }

    if (hotspot.action.type === "screen") {
      return;
    }

    document.dispatchEvent(
      new CustomEvent("navigate-page", {
        detail: { page: hotspot.action.page },
      })
    );
  }

  private handleHotspotInteraction(hotspot: EntranceSceneHotspotConfig): void {
    if (this.editor !== null) {
      this.editorSelection = { kind: "hotspot", id: hotspot.id };
      this.editor.refresh();
      this.renderHotspots();
      return;
    }

    this.handleHotspotAction(hotspot);
  }

  private async renderCharacters(): Promise<void> {
    if (this.characterLayer === null || !isSceneUiMode()) {
      return;
    }

    const renderToken = ++this.characterRenderToken;
    const characters = buildSceneCharacterRoster(this.sceneMap.characterAnchors);
    const fragment = document.createDocumentFragment();
    const sceneDebug = isSceneDebugEnabled();
    const projection = this.getSceneProjection();

    const avatarSources = await Promise.all(
      characters.map(async (character) => await resolveSceneAvatarSource(character.avatarSource))
    );

    if (renderToken !== this.characterRenderToken) {
      return;
    }

    this.characters = new Map(characters.map((character) => [character.id, character]));

    characters.forEach((character, index) => {
      const avatarSource = avatarSources[index] ?? null;
      const characterNode = document.createElement("div");
      const menuOpen = this.openCharacterId === character.id;
      characterNode.className = `entrance-scene__character ${`is-${character.state}`}`;
      if (menuOpen) {
        characterNode.classList.add("is-menu-open");
      }
      if (character.slot !== null) {
        characterNode.dataset["slot"] = character.slot;
      }
      characterNode.dataset["characterId"] = character.id;
      characterNode.dataset["kind"] = character.kind;
      characterNode.dataset["role"] = character.role;
      characterNode.dataset["variant"] = character.variant;
      characterNode.dataset["anchorId"] = character.anchorId;
      characterNode.classList.toggle(
        "is-selected",
        this.editorSelection?.kind === "character" && this.editorSelection.id === character.anchorId
      );

      const depthScale = this.getDepthScale(character.depth);
      const depthZ = Number.isFinite(character.depth) ? Math.max(1, character.depth) : 1;

      characterNode.style.setProperty(
        "--scene-character-left",
        `${projection.offsetX + character.leftPx * projection.scale}px`
      );
      characterNode.style.setProperty(
        "--scene-character-bottom",
        `${projection.offsetY + character.bottomPx * projection.scale}px`
      );
      characterNode.style.setProperty("--scene-character-scale", String(character.scale));
      characterNode.style.setProperty("--scene-character-depth", String(depthZ));
      characterNode.style.setProperty("--scene-character-depth-scale", String(depthScale));

      characterNode.style.setProperty("--scene-character-body-scale", String(character.bodyScale));
      characterNode.style.setProperty("--scene-character-head-top", `${character.headTopPct}%`);
      characterNode.style.setProperty("--scene-character-head-left", `${character.headLeftPct}%`);
      characterNode.style.setProperty("--scene-character-head-size", `${character.headSizePct}%`);
      characterNode.style.setProperty(
        "--scene-character-avatar-scale",
        String(character.avatarScale)
      );
      characterNode.tabIndex = 0;
      characterNode.role = "button";
      characterNode.setAttribute("aria-haspopup", "dialog");
      characterNode.setAttribute("aria-expanded", String(menuOpen));

      const stage = document.createElement("div");
      stage.className = "entrance-scene__character-stage";

      const body = document.createElement("img");
      body.className = "entrance-scene__character-body";
      body.src = character.bodySrc;
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
        fallback.textContent = character.headLabel ?? "?";
        head.appendChild(fallback);
      }
      stage.appendChild(head);

      const label = document.createElement("span");
      label.className = "entrance-scene__character-label";
      label.textContent = character.label;

      const anchorMarker = document.createElement("span");
      anchorMarker.className = "entrance-scene__character-anchor-marker";
      anchorMarker.ariaHidden = String(!sceneDebug);
      anchorMarker.textContent = character.anchorId;

      characterNode.append(stage, label, anchorMarker);
      characterNode.addEventListener("click", () => {
        if (this.editor !== null) {
          this.editorSelection = { kind: "character", id: character.anchorId };
          this.editor.refresh();
          void this.renderCharacters();
          return;
        }
        this.toggleCharacterMenu(character, characterNode);
      });
      characterNode.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        if (this.editor !== null) {
          this.editorSelection = { kind: "character", id: character.anchorId };
          this.editor.refresh();
          void this.renderCharacters();
          return;
        }
        this.toggleCharacterMenu(character, characterNode);
      });
      fragment.appendChild(characterNode);
    });

    this.characterLayer.replaceChildren(fragment);
    this.syncOpenMenuAnchor();
  }

  private persistSceneMapDraft(): void {
    saveEntranceSceneMapDraft(this.sceneMap);
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
