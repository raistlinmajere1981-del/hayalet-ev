import type {
  LabComparisonSide,
  LabInspectionMode,
  LabSelection,
  LabSelectionROI,
  LabStoreEvent,
} from "../domain/lab-types.js";
import { bindLabDocumentEvents, isClosestCapableTarget } from "./lab-dom-events.js";

const MIN_SELECTION_ROI_SIZE_PX = 8;
const SELECTION_ROI_RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type SelectionRoiResizeHandle = (typeof SELECTION_ROI_RESIZE_HANDLES)[number];
type VisualStressRoiRole = "target" | "background";

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
  querySelector?: (selector: string) => StageElement | null;
};

type SelectionRoiBinderDeps = {
  documentRef: Pick<Document, "addEventListener" | "removeEventListener">;
  emit: (event: LabStoreEvent) => void;
  getActiveSelection: () => LabSelection | null;
  getComparisonRoi?: (side: LabComparisonSide) => LabSelectionROI | null;
  getSourceKind: () => string;
  isMutationLocked?: () => boolean;
};

type DrawDragState = {
  comparisonSide: LabComparisonSide | null;
  lastSignature: string | null;
  mode: "draw";
  stage: StageElement;
  startX: number;
  startY: number;
};

type ResizeDragState = {
  comparisonSide: LabComparisonSide | null;
  handle: SelectionRoiResizeHandle;
  initialRoi: LabSelectionROI;
  lastSignature: string | null;
  mode: "resize";
  stage: StageElement;
  startX: number;
  startY: number;
};

type DragState = DrawDragState | ResizeDragState;

type MouseLikeEvent = Event & {
  button?: number;
  clientX?: number;
  clientY?: number;
  key?: string;
  preventDefault: () => void;
  target?: EventTarget | null;
};

type QueryableDocument = {
  documentElement?: Element | null;
  querySelectorAll?: (selector: string) => NodeListOf<Element>;
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

function clampUnit(value: number) {
  if (Number.isFinite(value) !== true) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function isSelectionRoiResizeHandle(value: string | null): value is SelectionRoiResizeHandle {
  return SELECTION_ROI_RESIZE_HANDLES.some(function (handle) {
    return handle === value;
  });
}

function isVisualStressRoiRole(value: string | null): value is VisualStressRoiRole {
  return value === "target" || value === "background";
}

function getComparisonSideFromStage(stage: StageElement): LabComparisonSide | null {
  const side = stage.getAttribute("data-lab-comparison-roi-side");
  return side === "primary" || side === "reference" ? side : null;
}

function getSelectionRoiRect(stage: StageElement) {
  const mediaFrame =
    typeof stage.querySelector === "function"
      ? stage.querySelector("[data-lab-selection-roi-frame='true']")
      : null;
  return mediaFrame?.getBoundingClientRect() || stage.getBoundingClientRect();
}

function activateComparisonSide(deps: SelectionRoiBinderDeps, stage: StageElement | null) {
  if (stage === null) {
    return;
  }
  const comparisonSide = getComparisonSideFromStage(stage);
  if (comparisonSide === null) {
    return;
  }
  deps.emit({
    type: "workspace-comparison-side-activated",
    side: comparisonSide,
  });
}

function createSelectionRoiResult(roi: LabSelectionROI, rect: RectLike) {
  const x = clampUnit(roi.x);
  const y = clampUnit(roi.y);
  const width = Math.max(0, Math.min(1 - x, roi.width));
  const height = Math.max(0, Math.min(1 - y, roi.height));
  const widthPx = width * rect.width;
  const heightPx = height * rect.height;

  if (widthPx < MIN_SELECTION_ROI_SIZE_PX || heightPx < MIN_SELECTION_ROI_SIZE_PX) {
    return null;
  }

  return {
    roi: {
      x,
      y,
      width,
      height,
    } satisfies LabSelectionROI,
    signature: `${Math.round(x * 10000)}:${Math.round(y * 10000)}:${Math.round(width * 10000)}:${Math.round(height * 10000)}`,
  };
}

function createSelectionRoiFromDrag(
  stage: StageElement,
  dragState: DrawDragState,
  event: MouseLikeEvent
) {
  const rect = getSelectionRoiRect(stage);
  const currentPoint = clampPointToRect(event, rect);
  const left = Math.min(dragState.startX, currentPoint.x);
  const top = Math.min(dragState.startY, currentPoint.y);
  const widthPx = Math.abs(currentPoint.x - dragState.startX);
  const heightPx = Math.abs(currentPoint.y - dragState.startY);

  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    widthPx < MIN_SELECTION_ROI_SIZE_PX ||
    heightPx < MIN_SELECTION_ROI_SIZE_PX
  ) {
    return null;
  }

  return createSelectionRoiResult(
    {
      x: (left - rect.left) / rect.width,
      y: (top - rect.top) / rect.height,
      width: widthPx / rect.width,
      height: heightPx / rect.height,
    },
    rect
  );
}

function createSelectionRoiFromResize(
  stage: StageElement,
  dragState: ResizeDragState,
  event: MouseLikeEvent
) {
  const rect = getSelectionRoiRect(stage);
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const currentPoint = clampPointToRect(event, rect);
  const nextX = clampUnit((currentPoint.x - rect.left) / rect.width);
  const nextY = clampUnit((currentPoint.y - rect.top) / rect.height);
  const handle = dragState.handle;
  let left = clampUnit(dragState.initialRoi.x);
  let top = clampUnit(dragState.initialRoi.y);
  let right = clampUnit(dragState.initialRoi.x + dragState.initialRoi.width);
  let bottom = clampUnit(dragState.initialRoi.y + dragState.initialRoi.height);
  const minWidth = MIN_SELECTION_ROI_SIZE_PX / rect.width;
  const minHeight = MIN_SELECTION_ROI_SIZE_PX / rect.height;

  if (handle.indexOf("w") >= 0) {
    left = nextX;
  }
  if (handle.indexOf("e") >= 0) {
    right = nextX;
  }
  if (handle.indexOf("n") >= 0) {
    top = nextY;
  }
  if (handle.indexOf("s") >= 0) {
    bottom = nextY;
  }

  if (right - left < minWidth) {
    if (handle.indexOf("w") >= 0) {
      left = Math.max(0, right - minWidth);
    } else {
      right = Math.min(1, left + minWidth);
    }
  }
  if (bottom - top < minHeight) {
    if (handle.indexOf("n") >= 0) {
      top = Math.max(0, bottom - minHeight);
    } else {
      bottom = Math.min(1, top + minHeight);
    }
  }

  return createSelectionRoiResult(
    {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    },
    rect
  );
}

function canDrawSelectionRoi(activeSelection: LabSelection | null, sourceKind: string) {
  if (sourceKind === "image" || sourceKind === "video") {
    return true;
  }
  return activeSelection !== null && activeSelection.endMs > activeSelection.startMs;
}

function formatVisualStressRoiStyle(roi: LabSelectionROI) {
  return [
    `left: ${String(roi.x * 100)}%`,
    `top: ${String(roi.y * 100)}%`,
    `width: ${String(roi.width * 100)}%`,
    `height: ${String(roi.height * 100)}%`,
  ].join("; ");
}

function formatVisualStressRoiSignature(roi: LabSelectionROI) {
  return `${roi.x}:${roi.y}:${roi.width}:${roi.height}`;
}

function renderVisualStressResizeHandles(role: VisualStressRoiRole) {
  return SELECTION_ROI_RESIZE_HANDLES.map(function (handle) {
    return `<button class="labx-selection-roi__resize-handle labx-selection-roi__resize-handle--${handle}" type="button" data-lab-selection-roi-resize="${handle}" data-lab-selection-roi-ignore="true" data-lab-visual-stress-roi-role="${role}" aria-label="Resize ${role} ROI" title="Resize ${role} ROI"></button>`;
  }).join("");
}

export function bindLabSelectionRoiInteractions(deps: SelectionRoiBinderDeps) {
  let dragState: DragState | null = null;
  let activeVisualStressRole: VisualStressRoiRole = "target";
  let dualRoiObserver: MutationObserver | null = null;
  let dualRoiSyncQueued = false;

  function isMutationLocked() {
    return deps.isMutationLocked?.() === true;
  }

  function queryAll(selector: string) {
    const documentRef = deps.documentRef as typeof deps.documentRef & QueryableDocument;
    if (typeof documentRef.querySelectorAll !== "function") {
      return [] as Element[];
    }
    return Array.from(documentRef.querySelectorAll(selector));
  }

  function isDualVisualStressActive() {
    return (
      deps.getSourceKind() === "video" &&
      queryAll("[data-lab-transform-stack][data-lab-transform-source-kind='video']").length > 0 &&
      queryAll("[data-lab-control-injection='true']").length > 0
    );
  }

  function getVisualStressRoleFromTarget(target: EventTarget | null) {
    const trigger = getClosestTarget(target, "[data-lab-visual-stress-roi-role]");
    if (trigger === null) {
      return null;
    }
    const role = trigger.getAttribute("data-lab-visual-stress-roi-role");
    return isVisualStressRoiRole(role) ? role : null;
  }

  function resolveInteractionComparisonSide(
    target: EventTarget | null,
    stage: StageElement | null
  ): LabComparisonSide | null {
    if (isDualVisualStressActive()) {
      const explicitRole = getVisualStressRoleFromTarget(target);
      if (explicitRole !== null) {
        activeVisualStressRole = explicitRole;
      }
      return (explicitRole ?? activeVisualStressRole) === "background" ? "reference" : null;
    }
    return stage === null ? null : getComparisonSideFromStage(stage);
  }

  function syncVisualStressRoleControls() {
    const targetRoi = deps.getActiveSelection()?.roi ?? null;
    const backgroundRoi = deps.getComparisonRoi?.("reference") ?? null;
    queryAll("[data-lab-control-injection='true']").forEach(function (panel) {
      const body = panel.querySelector(".labx-card__body");
      if (body === null) {
        return;
      }
      let controls = body.querySelector("[data-lab-visual-stress-roi-controls='true']");
      if (controls === null) {
        body.insertAdjacentHTML(
          "afterbegin",
          `<div class="labx-visual-stress-roi-controls" data-lab-visual-stress-roi-controls="true">
            <div class="labx-controls-actions labx-visual-stress-roi-controls__actions">
              <button class="labx-inline-action labx-visual-stress-roi-role labx-visual-stress-roi-role--target" type="button" data-lab-visual-stress-roi-role-control="true" data-lab-visual-stress-roi-role="target">Target ROI</button>
              <button class="labx-inline-action labx-visual-stress-roi-role labx-visual-stress-roi-role--background" type="button" data-lab-visual-stress-roi-role-control="true" data-lab-visual-stress-roi-role="background">Background ROI</button>
            </div>
            <p class="labx-card__meta labx-visual-stress-roi-controls__status" data-lab-visual-stress-roi-status="true"></p>
          </div>`
        );
        controls = body.querySelector("[data-lab-visual-stress-roi-controls='true']");
      }
      if (controls === null) {
        return;
      }
      controls.querySelectorAll("[data-lab-visual-stress-roi-role-control='true']").forEach(function (button) {
        const role = button.getAttribute("data-lab-visual-stress-roi-role");
        const active = role === activeVisualStressRole;
        button.setAttribute("data-active", active ? "true" : "false");
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const status = controls.querySelector("[data-lab-visual-stress-roi-status='true']");
      if (status !== null) {
        const nextStatus = `Target ROI ${targetRoi === null ? "—" : "✓"} · Background ROI ${backgroundRoi === null ? "—" : "✓"} · Select role, then draw/resize on preview.`;
        if (status.textContent !== nextStatus) {
          status.textContent = nextStatus;
        }
      }
    });
  }

  function syncTransformBackgroundRoiAttribute() {
    const backgroundRoi = deps.getComparisonRoi?.("reference") ?? null;
    const serialized = JSON.stringify(backgroundRoi);
    queryAll("[data-lab-transform-stack][data-lab-transform-source-kind='video']").forEach(function (root) {
      if (root.getAttribute("data-lab-visual-stress-background-roi-json") !== serialized) {
        root.setAttribute("data-lab-visual-stress-background-roi-json", serialized);
      }
    });
  }

  function restoreTargetOverlay(targetOverlay: Element) {
    const originalLabel = targetOverlay.getAttribute("data-lab-visual-stress-original-label");
    const label = targetOverlay.querySelector(".labx-selection-roi__label");
    if (label !== null && originalLabel !== null) {
      label.textContent = originalLabel;
    }
    targetOverlay.removeAttribute("data-lab-visual-stress-original-label");
    targetOverlay.removeAttribute("data-lab-visual-stress-roi-role");
    targetOverlay.removeAttribute("data-active");
    targetOverlay.classList.remove(
      "labx-selection-roi--visual-target",
      "labx-selection-roi--visual-active"
    );
  }

  function syncVisualStressOverlays() {
    const dualActive = isDualVisualStressActive();
    const backgroundRoi = deps.getComparisonRoi?.("reference") ?? null;
    const videoOverlays = queryAll(
      "[data-lab-selection-roi-overlay='true'][data-lab-source-kind='video']"
    ).filter(function (overlay) {
      return overlay.closest("[data-lab-comparison-roi-side]") === null;
    });

    if (!dualActive) {
      activeVisualStressRole = "target";
      queryAll(".labx-selection-roi--visual-target").forEach(restoreTargetOverlay);
      queryAll("[data-lab-visual-stress-background-overlay='true']").forEach(function (overlay) {
        overlay.remove();
      });
      return;
    }

    videoOverlays.forEach(function (overlay) {
      const targetOverlay = overlay.querySelector("[data-lab-selection-roi='true']");
      if (targetOverlay !== null) {
        const label = targetOverlay.querySelector(".labx-selection-roi__label");
        if (
          label !== null &&
          targetOverlay.getAttribute("data-lab-visual-stress-original-label") === null
        ) {
          targetOverlay.setAttribute(
            "data-lab-visual-stress-original-label",
            label.textContent || "Inspection ROI"
          );
        }
        if (label !== null && label.textContent !== "Target ROI") {
          label.textContent = "Target ROI";
        }
        targetOverlay.setAttribute("data-lab-visual-stress-roi-role", "target");
        targetOverlay.setAttribute(
          "data-active",
          activeVisualStressRole === "target" ? "true" : "false"
        );
        targetOverlay.classList.add("labx-selection-roi--visual-target");
        targetOverlay.classList.toggle(
          "labx-selection-roi--visual-active",
          activeVisualStressRole === "target"
        );
      }

      const existingBackground = overlay.querySelector(
        "[data-lab-visual-stress-background-overlay='true']"
      );
      if (backgroundRoi === null) {
        existingBackground?.remove();
        return;
      }

      const signature = formatVisualStressRoiSignature(backgroundRoi);
      if (existingBackground === null) {
        overlay.insertAdjacentHTML(
          "beforeend",
          `<div class="labx-selection-roi labx-selection-roi--visual-background${activeVisualStressRole === "background" ? " labx-selection-roi--visual-active" : ""}" style="${formatVisualStressRoiStyle(backgroundRoi)}" data-lab-selection-roi="background" data-lab-selection-roi-ignore="true" data-lab-visual-stress-background-overlay="true" data-lab-visual-stress-roi-role="background" data-lab-visual-stress-roi-signature="${signature}" data-active="${activeVisualStressRole === "background" ? "true" : "false"}">
            <div class="labx-selection-roi__label">Background ROI</div>
            <button class="labx-selection-roi__clear" type="button" data-lab-selection-roi-clear="true" data-lab-selection-roi-ignore="true" data-lab-visual-stress-roi-role="background" aria-label="Clear background ROI" title="Clear background ROI">&times;</button>
            ${renderVisualStressResizeHandles("background")}
          </div>`
        );
        return;
      }

      if (existingBackground.getAttribute("data-lab-visual-stress-roi-signature") !== signature) {
        existingBackground.setAttribute("style", formatVisualStressRoiStyle(backgroundRoi));
        existingBackground.setAttribute("data-lab-visual-stress-roi-signature", signature);
      }
      existingBackground.setAttribute(
        "data-active",
        activeVisualStressRole === "background" ? "true" : "false"
      );
      existingBackground.classList.toggle(
        "labx-selection-roi--visual-active",
        activeVisualStressRole === "background"
      );
    });
  }

  function syncDualRoiDom() {
    if (!isDualVisualStressActive()) {
      syncVisualStressOverlays();
      return;
    }
    syncVisualStressRoleControls();
    syncTransformBackgroundRoiAttribute();
    syncVisualStressOverlays();
  }

  function scheduleDualRoiSync() {
    if (dualRoiSyncQueued) {
      return;
    }
    dualRoiSyncQueued = true;
    void Promise.resolve().then(function () {
      dualRoiSyncQueued = false;
      syncDualRoiDom();
    });
  }

  function handleClick(event: Event) {
    const target = event.target;
    const roleControl = getClosestTarget(target, "[data-lab-visual-stress-roi-role-control='true']");
    if (roleControl !== null) {
      const role = roleControl.getAttribute("data-lab-visual-stress-roi-role");
      if (!isVisualStressRoiRole(role) || !isDualVisualStressActive()) {
        return;
      }
      event.preventDefault();
      activeVisualStressRole = role;
      syncDualRoiDom();
      return;
    }

    const clearTrigger = getClosestTarget(target, "[data-lab-selection-roi-clear]");
    if (clearTrigger) {
      if (isMutationLocked()) {
        return;
      }
      event.preventDefault();
      const stage = getClosestTarget(target, "[data-lab-selection-roi-stage='true']");
      const comparisonSide = resolveInteractionComparisonSide(target, stage);
      deps.emit({
        type: "selection-roi-cleared",
        ...(comparisonSide === null ? {} : { comparisonSide }),
      });
      scheduleDualRoiSync();
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
    const resizeTrigger = getClosestTarget(target, "[data-lab-selection-roi-resize]");
    if (resizeTrigger) {
      if (isMutationLocked()) {
        return;
      }
      const handle = resizeTrigger.getAttribute("data-lab-selection-roi-resize");
      const stage = getClosestTarget(target, "[data-lab-selection-roi-stage='true']");
      activateComparisonSide(deps, stage);
      const activeSelection = deps.getActiveSelection();
      const visualRole = isDualVisualStressActive() ? getVisualStressRoleFromTarget(target) : null;
      if (visualRole !== null) {
        activeVisualStressRole = visualRole;
      }
      const comparisonSide = resolveInteractionComparisonSide(target, stage);
      const initialRoi =
        visualRole === "background"
          ? (deps.getComparisonRoi?.("reference") ?? null)
          : comparisonSide === null
            ? (activeSelection?.roi ?? null)
            : (deps.getComparisonRoi?.(comparisonSide) ?? activeSelection?.roi ?? null);
      if (
        !isSelectionRoiResizeHandle(handle) ||
        !stage ||
        initialRoi === null ||
        !canDrawSelectionRoi(activeSelection, deps.getSourceKind())
      ) {
        return;
      }
      const startPoint = clampPointToRect(event, getSelectionRoiRect(stage));
      event.preventDefault();
      dragState = {
        comparisonSide,
        handle,
        initialRoi,
        lastSignature: null,
        mode: "resize",
        stage,
        startX: startPoint.x,
        startY: startPoint.y,
      };
      syncDualRoiDom();
      return;
    }

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
    activateComparisonSide(deps, stage);

    const sourceKind = deps.getSourceKind();
    if (!canDrawSelectionRoi(deps.getActiveSelection(), sourceKind)) {
      return;
    }

    const rect = getSelectionRoiRect(stage);
    const reserveBottom = getReserveBottom(stage);
    const startPoint = clampPointToRect(event, rect);
    if (startPoint.y > rect.bottom - reserveBottom) {
      return;
    }

    event.preventDefault();
    dragState = {
      comparisonSide: resolveInteractionComparisonSide(target, stage),
      lastSignature: null,
      mode: "draw",
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
    const nextSelectionRoi =
      dragState.mode === "resize"
        ? createSelectionRoiFromResize(dragState.stage, dragState, event)
        : createSelectionRoiFromDrag(dragState.stage, dragState, event);
    if (nextSelectionRoi === null || dragState.lastSignature === nextSelectionRoi.signature) {
      return;
    }

    dragState.lastSignature = nextSelectionRoi.signature;
    event.preventDefault();
    deps.emit({
      type: "selection-roi-updated",
      roi: nextSelectionRoi.roi,
      ...(dragState.comparisonSide === null ? {} : { comparisonSide: dragState.comparisonSide }),
    });
    scheduleDualRoiSync();
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

  const unbindDocumentEvents = bindLabDocumentEvents(deps.documentRef, [
    { type: "click", listener: handleClick },
    { type: "mousedown", listener: handleMouseDown },
    { type: "mousemove", listener: handleMouseMove },
    { type: "mouseup", listener: handleMouseUp },
    { type: "keydown", listener: handleKeyDown },
  ]);

  const queryableDocument = deps.documentRef as typeof deps.documentRef & QueryableDocument;
  if (
    typeof MutationObserver !== "undefined" &&
    queryableDocument.documentElement instanceof Element &&
    typeof queryableDocument.querySelectorAll === "function"
  ) {
    dualRoiObserver = new MutationObserver(scheduleDualRoiSync);
    dualRoiObserver.observe(queryableDocument.documentElement, {
      childList: true,
      subtree: true,
    });
    scheduleDualRoiSync();
  }

  return function detachSelectionRoiInteractions() {
    dualRoiObserver?.disconnect();
    dualRoiObserver = null;
    unbindDocumentEvents();
  };
}
