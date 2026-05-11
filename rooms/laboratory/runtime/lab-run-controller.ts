import {
  asLabRecord,
  asNonEmptyString,
  escapeHtml,
  WORKSPACE_INTENTS,
} from "../models/lab-types.js";
import type {
  LabFeatureId,
  LabFocusLayer,
  LabIntentId,
  LabSelectionROI,
  LabStoreEvent,
} from "../models/lab-types.js";
import { createLabWaveformTimelineVisualizer } from "../ui/lab-waveform-timeline.js";
import {
  getAnalysisActionBlockReason,
  getCurrentRun,
  getEditActionBlockReason,
  getReadySelectedAnalysisCapabilityIds,
  getReadySelectedAnalysisIntentIds,
  getSourceReady,
  getToolLifecycleStage,
  getWaveformTimelineModel,
  getWorkbench,
  hasReportPayload,
  isAnyHeavyWorkActive,
  isRunActive,
  isRunComplete,
} from "./lab-selectors.js";
import type { createLabEventBus } from "./lab-event-bus.js";
import type { createLabStore } from "./lab-store.js";
import {
  buildUiEvent,
  deriveFeatureSelectionFromCapabilities,
  isTextControl,
  toStringValue,
} from "./controller/lab-controller-helpers.js";
import { applyAnalysisScopeField } from "./controller/lab-analysis-scope-controller.js";
import {
  closeLabAssetMenusForClick,
  openLabAssetContextMenu,
} from "./controller/lab-asset-context-menu-controller.js";
import { createLabAssetActionController } from "./controller/lab-asset-action-controller.js";
import { createLabFormActionController } from "./controller/lab-form-action-controller.js";
import { createLabMediaActionController } from "./controller/lab-media-action-controller.js";
import { getLabPrimaryActionState } from "./controller/lab-primary-action-state.js";
import { createLabTimelinePlaybackController } from "./controller/lab-timeline-playback-controller.js";
import { createLabWorkspaceSettingsController } from "./controller/lab-workspace-settings-controller.js";
import { createLabSourceActionController } from "./controller/lab-source-action-controller.js";
import { createLabWorkspaceOperationController } from "./controller/lab-workspace-operation-controller.js";
import {
  formatTimelineTimeMs,
  isTimelineAction,
  normalizeWorkspaceControlTab,
} from "./controller/lab-timeline-controller-helpers.js";
import { DEFAULT_AUDIO_FOCUS_SETTINGS } from "./lab-audio-focus-normalization.js";
import { DEFAULT_LAB_INTERACTIVE_SETTINGS } from "./lab-workspace-defaults.js";

type LabRoomApi = {
  onHostMessage?: (listener: (message: unknown) => void) => void;
  ready?: (payload: { feature: string; room: string; stage: string }) => void;
  sendEvent?: (eventName: string, payload: Record<string, unknown>) => void;
};

type ControllerWindow = Window & {
  roomAPI?: LabRoomApi;
};

type LabRunControllerDeps = {
  documentRef: Document;
  eventBus: ReturnType<typeof createLabEventBus>;
  store: ReturnType<typeof createLabStore>;
  windowRef: ControllerWindow;
};

export function createLabRunController(deps: LabRunControllerDeps) {
  type AnalysisScopeChoice = "selected" | "full" | "cancel";
  type AnalysisScopeRequest = AnalysisScopeChoice | "pending";
  type LabControllerState = ReturnType<typeof deps.store.getState>;

  let attached = false;
  let analysisScopeOverlay: HTMLElement | null = null;
  const getWorkspaceWaveformTimelineModel = () => getWaveformTimelineModel(deps.store.getState());
  const workspaceAudioVisualizer = createLabWaveformTimelineVisualizer({
    documentRef: deps.documentRef,
    getTimelineModel: getWorkspaceWaveformTimelineModel,
    windowRef: deps.windowRef,
  });

  function dispatch(event: Parameters<ReturnType<typeof createLabStore>["dispatch"]>[0]) {
    deps.eventBus.emit(event);
  }

  const mediaActions = createLabMediaActionController({
    dispatch,
    store: deps.store,
    windowRef: deps.windowRef,
  });
  const {
    cancelTrackedOperation,
    getRoomApi,
    handleBusEvent: handleMediaActionBusEvent,
    sendMediaAction,
    startTrackedReportExport,
  } = mediaActions;

  function setLabFocusLayer(layer: LabFocusLayer) {
    if (deps.store.getState().ui.labFocusLayer === layer) {
      return;
    }
    dispatch({ type: "lab-focus-layer-changed", layer });
  }

  const timelinePlayback = createLabTimelinePlaybackController({
    dispatch,
    documentRef: deps.documentRef,
    setLabFocusLayer,
    store: deps.store,
  });
  const {
    addCurrentTimelineBookmark,
    centerTimelineTarget,
    getTimelineSyncMedia,
    handleMouseDown,
    handleTimelineMouseMove,
    handleTimelineMouseUp,
    isWorkspaceMutationLocked,
    playSelectedTimelineRange,
    pushLockedWorkspaceEvent,
    seekTimelineToMs,
    setTimelineSelectionBoundary,
    shiftTimelinePlayhead,
    syncTimelinePlaybackUiFromState,
    syncTimelineTransportVolume,
    toggleTimelinePlayback,
    updateTimelinePlaybackUi,
  } = timelinePlayback;

  const sourceActions = createLabSourceActionController({
    dispatch,
    pushLockedWorkspaceEvent,
    sendMediaAction,
    store: deps.store,
    updateWorkbench,
    windowRef: deps.windowRef,
  });
  const {
    deleteActiveProject,
    handleSourceClickAction,
    persistSourceDraftField,
    runSourcePrimaryAction,
    saveActiveProjectCheckpoint,
    selectProjectByValue,
    startCleanProjectSession,
  } = sourceActions;

  const assetActions = createLabAssetActionController({
    dispatch,
    documentRef: deps.documentRef,
    sendMediaAction,
    store: deps.store,
    windowRef: deps.windowRef,
  });
  const { downloadAsset, focusSourcePreview, removeAssetsWithConfirmation } = assetActions;

  const workspaceOperations = createLabWorkspaceOperationController({
    dispatch,
    getActiveSelectionOperationPayload: mediaActions.getActiveSelectionOperationPayload,
    getCurrentRunIntentPayload: mediaActions.getCurrentRunIntentPayload,
    isWorkspaceMutationLocked,
    pushLockedWorkspaceEvent,
    startTrackedOperationForUiAction: mediaActions.startTrackedOperationForUiAction,
    store: deps.store,
  });
  const {
    exportAudioCleanup,
    exportBandPassVoice,
    exportBeforeAfterVariant,
    exportEnhancedFrame,
    exportImageComparison,
    exportSelectionRoi,
    exportStabilizedSegment,
    exportStemSeparation,
    exportTimelineClip,
    exportWorkspaceRoi,
    extractTimelineAudio,
    grabTimelineFrame,
  } = workspaceOperations;

  function isInsideWorkspacePreview(target: Element) {
    return (
      typeof target.closest === "function" && target.closest(".labx-workspace-preview") !== null
    );
  }

  function isInsideWorkspaceInspector(target: Element) {
    return (
      typeof target.closest === "function" &&
      target.closest("[data-lab-workspace-inspector='true']") !== null
    );
  }

  function sendHostContext(payload: Record<string, unknown>) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      return;
    }
    roomApi.sendEvent("host-context", payload);
  }

  function syncCurrentWorkbenchToHost() {
    const state = deps.store.getState();
    sendHostContext({
      ...state.context,
      workbench: getWorkbench(state),
    });
  }

  function updateWorkbench(
    update: (currentWorkbench: Record<string, unknown>) => Record<string, unknown>
  ) {
    const state = deps.store.getState();
    const currentWorkbench = {
      ...getWorkbench(state),
    };
    const nextWorkbench = update(currentWorkbench);
    dispatch({
      type: "workbench-updated",
      workbench: nextWorkbench,
    });
    sendHostContext({
      ...state.context,
      workbench: nextWorkbench,
    });
  }

  const workspaceSettings = createLabWorkspaceSettingsController({
    dispatch,
    pushLockedWorkspaceEvent,
    store: deps.store,
    updateWorkbench,
  });
  const {
    applyWorkspaceSettingAdjustment,
    patchAnalysisModuleSetting,
    patchAudioFocusSetting,
    patchInteractiveSetting,
    patchOperationSetting,
    readControlValue,
    resetAnalysisModuleSettings,
    resetOperationSettings,
  } = workspaceSettings;

  function updateAnalysisScopeField(field: string, value: unknown) {
    updateWorkbench(function (workbench) {
      return applyAnalysisScopeField(workbench, field, value);
    });
  }

  const formActions = createLabFormActionController({
    dispatch,
    isInsideWorkspaceInspector,
    isWorkspaceMutationLocked,
    patchAnalysisModuleSetting,
    patchAudioFocusSetting,
    patchInteractiveSetting,
    patchOperationSetting,
    persistSourceDraftField,
    pushLockedWorkspaceEvent,
    readControlValue,
    seekTimelineToMs,
    selectProjectByValue,
    sendMediaAction,
    setLabFocusLayer,
    store: deps.store,
    syncTimelineTransportVolume,
    updateAnalysisScopeField,
    updateTimelinePlaybackUi,
  });
  const { handleChange, handleInput } = formActions;

  function activateFeature(featureId: string) {
    dispatch({
      type: "feature-changed",
      featureId: featureId as LabFeatureId,
    });
    updateWorkbench(function (workbench) {
      const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
        ? (workbench["selectedModuleIds"] as unknown[]).filter(
            (entry): entry is string => typeof entry === "string"
          )
        : [];
      return {
        ...workbench,
        activeModuleId: featureId,
        selectedModuleIds: selectedModuleIds.includes(featureId)
          ? selectedModuleIds
          : [featureId].concat(selectedModuleIds),
      };
    });
  }

  function toggleFeature(featureId: string) {
    updateWorkbench(function (workbench) {
      const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
        ? (workbench["selectedModuleIds"] as unknown[]).filter(
            (entry): entry is string => typeof entry === "string"
          )
        : [];
      const activeModuleId = asNonEmptyString(workbench["activeModuleId"]) || featureId;
      const nextSelected = selectedModuleIds.includes(featureId)
        ? selectedModuleIds.filter(function (entry) {
            return entry !== featureId;
          })
        : selectedModuleIds.concat(featureId);
      const safeSelected = nextSelected.length > 0 ? nextSelected : [featureId];
      return {
        ...workbench,
        activeModuleId: safeSelected.includes(activeModuleId) ? activeModuleId : safeSelected[0],
        selectedModuleIds: safeSelected,
      };
    });
  }

  function syncCapabilities(nextCapabilities: string[]) {
    const normalizedCapabilities = Array.from(
      new Set(
        nextCapabilities.filter(function (entry) {
          return entry.trim() !== "";
        })
      )
    );
    const { activeFeatureId, featureIds } =
      deriveFeatureSelectionFromCapabilities(normalizedCapabilities);
    dispatch({
      type: "capability-set",
      capabilities: normalizedCapabilities as import("../models/lab-types.js").CapabilityFamilyId[],
    });
    dispatch({
      type: "feature-changed",
      featureId: activeFeatureId,
    });
    updateWorkbench(function (workbench) {
      return {
        ...workbench,
        activeModuleId: activeFeatureId,
        selectedModuleIds: featureIds,
        selectedCapabilityIds: normalizedCapabilities,
      };
    });
  }

  function parseAnalysisPreparationModuleValue(value: string) {
    const [intentId, moduleId] = value.split("::");
    const knownIntentId = WORKSPACE_INTENTS.some(function (intent) {
      return intent.id === intentId;
    });
    if (!knownIntentId || typeof moduleId !== "string" || moduleId.trim() === "") {
      return null;
    }
    return {
      intentId: intentId as LabIntentId,
      moduleId,
    };
  }

  function readFiniteNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function getSourceDimensions(state: LabControllerState) {
    const metadata = asLabRecord(asLabRecord(state.source)["metadata"]);
    const width = readFiniteNumber(metadata["width"]);
    const height = readFiniteNumber(metadata["height"]);
    return width !== null && height !== null && width > 0 && height > 0 ? { width, height } : null;
  }

  function resolveAnalysisRoiRegion(state: LabControllerState, roi: LabSelectionROI | null) {
    const dimensions = roi === null ? null : getSourceDimensions(state);
    if (roi === null || dimensions === null) {
      return null;
    }
    const x = Math.max(0, Math.min(1, roi.x));
    const y = Math.max(0, Math.min(1, roi.y));
    const width = Math.max(1, Math.round(Math.max(0, Math.min(1, roi.width)) * dimensions.width));
    const height = Math.max(
      1,
      Math.round(Math.max(0, Math.min(1, roi.height)) * dimensions.height)
    );
    return {
      x: Math.min(Math.max(0, dimensions.width - width), Math.round(x * dimensions.width)),
      y: Math.min(Math.max(0, dimensions.height - height), Math.round(y * dimensions.height)),
      width,
      height,
    };
  }

  function getWorkspaceAnalysisSelection(state: LabControllerState) {
    const sourceKind = asNonEmptyString(asLabRecord(state.source)["kind"]);
    const ws = state.ui.workspace;
    const selection = ws.activeSelection;
    const startMs = ws.timelineStartMs ?? selection?.startMs ?? null;
    const endMs = ws.timelineEndMs ?? selection?.endMs ?? null;
    const hasTimeRange =
      sourceKind !== "image" && startMs !== null && endMs !== null && endMs > startMs;
    const roi = selection?.roi ?? null;
    return {
      endMs,
      hasRoi: roi !== null,
      hasTimeRange,
      region: resolveAnalysisRoiRegion(state, roi),
      roi,
      startMs,
    };
  }

  function parseAnalysisScopeChoice(value: string | null): AnalysisScopeChoice {
    if (value === null) {
      return "cancel";
    }
    const normalized = value.trim().toLocaleLowerCase("tr-TR");
    if (
      normalized === "1" ||
      normalized === "s" ||
      normalized === "seçili" ||
      normalized === "secili" ||
      normalized === "selected"
    ) {
      return "selected";
    }
    if (
      normalized === "2" ||
      normalized === "t" ||
      normalized === "tamamı" ||
      normalized === "tamami" ||
      normalized === "full" ||
      normalized === "all"
    ) {
      return "full";
    }
    if (
      normalized === "3" ||
      normalized === "i" ||
      normalized === "iptal" ||
      normalized === "cancel"
    ) {
      return "cancel";
    }
    return "cancel";
  }

  function removeAnalysisScopeOverlay() {
    analysisScopeOverlay?.remove();
    analysisScopeOverlay = null;
  }

  function formatAnalysisSelectionSummary(state: LabControllerState) {
    const selection = getWorkspaceAnalysisSelection(state);
    const details: string[] = [];
    if (selection.hasTimeRange) {
      details.push(
        `${formatTimelineTimeMs(selection.startMs ?? 0)} - ${formatTimelineTimeMs(
          selection.endMs ?? 0
        )}`
      );
    }
    if (selection.hasRoi) {
      details.push("ROI");
    }
    return details.length > 0 ? details.join(" + ") : "Seçili kapsam";
  }

  function showAnalysisScopeOverlay(state: LabControllerState) {
    const body = deps.documentRef.body;
    if (!body || typeof body.appendChild !== "function") {
      return false;
    }
    removeAnalysisScopeOverlay();
    const overlay = deps.documentRef.createElement("div");
    overlay.className = "labx-analysis-scope-overlay";
    overlay.setAttribute("data-lab-analysis-scope-overlay", "true");
    overlay.setAttribute("data-open", "true");
    overlay.innerHTML = `
      <button class="labx-analysis-scope-overlay__backdrop" type="button" data-lab-action="analysis-scope-cancel" aria-label="Kapsam onayini kapat"></button>
      <section class="labx-analysis-scope-confirm" role="dialog" aria-modal="true" aria-label="Analiz kapsamı onayı">
        <div class="labx-analysis-scope-confirm__head">
          <span>Analiz kapsamı</span>
          <h3>Seçili alanla mı başlayalım?</h3>
          <p>${escapeHtml(formatAnalysisSelectionSummary(state))} için ayrı bir kapsam seçili.</p>
        </div>
        <div class="labx-analysis-scope-confirm__body">
          <button class="labx-analysis-scope-confirm__choice" type="button" data-lab-action="analysis-scope-choice" data-lab-value="selected">
            <strong>Seçili alan</strong>
            <span>Zaman aralığı veya ROI ile sınırlı analiz başlat.</span>
          </button>
          <button class="labx-analysis-scope-confirm__choice" type="button" data-lab-action="analysis-scope-choice" data-lab-value="full">
            <strong>Tamamı</strong>
            <span>Seçimi yok sayıp tüm kaynak üzerinde çalıştır.</span>
          </button>
        </div>
        <div class="labx-analysis-scope-confirm__actions">
          <button class="labx-inline-action" type="button" data-lab-action="analysis-scope-cancel">İptal</button>
        </div>
      </section>
    `;
    body.appendChild(overlay);
    analysisScopeOverlay = overlay;
    overlay
      .querySelector<HTMLElement>(
        "[data-lab-action='analysis-scope-choice'][data-lab-value='selected']"
      )
      ?.focus();
    return true;
  }

  function cancelAnalysisScopeOverlay() {
    removeAnalysisScopeOverlay();
    dispatch({
      type: "push-event",
      event: buildUiEvent("Analiz başlatılmadı.", "warning"),
    });
  }

  function startAnalysisFromScopeOverlay(choice: AnalysisScopeChoice) {
    removeAnalysisScopeOverlay();
    if (choice === "cancel") {
      cancelAnalysisScopeOverlay();
      return;
    }
    const state = deps.store.getState();
    const blockReason = getAnalysisActionBlockReason(state);
    if (blockReason !== null) {
      dispatch({
        type: "push-event",
        event: buildUiEvent(blockReason, "warning"),
      });
      return;
    }
    startDeepAnalysis(state, choice);
  }

  function requestAnalysisScopeChoice(state: LabControllerState): AnalysisScopeRequest {
    const selection = getWorkspaceAnalysisSelection(state);
    if (!selection.hasTimeRange && !selection.hasRoi) {
      return "selected";
    }
    if (showAnalysisScopeOverlay(state)) {
      return "pending";
    }
    return "selected";
  }

  function updateAnalysisScopeFromWorkspace(
    state: LabControllerState,
    choice: AnalysisScopeChoice,
    selectedIntentIds: LabIntentId[]
  ) {
    const selection = getWorkspaceAnalysisSelection(state);
    const ws = state.ui.workspace;
    updateWorkbench(function (workbench) {
      const nextScope: Record<string, unknown> = {};
      const hypothesis = ws.hypothesis.trim();
      if (hypothesis !== "") {
        nextScope["hypothesis"] = hypothesis;
      } else {
        delete nextScope["hypothesis"];
      }

      if (selectedIntentIds.length > 0) {
        nextScope["intentIds"] = Array.from(new Set(selectedIntentIds));
      } else {
        delete nextScope["intentIds"];
      }

      delete nextScope["frameRange"];
      if (choice === "selected" && selection.hasTimeRange) {
        nextScope["timeRange"] = {
          endMs: Math.round(selection.endMs || 0),
          startMs: Math.round(selection.startMs || 0),
        };
      } else {
        delete nextScope["timeRange"];
      }

      if (choice === "selected" && selection.region !== null) {
        nextScope["region"] = selection.region;
      } else {
        delete nextScope["region"];
      }

      const hasScopeContent = [
        "focus",
        "hypothesis",
        "timeRange",
        "frameRange",
        "region",
        "intentIds",
        "lifecycle",
      ].some(function (key) {
        return nextScope[key] !== undefined;
      });

      return {
        ...workbench,
        analysisScope: hasScopeContent ? nextScope : null,
      };
    });
  }

  function startDeepAnalysis(state: LabControllerState, scopeChoice: AnalysisScopeChoice) {
    const selectedIntentIds = getReadySelectedAnalysisIntentIds(state);
    const intentCapabilities = getReadySelectedAnalysisCapabilityIds(state);
    const { activeFeatureId } = deriveFeatureSelectionFromCapabilities(intentCapabilities);

    syncCapabilities(intentCapabilities);
    updateAnalysisScopeFromWorkspace(state, scopeChoice, selectedIntentIds);

    const sourceRecord = asLabRecord(state.source);
    if (asNonEmptyString(sourceRecord["previewUrl"]) === null) {
      sendMediaAction("edit-preview");
    }
    if (state.ui.workspace.preflightAutoRunEnabled !== false) {
      sendMediaAction("profile-run-preflight");
    }
    const runAction = activeFeatureId === "audio-analysis" ? "audio-process-run" : "process-run";
    dispatch({ type: "run-started", action: runAction });
    if (sendMediaAction(runAction) === null) {
      dispatch({
        type: "run-failed",
        action: runAction,
        detail: "Room API bridge is not connected.",
      });
    }
  }

  function requestDeepAnalysis(state: LabControllerState) {
    const scopeChoice = requestAnalysisScopeChoice(state);
    if (scopeChoice === "cancel" || scopeChoice === "pending") {
      return;
    }
    startDeepAnalysis(deps.store.getState(), scopeChoice);
  }

  function runPrimaryAction() {
    const state = deps.store.getState();

    if (hasReportPayload(state) && (state.ui.workspace.reportOverlayOpen || isRunComplete(state))) {
      startTrackedReportExport();
      return;
    }

    if (isRunActive(state)) {
      if (state.ui.analysisCancelPending === true) {
        return;
      }
      dispatch({ type: "analysis-cancel-requested" });
      sendMediaAction(
        state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel"
      );
      return;
    }
    if (getSourceReady(state) && getAnalysisActionBlockReason(state) === null) {
      requestDeepAnalysis(state);
      return;
    }

    if (getSourceReady(state) && getEditActionBlockReason(state) === null) {
      sendMediaAction("edit-preview");
      return;
    }

    runSourcePrimaryAction();
  }

  function handleFocusSurfacePointer(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    if (isInsideWorkspaceInspector(target)) {
      setLabFocusLayer("inspector");
      return;
    }
    if (isInsideWorkspacePreview(target)) {
      setLabFocusLayer("preview");
      return;
    }
    if (target.closest(".labx-timeline") !== null) {
      setLabFocusLayer("timeline");
    }
  }

  function handleFocusIn(event: Event) {
    handleFocusSurfacePointer(event);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && analysisScopeOverlay !== null) {
      event.preventDefault();
      cancelAnalysisScopeOverlay();
      return;
    }
    if (event.ctrlKey !== true || event.key.toLowerCase() !== "b") {
      return;
    }
    if (isTextControl(event.target)) {
      return;
    }
    event.preventDefault();
    dispatch({ type: "drawer-collapsed-toggled" });
  }

  function handleClick(event: Event) {
    closeLabAssetMenusForClick(event, deps.documentRef);
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    const actionButton = target.closest<HTMLElement>("[data-lab-action]");
    if (!actionButton) {
      return;
    }

    const action = toStringValue(actionButton.dataset["labAction"]);
    const value = toStringValue(actionButton.dataset["labValue"]);
    const state = deps.store.getState();
    if (isInsideWorkspaceInspector(target)) {
      setLabFocusLayer("inspector");
    } else if (isTimelineAction(action)) {
      setLabFocusLayer("timeline");
    }
    if (handleSourceClickAction(action, value)) {
      return;
    }
    switch (action) {
      case "primary-action":
        runPrimaryAction();
        return;
      case "workspace-toggle-source-intake":
        dispatch({ type: "workspace-source-intake-toggled" });
        return;
      case "workspace-controls-drawer-toggle":
        dispatch({ type: "workspace-controls-drawer-toggled" });
        return;
      case "workspace-controls-tab-select": {
        const tab = normalizeWorkspaceControlTab(value);
        if (tab !== null && state.ui.workspace.controlsDrawerTab !== tab) {
          dispatch({ type: "workspace-controls-tab-selected", tab });
        } else if (tab !== null && state.ui.workspace.controlsDrawerOpen !== true) {
          dispatch({ type: "workspace-controls-drawer-toggled", force: true });
        }
        return;
      }
      case "toggle-tool-manager":
        dispatch({ type: "tool-manager-toggled" });
        return;
      case "drawer-collapsed-toggled":
        dispatch({ type: "drawer-collapsed-toggled" });
        return;
      case "drawer-explore-toggled":
        dispatch({ type: "drawer-explore-toggled" });
        return;
      case "topbar-pill-selection":
        dispatch({
          type: "selection-tab-toggled",
          active: !state.ui.workspace.selectionTabActive,
        });
        return;
      case "topbar-pill-source":
        if (state.ui.workspace.selectionTabActive) {
          dispatch({ type: "selection-tab-toggled", active: false });
        }
        if (isRunActive(state) !== true) {
          dispatch({ type: "drawer-mode-requested", mode: "setup" });
        }
        return;
      case "topbar-pill-analyze":
        if (state.ui.workspace.selectionTabActive) {
          dispatch({ type: "selection-tab-toggled", active: false });
        }
        dispatch({ type: "drawer-mode-requested", mode: isRunActive(state) ? null : "setup" });
        return;
      case "topbar-pill-results":
        if (hasReportPayload(state)) {
          dispatch({ type: "drawer-mode-requested", mode: "result" });
        }
        return;
      case "close-tool-manager":
      case "dismiss-tool-manager":
        dispatch({ type: "tool-manager-toggled", open: false });
        return;
      case "tools-refresh":
        sendMediaAction("tools-refresh");
        return;
      case "tool-update-all":
        sendMediaAction("tool-update-all", {
          featureStage: getToolLifecycleStage(state),
          actionFamily: "tool-lifecycle",
        });
        return;
      case "tool-install-review":
        if (value.trim() !== "") {
          dispatch({ type: "tool-install-review-requested", toolId: value });
        }
        return;
      case "tool-install-dismiss":
        dispatch({ type: "tool-install-review-dismissed" });
        return;
      case "tool-install-confirm":
        if (value.trim() === "") {
          return;
        }
        dispatch({ type: "tool-install-review-dismissed" });
        sendMediaAction("tool-install", {
          toolId: value,
          featureStage: getToolLifecycleStage(state),
          actionFamily: "tool-lifecycle",
        });
        return;
      case "tool-job-cancel":
        if (value.trim() !== "") {
          sendMediaAction("job-cancel", {
            jobId: value,
            actionFamily: "tool-lifecycle",
          });
        }
        return;
      case "tool-install":
      case "tool-update":
      case "tool-check-updates":
        if (value.trim() === "") {
          return;
        }
        sendMediaAction(action, {
          toolId: value,
          featureStage: getToolLifecycleStage(state),
          actionFamily: "tool-lifecycle",
        });
        return;
      case "feature-activate":
        activateFeature(value);
        return;
      case "feature-toggle":
        toggleFeature(value);
        return;
      case "capability-select":
        syncCapabilities(
          deps.store
            .getState()
            .selectedCapabilities.concat(
              value as import("../models/lab-types.js").CapabilityFamilyId
            )
        );
        return;
      case "capability-deselect":
        syncCapabilities(
          deps.store.getState().selectedCapabilities.filter(function (entry) {
            return entry !== value;
          })
        );
        return;
      case "capability-toggle": {
        const caps = deps.store.getState().selectedCapabilities;
        syncCapabilities(
          caps.includes(value as import("../models/lab-types.js").CapabilityFamilyId)
            ? caps.filter(function (entry) {
                return entry !== value;
              })
            : caps.concat(value as import("../models/lab-types.js").CapabilityFamilyId)
        );
        return;
      }
      case "module-toggle":
        if (isWorkspaceMutationLocked("intents")) {
          pushLockedWorkspaceEvent("Analiz modülleri aktif analiz sırasında kilitli.");
          return;
        }
        {
          const parsed = parseAnalysisPreparationModuleValue(value);
          if (parsed) {
            dispatch({
              type: "analysis-prep-module-toggled",
              intentId: parsed.intentId,
              moduleId: parsed.moduleId,
            });
            syncCurrentWorkbenchToHost();
          }
        }
        return;
      case "edit-mode":
        sendMediaAction("edit-set-mode", { mode: value });
        return;
      case "profile-mode":
        sendMediaAction("profile-set-mode", { mode: value });
        return;
      case "report-view":
        dispatch({
          type: "report-view-changed",
          view: value === "ai" ? "ai" : "user",
        });
        return;
      case "toggle-artifacts":
        dispatch({ type: "toggle-artifacts" });
        return;
      case "toggle-event-feed":
        dispatch({ type: "toggle-event-feed" });
        return;
      case "event-feed-next":
        dispatch({ type: "advance-event-feed" });
        return;
      case "event-feed-reset":
        dispatch({ type: "reset-event-feed" });
        return;
      case "toggle-live-findings":
        dispatch({ type: "live-findings-expanded" });
        return;
      case "toggle-analysis-controls":
        dispatch({ type: "analysis-controls-collapsed" });
        return;
      case "toggle-edit-side-panel":
        dispatch({ type: "edit-side-panel-toggled" });
        return;
      case "toggle-raw-log":
        dispatch({ type: "raw-log-toggled" });
        return;
      case "show-more-artifacts":
        dispatch({ type: "show-more-artifacts" });
        return;
      case "preview-artifact":
        dispatch({
          type: "preview-artifact-activated",
          artifactId: value.trim() !== "" ? value : null,
        });
        return;
      case "new-run-from-report": {
        const run = getCurrentRun(state);
        if (run?.analysisScope) {
          updateWorkbench(function (workbench) {
            return {
              ...workbench,
              forkedFromRunId: run.id,
              analysisScope: {
                ...run.analysisScope,
                lifecycle: {
                  mutable: true,
                  processId: null,
                  frozenAt: null,
                },
              },
            };
          });
        }
        dispatch({ type: "preview-artifact-activated", artifactId: null });
        dispatch({ type: "report-overlay-toggled", open: false });
        return;
      }
      case "save-project": {
        saveActiveProjectCheckpoint();
        return;
      }
      case "analysis-scope-choice":
        startAnalysisFromScopeOverlay(parseAnalysisScopeChoice(value));
        return;
      case "analysis-scope-cancel":
        cancelAnalysisScopeOverlay();
        return;
      case "run-deep-analysis": {
        const blockReason = getAnalysisActionBlockReason(state);
        if (blockReason !== null) {
          dispatch({
            type: "push-event",
            event: buildUiEvent(blockReason, "warning"),
          });
          return;
        }
        requestDeepAnalysis(state);
        return;
      }
      case "preflight-auto-run-toggle":
        dispatch({ type: "analysis-preflight-auto-run-toggled" });
        syncCurrentWorkbenchToHost();
        return;
      case "cancel-analysis": {
        const run = getCurrentRun(state);
        if (
          run &&
          (run.state === "running" || run.state === "queued") &&
          state.ui.analysisCancelPending !== true
        ) {
          dispatch({ type: "analysis-cancel-requested" });
          sendMediaAction(
            state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel"
          );
        }
        return;
      }
      case "project-select": {
        selectProjectByValue(value);
        return;
      }
      case "project-create": {
        startCleanProjectSession();
        return;
      }
      case "project-delete": {
        deleteActiveProject();
        return;
      }
      case "workspace-roi-toggle":
        if (isWorkspaceMutationLocked("roi")) {
          pushLockedWorkspaceEvent("ROI düzenleme aktif analiz sırasında kilitli.");
          return;
        }
        if (value.trim() !== "") {
          dispatch({ type: "workspace-roi-toggled", regionId: value });
        }
        return;
      case "workspace-roi-remove":
        if (isWorkspaceMutationLocked("roi")) {
          pushLockedWorkspaceEvent("ROI düzenleme aktif analiz sırasında kilitli.");
          return;
        }
        if (value.trim() !== "") {
          dispatch({ type: "workspace-roi-removed", regionId: value });
        }
        return;
      case "workspace-roi-export": {
        exportWorkspaceRoi(value);
        return;
      }
      case "workspace-selection-roi-export": {
        exportSelectionRoi();
        return;
      }
      case "workspace-enhanced-frame-export": {
        exportEnhancedFrame();
        return;
      }
      case "workspace-before-after-export": {
        exportBeforeAfterVariant();
        return;
      }
      case "workspace-image-comparison-export": {
        exportImageComparison();
        return;
      }
      case "timeline-export-clip": {
        exportTimelineClip();
        return;
      }
      case "timeline-stabilize-segment": {
        exportStabilizedSegment();
        return;
      }
      case "timeline-grab-frame": {
        grabTimelineFrame();
        return;
      }
      case "timeline-extract-audio":
        extractTimelineAudio();
        return;
      case "workspace-audio-cleanup-export":
        exportAudioCleanup();
        return;
      case "workspace-band-pass-voice-export":
        exportBandPassVoice();
        return;
      case "workspace-stem-separation-export":
        exportStemSeparation();
        return;
      case "timeline-toggle-micro-zoom":
        dispatch({ type: "workspace-selection-micro-zoom-toggled" });
        return;
      case "timeline-toggle-selection-loop":
        if (isWorkspaceMutationLocked("timeline")) {
          return;
        }
        dispatch({ type: "workspace-selection-loop-toggled" });
        return;
      case "timeline-play-selection":
        if (isWorkspaceMutationLocked("timeline")) {
          return;
        }
        playSelectedTimelineRange();
        return;
      case "timeline-toggle-playback":
        if (isWorkspaceMutationLocked("timeline")) {
          return;
        }
        toggleTimelinePlayback();
        return;
      case "timeline-shift-playhead":
        if (isWorkspaceMutationLocked("timeline")) {
          return;
        }
        shiftTimelinePlayhead(value);
        return;
      case "source-activate-asset":
        if (value.trim() !== "") {
          if (isRunActive(state)) {
            pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
            return;
          }
          sendMediaAction("source-activate-asset", { assetId: value });
        }
        return;
      case "workspace-content-open":
        dispatch({
          type: "workspace-content-opened",
          assetId: value.trim() !== "" ? value : null,
        });
        return;
      case "workspace-comparison-reference-set":
        dispatch({
          type: "workspace-comparison-reference-set",
          assetId: value.trim() !== "" ? value : null,
        });
        return;
      case "open-document-overlay":
        if (value.trim() !== "") {
          dispatch({
            type: "document-overlay-opened",
            assetId: value,
          });
        }
        return;
      case "focus-source-preview":
        if (value.trim() !== "") {
          focusSourcePreview();
        }
        return;
      case "asset-download":
        if (value.trim() !== "") {
          downloadAsset(value);
        }
        return;
      case "asset-remove":
        removeAssetsWithConfirmation([value]);
        return;
      case "workspace-intent-toggle":
        if (isWorkspaceMutationLocked("intents")) {
          pushLockedWorkspaceEvent("Analiz amaçları aktif analiz sırasında kilitli.");
          return;
        }
        if (value.trim() !== "") {
          dispatch({
            type: "workspace-intent-toggled",
            intentId: value as import("../models/lab-types.js").LabIntentId,
          });
          syncCurrentWorkbenchToHost();
        }
        return;
      case "analysis-prep-group-toggle":
        if (value.trim() !== "") {
          dispatch({
            type: "analysis-prep-group-toggled",
            intentId: value as import("../models/lab-types.js").LabIntentId,
          });
        }
        return;
      case "workspace-process-view-toggled":
        dispatch({ type: "workspace-process-view-toggled" });
        return;
      case "workspace-setting-adjust":
        applyWorkspaceSettingAdjustment(actionButton);
        return;
      case "operation-cancel":
        cancelTrackedOperation(value);
        return;
      case "operation-settings-reset":
        resetOperationSettings(value);
        return;
      case "analysis-settings-reset":
        resetAnalysisModuleSettings(value);
        return;
      case "workspace-image-analysis":
        dispatch({ type: "workspace-image-analysis-requested" });
        sendMediaAction("edit-preview");
        return;
      case "workspace-reset-controls":
        dispatch({
          type: "workspace-interactive-updated",
          patch: { ...DEFAULT_LAB_INTERACTIVE_SETTINGS },
        });
        return;
      case "workspace-reset-audio-focus":
        dispatch({
          type: "workspace-audio-updated",
          patch: DEFAULT_AUDIO_FOCUS_SETTINGS,
        });
        return;
      case "timeline-add-bookmark":
        addCurrentTimelineBookmark();
        return;
      case "timeline-remove-bookmark":
        if (value.trim() !== "") {
          dispatch({ type: "workspace-bookmark-removed", bookmarkId: value });
        }
        return;
      case "timeline-seek":
        if (isWorkspaceMutationLocked("timeline")) {
          return;
        }
        if (value.trim() !== "") {
          const timeMs = Number(value);
          if (Number.isFinite(timeMs) !== true) {
            return;
          }
          seekTimelineToMs(timeMs);
          centerTimelineTarget(actionButton);
        }
        return;
      case "timeline-set-selection-boundary":
        if (isWorkspaceMutationLocked("timeline")) {
          pushLockedWorkspaceEvent("Zaman aralığı aktif analiz sırasında kilitli.");
          return;
        }
        setTimelineSelectionBoundary(value);
        return;
      case "timeline-interact":
      case "timeline-drag-start":
      case "timeline-drag-end":
      case "timeline-drag-body":
        return;
      case "timeline-finetune": {
        if (isWorkspaceMutationLocked("timeline")) {
          pushLockedWorkspaceEvent("Zaman aralığı aktif analiz sırasında kilitli.");
          return;
        }
        const parts = value.split(":");
        if (parts.length === 2) {
          const prefix = parts[0];
          const delta = Number(parts[1]);
          if ((prefix === "start" || prefix === "end") && Number.isFinite(delta)) {
            const currentStart = state.ui.workspace.timelineStartMs;
            const currentEnd = state.ui.workspace.timelineEndMs;
            const timelineEl = target.closest<HTMLElement>(".labx-timeline");
            const finetuneDurationMs = timelineEl ? Number(timelineEl.dataset["duration"] || 0) : 0;
            if (prefix === "start" && currentStart !== null) {
              const next = Math.max(
                0,
                Math.min(currentEnd ?? finetuneDurationMs, currentStart + delta)
              );
              dispatch({ type: "workspace-timeline-updated", startMs: next, endMs: currentEnd });
            } else if (prefix === "end" && currentEnd !== null) {
              const maxMs = finetuneDurationMs || currentEnd + Math.abs(delta);
              const next = Math.max(currentStart ?? 0, Math.min(maxMs, currentEnd + delta));
              dispatch({ type: "workspace-timeline-updated", startMs: currentStart, endMs: next });
            }
          }
        }
        return;
      }
      case "timeline-clear": {
        if (isWorkspaceMutationLocked("timeline")) {
          pushLockedWorkspaceEvent("Zaman aralığı aktif analiz sırasında kilitli.");
          return;
        }
        dispatch({ type: "workspace-timeline-updated", startMs: null, endMs: null });
        return;
      }
      case "toggle-report-view":
        dispatch({ type: "document-overlay-cleared" });
        dispatch({ type: "report-overlay-toggled", open: true });
        return;
      case "open-report-overlay":
        dispatch({ type: "document-overlay-cleared" });
        if (value === "ai" || value === "user") {
          dispatch({
            type: "report-view-changed",
            view: value,
          });
        }
        dispatch({ type: "report-overlay-toggled", open: true });
        return;
      case "close-report-overlay":
        dispatch({ type: "report-overlay-toggled", open: false });
        return;
      case "report-tab-switch":
        dispatch({
          type: "report-view-changed",
          view: value === "ai" ? "ai" : "user",
        });
        return;
      case "report-export-json":
        startTrackedReportExport();
        return;
      case "report-export-pdf":
        startTrackedReportExport();
        return;
      case "source-panel-toggle":
        dispatch({ type: "source-panel-toggled" });
        return;
      case "inspector-pin-toggle":
        dispatch({ type: "inspector-pin-toggle" });
        return;
      case "icon-rail-slot-select":
        dispatch({
          type: "icon-rail-slot-selected",
          slotId:
            value.trim() !== ""
              ? (value as import("../models/lab-types.js").LabIconRailSlotId)
              : null,
        });
        return;
      default:
        return;
    }
  }

  function attach() {
    if (attached) {
      return;
    }
    attached = true;
    deps.documentRef.addEventListener("click", handleClick);
    deps.documentRef.addEventListener("contextmenu", openLabAssetContextMenu);
    deps.documentRef.addEventListener("input", handleInput);
    deps.documentRef.addEventListener("change", handleChange);
    deps.documentRef.addEventListener("focusin", handleFocusIn);
    deps.documentRef.addEventListener("mousedown", handleMouseDown);
    deps.documentRef.addEventListener("pointerdown", handleFocusSurfacePointer);
    deps.documentRef.addEventListener("keydown", handleKeyDown as EventListener);
    deps.windowRef.addEventListener("mousemove", handleTimelineMouseMove as EventListener);
    deps.windowRef.addEventListener("mouseup", handleTimelineMouseUp as EventListener);
    let prevHeavyWorkActive = isAnyHeavyWorkActive(deps.store.getState());
    deps.store.subscribe(function () {
      syncTimelinePlaybackUiFromState();
      workspaceAudioVisualizer.sync();
      const currentHeavy = isAnyHeavyWorkActive(deps.store.getState());
      if (currentHeavy && !prevHeavyWorkActive) {
        const media = getTimelineSyncMedia();
        if (media !== null && media.paused === false) {
          media.pause?.();
        }
      }
      prevHeavyWorkActive = currentHeavy;
    });
    queueMicrotask(function () {
      syncTimelinePlaybackUiFromState();
      workspaceAudioVisualizer.sync();
    });
  }

  function getPrimaryActionState() {
    return getLabPrimaryActionState(deps.store.getState());
  }

  function handleBusEvent(event: LabStoreEvent) {
    handleMediaActionBusEvent();
    if (event.type === "workspace-selection-suggestion-queued") {
      syncCurrentWorkbenchToHost();
      return;
    }
    if (event.type !== "workspace-selection-suggestion-accepted") {
      return;
    }
    syncCurrentWorkbenchToHost();
  }

  deps.eventBus.subscribe(handleBusEvent);

  return {
    attach,
    getPrimaryActionState,
  };
}
