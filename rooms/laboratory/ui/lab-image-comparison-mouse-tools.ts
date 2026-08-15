type LabImageComparisonManipulationMode = "move" | "resize";
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
const ACTIVE_TOOLBOX_SELECTOR =
  '.labx-icon-rail-popover[data-slot="image-comparison"] [data-lab-image-comparison-toolbox="true"]';

let bound = false;
let dragState: ComparisonDragState | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundForControl(value: number) {
  return Math.round(value * 100) / 100;
}

function getActiveToolbox() {
  if (typeof document === "undefined") {
    return null;
  }
  return document.querySelector<HTMLElement>(ACTIVE_TOOLBOX_SELECTOR);
}

function getActiveMode(toolbox: HTMLElement): LabImageComparisonManipulationMode | null {
  const checked = toolbox.querySelector<HTMLInputElement>(
    '[data-lab-comparison-tool-mode="true"]:checked'
  );
  return checked?.value === "move" || checked?.value === "resize" ? checked.value : null;
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

function queryField(toolbox: HTMLElement, key: string) {
  return toolbox.querySelector<HTMLInputElement>(
    `[data-lab-field="${COMPARISON_FIELD_PREFIX}${key}"]`
  );
}

function readNumberField(toolbox: HTMLElement, key: string, fallback: number) {
  const field = queryField(toolbox, key);
  if (field === null) {
    return fallback;
  }
  const value = Number(field.value);
  return Number.isFinite(value) ? value : fallback;
}

function readBooleanField(toolbox: HTMLElement, key: string, fallback: boolean) {
  const field = queryField(toolbox, key);
  return field === null ? fallback : field.checked;
}

function writeNumberField(toolbox: HTMLElement, key: string, value: number) {
  const field = queryField(toolbox, key);
  if (field === null) {
    return;
  }
  const nextValue = String(roundForControl(value));
  if (field.value === nextValue) {
    return;
  }
  field.value = nextValue;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function stopComparisonGesture(event: MouseEvent) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) {
    return;
  }
  const toolbox = getActiveToolbox();
  if (toolbox === null) {
    return;
  }
  const mode = getActiveMode(toolbox);
  if (mode === null) {
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
    aspectLocked: readBooleanField(toolbox, `${prefix}AspectLock`, true),
    initialOffsetX: readNumberField(toolbox, `${prefix}OffsetX`, 0),
    initialOffsetY: readNumberField(toolbox, `${prefix}OffsetY`, 0),
    initialScaleX: readNumberField(toolbox, `${prefix}ScaleX`, 1),
    initialScaleY: readNumberField(toolbox, `${prefix}ScaleY`, 1),
    initialZoom: readNumberField(toolbox, `${prefix}Zoom`, 1),
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
  const toolbox = getActiveToolbox();
  if (toolbox === null) {
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
    writeNumberField(toolbox, `${prefix}OffsetX`, nextX);
    writeNumberField(toolbox, `${prefix}OffsetY`, nextY);
    return;
  }

  if (drag.aspectLocked) {
    const normalizedDelta =
      ((deltaX / drag.rectWidth + deltaY / drag.rectHeight) / 2) * 2;
    const nextZoom = clamp(drag.initialZoom + normalizedDelta, 0.25, 4);
    const signature = String(roundForControl(nextZoom));
    if (signature === drag.lastSignature) {
      return;
    }
    drag.lastSignature = signature;
    writeNumberField(toolbox, `${prefix}Zoom`, nextZoom);
    return;
  }

  const nextScaleX = clamp(drag.initialScaleX + (deltaX / drag.rectWidth) * 2, 0.25, 4);
  const nextScaleY = clamp(drag.initialScaleY + (deltaY / drag.rectHeight) * 2, 0.25, 4);
  const signature = `${roundForControl(nextScaleX)}:${roundForControl(nextScaleY)}`;
  if (signature === drag.lastSignature) {
    return;
  }
  drag.lastSignature = signature;
  writeNumberField(toolbox, `${prefix}ScaleX`, nextScaleX);
  writeNumberField(toolbox, `${prefix}ScaleY`, nextScaleY);
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
  document.addEventListener("mousedown", handleMouseDown, true);
  window.addEventListener("mousemove", handleMouseMove, true);
  window.addEventListener("mouseup", clearDragState, true);
  window.addEventListener("blur", clearDragState);
  document.addEventListener("keydown", handleKeyDown, true);
}
