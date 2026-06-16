import type { RepairEvent } from "../../shared/types/index.js";
import type { RepairUiState } from "../../shared/ui/state.js";
import { REPAIR_OVERLAY_TOOLS } from "../overlay/overlay-tools.js";
import { resolveRepairAssetUrl } from "../repair-asset-url.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

function getFocusedForensicEvent(state: RepairUiState): RepairEvent | null {
  const focusedId = state.workbench.selection.inspectorEventId ?? state.workbench.focusedEventId;
  if (focusedId === null) return null;
  return state.sessions.detail?.events.find((event) => event.id === focusedId) ?? null;
}

function getForensicEventDetail(event: RepairEvent): string {
  switch (event.kind) {
    case "annotation":
      return event.meta?.label ?? event.label;
    case "measurement":
      return `${event.reference ?? event.channel} ${event.rawDisplay}${event.unit}`;
    case "ai-mark":
      return event.rationale;
    case "risk-flag":
      return event.message;
    case "snapshot":
      return event.caption;
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

function getForensicEventMeta(event: RepairEvent): string {
  const time = new Date(event.occurredAt).toLocaleTimeString("en-GB");
  if (event.kind === "annotation") {
    return `${time} • ${(event.meta?.author ?? event.source).toUpperCase()} • ${(
      event.meta?.tool ?? event.tool
    ).toUpperCase()}`;
  }
  if (event.kind === "ai-mark") {
    return `${time} • AI • ${(event.lifecycleState ?? "detected").toUpperCase()}`;
  }
  if (event.kind === "measurement") {
    const group =
      event.group?.rail ?? event.group?.component ?? event.group?.powerDomain ?? "ungrouped";
    return `${time} • ${group.toUpperCase()}`;
  }
  if (event.kind === "investigation-region-created") {
    return `${time} • ${event.status.toUpperCase()} • ${event.regionId}`;
  }
  if (event.kind === "investigation-region-updated") {
    return `${time} • ${(event.status ?? "updated").toUpperCase()} • ${event.regionId}`;
  }
  return `${time} • ${event.linkedEventIds.length} linked events`;
}

function getForensicLinkedText(state: RepairUiState, event: RepairEvent): string {
  const brief = (eventId: string): string => {
    const linked = state.sessions.detail?.events.find((candidate) => candidate.id === eventId);
    if (linked === undefined) return eventId;
    return `${linked.kind.toUpperCase()} ${new Date(linked.occurredAt).toLocaleTimeString("en-GB")}`;
  };
  const measurementIds =
    event.kind === "annotation"
      ? (event.meta?.linkedMeasurementIds ?? [])
      : event.kind === "ai-mark" || event.kind === "risk-flag"
        ? (event.linkedMeasurementIds ?? [])
        : event.kind === "measurement"
          ? (event.linkedAnnotationIds ?? [])
          : [];
  const aiIds =
    event.kind === "annotation"
      ? (event.meta?.linkedEventIds ?? []).filter((eventId) => {
          const linked = state.sessions.detail?.events.find(
            (candidate) => candidate.id === eventId
          );
          return linked?.kind === "ai-mark" || linked?.kind === "risk-flag";
        })
      : event.kind === "measurement"
        ? (event.linkedAiMarkIds ?? [])
        : event.linkedEventIds;
  const parts = [
    measurementIds.length > 0 ? `MEASURE ${measurementIds.map(brief).join(", ")}` : null,
    aiIds.length > 0 ? `AI ${aiIds.map(brief).join(", ")}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" • ") : "No linked forensic records";
}

function getGuidanceMetaText(state: RepairUiState): string {
  const unresolved = state.guidance.unresolvedCriticalItems;
  const pending = state.guidance.pendingMeasurements.length;
  const parts = [
    state.guidance.rhythm.progressLabel.toUpperCase(),
    unresolved > 0 ? `${unresolved} critical` : "calm",
    pending > 0 ? `${pending} pending` : "no pending measurement",
    state.guidance.focusCorridor.active ? "focus corridor" : "full board",
  ];
  return parts.join(" / ");
}

function getCapabilityState(
  active: boolean,
  ready: boolean
): "active" | "ready" | "idle" | "unavailable" {
  if (active) return "active";
  if (ready) return "ready";
  return "idle";
}

function getRouteLabel(route: "local" | "android"): string {
  return route === "android" ? "Android" : "Local";
}

function getAssistanceProfileLabel(maxAiInterruptions: number): string {
  if (maxAiInterruptions <= 1) return "Quiet";
  if (maxAiInterruptions === 2) return "Balanced";
  return "Proactive";
}

function getCameraSourceLabel(state: RepairUiState): string {
  const sourceType = state.workbench.liveSource.sourceType;
  if (sourceType === "android-camera") return "Android camera";
  if (sourceType === "snapshot") return "Snapshot";
  if (sourceType === "image") return "Board image";
  return state.layout.interactionSettings.cameraFeedPreference === "android-feed"
    ? "Android camera"
    : "Manual image";
}

function getViewportMode(state: RepairUiState): "live" | "replay" | "freeze" | "investigation" {
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

function getRepairCommandHints(state: RepairUiState): string {
  const hints = state.workbench.isFrozen
    ? ["resume live", "read this again", "save note"]
    : ["freeze camera", "repeat guidance", "record measurement"];
  if (state.guidance.unresolvedCriticalItems > 0) hints.unshift("show risks");
  return hints.slice(0, 3).join(" / ");
}

function appendCopilotCell(
  documentRef: Document,
  parent: HTMLElement,
  className: string,
  label: string,
  value: string
): void {
  const cell = documentRef.createElement("span");
  cell.className = className;

  const labelEl = documentRef.createElement("span");
  labelEl.className = "repair-guidance-strip__label";
  labelEl.textContent = label;
  cell.append(labelEl);

  const valueEl = documentRef.createElement("span");
  valueEl.className = "repair-guidance-strip__value";
  valueEl.textContent = value;
  cell.append(valueEl);

  parent.append(cell);
}

function appendCapabilityCell(
  documentRef: Document,
  parent: HTMLElement,
  label: string,
  value: string,
  state: "active" | "ready" | "idle" | "unavailable"
): void {
  const cell = documentRef.createElement("div");
  cell.className = "repair-capability";
  cell.dataset["state"] = state;

  const labelEl = documentRef.createElement("span");
  labelEl.className = "repair-capability__label";
  labelEl.textContent = label;
  cell.append(labelEl);

  const valueEl = documentRef.createElement("span");
  valueEl.className = "repair-capability__value";
  valueEl.textContent = value;
  cell.append(valueEl);

  parent.append(cell);
}

function getCameraHealthState(
  state: RepairUiState,
  cameraActive: boolean
): "live" | "ready" | "manual" | "unavailable" {
  if (!state.operationsAvailable) return "unavailable";
  if (cameraActive) return "live";
  if (state.workbench.liveSource.connected || state.workbench.liveSource.available) return "ready";
  return "manual";
}

function getCameraHealthText(
  state: RepairUiState,
  cameraActive: boolean,
  cameraSource: string
): { status: string; detail: string; action: string } {
  if (!state.operationsAvailable) {
    return {
      status: "Camera not connected",
      detail: "Capture runtime has not reported a live camera source.",
      action: "Open repair controls and check companion access.",
    };
  }
  if (cameraActive) {
    return {
      status: `${cameraSource} live`,
      detail: "Keep the board centered and avoid glare.",
      action: "Say freeze camera before probing a tight area.",
    };
  }
  if (state.workbench.liveSource.connected) {
    return {
      status: `${cameraSource} connected`,
      detail: "Feed is connected but not marked live.",
      action: "Start the camera feed or use the current board image.",
    };
  }
  if (state.workbench.liveSource.available) {
    return {
      status: `${cameraSource} ready`,
      detail: "Live source is available for this session.",
      action: "Start camera feed, then align board edges.",
    };
  }
  return {
    status: "Manual board image",
    detail: "No live companion frame is connected.",
    action: "Use Android camera for hands-free visual guidance.",
  };
}

function appendCameraStatusChip(
  documentRef: Document,
  parent: HTMLElement,
  state: RepairUiState,
  cameraActive: boolean,
  cameraSource: string
): void {
  const health = getCameraHealthText(state, cameraActive, cameraSource);
  const chip = documentRef.createElement("span");
  chip.className = "repair-camera-status-chip";
  chip.dataset["state"] = getCameraHealthState(state, cameraActive);
  chip.dataset["repairCameraStatus"] = "true";
  chip.textContent = health.status;
  chip.title = `${health.detail} ${health.action}`;
  parent.append(chip);
}

export function renderWorkbenchStagePanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";
  body.style.padding = "0";
  body.style.display = "flex";
  body.style.flexDirection = "column";

  // -- Live stream header
  const liveHeader = documentRef.createElement("div");
  liveHeader.className = "repair-workbench-header";

  const headerLeft = documentRef.createElement("div");
  headerLeft.className = "repair-workbench-header__left";

  const liveChip = documentRef.createElement("span");
  if (state.workbench.isFrozen) {
    liveChip.className = "repair-live-chip repair-live-chip--frozen";
    const frozenTime = state.workbench.frozenAt
      ? new Date(state.workbench.frozenAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "--:--:--";
    liveChip.textContent = `FROZEN — ${frozenTime}`;
  } else {
    liveChip.className = "repair-live-chip";
    liveChip.textContent = "LIVE";
  }
  headerLeft.append(liveChip);

  const info = documentRef.createElement("span");
  info.className = "repair-workbench-header__info";
  info.textContent = `${state.workbench.viewport.zoom.toFixed(1)}x`;
  headerLeft.append(info);

  liveHeader.append(headerLeft);
  const guidanceControls = documentRef.createElement("div");
  guidanceControls.className = "repair-guidance-controls";

  const handsFreeButton = documentRef.createElement("button");
  handsFreeButton.type = "button";
  const voiceListening = state.layout.voiceGuidance.ambientListeningState === "listening";
  const ambientActive = state.operationsAvailable && state.operations.ambientActive;
  const dictationActive =
    state.operationsAvailable &&
    (state.operations.localMicActive || state.operations.androidMicActive) &&
    !state.operations.ambientActive;
  const cameraActive =
    state.operationsAvailable && (state.operations.cameraActive || state.operations.liveFeedActive);
  const ttsActive = state.operationsAvailable && state.operations.ttsActive;
  const dictationRoute = getRouteLabel(state.layout.interactionSettings.dictationRoute);
  const ttsRoute = getRouteLabel(state.layout.interactionSettings.ttsRoute);
  const cameraSource = getCameraSourceLabel(state);
  const handsFreeEnabled =
    state.layout.voiceGuidance.handsBusyMode && (voiceListening || ambientActive);
  handsFreeButton.className = `repair-guidance-control repair-guidance-control--wide${
    handsFreeEnabled ? " repair-guidance-control--active" : ""
  }`;
  handsFreeButton.textContent = handsFreeEnabled ? "Guiding" : "Guide me";
  handsFreeButton.title = handsFreeEnabled
    ? "Disable hands-free repair guidance"
    : "Enable ambient listening and step-by-step repair guidance";
  handsFreeButton.dataset["repairAction"] = "set-hands-free-mode";
  handsFreeButton.dataset["repairControl"] = "hands-free";
  handsFreeButton.dataset["enabled"] = String(!handsFreeEnabled);
  guidanceControls.append(handsFreeButton);

  const ambientButton = documentRef.createElement("button");
  ambientButton.type = "button";
  ambientButton.className = `repair-guidance-control${ambientActive ? " repair-guidance-control--active" : ""}`;
  ambientButton.textContent = ambientActive ? "Listening" : "Listen";
  ambientButton.title = ambientActive
    ? "Stop listening for repair commands"
    : "Listen for repair commands";
  ambientButton.dataset["repairAction"] = "toggle-ambient-listener";
  ambientButton.dataset["repairControl"] = "ambient";
  ambientButton.dataset["active"] = String(ambientActive);
  guidanceControls.append(ambientButton);

  const dictationButton = documentRef.createElement("button");
  dictationButton.type = "button";
  dictationButton.className = `repair-guidance-control${dictationActive ? " repair-guidance-control--active" : ""}`;
  dictationButton.textContent = dictationActive ? "Recording" : "Speak";
  dictationButton.title = dictationActive
    ? "Stop voice note recording"
    : `Speak a note or question using the ${dictationRoute} microphone`;
  dictationButton.dataset["repairAction"] = "toggle-dictation";
  dictationButton.dataset["repairControl"] = "dictation-route";
  dictationButton.dataset["active"] = String(dictationActive);
  guidanceControls.append(dictationButton);

  const cameraButton = documentRef.createElement("button");
  cameraButton.type = "button";
  cameraButton.className = `repair-guidance-control${cameraActive ? " repair-guidance-control--active" : ""}`;
  cameraButton.textContent = cameraActive ? "Camera live" : "Camera";
  cameraButton.title = cameraActive ? "Stop the camera feed" : "Start the camera feed";
  cameraButton.dataset["repairAction"] = "toggle-camera-feed";
  cameraButton.dataset["repairControl"] = "camera-feed";
  cameraButton.dataset["active"] = String(cameraActive);
  guidanceControls.append(cameraButton);
  appendCameraStatusChip(documentRef, guidanceControls, state, cameraActive, cameraSource);

  const ttsButton = documentRef.createElement("button");
  ttsButton.type = "button";
  ttsButton.className = `repair-guidance-control${ttsActive ? " repair-guidance-control--active" : ""}`;
  ttsButton.textContent = ttsActive ? "Reading" : "Read";
  ttsButton.title = ttsActive
    ? "Stop spoken guidance"
    : `Read current guidance aloud on ${ttsRoute}`;
  ttsButton.dataset["repairAction"] = "toggle-tts";
  ttsButton.dataset["repairControl"] = "tts-route";
  ttsButton.dataset["active"] = String(ttsActive);
  guidanceControls.append(ttsButton);

  const budgetButton = documentRef.createElement("button");
  budgetButton.type = "button";
  const currentMax = state.guidance.aiInterruption.attentionBudget.maxAiInterruptions;
  const nextMax = currentMax >= 3 ? 1 : currentMax + 1;
  budgetButton.className = "repair-guidance-control";
  budgetButton.textContent = getAssistanceProfileLabel(currentMax);
  budgetButton.title = `Cycle assistance profile (${state.guidance.aiInterruption.attentionBudget.remainingAiInterruptions}/${currentMax} interruptions left)`;
  budgetButton.dataset["repairAction"] = "set-attention-budget";
  budgetButton.dataset["maxAiInterruptions"] = String(nextMax);
  budgetButton.dataset["windowMs"] = String(state.guidance.aiInterruption.attentionBudget.windowMs);
  guidanceControls.append(budgetButton);

  liveHeader.append(guidanceControls);
  body.append(liveHeader);

  const capabilityStrip = documentRef.createElement("div");
  capabilityStrip.className = "repair-capability-strip";
  appendCapabilityCell(
    documentRef,
    capabilityStrip,
    "Ambient",
    state.operationsAvailable
      ? ambientActive
        ? "Listening for commands"
        : state.layout.voiceGuidance.ambientListeningState === "muted"
          ? "Muted"
          : voiceListening
            ? "Armed"
            : "Idle"
      : "Unavailable",
    state.operationsAvailable ? getCapabilityState(ambientActive, voiceListening) : "unavailable"
  );
  appendCapabilityCell(
    documentRef,
    capabilityStrip,
    "Dictate",
    state.operationsAvailable
      ? dictationActive
        ? `${dictationRoute} recording`
        : state.operations.ambientActive
          ? "Ambient owns mic"
          : `${dictationRoute} standby`
      : "Unavailable",
    state.operationsAvailable
      ? getCapabilityState(
          dictationActive,
          state.layout.voiceGuidance.ambientListeningState !== "muted"
        )
      : "unavailable"
  );
  appendCapabilityCell(
    documentRef,
    capabilityStrip,
    "Camera",
    state.operationsAvailable
      ? cameraActive
        ? `${cameraSource} live`
        : state.workbench.liveSource.connected
          ? `${cameraSource} connected`
          : state.workbench.liveSource.available
            ? `${cameraSource} ready`
            : "Manual board image"
      : "Unavailable",
    state.operationsAvailable
      ? getCapabilityState(cameraActive, state.workbench.liveSource.available)
      : "unavailable"
  );
  appendCapabilityCell(
    documentRef,
    capabilityStrip,
    "TTS",
    state.operationsAvailable
      ? ttsActive
        ? `${ttsRoute} speaking`
        : state.layout.voiceGuidance.spokenGuidanceMode === "silent"
          ? "Silent"
          : `${ttsRoute} ready`
      : "Unavailable",
    state.operationsAvailable
      ? getCapabilityState(ttsActive, state.layout.voiceGuidance.spokenGuidanceMode !== "silent")
      : "unavailable"
  );
  body.append(capabilityStrip);

  const guidance = documentRef.createElement("div");
  guidance.className = "repair-guidance-strip";
  guidance.dataset["confidence"] = state.guidance.nextBestAction.confidence;
  guidance.dataset["urgency"] = state.guidance.nextBestAction.urgency;

  appendCopilotCell(
    documentRef,
    guidance,
    "repair-guidance-strip__phase",
    "AI",
    state.guidance.aiInterruption.toneLine
  );
  appendCopilotCell(
    documentRef,
    guidance,
    "repair-guidance-strip__action",
    "Next",
    state.guidance.nextBestAction.text
  );
  appendCopilotCell(
    documentRef,
    guidance,
    "repair-guidance-strip__recovery",
    "Say",
    getRepairCommandHints(state)
  );
  appendCopilotCell(
    documentRef,
    guidance,
    "repair-guidance-strip__meta",
    "Risk",
    getGuidanceMetaText(state)
  );

  body.append(guidance);

  // -- Viewport
  const viewport = documentRef.createElement("div");
  viewport.className = `repair-viewport${state.workbench.isFrozen ? " repair-viewport--frozen" : ""}`;
  viewport.dataset["mode"] = getViewportMode(state);
  viewport.dataset["cursor"] = state.workbench.contextualCursor;
  viewport.dataset["liveSource"] = state.workbench.liveSource.sourceType ?? "image";

  const session = state.sessions.detail;
  const livePreview = state.workbench.liveSource.preview;
  const liveStreamUrl =
    livePreview?.source === "mjpeg-stream" &&
    livePreview.streamUrl !== null &&
    livePreview.streamUrl !== undefined
      ? livePreview.streamUrl.trim()
      : "";

  if (liveStreamUrl !== "") {
    const liveFrame = documentRef.createElement("img");
    liveFrame.className = "repair-viewport__live-frame";
    liveFrame.src = liveStreamUrl;
    liveFrame.alt = livePreview?.label ?? "Android camera live feed";
    liveFrame.draggable = false;
    viewport.append(liveFrame);
  } else if (session !== null && session.pcbImage !== null) {
    const img = documentRef.createElement("img");
    img.className = "repair-viewport__image";
    img.src = resolveRepairAssetUrl(session.pcbImage.src) ?? session.pcbImage.src;
    img.alt = session.pcbImage.label;
    img.draggable = false;
    img.style.transform = `translate(${state.workbench.viewport.panXPx}px, ${state.workbench.viewport.panYPx}px) scale(${state.workbench.viewport.zoom})`;
    img.style.transformOrigin = "top left";
    viewport.append(img);
  } else {
    const placeholder = documentRef.createElement("div");
    placeholder.className = "repair-empty-state";
    const placeholderTitle = documentRef.createElement("div");
    placeholderTitle.className = "repair-empty-state__title";
    placeholderTitle.textContent = text(["workbench", "noImage"], "Board image required");
    placeholder.append(placeholderTitle);

    const placeholderCopy = documentRef.createElement("div");
    placeholderCopy.className = "repair-empty-state__copy";
    placeholderCopy.textContent = text(
      ["workbench", "noImageHelp"],
      "Start the Android camera or attach a board image to unlock overlays, measurements, and guided repair steps."
    );
    placeholder.append(placeholderCopy);

    const placeholderSteps = documentRef.createElement("div");
    placeholderSteps.className = "repair-empty-state__steps";
    ["Start camera", "Frame board", "Freeze when ready"].forEach((step) => {
      const item = documentRef.createElement("span");
      item.textContent = step;
      placeholderSteps.append(item);
    });
    placeholder.append(placeholderSteps);
    viewport.append(placeholder);
  }

  const overlayHost = documentRef.createElement("div");
  overlayHost.className = "repair-overlay-stage";
  overlayHost.dataset["repairOverlayStage"] = "workbench";
  viewport.append(overlayHost);

  // -- Coordinate HUD
  const hud = documentRef.createElement("div");
  hud.className = "repair-coord-hud";

  const cursor = state.workbench.cursor;
  const xLabel = cursor !== null ? cursor.xPx.toString() : "—";
  const yLabel = cursor !== null ? cursor.yPx.toString() : "—";
  const gridLabel = cursor !== null ? `${cursor.gridX}x${cursor.gridY}` : "—";
  hud.innerHTML = `<span>X ${xLabel}</span><span>Y ${yLabel}</span><span>GRID ${gridLabel}</span>`;
  viewport.append(hud);

  const inspectorEvent = getFocusedForensicEvent(state);
  if (inspectorEvent !== null) {
    const inspector = documentRef.createElement("div");
    inspector.className = "repair-annotation-inspector";
    inspector.dataset["eventId"] = inspectorEvent.id;

    const title = documentRef.createElement("div");
    title.className = "repair-annotation-inspector__title";
    title.textContent = inspectorEvent.kind.toUpperCase();
    inspector.append(title);

    const detail = documentRef.createElement("div");
    detail.className = "repair-annotation-inspector__detail";
    detail.textContent = getForensicEventDetail(inspectorEvent);
    inspector.append(detail);

    const meta = documentRef.createElement("div");
    meta.className = "repair-annotation-inspector__meta";
    meta.textContent = getForensicEventMeta(inspectorEvent);
    inspector.append(meta);

    const links = documentRef.createElement("div");
    links.className = "repair-annotation-inspector__links";
    links.textContent = getForensicLinkedText(state, inspectorEvent);
    inspector.append(links);

    const selection = documentRef.createElement("div");
    selection.className = "repair-annotation-inspector__selection";
    selection.textContent = `${state.workbench.selection.selectedEventIds.length} selected`;
    inspector.append(selection);
    viewport.append(inspector);
  }

  body.append(viewport);

  // -- Toolbar
  const toolbar = documentRef.createElement("div");
  toolbar.className = "repair-toolbar";

  for (const tool of REPAIR_OVERLAY_TOOLS) {
    const btn = documentRef.createElement("button");
    btn.className = `repair-toolbar__btn repair-toolbar__btn--text${state.workbench.activeTool === tool.id ? " repair-toolbar__btn--active" : ""}`;
    btn.textContent = tool.label;
    btn.title = tool.title;
    btn.dataset["repairAction"] = "set-tool";
    btn.dataset["tool"] = tool.id;
    toolbar.append(btn);

    if (tool.id === "zoom-out" || tool.id === "arrow") {
      const sep = documentRef.createElement("span");
      sep.className = "repair-toolbar__sep";
      toolbar.append(sep);
    }
  }

  const layerButtons: Array<{
    id: keyof RepairUiState["workbench"]["visibleLayers"];
    label: string;
    title: string;
  }> = [
    { id: "grid", label: "Grid", title: "Toggle grid overlay" },
    { id: "ai-marks", label: "AI marks", title: "Toggle AI mark overlay" },
    { id: "operator-annotations", label: "Operator", title: "Toggle operator annotations" },
    { id: "ai-annotations", label: "AI notes", title: "Toggle AI annotations" },
    { id: "measurements", label: "Measure", title: "Toggle measurement overlay" },
    { id: "risks", label: "Risks", title: "Toggle risk overlay" },
    { id: "notes", label: "Notes", title: "Toggle repair notes" },
    { id: "knowledge", label: "Evidence", title: "Toggle knowledge evidence" },
  ];
  for (const layer of layerButtons) {
    const btn = documentRef.createElement("button");
    const isVisible = state.workbench.visibleLayers[layer.id];
    btn.className = `repair-toolbar__btn repair-toolbar__btn--text${isVisible ? " repair-toolbar__btn--active" : ""}`;
    btn.textContent = layer.label;
    btn.title = layer.title;
    btn.dataset["repairAction"] = "toggle-overlay-layer";
    btn.dataset["layerId"] = layer.id;
    btn.dataset["visible"] = String(!isVisible);
    toolbar.append(btn);
  }

  const investigation = documentRef.createElement("button");
  investigation.className = `repair-toolbar__btn repair-toolbar__btn--text${
    state.workbench.investigationModeEnabled ? " repair-toolbar__btn--active" : ""
  }`;
  investigation.textContent = "Inspect";
  investigation.title = "Toggle investigation mode";
  investigation.dataset["repairAction"] = "toggle-investigation-mode";
  toolbar.append(investigation);

  body.append(toolbar);

  return createRepairPanel(documentRef, {
    panelId: "workbench-stage",
    title: text(["workbench", "title"], "Workbench"),
    statusDot: state.workbench.isFrozen ? "amber" : "live",
    collapsed: state.layout.collapsedPanels["workbench-stage"],
    pinned: state.layout.pinnedPanels["workbench-stage"],
    body,
  });
}
