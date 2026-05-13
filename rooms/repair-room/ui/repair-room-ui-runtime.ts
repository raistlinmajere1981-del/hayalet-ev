import type { RepairEvent, RepairPanelId } from "../shared/types/index.js";
import type { RepairUiState, RepairUiSnapshotMeta } from "../shared/ui/state.js";
import { normalizeRepairHostMessage } from "../shared/ui/host-messages.js";
import { REPAIR_ROOM_ID, REPAIR_UI_COLORS } from "../shared/repair-constants.js";
import { createRepairUiRequestRuntime } from "../shared/ui/request-runtime.js";

import { renderSessionRailPanel } from "./panels/session-rail-panel.js";
import { renderWorkbenchStagePanel } from "./panels/workbench-stage-panel.js";
import { renderTacticalFeedPanel } from "./panels/tactical-feed-panel.js";
import { renderSessionWizardPanel } from "./panels/session-wizard-panel.js";
import { renderKnowledgePackPanel } from "./panels/knowledge-pack-panel.js";
import { renderVisualTimelinePanel } from "./panels/visual-timeline-panel.js";
import { renderOperatorProfilePanel } from "./panels/operator-profile-panel.js";
import { renderChatPanel } from "./panels/chat-panel.js";
import { renderMeasurementPanel } from "./panels/measurement-panel.js";
import { renderRoomSyncPanel } from "./panels/room-sync-panel.js";
import { mountRepairOverlayStage, type RepairOverlayController } from "./overlay/overlay-stage.js";
import { resolveRepairAssetUrl } from "./repair-asset-url.js";

interface RepairUiWindow {
  roomAPI?: {
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
type RepairMutableStyleProperty = "left" | "width" | "transform" | "transformOrigin";

const AI_LIFECYCLE_ACTIONS = [
  ["acknowledged", "ACK"],
  ["investigating", "INV"],
  ["resolved", "RES"],
  ["dismissed", "DIS"],
] as const;

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
  panelElements: Map<RepairPanelId, HTMLElement>;
  panelSignatures: Map<RepairPanelId, string>;
}

function createInitialState(): RepairUiState {
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
        selectedEventIds: [],
        inspectorEventId: null,
        focusJumpEventId: null,
      },
      contextualCursor: "inspect",
      operationalMode: "live",
      aiMarks: [],
      measurementEvidence: [],
      focusMode: false,
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
        chat: false,
        measurement: false,
        "room-sync": true,
      },
      operatorProfileTabId: "tools",
      focusMode: false,
      ambientClock: "",
    },
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
      visibleEvents: [],
      overlayEvents: [],
      tacticalFeed: [],
      measurementEvidence: [],
      aiMarkEventIds: [],
      activeSnapshotEventId: null,
      activeFreezeFrameEventId: null,
      focusSuggestionEventId: null,
      knowledgeRegions: [],
      operationalMode: "live",
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
          layoutShape,
        });
      case "tactical-feed":
        return JSON.stringify({
          feed: state.tacticalFeed.map((item) => [
            item.eventId,
            item.occurredAt,
            item.relativeLabel,
            item.severity,
            item.badge,
            item.body,
          ]),
          focusedEventId: state.workbench.focusedEventId,
          layoutShape,
        });
      case "session-wizard":
        return JSON.stringify({ wizard: state.wizard, layoutShape });
      case "knowledge-pack":
        return JSON.stringify({ knowledgePack: state.knowledgePack, layoutShape });
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
          layoutShape,
        });
      case "operator-profile":
        return JSON.stringify({
          profile: state.operatorProfile,
          operatorProfileTabId: state.layout.operatorProfileTabId,
          layoutShape,
        });
      case "chat":
        return JSON.stringify({ chat: state.chat, layoutShape });
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
          layoutShape,
        });
      case "room-sync":
        return JSON.stringify({
          phase: state.phase,
          activeId: state.sessions.activeId,
          focusedEventId: state.workbench.focusedEventId,
          timelineShape: {
            liveWindow: timelineLiveWindow,
          },
          events: meta.events.length,
          latestEventId: meta.events.at(-1)?.id ?? null,
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
      knowledgeRegions: config.knowledgeRegions,
      workbench: {
        activeTool: config.workbench.activeTool,
        viewport: config.workbench.viewport,
        contextualCursor: config.workbench.contextualCursor,
        hoveredEventId: config.workbench.selection.hoveredEventId,
        selectedEventIds: config.workbench.selection.selectedEventIds,
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
    return {
      container: overlayHost,
      events: meta.replay.overlayEvents,
      focusedEventId: state.workbench.focusedEventId ?? meta.replay.focusSuggestionEventId,
      image,
      knowledgeRegions: meta.replay.knowledgeRegions,
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
      onEventClick: (eventId, interaction) => {
        const nextSelectedEventIds = interaction.additive
          ? state.workbench.selection.selectedEventIds.includes(eventId)
            ? state.workbench.selection.selectedEventIds.filter(
                (selectedId) => selectedId !== eventId
              )
            : [...state.workbench.selection.selectedEventIds, eventId]
          : [eventId];
        const nextInspectorEventId = nextSelectedEventIds.includes(eventId)
          ? eventId
          : (nextSelectedEventIds.at(-1) ?? null);
        state.workbench.selection.selectedEventIds = nextSelectedEventIds;
        state.workbench.selection.inspectorEventId = nextInspectorEventId;
        state.workbench.focusedEventId = nextInspectorEventId;
        requestRuntime.updateFocus({
          eventId,
          selectionMode: interaction.additive ? "toggle" : "replace",
          focusJump: interaction.focusJump,
          jumpToEvent: interaction.focusJump && interaction.additive === false,
        });
      },
      onEventHover: (eventId) => {
        state.workbench.selection.hoveredEventId = eventId;
        requestRuntime.updateFocus({ hoveredEventId: eventId });
      },
      onSelectionClear: () => {
        state.workbench.focusedEventId = null;
        state.workbench.selection.selectedEventIds = [];
        state.workbench.selection.inspectorEventId = null;
        state.workbench.selection.focusJumpEventId = null;
        requestRuntime.updateFocus({ clearSelection: true });
      },
      onViewportChange: (payload) => {
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

  function updatePanelChrome(panel: HTMLElement, panelId: RepairPanelId): void {
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

    const session = state.sessions.detail;
    const rows: Array<[string, string]> = [
      [text(["sync", "storage"], "Storage"), "In-memory mock"],
      [text(["sync", "registry"], "Room Sync"), "Workspace build ready"],
      [text(["sync", "events"], "Events"), `${meta.events.length} records`],
      [text(["sync", "session"], "Session"), session?.title ?? "No active session"],
      [
        text(["sync", "playhead"], "Playhead"),
        `+${Math.round(state.workbench.timeline.playheadMs / 1000)}s`,
      ],
    ];

    const rowElements = Array.from(panel.querySelectorAll<HTMLElement>(".repair-sync-row"));
    rows.forEach(([label, value], index) => {
      const row = rowElements[index];
      if (row === undefined) return;
      const labelEl = row.querySelector<HTMLElement>(".repair-sync-row__label");
      if (labelEl !== null) setTextIfChanged(labelEl, label);
      const valueEl = row.querySelector<HTMLElement>(".repair-sync-row__value");
      if (valueEl !== null) setTextIfChanged(valueEl, value);
    });

    const focused = getSyncFocusedEvent();
    const title = panel.querySelector<HTMLElement>(".repair-sync-focus__title");
    if (title !== null)
      setTextIfChanged(title, focused === null ? "Live edge" : focused.kind.toUpperCase());
    const detail = panel.querySelector<HTMLElement>(".repair-sync-focus__detail");
    if (detail !== null) setTextIfChanged(detail, getSyncFocusedDetail(focused));
    const focusCard = panel.querySelector<HTMLElement>(".repair-sync-focus");
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
      return;
    }

    const updated = lifecycle.update(current);
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

    const clock = documentRef.createElement("span");
    clock.className = "repair-statusbar__clock";
    clock.textContent = "--:--:--";
    statusBar.append(clock);
    root.append(statusBar);

    const workspace = documentRef.createElement("div");
    workspace.className = "repair-workspace";
    const rightStack = documentRef.createElement("div");
    rightStack.className = "repair-panel--wizard-pack-stack";
    const dock = documentRef.createElement("div");
    dock.className = "repair-bottom-dock";
    root.append(workspace, createLegendBar());

    shell = {
      root,
      clock,
      workspace,
      rightStack,
      dock,
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
    setClassNameIfChanged(
      persistentShell.root,
      `repair-shell${state.layout.focusMode ? " repair-shell--focus-mode" : ""}`
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

    if (!persistentShell.workspace.contains(persistentShell.dock)) {
      persistentShell.workspace.append(persistentShell.dock);
    }
    syncPanel(
      persistentShell,
      persistentShell.dock,
      createPanelLifecycle("operator-profile", () =>
        renderOperatorProfilePanel(documentRef, state, text)
      )
    );
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
      switch (action) {
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
        case "toggle-overlay-layer": {
          const layerId = el.dataset["layerId"];
          const visible = el.dataset["visible"] === "true";
          if (layerId) requestRuntime.toggleOverlayLayer({ layerId, visible });
          break;
        }
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
          if (spatialRefId) requestRuntime.updatePanelTab({ spatialRefId });
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
          requestRuntime.updateTimeline({ replayAction: "live" });
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
        requestRuntime.scrubTimeline({ positionMs: Number(el.value) });
      }
    });

    root.addEventListener("change", (event) => {
      const el = findActionElement(event.target);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (el.dataset["repairAction"] === "wizard-field") {
        const field = el.dataset["wizardField"];
        if (field) requestRuntime.updateSession({ wizardField: field, value: el.value });
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
      requestRuntime.jumpToEvent({ eventId: event.id });
    }
  }

  function getTimelineLiveEdgeMs(): number {
    const session = state.sessions.detail;
    if (session === null) return 0;
    const sessionStart = Date.parse(session.startedAt);
    const eventEdge = meta.events.reduce(
      (edge, event) => Math.max(edge, Date.parse(event.occurredAt) - sessionStart),
      0
    );
    return Math.max(
      0,
      eventEdge,
      state.ambient.sessionDurationMs,
      state.workbench.timeline.playheadMs
    );
  }

  function scrubTimelineTo(positionMs: number): void {
    requestRuntime.scrubTimeline({ positionMs: Math.max(0, Math.round(positionMs)) });
  }

  // -- Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case "f":
      case "F":
        requestRuntime.updateFocus({ focusMode: !state.layout.focusMode });
        break;
      case " ":
        e.preventDefault();
        requestRuntime.toggleFreezeFrame();
        break;
      case "Escape":
        if (state.layout.focusMode) {
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
        scrubTimelineTo(getTimelineLiveEdgeMs());
        break;
      case ",":
        scrubTimelineTo(state.workbench.timeline.playheadMs - 1000);
        break;
      case ".":
        scrubTimelineTo(state.workbench.timeline.playheadMs + 1000);
        break;
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
