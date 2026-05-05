import type {
  LabInspectionMode,
  LabSelection,
  LabSelectionROI,
  LabStoreEvent,
} from "../models/lab-types.js";
import { bindLabDocumentEvents, isClosestCapableTarget } from "./lab-dom-events.js";

const MIN_SELECTION_ROI_SIZE_PX = 8;

type RectLike = {
  bottom: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

type StageElement = {
  closest: (selector: string) => StageElement | null;
  getAttribute: (name: string) => string | null;
  getBoundingClientRect: () => RectLike;
};

type SelectionRoiBinderDeps = {
  documentRef: Pick<Document, "addEventListener" | "removeEventListener">;
  emit: (event: LabStoreEvent) => void;
  getActiveSelection: () => LabSelection | null;
  getSourceKind: () => string;
  isMutationLocked?: () => boolean;
};

type DragState = {
  lastSignature: string | null;
  stage: StageElement;
  startX: number;
  startY: number;
};

type MouseLikeEvent = Event & {
  button?: number;
  clientX?: number;
  clientY?: number;
  key?: string;
  preventDefault: () => void;
  target?: EventTarget | null;
};

function getClosestTarget(target: EventTarget | null, selector: string): StageElement | null {
  if (!isClosestCapableTarget<StageElement>(target)) {
    return null;
  }
  return target.closest(selector);
}

function getReserveBottom(stage: StageElement) {
  const rawValue = Number(stage.getAttribute("data-lab-selection-roi-controls-reserve") || "0");
  return Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
}

function clampPointToRect(event: MouseLikeEvent, rect: RectLike) {
  const rawX = typeof event.clientX === "number" ? event.clientX : rect.left;
  const rawY = typeof event.clientY === "number" ? event.clientY : rect.top;
  return {
    x: Math.max(rect.left, Math.min(rect.left + rect.width, rawX)),
    y: Math.max(rect.top, Math.min(rect.top + rect.height, rawY)),
  };
}

function createSelectionRoiFromDrag(
  stage: StageElement,
  dragState: DragState,
  event: MouseLikeEvent
) {
  const rect = stage.getBoundingClientRect();
  const currentPoint = clampPointToRect(event, rect);
  const left = Math.min(dragState.startX, currentPoint.x);
  const top = Math.min(dragState.startY, currentPoint.y);
  const widthPx = Math.abs(currentPoint.x - dragState.startX);
  const heightPx = Math.abs(currentPoint.y - dragState.startY);

  if (widthPx < MIN_SELECTION_ROI_SIZE_PX || heightPx < MIN_SELECTION_ROI_SIZE_PX) {
    return null;
  }

  return {
    roi: {
      x: (left - rect.left) / rect.width,
      y: (top - rect.top) / rect.height,
      width: widthPx / rect.width,
      height: heightPx / rect.height,
    } satisfies LabSelectionROI,
    signature: `${Math.round(left)}:${Math.round(top)}:${Math.round(widthPx)}:${Math.round(heightPx)}`,
  };
}

function canDrawSelectionRoi(activeSelection: LabSelection | null, sourceKind: string) {
  if (sourceKind === "image") {
    return true;
  }
  return activeSelection !== null && activeSelection.endMs > activeSelection.startMs;
}

export function bindLabSelectionRoiInteractions(deps: SelectionRoiBinderDeps) {
  let dragState: DragState | null = null;

  function isMutationLocked() {
    return deps.isMutationLocked?.() === true;
  }

  function handleClick(event: Event) {
    const target = event.target;
    const clearTrigger = getClosestTarget(target, "[data-lab-selection-roi-clear]");
    if (clearTrigger) {
      if (isMutationLocked()) {
        return;
      }
      event.preventDefault();
      deps.emit({
        type: "selection-roi-cleared",
      });
      return;
    }

    const inspectionTrigger = getClosestTarget(target, "[data-lab-selection-inspection-mode]");
    if (inspectionTrigger) {
      const nextMode = inspectionTrigger.getAttribute("data-lab-selection-inspection-mode");
      if (typeof nextMode !== "string" || nextMode.trim() === "") {
        return;
      }
      event.preventDefault();
      deps.emit({
        type: "selection-inspection-mode-updated",
        mode: nextMode.trim() as LabInspectionMode,
      });
    }
  }

  function handleMouseDown(rawEvent: Event) {
    const event = rawEvent as MouseLikeEvent;
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }

    const target = event.target ?? null;
    if (getClosestTarget(target, "[data-lab-selection-roi-ignore='true']")) {
      return;
    }

    const stage = getClosestTarget(target, "[data-lab-selection-roi-stage='true']");
    if (!stage) {
      return;
    }
    if (isMutationLocked()) {
      return;
    }

    const sourceKind = deps.getSourceKind();
    if (!canDrawSelectionRoi(deps.getActiveSelection(), sourceKind)) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    const reserveBottom = getReserveBottom(stage);
    const startPoint = clampPointToRect(event, rect);
    if (startPoint.y > rect.bottom - reserveBottom) {
      return;
    }

    event.preventDefault();
    dragState = {
      lastSignature: null,
      stage,
      startX: startPoint.x,
      startY: startPoint.y,
    };
  }

  function handleMouseMove(rawEvent: Event) {
    if (dragState === null) {
      return;
    }
    if (isMutationLocked()) {
      dragState = null;
      return;
    }
    const event = rawEvent as MouseLikeEvent;
    const nextSelectionRoi = createSelectionRoiFromDrag(dragState.stage, dragState, event);
    if (nextSelectionRoi === null || dragState.lastSignature === nextSelectionRoi.signature) {
      return;
    }

    dragState.lastSignature = nextSelectionRoi.signature;
    event.preventDefault();
    deps.emit({
      type: "selection-roi-updated",
      roi: nextSelectionRoi.roi,
    });
  }

  function handleMouseUp() {
    dragState = null;
  }

  function handleKeyDown(rawEvent: Event) {
    const event = rawEvent as MouseLikeEvent;
    if (dragState === null || event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    dragState = null;
  }

  return bindLabDocumentEvents(deps.documentRef, [
    { type: "click", listener: handleClick },
    { type: "mousedown", listener: handleMouseDown },
    { type: "mousemove", listener: handleMouseMove },
    { type: "mouseup", listener: handleMouseUp },
    { type: "keydown", listener: handleKeyDown },
  ]);
}
