import { AppState } from "../../../modules/app-state.js";
import { AppI18n } from "../../../modules/i18n/index.js";
import { TrafficManager } from "../../../modules/traffic-manager.js";
import { shellT } from "../../../app/shell-i18n.js";
import { SCENE_THEME_CONFIG } from "../../../scene/scene-config.js";
import { isSceneUiMode } from "../../../ui/ui-mode.js";

import { resolveSceneAvatarSource } from "./scene-avatar.js";
import { SceneCharacterMenu } from "./scene-character-menu.js";
import { applySceneDebugFlag, isSceneDebugEnabled } from "./scene-debug.js";
import {
  buildSceneCharacterRoster,
  type SceneCharacterDescriptor,
} from "./scene-character-roster.js";
import type { SceneEntranceBridge } from "./scene-entrance-bridge.js";
import { ENTRANCE_SCENE_HOTSPOTS, type EntranceSceneHotspotConfig } from "./scene-hotspots.js";

const ELEMENT_IDS = {
  root: "entrance-scene-root",
  background: "entrance-scene-background",
  hotspotLayer: "entrance-scene-hotspots",
  characterLayer: "entrance-scene-characters",
  menuHost: "entrance-scene-menu-host",
} as const;

export class EntranceSceneController {
  bridge: SceneEntranceBridge;
  root: HTMLElement | null = null;
  background: HTMLImageElement | null = null;
  hotspotLayer: HTMLElement | null = null;
  characterLayer: HTMLElement | null = null;
  menuHost: HTMLElement | null = null;
  menu: SceneCharacterMenu | null = null;
  trafficUnsub: (() => void) | null = null;
  appStateUnsub: (() => void) | null = null;
  localeUnsub: (() => void) | null = null;
  characterRenderToken = 0;
  openCharacterId: string | null = null;
  characters = new Map<string, SceneCharacterDescriptor>();

  constructor(bridge: SceneEntranceBridge) {
    this.bridge = bridge;
  }

  init(): void {
    applySceneDebugFlag();
    this.root = document.getElementById(ELEMENT_IDS.root);
    this.background = document.getElementById(ELEMENT_IDS.background) as HTMLImageElement | null;
    this.hotspotLayer = document.getElementById(ELEMENT_IDS.hotspotLayer);
    this.characterLayer = document.getElementById(ELEMENT_IDS.characterLayer);
    this.menuHost = document.getElementById(ELEMENT_IDS.menuHost);
    if (this.menuHost !== null) {
      this.menu = new SceneCharacterMenu(this.menuHost, this.bridge, {
        onClose: () => {
          this.openCharacterId = null;
          this.syncOpenMenuAnchor();
        },
      });
    }

    this.renderStatic();
    this.subscribeRuntimeSignals();
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
  }

  private renderStatic(): void {
    this.renderBackground();
    this.renderHotspots();
    void this.renderCharacters();
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
    });
  }

  private renderBackground(): void {
    if (this.background === null) {
      return;
    }

    this.background.src = SCENE_THEME_CONFIG.entrance.backgroundSrc;
    this.background.alt = "";
  }

  private renderHotspots(): void {
    if (this.hotspotLayer === null) {
      return;
    }

    const fragment = document.createDocumentFragment();

    ENTRANCE_SCENE_HOTSPOTS.forEach((hotspot) => {
      const labelText = shellT(hotspot.labelKey);
      const wrapper = document.createElement("div");
      wrapper.className = "entrance-scene__hotspot-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "entrance-scene__hotspot";
      button.dataset["hotspotId"] = hotspot.id;
      button.dataset["debugLabel"] = labelText;
      button.style.setProperty("--scene-hotspot-left", `${hotspot.leftPct}%`);
      button.style.setProperty("--scene-hotspot-top", `${hotspot.topPct}%`);
      button.style.setProperty("--scene-hotspot-width", `${hotspot.widthPct}%`);
      button.style.setProperty("--scene-hotspot-height", `${hotspot.heightPct}%`);
      button.ariaLabel = labelText;
      button.addEventListener("click", () => {
        this.handleHotspotAction(hotspot);
      });

      const label = document.createElement("span");
      label.className = "entrance-scene__hotspot-label";
      label.textContent = labelText;
      label.ariaHidden = "true";
      label.style.setProperty("--scene-hotspot-label-left", `${hotspot.labelLeftPct}%`);
      label.style.setProperty("--scene-hotspot-label-top", `${hotspot.labelTopPct}%`);
      label.style.setProperty("--scene-hotspot-label-width", `${hotspot.labelWidthPct}%`);
      label.style.setProperty("--scene-hotspot-label-rotate", `${hotspot.labelRotateDeg}deg`);

      wrapper.append(button, label);
      fragment.appendChild(wrapper);
    });

    this.hotspotLayer.replaceChildren(fragment);
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

    document.dispatchEvent(
      new CustomEvent("navigate-page", {
        detail: { page: hotspot.action.page },
      })
    );
  }

  private async renderCharacters(): Promise<void> {
    if (this.characterLayer === null || !isSceneUiMode()) {
      return;
    }

    const renderToken = ++this.characterRenderToken;
    const characters = buildSceneCharacterRoster();
    const fragment = document.createDocumentFragment();
    const sceneDebug = isSceneDebugEnabled();

    const avatarSources = await Promise.all(
      characters.map((character) => resolveSceneAvatarSource(character.avatarSource))
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
      characterNode.style.setProperty("--scene-character-left", `${character.leftPct}%`);
      characterNode.style.setProperty("--scene-character-bottom", `${character.bottomPct}%`);
      characterNode.style.setProperty("--scene-character-scale", String(character.scale));
      characterNode.style.setProperty("--scene-character-depth", String(character.depth));
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
        this.toggleCharacterMenu(character, characterNode);
      });
      characterNode.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        this.toggleCharacterMenu(character, characterNode);
      });
      fragment.appendChild(characterNode);
    });

    this.characterLayer.replaceChildren(fragment);
    this.syncOpenMenuAnchor();
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
    const anchorElement = this.characterLayer.querySelector(selector) as HTMLElement | null;

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
