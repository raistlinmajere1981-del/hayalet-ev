import type {
  RepairImageRect,
  RepairPanelId,
  RepairSettingsOverlayTabId,
  RepairWorkbenchViewport,
} from "../shared/types/index.js";
import type { RepairUiState, RepairUiSnapshotMeta } from "../shared/ui/state.js";
import {
  createRepairDefaultContinuityProjection,
  createRepairDefaultGuidanceProjection,
  createRepairDefaultOperationsProjection,
  createRepairDefaultVoiceReadinessProjection,
} from "../shared/ui/state.js";
import { normalizeRepairHostMessage } from "../shared/ui/host-messages.js";
import { REPAIR_ROOM_ID } from "../shared/repair-constants.js";
import { createRepairUiRequestRuntime } from "../shared/ui/request-runtime.js";

import { renderSessionRailPanel } from "./panels/session-rail-panel.js";
import { renderWorkbenchStagePanel } from "./panels/workbench-stage-panel.js";
import { renderTacticalFeedPanel } from "./panels/tactical-feed-panel.js";
import { renderKnowledgePackPanel } from "./panels/knowledge-pack-panel.js";
import { renderVisualTimelinePanel } from "./panels/visual-timeline-panel.js";
import { renderOperatorProfilePanel } from "./panels/operator-profile-panel.js";
import { renderChatPanel } from "./panels/chat-panel.js";
import { renderMeasurementPanel } from "./panels/measurement-panel.js";
import { renderRoomSyncPanel } from "./panels/room-sync-panel.js";
import { getContainedImageFrame } from "./overlay/overlay-coords.js";
import { getRepairFocusFrame } from "./overlay/overlay-geometry.js";
import { resolveRepairAssetUrl } from "./repair-asset-url.js";
import {
  REPAIR_DOCK_PANEL_IDS,
  getRepairDockGridTemplateColumns,
  getRepairDockLayoutProjection,
  getRepairVisibleDockPanelIds,
  type RepairDockLayoutProjection,
} from "./runtime/dock-layout.js";
import {
  setClassNameIfChanged,
  setDatasetIfChanged,
  setStyleIfChanged,
  setTextIfChanged,
} from "./runtime/dom-utils.js";
import { createInitialRepairUiState } from "./runtime/state.js";
import { createSpatialFocusTween, type RepairSpatialFocusTween } from "./runtime/spatial-focus.js";
// Spatial focus animation remains requestAnimationFrame/cancelAnimationFrame-backed in runtime/spatial-focus.ts.
// Keyboard navigation keeps case "Home" and case "End" handling in runtime/keyboard.ts.
import {
  getAssistanceProfileLabel,
  getCameraStatusChipState,
  getCameraStatusChipText,
  getCameraStatusChipTitle,
  getRouteLabel,
} from "./runtime/status-helpers.js";
import { getGuidanceSurfaceForPanel } from "./runtime/guidance-helpers.js";
import { createRepairKeyboardController } from "./runtime/keyboard.js";
import { createRepairMeasurementDomRuntime } from "./runtime/measurement-dom.js";
import { createRepairDictationComposer } from "./runtime/dictation-composer.js";
import { createRepairCaptureStatusHandlers } from "./runtime/capture-status-handlers.js";
import { createRepairVisualTimelineDomRuntime } from "./runtime/visual-timeline-dom.js";
import { createRepairTacticalFeedDomRuntime } from "./runtime/tactical-feed-dom.js";
import { createRepairSyncInspectorDomRuntime } from "./runtime/sync-inspector-dom.js";
import { buildRepairPanelSignature } from "./runtime/panel-signatures.js";
import { createRepairOverlayRuntime } from "./runtime/overlay-runtime.js";

export {
  REPAIR_DOCK_PANEL_IDS,
  getRepairDockGridTemplateColumns,
  getRepairDockLayoutProjection,
  getRepairVisibleDockPanelIds,
  type RepairDockLayoutProjection,
};

interface RepairUiWindow {
  roomAPI?: {
    close?: () => boolean;
    ready: (payload?: Record<string, unknown>) => boolean;
    sendCommand: (command: string, payload?: Record<string, unknown>) => boolean;
    onHostMessage: (callback: (payload: unknown) => void) => () => void;
    offHostMessage: (callback: (payload: unknown) => void) => void;
  };
}

interface RepairUiContext {
  roomId: string;
  locale: string;
  translations: Record<string, unknown>;
}

type RepairPanelRenderer = () => HTMLElement;

interface RepairPanelLifecycle {
  panelId: RepairPanelId;
  signature: string;
  mount: (parent: HTMLElement) => HTMLElement;
  update: (element: HTMLElement) => HTMLElement;
  dispose: (element: HTMLElement) => void;
}

interface RepairPersistentShell {
  root: HTMLElement;
  clock: HTMLElement;
  workspace: HTMLElement;
  rightStack: HTMLElement;
  dock: HTMLElement;
  settingsOverlay: HTMLElement;
  settingsOverlayBody: HTMLElement;
  settingsOverlaySignature: string;
  panelElements: Map<RepairPanelId, HTMLElement>;
  panelSignatures: Map<RepairPanelId, string>;
}

export function createRepairRoomUiRuntime() {
  const state: RepairUiState = createInitialRepairUiState();
  const meta: RepairUiSnapshotMeta = {
    schemaVersion: 1,
    generatedAt: "",
    events: [],
    replay: {
      playheadMs: 0,
      replayMode: "live",
      operationsAvailable: false,
      operations: createRepairDefaultOperationsProjection(),
      voiceReadiness: createRepairDefaultVoiceReadinessProjection(),
      continuity: createRepairDefaultContinuityProjection(),
      liveSource: { available: false, connected: false },
      visibleEvents: [],
      overlayEvents: [],
      tacticalFeed: [],
      measurementEvidence: [],
      aiMarkEventIds: [],
      activeSnapshotEventId: null,
      activeFreezeFrameEventId: null,
      focusSuggestionEventId: null,
      knowledgeRegions: [],
      investigationRegions: [],
      temporarySpatialRegions: [],
      measurementRelationships: [],
      timelineDensity: [],
      activeSpatialFocus: null,
      operationalMode: "live",
      guidance: createRepairDefaultGuidanceProjection(),
    },
  };
  const context: RepairUiContext = { roomId: REPAIR_ROOM_ID, locale: "en", translations: {} };
  const requestRuntime = createRepairUiRequestRuntime();
  const windowRef = window as unknown as RepairUiWindow;
  const documentRef = document;

  let shell: RepairPersistentShell | null = null;
  let clockInterval: ReturnType<typeof setInterval> | null = null;
  let spatialFocusTween: RepairSpatialFocusTween | null = null;
  let spatialFocusTweenToken = 0;
  let lastSpatialFocusKey: string | null = null;
  const keyboardController = createRepairKeyboardController({
    cancelSpatialFocusTween,
    meta,
    requestRuntime,
    state,
  });

  // -- i18n helper
  function text(path: string[], fallback: string): string {
    let node: unknown = context.translations;
    for (const key of path) {
      if (typeof node === "object" && node !== null && key in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[key];
      } else {
        return fallback;
      }
    }
    return typeof node === "string" ? node : fallback;
  }

  function createWorkbenchEmptyState(): HTMLElement {
    const placeholder = documentRef.createElement("div");
    placeholder.className = "repair-empty-state";

    const title = documentRef.createElement("div");
    title.className = "repair-empty-state__title";
    title.textContent = text(["workbench", "noImage"], "Board image required");
    placeholder.append(title);

    const copy = documentRef.createElement("div");
    copy.className = "repair-empty-state__copy";
    copy.textContent = text(
      ["workbench", "noImageHelp"],
      "Start the Android camera or attach a board image to unlock overlays, measurements, and guided repair steps."
    );
    placeholder.append(copy);

    const steps = documentRef.createElement("div");
    steps.className = "repair-empty-state__steps";
    ["Start camera", "Frame board", "Freeze when ready"].forEach((step) => {
      const item = documentRef.createElement("span");
      item.textContent = step;
      steps.append(item);
    });
    placeholder.append(steps);

    return placeholder;
  }

  function buildPanelSignature(panelId: RepairPanelId): string {
    return buildRepairPanelSignature({ meta, panelId, state });
  }

  function applyLiveSnapshotUpdates(): void {
    visualTimelineDom.updateTimelineLiveDom();
    measurementDom.updateMeasurementLiveDom();
    syncInspectorDom.updateSyncLiveDom();
  }

  function updateCursorHud(point: { xPx: number; yPx: number }): void {
    const gridX = Math.max(0, Math.round(point.xPx / 80));
    const gridY = Math.max(0, Math.round(point.yPx / 80));
    state.workbench.cursor = { xPx: point.xPx, yPx: point.yPx, gridX, gridY };
    const hud = documentRef.querySelector<HTMLElement>(".repair-coord-hud");
    if (hud !== null) {
      syncCoordHudLabels(hud, [`X ${point.xPx}`, `Y ${point.yPx}`, `GRID ${gridX}x${gridY}`]);
    }
  }

  function cancelSpatialFocusTween(): void {
    spatialFocusTweenToken += 1;
    spatialFocusTween?.cancel();
    spatialFocusTween = null;
  }

  function getSpatialFocusKey(): string | null {
    const focus = meta.replay.activeSpatialFocus;
    if (focus === null || focus.region === null) return null;
    return JSON.stringify({ ref: focus.ref, region: focus.region });
  }

  function clampUiViewportPan(
    viewport: RepairWorkbenchViewport,
    imageWidthPx: number,
    imageHeightPx: number
  ): RepairWorkbenchViewport {
    const maxX = Math.max(0, imageWidthPx * Math.max(0, viewport.zoom - 1));
    const maxY = Math.max(0, imageHeightPx * Math.max(0, viewport.zoom - 1));
    return {
      zoom: viewport.zoom,
      panXPx: Math.max(-maxX, Math.min(maxX, viewport.panXPx)),
      panYPx: Math.max(-maxY, Math.min(maxY, viewport.panYPx)),
    };
  }

  function getSpatialFocusViewportTarget(
    viewport: HTMLElement,
    region: RepairImageRect
  ): RepairWorkbenchViewport | null {
    const session = state.sessions.detail;
    const image = session?.pcbImage ?? null;
    if (image === null) return null;
    const bounds = viewport.getBoundingClientRect();
    const width = Math.max(1, bounds.width || viewport.clientWidth || 1);
    const height = Math.max(1, bounds.height || viewport.clientHeight || 1);
    const frame = getContainedImageFrame(width, height, image.widthPx, image.heightPx);
    const focusFrame = getRepairFocusFrame(region, image.widthPx, image.heightPx, 54);
    const zoomForWidth = (width * 0.62) / Math.max(1, focusFrame.widthPx * frame.scale);
    const zoomForHeight = (height * 0.62) / Math.max(1, focusFrame.heightPx * frame.scale);
    const zoom = Math.min(3.2, Math.max(1.05, Math.min(zoomForWidth, zoomForHeight)));
    const center = {
      xPx: focusFrame.xPx + focusFrame.widthPx / 2,
      yPx: focusFrame.yPx + focusFrame.heightPx / 2,
    };
    return clampUiViewportPan(
      {
        zoom,
        panXPx: width / 2 - frame.leftPx - center.xPx * frame.scale * zoom,
        panYPx: height / 2 - frame.topPx - center.yPx * frame.scale * zoom,
      },
      image.widthPx,
      image.heightPx
    );
  }

  function applyLocalWorkbenchViewport(viewport: RepairWorkbenchViewport): void {
    state.workbench.viewport = viewport;
    const workbenchPanel = shell?.panelElements.get("workbench-stage") ?? null;
    if (workbenchPanel !== null) {
      updateWorkbenchPanelDom(workbenchPanel);
    }
    if (shell !== null) {
      void overlayRuntime.syncOverlay(shell.root);
    }
  }

  function syncSpatialFocusTween(): void {
    const focusKey = getSpatialFocusKey();
    if (focusKey === null) {
      lastSpatialFocusKey = null;
      cancelSpatialFocusTween();
      return;
    }
    if (focusKey === lastSpatialFocusKey) return;
    const viewport = documentRef.querySelector<HTMLElement>(".repair-viewport");
    const focusRegion = meta.replay.activeSpatialFocus?.region ?? null;
    if (viewport === null || focusRegion === null) return;
    const target = getSpatialFocusViewportTarget(viewport, focusRegion);
    if (target === null) return;

    cancelSpatialFocusTween();
    lastSpatialFocusKey = focusKey;
    const token = spatialFocusTweenToken;
    spatialFocusTween = createSpatialFocusTween({
      durationMs: 420,
      from: state.workbench.viewport,
      to: target,
      onUpdate: (viewport) => {
        if (token !== spatialFocusTweenToken) return;
        applyLocalWorkbenchViewport(viewport);
      },
      onComplete: () => {
        if (token !== spatialFocusTweenToken) return;
        spatialFocusTween = null;
        applyLocalWorkbenchViewport(target);
        requestRuntime.updateViewport({
          viewportZoom: target.zoom,
          panXPx: target.panXPx,
          panYPx: target.panYPx,
        });
      },
    });
  }

  function applyPanelGuidanceChrome(panel: HTMLElement, panelId: RepairPanelId): void {
    const visibility = state.guidance.panelVisibility.panels[panelId];
    const guidanceSurface = getGuidanceSurfaceForPanel(panelId);
    const corridorPassive =
      state.guidance.focusCorridor.active &&
      guidanceSurface !== "none" &&
      !state.guidance.focusCorridor.allowedSurfaces.includes(guidanceSurface);
    setDatasetIfChanged(panel, "visibility", visibility);
    setDatasetIfChanged(panel, "primarySurface", state.guidance.panelVisibility.primarySurface);
    setDatasetIfChanged(panel, "operationalProfile", state.guidance.operationalProfile);
    setDatasetIfChanged(panel, "corridor", corridorPassive ? "passive" : "allowed");
    if (panelId === "tactical-feed") {
      setDatasetIfChanged(panel, "feedDensity", state.guidance.panelVisibility.tacticalFeedDensity);
    }
    panel.classList.toggle(
      "repair-panel--dominant",
      panelId === state.guidance.panelVisibility.primarySurface
    );
    panel.classList.toggle(
      "repair-panel--subdued",
      state.guidance.panelVisibility.subduedPanelIds.includes(panelId)
    );
    panel.classList.toggle("repair-panel--hidden-policy", visibility === "hidden");
    panel.classList.toggle("repair-panel--compact-policy", visibility === "compact");
    panel.classList.toggle("repair-panel--contextual-policy", visibility === "contextual");
    panel.classList.toggle("repair-panel--expanded-policy", visibility === "expanded");
    panel.classList.toggle("repair-panel--corridor-passive", corridorPassive);
  }

  function updatePanelChrome(panel: HTMLElement, panelId: RepairPanelId): void {
    applyPanelGuidanceChrome(panel, panelId);
    const collapsed = state.layout.collapsedPanels[panelId];
    panel.classList.toggle("repair-panel--collapsed", collapsed);

    const collapse = panel.querySelector<HTMLElement>(
      "[data-repair-action='toggle-panel-collapse']"
    );
    if (collapse !== null) {
      const nextTitle = collapsed ? "Expand panel" : "Collapse panel";
      const nextText = collapsed ? "Show" : "Hide";
      if (collapse.title !== nextTitle) collapse.title = nextTitle;
      setTextIfChanged(collapse, nextText);
      setDatasetIfChanged(collapse, "collapsed", String(!collapsed));
    }
  }

  const measurementDom = createRepairMeasurementDomRuntime({
    documentRef,
    state,
    updatePanelChrome,
  });
  const visualTimelineDom = createRepairVisualTimelineDomRuntime({
    applyLiveSnapshotUpdates,
    documentRef,
    meta,
    state,
    updatePanelChrome,
  });
  const tacticalFeedDom = createRepairTacticalFeedDomRuntime({
    documentRef,
    state,
    updatePanelChrome,
  });
  const syncInspectorDom = createRepairSyncInspectorDomRuntime({
    documentRef,
    meta,
    state,
    text,
    updatePanelChrome,
  });
  const overlayRuntime = createRepairOverlayRuntime({
    cancelSpatialFocusTween,
    meta,
    onCursor: updateCursorHud,
    requestRuntime,
    state,
  });
  const dictationComposer = createRepairDictationComposer({
    documentRef,
    requestRuntime,
    state,
  });
  const captureStatusHandlers = createRepairCaptureStatusHandlers({
    render,
    requestRuntime,
    state,
  });

  function syncDockLayout(dock: HTMLElement): void {
    const dockLayout = getRepairDockLayoutProjection(state.guidance.panelVisibility.panels);
    const visiblePanelCount = dockLayout.visiblePanelIds.length;
    if (dock.hidden !== (visiblePanelCount === 0)) {
      dock.hidden = visiblePanelCount === 0;
    }
    setDatasetIfChanged(dock, "visiblePanelCount", String(visiblePanelCount));
    setStyleIfChanged(dock, "gridTemplateColumns", dockLayout.gridTemplateColumns);
  }

  function syncCoordHudLabels(hud: HTMLElement, labels: string[]): void {
    labels.forEach((labelText, index) => {
      const item = hud.children.item(index);
      const labelElement = item instanceof HTMLElement ? item : documentRef.createElement("span");
      if (item === null) {
        hud.append(labelElement);
      }
      setTextIfChanged(labelElement, labelText);
    });

    while (hud.children.length > labels.length) {
      hud.children.item(hud.children.length - 1)?.remove();
    }
  }

  function updateWorkbenchPanelDom(panel: HTMLElement): void {
    updatePanelChrome(panel, "workbench-stage");

    const dot = panel.querySelector<HTMLElement>(".repair-panel__status-dot");
    if (dot !== null) {
      setClassNameIfChanged(
        dot,
        `repair-panel__status-dot repair-panel__status-dot--${
          state.workbench.isFrozen ? "amber" : "live"
        }`
      );
    }

    const liveChip = panel.querySelector<HTMLElement>(".repair-live-chip");
    if (liveChip !== null) {
      if (state.workbench.isFrozen) {
        setClassNameIfChanged(liveChip, "repair-live-chip repair-live-chip--frozen");
        const frozenTime = state.workbench.frozenAt
          ? new Date(state.workbench.frozenAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "--:--:--";
        setTextIfChanged(liveChip, `FROZEN — ${frozenTime}`);
      } else {
        setClassNameIfChanged(liveChip, "repair-live-chip");
        setTextIfChanged(liveChip, "LIVE");
      }
    }

    const zoomInfo = panel.querySelector<HTMLElement>(".repair-workbench-header__info");
    if (zoomInfo !== null) {
      setTextIfChanged(zoomInfo, `${state.workbench.viewport.zoom.toFixed(1)}x`);
    }

    const viewport = panel.querySelector<HTMLElement>(".repair-viewport");
    if (viewport !== null) {
      viewport.classList.toggle("repair-viewport--frozen", state.workbench.isFrozen);
      setDatasetIfChanged(viewport, "cursor", state.workbench.contextualCursor);
      setDatasetIfChanged(viewport, "mode", getWorkbenchViewportMode());
      setDatasetIfChanged(viewport, "liveSource", state.workbench.liveSource.sourceType ?? "image");
      const overlayHost = viewport.querySelector<HTMLElement>(
        "[data-repair-overlay-stage='workbench']"
      );
      const existingLiveFrame = viewport.querySelector<HTMLImageElement>(
        ".repair-viewport__live-frame"
      );
      const existingImage = viewport.querySelector<HTMLImageElement>(".repair-viewport__image");
      const existingPlaceholder = viewport.querySelector<HTMLElement>(".repair-empty-state");
      const session = state.sessions.detail;
      const livePreview = state.workbench.liveSource.preview;
      const liveStreamUrl =
        livePreview?.source === "mjpeg-stream" &&
        livePreview.streamUrl !== null &&
        livePreview.streamUrl !== undefined
          ? livePreview.streamUrl.trim()
          : "";

      if (liveStreamUrl !== "") {
        const liveFrame = existingLiveFrame ?? documentRef.createElement("img");
        setClassNameIfChanged(liveFrame, "repair-viewport__live-frame");
        if (liveFrame.getAttribute("src") !== liveStreamUrl) liveFrame.src = liveStreamUrl;
        liveFrame.alt = livePreview?.label ?? "Android camera live feed";
        if (liveFrame.draggable) liveFrame.draggable = false;
        existingImage?.remove();
        existingPlaceholder?.remove();
        if (existingLiveFrame === null) {
          viewport.insertBefore(liveFrame, overlayHost ?? viewport.firstChild);
        }
      } else if (session !== null && session.pcbImage !== null) {
        existingLiveFrame?.remove();
        const resolvedSrc = resolveRepairAssetUrl(session.pcbImage.src) ?? session.pcbImage.src;
        const image = existingImage ?? documentRef.createElement("img");
        setClassNameIfChanged(image, "repair-viewport__image");
        if (image.getAttribute("src") !== resolvedSrc) image.src = resolvedSrc;
        if (image.alt !== session.pcbImage.label) image.alt = session.pcbImage.label;
        if (image.draggable) image.draggable = false;
        setStyleIfChanged(
          image,
          "transform",
          `translate(${state.workbench.viewport.panXPx}px, ${state.workbench.viewport.panYPx}px) scale(${state.workbench.viewport.zoom})`
        );
        setStyleIfChanged(image, "transformOrigin", "top left");
        existingPlaceholder?.remove();
        if (existingImage === null) {
          viewport.insertBefore(image, overlayHost ?? viewport.firstChild);
        }
      } else {
        existingLiveFrame?.remove();
        existingImage?.remove();
        if (existingPlaceholder === null) {
          const placeholder = createWorkbenchEmptyState();
          viewport.insertBefore(placeholder, overlayHost ?? viewport.firstChild);
        }
      }
      syncInspectorDom.syncWorkbenchInspector(viewport);
    }

    const cursor = state.workbench.cursor;
    if (cursor !== null) {
      updateCursorHud(cursor);
    } else {
      const hud = panel.querySelector<HTMLElement>(".repair-coord-hud");
      if (hud !== null) {
        syncCoordHudLabels(hud, ["X —", "Y —", "GRID —"]);
      }
    }

    panel.querySelectorAll<HTMLElement>("[data-repair-action='set-tool']").forEach((button) => {
      button.classList.toggle(
        "repair-toolbar__btn--active",
        button.dataset["tool"] === state.workbench.activeTool
      );
    });

    panel
      .querySelectorAll<HTMLElement>("[data-repair-action='toggle-overlay-layer']")
      .forEach((button) => {
        const layerId = button.dataset["layerId"];
        const visible =
          layerId !== undefined &&
          state.workbench.visibleLayers[layerId as keyof typeof state.workbench.visibleLayers];
        button.classList.toggle("repair-toolbar__btn--active", visible === true);
        setDatasetIfChanged(button, "visible", String(visible !== true));
      });
    panel
      .querySelectorAll<HTMLElement>("[data-repair-action='toggle-investigation-mode']")
      .forEach((button) => {
        button.classList.toggle(
          "repair-toolbar__btn--active",
          state.workbench.investigationModeEnabled
        );
      });

    const voice = state.layout.voiceGuidance;
    const interaction = state.layout.interactionSettings;
    const voiceListening = voice.ambientListeningState === "listening";
    const ambientActive = state.operationsAvailable && state.operations.ambientActive;
    const dictationActive =
      state.operationsAvailable &&
      (state.operations.localMicActive || state.operations.androidMicActive) &&
      !state.operations.ambientActive;
    const cameraActive =
      state.operationsAvailable &&
      (state.operations.cameraActive || state.operations.liveFeedActive);
    const ttsActive = state.operationsAvailable && state.operations.ttsActive;
    const handsFreeEnabled = voice.handsBusyMode && (voiceListening || ambientActive);
    const handsFreeButton = panel.querySelector<HTMLElement>("[data-repair-control='hands-free']");
    if (handsFreeButton !== null) {
      handsFreeButton.classList.toggle("repair-guidance-control--active", handsFreeEnabled);
      setTextIfChanged(handsFreeButton, handsFreeEnabled ? "Guiding" : "Guide me");
      const nextTitle = handsFreeEnabled
        ? "Disable hands-free repair guidance"
        : "Enable ambient listening and step-by-step repair guidance";
      if (handsFreeButton.title !== nextTitle) handsFreeButton.title = nextTitle;
      setDatasetIfChanged(handsFreeButton, "repairAction", "set-hands-free-mode");
      setDatasetIfChanged(handsFreeButton, "enabled", String(!handsFreeEnabled));
    }

    const ambientButton = panel.querySelector<HTMLElement>("[data-repair-control='ambient']");
    if (ambientButton !== null) {
      ambientButton.classList.toggle("repair-guidance-control--active", ambientActive);
      setTextIfChanged(ambientButton, ambientActive ? "Listening" : "Listen");
      const nextTitle = ambientActive
        ? "Stop listening for repair commands"
        : "Listen for repair commands";
      if (ambientButton.title !== nextTitle) ambientButton.title = nextTitle;
      setDatasetIfChanged(ambientButton, "repairAction", "toggle-ambient-listener");
      setDatasetIfChanged(ambientButton, "active", String(ambientActive));
    }

    const dictationButton = panel.querySelector<HTMLElement>(
      "[data-repair-control='dictation-route']"
    );
    if (dictationButton !== null) {
      const dictationRoute = getRouteLabel(interaction.dictationRoute);
      setTextIfChanged(dictationButton, dictationActive ? "Recording" : "Speak");
      dictationButton.classList.toggle("repair-guidance-control--active", dictationActive);
      const nextTitle = dictationActive
        ? "Stop voice note recording"
        : `Speak a note or question using the ${dictationRoute} microphone`;
      if (dictationButton.title !== nextTitle) dictationButton.title = nextTitle;
      setDatasetIfChanged(dictationButton, "repairAction", "toggle-dictation");
      setDatasetIfChanged(dictationButton, "active", String(dictationActive));
    }

    const cameraButton = panel.querySelector<HTMLElement>("[data-repair-control='camera-feed']");
    if (cameraButton !== null) {
      cameraButton.classList.toggle("repair-guidance-control--active", cameraActive);
      setTextIfChanged(cameraButton, cameraActive ? "Camera live" : "Camera");
      const nextTitle = cameraActive ? "Stop the camera feed" : "Start the camera feed";
      if (cameraButton.title !== nextTitle) cameraButton.title = nextTitle;
      setDatasetIfChanged(cameraButton, "repairAction", "toggle-camera-feed");
      setDatasetIfChanged(cameraButton, "active", String(cameraActive));
    }

    const cameraChip = panel.querySelector<HTMLElement>("[data-repair-camera-status='true']");
    if (cameraChip !== null) {
      setTextIfChanged(cameraChip, getCameraStatusChipText(state, cameraActive));
      const chipTitle = getCameraStatusChipTitle(state, cameraActive);
      if (cameraChip.title !== chipTitle) cameraChip.title = chipTitle;
      setDatasetIfChanged(cameraChip, "state", getCameraStatusChipState(state, cameraActive));
    }

    const ttsButton = panel.querySelector<HTMLElement>("[data-repair-control='tts-route']");
    if (ttsButton !== null) {
      ttsButton.classList.toggle("repair-guidance-control--active", ttsActive);
      const ttsRoute = getRouteLabel(interaction.ttsRoute);
      setTextIfChanged(ttsButton, ttsActive ? "Reading" : "Read");
      const nextTitle = ttsActive
        ? "Stop spoken guidance"
        : `Read current guidance aloud on ${ttsRoute}`;
      if (ttsButton.title !== nextTitle) ttsButton.title = nextTitle;
      setDatasetIfChanged(ttsButton, "repairAction", "toggle-tts");
      setDatasetIfChanged(ttsButton, "active", String(ttsActive));
    }

    const budgetButton = panel.querySelector<HTMLElement>(
      "[data-repair-action='set-attention-budget']"
    );
    if (budgetButton !== null) {
      const currentMax = state.guidance.aiInterruption.attentionBudget.maxAiInterruptions;
      const nextMax = currentMax >= 3 ? 1 : currentMax + 1;
      setTextIfChanged(budgetButton, getAssistanceProfileLabel(currentMax));
      budgetButton.title = `Cycle assistance profile (${state.guidance.aiInterruption.attentionBudget.remainingAiInterruptions}/${currentMax} interruptions left)`;
      setDatasetIfChanged(budgetButton, "maxAiInterruptions", String(nextMax));
      setDatasetIfChanged(
        budgetButton,
        "windowMs",
        String(state.guidance.aiInterruption.attentionBudget.windowMs)
      );
    }

    const operatorOverlayButton = panel.querySelector<HTMLElement>(
      "[data-repair-action='set-settings-overlay'][data-tab-id='bench-operator']"
    );
    if (operatorOverlayButton !== null) {
      operatorOverlayButton.classList.toggle(
        "repair-profile-toggle__btn--active",
        state.layout.settingsOverlayOpen && state.layout.settingsOverlayTabId === "bench-operator"
      );
      setDatasetIfChanged(operatorOverlayButton, "open", "true");
      setDatasetIfChanged(operatorOverlayButton, "tabId", "bench-operator");
    }

    const settingsOverlayButton = panel.querySelector<HTMLElement>(
      "[data-repair-action='set-settings-overlay'][data-tab-id='repair-controls']"
    );
    if (settingsOverlayButton !== null) {
      settingsOverlayButton.classList.toggle(
        "repair-guidance-control--active",
        state.layout.settingsOverlayOpen && state.layout.settingsOverlayTabId === "repair-controls"
      );
      setDatasetIfChanged(settingsOverlayButton, "open", "true");
      setDatasetIfChanged(settingsOverlayButton, "tabId", "repair-controls");
    }
  }

  function replacePanelElement(current: HTMLElement, next: HTMLElement): HTMLElement {
    const bodyScrollTop = current.querySelector<HTMLElement>(".repair-panel__body")?.scrollTop ?? 0;
    const timelineScrollLeft =
      current.querySelector<HTMLElement>(".repair-timeline__scroller")?.scrollLeft ?? 0;
    const feedScrollTop = current.querySelector<HTMLElement>(".repair-feed-list")?.scrollTop ?? 0;
    current.replaceWith(next);
    const nextBody = next.querySelector<HTMLElement>(".repair-panel__body");
    if (nextBody !== null) nextBody.scrollTop = bodyScrollTop;
    const nextTimeline = next.querySelector<HTMLElement>(".repair-timeline__scroller");
    if (nextTimeline !== null) nextTimeline.scrollLeft = timelineScrollLeft;
    const nextFeed = next.querySelector<HTMLElement>(".repair-feed-list");
    if (nextFeed !== null) nextFeed.scrollTop = feedScrollTop;
    return next;
  }

  function createPanelLifecycle(
    panelId: RepairPanelId,
    renderer: RepairPanelRenderer
  ): RepairPanelLifecycle {
    return {
      panelId,
      signature: buildPanelSignature(panelId),
      mount: (parent) => {
        const element = renderer();
        parent.append(element);
        return element;
      },
      update: (element) => {
        if (panelId === "workbench-stage") {
          updateWorkbenchPanelDom(element);
          return element;
        }
        if (panelId === "visual-timeline") {
          visualTimelineDom.updateVisualTimelinePanelDom(element);
          return element;
        }
        if (panelId === "tactical-feed") {
          tacticalFeedDom.updateTacticalFeedPanelDom(element);
          return element;
        }
        if (panelId === "measurement") {
          measurementDom.updateMeasurementPanelDom(element);
          return element;
        }
        if (panelId === "room-sync") {
          syncInspectorDom.updateRoomSyncPanelDom(element);
          return element;
        }
        return replacePanelElement(element, renderer());
      },
      dispose: (element) => {
        element.remove();
      },
    };
  }

  function syncPanel(
    persistentShell: RepairPersistentShell,
    parent: HTMLElement,
    lifecycle: RepairPanelLifecycle
  ): void {
    const current = persistentShell.panelElements.get(lifecycle.panelId);
    if (current === undefined) {
      const mounted = lifecycle.mount(parent);
      applyPanelGuidanceChrome(mounted, lifecycle.panelId);
      persistentShell.panelElements.set(lifecycle.panelId, mounted);
      persistentShell.panelSignatures.set(lifecycle.panelId, lifecycle.signature);
      return;
    }

    const previousSignature = persistentShell.panelSignatures.get(lifecycle.panelId);
    if (previousSignature === lifecycle.signature) {
      if (
        lifecycle.panelId === "workbench-stage" ||
        lifecycle.panelId === "tactical-feed" ||
        lifecycle.panelId === "measurement" ||
        lifecycle.panelId === "room-sync"
      ) {
        lifecycle.update(current);
      }
      applyPanelGuidanceChrome(current, lifecycle.panelId);
      return;
    }

    const updated = lifecycle.update(current);
    applyPanelGuidanceChrome(updated, lifecycle.panelId);
    persistentShell.panelElements.set(lifecycle.panelId, updated);
    persistentShell.panelSignatures.set(lifecycle.panelId, lifecycle.signature);
  }

  function createLegendBar(): HTMLElement {
    const legendBar = documentRef.createElement("div");
    legendBar.className = "repair-legendbar";

    const legends: Array<[string, string]> = [
      ["Snapshot", "var(--repair-cyan)"],
      ["Assistant mark", "var(--repair-amber)"],
      ["Reading", "var(--repair-text)"],
      ["Note", "var(--repair-info)"],
      ["Risk", "var(--repair-risk)"],
    ];

    for (const [lbl, color] of legends) {
      const item = documentRef.createElement("span");
      item.className = "repair-legend-item";

      const swatch = documentRef.createElement("span");
      swatch.className = "repair-legend-swatch";
      swatch.style.background = color;
      item.append(swatch);

      const ltxt = documentRef.createElement("span");
      ltxt.textContent = lbl;
      item.append(ltxt);

      legendBar.append(item);
    }

    return legendBar;
  }

  function getSettingsOverlayTitle(_tabId: RepairSettingsOverlayTabId): string {
    return text(["settings", "operatorOverlayTitle"], "setup");
  }

  function createSettingsOverlayShell(): { overlay: HTMLElement; body: HTMLElement } {
    const overlay = documentRef.createElement("div");
    overlay.className = "repair-settings-overlay";
    overlay.hidden = true;
    overlay.dataset["settingsOverlay"] = "closed";

    const backdrop = documentRef.createElement("button");
    backdrop.type = "button";
    backdrop.className = "repair-settings-overlay__backdrop";
    backdrop.title = "Close settings";
    backdrop.dataset["repairAction"] = "set-settings-overlay";
    backdrop.dataset["open"] = "false";

    const dialog = documentRef.createElement("section");
    dialog.className = "repair-settings-overlay__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const header = documentRef.createElement("header");
    header.className = "repair-settings-overlay__header";

    const title = documentRef.createElement("h2");
    title.className = "repair-settings-overlay__title";
    title.dataset["settingsOverlayTitle"] = "true";
    title.textContent = getSettingsOverlayTitle(state.layout.settingsOverlayTabId);
    header.append(title);

    const body = documentRef.createElement("div");
    body.className = "repair-settings-overlay__body";
    const content = documentRef.createElement("div");
    content.className = "repair-settings-overlay__content";
    body.append(content);

    const close = documentRef.createElement("button");
    close.type = "button";
    close.className = "repair-settings-overlay__close";
    close.title = "Close settings";
    close.textContent = "CLOSE";
    close.dataset["repairAction"] = "set-settings-overlay";
    close.dataset["open"] = "false";
    header.append(close);

    dialog.append(header, body);
    overlay.append(backdrop, dialog);
    return { overlay, body };
  }

  function syncSettingsOverlay(overlay: HTMLElement, body: HTMLElement): void {
    const open = state.layout.settingsOverlayOpen;
    const tabId = state.layout.settingsOverlayTabId;
    if (overlay.hidden === open) overlay.hidden = !open;
    setDatasetIfChanged(overlay, "settingsOverlay", open ? "open" : "closed");
    setDatasetIfChanged(overlay, "tabId", tabId);

    const title = overlay.querySelector<HTMLElement>("[data-settings-overlay-title='true']");
    if (title !== null) setTextIfChanged(title, getSettingsOverlayTitle(tabId));

    overlay.querySelectorAll<HTMLElement>(".repair-settings-overlay__tab").forEach((tab) => {
      const active = tab.dataset["tabId"] === tabId;
      tab.classList.toggle("repair-settings-overlay__tab--active", active);
    });

    if (!open) {
      const content = body.querySelector<HTMLElement>(".repair-settings-overlay__content");
      if (content !== null && content.children.length > 0) content.replaceChildren();
      shell?.panelSignatures.delete("operator-profile");
      shell?.panelElements.delete("operator-profile");
      if (shell !== null) shell.settingsOverlaySignature = "";
      return;
    }

    const panelId: RepairPanelId = "operator-profile";
    const signature = `${tabId}:${buildPanelSignature(panelId)}`;
    const content = body.querySelector<HTMLElement>(".repair-settings-overlay__content");
    if (content === null) return;

    if (shell?.settingsOverlaySignature === signature && content.children.length > 0) {
      const current = content.firstElementChild;
      if (current instanceof HTMLElement) applyPanelGuidanceChrome(current, panelId);
      return;
    }

    const panel = renderOperatorProfilePanel(documentRef, state, text);
    applyPanelGuidanceChrome(panel, panelId);
    content.replaceChildren(panel);
    if (shell !== null) shell.settingsOverlaySignature = signature;
  }

  function flushWizardFields(root: HTMLElement): void {
    root
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("[data-repair-action='wizard-field']")
      .forEach((fieldElement) => {
        const field = fieldElement.dataset["wizardField"];
        if (field === undefined || field.trim() === "") return;
        requestRuntime.updateSession({ wizardField: field, value: fieldElement.value });
      });
  }

  function ensurePersistentShell(mount: HTMLElement): RepairPersistentShell {
    if (shell !== null && mount.contains(shell.root)) return shell;

    const root = documentRef.createElement("div");
    root.className = "repair-shell";

    const statusBar = documentRef.createElement("div");
    statusBar.className = "repair-statusbar";

    const label = documentRef.createElement("span");
    label.className = "repair-statusbar__label";
    label.textContent = "Repair Room v0.1.0";

    const setupButton = documentRef.createElement("button");
    setupButton.className = "repair-statusbar__setup";
    setupButton.type = "button";
    setupButton.textContent = "Setup";
    setupButton.title = "Open bench setup";
    setupButton.dataset["repairAction"] = "set-settings-overlay";
    setupButton.dataset["open"] = "true";
    setupButton.dataset["tabId"] = "bench-operator";
    label.append(setupButton);
    statusBar.append(label);

    const statusActions = documentRef.createElement("div");
    statusActions.className = "repair-statusbar__actions";

    const closeButton = documentRef.createElement("button");
    closeButton.className = "repair-statusbar__close";
    closeButton.type = "button";
    closeButton.dataset["repairAction"] = "room-close";
    closeButton.title = "Return to home";
    closeButton.setAttribute("aria-label", "Return to home");
    closeButton.textContent = "×";

    const clock = documentRef.createElement("span");
    clock.className = "repair-statusbar__clock";
    clock.textContent = "--:--:--";
    statusActions.append(closeButton, clock);
    statusBar.append(statusActions);
    root.append(statusBar);

    const workspace = documentRef.createElement("div");
    workspace.className = "repair-workspace";
    const rightStack = documentRef.createElement("div");
    rightStack.className = "repair-panel--wizard-pack-stack";
    const dock = documentRef.createElement("div");
    dock.className = "repair-bottom-dock";
    const settingsOverlayShell = createSettingsOverlayShell();
    root.append(workspace, createLegendBar(), settingsOverlayShell.overlay);

    shell = {
      root,
      clock,
      workspace,
      rightStack,
      dock,
      settingsOverlay: settingsOverlayShell.overlay,
      settingsOverlayBody: settingsOverlayShell.body,
      settingsOverlaySignature: "",
      panelElements: new Map(),
      panelSignatures: new Map(),
    };
    mount.replaceChildren(root);
    bindActions(root);
    return shell;
  }

  // -- Render
  function render(): void {
    const mount = documentRef.getElementById("app");
    if (mount === null) return;
    const persistentShell = ensurePersistentShell(mount);
    const primarySurfaceClass = state.guidance.panelVisibility.primarySurface.replace(
      /[^a-z-]/g,
      "-"
    );
    const rhythmPhaseClass = state.guidance.rhythm.progressLabel.replace(/[^a-z0-9]+/g, "-");
    setClassNameIfChanged(
      persistentShell.root,
      `repair-shell repair-shell--profile-${state.guidance.operationalProfile} repair-shell--calm-${primarySurfaceClass}${
        state.guidance.focusCorridor.active ? " repair-shell--corridor-active" : ""
      } repair-shell--rhythm-${rhythmPhaseClass}${
        state.layout.focusMode ? " repair-shell--focus-mode" : ""
      }`
    );
    setTextIfChanged(
      persistentShell.clock,
      state.ambient.nowIso
        ? new Date(state.ambient.nowIso).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : "--:--:--"
    );

    syncPanel(
      persistentShell,
      persistentShell.workspace,
      createPanelLifecycle("session-rail", () => renderSessionRailPanel(documentRef, state, text))
    );
    syncPanel(
      persistentShell,
      persistentShell.workspace,
      createPanelLifecycle("workbench-stage", () =>
        renderWorkbenchStagePanel(documentRef, state, text)
      )
    );
    syncPanel(
      persistentShell,
      persistentShell.workspace,
      createPanelLifecycle("tactical-feed", () => renderTacticalFeedPanel(documentRef, state, text))
    );

    if (!persistentShell.workspace.contains(persistentShell.rightStack)) {
      persistentShell.workspace.append(persistentShell.rightStack);
    }
    syncPanel(
      persistentShell,
      persistentShell.rightStack,
      createPanelLifecycle("knowledge-pack", () =>
        renderKnowledgePackPanel(documentRef, state, text)
      )
    );

    syncPanel(
      persistentShell,
      persistentShell.workspace,
      createPanelLifecycle("visual-timeline", () =>
        renderVisualTimelinePanel(documentRef, state, meta, text)
      )
    );

    syncDockLayout(persistentShell.dock);
    if (!persistentShell.workspace.contains(persistentShell.dock)) {
      persistentShell.workspace.append(persistentShell.dock);
    }
    syncPanel(
      persistentShell,
      persistentShell.dock,
      createPanelLifecycle("chat", () => renderChatPanel(documentRef, state, text))
    );
    syncPanel(
      persistentShell,
      persistentShell.dock,
      createPanelLifecycle("measurement", () => renderMeasurementPanel(documentRef, state, text))
    );
    syncPanel(
      persistentShell,
      persistentShell.dock,
      createPanelLifecycle("room-sync", () => renderRoomSyncPanel(documentRef, state, meta, text))
    );

    syncSettingsOverlay(persistentShell.settingsOverlay, persistentShell.settingsOverlayBody);
    applyLiveSnapshotUpdates();
    void overlayRuntime.syncOverlay(persistentShell.root);
  }

  // -- Action binding
  function bindActions(root: HTMLElement): void {
    if (root.dataset["actionsBound"] === "true") return;
    root.dataset["actionsBound"] = "true";

    function findActionElement(target: EventTarget | null): HTMLElement | null {
      return target instanceof Element ? target.closest<HTMLElement>("[data-repair-action]") : null;
    }

    root.addEventListener("click", (event) => {
      const el = findActionElement(event.target);
      if (el === null) return;
      const action = el.dataset["repairAction"];
      if (action === undefined) return;
      if (
        [
          "activate-session",
          "set-tool",
          "jump-to-event",
          "knowledge-spatial-focus",
          "knowledge-spatial-promote",
          "timeline-zoom",
          "timeline-range",
          "timeline-play",
          "timeline-pause",
          "timeline-live",
          "timeline-speed",
        ].includes(action)
      ) {
        cancelSpatialFocusTween();
      }
      switch (action) {
        case "room-close":
          windowRef.roomAPI?.close?.();
          break;
        case "activate-session": {
          const sessionId = el.dataset["sessionId"];
          if (sessionId) requestRuntime.activateSession({ sessionId });
          break;
        }
        case "delete-session": {
          const sessionId = el.dataset["sessionId"];
          if (!sessionId) break;
          const sessionTitle = el.dataset["sessionTitle"] ?? "this session";
          const confirmed = window.confirm(
            `Delete saved repair session "${sessionTitle}" and all stored data?`
          );
          if (confirmed) requestRuntime.deleteSession({ sessionId });
          break;
        }
        case "set-tool": {
          const tool = el.dataset["tool"];
          if (tool) requestRuntime.setActiveTool({ tool });
          break;
        }
        case "set-operational-profile": {
          const profile = el.dataset["profile"];
          if (profile === "novice" || profile === "advanced") {
            requestRuntime.setOperationalProfile({ profile });
          }
          break;
        }
        case "set-voice-guidance": {
          const ambientListeningState = el.dataset["ambientListeningState"];
          const spokenGuidanceMode = el.dataset["spokenGuidanceMode"];
          const handsBusyMode = el.dataset["handsBusyMode"];
          requestRuntime.setVoiceGuidance({
            ...(ambientListeningState === "idle" ||
            ambientListeningState === "listening" ||
            ambientListeningState === "muted"
              ? { ambientListeningState }
              : {}),
            ...(spokenGuidanceMode === "silent" ||
            spokenGuidanceMode === "brief" ||
            spokenGuidanceMode === "step-by-step"
              ? { spokenGuidanceMode }
              : {}),
            ...(handsBusyMode === undefined ? {} : { handsBusyMode: handsBusyMode === "true" }),
          });
          break;
        }
        case "set-hands-free-mode": {
          const enabled = el.dataset["enabled"] === "true";
          requestRuntime.setVoiceGuidance({
            handsBusyMode: enabled,
            ambientListeningState: enabled ? "listening" : "idle",
            spokenGuidanceMode: enabled
              ? "step-by-step"
              : state.layout.voiceGuidance.spokenGuidanceMode,
          });
          if (enabled) {
            requestRuntime.startAmbientListener();
          } else {
            requestRuntime.stopAmbientListener();
          }
          break;
        }
        case "toggle-ambient-listener": {
          const active = el.dataset["active"] === "true";
          requestRuntime.setVoiceGuidance({
            ambientListeningState: active ? "idle" : "listening",
            spokenGuidanceMode: state.layout.voiceGuidance.spokenGuidanceMode,
            handsBusyMode: state.layout.voiceGuidance.handsBusyMode,
          });
          if (active) {
            requestRuntime.stopAmbientListener();
          } else {
            requestRuntime.startAmbientListener();
          }
          break;
        }
        case "toggle-dictation": {
          if (el.dataset["active"] === "true") {
            requestRuntime.stopDictation();
          } else {
            requestRuntime.startDictation();
          }
          break;
        }
        case "toggle-camera-feed": {
          if (el.dataset["active"] === "true") {
            requestRuntime.stopCameraFeed();
          } else {
            requestRuntime.setInteractionSettings({ cameraFeedPreference: "android-feed" });
            requestRuntime.startCameraFeed();
          }
          break;
        }
        case "toggle-tts": {
          if (el.dataset["active"] === "true") {
            requestRuntime.stopSpeech();
          } else {
            requestRuntime.speakGuidance();
          }
          break;
        }
        case "set-interaction-settings": {
          const dictationRoute = el.dataset["dictationRoute"];
          const ttsRoute = el.dataset["ttsRoute"];
          const cameraFeedPreference = el.dataset["cameraFeedPreference"];
          const dictationSubmitMode = el.dataset["dictationSubmitMode"];
          const androidCompanionEnabled = el.dataset["androidCompanionEnabled"];
          const autoReadAiReplies = el.dataset["autoReadAiReplies"];
          requestRuntime.setInteractionSettings({
            ...(androidCompanionEnabled === undefined
              ? {}
              : { androidCompanionEnabled: androidCompanionEnabled === "true" }),
            ...(dictationRoute === "local" || dictationRoute === "android"
              ? { dictationRoute }
              : {}),
            ...(ttsRoute === "local" || ttsRoute === "android" ? { ttsRoute } : {}),
            ...(cameraFeedPreference === "manual" || cameraFeedPreference === "android-feed"
              ? { cameraFeedPreference }
              : {}),
            ...(dictationSubmitMode === "composer" || dictationSubmitMode === "send"
              ? { dictationSubmitMode }
              : {}),
            ...(autoReadAiReplies === undefined
              ? {}
              : { autoReadAiReplies: autoReadAiReplies === "true" }),
          });
          break;
        }
        case "set-settings-overlay": {
          const open = el.dataset["open"];
          const tabId = el.dataset["tabId"];
          requestRuntime.setSettingsOverlay({
            ...(open === undefined ? {} : { open: open === "true" }),
            ...(tabId === "repair-controls" || tabId === "bench-operator" ? { tabId } : {}),
          });
          break;
        }
        case "set-attention-budget": {
          const maxAiInterruptions = Number(el.dataset["maxAiInterruptions"]);
          const windowMs = Number(el.dataset["windowMs"]);
          requestRuntime.setAttentionBudget({
            ...(Number.isFinite(maxAiInterruptions) ? { maxAiInterruptions } : {}),
            ...(Number.isFinite(windowMs) ? { windowMs } : {}),
          });
          break;
        }
        case "toggle-overlay-layer": {
          const layerId = el.dataset["layerId"];
          const visible = el.dataset["visible"] === "true";
          if (layerId) requestRuntime.toggleOverlayLayer({ layerId, visible });
          break;
        }
        case "toggle-investigation-mode":
          requestRuntime.toggleInvestigationMode({
            enabled: !state.workbench.investigationModeEnabled,
          });
          break;
        case "jump-to-event": {
          const eventId = el.dataset["eventId"];
          if (eventId) requestRuntime.jumpToEvent({ eventId });
          break;
        }
        case "attach-knowledge-pack": {
          const packId = el.dataset["packId"];
          if (packId) requestRuntime.attachKnowledgePack({ packId });
          break;
        }
        case "knowledge-pack-tab": {
          const previewTabId = el.dataset["tabId"];
          if (previewTabId) requestRuntime.updatePanelTab({ previewTabId });
          break;
        }
        case "knowledge-spatial-focus": {
          const spatialRefId = el.dataset["spatialRefId"];
          if (spatialRefId) requestRuntime.focusKnowledgeSpatialRef({ spatialRefId });
          break;
        }
        case "knowledge-spatial-promote": {
          const spatialRefId = el.dataset["spatialRefId"];
          if (spatialRefId) requestRuntime.promoteKnowledgeRegion({ spatialRefId });
          break;
        }
        case "ai-mark-state": {
          const eventId = el.dataset["eventId"];
          const aiState = el.dataset["aiState"];
          if (eventId && aiState) {
            requestRuntime.dismissAiMark({
              eventId,
              state: aiState,
              reason: `Repair observation marked ${aiState}.`,
            });
          }
          break;
        }
        case "set-instrument": {
          const instrumentKind = el.dataset["instrumentKind"];
          if (instrumentKind) requestRuntime.updatePanelTab({ instrumentKind });
          break;
        }
        case "operator-profile-tab": {
          const operatorProfileTabId = el.dataset["tabId"];
          if (operatorProfileTabId) requestRuntime.updatePanelTab({ operatorProfileTabId });
          break;
        }
        case "operator-profile-update": {
          const profileKind = el.dataset["profileKind"];
          if (profileKind === "tool") {
            const id = el.dataset["toolId"];
            if (id) {
              requestRuntime.updateOperatorProfile({
                tools: [{ id, available: el.dataset["available"] === "true" }],
              });
            }
          }
          if (profileKind === "preference") {
            const key = el.dataset["preferenceKey"];
            const rawValue = el.dataset["preferenceValue"];
            if (key && rawValue !== undefined) {
              requestRuntime.updateOperatorProfile({
                preferences: {
                  [key]: key === "annotationDefaultStrokeWidth" ? Number(rawValue) : rawValue,
                },
              });
            }
          }
          break;
        }
        case "toggle-panel-collapse": {
          const panelId = el.dataset["panelId"];
          const collapsed = el.dataset["collapsed"] === "true";
          if (panelId) requestRuntime.updatePanelLayout({ panelId, collapsed });
          break;
        }
        case "toggle-say-column": {
          // Pure DOM toggle — no state round-trip needed
          const strip = root.querySelector<HTMLElement>(".repair-guidance-strip");
          if (strip) {
            const current = strip.dataset["showSay"] === "true";
            strip.dataset["showSay"] = String(!current);
            el.classList.toggle("repair-guidance-control--active", !current);
          }
          break;
        }
        case "send-chat": {
          const input = root.querySelector<HTMLInputElement>("[data-repair-input='chat-composer']");
          if (input && input.value.trim() !== "") {
            requestRuntime.sendChatTurn({ text: input.value.trim() });
            requestRuntime.setChatComposer({ draft: "" });
            input.value = "";
          }
          break;
        }
        case "clear-chat-composer": {
          dictationComposer.setChatComposerDraft("");
          break;
        }
        case "send-feed-question": {
          const input = root.querySelector<HTMLInputElement>("[data-repair-input='feed-composer']");
          if (input && input.value.trim() !== "") {
            requestRuntime.sendChatTurn({ text: input.value.trim() });
            input.value = "";
          }
          break;
        }
        case "wizard-symptom": {
          const symptom = el.dataset["symptom"];
          if (!symptom) return;
          el.classList.toggle(
            "repair-skill-chip--active",
            !el.classList.contains("repair-skill-chip--active")
          );
          const current = new Set(state.wizard.draft.primarySymptoms);
          if (current.has(symptom)) {
            current.delete(symptom);
          } else {
            current.add(symptom);
          }
          requestRuntime.updateSession({
            wizardField: "primarySymptoms",
            value: Array.from(current),
          });
          break;
        }
        case "start-wizard-research": {
          flushWizardFields(root);
          requestRuntime.startKnowledgeResearch();
          break;
        }
        case "advance-wizard": {
          flushWizardFields(root);
          const step = el.dataset["step"];
          requestRuntime.advanceWizard(step ? { step } : undefined);
          break;
        }
        case "create-session":
          flushWizardFields(root);
          requestRuntime.createSession();
          break;
        case "timeline-zoom": {
          const direction = el.dataset["direction"] === "out" ? -1 : 1;
          requestRuntime.updateTimeline({
            timelineZoom: Math.min(
              4,
              Math.max(0.25, state.workbench.timeline.zoom + direction * 0.25)
            ),
          });
          break;
        }
        case "timeline-range": {
          const playhead = state.workbench.timeline.playheadMs;
          requestRuntime.updateTimeline({
            timelineRangeStartMs: Math.max(0, playhead - 15000),
            timelineRangeEndMs: playhead + 15000,
          });
          break;
        }
        case "timeline-play":
          requestRuntime.updateTimeline({ replayAction: "play" });
          break;
        case "timeline-pause":
          requestRuntime.updateTimeline({ replayAction: "pause" });
          break;
        case "timeline-live":
          requestRuntime.focusLiveEdge();
          break;
        case "timeline-speed": {
          const nextSpeed =
            state.workbench.timeline.replaySpeed >= 4
              ? 0.5
              : state.workbench.timeline.replaySpeed * 2;
          requestRuntime.updateTimeline({ replaySpeed: nextSpeed });
          break;
        }
      }
    });

    root.addEventListener("input", (event) => {
      const el = findActionElement(event.target);
      if (el === null) return;
      if (el.dataset["repairAction"] === "timeline-scrub" && el instanceof HTMLInputElement) {
        cancelSpatialFocusTween();
        requestRuntime.scrubTimeline({ positionMs: Number(el.value) });
      }
      if (
        el.dataset["repairAction"] === "wizard-field" &&
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      ) {
        const field = el.dataset["wizardField"];
        if (field) requestRuntime.updateSession({ wizardField: field, value: el.value });
      }
    });

    root.addEventListener("change", (event) => {
      const el = findActionElement(event.target);
      if (
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        )
      ) {
        return;
      }
      if (el.dataset["repairAction"] === "wizard-field") {
        const field = el.dataset["wizardField"];
        if (field) requestRuntime.updateSession({ wizardField: field, value: el.value });
      }
      if (el.dataset["repairAction"] === "set-ai-target-slot") {
        if (el.value === "ai1" || el.value === "ai2") {
          state.aiDispatch.chat.targetSlot = el.value;
          state.aiDispatch.research.targetSlot = el.value;
          state.aiDispatch.tactical.targetSlot = el.value;
          requestRuntime.setAiTargetSlot({ targetSlot: el.value });
        }
      }
    });
  }

  function getWorkbenchViewportMode(): string {
    if (
      state.workbench.investigationModeEnabled ||
      state.workbench.operationalMode === "investigation"
    ) {
      return "investigation";
    }
    if (state.workbench.isFrozen || state.workbench.operationalMode === "freeze") return "freeze";
    if (
      state.workbench.timeline.replayMode === "replay" ||
      state.workbench.operationalMode === "replay"
    ) {
      return "replay";
    }
    return "live";
  }

  // -- Host message handler
  function handleHostMessage(message: unknown): void {
    const msg = normalizeRepairHostMessage(message);
    if (msg === null) return;

    switch (msg.type) {
      case "host-context": {
        context.locale = msg.locale;
        context.translations = msg.translations;
        documentRef.documentElement.lang = context.locale;
        render();
        break;
      }
      case "repair-state": {
        const nextMeta: RepairUiSnapshotMeta = msg.meta;
        Object.assign(state, msg.snapshot);
        meta.schemaVersion = nextMeta.schemaVersion;
        meta.generatedAt = nextMeta.generatedAt;
        meta.events = nextMeta.events;
        meta.replay = nextMeta.replay;
        render();
        syncSpatialFocusTween();
        applyLiveSnapshotUpdates();
        break;
      }
      case "repair-feed-event": {
        if (meta.events.some((event) => event.id === msg.event.id) === false) {
          meta.events = [...meta.events, msg.event];
        }
        const session = state.sessions.detail;
        if (
          session !== null &&
          session.events.some((event) => event.id === msg.event.id) === false
        ) {
          session.events = [...session.events, msg.event];
        }
        state.tacticalFeed.push({
          eventId: msg.event.id,
          occurredAt: msg.event.occurredAt,
          relativeLabel: "",
          severity: msg.event.severity,
          badge: msg.event.severity.toUpperCase(),
          body: msg.event.rationale,
        });
        render();
        break;
      }
      case "repair-chat-reply": {
        state.chat.turns.push({
          id: msg.turnId,
          role: "ai",
          text: msg.text,
          occurredAt: msg.occurredAt,
          contextRefs: msg.contextRefs,
        });
        state.chat.pendingReplyId = null;
        render();
        break;
      }
      case "repair-measurement-reading": {
        state.measurement.recent = [
          {
            id: msg.reading.id,
            occurredAt: msg.reading.occurredAt,
            mode: "dc-voltage" as const,
            range: msg.reading.range,
            channel: msg.reading.channel,
            rawDisplay: msg.reading.rawDisplay,
            value: msg.reading.value,
            unit: msg.reading.unit,
            reference: msg.reading.reference,
          },
          ...state.measurement.recent,
        ].slice(0, 32);
        state.measurement.current.display = msg.reading.rawDisplay;
        state.measurement.current.value = msg.reading.value;
        state.measurement.current.unit = msg.reading.unit;
        render();
        break;
      }
      case "repair-research-progress": {
        state.wizard.researchProgress = state.wizard.researchProgress.map((item) =>
          item.step === msg.step ? { ...item, completed: msg.completed } : item
        );
        render();
        break;
      }
      case "capture-feed-status": {
        captureStatusHandlers.handleCaptureFeedStatus(msg);
        break;
      }

      case "capture-dictation-status": {
        captureStatusHandlers.handleCaptureDictationStatus(msg);
        break;
      }

      case "capture-ambient-status": {
        captureStatusHandlers.handleCaptureAmbientStatus(msg);
        break;
      }

      case "tts-status": {
        captureStatusHandlers.handleTtsStatus(msg);
        break;
      }

      case "capture-media-ingress": {
        captureStatusHandlers.handleCaptureMediaIngress(msg);
        break;
      }

      case "command-result": {
        render();
        break;
      }

      case "transcript-ingress": {
        dictationComposer.handleTranscriptIngress(msg);
        break;
      }
    }
  }

  // -- Ambient clock tick
  function startClock(): void {
    if (clockInterval !== null) return;
    clockInterval = setInterval(() => {
      state.ambient.nowIso = new Date().toISOString();
      const clock = documentRef.querySelector<HTMLElement>(".repair-statusbar__clock");
      if (clock !== null) {
        setTextIfChanged(
          clock,
          new Date(state.ambient.nowIso).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      }
    }, 1000);
  }

  // -- Start
  function start(): void {
    if (windowRef.roomAPI && typeof windowRef.roomAPI.onHostMessage === "function") {
      windowRef.roomAPI.onHostMessage(handleHostMessage);
    }

    documentRef.documentElement.lang = context.locale;
    documentRef.addEventListener("keydown", keyboardController.handleKeydown);
    startClock();
    render();
    requestRuntime.notifyUiReady();

    if (windowRef.roomAPI && typeof windowRef.roomAPI.ready === "function") {
      windowRef.roomAPI.ready({
        room: REPAIR_ROOM_ID,
        feature: "repair-workbench",
        stage: "ui-ready",
      });
    }
  }

  return { start };
}
