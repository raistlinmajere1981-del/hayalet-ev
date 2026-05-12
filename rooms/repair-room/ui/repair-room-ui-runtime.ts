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
      },
      cursor: null,
      visibleLayers: {
        grid: true,
        "ai-marks": true,
        annotations: true,
        "measurement-pins": true,
        focus: true,
      },
      hoveredEventId: null,
      focusedEventId: null,
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
    knowledgePack: { pack: null, attachedToSessionId: null, previewTabId: "schematic-preview" },
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
  const meta: RepairUiSnapshotMeta = { schemaVersion: 1, generatedAt: "", events: [] };
  const context: RepairUiContext = { roomId: REPAIR_ROOM_ID, locale: "en", translations: {} };
  const requestRuntime = createRepairUiRequestRuntime();
  const windowRef = window as unknown as RepairUiWindow;
  const documentRef = document;

  let lastSignature = "";
  let clockInterval: ReturnType<typeof setInterval> | null = null;
  let renderGeneration = 0;
  let overlayControllers: RepairOverlayController[] = [];

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

  // -- Signature for render dedup
  function buildSignature(): string {
    const timelineShape = state.workbench.timeline;
    const timelineLiveWindow = timelineShape.autoFollowLive
      ? Math.floor((timelineShape.playheadMs + 10000) / 10000)
      : 0;
    return JSON.stringify({
      p: state.phase,
      aid: state.sessions.activeId,
      sl: state.sessions.list.length,
      tool: state.workbench.activeTool,
      frozen: state.workbench.isFrozen,
      zoom: state.workbench.viewport.zoom,
      panX: state.workbench.viewport.panXPx,
      panY: state.workbench.viewport.panYPx,
      timelineShape: {
        zoom: timelineShape.zoom,
        rangeStartMs: timelineShape.rangeStartMs,
        rangeEndMs: timelineShape.rangeEndMs,
        autoFollowLive: timelineShape.autoFollowLive,
        liveWindow: timelineLiveWindow,
      },
      layers: state.workbench.visibleLayers,
      focusedEventId: state.workbench.focusedEventId,
      feed: state.tacticalFeed.length,
      wiz: state.wizard.currentStep,
      kp: state.knowledgePack.pack?.id ?? null,
      kpTab: state.knowledgePack.previewTabId,
      chatLen: state.chat.turns.length,
      chatPending: state.chat.pendingReplyId,
      instrument: state.measurement.activeInstrumentKind,
      focus: state.layout.focusMode,
      operatorProfileTabId: state.layout.operatorProfileTabId,
      collapsed: state.layout.collapsedPanels,
      pinned: state.layout.pinnedPanels,
      evtCount: meta.events.length,
    });
  }

  function formatOffset(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `+${minutes}:${seconds}`;
  }

  function updateTimelineLiveDom(): void {
    const timeline = documentRef.querySelector<HTMLElement>(".repair-timeline");
    if (timeline === null) return;
    const totalMs = Math.max(1000, Number(timeline.dataset["totalMs"] ?? "60000") || 60000);
    const playheadMs = Math.max(0, state.workbench.timeline.playheadMs);
    const clampedPlayheadMs = Math.min(totalMs, playheadMs);
    const readout = timeline.querySelector<HTMLElement>(".repair-timeline__readout");
    if (readout !== null) {
      readout.textContent = `${formatOffset(playheadMs)} / ${formatOffset(totalMs)}`;
    }
    const scrub = timeline.querySelector<HTMLInputElement>(".repair-timeline__scrub");
    if (scrub !== null && documentRef.activeElement !== scrub) {
      scrub.value = String(clampedPlayheadMs);
    }
    const playhead = timeline.querySelector<HTMLElement>(".repair-timeline__playhead");
    if (playhead !== null) {
      playhead.style.left = `${(clampedPlayheadMs / totalMs) * 100}%`;
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

  function updateMeasurementLiveDom(): void {
    const current = state.measurement.current;
    const value = documentRef.querySelector<HTMLElement>(".repair-measurement-display__value");
    if (value !== null) value.textContent = current.display;
    const unit = documentRef.querySelector<HTMLElement>(".repair-measurement-display__unit");
    if (unit !== null) unit.textContent = current.unit;
    const label = documentRef.querySelector<HTMLElement>(".repair-measurement-display__label");
    if (label !== null) label.textContent = current.label;
    const mode = documentRef.querySelector<HTMLElement>(".repair-measurement-display__mode");
    if (mode !== null) mode.textContent = `${current.mode.replace(/-/g, " ")} / ${current.range}`;

    const readingsList = documentRef.querySelector<HTMLElement>(".repair-readings-list");
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

  function updateSyncLiveDom(): void {
    documentRef.querySelectorAll<HTMLElement>(".repair-sync-row").forEach((row) => {
      const labelElement = row.querySelector<HTMLElement>(".repair-sync-row__label");
      const label = labelElement === null ? "" : labelElement.textContent.trim().toLowerCase();
      const value = row.querySelector<HTMLElement>(".repair-sync-row__value");
      if (value !== null && label === "playhead") {
        value.textContent = `+${Math.round(state.workbench.timeline.playheadMs / 1000)}s`;
      }
    });
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
      hud.replaceChildren();
      const labels = [`X ${point.xPx}`, `Y ${point.yPx}`, `GRID ${gridX}x${gridY}`];
      labels.forEach((labelText) => {
        const item = documentRef.createElement("span");
        item.textContent = labelText;
        hud.append(item);
      });
    }
  }

  function destroyOverlays(): void {
    overlayControllers.forEach((controller) => {
      controller.destroy();
    });
    overlayControllers = [];
  }

  async function mountOverlays(root: HTMLElement, generation: number): Promise<void> {
    const overlayHost = root.querySelector<HTMLElement>("[data-repair-overlay-stage='workbench']");
    const session = state.sessions.detail;
    if (overlayHost === null || session === null || session.pcbImage === null) return;
    const image = {
      ...session.pcbImage,
      src: resolveRepairAssetUrl(session.pcbImage.src) ?? session.pcbImage.src,
    };
    let controller: RepairOverlayController | null;
    try {
      controller = await mountRepairOverlayStage({
        container: overlayHost,
        events: meta.events,
        focusedEventId: state.workbench.focusedEventId,
        image,
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
        onEventClick: (eventId) => {
          requestRuntime.jumpToEvent({ eventId });
        },
        onViewportChange: (payload) => {
          requestRuntime.updateLayout({
            viewportZoom: payload.zoom,
            panXPx: payload.panXPx,
            panYPx: payload.panYPx,
          });
        },
      });
    } catch (error) {
      overlayHost.dataset["overlayError"] = "true";
      console.error("[repair-room] overlay mount failed", error);
      return;
    }
    if (controller === null) return;
    if (generation !== renderGeneration) {
      controller.destroy();
      return;
    }
    overlayControllers.push(controller);
  }

  // -- Render
  function render(): void {
    const sig = buildSignature();
    if (sig === lastSignature) return;
    lastSignature = sig;
    renderGeneration += 1;
    destroyOverlays();
    const generation = renderGeneration;

    const mount = documentRef.getElementById("app");
    if (mount === null) return;

    const shell = documentRef.createElement("div");
    shell.className = `repair-shell${state.layout.focusMode ? " repair-shell--focus-mode" : ""}`;

    // Status bar
    const statusBar = documentRef.createElement("div");
    statusBar.className = "repair-statusbar";

    const label = documentRef.createElement("span");
    label.className = "repair-statusbar__label";
    label.textContent = "Repair Room v0.1.0";
    statusBar.append(label);

    const clock = documentRef.createElement("span");
    clock.className = "repair-statusbar__clock";
    clock.textContent = state.ambient.nowIso
      ? new Date(state.ambient.nowIso).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "--:--:--";
    statusBar.append(clock);

    shell.append(statusBar);

    // Workspace grid
    const workspace = documentRef.createElement("div");
    workspace.className = "repair-workspace";

    // 1. Session Rail
    workspace.append(renderSessionRailPanel(documentRef, state, text));

    // 2. Workbench Stage
    workspace.append(renderWorkbenchStagePanel(documentRef, state, text));

    // 3. Tactical Feed
    workspace.append(renderTacticalFeedPanel(documentRef, state, text));

    // 4. Wizard + Knowledge Pack stack
    const rightStack = documentRef.createElement("div");
    rightStack.className = "repair-panel--wizard-pack-stack";
    rightStack.append(renderSessionWizardPanel(documentRef, state, text));
    rightStack.append(renderKnowledgePackPanel(documentRef, state, text));
    workspace.append(rightStack);

    // 5. Visual Timeline
    workspace.append(renderVisualTimelinePanel(documentRef, state, meta, text));

    // 6. Bottom Dock
    const dock = documentRef.createElement("div");
    dock.className = "repair-bottom-dock";
    dock.append(renderOperatorProfilePanel(documentRef, state, text));
    dock.append(renderChatPanel(documentRef, state, text));
    dock.append(renderMeasurementPanel(documentRef, state, text));
    dock.append(renderRoomSyncPanel(documentRef, state, meta, text));

    workspace.append(dock);
    shell.append(workspace);

    // Legend bar
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

    shell.append(legendBar);

    mount.replaceChildren(shell);
    bindActions(shell);
    void mountOverlays(shell, generation);
  }

  // -- Action binding
  function bindActions(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>("[data-repair-action='activate-session']").forEach((el) => {
      el.addEventListener("click", () => {
        const sessionId = el.dataset["sessionId"];
        if (sessionId) requestRuntime.activateSession({ sessionId });
      });
    });

    root.querySelectorAll<HTMLElement>("[data-repair-action='set-tool']").forEach((el) => {
      el.addEventListener("click", () => {
        const tool = el.dataset["tool"];
        if (tool) requestRuntime.setActiveTool({ tool });
      });
    });

    root
      .querySelectorAll<HTMLElement>("[data-repair-action='toggle-overlay-layer']")
      .forEach((el) => {
        el.addEventListener("click", () => {
          const layerId = el.dataset["layerId"];
          const visible = el.dataset["visible"] === "true";
          if (layerId) requestRuntime.toggleOverlayLayer({ layerId, visible });
        });
      });

    root.querySelectorAll<HTMLElement>("[data-repair-action='jump-to-event']").forEach((el) => {
      el.addEventListener("click", () => {
        const eventId = el.dataset["eventId"];
        if (eventId) requestRuntime.jumpToEvent({ eventId });
      });
    });

    root
      .querySelectorAll<HTMLElement>("[data-repair-action='attach-knowledge-pack']")
      .forEach((el) => {
        el.addEventListener("click", () => {
          const packId = el.dataset["packId"];
          if (packId) requestRuntime.attachKnowledgePack({ packId });
        });
      });

    root
      .querySelectorAll<HTMLElement>("[data-repair-action='knowledge-pack-tab']")
      .forEach((el) => {
        el.addEventListener("click", () => {
          const previewTabId = el.dataset["tabId"];
          if (previewTabId) requestRuntime.updateLayout({ previewTabId });
        });
      });

    root.querySelectorAll<HTMLElement>("[data-repair-action='set-instrument']").forEach((el) => {
      el.addEventListener("click", () => {
        const instrumentKind = el.dataset["instrumentKind"];
        if (instrumentKind) requestRuntime.updateLayout({ instrumentKind });
      });
    });

    root
      .querySelectorAll<HTMLElement>("[data-repair-action='operator-profile-tab']")
      .forEach((el) => {
        el.addEventListener("click", () => {
          const operatorProfileTabId = el.dataset["tabId"];
          if (operatorProfileTabId) requestRuntime.updateLayout({ operatorProfileTabId });
        });
      });

    root
      .querySelectorAll<HTMLElement>("[data-repair-action='toggle-panel-collapse']")
      .forEach((el) => {
        el.addEventListener("click", () => {
          const panelId = el.dataset["panelId"];
          const collapsed = el.dataset["collapsed"] === "true";
          if (panelId) requestRuntime.updateLayout({ panelId, collapsed });
        });
      });

    root.querySelectorAll<HTMLElement>("[data-repair-action='toggle-panel-pin']").forEach((el) => {
      el.addEventListener("click", () => {
        const panelId = el.dataset["panelId"];
        const pinned = el.dataset["pinned"] === "true";
        if (panelId) requestRuntime.updateLayout({ panelId, pinned });
      });
    });

    root.querySelectorAll<HTMLElement>("[data-repair-action='send-chat']").forEach((el) => {
      el.addEventListener("click", () => {
        const input = root.querySelector<HTMLInputElement>("[data-repair-input='chat-composer']");
        if (input && input.value.trim() !== "") {
          requestRuntime.sendChatTurn({ text: input.value.trim() });
          input.value = "";
        }
      });
    });

    root
      .querySelectorAll<HTMLElement>("[data-repair-action='send-feed-question']")
      .forEach((el) => {
        el.addEventListener("click", () => {
          const input = root.querySelector<HTMLInputElement>("[data-repair-input='feed-composer']");
          if (input && input.value.trim() !== "") {
            requestRuntime.sendChatTurn({ text: input.value.trim() });
            input.value = "";
          }
        });
      });

    root
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("[data-repair-action='wizard-field']")
      .forEach((el) => {
        el.addEventListener("change", () => {
          const field = el.dataset["wizardField"];
          if (field) requestRuntime.updateSession({ wizardField: field, value: el.value });
        });
      });

    root.querySelectorAll<HTMLElement>("[data-repair-action='wizard-symptom']").forEach((el) => {
      el.addEventListener("click", () => {
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
      });
    });

    root.querySelectorAll<HTMLElement>("[data-repair-action='advance-wizard']").forEach((el) => {
      el.addEventListener("click", () => {
        const step = el.dataset["step"];
        requestRuntime.advanceWizard(step ? { step } : undefined);
      });
    });

    root.querySelectorAll<HTMLElement>("[data-repair-action='create-session']").forEach((el) => {
      el.addEventListener("click", () => {
        requestRuntime.createSession();
      });
    });

    root
      .querySelectorAll<HTMLInputElement>("[data-repair-action='timeline-scrub']")
      .forEach((el) => {
        el.addEventListener("input", () => {
          requestRuntime.scrubTimeline({ positionMs: Number(el.value) });
        });
      });

    root.querySelectorAll<HTMLElement>("[data-repair-action='timeline-zoom']").forEach((el) => {
      el.addEventListener("click", () => {
        const direction = el.dataset["direction"] === "out" ? -1 : 1;
        requestRuntime.updateLayout({
          timelineZoom: Math.min(
            4,
            Math.max(0.25, state.workbench.timeline.zoom + direction * 0.25)
          ),
        });
      });
    });

    root.querySelectorAll<HTMLElement>("[data-repair-action='timeline-range']").forEach((el) => {
      el.addEventListener("click", () => {
        const playhead = state.workbench.timeline.playheadMs;
        requestRuntime.updateLayout({
          timelineRangeStartMs: Math.max(0, playhead - 15000),
          timelineRangeEndMs: playhead + 15000,
        });
      });
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
        requestRuntime.updateLayout({ focusMode: !state.layout.focusMode });
        break;
      case " ":
        e.preventDefault();
        requestRuntime.toggleFreezeFrame();
        break;
      case "Escape":
        if (state.layout.focusMode) {
          requestRuntime.updateLayout({ focusMode: false });
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
        render();
        applyLiveSnapshotUpdates();
        break;
      }
      case "repair-feed-event": {
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
        clock.textContent = new Date(state.ambient.nowIso).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
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
