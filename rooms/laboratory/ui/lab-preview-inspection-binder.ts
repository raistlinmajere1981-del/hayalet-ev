type PreviewInspectionBinderDeps = {
  controller: {
    captureSnapshot: () => Promise<boolean> | boolean;
    clearFocus: () => boolean;
    clearSnapshot: () => boolean;
    stepFrame: (direction: -1 | 1) => boolean;
    toggleFocus: () => boolean;
  };
  documentRef: Pick<Document, "addEventListener" | "removeEventListener">;
};

type ClosestCapableTarget = EventTarget & {
  closest: (selector: string) => Element | null;
};

function isClosestCapableTarget(value: EventTarget | null): value is ClosestCapableTarget {
  return typeof value === "object" && value !== null && "closest" in value;
}

function isEditableTarget(target: EventTarget | null) {
  if (!isClosestCapableTarget(target)) {
    return false;
  }
  return target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

function consumeEvent(event: Event) {
  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
    return;
  }
  if (typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
}

export function bindLabPreviewInspectionInteractions(deps: PreviewInspectionBinderDeps) {
  let interactionArmed = false;

  function setArmedFromTarget(target: EventTarget | null) {
    if (!isClosestCapableTarget(target)) {
      interactionArmed = false;
      return;
    }
    interactionArmed =
      target.closest("[data-lab-preview-inspection-stage='true']") !== null ||
      target.closest("[data-lab-selection-panel='true']") !== null;
  }

  function handleClick(event: Event) {
    const target = event.target;
    if (!isClosestCapableTarget(target)) {
      interactionArmed = false;
      return;
    }

    const focusToggle = target.closest("[data-lab-selection-roi-focus-toggle]");
    if (focusToggle !== null) {
      interactionArmed = true;
      consumeEvent(event);
      void deps.controller.toggleFocus();
      return;
    }

    const focusReset = target.closest("[data-lab-selection-roi-focus-reset]");
    if (focusReset !== null) {
      interactionArmed = true;
      if (deps.controller.clearFocus()) {
        consumeEvent(event);
      }
      return;
    }

    const captureRegion = target.closest("[data-lab-selection-roi-capture]");
    if (captureRegion !== null) {
      interactionArmed = true;
      consumeEvent(event);
      void deps.controller.captureSnapshot();
      return;
    }

    const clearSnapshot = target.closest("[data-lab-selection-roi-snapshot-clear]");
    if (clearSnapshot !== null) {
      interactionArmed = true;
      if (deps.controller.clearSnapshot()) {
        consumeEvent(event);
      }
      return;
    }

    const frameStep = target.closest("[data-lab-selection-roi-frame-step]");
    if (frameStep !== null) {
      const directionValue = frameStep.getAttribute("data-lab-selection-roi-frame-step");
      const direction = directionValue === "-1" ? -1 : directionValue === "1" ? 1 : null;
      if (direction !== null && deps.controller.stepFrame(direction)) {
        interactionArmed = true;
        consumeEvent(event);
      }
      return;
    }

    setArmedFromTarget(target);
  }

  function handleDoubleClick(event: Event) {
    const target = event.target;
    if (!isClosestCapableTarget(target)) {
      return;
    }
    if (target.closest("[data-lab-selection-roi='true']") === null) {
      return;
    }
    interactionArmed = true;
    consumeEvent(event);
    void deps.controller.toggleFocus();
  }

  function handleKeyDown(event: Event) {
    const keyboardEvent = event as Event & { key?: string; target?: EventTarget | null };
    if (interactionArmed !== true || isEditableTarget(keyboardEvent.target ?? null)) {
      return;
    }
    if (keyboardEvent.key === "Escape") {
      if (deps.controller.clearFocus()) {
        consumeEvent(event);
      }
      return;
    }
    if (keyboardEvent.key === "ArrowLeft" && deps.controller.stepFrame(-1)) {
      consumeEvent(event);
      return;
    }
    if (keyboardEvent.key === "ArrowRight" && deps.controller.stepFrame(1)) {
      consumeEvent(event);
    }
  }

  deps.documentRef.addEventListener("click", handleClick);
  deps.documentRef.addEventListener("dblclick", handleDoubleClick);
  deps.documentRef.addEventListener("keydown", handleKeyDown);

  return function unbind() {
    deps.documentRef.removeEventListener("click", handleClick);
    deps.documentRef.removeEventListener("dblclick", handleDoubleClick);
    deps.documentRef.removeEventListener("keydown", handleKeyDown);
  };
}
