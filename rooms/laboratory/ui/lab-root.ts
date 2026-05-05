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
import { renderLabSourcePanel } from "./lab-source-panel.js";
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
import { buildLabDecisionSnapshot, getLabDecisionStableKey } from "./lab-decision-layer.js";
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
import { updateRenderedElement } from "./lab-dom-sync.js";
import {
  LAB_OVERLAY_SELECTORS,
  LAB_REGION_SELECTORS,
  debugConsole,
  debugLabFallback,
  debugLabOverlay,
  debugLabRegionLifecycle,
  getRegionDebugName,
  isLabRegionDebugEnabled,
  queryRegion,
  shouldFallback,
  syncLabDebugPanel,
  syncOverlayRoot,
  syncRegion,
} from "./lab-root-observability.js";
import type { LabRegionDescriptor, LabRegionKey } from "./lab-root-observability.js";
export { __testOnlyLabRootDomSync } from "./lab-dom-sync.js";
export { __testOnlyLabRootObservability } from "./lab-root-observability.js";

type RootWindow = Window & {
  roomAPI?: {
    onHostMessage?: (listener: (message: unknown) => void) => void;
    ready?: (payload: { feature: string; room: string; stage: string }) => void;
  };
};

export const __testOnlyLabRootPersistence = {
  readPersistableState,
};

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
    shell.dataset["sourcePanelCollapsed"] = state.ui.sourcePanelCollapsed ? "true" : "false";
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
  let lastDecisionLogKey: string | null = null;

  const collapsedPanels: Record<string, boolean> = {
    alternatives: true,
    payload: true,
    reflection: true,
    simulation: true,
  };

  function syncDecisionLayer(shell: HTMLElement | null | undefined, state: LabStoreState) {
    if (!shell) {
      return null;
    }
    const snapshot = buildLabDecisionSnapshot({ shell, state });
    if (isLabRegionDebugEnabled(shell) === true) {
      const stableKey = getLabDecisionStableKey(snapshot);
      if (stableKey !== lastDecisionLogKey) {
        debugConsole(`[lab][decision] mode=${snapshot.mode} intent=${snapshot.intent}`, {
          activeBlocks: snapshot.activeBlocks,
          intent: snapshot.intent,
          mode: snapshot.mode,
          state: snapshot.state,
          timestamp: snapshot.timestamp,
          triggers: snapshot.triggers,
        });
        lastDecisionLogKey = stableKey;
      }
    } else {
      lastDecisionLogKey = null;
    }
    syncLabDebugPanel(shell, snapshot);
    return snapshot;
  }

  function replaceLabLayout(state: LabStoreState, surface: LabWorkspaceSurface, copy: LabI18n) {
    const previousShell = runtimeRoot.querySelector<HTMLElement>(".labx-shell");
    const preserveDebug = isLabRegionDebugEnabled(previousShell);
    runtimeRoot.innerHTML = renderLabLayout(state, surface, copy, {
      bootOverlayActive: isBootOverlayActive(state),
    });
    const mountedShell = runtimeRoot.querySelector<HTMLElement>(".labx-shell");
    if (mountedShell) {
      if (preserveDebug) {
        mountedShell.setAttribute("data-lab-debug-regions", "true");
      }
      syncShellState(mountedShell, state);
      syncBootOverlay(mountedShell, state, copy);
      if (preserveDebug) {
        (Object.keys(LAB_REGION_SELECTORS) as LabRegionKey[]).forEach(function (regionKey) {
          const element = queryRegion(runtimeRoot, LAB_REGION_SELECTORS[regionKey]);
          debugLabRegionLifecycle(mountedShell, regionKey, element ? "mount" : "missing", {
            selectors: LAB_REGION_SELECTORS[regionKey],
          });
        });
      }
      syncDecisionLayer(mountedShell, state);
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

    const shell = runtimeRoot.querySelector<HTMLElement>(".labx-shell");
    const centerPanel = queryRegion(runtimeRoot, LAB_REGION_SELECTORS.mainStage);
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
      const overlayRoot = runtimeRoot.querySelector(LAB_OVERLAY_SELECTORS.tools);
      const assetPreviewOverlayRoot = runtimeRoot.querySelector(LAB_OVERLAY_SELECTORS.assetPreview);
      const reportOverlayRoot = runtimeRoot.querySelector(LAB_OVERLAY_SELECTORS.report);
      const projectWorkspaceRoot = runtimeRoot.querySelector("#lab-project-workspace-root");
      if (
        !centerPanel ||
        !overlayRoot ||
        !assetPreviewOverlayRoot ||
        !reportOverlayRoot ||
        !projectWorkspaceRoot
      ) {
        if (!centerPanel) {
          debugLabRegionLifecycle(shell, "mainStage", "missing", {
            selectors: LAB_REGION_SELECTORS.mainStage,
          });
        }
        if (!overlayRoot) {
          debugLabOverlay(shell, "tools", "missing", { selector: LAB_OVERLAY_SELECTORS.tools });
        }
        if (!assetPreviewOverlayRoot) {
          debugLabOverlay(shell, "assetPreview", "missing", {
            selector: LAB_OVERLAY_SELECTORS.assetPreview,
          });
        }
        if (!reportOverlayRoot) {
          debugLabOverlay(shell, "report", "missing", { selector: LAB_OVERLAY_SELECTORS.report });
        }
        if (!projectWorkspaceRoot) {
          debugLabOverlay(shell, "projectWorkspace", "missing", {
            selector: LAB_OVERLAY_SELECTORS.projectWorkspace,
          });
        }
        replaceLabLayout(state, surface, copy);
        syncProcessStripHeartbeat(state);
        return;
      }
      if (shell instanceof HTMLElement) {
        syncShellState(shell, state);
      }
      updateRenderedElement(documentRef, centerPanel, renderLabCenterPanel(surface), true);
      syncDecisionLayer(shell, state);
      syncProcessStripHeartbeat(state);
      return;
    }

    const regionDescriptors: LabRegionDescriptor[] = [
      {
        key: "topBar",
        render() {
          return renderLabTopBar(state, copy);
        },
      },
      {
        key: "leftRail",
        preserveScroll: true,
        render() {
          return renderLabSourcePanel(state, copy);
        },
      },
      {
        key: "mainStage",
        preserveScroll: true,
        render() {
          return renderLabCenterPanel(surface);
        },
      },
      {
        key: "contextPanel",
        preserveScroll: true,
        render() {
          return renderLabDrawer(state, surface, copy);
        },
      },
      {
        key: "inspectorPanel",
        preserveScroll: true,
        render() {
          return "";
        },
      },
      {
        key: "processStrip",
        render() {
          return renderLabProcessStrip(state, copy);
        },
      },
    ];
    const resolvedRegions = regionDescriptors.map(function (descriptor) {
      return {
        ...descriptor,
        element: queryRegion(runtimeRoot, LAB_REGION_SELECTORS[descriptor.key]),
      };
    });
    const regionsFound = resolvedRegions.filter(function (region) {
      return region.element !== null;
    }).length;
    if (shouldFallback(regionsFound)) {
      const missingRegions = resolvedRegions
        .filter(function (region) {
          return region.element === null;
        })
        .map(function (region) {
          return getRegionDebugName(region.key);
        });
      debugLabFallback(shell, regionsFound, missingRegions);
      replaceLabLayout(state, surface, copy);
      syncProcessStripHeartbeat(state);
      return;
    }

    if (shell instanceof HTMLElement) {
      syncShellState(shell, state);
      syncBootOverlay(shell, state, copy);
    }
    resolvedRegions.forEach(function (region) {
      syncRegion({
        debugShell: shell,
        documentRef,
        preserveScroll: region.preserveScroll === true,
        regionKey: region.key,
        render: region.render,
        root: runtimeRoot,
        selectors: LAB_REGION_SELECTORS[region.key],
      });
    });
    syncOverlayRoot(
      documentRef,
      runtimeRoot,
      "tools",
      LAB_OVERLAY_SELECTORS.tools,
      function () {
        return renderToolManagementOverlay(state, copy);
      },
      shell
    );
    syncOverlayRoot(
      documentRef,
      runtimeRoot,
      "assetPreview",
      LAB_OVERLAY_SELECTORS.assetPreview,
      function () {
        return renderLabAssetPreviewOverlay(state, copy);
      },
      shell
    );
    syncOverlayRoot(
      documentRef,
      runtimeRoot,
      "report",
      LAB_OVERLAY_SELECTORS.report,
      function () {
        return renderReportOverlay(state, copy);
      },
      shell
    );
    syncOverlayRoot(
      documentRef,
      runtimeRoot,
      "projectWorkspace",
      LAB_OVERLAY_SELECTORS.projectWorkspace,
      function () {
        return renderProjectWorkspaceOverlay(state, copy);
      },
      shell
    );
    syncDecisionLayer(shell, state);

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
