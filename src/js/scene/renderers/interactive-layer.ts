import { getSceneHotspotLabelFontFamily } from "../label-font.js";

import type {
  EntranceSceneInteractiveConfig,
  SceneDebugNodeSelection,
} from "../../pages/entrance/scene/scene-map.js";
import {
  hasSceneNodeLabel,
  isSceneDebugSelectionForInteractive,
} from "../../pages/entrance/scene/scene-map.js";

interface SceneProjection {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface SceneInteractiveLayerClassNames {
  item: string;
  button: string;
  label: string;
}

export interface RenderSceneInteractiveLayerOptions {
  layer: HTMLElement;
  nodes: readonly EntranceSceneInteractiveConfig[];
  projection: SceneProjection;
  cssVarPrefix: string;
  classNames: SceneInteractiveLayerClassNames;
  selection: SceneDebugNodeSelection;
  resolveLabel(node: EntranceSceneInteractiveConfig): string;
  onActivate(node: EntranceSceneInteractiveConfig): void;
}

function setVar(
  style: CSSStyleDeclaration,
  cssVarPrefix: string,
  suffix: string,
  value: string
): void {
  style.setProperty(`--${cssVarPrefix}-${suffix}`, value);
}

export function renderSceneInteractiveLayer(options: RenderSceneInteractiveLayerOptions): void {
  const {
    layer,
    nodes,
    projection,
    cssVarPrefix,
    classNames,
    selection,
    resolveLabel,
    onActivate,
  } = options;
  const fragment = document.createDocumentFragment();

  nodes.forEach((node) => {
    const labelText = resolveLabel(node);
    const selected = isSceneDebugSelectionForInteractive(selection, node);
    const wrapper = document.createElement("div");
    wrapper.className = classNames.item;

    const button = document.createElement("button");
    button.type = "button";
    button.className = classNames.button;
    button.dataset["hotspotId"] = node.id;
    button.dataset["frameVariant"] = node.frame.variant;
    button.classList.toggle("is-selected", selected);
    setVar(
      button.style,
      cssVarPrefix,
      "left",
      `${projection.offsetX + node.rect.leftPx * projection.scale}px`
    );
    setVar(
      button.style,
      cssVarPrefix,
      "top",
      `${projection.offsetY + node.rect.topPx * projection.scale}px`
    );
    setVar(button.style, cssVarPrefix, "width", `${node.rect.widthPx * projection.scale}px`);
    setVar(button.style, cssVarPrefix, "height", `${node.rect.heightPx * projection.scale}px`);
    setVar(button.style, cssVarPrefix, "frame-rotate", `${node.frame.rotateDeg}deg`);
    setVar(button.style, cssVarPrefix, "frame-perspective", `${node.frame.perspectiveDeg}deg`);
    setVar(button.style, cssVarPrefix, "hover-glow-hue", `${node.frame.hoverGlowHueDeg}deg`);
    setVar(button.style, cssVarPrefix, "hover-glow-alpha", `${node.frame.hoverGlowAlpha}`);
    button.ariaLabel = labelText;
    button.addEventListener("click", () => {
      onActivate(node);
    });

    wrapper.append(button);

    if (hasSceneNodeLabel(node)) {
      const label = document.createElement("span");
      label.className = classNames.label;
      label.classList.toggle("is-selected", selected);
      label.textContent = labelText;
      label.ariaHidden = "true";
      setVar(
        label.style,
        cssVarPrefix,
        "label-left",
        `${projection.offsetX + node.label.centerXPx * projection.scale}px`
      );
      setVar(
        label.style,
        cssVarPrefix,
        "label-top",
        `${projection.offsetY + node.label.topPx * projection.scale}px`
      );
      setVar(
        label.style,
        cssVarPrefix,
        "label-width",
        `${node.label.widthPx * projection.scale}px`
      );
      setVar(
        label.style,
        cssVarPrefix,
        "label-height",
        `${node.label.heightPx * projection.scale}px`
      );
      setVar(label.style, cssVarPrefix, "label-rotate", `${node.label.rotateDeg}deg`);
      setVar(
        label.style,
        cssVarPrefix,
        "label-frame-perspective",
        `${node.label.framePerspectiveDeg}deg`
      );
      setVar(
        label.style,
        cssVarPrefix,
        "label-font-size",
        `${node.label.fontSizePx * projection.scale}px`
      );
      setVar(
        label.style,
        cssVarPrefix,
        "label-letter-spacing",
        `${node.label.letterSpacingPx * projection.scale}px`
      );
      setVar(
        label.style,
        cssVarPrefix,
        "label-font-family",
        getSceneHotspotLabelFontFamily(node.label.fontPreset)
      );
      label.addEventListener("click", () => {
        onActivate(node);
      });
      wrapper.append(label);
    }

    fragment.appendChild(wrapper);
  });

  layer.replaceChildren(fragment);
}
