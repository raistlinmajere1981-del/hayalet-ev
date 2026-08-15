import { getActiveLabImageComparisonToolbarTool } from "./lab-image-comparison-toolbar.js";

type LabImageComparisonManipulationMode = "move" | "resize" | "zoom";
type LabImageComparisonSide = "primary" | "reference";

type ComparisonDragState = {
  aspectLocked: boolean;
  initialOffsetX: number;
  initialOffsetY: number;
  initialScaleX: number;
  initialScaleY: number;
  initialZoom: number;
  lastSignature: string | null;
  mode: LabImageComparisonManipulationMode;
  rectHeight: number;
  rectWidth: number;
  side: LabImageComparisonSide;
  startX: number;
  startY: number;
};

const COMPARISON_FIELD_PREFIX = "operationSettings.image-comparison.";
const SETTINGS_ROOT_SELECTOR =
  '.labx-icon-rail-popover[data-slot="image-comparison"] .labx-image-comparison-settings';
const COMPARISON_IMAGE_SELECTOR =
  ".labx-workspace-comparison__image[data-comparison-transform]";
const COMPARISON_PREVIEW_SELECTOR = ".labx-workspace-preview";

let bound = false;
let dragState: ComparisonDragState | null = null;
let transformSyncQueued = false;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundForControl(value: number) {
  return Math.round(value * 100) / 100;
}

function getSettingsRoot() {
  if (typeof document === "undefined") {
    return null;
  }
  return document.querySelector<HTMLElement>(SETTINGS_ROOT_SELECTOR);
}

function getComparisonStage(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest<HTMLElement>(
    '[data-lab-comparison-roi-side="primary"], [data-lab-comparison-roi-side="reference"]'
  );
}

function getComparisonSide(stage: HTMLElement): LabImageComparisonSide | null {
  const side = stage.dataset["labComparisonRoiSide"];
  return side === "primary" || side === "reference" ? side : null;
}

function getComparisonImageSide(image: HTMLImageElement): LabImageComparisonSide | null {
  const preserveKey = image.dataset["labPreserveMedia"] || "";
  if (preserveKey.endsWith("-primary")) {
    return "primary";
  }
  if (preserveKey.endsWith("-reference")) {
    return "reference";
  }
  return null;
}

function syncComparisonTransformFollowers(side: LabImageComparisonSide, transform: string) {
  document
    .querySelectorAll<SVGSVGElement>(`.labx-face-landmark-overlay[data-side="${side}"]`)
    .forEach(function (overlay) {
      if (overlay.style.transform !== transform) {
        overlay.style.transform = transform;
      }
    });
}

function syncComparisonImageTransforms() {
  document.querySelectorAll<HTMLImageElement>(COMPARISON_IMAGE_SELECTOR).forEach(function (image) {
    const transform = image.dataset["comparisonTransform"]?.trim() || "";
    if (image.style.transform !== transform) {
      image.style.transform = transform;
    }
    const side = getComparisonImageSide(image);
    if (side !== null) {
      syncComparisonTransformFollowers(side, transform);
    }
  });
}

function queueComparisonTransformSync() {
  if (transformSyncQueued) {
    return;
  }
  transformSyncQueued = true;
  queueMicrotask(function () {
    transformSyncQueued = false;
    syncComparisonImageTransforms();
  });
}

function bindComparisonTransformSync() {
  if (typeof MutationObserver === "undefined") {
    syncComparisonImageTransforms();
    return;
  }
  const previewRoot = document.querySelector<HTMLElement>(COMPARISON_PREVIEW_SELECTOR);
  if (previewRoot === null) {
    syncComparisonImageTransforms();
    return;
  }
  new MutationObserver(queueComparisonTransformSync).observe(previewRoot, {
    attributeFilter: ["data-comparison-transform", "style"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  syncComparisonImageTransforms();
}

function queryField(root: HTMLElement, key: string) {
  return root.querySelector<HTMLInputElement>(
    `[data-lab-field="${COMPARISON_FIELD_PREFIX}${key}"]`
  );
}

function readNumberField(root: HTMLElement, key: string, fallback: number) {
  const field = queryField(root, key);
  if (field === null) {
    return fallback;
  }
  const value = Number(field.value);
  return Number.isFinite(value) ? value : fallback;
}

function readBooleanField(root: HTMLElement, key: string, fallback: boolean) {
  const field = queryField(root, key);
  return field === null ? fallback : field.checked;
}

function writeNumberField(root: HTMLElement, key: string, value: number) {
  const field = queryField(root, key);
  if (field === null) {
    return;
  }
  const nextValue = String(roundForControl(value));
  if (field.value === nextValue) {
    return;
  }
  field.value = nextValue;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  queueComparisonTransformSync();
}

function stopComparisonGesture(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) {
    return;
  }
  const activeTool = getActiveLabImageComparisonToolbarTool();
  if (activeTool !== "move" && activeTool !== "resize" && activeTool !== "zoom") {
    return;
  }
  const mode: LabImageComparisonManipulationMode = activeTool;
  const root = getSettingsRoot();
  if (root === null) {
    return;
  }
  const stage = getComparisonStage(event.target);
  if (stage === null) {
    return;
  }
  const side = getComparisonSide(stage);
  if (side === null) {
    return;
  }
  const rect = stage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }
  const prefix = side === "primary" ? "primary" : "reference";
  stopComparisonGesture(event);
  dragState = {
    aspectLocked: readBooleanField(root, `${prefix}AspectLock`, true),
    initialOffsetX: readNumberField(root, `${prefix}OffsetX`, 0),
    initialOffsetY: readNumberField(root, `${prefix}OffsetY`, 0),
    initialScaleX: readNumberField(root, `${prefix}ScaleX`, 1),
    initialScaleY: readNumberField(root, `${prefix}ScaleY`, 1),
    initialZoom: readNumberField(root, `${prefix}Zoom`, 1),
    lastSignature: null,
    mode,
    rectHeight: rect.height,
    rectWidth: rect.width,
    side,
    startX: event.clientX,
    startY: event.clientY,
  };
}

function handleMouseMove(event: MouseEvent) {
  const drag = dragState;
  if (drag === null) {
    return;
  }
  const root = getSettingsRoot();
  if (root === null) {
    dragState = null;
    return;
  }
  stopComparisonGesture(event);
  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;
  const prefix = drag.side === "primary" ? "primary" : "reference";

  if (drag.mode === "move") {
    const nextX = clamp(drag.initialOffsetX + (deltaX / drag.rectWidth) * 100, -100, 100);
    const nextY = clamp(drag.initialOffsetY + (deltaY / drag.rectHeight) * 100, -100, 100);
    const signature = `${roundForControl(nextX)}:${roundForControl(nextY)}`;
    if (signature === drag.lastSignature) {
      return;
    }
    drag.lastSignature = signature;
    writeNumberField(root, `${prefix}OffsetX`, nextX);
    writeNumberField(root, `${prefix}OffsetY`, nextY);
    return;
  }

  if (drag.mode === "zoom") {
    const normalizedDelta = deltaX / drag.rectWidth - deltaY / drag.rectHeight;
    const nextZoom = clamp(drag.initialZoom * Math.exp(normalizedDelta * 1.5), 0.25, 4);
    const signature = String(roundForControl(nextZoom));
    if (signature === drag.lastSignature) {
      return;
    }
    drag.lastSignature = signature;
    writeNumberField(root, `${prefix}Zoom`, nextZoom);
    return;
  }

  if (drag.aspectLocked) {
    const normalizedDelta = ((deltaX / drag.rectWidth + deltaY / drag.rectHeight) / 2) * 2;
    const initialScale = (drag.initialScaleX + drag.initialScaleY) / 2;
    const nextScale = clamp(initialScale + normalizedDelta, 0.25, 4);
    const signature = String(roundForControl(nextScale));
    if (signature === drag.lastSignature) {
      return;
    }
    drag.lastSignature = signature;
    writeNumberField(root, `${prefix}ScaleX`, nextScale);
    writeNumberField(root, `${prefix}ScaleY`, nextScale);
    return;
  }

  const nextScaleX = clamp(drag.initialScaleX + (deltaX / drag.rectWidth) * 2, 0.25, 4);
  const nextScaleY = clamp(drag.initialScaleY + (deltaY / drag.rectHeight) * 2, 0.25, 4);
  const signature = `${roundForControl(nextScaleX)}:${roundForControl(nextScaleY)}`;
  if (signature === drag.lastSignature) {
    return;
  }
  drag.lastSignature = signature;
  writeNumberField(root, `${prefix}ScaleX`, nextScaleX);
  writeNumberField(root, `${prefix}ScaleY`, nextScaleY);
}

function handleWheel(event: WheelEvent) {
  if (getActiveLabImageComparisonToolbarTool() !== "zoom") {
    return;
  }
  const root = getSettingsRoot();
  const stage = getComparisonStage(event.target);
  if (root === null || stage === null) {
    return;
  }
  const side = getComparisonSide(stage);
  if (side === null) {
    return;
  }
  const prefix = side === "primary" ? "primary" : "reference";
  const currentZoom = readNumberField(root, `${prefix}Zoom`, 1);
  const nextZoom = clamp(currentZoom * Math.exp(-event.deltaY * 0.0015), 0.25, 4);
  stopComparisonGesture(event);
  writeNumberField(root, `${prefix}Zoom`, nextZoom);
}

function clearDragState() {
  dragState = null;
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || dragState === null) {
    return;
  }
  event.preventDefault();
  dragState = null;
}

export function ensureLabImageComparisonMouseToolsBound() {
  if (bound || typeof document === "undefined" || typeof window === "undefined") {
    return;
  }
  bound = true;
  bindComparisonTransformSync();
  document.addEventListener("mousedown", handleMouseDown, true);
  document.addEventListener("wheel", handleWheel, { capture: true, passive: false });
  window.addEventListener("mousemove", handleMouseMove, true);
  window.addEventListener("mouseup", clearDragState, true);
  window.addEventListener("blur", clearDragState);
  document.addEventListener("keydown", handleKeyDown, true);
}
