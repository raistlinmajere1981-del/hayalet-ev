import { AppState } from "../../../modules/app-state.js";
import { TrafficManager } from "../../../modules/traffic-manager.js";
import { SCENE_THEME_CONFIG } from "../../../scene/scene-config.js";
import { isSceneUiMode } from "../../../ui/ui-mode.js";

import { buildSceneCharacterRoster } from "./scene-character-roster.js";
import { ENTRANCE_SCENE_HOTSPOTS, type EntranceSceneHotspotConfig } from "./scene-hotspots.js";

const ELEMENT_IDS = {
  root: "entrance-scene-root",
  background: "entrance-scene-background",
  hotspotLayer: "entrance-scene-hotspots",
  characterLayer: "entrance-scene-characters",
  menuHost: "entrance-scene-menu-host",
} as const;

export class EntranceSceneController {
  root: HTMLElement | null = null;
  background: HTMLImageElement | null = null;
  hotspotLayer: HTMLElement | null = null;
  characterLayer: HTMLElement | null = null;
  menuHost: HTMLElement | null = null;
  trafficUnsub: (() => void) | null = null;
  appStateUnsub: (() => void) | null = null;

  init(): void {
    this.root = document.getElementById(ELEMENT_IDS.root);
    this.background = document.getElementById(ELEMENT_IDS.background) as HTMLImageElement | null;
    this.hotspotLayer = document.getElementById(ELEMENT_IDS.hotspotLayer);
    this.characterLayer = document.getElementById(ELEMENT_IDS.characterLayer);
    this.menuHost = document.getElementById(ELEMENT_IDS.menuHost);

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
      return;
    }

    this.renderBackground();
    this.renderHotspots();
    this.renderCharacters();
  }

  private renderStatic(): void {
    this.renderBackground();
    this.renderHotspots();
    this.renderCharacters();
  }

  private subscribeRuntimeSignals(): void {
    this.trafficUnsub ??= TrafficManager.onUpdate(() => {
      this.renderCharacters();
    });

    this.appStateUnsub ??= AppState.subscribe(() => {
      this.renderCharacters();
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
      const button = document.createElement("button");
      button.type = "button";
      button.className = "entrance-scene__hotspot";
      button.dataset["hotspotId"] = hotspot.id;
      button.style.setProperty("--scene-hotspot-left", `${hotspot.leftPct}%`);
      button.style.setProperty("--scene-hotspot-top", `${hotspot.topPct}%`);
      button.style.setProperty("--scene-hotspot-width", `${hotspot.widthPct}%`);
      button.style.setProperty("--scene-hotspot-height", `${hotspot.heightPct}%`);
      button.title = hotspot.label;
      button.ariaLabel = hotspot.label;
      button.innerHTML = `<span class="entrance-scene__hotspot-label">${hotspot.label}</span>`;
      button.addEventListener("click", () => {
        this.handleHotspotAction(hotspot);
      });
      fragment.appendChild(button);
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

  private renderCharacters(): void {
    if (this.characterLayer === null || !isSceneUiMode()) {
      return;
    }

    const fragment = document.createDocumentFragment();

    buildSceneCharacterRoster().forEach((character) => {
      const characterNode = document.createElement("div");
      characterNode.className = `entrance-scene__character ${`is-${character.state}`}`;
      characterNode.dataset["slot"] = character.slot;
      characterNode.dataset["variant"] = character.variant;
      characterNode.style.setProperty("--scene-character-left", `${character.leftPct}%`);
      characterNode.style.setProperty("--scene-character-bottom", `${character.bottomPct}%`);
      characterNode.style.setProperty("--scene-character-scale", String(character.scale));
      characterNode.innerHTML = `
        <div class="entrance-scene__character-stage">
          <img
            class="entrance-scene__character-body"
            src="${character.bodySrc}"
            alt=""
            aria-hidden="true"
          />
          <span class="entrance-scene__character-head" aria-hidden="true">${character.headLabel}</span>
        </div>
        <span class="entrance-scene__character-label">${character.label}</span>
      `;
      fragment.appendChild(characterNode);
    });

    this.characterLayer.replaceChildren(fragment);
  }
}
