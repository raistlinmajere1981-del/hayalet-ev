import { getSceneHotspotLabelFontFamily } from "../label-font.js";

import type {
  SceneInteractiveConfig,
  SceneDebugNodeSelection,
} from "../layout/index.js";
import {
  hasSceneNodeLabel,
  isSceneDebugSelectionForInteractive,
} from "../layout/index.js";

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
  nodes: readonly SceneInteractiveConfig[];
  projection: SceneProjection;
  cssVarPrefix: string;
  classNames: SceneInteractiveLayerClassNames;
  selection: SceneDebugNodeSelection;
  interactiveLabels?: boolean;
  resolveLabel(node: SceneInteractiveConfig): string;
  onActivate(node: SceneInteractiveConfig): void;
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
    interactiveLabels = false,
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
    setVar(button.style, cssVarPrefix, "hover-glow-hue", `${node.frame.hueDeg}deg`);
    setVar(button.style, cssVarPrefix, "hover-glow-alpha", `${node.frame.alpha}`);
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
      if (interactiveLabels) {
        label.dataset["clickable"] = "true";
        label.tabIndex = 0;
        label.role = "button";
        label.ariaLabel = labelText;
        label.addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          onActivate(node);
        });
      } else {
        label.ariaHidden = "true";
      }
      label.addEventListener("click", () => {
        onActivate(node);
      });
      wrapper.append(label);
    }

    fragment.appendChild(wrapper);
  });

  layer.replaceChildren(fragment);
}
