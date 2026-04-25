const MIN_SELECTION_ROI_SIZE_PX = 8;
function isClosestCapableTarget(value) {
  return typeof value === "object" && value !== null && "closest" in value;
}
function getClosestTarget(target, selector) {
  if (!isClosestCapableTarget(target)) {
    return null;
  }
  return target.closest(selector);
}
function getReserveBottom(stage) {
  const rawValue = Number(stage.getAttribute("data-lab-selection-roi-controls-reserve") || "0");
  return Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
}
function clampPointToRect(event, rect) {
  const rawX = typeof event.clientX === "number" ? event.clientX : rect.left;
  const rawY = typeof event.clientY === "number" ? event.clientY : rect.top;
  return {
    x: Math.max(rect.left, Math.min(rect.left + rect.width, rawX)),
    y: Math.max(rect.top, Math.min(rect.top + rect.height, rawY))
  };
}
function createSelectionRoiFromDrag(stage, dragState, event) {
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
      height: heightPx / rect.height
    },
    signature: `${Math.round(left)}:${Math.round(top)}:${Math.round(widthPx)}:${Math.round(heightPx)}`
  };
}
function canDrawSelectionRoi(activeSelection, sourceKind) {
  if (sourceKind === "image") {
    return true;
  }
  return activeSelection !== null && activeSelection.endMs > activeSelection.startMs;
}
export function bindLabSelectionRoiInteractions(deps) {
  let dragState = null;
  function handleClick(event) {
    const target = event.target;
    const clearTrigger = getClosestTarget(target, "[data-lab-selection-roi-clear]");
    if (clearTrigger) {
      event.preventDefault();
      deps.emit({
        type: "selection-roi-cleared"
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
        mode: nextMode.trim()
      });
    }
  }
  function handleMouseDown(rawEvent) {
    const event = rawEvent;
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
      startY: startPoint.y
    };
  }
  function handleMouseMove(rawEvent) {
    if (dragState === null) {
      return;
    }
    const event = rawEvent;
    const nextSelectionRoi = createSelectionRoiFromDrag(dragState.stage, dragState, event);
    if (nextSelectionRoi === null || dragState.lastSignature === nextSelectionRoi.signature) {
      return;
    }
    dragState.lastSignature = nextSelectionRoi.signature;
    event.preventDefault();
    deps.emit({
      type: "selection-roi-updated",
      roi: nextSelectionRoi.roi
    });
  }
  function handleMouseUp() {
    dragState = null;
  }
  function handleKeyDown(rawEvent) {
    const event = rawEvent;
    if (dragState === null || event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    dragState = null;
  }
  deps.documentRef.addEventListener("click", handleClick);
  deps.documentRef.addEventListener("mousedown", handleMouseDown);
  deps.documentRef.addEventListener("mousemove", handleMouseMove);
  deps.documentRef.addEventListener("mouseup", handleMouseUp);
  deps.documentRef.addEventListener("keydown", handleKeyDown);
  return function unbind() {
    deps.documentRef.removeEventListener("click", handleClick);
    deps.documentRef.removeEventListener("mousedown", handleMouseDown);
    deps.documentRef.removeEventListener("mousemove", handleMouseMove);
    deps.documentRef.removeEventListener("mouseup", handleMouseUp);
    deps.documentRef.removeEventListener("keydown", handleKeyDown);
  };
}
