import { asLabRecord, asNonEmptyString } from "../models/lab-types.js";
import type { LabStoreState, LabWorkspaceSurface } from "../models/lab-types.js";
import { createLabEventBus } from "../runtime/lab-event-bus.js";
import { createLabExecutionDispatcher } from "../runtime/lab-execution-dispatcher.js";
import { createLabHostBridge } from "../runtime/lab-host-bridge.js";
import { loadLabPersistedState, saveLabPersistedState } from "../runtime/lab-persistence.js";
import { createLabStore } from "../runtime/lab-store.js";
import { renderLabCenterPanel } from "./lab-center-panel.js";
import { getLabLayoutKind, renderLabBootOverlay, renderLabLayout } from "./lab-layout.js";
import { renderLabDrawer } from "./lab-drawer.js";
import { renderLabProcessStrip } from "./lab-process-strip.js";
import { renderLabTopBar } from "./lab-top-bar.js";
import { bindLabAssetPreviewClicks } from "./lab-asset-preview-binder.js";
import { getLabAssetPreviewUrl } from "./lab-asset-display.js";
import { bindLabPreviewInspectionInteractions } from "./lab-preview-inspection-binder.js";
import { createLabPreviewInspectionController } from "./lab-preview-inspection-controller.js";
import { bindLabSelectionIntentClicks } from "./lab-selection-intent-binder.js";
import { bindLabSelectionRoiInteractions } from "./lab-selection-roi-binder.js";
import { bindLabSelectionSuggestionClicks } from "./lab-selection-suggestion-binder.js";
import { renderWorkspaceSurface } from "./workspace-surface.js";
import { renderYoutubeImportWorkspaceMarkup } from "./youtube-import-workspace.js";
import { createLabRunController } from "../runtime/lab-run-controller.js";
import { renderToolManagementOverlay } from "./tool-management-overlay.js";
import { renderReportOverlay } from "./report-overlay.js";
import { renderProjectWorkspaceOverlay } from "./project-workspace-overlay.js";
import { renderLabAssetPreviewOverlay } from "./lab-asset-preview-overlay.js";
import {
  getActiveSelection,
  getActiveExecutionIntentId,
  getActiveInspectionSnapshot,
  getActiveSuggestionPreviewId,
  getExecutionDispatchCandidate,
  getRoiFocusActive,
  getWaveformTimelineModel,
  getDrawerCollapsed,
  getWorkspaceLockState,
  getWorkspaceMode,
  isRunActive,
  resolveDrawerMode,
} from "../runtime/lab-selectors.js";
import { createLabI18n } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import type { LabWaveformTimelineModel } from "./lab-waveform-timeline-types.js";

type RootWindow = Window & {
  roomAPI?: {
    onHostMessage?: (listener: (message: unknown) => void) => void;
    ready?: (payload: { feature: string; room: string; stage: string }) => void;
  };
};

function createRenderedElement(documentRef: Document, markup: string) {
  const template = documentRef.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

function readPreservedMediaKey(element: Element) {
  const key = element.getAttribute("data-lab-preserve-media");
  return typeof key === "string" && key.trim() !== "" ? key : null;
}

function readElementSource(element: Element) {
  const source = element.getAttribute("src");
  return typeof source === "string" && source.trim() !== "" ? source : null;
}

function canReuseElement(currentElement: Element, nextElement: Element) {
  if (currentElement.tagName !== nextElement.tagName) {
    return false;
  }

  const preserveKey = readPreservedMediaKey(currentElement) || readPreservedMediaKey(nextElement);
  if (!preserveKey) {
    return true;
  }

  return (
    readPreservedMediaKey(currentElement) === readPreservedMediaKey(nextElement) &&
    readElementSource(currentElement) === readElementSource(nextElement)
  );
}

function syncFormState(currentElement: Element, nextElement: Element) {
  if (
    typeof HTMLInputElement !== "undefined" &&
    currentElement instanceof HTMLInputElement &&
    nextElement instanceof HTMLInputElement
  ) {
    if (currentElement.type === "checkbox" || currentElement.type === "radio") {
      currentElement.checked = nextElement.checked;
      return;
    }
    if (currentElement.value !== nextElement.value) {
      currentElement.value = nextElement.value;
    }
    return;
  }

  if (
    typeof HTMLTextAreaElement !== "undefined" &&
    currentElement instanceof HTMLTextAreaElement &&
    nextElement instanceof HTMLTextAreaElement
  ) {
    if (currentElement.value !== nextElement.value) {
      currentElement.value = nextElement.value;
    }
    return;
  }

  if (
    typeof HTMLSelectElement !== "undefined" &&
    currentElement instanceof HTMLSelectElement &&
    nextElement instanceof HTMLSelectElement &&
    currentElement.value !== nextElement.value
  ) {
    currentElement.value = nextElement.value;
  }
}

function syncAttributes(currentElement: Element, nextElement: Element) {
  const currentAttributeNames = currentElement.getAttributeNames();
  currentAttributeNames.forEach(function (attributeName) {
    if (nextElement.hasAttribute(attributeName) !== true) {
      currentElement.removeAttribute(attributeName);
    }
  });

  nextElement.getAttributeNames().forEach(function (attributeName) {
    const nextValue = nextElement.getAttribute(attributeName);
    if (currentElement.getAttribute(attributeName) !== nextValue) {
      if (nextValue === null) {
        currentElement.removeAttribute(attributeName);
        return;
      }
      currentElement.setAttribute(attributeName, nextValue);
    }
  });

  syncFormState(currentElement, nextElement);
}

function syncChildNodes(currentElement: Element, nextElement: Element) {
  const currentChildren = Array.from(currentElement.childNodes);
  const nextChildren = Array.from(nextElement.childNodes);
  const childCount = Math.max(currentChildren.length, nextChildren.length);

  for (let index = 0; index < childCount; index += 1) {
    const currentChild = currentChildren[index];
    const nextChild = nextChildren[index];

    if (!currentChild && nextChild) {
      currentElement.appendChild(nextChild.cloneNode(true));
      continue;
    }

    if (currentChild && !nextChild) {
      currentChild.remove();
      continue;
    }

    if (!currentChild || !nextChild) {
      continue;
    }

    if (currentChild.nodeType !== nextChild.nodeType) {
      currentChild.replaceWith(nextChild.cloneNode(true));
      continue;
    }

    if (currentChild.nodeType === 3 || currentChild.nodeType === 8) {
      if (currentChild.textContent !== nextChild.textContent) {
        currentChild.textContent = nextChild.textContent;
      }
      continue;
    }

    const currentChildElement = currentChild as Element;
    const nextChildElement = nextChild as Element;
    if (canReuseElement(currentChildElement, nextChildElement) !== true) {
      currentChildElement.replaceWith(nextChildElement.cloneNode(true));
      continue;
    }

    syncElement(currentChildElement, nextChildElement);
  }
}

function hasPreservedDetailsState(element: Element) {
  return (
    element.hasAttribute("data-lab-interpretation-panel") ||
    element.hasAttribute("data-lab-collapsible-panel")
  );
}

function hasMatchingPreservedDetailsIdentity(currentElement: Element, nextElement: Element) {
  if (
    currentElement.hasAttribute("data-lab-collapsible-panel") ||
    nextElement.hasAttribute("data-lab-collapsible-panel")
  ) {
    return (
      currentElement.hasAttribute("data-lab-collapsible-panel") &&
      nextElement.hasAttribute("data-lab-collapsible-panel") &&
      currentElement.getAttribute("data-panel-id") === nextElement.getAttribute("data-panel-id")
    );
  }

  return (
    currentElement.hasAttribute("data-lab-interpretation-panel") &&
    nextElement.hasAttribute("data-lab-interpretation-panel")
  );
}

function readPreservedDetailsState(currentElement: Element, nextElement: Element) {
  if (
    typeof HTMLDetailsElement !== "undefined" &&
    currentElement instanceof HTMLDetailsElement &&
    nextElement instanceof HTMLDetailsElement &&
    hasPreservedDetailsState(currentElement) &&
    hasPreservedDetailsState(nextElement) &&
    hasMatchingPreservedDetailsIdentity(currentElement, nextElement)
  ) {
    return currentElement.open;
  }
  return null;
}

function syncElement(currentElement: Element, nextElement: Element) {
  const preservedDetailsState = readPreservedDetailsState(currentElement, nextElement);
  syncAttributes(currentElement, nextElement);
  if (
    preservedDetailsState !== null &&
    typeof HTMLDetailsElement !== "undefined" &&
    currentElement instanceof HTMLDetailsElement
  ) {
    currentElement.open = preservedDetailsState;
  }
  syncChildNodes(currentElement, nextElement);
}

export const __testOnlyLabRootDomSync = {
  syncElement,
};

export const __testOnlyLabRootPersistence = {
  readPersistableState,
};

function shouldAutoOpenProjectWorkspaceOnBoot(state: LabStoreState) {
  return state.ui.labMode !== "import-youtube";
}

export const __testOnlyProjectWorkspaceAutoOpen = {
  shouldAutoOpenProjectWorkspaceOnBoot,
};

function updateRenderedElement(
  documentRef: Document,
  currentElement: HTMLElement,
  markup: string,
  preserveScroll = false
) {
  const scrollTop = preserveScroll ? currentElement.scrollTop : 0;
  const nextElement = createRenderedElement(documentRef, markup);
  if (!nextElement || canReuseElement(currentElement, nextElement) !== true) {
    const parent = currentElement.parentElement;
    currentElement.outerHTML = markup;
    if (preserveScroll && parent) {
      const replaced = parent.querySelector(`.${currentElement.className.split(" ")[0]}`);
      if (replaced instanceof HTMLElement) {
        replaced.scrollTop = scrollTop;
      }
    }
    return;
  }

  syncElement(currentElement, nextElement);
  if (preserveScroll) {
    currentElement.scrollTop = scrollTop;
  }
}

function readPersistableState(state: LabStoreState) {
  const { analysisPrepExpandedIntentIds: _analysisPrepExpandedIntentIds, ...workspace } =
    state.ui.workspace;
  return {
    schemaVersion: 4,
    artifactRenderCount: state.ui.artifactRenderCount,
    artifactListExpanded: state.ui.artifactListExpanded,
    assets: state.assets,
    activePreviewArtifactId: state.ui.activePreviewArtifactId,
    activityFeed: state.activityFeed.slice(0, 40),
    analysisControlsCollapsed: state.ui.analysisControlsCollapsed,
    editDrafts: state.ui.editDrafts,
    editConfig: state.editConfig,
    editSidePanelCollapsed: state.ui.editSidePanelCollapsed,
    eventFeedExpanded: state.ui.eventFeedExpanded,
    eventFeedCursor: state.ui.eventFeedCursor,
    featureId: state.featureId,
    selectedCapabilities: state.selectedCapabilities,
    lastRun: state.run
      ? {
          ...state.run,
          state:
            state.run.state === "running" || state.run.state === "queued"
              ? "cancelled"
              : state.run.state,
          events: [],
          rawLog: [],
        }
      : null,
    profileConfig: state.profileConfig,
    profileDrafts: state.ui.profileDrafts,
    profileModels: state.profileModels,
    preflight: state.preflight,
    projectIndex: state.projectIndex,
    projectImport: state.ui.projectImport,
    reportExports: state.reportExports,
    reports: state.reports,
    reportView: state.ui.reportView,
    source: state.source,
    sourceDrafts: state.ui.sourceDrafts,
    sourceProbeStatus: state.sourceProbeStatus,
    toolState: state.toolState,
    liveFindingsExpanded: state.ui.liveFindingsExpanded,
    rawLogCollapsed: state.ui.rawLogCollapsed,
    workbench: state.workbench,
    // V2.3 workspace persistence
    workspace,
  };
}

export function startLaboratoryLabRoot() {
  const documentRef = document;
  const windowRef = window as RootWindow;
  const root = documentRef.getElementById("app");
  if (!root) {
    return;
  }
  const runtimeRoot = root;

  const eventBus = createLabEventBus();
  const store = createLabStore();
  eventBus.subscribe(store.dispatch);
  const executionDispatcher = createLabExecutionDispatcher({
    clearTimeoutFn:
      typeof windowRef.clearTimeout === "function"
        ? function (timerId) {
            windowRef.clearTimeout(timerId as number);
          }
        : function (timerId) {
            clearTimeout(timerId as ReturnType<typeof setTimeout>);
          },
    emit: eventBus.emit,
    setTimeoutFn:
      typeof windowRef.setTimeout === "function"
        ? windowRef.setTimeout.bind(windowRef)
        : setTimeout,
  });
  if (typeof windowRef.addEventListener === "function") {
    windowRef.addEventListener("beforeunload", executionDispatcher.dispose);
    windowRef.addEventListener("beforeunload", stopProcessStripHeartbeat);
  }
  const previewInspectionController = createLabPreviewInspectionController({
    documentRef,
    emit: eventBus.emit,
    getActiveSelection() {
      return getActiveSelection(store.getState());
    },
    getActiveSnapshot() {
      return getActiveInspectionSnapshot(store.getState());
    },
    getRoiFocusActive() {
      return getRoiFocusActive(store.getState());
    },
    windowRef,
  });
  bindLabSelectionIntentClicks({
    documentRef,
    emit: eventBus.emit,
  });
  bindLabAssetPreviewClicks({
    documentRef,
    emit: eventBus.emit,
    resolveHref(assetId) {
      const asset = store.getState().assets.find(function (candidate) {
        return candidate.id === assetId;
      });
      return asset === undefined ? null : getLabAssetPreviewUrl(asset);
    },
  });
  bindLabSelectionRoiInteractions({
    documentRef,
    emit: eventBus.emit,
    getActiveSelection() {
      return store.getState().ui.workspace.activeSelection;
    },
    getSourceKind() {
      const sourceKind = asNonEmptyString(asLabRecord(store.getState().source)["kind"]);
      return sourceKind || "video";
    },
    isMutationLocked() {
      return getWorkspaceLockState(store.getState()).roi;
    },
  });
  bindLabPreviewInspectionInteractions({
    controller: previewInspectionController,
    documentRef,
  });
  bindLabSelectionSuggestionClicks({
    canPreviewSuggestion(suggestionId) {
      const visibleSuggestions = getWaveformTimelineModel(store.getState()).selectionSuggestions;
      return visibleSuggestions.some(function (suggestion) {
        return suggestion.id === suggestionId;
      });
    },
    documentRef,
    emit: eventBus.emit,
    getActivePreviewSuggestionId() {
      return getActiveSuggestionPreviewId(store.getState());
    },
  });
  documentRef.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-lab-execution-details-open]")) {
      const identity = getExecutionDetailsIdentity(store.getState());
      if (identity !== null) {
        activeOverlay = "execution-details";
        activeOverlayIdentity = identity;
        render();
      }
      return;
    }
    if (target.closest("[data-lab-execution-details-close]")) {
      closeExecutionDetailsOverlay();
      render();
    }
  });
  documentRef.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }
    if (store.getState().ui.projectWorkspaceOpen) {
      eventBus.emit({ type: "project-workspace-toggled", open: false });
      return;
    }
    if (activeOverlay !== "execution-details") {
      return;
    }
    closeExecutionDetailsOverlay();
    render();
  });

  const controller = createLabRunController({
    documentRef,
    eventBus,
    store,
    windowRef: window,
  });
  const hostBridge = createLabHostBridge({
    emit: eventBus.emit,
  });
  const BOOT_OVERLAY_SETTLE_MS = 450;
  const BOOT_OVERLAY_MIN_VISIBLE_MS = 350;
  const BOOT_OVERLAY_FALLBACK_READY_MS = 8000;
  const BOOT_OVERLAY_FAILSAFE_MS = 20000;
  let bootOverlayLocked = true;
  let bootBootstrapSeen = false;
  let bootOverlaySettleTimer: ReturnType<typeof setTimeout> | null = null;
  let bootOverlayFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let bootOverlayFailsafeTimer: ReturnType<typeof setTimeout> | null = null;
  let bootOverlayIdleTimer: ReturnType<typeof setTimeout> | null = null;
  let bootOverlayIdleCallback: number | null = null;
  let processStripHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  const bootOverlayStartedAt = Date.now();

  function clearBootOverlaySettleTimer() {
    if (bootOverlaySettleTimer !== null) {
      clearTimeout(bootOverlaySettleTimer);
      bootOverlaySettleTimer = null;
    }
  }

  function clearBootOverlayFailsafeTimer() {
    if (bootOverlayFailsafeTimer !== null) {
      clearTimeout(bootOverlayFailsafeTimer);
      bootOverlayFailsafeTimer = null;
    }
  }

  function clearBootOverlayFallbackTimer() {
    if (bootOverlayFallbackTimer !== null) {
      clearTimeout(bootOverlayFallbackTimer);
      bootOverlayFallbackTimer = null;
    }
  }

  function clearBootOverlayIdleGate() {
    if (bootOverlayIdleTimer !== null) {
      clearTimeout(bootOverlayIdleTimer);
      bootOverlayIdleTimer = null;
    }
    if (bootOverlayIdleCallback !== null) {
      if (typeof windowRef.cancelIdleCallback === "function") {
        windowRef.cancelIdleCallback(bootOverlayIdleCallback);
      }
      bootOverlayIdleCallback = null;
    }
  }

  function getBootOverlayBootstrapStatus(state: LabStoreState) {
    const snapshot = asLabRecord(state.snapshot);
    const bootstrap = asLabRecord(snapshot["bootstrap"]);
    const status = asNonEmptyString(bootstrap["status"]);
    if (status === "idle" || status === "running" || status === "ready" || status === "error") {
      return status;
    }
    return null;
  }

  function hasRoomReadyBridge() {
    return Boolean(windowRef.roomAPI && typeof windowRef.roomAPI.ready === "function");
  }

  function hasBootOverlayCompletionSignal(state: LabStoreState) {
    const bootstrapStatus = getBootOverlayBootstrapStatus(state);
    if (bootstrapStatus !== null) {
      return bootstrapStatus === "ready" || bootstrapStatus === "error";
    }
    if (!hasRoomReadyBridge()) {
      return true;
    }
    if (state.snapshot === null) {
      return false;
    }
    return (
      state.bootReady ||
      state.source !== null ||
      state.run !== null ||
      state.reports.user !== null ||
      state.reports.ai !== null ||
      Object.keys(state.context).length > 0
    );
  }

  function isBootOverlayActive(_state: LabStoreState) {
    return bootOverlayLocked;
  }

  function requestBootOverlayInteractiveUnlock() {
    if (!bootOverlayLocked) {
      return;
    }
    clearBootOverlaySettleTimer();
    clearBootOverlayFallbackTimer();
    clearBootOverlayIdleGate();

    const finishUnlock = function () {
      if (!bootOverlayLocked) {
        return;
      }
      if (typeof windowRef.requestAnimationFrame === "function") {
        windowRef.requestAnimationFrame(function () {
          windowRef.requestAnimationFrame(function () {
            unlockBootOverlay();
          });
        });
        return;
      }
      unlockBootOverlay();
    };

    if (typeof windowRef.requestIdleCallback === "function") {
      bootOverlayIdleCallback = windowRef.requestIdleCallback(
        function () {
          bootOverlayIdleCallback = null;
          finishUnlock();
        },
        { timeout: 4000 }
      );
      return;
    }
    bootOverlayIdleTimer = setTimeout(function () {
      bootOverlayIdleTimer = null;
      finishUnlock();
    }, 250);
  }

  function unlockBootOverlay() {
    if (!bootOverlayLocked) {
      return;
    }
    bootOverlayLocked = false;
    clearBootOverlaySettleTimer();
    clearBootOverlayFallbackTimer();
    clearBootOverlayFailsafeTimer();
    clearBootOverlayIdleGate();
    render();
    const bootState = store.getState();
    if (shouldAutoOpenProjectWorkspaceOnBoot(bootState) && !bootState.ui.projectWorkspaceOpen) {
      eventBus.emit({ type: "project-workspace-toggled", open: true });
    }
  }

  function scheduleBootOverlayUnlock(state: LabStoreState) {
    if (!bootOverlayLocked || !bootBootstrapSeen || !hasBootOverlayCompletionSignal(state)) {
      return;
    }
    clearBootOverlaySettleTimer();
    const elapsed = Date.now() - bootOverlayStartedAt;
    const minVisibleRemainder = Math.max(0, BOOT_OVERLAY_MIN_VISIBLE_MS - elapsed);
    const delay = Math.max(BOOT_OVERLAY_SETTLE_MS, minVisibleRemainder);
    bootOverlaySettleTimer = setTimeout(function () {
      requestBootOverlayInteractiveUnlock();
    }, delay);
  }

  function syncShellState(shell: HTMLElement, state: LabStoreState) {
    shell.dataset["layoutKind"] = getLabLayoutKind(state, {
      bootOverlayActive: isBootOverlayActive(state),
    });
    shell.dataset["ready"] = isBootOverlayActive(state) ? "false" : "true";
    shell.dataset["workspaceMode"] = getWorkspaceMode(state);
    shell.dataset["labMode"] = state.ui.labMode;
    shell.dataset["drawerMode"] = resolveDrawerMode(state);
    shell.dataset["drawerCollapsed"] = getDrawerCollapsed(state) ? "true" : "false";
    shell.dataset["processView"] = state.ui.workspace.processViewActive ? "expanded" : "compact";
  }

  function syncBootOverlay(shell: HTMLElement, state: LabStoreState, copy: LabI18n) {
    const existingOverlay = shell.querySelector<HTMLElement>(".labx-boot-overlay");
    if (!isBootOverlayActive(state)) {
      existingOverlay?.remove();
      return;
    }
    const overlayMarkup = renderLabBootOverlay(copy);
    if (existingOverlay) {
      updateRenderedElement(documentRef, existingOverlay, overlayMarkup);
      return;
    }
    shell.insertAdjacentHTML("beforeend", overlayMarkup);
  }

  function stopProcessStripHeartbeat() {
    if (processStripHeartbeatInterval !== null) {
      clearInterval(processStripHeartbeatInterval);
      processStripHeartbeatInterval = null;
    }
  }

  function syncProcessStripHeartbeat(state: LabStoreState) {
    if (isRunActive(state)) {
      if (processStripHeartbeatInterval === null) {
        processStripHeartbeatInterval = setInterval(function () {
          render();
        }, 1000);
      }
      return;
    }
    stopProcessStripHeartbeat();
  }

  let shellMounted = false;
  let activeOverlay: LabWaveformTimelineModel["activeOverlay"] = "none";
  let activeOverlayIdentity: string | null = null;

  const collapsedPanels: Record<string, boolean> = {
    alternatives: true,
    payload: true,
    reflection: true,
    simulation: true,
  };

  function replaceLabLayout(state: LabStoreState, surface: LabWorkspaceSurface, copy: LabI18n) {
    runtimeRoot.innerHTML = renderLabLayout(state, surface, copy, {
      bootOverlayActive: isBootOverlayActive(state),
    });
    const mountedShell = runtimeRoot.querySelector<HTMLElement>(".labx-shell");
    if (mountedShell) {
      syncShellState(mountedShell, state);
      syncBootOverlay(mountedShell, state, copy);
    }
  }

  function getExecutionDetailsIdentity(state: LabStoreState) {
    const selection = getActiveSelection(state);
    const intentId = getActiveExecutionIntentId(state);
    if (selection === null || selection.endMs <= selection.startMs || intentId === null) {
      return null;
    }
    const roi = selection.roi
      ? `${selection.roi.x}:${selection.roi.y}:${selection.roi.width}:${selection.roi.height}`
      : "no-roi";
    const source = asLabRecord(state.source);
    const sourceIdentity =
      asNonEmptyString(source["assetId"]) ||
      asNonEmptyString(source["storedFileName"]) ||
      asNonEmptyString(source["previewUrl"]) ||
      "no-source";
    return [
      state.projectIndex.activeProjectId || "no-project",
      sourceIdentity,
      selection.id,
      String(selection.startMs),
      String(selection.endMs),
      roi,
      intentId,
    ].join("|");
  }

  function closeExecutionDetailsOverlay() {
    activeOverlay = "none";
    activeOverlayIdentity = null;
  }

  function reconcileExecutionDetailsOverlay(state: LabStoreState) {
    if (activeOverlay !== "execution-details") {
      return;
    }
    const currentIdentity = getExecutionDetailsIdentity(state);
    if (currentIdentity === null || currentIdentity !== activeOverlayIdentity) {
      closeExecutionDetailsOverlay();
    }
  }

  function renderSurface(state: LabStoreState, copy: LabI18n) {
    if (state.ui.labMode === "import-youtube") {
      return {
        main: renderYoutubeImportWorkspaceMarkup(state, copy),
        side: "",
      };
    }

    // V2.3: single workspace surface replaces stage routing
    return renderWorkspaceSurface(state, {
      activeOverlay,
      collapsedPanels,
      copy,
    });
  }

  function render() {
    const state = store.getState();
    const copy = createLabI18n(state.context);
    reconcileExecutionDetailsOverlay(state);
    const surface = renderSurface(state, copy);
    if (shellMounted !== true) {
      replaceLabLayout(state, surface, copy);
      shellMounted = true;
      syncProcessStripHeartbeat(state);
      return;
    }

    const shell = runtimeRoot.querySelector(".labx-shell");
    const centerPanel = runtimeRoot.querySelector(".labx-center-panel");
    const nextLayoutKind = getLabLayoutKind(state, {
      bootOverlayActive: isBootOverlayActive(state),
    });
    const currentLayoutKind = shell?.getAttribute("data-layout-kind") ?? "laboratory";
    if (!shell || currentLayoutKind !== nextLayoutKind) {
      replaceLabLayout(state, surface, copy);
      syncProcessStripHeartbeat(state);
      return;
    }

    if (nextLayoutKind === "import-only") {
      const overlayRoot = runtimeRoot.querySelector(".labx-overlay-root");
      const assetPreviewOverlayRoot = runtimeRoot.querySelector("#lab-asset-preview-overlay-root");
      const reportOverlayRoot = runtimeRoot.querySelector("#lab-report-overlay-root");
      const projectWorkspaceRoot = runtimeRoot.querySelector("#lab-project-workspace-root");
      if (
        !centerPanel ||
        !overlayRoot ||
        !assetPreviewOverlayRoot ||
        !reportOverlayRoot ||
        !projectWorkspaceRoot
      ) {
        replaceLabLayout(state, surface, copy);
        syncProcessStripHeartbeat(state);
        return;
      }
      if (shell instanceof HTMLElement) {
        syncShellState(shell, state);
      }
      updateRenderedElement(
        documentRef,
        centerPanel as HTMLElement,
        renderLabCenterPanel(surface),
        true
      );
      syncProcessStripHeartbeat(state);
      return;
    }

    const topBar = runtimeRoot.querySelector(".labx-top-bar");
    const drawer = runtimeRoot.querySelector(".labx-drawer");
    const processStrip = runtimeRoot.querySelector(".labx-process-strip");
    const overlayRoot = runtimeRoot.querySelector(".labx-overlay-root");
    const assetPreviewOverlayRoot = runtimeRoot.querySelector("#lab-asset-preview-overlay-root");
    const reportOverlayRoot = runtimeRoot.querySelector("#lab-report-overlay-root");
    if (
      !topBar ||
      !centerPanel ||
      !drawer ||
      !processStrip ||
      !overlayRoot ||
      !assetPreviewOverlayRoot
    ) {
      replaceLabLayout(state, surface, copy);
      syncProcessStripHeartbeat(state);
      return;
    }

    if (shell instanceof HTMLElement) {
      syncShellState(shell, state);
      syncBootOverlay(shell, state, copy);
    }
    updateRenderedElement(documentRef, topBar as HTMLElement, renderLabTopBar(state, copy));
    updateRenderedElement(
      documentRef,
      centerPanel as HTMLElement,
      renderLabCenterPanel(surface),
      true
    );
    updateRenderedElement(
      documentRef,
      drawer as HTMLElement,
      renderLabDrawer(state, surface, copy),
      true
    );
    updateRenderedElement(
      documentRef,
      processStrip as HTMLElement,
      renderLabProcessStrip(state, copy)
    );
    updateRenderedElement(
      documentRef,
      overlayRoot as HTMLElement,
      renderToolManagementOverlay(state, copy)
    );
    updateRenderedElement(
      documentRef,
      assetPreviewOverlayRoot as HTMLElement,
      renderLabAssetPreviewOverlay(state, copy)
    );
    if (reportOverlayRoot) {
      updateRenderedElement(
        documentRef,
        reportOverlayRoot as HTMLElement,
        renderReportOverlay(state, copy)
      );
    }
    const projectWorkspaceRoot = runtimeRoot.querySelector("#lab-project-workspace-root");
    if (projectWorkspaceRoot) {
      updateRenderedElement(
        documentRef,
        projectWorkspaceRoot as HTMLElement,
        renderProjectWorkspaceOverlay(state, copy)
      );
    }

    syncProcessStripHeartbeat(state);

    const triggerEl = runtimeRoot.querySelector<HTMLElement>(".lab-execution-details-trigger");
    if (triggerEl) {
      if (activeOverlay === "execution-details") {
        triggerEl.dataset["overlaySource"] = "true";
      } else {
        delete triggerEl.dataset["overlaySource"];
      }
    }
  }

  store.subscribe(function (state) {
    saveLabPersistedState(window, readPersistableState(state));
    render();
    executionDispatcher.sync(getExecutionDispatchCandidate(state));
    previewInspectionController.sync();
    scheduleBootOverlayUnlock(state);
  });

  const persisted = loadLabPersistedState(window);
  eventBus.emit({
    type: "hydrate",
    payload: persisted,
  });

  controller.attach();

  if (windowRef.roomAPI && typeof windowRef.roomAPI.onHostMessage === "function") {
    windowRef.roomAPI.onHostMessage(function (message: unknown) {
      bootBootstrapSeen = true;
      hostBridge.handleHostMessage(message);
    });
  }

  bootOverlayFailsafeTimer = setTimeout(function () {
    requestBootOverlayInteractiveUnlock();
  }, BOOT_OVERLAY_FAILSAFE_MS);
  bootOverlayFallbackTimer = setTimeout(function () {
    bootBootstrapSeen = true;
    requestBootOverlayInteractiveUnlock();
  }, BOOT_OVERLAY_FALLBACK_READY_MS);

  render();
  previewInspectionController.sync();

  if (windowRef.roomAPI && typeof windowRef.roomAPI.ready === "function") {
    windowRef.roomAPI.ready({
      feature: "media-analysis",
      room: "laboratory",
      stage: "ui-ready",
    });
    eventBus.emit({
      type: "bootstrap-ready-sent",
    });
  } else {
    bootBootstrapSeen = true;
    scheduleBootOverlayUnlock(store.getState());
  }
}

startLaboratoryLabRoot();
