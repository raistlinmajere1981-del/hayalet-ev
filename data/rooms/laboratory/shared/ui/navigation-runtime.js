import {
  createLaboratoryWorkbenchState,
  normalizeLaboratoryFeatureId
} from "../host/runtime-primitives.js";
export function createLaboratoryUiNavigationRuntime(deps) {
  const {
    defaultFeatureId,
    documentRef,
    render,
    resolveLocale,
    roomId,
    stageOrder,
    state,
    toRecord
  } = deps;
  function toContextRecord(value) {
    return toRecord(value);
  }
  function toString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }
  function applyLocale(locale) {
    state.locale = resolveLocale(locale);
    documentRef.documentElement.lang = state.locale;
  }
  function normalizeUiScale(value) {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 100;
    }
    return Math.max(70, Math.min(130, Math.round(numeric)));
  }
  function formatScaleFactor(value) {
    return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }
  function applyPresentationMode(nextPresentation) {
    const presentation = nextPresentation && typeof nextPresentation === "object" && Array.isArray(nextPresentation) === false ? toRecord(nextPresentation) : { mode: nextPresentation };
    state.presentation.mode = presentation["mode"] === "scene-view" ? "scene-view" : "classic";
    state.presentation.uiScale = normalizeUiScale(presentation["uiScale"]);
    const scaleFactor = formatScaleFactor(state.presentation.uiScale / 100);
    documentRef.body.dataset["presentationMode"] = state.presentation.mode;
    documentRef.body.dataset["roomUiScale"] = String(state.presentation.uiScale);
    if (typeof documentRef.body?.style?.setProperty === "function") {
      documentRef.body.style.setProperty("--room-runtime-ui-scale-factor", scaleFactor);
    }
    documentRef.documentElement.dataset["presentationMode"] = state.presentation.mode;
    documentRef.documentElement.dataset["roomUiScale"] = String(state.presentation.uiScale);
    if (typeof documentRef.documentElement?.style?.setProperty === "function") {
      documentRef.documentElement.style.setProperty(
        "--room-runtime-ui-scale-factor",
        scaleFactor
      );
    }
  }
  function normalizeContext(message) {
    const source = toContextRecord(message);
    const room = toRecord(source.room);
    const user = toRecord(source.user);
    const presentation = toRecord(source.presentation);
    const activeFeature = toRecord(source.activeFeature);
    const requestedFeatureId = normalizeLaboratoryFeatureId(
      toString(activeFeature["id"]) || toString(source["featureId"]) || toString(toRecord(source["workbench"])["activeModuleId"]) || defaultFeatureId,
      defaultFeatureId
    );
    const workbench = createLaboratoryWorkbenchState({
      ...toRecord(source["workbench"]),
      primaryFeatureId: defaultFeatureId,
      activeModuleId: requestedFeatureId
    });
    return {
      featureId: workbench.activeModuleId,
      presentation: {
        mode: presentation["mode"] === "scene-view" ? "scene-view" : "classic",
        uiScale: normalizeUiScale(presentation["uiScale"])
      },
      room: {
        id: toString(room["id"]) || roomId,
        name: toString(room["name"]) || "Laboratory"
      },
      user: {
        nickname: toString(user["nickname"]) || "Operator"
      },
      workbench
    };
  }
  function getStageIndex(stageId) {
    return stageOrder.indexOf(stageId);
  }
  function requestSurfaceScrollReset() {
    state.ui.scrollPositions.surface = 0;
    state.ui.stackScrollPositions.main = 0;
    state.ui.stackScrollPositions.side = 0;
    state.ui.surfaceScrollResetPending = true;
  }
  function requestOverlayScrollReset() {
    state.ui.scrollPositions.overlay = 0;
    state.ui.overlayScrollResetPending = true;
  }
  function setStage(stageId) {
    if (stageOrder.includes(stageId) === false) {
      return;
    }
    if (state.activeStage === stageId) {
      return;
    }
    state.activeStage = stageId;
    requestSurfaceScrollReset();
    render();
  }
  function advanceStage(direction) {
    const currentIndex = getStageIndex(state.activeStage);
    const nextIndex = Math.max(0, Math.min(stageOrder.length - 1, currentIndex + direction));
    const nextStageId = stageOrder.at(nextIndex);
    if (!nextStageId) {
      return;
    }
    setStage(nextStageId);
  }
  function captureScrollState(root) {
    const surface = root.querySelector(".lab-surface");
    if (surface instanceof HTMLElement) {
      state.ui.scrollPositions.surface = surface.scrollTop;
    }
    const mainStack = root.querySelector(".lab-main-stack");
    if (mainStack instanceof HTMLElement) {
      state.ui.stackScrollPositions.main = mainStack.scrollTop;
    }
    const sideStack = root.querySelector(".lab-side-stack");
    if (sideStack instanceof HTMLElement) {
      state.ui.stackScrollPositions.side = sideStack.scrollTop;
    }
    const overlayPanel = root.querySelector(".lab-overlay__panel");
    if (overlayPanel instanceof HTMLElement) {
      state.ui.scrollPositions.overlay = overlayPanel.scrollTop;
    }
  }
  function restoreScrollState(root) {
    const surface = root.querySelector(".lab-surface");
    if (surface instanceof HTMLElement) {
      surface.scrollTop = state.ui.surfaceScrollResetPending ? 0 : state.ui.scrollPositions.surface;
    }
    const mainStack = root.querySelector(".lab-main-stack");
    if (mainStack instanceof HTMLElement) {
      mainStack.scrollTop = state.ui.surfaceScrollResetPending ? 0 : state.ui.stackScrollPositions.main;
    }
    const sideStack = root.querySelector(".lab-side-stack");
    if (sideStack instanceof HTMLElement) {
      sideStack.scrollTop = state.ui.surfaceScrollResetPending ? 0 : state.ui.stackScrollPositions.side;
    }
    state.ui.surfaceScrollResetPending = false;
    const overlayPanel = root.querySelector(".lab-overlay__panel");
    if (overlayPanel instanceof HTMLElement) {
      overlayPanel.scrollTop = state.ui.overlayScrollResetPending ? 0 : state.ui.scrollPositions.overlay;
    }
    state.ui.overlayScrollResetPending = false;
  }
  return {
    advanceStage,
    applyLocale,
    applyPresentationMode,
    captureScrollState,
    getStageIndex,
    normalizeContext,
    requestOverlayScrollReset,
    requestSurfaceScrollReset,
    restoreScrollState,
    setStage
  };
}
