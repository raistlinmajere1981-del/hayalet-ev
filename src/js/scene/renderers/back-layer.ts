import { getSceneHotspotLabelFontFamily } from "../label-font.js";
import type { EntranceSceneBackConfig } from "../layout/index.js";
import { hasSceneNodeLabel } from "../layout/index.js";

interface SceneProjection {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface RenderSceneBackLayerOptions {
  host: HTMLElement;
  node: EntranceSceneBackConfig | null;
  projection: SceneProjection;
  resolveLabel(node: EntranceSceneBackConfig): string;
  onActivate(node: EntranceSceneBackConfig): void;
}

export function renderSceneBackLayer(options: RenderSceneBackLayerOptions): void {
  const { host, node, projection, resolveLabel, onActivate } = options;
  host.querySelectorAll("[data-scene-generated-back='true']").forEach((element) => {
    element.remove();
  });

  if (node === null) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "scene-back-zone scene-back-zone--single";
  button.dataset["sceneGeneratedBack"] = "true";
  button.dataset["sceneBackZone"] = "left";
  button.style.left = `${projection.offsetX + node.rect.leftPx * projection.scale}px`;
  button.style.top = `${projection.offsetY + node.rect.topPx * projection.scale}px`;
  button.style.width = `${node.rect.widthPx * projection.scale}px`;
  button.style.height = `${node.rect.heightPx * projection.scale}px`;
  button.style.right = "auto";
  button.style.bottom = "auto";
  button.ariaLabel = resolveLabel(node);
  button.addEventListener("click", () => {
    onActivate(node);
  });

  const arrow = document.createElement("span");
  arrow.className = "scene-back-zone__arrow";
  arrow.ariaHidden = "true";
  arrow.textContent = "←";

  button.appendChild(arrow);

  if (hasSceneNodeLabel(node)) {
    const copy = document.createElement("span");
    copy.className = "scene-back-zone__copy";
    copy.ariaHidden = "true";
    copy.textContent = resolveLabel(node);
    copy.style.setProperty(
      "--scene-back-zone-label-left",
      `${(node.label.centerXPx - node.rect.leftPx) * projection.scale}px`
    );
    copy.style.setProperty(
      "--scene-back-zone-label-top",
      `${(node.label.topPx - node.rect.topPx) * projection.scale}px`
    );
    copy.style.setProperty(
      "--scene-back-zone-label-width",
      `${node.label.widthPx * projection.scale}px`
    );
    copy.style.setProperty(
      "--scene-back-zone-label-height",
      `${node.label.heightPx * projection.scale}px`
    );
    copy.style.setProperty("--scene-back-zone-label-rotate", `${node.label.rotateDeg}deg`);
    copy.style.setProperty(
      "--scene-back-zone-label-font-family",
      getSceneHotspotLabelFontFamily(node.label.fontPreset)
    );
    copy.style.setProperty(
      "--scene-back-zone-label-font-size",
      `${node.label.fontSizePx * projection.scale}px`
    );
    copy.style.setProperty(
      "--scene-back-zone-label-letter-spacing",
      `${node.label.letterSpacingPx * projection.scale}px`
    );
    button.appendChild(copy);
  }

  host.appendChild(button);
}
