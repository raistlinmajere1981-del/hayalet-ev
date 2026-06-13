import type {
  RepairEvent,
  RepairImageRect,
  RepairPanelId,
  RepairSettingsOverlayTabId,
  RepairWorkbenchViewport,
} from "../shared/types/index.js";
import type {
  RepairGuidanceProjection,
  RepairUiState,
  RepairUiSnapshotMeta,
} from "../shared/ui/state.js";
import {
  createRepairDefaultAiDispatchState,
  createRepairDefaultContinuityProjection,
  createRepairDefaultGuidanceProjection,
  createRepairDefaultOperationsProjection,
  createRepairDefaultStorageState,
  createRepairDefaultVoiceReadinessProjection,
} from "../shared/ui/state.js";
import { normalizeRepairHostMessage } from "../shared/ui/host-messages.js";
import { REPAIR_ROOM_ID, REPAIR_UI_COLORS } from "../shared/repair-constants.js";
import { createRepairUiRequestRuntime } from "../shared/ui/request-runtime.js";

import { renderSessionRailPanel } from "./panels/session-rail-panel.js";
import { renderWorkbenchStagePanel } from "./panels/workbench-stage-panel.js";
import {
  formatRepairTacticalFeedStatusLine,
  renderTacticalFeedPanel,
} from "./panels/tactical-feed-panel.js";
import { renderSessionWizardPanel } from "./panels/session-wizard-panel.js";
import { renderKnowledgePackPanel } from "./panels/knowledge-pack-panel.js";
import { renderVisualTimelinePanel } from "./panels/visual-timeline-panel.js";
import { renderOperatorProfilePanel } from "./panels/operator-profile-panel.js";
import { renderRepairSettingsPanel } from "./panels/repair-settings-panel.js";
import { renderChatPanel } from "./panels/chat-panel.js";
import { renderMeasurementPanel } from "./panels/measurement-panel.js";
import { getRepairRoomSyncRows, renderRoomSyncPanel } from "./panels/room-sync-panel.js";
import { mountRepairOverlayStage, type RepairOverlayController } from "./overlay/overlay-stage.js";
import { getContainedImageFrame } from "./overlay/overlay-coords.js";
import { getRepairFocusFrame } from "./overlay/overlay-geometry.js";
import { resolveRepairAssetUrl } from "./repair-asset-url.js";

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
type RepairMutableStyleProperty =
  | "gridTemplateColumns"
  | "left"
  | "width"
  | "transform"
  | "transformOrigin";

interface RepairSpatialFocusTween {
  cancel: () => void;
}

const AI_LIFECYCLE_ACTIONS = [
  ["acknowledged", "ACK"],
  ["investigating", "INV"],
  ["resolved", "RES"],
  ["dismissed", "DIS"],
] as const;

const REPAIR_SETTINGS_OVERLAY_TABS: Array<{ id: RepairSettingsOverlayTabId; label: string }> = [
  { id: "repair-controls", label: "Repair Controls" },
  { id: "bench-operator", label: "Bench Operator" },
];

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

export const REPAIR_DOCK_PANEL_IDS = [
  "measurement",
  "chat",
  "room-sync",
] as const satisfies readonly RepairPanelId[];

export interface RepairDockLayoutProjection {
  visiblePanelIds: RepairPanelId[];
  gridTemplateColumns: string;
}

export function getRepairVisibleDockPanelIds(
  panels: RepairGuidanceProjection["panelVisibility"]["panels"],
  dockPanelIds: readonly RepairPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairPanelId[] {
  return dockPanelIds.filter((panelId) => panels[panelId] !== "hidden");
}

export function getRepairDockGridTemplateColumns(visiblePanelCount: number): string {
  const normalizedCount =
    Number.isFinite(visiblePanelCount) && visiblePanelCount > 0 ? Math.floor(visiblePanelCount) : 0;
  if (normalizedCount === 0) return "none";
  return Array.from({ length: normalizedCount }, () => "1fr").join(" ");
}

export function getRepairDockLayoutProjection(
  panels: RepairGuidanceProjection["panelVisibility"]["panels"],
  dockPanelIds: readonly RepairPanelId[] = REPAIR_DOCK_PANEL_IDS
): RepairDockLayoutProjection {
  const visiblePanelIds = getRepairVisibleDockPanelIds(panels, dockPanelIds);
  return {
    visiblePanelIds,
    gridTemplateColumns: getRepairDockGridTemplateColumns(visiblePanelIds.length),
  };
}

function easeOutPower2(progress: number): number {
  const remaining = 1 - progress;
  return 1 - remaining * remaining;
}

function interpolateWorkbenchViewport(
  from: RepairWorkbenchViewport,
  to: RepairWorkbenchViewport,
  progress: number
): RepairWorkbenchViewport {
  return {
    zoom: from.zoom + (to.zoom - from.zoom) * progress,
    panXPx: from.panXPx + (to.panXPx - from.panXPx) * progress,
    panYPx: from.panYPx + (to.panYPx - from.panYPx) * progress,
  };
}

function getRepairOverlayRefKey(ref: { kind: string; id: string }): string {
  return `${ref.kind}:${ref.id}`;
}

function getGuidanceSurfaceForPanel(
  panelId: RepairPanelId
): RepairGuidanceProjection["panelVisibility"]["primarySurface"] {
  if (panelId === "workbench-stage") return "workbench";
  if (panelId === "tactical-feed") return "tactical-feed";
  if (panelId === "session-wizard") return "session-wizard";
  if (panelId === "knowledge-pack") return "knowledge-pack";
  if (panelId === "visual-timeline") return "visual-timeline";
  if (panelId === "repair-settings") return "none";
  if (panelId === "measurement") return "measurement";
  if (panelId === "chat") return "chat";
  if (panelId === "room-sync") return "room-sync";
  return "none";
}

function createSpatialFocusTween({
  durationMs,
  from,
  onComplete,
  onUpdate,
  to,
}: {
  durationMs: number;
  from: RepairWorkbenchViewport;
  onComplete: () => void;
  onUpdate: (viewport: RepairWorkbenchViewport) => void;
  to: RepairWorkbenchViewport;
}): RepairSpatialFocusTween {
  let frameId: number | null = null;
  let startedAt: number | null = null;
  let cancelled = false;

  function tick(now: number): void {
    if (cancelled) return;
    startedAt ??= now;
    const elapsedMs = now - startedAt;
    const progress = Math.min(1, elapsedMs / durationMs);
    onUpdate(interpolateWorkbenchViewport(from, to, easeOutPower2(progress)));

    if (progress < 1) {
      frameId = window.requestAnimationFrame(tick);
      return;
    }

    frameId = null;
    onComplete();
  }

  frameId = window.requestAnimationFrame(tick);

  return {
    cancel() {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };
}

function createInitialState(): RepairUiState {
  const guidance = createRepairDefaultGuidanceProjection();
  return {
    phase: "initializing",
    sessions: { activeId: null, list: [], detail: null },
    workbench: {
      activeTool: "select",
      isFrozen: false,
      frozenAt: null,
      viewport: { zoom: 1, panXPx: 0, panYPx: 0 },
      timeline: {
        playheadMs: 0,
        zoom: 1,
        rangeStartMs: null,
        rangeEndMs: null,
        autoFollowLive: true,
        replayMode: "live",
        replaySpeed: 1,
        isPlaying: true,
        liveEdgeMs: 0,
      },
      cursor: null,
      liveSource: { available: false, connected: false },
      visibleLayers: {
        grid: true,
        "ai-marks": true,
        annotations: true,
        "measurement-pins": true,
        focus: true,
        "operator-annotations": true,
        "ai-annotations": true,
        measurements: true,
        risks: true,
        notes: true,
        knowledge: true,
      },
      hoveredEventId: null,
      focusedEventId: null,
      selection: {
        hoveredEventId: null,
        hoveredEntityRef: null,
        selectedEventIds: [],
        selectedEntityRefs: [],
        inspectorEventId: null,
        inspectorEntityRef: null,
        focusJumpEventId: null,
        focusJumpEntityRef: null,
      },
      contextualCursor: "inspect",
      operationalMode: "live",
      aiMarks: [],
      measurementEvidence: [],
      focusMode: false,
      investigationModeEnabled: false,
    },
    tacticalFeed: [],
    wizard: {
      currentStep: "device-info",
      draft: {
        manufacturer: "",
        model: "",
        boardCode: "",
        serialNumber: "",
        intakeNotes: "",
        primarySymptoms: [],
        symptomFreeText: "",
      },
      researchProgress: [],
      foundResources: [],
      generatedKnowledgePackId: null,
    },
    knowledgePack: {
      pack: null,
      attachedToSessionId: null,
      previewTabId: "schematic-preview",
      focusedSpatialRefId: null,
    },
    operatorProfile: {
      profile: {
        schemaVersion: 1,
        profileId: "",
        displayName: "Operator",
        bench: { tools: [], consumables: [], safety: [] },
        skills: [],
        preferences: {
          measurementSystem: "metric",
          annotationDefaultColor: REPAIR_UI_COLORS.cyan,
          annotationDefaultStrokeWidth: 2,
          riskTolerance: "medium",
          aiVerbosity: "standard",
        },
        updatedAt: "",
      },
      adaptation: {
        hasOscilloscope: false,
        hasBenchPsu: false,
        hasThermalCamera: false,
        hasHotAirStation: false,
        hasMicroscope: false,
        preferMultimeterFallbacks: true,
      },
      isDirty: false,
    },
    measurement: {
      activeInstrumentKind: "multimeter",
      current: {
        instrumentId: "",
        kind: "multimeter",
        label: "—",
        mode: "dc-voltage",
        range: "—",
        display: "— —",
        value: null,
        unit: "",
        hold: false,
        driftAmplitude: 0,
      },
      recent: [],
      evidence: [],
      comparisonEventId: null,
    },
    chat: { turns: [], composerDraft: "", pendingReplyId: null },
    layout: {
      collapsedPanels: {
        "session-rail": false,
        "workbench-stage": false,
        "tactical-feed": false,
        "session-wizard": false,
        "knowledge-pack": false,
        "visual-timeline": false,
        "operator-profile": false,
        "repair-settings": false,
        chat: false,
        measurement: false,
        "room-sync": false,
      },
      pinnedPanels: {
        "session-rail": true,
        "workbench-stage": true,
        "tactical-feed": false,
        "session-wizard": false,
        "knowledge-pack": false,
        "visual-timeline": true,
        "operator-profile": false,
        "repair-settings": false,
        chat: false,
        measurement: false,
        "room-sync": true,
      },
      operationalProfile: "novice",
      voiceGuidance: {
        ambientListeningState: "idle",
        spokenGuidanceMode: "brief",
        handsBusyMode: false,
      },
      interactionSettings: {
        androidCompanionEnabled: true,
        dictationRoute: "local",
        ttsRoute: "local",
        cameraFeedPreference: "manual",
        dictationSubmitMode: "composer",
        autoReadAiReplies: true,
      },
      attentionBudget: {
        windowMs: 180000,
        maxAiInterruptions: 2,
      },
      operatorProfileTabId: "tools",
      settingsOverlayOpen: false,
      settingsOverlayTabId: "repair-controls",
      focusMode: false,
      ambientClock: "",
    },
    guidance,
    operationsAvailable: false,
    operations: createRepairDefaultOperationsProjection(),
    voiceReadiness: createRepairDefaultVoiceReadinessProjection(),
    continuity: createRepairDefaultContinuityProjection(),
    aiDispatch: createRepairDefaultAiDispatchState(),
    storage: createRepairDefaultStorageState(),
    ambient: { nowIso: "", sessionDurationMs: 0 },
  };
}

export function createRepairRoomUiRuntime() {
  const state: RepairUiState = createInitialState();
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
  let overlayController: RepairOverlayController | null = null;
  let overlayControllerHost: HTMLElement | null = null;
  let overlayMounting = false;
  let overlayMountVersion = 0;
  let latestOverlayConfig: Parameters<typeof mountRepairOverlayStage>[0] | null = null;
  let lastOverlaySignature = "";
  let spatialFocusTween: RepairSpatialFocusTween | null = null;
  let spatialFocusTweenToken = 0;
  let lastSpatialFocusKey: string | null = null;

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

  function setClassNameIfChanged(element: HTMLElement, className: string): void {
    if (element.className !== className) element.className = className;
  }

  function setTextIfChanged(element: HTMLElement, textContent: string): void {
    if (element.textContent !== textContent) element.textContent = textContent;
  }

  function setDatasetIfChanged(element: HTMLElement, key: string, value: string): void {
    if (element.dataset[key] !== value) element.dataset[key] = value;
  }

  function setStyleIfChanged(
    element: HTMLElement,
    property: RepairMutableStyleProperty,
    value: string
  ): void {
    if (element.style[property] !== value) {
      element.style[property] = value;
    }
  }

  // -- Selector-level signatures for targeted panel updates
  function buildPanelSignature(panelId: RepairPanelId): string {
    const timelineShape = state.workbench.timeline;
    const timelineLiveWindow = timelineShape.autoFollowLive
      ? Math.floor((timelineShape.playheadMs + 10000) / 10000)
      : 0;
    const layoutShape = {
      collapsed: state.layout.collapsedPanels[panelId],
      pinned: state.layout.pinnedPanels[panelId],
      visibility: state.guidance.panelVisibility.panels[panelId],
      primarySurface: state.guidance.panelVisibility.primarySurface,
      operationalProfile: state.guidance.operationalProfile,
      interactionSettings: state.layout.interactionSettings,
      settingsOverlayOpen: state.layout.settingsOverlayOpen,
      settingsOverlayTabId: state.layout.settingsOverlayTabId,
    };
    const guidanceShape = {
      phase: state.guidance.investigationPhase,
      nextBestAction: state.guidance.nextBestAction.text,
      recovery: state.guidance.recovery,
      aiInterruption: state.guidance.aiInterruption,
      focusCorridor: state.guidance.focusCorridor,
      rhythm: state.guidance.rhythm,
      voice: state.guidance.voice,
      feedDensity: state.guidance.panelVisibility.tacticalFeedDensity,
    };
    switch (panelId) {
      case "session-rail":
        return JSON.stringify({
          aid: state.sessions.activeId,
          list: state.sessions.list,
          layoutShape,
        });
      case "workbench-stage":
        return JSON.stringify({
          sessionImage: state.sessions.detail?.pcbImage?.src ?? null,
          sessionImageLabel: state.sessions.detail?.pcbImage?.label ?? null,
          tool: state.workbench.activeTool,
          frozen: state.workbench.isFrozen,
          frozenAt: state.workbench.frozenAt,
          viewport: state.workbench.viewport,
          layers: state.workbench.visibleLayers,
          cursor: state.workbench.cursor,
          guidanceShape,
          layoutShape,
        });
      case "tactical-feed":
        return JSON.stringify({
          aiDispatch: state.aiDispatch,
          feed: state.tacticalFeed.map((item) => [
            item.eventId,
            item.occurredAt,
            item.relativeLabel,
            item.severity,
            item.badge,
            item.body,
          ]),
          focusedEventId: state.workbench.focusedEventId,
          guidanceShape,
          layoutShape,
        });
      case "session-wizard":
        return JSON.stringify({ wizard: state.wizard, guidanceShape, layoutShape });
      case "knowledge-pack":
        return JSON.stringify({ knowledgePack: state.knowledgePack, guidanceShape, layoutShape });
      case "visual-timeline":
        return JSON.stringify({
          phase: state.phase,
          focusedEventId: state.workbench.focusedEventId,
          timelineShape: {
            zoom: timelineShape.zoom,
            rangeStartMs: timelineShape.rangeStartMs,
            rangeEndMs: timelineShape.rangeEndMs,
            autoFollowLive: timelineShape.autoFollowLive,
            isPlaying: timelineShape.isPlaying,
            replayMode: timelineShape.replayMode,
            replaySpeed: timelineShape.replaySpeed,
            liveWindow: timelineLiveWindow,
          },
          events: meta.events.map((event) => [event.id, event.kind, event.occurredAt]),
          imageSrc: state.sessions.detail?.pcbImage?.src ?? null,
          guidanceShape,
          layoutShape,
        });
      case "operator-profile":
        return JSON.stringify({
          profile: state.operatorProfile,
          operatorProfileTabId: state.layout.operatorProfileTabId,
          layoutShape,
        });
      case "repair-settings":
        return JSON.stringify({
          voiceGuidance: state.layout.voiceGuidance,
          interactionSettings: state.layout.interactionSettings,
          attentionBudget: state.layout.attentionBudget,
          operationsAvailable: state.operationsAvailable,
          operations: state.operations,
          voiceReadiness: state.voiceReadiness,
          guidanceShape,
          layoutShape,
        });
      case "chat":
        return JSON.stringify({ chat: state.chat, guidanceShape, layoutShape });
      case "measurement":
        return JSON.stringify({
          measurementShape: {
            activeInstrumentKind: state.measurement.activeInstrumentKind,
            instrumentId: state.measurement.current.instrumentId,
            kind: state.measurement.current.kind,
            label: state.measurement.current.label,
            mode: state.measurement.current.mode,
            range: state.measurement.current.range,
            hold: state.measurement.current.hold,
          },
          guidanceShape,
          layoutShape,
        });
      case "room-sync":
        return JSON.stringify({
          phase: state.phase,
          activeId: state.sessions.activeId,
          aiDispatch: state.aiDispatch,
          focusedEventId: state.workbench.focusedEventId,
          timelineShape: {
            liveWindow: timelineLiveWindow,
          },
          events: meta.events.length,
          latestEventId: meta.events.at(-1)?.id ?? null,
          guidanceShape,
          layoutShape,
        });
      default: {
        const exhaustivePanelId: never = panelId;
        return JSON.stringify({ panelId: exhaustivePanelId, layoutShape });
      }
    }
  }

  function formatOffset(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `+${minutes}:${seconds}`;
  }

  function getTimelineModel(): {
    contentWidthPx: number;
    eventDeltas: number[];
    latestEventMs: number;
    totalMs: number;
    zoom: number;
  } {
    const session = state.sessions.detail;
    const sessionStartMs = session === null ? 0 : Date.parse(session.startedAt);
    const eventDeltas = meta.events.map((event) =>
      Math.max(0, Date.parse(event.occurredAt) - sessionStartMs)
    );
    const latestEventMs = eventDeltas.length === 0 ? 0 : Math.max(...eventDeltas);
    const totalMs = Math.max(
      60000,
      latestEventMs + 10000,
      state.workbench.timeline.playheadMs + 10000
    );
    const zoom = state.workbench.timeline.zoom;
    return {
      contentWidthPx: Math.max(860, Math.round((totalMs / 1000) * 12 * zoom)),
      eventDeltas,
      latestEventMs,
      totalMs,
      zoom,
    };
  }

  function getEventLabel(event: RepairEvent): string {
    switch (event.kind) {
      case "ai-mark":
        return event.severity.toUpperCase();
      case "measurement":
        return event.reference ?? event.channel;
      case "risk-flag":
        return "RISK";
      case "snapshot":
        return "SNAP";
      case "annotation":
        return event.tool.toUpperCase();
      case "freeze-frame":
        return "FREEZE";
      case "note":
        return event.author.toUpperCase();
      case "session-start":
        return "START";
      case "ai-mark-lifecycle":
        return "AI STATE";
      case "investigation-region-created":
        return "REGION";
      case "investigation-region-updated":
        return "REGION";
      default:
        return "EVENT";
    }
  }

  function getEventThumbnailSrc(event: RepairEvent): string | null {
    if (event.kind === "snapshot" && event.thumbnailSrc !== null) {
      return event.thumbnailSrc;
    }
    return state.sessions.detail?.pcbImage?.src ?? null;
  }

  function updateTimelineLiveDom(): void {
    const timeline = documentRef.querySelector<HTMLElement>(".repair-timeline");
    if (timeline === null) return;
    const totalMs = Math.max(1000, Number(timeline.dataset["totalMs"] ?? "60000") || 60000);
    const playheadMs = Math.max(0, state.workbench.timeline.playheadMs);
    const clampedPlayheadMs = Math.min(totalMs, playheadMs);
    const readout = timeline.querySelector<HTMLElement>(".repair-timeline__readout");
    if (readout !== null) {
      setTextIfChanged(readout, `${formatOffset(playheadMs)} / ${formatOffset(totalMs)}`);
    }
    const scrub = timeline.querySelector<HTMLInputElement>(".repair-timeline__scrub");
    if (scrub !== null && documentRef.activeElement !== scrub) {
      const nextValue = String(clampedPlayheadMs);
      if (scrub.value !== nextValue) scrub.value = nextValue;
    }
    const playhead = timeline.querySelector<HTMLElement>(".repair-timeline__playhead");
    if (playhead !== null) {
      setStyleIfChanged(playhead, "left", `${(clampedPlayheadMs / totalMs) * 100}%`);
    }
  }

  function appendMeasurementReadingRow(
    list: HTMLElement,
    reading: RepairUiState["measurement"]["recent"][number]
  ): void {
    const row = documentRef.createElement("div");
    row.className = "repair-reading-row";

    const ref = documentRef.createElement("span");
    ref.className = "repair-reading-row__ref";
    ref.textContent = reading.reference ?? reading.channel;
    row.append(ref);

    const val = documentRef.createElement("span");
    val.className = "repair-reading-row__value";
    val.textContent = reading.rawDisplay;
    row.append(val);

    const unit = documentRef.createElement("span");
    unit.className = "repair-reading-row__unit";
    unit.textContent = reading.unit;
    row.append(unit);

    list.append(row);
  }

  function updateMeasurementLiveDom(root: Document | HTMLElement = documentRef): void {
    const current = state.measurement.current;
    const value = root.querySelector<HTMLElement>(".repair-measurement-display__value");
    if (value !== null) setTextIfChanged(value, current.display);
    const unit = root.querySelector<HTMLElement>(".repair-measurement-display__unit");
    if (unit !== null) setTextIfChanged(unit, current.unit);
    const label = root.querySelector<HTMLElement>(".repair-measurement-display__label");
    if (label !== null) setTextIfChanged(label, current.label);
    const mode = root.querySelector<HTMLElement>(".repair-measurement-display__mode");
    if (mode !== null)
      setTextIfChanged(mode, `${current.mode.replace(/-/g, " ")} / ${current.range}`);

    const readingsList = root.querySelector<HTMLElement>(".repair-readings-list");
    if (readingsList === null) return;
    const fingerprint = state.measurement.recent
      .map((reading) => `${reading.id}:${reading.rawDisplay}`)
      .join("|");
    if (readingsList.dataset["fingerprint"] === fingerprint) return;
    readingsList.dataset["fingerprint"] = fingerprint;
    readingsList.replaceChildren();
    state.measurement.recent.forEach((reading) => {
      appendMeasurementReadingRow(readingsList, reading);
    });
  }

  function updateMeasurementEvidenceDom(root: Document | HTMLElement = documentRef): void {
    const list = root.querySelector<HTMLElement>(".repair-measurement-evidence-list");
    if (list === null) return;
    const fingerprint = state.workbench.measurementEvidence
      .map((entry) => `${entry.eventId}:${entry.currentDisplay}:${entry.history.join(">")}`)
      .join("|");
    if (list.dataset["fingerprint"] === fingerprint) return;
    list.dataset["fingerprint"] = fingerprint;
    list.replaceChildren();
    state.workbench.measurementEvidence.slice(0, 4).forEach((entry) => {
      const card = documentRef.createElement("button");
      card.className = "repair-measurement-evidence";
      card.type = "button";
      card.dataset["repairAction"] = "jump-to-event";
      card.dataset["eventId"] = entry.eventId;

      const label = documentRef.createElement("span");
      label.className = "repair-measurement-evidence__label";
      label.textContent = entry.reference;
      card.append(label);

      const value = documentRef.createElement("span");
      value.className = "repair-measurement-evidence__value";
      value.textContent =
        entry.previousDisplay === null
          ? entry.currentDisplay
          : `${entry.previousDisplay} → ${entry.currentDisplay}`;
      card.append(value);

      const spark = documentRef.createElement("span");
      spark.className = "repair-measurement-evidence__spark";
      entry.history.slice(-6).forEach((reading, index) => {
        const bar = documentRef.createElement("i");
        bar.style.height = `${Math.max(3, Math.min(16, 4 + index * 2))}px`;
        bar.title = reading;
        spark.append(bar);
      });
      card.append(spark);

      list.append(card);
    });
  }

  function getSyncFocusedEvent(): RepairEvent | null {
    return (
      meta.events.find((event) => event.id === state.workbench.focusedEventId) ??
      meta.events.at(-1) ??
      null
    );
  }

  function getSyncFocusedDetail(event: RepairEvent | null): string {
    if (event === null) return "Awaiting workbench event.";
    switch (event.kind) {
      case "measurement":
        return `${event.reference ?? event.channel} ${event.rawDisplay} ${event.unit}`;
      case "ai-mark":
        return event.rationale;
      case "risk-flag":
        return event.message;
      case "snapshot":
        return event.caption;
      case "annotation":
        return event.label;
      case "freeze-frame":
        return event.reason;
      case "note":
        return event.text;
      case "session-start":
        return event.title;
      case "ai-mark-lifecycle":
        return event.reason;
      case "investigation-region-created":
        return event.label;
      case "investigation-region-updated":
        return event.label ?? event.regionId;
      default: {
        const exhaustiveEvent: never = event;
        return exhaustiveEvent;
      }
    }
  }

  function getEventBrief(eventId: string): string {
    const event = meta.events.find((candidate) => candidate.id === eventId);
    if (event === undefined) return eventId;
    return `${event.kind.toUpperCase()} ${new Date(event.occurredAt).toLocaleTimeString("en-GB")}`;
  }

  function getLinkedInspectorText(event: RepairEvent): string {
    const linkedMeasurements =
      event.kind === "annotation"
        ? (event.meta?.linkedMeasurementIds ?? [])
        : event.kind === "ai-mark" || event.kind === "risk-flag"
          ? (event.linkedMeasurementIds ?? [])
          : event.kind === "measurement"
            ? (event.linkedAnnotationIds ?? [])
            : [];
    const linkedAiMarks =
      event.kind === "annotation"
        ? (event.meta?.linkedEventIds ?? []).filter((eventId) => {
            const linked = meta.events.find((candidate) => candidate.id === eventId);
            return linked?.kind === "ai-mark" || linked?.kind === "risk-flag";
          })
        : event.kind === "measurement"
          ? (event.linkedAiMarkIds ?? [])
          : event.linkedEventIds;
    const parts = [
      linkedMeasurements.length > 0
        ? `MEASURE ${linkedMeasurements.map(getEventBrief).join(", ")}`
        : null,
      linkedAiMarks.length > 0 ? `AI ${linkedAiMarks.map(getEventBrief).join(", ")}` : null,
    ].filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(" • ") : "No linked forensic records";
  }

  function getInspectorMetaText(event: RepairEvent): string {
    const base = new Date(event.occurredAt).toLocaleTimeString("en-GB");
    if (event.kind === "annotation") {
      const author = event.meta?.author ?? event.source;
      const tool = event.meta?.tool ?? event.tool;
      return `${base} • ${author.toUpperCase()} • ${tool.toUpperCase()}`;
    }
    if (event.kind === "ai-mark") {
      return `${base} • AI • ${(event.lifecycleState ?? "detected").toUpperCase()}`;
    }
    if (event.kind === "measurement") {
      const group =
        event.group?.rail ?? event.group?.component ?? event.group?.powerDomain ?? "ungrouped";
      return `${base} • ${group.toUpperCase()}`;
    }
    if (event.kind === "investigation-region-created") {
      return `${base} • ${event.status.toUpperCase()} • ${event.regionId}`;
    }
    if (event.kind === "investigation-region-updated") {
      return `${base} • ${(event.status ?? "updated").toUpperCase()} • ${event.regionId}`;
    }
    return `${base} • ${event.linkedEventIds.length} linked events`;
  }

  function updateSyncLiveDom(root: Document | HTMLElement = documentRef): void {
    root.querySelectorAll<HTMLElement>(".repair-sync-row").forEach((row) => {
      const labelElement = row.querySelector<HTMLElement>(".repair-sync-row__label");
      const label = labelElement === null ? "" : labelElement.textContent.trim().toLowerCase();
      const value = row.querySelector<HTMLElement>(".repair-sync-row__value");
      if (value !== null && label === "playhead") {
        setTextIfChanged(value, `+${Math.round(state.workbench.timeline.playheadMs / 1000)}s`);
      }
    });
  }

  function syncWorkbenchInspector(viewport: HTMLElement): void {
    const inspectorEventId =
      state.workbench.selection.inspectorEventId ?? state.workbench.focusedEventId;
    const focused =
      inspectorEventId === null
        ? null
        : (meta.events.find((event) => event.id === inspectorEventId) ?? null);
    let inspector = viewport.querySelector<HTMLElement>(".repair-annotation-inspector");
    if (focused === null) {
      inspector?.remove();
      return;
    }
    if (inspector === null) {
      inspector = documentRef.createElement("div");
      inspector.className = "repair-annotation-inspector";
      viewport.append(inspector);
    }
    setDatasetIfChanged(inspector, "eventId", focused.id);

    let title = inspector.querySelector<HTMLElement>(".repair-annotation-inspector__title");
    if (title === null) {
      title = documentRef.createElement("div");
      title.className = "repair-annotation-inspector__title";
      inspector.append(title);
    }
    setTextIfChanged(title, focused.kind.toUpperCase());

    let detail = inspector.querySelector<HTMLElement>(".repair-annotation-inspector__detail");
    if (detail === null) {
      detail = documentRef.createElement("div");
      detail.className = "repair-annotation-inspector__detail";
      inspector.append(detail);
    }
    setTextIfChanged(detail, getSyncFocusedDetail(focused));

    let metaLine = inspector.querySelector<HTMLElement>(".repair-annotation-inspector__meta");
    if (metaLine === null) {
      metaLine = documentRef.createElement("div");
      metaLine.className = "repair-annotation-inspector__meta";
      inspector.append(metaLine);
    }
    setTextIfChanged(metaLine, getInspectorMetaText(focused));

    let links = inspector.querySelector<HTMLElement>(".repair-annotation-inspector__links");
    if (links === null) {
      links = documentRef.createElement("div");
      links.className = "repair-annotation-inspector__links";
      inspector.append(links);
    }
    setTextIfChanged(links, getLinkedInspectorText(focused));

    let selection = inspector.querySelector<HTMLElement>(".repair-annotation-inspector__selection");
    if (selection === null) {
      selection = documentRef.createElement("div");
      selection.className = "repair-annotation-inspector__selection";
      inspector.append(selection);
    }
    setTextIfChanged(
      selection,
      `${state.workbench.selection.selectedEventIds.length} selected • hover ${
        state.workbench.selection.hoveredEventId === null
          ? "none"
          : getEventBrief(state.workbench.selection.hoveredEventId)
      }`
    );
  }

  function applyLiveSnapshotUpdates(): void {
    updateTimelineLiveDom();
    updateMeasurementLiveDom();
    updateSyncLiveDom();
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

  function destroyOverlay(): void {
    overlayMountVersion += 1;
    overlayController?.destroy();
    overlayController = null;
    overlayControllerHost = null;
    overlayMounting = false;
    latestOverlayConfig = null;
    lastOverlaySignature = "";
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
      void syncOverlay(shell.root);
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

  function buildOverlaySignature(config: Parameters<typeof mountRepairOverlayStage>[0]): string {
    return JSON.stringify({
      events: config.events.map((event) => [
        event.id,
        event.kind,
        event.occurredAt,
        event.kind === "measurement" ? event.pinAt : null,
        event.kind === "annotation" ? [event.region, event.point, event.label, event.color] : null,
        event.kind === "ai-mark" || event.kind === "risk-flag" ? event.region : null,
      ]),
      focusedEventId: config.focusedEventId,
      image: [config.image.src, config.image.widthPx, config.image.heightPx],
      visibleLayers: config.visibleLayers,
      activeSpatialFocus: config.activeSpatialFocus,
      investigationRegions: config.investigationRegions,
      knowledgeRegions: config.knowledgeRegions,
      measurementRelationships: config.measurementRelationships,
      temporarySpatialRegions: config.temporarySpatialRegions,
      guidance: config.guidance,
      workbench: {
        activeTool: config.workbench.activeTool,
        viewport: config.workbench.viewport,
        contextualCursor: config.workbench.contextualCursor,
        hoveredEventId: config.workbench.selection.hoveredEventId,
        hoveredEntityRef: config.workbench.selection.hoveredEntityRef,
        selectedEventIds: config.workbench.selection.selectedEventIds,
        selectedEntityRefs: config.workbench.selection.selectedEntityRefs,
        investigationModeEnabled: config.workbench.investigationModeEnabled,
      },
    });
  }

  function buildOverlayConfig(
    root: HTMLElement
  ): Parameters<typeof mountRepairOverlayStage>[0] | null {
    const overlayHost = root.querySelector<HTMLElement>("[data-repair-overlay-stage='workbench']");
    const session = state.sessions.detail;
    if (overlayHost === null || session === null || session.pcbImage === null) return null;
    const image = {
      ...session.pcbImage,
      src: resolveRepairAssetUrl(session.pcbImage.src) ?? session.pcbImage.src,
    };
    const visibleOverlayEventIds = new Set(state.guidance.overlaySaturation.visibleEventIds);
    const visibleRelationshipIds = new Set(state.guidance.overlaySaturation.visibleRelationshipIds);
    const visibleRegionKeys = new Set(
      state.guidance.overlaySaturation.visibleRegionRefs.map(getRepairOverlayRefKey)
    );
    const shouldFilterRegions =
      state.guidance.operationalProfile !== "advanced" && visibleRegionKeys.size > 0;
    const overlayEvents =
      state.guidance.operationalProfile === "advanced" || visibleOverlayEventIds.size === 0
        ? meta.replay.overlayEvents
        : meta.replay.overlayEvents.filter((event) => visibleOverlayEventIds.has(event.id));
    const measurementRelationships =
      state.guidance.operationalProfile === "advanced" || visibleRelationshipIds.size === 0
        ? meta.replay.measurementRelationships
        : meta.replay.measurementRelationships.filter((relationship) =>
            visibleRelationshipIds.has(relationship.id)
          );
    const investigationRegions = shouldFilterRegions
      ? meta.replay.investigationRegions.filter((region) =>
          visibleRegionKeys.has(`investigation-region:${region.regionId}`)
        )
      : meta.replay.investigationRegions;
    const knowledgeRegions = shouldFilterRegions
      ? meta.replay.knowledgeRegions.filter((region) =>
          visibleRegionKeys.has(`knowledge-region:${region.id}`)
        )
      : meta.replay.knowledgeRegions;
    const temporarySpatialRegions = shouldFilterRegions
      ? meta.replay.temporarySpatialRegions.filter((region) =>
          visibleRegionKeys.has(`temporary-spatial-region:${region.id}`)
        )
      : meta.replay.temporarySpatialRegions;
    return {
      container: overlayHost,
      activeSpatialFocus: meta.replay.activeSpatialFocus,
      events: overlayEvents,
      focusedEventId: state.workbench.focusedEventId ?? meta.replay.focusSuggestionEventId,
      image,
      investigationRegions,
      knowledgeRegions,
      measurementRelationships,
      temporarySpatialRegions,
      guidance: state.guidance,
      visibleLayers: state.workbench.visibleLayers,
      workbench: state.workbench,
      onAddAnnotation: (payload) => {
        requestRuntime.addTimelineEvent({ kind: "annotation", ...payload });
      },
      onAddMeasurement: (payload) => {
        requestRuntime.addMeasurement({
          rawDisplay: state.measurement.current.display,
          ...payload,
        });
      },
      onCursor: updateCursorHud,
      onEntityClick: (ref, interaction) => {
        cancelSpatialFocusTween();
        requestRuntime.selectOverlayEntities({
          refs: [ref],
          mode: interaction.additive ? "toggle" : "replace",
          inspectorRef: ref,
          focusJump: interaction.focusJump,
        });
        if (interaction.focusJump && interaction.additive === false) {
          requestRuntime.focusOverlayEntity({ ref, focusJump: true });
        }
      },
      onEntityFocus: (ref) => {
        cancelSpatialFocusTween();
        requestRuntime.focusOverlayEntity({ ref, focusJump: true });
      },
      onEntityHover: (ref) => {
        requestRuntime.updateFocus({ hoveredEntityRef: ref });
      },
      onEventClick: (eventId, interaction) => {
        requestRuntime.updateFocus({
          eventId,
          selectionMode: interaction.additive ? "toggle" : "replace",
          focusJump: interaction.focusJump,
          jumpToEvent: interaction.focusJump && interaction.additive === false,
        });
      },
      onEventHover: (eventId) => {
        requestRuntime.updateFocus({ hoveredEventId: eventId });
      },
      onSelectionClear: () => {
        cancelSpatialFocusTween();
        requestRuntime.updateFocus({ clearSelection: true });
      },
      onMarqueeSelect: (refs, additive) => {
        requestRuntime.selectOverlayEntities({
          refs,
          mode: additive ? "toggle" : "replace",
          inspectorRef: refs.at(-1) ?? null,
          focusJump: false,
        });
      },
      onNudgeSelection: (delta, hardSnap) => {
        cancelSpatialFocusTween();
        requestRuntime.updateFocus({
          nudgeDelta: delta,
          hardSnap,
        });
      },
      onViewportChange: (payload) => {
        cancelSpatialFocusTween();
        requestRuntime.updateViewport({
          viewportZoom: payload.zoom,
          panXPx: payload.panXPx,
          panYPx: payload.panYPx,
        });
      },
    };
  }

  async function syncOverlay(root: HTMLElement): Promise<void> {
    const overlayConfig = buildOverlayConfig(root);
    latestOverlayConfig = overlayConfig;
    if (overlayConfig === null) {
      destroyOverlay();
      return;
    }
    const overlaySignature = buildOverlaySignature(overlayConfig);
    if (overlayController !== null && overlayControllerHost === overlayConfig.container) {
      if (overlaySignature === lastOverlaySignature) return;
      lastOverlaySignature = overlaySignature;
      overlayController.update(overlayConfig);
      return;
    }
    if (overlayController !== null && overlayControllerHost !== overlayConfig.container) {
      destroyOverlay();
    }
    if (overlayMounting) return;
    overlayMounting = true;
    const mountVersion = ++overlayMountVersion;
    let needsRemount = false;
    try {
      const controller = await mountRepairOverlayStage(overlayConfig);
      if (controller === null) return;
      const currentConfig = latestOverlayConfig;
      if (
        mountVersion !== overlayMountVersion ||
        currentConfig === null ||
        currentConfig.container !== overlayConfig.container
      ) {
        controller.destroy();
        needsRemount = currentConfig !== null;
        return;
      }
      overlayController = controller;
      overlayControllerHost = overlayConfig.container;
      lastOverlaySignature = buildOverlaySignature(currentConfig);
      controller.update(currentConfig);
    } catch (error) {
      overlayConfig.container.dataset["overlayError"] = "true";
      console.error("[repair-room] overlay mount failed", error);
      return;
    } finally {
      overlayMounting = false;
      if (needsRemount) {
        void syncOverlay(root);
      }
    }
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
    const pinned = state.layout.pinnedPanels[panelId];
    panel.classList.toggle("repair-panel--collapsed", collapsed);
    panel.classList.toggle("repair-panel--pinned", pinned);

    const pin = panel.querySelector<HTMLElement>("[data-repair-action='toggle-panel-pin']");
    if (pin !== null) {
      pin.classList.toggle("repair-panel__icon-btn--active", pinned);
      const nextTitle = pinned ? "Unpin panel" : "Pin panel";
      if (pin.title !== nextTitle) pin.title = nextTitle;
      setDatasetIfChanged(pin, "pinned", String(!pinned));
    }

    const collapse = panel.querySelector<HTMLElement>(
      "[data-repair-action='toggle-panel-collapse']"
    );
    if (collapse !== null) {
      const nextTitle = collapsed ? "Expand panel" : "Collapse panel";
      const nextText = collapsed ? "EXP" : "COL";
      if (collapse.title !== nextTitle) collapse.title = nextTitle;
      setTextIfChanged(collapse, nextText);
      setDatasetIfChanged(collapse, "collapsed", String(!collapsed));
    }
  }

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
      setDatasetIfChanged(viewport, "mode", state.workbench.operationalMode);
      const overlayHost = viewport.querySelector<HTMLElement>(
        "[data-repair-overlay-stage='workbench']"
      );
      const existingImage = viewport.querySelector<HTMLImageElement>(".repair-viewport__image");
      const existingPlaceholder = viewport.querySelector<HTMLElement>(".repair-empty-state");
      const session = state.sessions.detail;
      if (session !== null && session.pcbImage !== null) {
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
        existingImage?.remove();
        if (existingPlaceholder === null) {
          const placeholder = documentRef.createElement("div");
          placeholder.className = "repair-empty-state";
          placeholder.textContent = text(["workbench", "noImage"], "No PCB image loaded");
          viewport.insertBefore(placeholder, overlayHost ?? viewport.firstChild);
        }
      }
      syncWorkbenchInspector(viewport);
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
      setTextIfChanged(handsFreeButton, "HANDS-FREE");
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
      setTextIfChanged(ambientButton, ambientActive ? "AMB ON" : "AMB");
      const nextTitle = ambientActive ? "Stop ambient listening" : "Start ambient listening";
      if (ambientButton.title !== nextTitle) ambientButton.title = nextTitle;
      setDatasetIfChanged(ambientButton, "repairAction", "toggle-ambient-listener");
      setDatasetIfChanged(ambientButton, "active", String(ambientActive));
    }

    const dictationButton = panel.querySelector<HTMLElement>(
      "[data-repair-control='dictation-route']"
    );
    if (dictationButton !== null) {
      setTextIfChanged(
        dictationButton,
        dictationActive ? "DIC ON" : `DIC ${interaction.dictationRoute === "android" ? "A" : "L"}`
      );
      dictationButton.classList.toggle("repair-guidance-control--active", dictationActive);
      const nextTitle = dictationActive
        ? "Stop dictation"
        : `Start ${interaction.dictationRoute} dictation`;
      if (dictationButton.title !== nextTitle) dictationButton.title = nextTitle;
      setDatasetIfChanged(dictationButton, "repairAction", "toggle-dictation");
      setDatasetIfChanged(dictationButton, "active", String(dictationActive));
    }

    const cameraButton = panel.querySelector<HTMLElement>("[data-repair-control='camera-feed']");
    if (cameraButton !== null) {
      cameraButton.classList.toggle("repair-guidance-control--active", cameraActive);
      setTextIfChanged(cameraButton, cameraActive ? "CAM ON" : "CAM");
      const nextTitle = cameraActive ? "Stop Android camera feed" : "Start Android camera feed";
      if (cameraButton.title !== nextTitle) cameraButton.title = nextTitle;
      setDatasetIfChanged(cameraButton, "repairAction", "toggle-camera-feed");
      setDatasetIfChanged(cameraButton, "active", String(cameraActive));
    }

    const ttsButton = panel.querySelector<HTMLElement>("[data-repair-control='tts-route']");
    if (ttsButton !== null) {
      ttsButton.classList.toggle("repair-guidance-control--active", ttsActive);
      setTextIfChanged(
        ttsButton,
        ttsActive ? "TTS ON" : `TTS ${interaction.ttsRoute === "android" ? "A" : "L"}`
      );
      const nextTitle = ttsActive ? "Stop spoken guidance" : "Read current guidance aloud";
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
      setTextIfChanged(
        budgetButton,
        `AI ${state.guidance.aiInterruption.attentionBudget.remainingAiInterruptions}/${currentMax}`
      );
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

  function createTacticalFeedEntry(): HTMLElement {
    const entry = documentRef.createElement("div");
    entry.dataset["repairAction"] = "jump-to-event";

    const header = documentRef.createElement("div");
    header.className = "repair-feed-entry__header";

    const badge = documentRef.createElement("span");
    badge.className = "repair-feed-entry__badge";
    header.append(badge);

    const time = documentRef.createElement("span");
    time.className = "repair-feed-entry__time";
    header.append(time);

    const bodyText = documentRef.createElement("div");
    bodyText.className = "repair-feed-entry__body";

    entry.append(header, bodyText);
    return entry;
  }

  function syncTacticalFeedEntry(
    entry: HTMLElement,
    item: RepairUiState["tacticalFeed"][number]
  ): void {
    setClassNameIfChanged(
      entry,
      `repair-feed-entry repair-feed-entry--${item.severity}${
        state.workbench.focusedEventId === item.eventId ? " repair-feed-entry--active" : ""
      }`
    );
    setDatasetIfChanged(entry, "repairAction", "jump-to-event");
    setDatasetIfChanged(entry, "eventId", item.eventId);

    let header = entry.querySelector<HTMLElement>(".repair-feed-entry__header");
    if (header === null) {
      header = documentRef.createElement("div");
      header.className = "repair-feed-entry__header";
      entry.prepend(header);
    }

    let badge = header.querySelector<HTMLElement>(".repair-feed-entry__badge");
    if (badge === null) {
      badge = documentRef.createElement("span");
      header.prepend(badge);
    }
    setClassNameIfChanged(
      badge,
      `repair-feed-entry__badge repair-feed-entry__badge--${item.severity}`
    );
    setTextIfChanged(badge, item.badge);

    let time = header.querySelector<HTMLElement>(".repair-feed-entry__time");
    if (time === null) {
      time = documentRef.createElement("span");
      time.className = "repair-feed-entry__time";
      header.append(time);
    }
    setTextIfChanged(time, item.relativeLabel);

    let bodyText = entry.querySelector<HTMLElement>(".repair-feed-entry__body");
    if (bodyText === null) {
      bodyText = documentRef.createElement("div");
      bodyText.className = "repair-feed-entry__body";
      entry.append(bodyText);
    }
    setTextIfChanged(bodyText, item.body);
  }

  function updateTacticalFeedPanelDom(panel: HTMLElement): void {
    updatePanelChrome(panel, "tactical-feed");

    const hasRisk = state.tacticalFeed.some((item) => item.severity === "risk");
    const dot = panel.querySelector<HTMLElement>(".repair-panel__status-dot");
    if (dot !== null) {
      setClassNameIfChanged(
        dot,
        `repair-panel__status-dot repair-panel__status-dot--${hasRisk ? "risk" : "live"}`
      );
    }

    const calmLine = panel.querySelector<HTMLElement>(".repair-feed-calmline");
    if (calmLine !== null) {
      setTextIfChanged(calmLine, formatRepairTacticalFeedStatusLine(state));
    }

    const list = panel.querySelector<HTMLElement>(".repair-feed-list");
    if (list === null) return;

    const previousScrollTop = list.scrollTop;
    const activeEventIds = new Set(state.tacticalFeed.map((item) => item.eventId));
    for (const item of state.tacticalFeed) {
      const existing =
        Array.from(list.querySelectorAll<HTMLElement>(".repair-feed-entry")).find(
          (candidate) => candidate.dataset["eventId"] === item.eventId
        ) ?? null;
      const entry = existing ?? createTacticalFeedEntry();
      syncTacticalFeedEntry(entry, item);
      list.append(entry);
    }

    list.querySelectorAll<HTMLElement>(".repair-feed-entry").forEach((entry) => {
      const eventId = entry.dataset["eventId"];
      if (eventId === undefined || !activeEventIds.has(eventId)) {
        entry.remove();
      }
    });
    list.scrollTop = previousScrollTop;
  }

  function updateMeasurementPanelDom(panel: HTMLElement): void {
    updatePanelChrome(panel, "measurement");

    const dot = panel.querySelector<HTMLElement>(".repair-panel__status-dot");
    if (dot !== null) {
      setClassNameIfChanged(
        dot,
        `repair-panel__status-dot repair-panel__status-dot--${
          state.measurement.current.hold ? "amber" : "live"
        }`
      );
    }

    panel.querySelectorAll<HTMLElement>("[data-repair-action='set-instrument']").forEach((tab) => {
      tab.classList.toggle(
        "repair-tab--active",
        tab.dataset["instrumentKind"] === state.measurement.activeInstrumentKind
      );
    });

    updateMeasurementLiveDom(panel);
    updateMeasurementEvidenceDom(panel);
  }

  function updateRoomSyncPanelDom(panel: HTMLElement): void {
    updatePanelChrome(panel, "room-sync");

    const dot = panel.querySelector<HTMLElement>(".repair-panel__status-dot");
    if (dot !== null) {
      setClassNameIfChanged(
        dot,
        `repair-panel__status-dot repair-panel__status-dot--${
          state.phase === "session-active" ? "live" : "idle"
        }`
      );
    }

    const rows = getRepairRoomSyncRows(state, meta, text);
    const body = panel.querySelector<HTMLElement>(".repair-sync-panel");
    const focusCard = panel.querySelector<HTMLElement>(".repair-sync-focus");
    const rowElements = Array.from(
      panel.querySelectorAll<HTMLElement>(".repair-sync-row:not(.repair-sync-row--control)")
    );
    rows.forEach(([label, value], index) => {
      let row = rowElements[index];
      if (row === undefined) {
        row = documentRef.createElement("div");
        row.className = "repair-sync-row";

        const labelEl = documentRef.createElement("span");
        labelEl.className = "repair-sync-row__label";
        row.append(labelEl);

        const valueEl = documentRef.createElement("span");
        valueEl.className = "repair-sync-row__value";
        row.append(valueEl);

        if (focusCard !== null) {
          body?.insertBefore(row, focusCard);
        } else {
          body?.append(row);
        }
      }
      const labelEl = row.querySelector<HTMLElement>(".repair-sync-row__label");
      if (labelEl !== null) setTextIfChanged(labelEl, label);
      const valueEl = row.querySelector<HTMLElement>(".repair-sync-row__value");
      if (valueEl !== null) setTextIfChanged(valueEl, value);
    });
    rowElements.slice(rows.length).forEach((row) => {
      row.remove();
    });
    const targetSelect = panel.querySelector<HTMLSelectElement>(
      "[data-repair-action='set-ai-target-slot']"
    );
    if (targetSelect !== null && targetSelect.value !== state.aiDispatch.chat.targetSlot) {
      targetSelect.value = state.aiDispatch.chat.targetSlot;
    }

    const focused = getSyncFocusedEvent();
    const title = panel.querySelector<HTMLElement>(".repair-sync-focus__title");
    if (title !== null)
      setTextIfChanged(title, focused === null ? "Live edge" : focused.kind.toUpperCase());
    const detail = panel.querySelector<HTMLElement>(".repair-sync-focus__detail");
    if (detail !== null) setTextIfChanged(detail, getSyncFocusedDetail(focused));
    if (focusCard !== null) {
      let actions = focusCard.querySelector<HTMLElement>(".repair-sync-focus__actions");
      if (focused?.kind !== "ai-mark") {
        actions?.remove();
        return;
      }
      if (actions === null) {
        actions = documentRef.createElement("div");
        actions.className = "repair-sync-focus__actions";
        focusCard.append(actions);
      }
      const activeKeys = new Set<string>();
      AI_LIFECYCLE_ACTIONS.forEach(([stateId, label]) => {
        activeKeys.add(stateId);
        let button = actions.querySelector<HTMLButtonElement>(
          `.repair-sync-focus__action[data-ai-state="${stateId}"]`
        );
        if (button === null) {
          button = documentRef.createElement("button");
          button.type = "button";
          button.className = "repair-sync-focus__action";
          button.dataset["repairAction"] = "ai-mark-state";
          button.dataset["aiState"] = stateId;
          actions.append(button);
        }
        setTextIfChanged(button, label);
        setDatasetIfChanged(button, "eventId", focused.id);
        button.title = `Move AI mark to ${stateId}`;
      });
      actions.querySelectorAll<HTMLElement>(".repair-sync-focus__action").forEach((button) => {
        const stateId = button.dataset["aiState"];
        if (stateId === undefined || !activeKeys.has(stateId)) button.remove();
      });
    }
  }

  function syncTimelineTicks(track: HTMLElement, totalMs: number): void {
    const tickCount = Math.max(6, Math.ceil(totalMs / 10000));
    const activeTickKeys = new Set<string>();
    for (let i = 0; i <= tickCount; i += 1) {
      const tickMs = Math.min(totalMs, i * 10000);
      const key = String(tickMs);
      activeTickKeys.add(key);
      let tick = track.querySelector<HTMLElement>(`.repair-timeline__tick[data-tick-ms="${key}"]`);
      if (tick === null) {
        tick = documentRef.createElement("div");
        tick.className = "repair-timeline__tick";
        tick.dataset["tickMs"] = key;
        const label = documentRef.createElement("span");
        tick.append(label);
      }
      tick.style.left = `${(tickMs / totalMs) * 100}%`;
      const label = tick.querySelector<HTMLElement>("span");
      if (label !== null) {
        label.textContent = formatOffset(tickMs);
      }
      track.append(tick);
    }

    track.querySelectorAll<HTMLElement>(".repair-timeline__tick").forEach((tick) => {
      const key = tick.dataset["tickMs"];
      if (key === undefined || !activeTickKeys.has(key)) {
        tick.remove();
      }
    });
  }

  function syncTimelineRange(track: HTMLElement, totalMs: number): void {
    const rangeStart = state.workbench.timeline.rangeStartMs;
    const rangeEnd = state.workbench.timeline.rangeEndMs;
    let range = track.querySelector<HTMLElement>(".repair-timeline__range");
    if (rangeStart === null || rangeEnd === null) {
      range?.remove();
      return;
    }
    if (range === null) {
      range = documentRef.createElement("div");
      range.className = "repair-timeline__range";
    }
    range.style.left = `${(Math.min(rangeStart, rangeEnd) / totalMs) * 100}%`;
    range.style.width = `${(Math.abs(rangeEnd - rangeStart) / totalMs) * 100}%`;
    track.append(range);
  }

  function syncTimelineChip(
    track: HTMLElement,
    event: RepairEvent,
    deltaMs: number,
    totalMs: number,
    zoom: number
  ): HTMLElement {
    let chip =
      Array.from(track.querySelectorAll<HTMLElement>(".repair-timeline__chip")).find(
        (candidate) => candidate.dataset["eventId"] === event.id
      ) ?? null;
    if (chip === null) {
      chip = documentRef.createElement("button");
      chip.dataset["repairAction"] = "jump-to-event";
      chip.dataset["eventId"] = event.id;
    }
    chip.className = `repair-timeline__chip repair-timeline__chip--${event.kind}${
      state.workbench.focusedEventId === event.id ? " repair-timeline__chip--active" : ""
    }`;
    chip.setAttribute("type", "button");
    chip.title = `${event.kind} — ${event.occurredAt}`;
    chip.style.left = `${(deltaMs / totalMs) * 100}%`;
    const density =
      meta.replay.timelineDensity.find(
        (bucket) => deltaMs >= bucket.bucketStartMs && deltaMs < bucket.bucketEndMs
      )?.density ?? 0;
    chip.style.setProperty("--repair-chip-density", density.toFixed(2));
    chip.dataset["spatialDensity"] = density.toFixed(2);

    if (zoom < 0.6) {
      chip.replaceChildren();
      return chip;
    }

    let thumb = chip.querySelector<HTMLElement>(".repair-timeline__thumb");
    if (thumb === null) {
      thumb = documentRef.createElement("span");
      thumb.className = "repair-timeline__thumb";
      chip.replaceChildren(thumb);
    }

    const thumbnailSrc = getEventThumbnailSrc(event);
    if (thumbnailSrc !== null) {
      const resolvedSrc = resolveRepairAssetUrl(thumbnailSrc) ?? thumbnailSrc;
      thumb.style.backgroundImage = `linear-gradient(180deg, rgba(5, 8, 12, 0.06), rgba(5, 8, 12, 0.72)), url("${resolvedSrc.replace(/"/g, '\\"')}")`;
    } else {
      thumb.style.removeProperty("background-image");
    }

    let thumbLabel = thumb.querySelector<HTMLElement>(".repair-timeline__thumb-label");
    if (thumbLabel === null) {
      thumbLabel = documentRef.createElement("span");
      thumbLabel.className = "repair-timeline__thumb-label";
      thumb.append(thumbLabel);
    }
    thumbLabel.textContent = getEventLabel(event);
    return chip;
  }

  function syncTimelineChips(
    track: HTMLElement,
    eventDeltas: number[],
    totalMs: number,
    zoom: number
  ): void {
    const activeEventIds = new Set(meta.events.map((event) => event.id));
    meta.events.forEach((event, index) => {
      track.append(syncTimelineChip(track, event, eventDeltas[index] ?? 0, totalMs, zoom));
    });

    track.querySelectorAll<HTMLElement>(".repair-timeline__chip").forEach((chip) => {
      const eventId = chip.dataset["eventId"];
      if (eventId === undefined || !activeEventIds.has(eventId)) {
        chip.remove();
      }
    });
  }

  function syncTimelinePlayhead(track: HTMLElement, totalMs: number): void {
    let playhead = track.querySelector<HTMLElement>(".repair-timeline__playhead");
    if (playhead === null) {
      playhead = documentRef.createElement("div");
      playhead.className = "repair-timeline__playhead";
    }
    playhead.style.left = `${
      (Math.min(totalMs, state.workbench.timeline.playheadMs) / totalMs) * 100
    }%`;
    track.append(playhead);
  }

  function syncTimelineLiveEdge(track: HTMLElement, totalMs: number, latestEventMs: number): void {
    let liveEdge = track.querySelector<HTMLElement>(".repair-timeline__live-edge");
    if (state.phase !== "session-active") {
      liveEdge?.remove();
      return;
    }
    if (liveEdge === null) {
      liveEdge = documentRef.createElement("div");
      liveEdge.className = "repair-timeline__live-edge";
    }
    liveEdge.style.left = `${(latestEventMs / totalMs) * 100}%`;
    track.append(liveEdge);
  }

  function updateVisualTimelinePanelDom(panel: HTMLElement): void {
    updatePanelChrome(panel, "visual-timeline");
    const dot = panel.querySelector<HTMLElement>(".repair-panel__status-dot");
    if (dot !== null) {
      setClassNameIfChanged(
        dot,
        `repair-panel__status-dot repair-panel__status-dot--${
          state.phase === "session-active" ? "live" : "idle"
        }`
      );
    }

    const timeline = panel.querySelector<HTMLElement>(".repair-timeline");
    const track = panel.querySelector<HTMLElement>(".repair-timeline__track");
    const scrub = panel.querySelector<HTMLInputElement>(".repair-timeline__scrub");
    if (timeline === null || track === null || scrub === null) return;

    const previousScrollLeft =
      panel.querySelector<HTMLElement>(".repair-timeline__scroller")?.scrollLeft ?? 0;
    const model = getTimelineModel();
    setDatasetIfChanged(timeline, "totalMs", String(model.totalMs));
    setStyleIfChanged(track, "width", `${model.contentWidthPx}px`);
    const scrubMax = String(model.totalMs);
    if (scrub.max !== scrubMax) scrub.max = scrubMax;
    const scrubValue = String(
      Math.min(model.totalMs, Math.max(0, state.workbench.timeline.playheadMs))
    );
    if (scrub.value !== scrubValue) scrub.value = scrubValue;

    syncTimelineTicks(track, model.totalMs);
    syncTimelineRange(track, model.totalMs);
    syncTimelineChips(track, model.eventDeltas, model.totalMs, model.zoom);
    syncTimelinePlayhead(track, model.totalMs);
    syncTimelineLiveEdge(track, model.totalMs, model.latestEventMs);
    applyLiveSnapshotUpdates();

    const playButton = panel.querySelector<HTMLElement>(
      "[data-repair-action='timeline-play'], [data-repair-action='timeline-pause']"
    );
    if (playButton !== null) {
      const nextAction = state.workbench.timeline.isPlaying ? "timeline-pause" : "timeline-play";
      setDatasetIfChanged(playButton, "repairAction", nextAction);
      setTextIfChanged(playButton, state.workbench.timeline.isPlaying ? "PAU" : "PLY");
    }
    const liveButton = panel.querySelector<HTMLElement>("[data-repair-action='timeline-live']");
    liveButton?.classList.toggle(
      "repair-timeline__control-btn--active",
      state.workbench.timeline.autoFollowLive
    );
    const speedButton = panel.querySelector<HTMLElement>("[data-repair-action='timeline-speed']");
    if (speedButton !== null) {
      setTextIfChanged(speedButton, `${state.workbench.timeline.replaySpeed.toFixed(1)}X`);
    }

    const scroller = panel.querySelector<HTMLElement>(".repair-timeline__scroller");
    if (scroller !== null) {
      scroller.scrollLeft = previousScrollLeft;
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
          updateVisualTimelinePanelDom(element);
          return element;
        }
        if (panelId === "tactical-feed") {
          updateTacticalFeedPanelDom(element);
          return element;
        }
        if (panelId === "measurement") {
          updateMeasurementPanelDom(element);
          return element;
        }
        if (panelId === "room-sync") {
          updateRoomSyncPanelDom(element);
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
      ["AI Mark", "var(--repair-amber)"],
      ["Measurement", "var(--repair-text)"],
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

  function getSettingsOverlayTitle(tabId: RepairSettingsOverlayTabId): string {
    return tabId === "bench-operator"
      ? text(["settings", "operatorOverlayTitle"], "Bench Operator")
      : text(["settings", "title"], "Repair Controls");
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

    const tabs = documentRef.createElement("div");
    tabs.className = "repair-settings-overlay__tabs";
    REPAIR_SETTINGS_OVERLAY_TABS.forEach((tab) => {
      const tabButton = documentRef.createElement("button");
      tabButton.type = "button";
      tabButton.className = "repair-settings-overlay__tab";
      tabButton.textContent =
        tab.id === "bench-operator"
          ? text(["settings", "operatorOverlayTitle"], tab.label)
          : text(["settings", "title"], tab.label);
      tabButton.dataset["repairAction"] = "set-settings-overlay";
      tabButton.dataset["open"] = "true";
      tabButton.dataset["tabId"] = tab.id;
      tabs.append(tabButton);
    });
    header.append(tabs);

    const close = documentRef.createElement("button");
    close.type = "button";
    close.className = "repair-settings-overlay__close";
    close.title = "Close settings";
    close.textContent = "CLOSE";
    close.dataset["repairAction"] = "set-settings-overlay";
    close.dataset["open"] = "false";
    header.append(close);

    const body = documentRef.createElement("div");
    body.className = "repair-settings-overlay__body";

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
      if (body.children.length > 0) body.replaceChildren();
      shell?.panelSignatures.delete("operator-profile");
      shell?.panelSignatures.delete("repair-settings");
      shell?.panelElements.delete("operator-profile");
      shell?.panelElements.delete("repair-settings");
      if (shell !== null) shell.settingsOverlaySignature = "";
      return;
    }

    const panelId: RepairPanelId =
      tabId === "bench-operator" ? "operator-profile" : "repair-settings";
    const signature = `${tabId}:${buildPanelSignature(panelId)}`;
    if (shell?.settingsOverlaySignature === signature && body.children.length > 0) {
      const current = body.firstElementChild;
      if (current instanceof HTMLElement) applyPanelGuidanceChrome(current, panelId);
      return;
    }

    const panel =
      tabId === "bench-operator"
        ? renderOperatorProfilePanel(documentRef, state, text)
        : renderRepairSettingsPanel(documentRef, state, text);
    applyPanelGuidanceChrome(panel, panelId);
    body.replaceChildren(panel);
    if (shell !== null) shell.settingsOverlaySignature = signature;
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
      createPanelLifecycle("session-wizard", () =>
        renderSessionWizardPanel(documentRef, state, text)
      )
    );
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
    void syncOverlay(persistentShell.root);
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
              reason: `Operator marked AI observation ${aiState}.`,
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
        case "toggle-panel-collapse": {
          const panelId = el.dataset["panelId"];
          const collapsed = el.dataset["collapsed"] === "true";
          if (panelId) requestRuntime.updatePanelLayout({ panelId, collapsed });
          break;
        }
        case "toggle-panel-pin": {
          const panelId = el.dataset["panelId"];
          const pinned = el.dataset["pinned"] === "true";
          if (panelId) requestRuntime.updatePanelLayout({ panelId, pinned });
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
        case "advance-wizard": {
          const step = el.dataset["step"];
          requestRuntime.advanceWizard(step ? { step } : undefined);
          break;
        }
        case "create-session":
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
      if (!(el instanceof HTMLInputElement)) return;
      if (el.dataset["repairAction"] === "timeline-scrub") {
        cancelSpatialFocusTween();
        requestRuntime.scrubTimeline({ positionMs: Number(el.value) });
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
          requestRuntime.setAiTargetSlot({ targetSlot: el.value });
        }
      }
    });
  }

  function jumpRelativeEvent(direction: -1 | 1): void {
    if (meta.events.length === 0) return;
    const currentIndex =
      state.workbench.focusedEventId === null
        ? -1
        : meta.events.findIndex((event) => event.id === state.workbench.focusedEventId);
    const nextIndex = Math.min(meta.events.length - 1, Math.max(0, currentIndex + direction));
    const event = meta.events[nextIndex];
    if (event !== undefined) {
      cancelSpatialFocusTween();
      requestRuntime.jumpToEvent({ eventId: event.id });
    }
  }

  function getKeyboardOverlayRefs() {
    return [
      ...meta.replay.overlayEvents.map((event) => ({ kind: "event" as const, id: event.id })),
      ...meta.replay.investigationRegions.map((region) => ({
        kind: "investigation-region" as const,
        id: region.regionId,
      })),
      ...meta.replay.temporarySpatialRegions.map((region) => ({
        kind: "temporary-spatial-region" as const,
        id: region.id,
      })),
      ...meta.replay.knowledgeRegions.map((region) => ({
        kind: "knowledge-region" as const,
        id: region.id,
      })),
      ...meta.replay.measurementRelationships.map((relationship) => ({
        kind: "measurement-relationship" as const,
        id: relationship.id,
      })),
    ];
  }

  function cycleOverlayEntity(direction: -1 | 1): void {
    const refs = getKeyboardOverlayRefs();
    if (refs.length === 0) return;
    const current =
      state.workbench.selection.inspectorEntityRef ??
      state.workbench.selection.selectedEntityRefs.at(-1) ??
      null;
    const currentIndex =
      current === null
        ? -1
        : refs.findIndex((ref) => ref.kind === current.kind && ref.id === current.id);
    const next = refs[(currentIndex + direction + refs.length) % refs.length];
    if (next !== undefined) {
      cancelSpatialFocusTween();
      requestRuntime.selectOverlayEntities({ refs: [next], mode: "replace", inspectorRef: next });
    }
  }

  function scrubTimelineTo(positionMs: number): void {
    cancelSpatialFocusTween();
    requestRuntime.scrubTimeline({ positionMs: Math.max(0, Math.round(positionMs)) });
  }

  // -- Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case "Tab":
        e.preventDefault();
        cycleOverlayEntity(e.shiftKey ? -1 : 1);
        break;
      case "Enter": {
        const ref =
          state.workbench.selection.inspectorEntityRef ??
          state.workbench.selection.selectedEntityRefs.at(-1) ??
          null;
        if (ref !== null) {
          e.preventDefault();
          cancelSpatialFocusTween();
          requestRuntime.focusOverlayEntity({ ref, focusJump: true });
        }
        break;
      }
      case "f":
      case "F":
        requestRuntime.updateFocus({ focusMode: !state.layout.focusMode });
        break;
      case "i":
      case "I":
        requestRuntime.toggleInvestigationMode({
          enabled: !state.workbench.investigationModeEnabled,
        });
        break;
      case " ":
        e.preventDefault();
        requestRuntime.toggleFreezeFrame();
        break;
      case "Escape":
        if (state.layout.settingsOverlayOpen) {
          requestRuntime.setSettingsOverlay({ open: false });
        } else if (state.layout.focusMode) {
          requestRuntime.updateFocus({ focusMode: false });
        }
        break;
      case "[":
        jumpRelativeEvent(-1);
        break;
      case "]":
        jumpRelativeEvent(1);
        break;
      case "Home":
        scrubTimelineTo(0);
        break;
      case "End":
        cancelSpatialFocusTween();
        requestRuntime.focusLiveEdge();
        break;
      case ",":
        scrubTimelineTo(state.workbench.timeline.playheadMs - 1000);
        break;
      case ".":
        scrubTimelineTo(state.workbench.timeline.playheadMs + 1000);
        break;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        const step = e.shiftKey ? 8 : 1;
        const delta =
          e.key === "ArrowLeft"
            ? { xPx: -step, yPx: 0 }
            : e.key === "ArrowRight"
              ? { xPx: step, yPx: 0 }
              : e.key === "ArrowUp"
                ? { xPx: 0, yPx: -step }
                : { xPx: 0, yPx: step };
        cancelSpatialFocusTween();
        requestRuntime.updateFocus({ nudgeDelta: delta, hardSnap: e.shiftKey });
        break;
      }
      case "r":
      case "R":
        requestRuntime.setActiveTool({ tool: "snapshot" });
        break;
      case "m":
      case "M":
        requestRuntime.setActiveTool({ tool: "measurement-pin" });
        break;
      case "a":
      case "A":
        requestRuntime.setActiveTool({ tool: "rect" });
        break;
      case "z":
      case "Z":
        requestRuntime.setActiveTool({ tool: "zoom-in" });
        break;
      case "x":
      case "X":
        requestRuntime.setActiveTool({ tool: "zoom-out" });
        break;
    }
  }

  function getChatComposerInput(): HTMLInputElement | null {
    return documentRef.querySelector<HTMLInputElement>("[data-repair-input='chat-composer']");
  }

  function mergeComposerDraft(currentDraft: string, transcriptText: string): string {
    const current = currentDraft.trim();
    const transcript = transcriptText.trim();
    if (current === "") return transcript;
    if (transcript === "") return current;
    return `${current} ${transcript}`;
  }

  function setChatComposerDraft(draft: string): void {
    state.chat.composerDraft = draft;
    const input = getChatComposerInput();
    if (input !== null) {
      input.value = draft;
    }
    requestRuntime.setChatComposer({ draft });
  }

  function handleTranscriptIngress(msg: { isFinal: boolean; text: string }): void {
    if (msg.isFinal !== true) return;
    const transcriptText = msg.text.trim();
    if (transcriptText === "") return;

    const input = getChatComposerInput();
    const currentDraft = input?.value ?? state.chat.composerDraft;
    const nextDraft = mergeComposerDraft(currentDraft, transcriptText);
    const shouldSend =
      state.layout.interactionSettings.dictationSubmitMode === "send" &&
      state.chat.pendingReplyId === null;

    if (shouldSend) {
      state.chat.composerDraft = "";
      if (input !== null) {
        input.value = "";
      }
      requestRuntime.setChatComposer({ draft: "" });
      requestRuntime.sendChatTurn({ text: nextDraft });
      return;
    }

    setChatComposerDraft(nextDraft);
  }

  // -- Host message handler
  function handleHostMessage(message: unknown): void {
    const msg = normalizeRepairHostMessage(message);
    if (msg === null) return;

    switch (msg.type) {
      case "repair-state": {
        Object.assign(state, msg.snapshot);
        meta.schemaVersion = msg.meta.schemaVersion;
        meta.generatedAt = msg.meta.generatedAt;
        meta.events = msg.meta.events;
        meta.replay = msg.meta.replay;
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
      case "transcript-ingress": {
        handleTranscriptIngress(msg);
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

    documentRef.addEventListener("keydown", handleKeydown);
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
