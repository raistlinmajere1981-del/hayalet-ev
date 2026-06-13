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
  const profileToggle = documentRef.createElement("div");
  profileToggle.className = "repair-profile-toggle";
  (["novice", "advanced"] as const).forEach((profile) => {
    const button = documentRef.createElement("button");
    button.type = "button";
    button.className = `repair-profile-toggle__btn${
      state.guidance.operationalProfile === profile ? " repair-profile-toggle__btn--active" : ""
    }`;
    button.textContent = profile === "novice" ? "NOV" : "ADV";
    button.title =
      profile === "novice" ? "Novice operational profile" : "Advanced operational profile";
    button.dataset["repairAction"] = "set-operational-profile";
    button.dataset["profile"] = profile;
    profileToggle.append(button);
  });
  const operatorButton = documentRef.createElement("button");
  operatorButton.type = "button";
  operatorButton.className = `repair-profile-toggle__btn${
    state.layout.settingsOverlayOpen && state.layout.settingsOverlayTabId === "bench-operator"
      ? " repair-profile-toggle__btn--active"
      : ""
  }`;
  operatorButton.textContent = "OPR";
  operatorButton.title = "Open bench operator settings";
  operatorButton.dataset["repairAction"] = "set-settings-overlay";
  operatorButton.dataset["open"] = "true";
  operatorButton.dataset["tabId"] = "bench-operator";
  profileToggle.append(operatorButton);
  liveHeader.append(profileToggle);

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
  const handsFreeEnabled =
    state.layout.voiceGuidance.handsBusyMode && (voiceListening || ambientActive);
  handsFreeButton.className = `repair-guidance-control repair-guidance-control--wide${
    handsFreeEnabled ? " repair-guidance-control--active" : ""
  }`;
  handsFreeButton.textContent = "HANDS-FREE";
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
  ambientButton.textContent = ambientActive ? "AMB ON" : "AMB";
  ambientButton.title = ambientActive ? "Stop ambient listening" : "Start ambient listening";
  ambientButton.dataset["repairAction"] = "toggle-ambient-listener";
  ambientButton.dataset["repairControl"] = "ambient";
  ambientButton.dataset["active"] = String(ambientActive);
  guidanceControls.append(ambientButton);

  const dictationButton = documentRef.createElement("button");
  dictationButton.type = "button";
  dictationButton.className = `repair-guidance-control${dictationActive ? " repair-guidance-control--active" : ""}`;
  dictationButton.textContent = dictationActive
    ? "DIC ON"
    : `DIC ${state.layout.interactionSettings.dictationRoute === "android" ? "A" : "L"}`;
  dictationButton.title = dictationActive
    ? "Stop dictation"
    : `Start ${state.layout.interactionSettings.dictationRoute} dictation`;
  dictationButton.dataset["repairAction"] = "toggle-dictation";
  dictationButton.dataset["repairControl"] = "dictation-route";
  dictationButton.dataset["active"] = String(dictationActive);
  guidanceControls.append(dictationButton);

  const cameraButton = documentRef.createElement("button");
  cameraButton.type = "button";
  cameraButton.className = `repair-guidance-control${cameraActive ? " repair-guidance-control--active" : ""}`;
  cameraButton.textContent = cameraActive ? "CAM ON" : "CAM";
  cameraButton.title = cameraActive ? "Stop Android camera feed" : "Start Android camera feed";
  cameraButton.dataset["repairAction"] = "toggle-camera-feed";
  cameraButton.dataset["repairControl"] = "camera-feed";
  cameraButton.dataset["active"] = String(cameraActive);
  guidanceControls.append(cameraButton);

  const ttsButton = documentRef.createElement("button");
  ttsButton.type = "button";
  ttsButton.className = `repair-guidance-control${ttsActive ? " repair-guidance-control--active" : ""}`;
  ttsButton.textContent = ttsActive
    ? "TTS ON"
    : `TTS ${state.layout.interactionSettings.ttsRoute === "android" ? "A" : "L"}`;
  ttsButton.title = ttsActive ? "Stop spoken guidance" : "Read current guidance aloud";
  ttsButton.dataset["repairAction"] = "toggle-tts";
  ttsButton.dataset["repairControl"] = "tts-route";
  ttsButton.dataset["active"] = String(ttsActive);
  guidanceControls.append(ttsButton);

  const settingsButton = documentRef.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "repair-guidance-control";
  settingsButton.textContent = "SET";
  settingsButton.title = "Open Repair Room settings";
  settingsButton.dataset["repairAction"] = "set-settings-overlay";
  settingsButton.dataset["open"] = "true";
  settingsButton.dataset["tabId"] = "repair-controls";
  guidanceControls.append(settingsButton);

  const budgetButton = documentRef.createElement("button");
  budgetButton.type = "button";
  const currentMax = state.guidance.aiInterruption.attentionBudget.maxAiInterruptions;
  const nextMax = currentMax >= 3 ? 1 : currentMax + 1;
  budgetButton.className = "repair-guidance-control";
  budgetButton.textContent = `AI ${state.guidance.aiInterruption.attentionBudget.remainingAiInterruptions}/${currentMax}`;
  budgetButton.title = "Cycle AI interruption budget";
  budgetButton.dataset["repairAction"] = "set-attention-budget";
  budgetButton.dataset["maxAiInterruptions"] = String(nextMax);
  budgetButton.dataset["windowMs"] = String(state.guidance.aiInterruption.attentionBudget.windowMs);
  guidanceControls.append(budgetButton);

  liveHeader.append(guidanceControls);
  body.append(liveHeader);

  const guidance = documentRef.createElement("div");
  guidance.className = "repair-guidance-strip";
  guidance.dataset["confidence"] = state.guidance.nextBestAction.confidence;
  guidance.dataset["urgency"] = state.guidance.nextBestAction.urgency;

  const phase = documentRef.createElement("span");
  phase.className = "repair-guidance-strip__phase";
  phase.textContent = state.guidance.investigationPhase;
  guidance.append(phase);

  const action = documentRef.createElement("span");
  action.className = "repair-guidance-strip__action";
  action.textContent = state.guidance.nextBestAction.text;
  guidance.append(action);

  const recovery = documentRef.createElement("span");
  recovery.className = "repair-guidance-strip__recovery";
  recovery.textContent = `${state.guidance.recovery.currentFocus} • ${state.guidance.recovery.pendingAction}`;
  guidance.append(recovery);

  const meta = documentRef.createElement("span");
  meta.className = "repair-guidance-strip__meta";
  meta.textContent = getGuidanceMetaText(state);
  guidance.append(meta);

  body.append(guidance);

  // -- Viewport
  const viewport = documentRef.createElement("div");
  viewport.className = `repair-viewport${state.workbench.isFrozen ? " repair-viewport--frozen" : ""}`;

  const session = state.sessions.detail;
  if (session !== null && session.pcbImage !== null) {
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
    placeholder.textContent = text(["workbench", "noImage"], "No PCB image loaded");
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
    btn.className = `repair-toolbar__btn${state.workbench.activeTool === tool.id ? " repair-toolbar__btn--active" : ""}`;
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

  const layerButtons: Array<{ id: string; label: string }> = [
    { id: "grid", label: "GRD" },
    { id: "ai-marks", label: "AI" },
    { id: "operator-annotations", label: "OPR" },
    { id: "ai-annotations", label: "AIN" },
    { id: "measurements", label: "MEA" },
    { id: "risks", label: "RSK" },
    { id: "notes", label: "NTE" },
    { id: "knowledge", label: "KNO" },
  ];
  for (const layer of layerButtons) {
    const btn = documentRef.createElement("button");
    const isVisible =
      state.workbench.visibleLayers[layer.id as keyof typeof state.workbench.visibleLayers];
    btn.className = `repair-toolbar__btn${isVisible ? " repair-toolbar__btn--active" : ""}`;
    btn.textContent = layer.label;
    btn.title = `Toggle ${layer.id}`;
    btn.dataset["repairAction"] = "toggle-overlay-layer";
    btn.dataset["layerId"] = layer.id;
    btn.dataset["visible"] = String(!isVisible);
    toolbar.append(btn);
  }

  const investigation = documentRef.createElement("button");
  investigation.className = `repair-toolbar__btn${
    state.workbench.investigationModeEnabled ? " repair-toolbar__btn--active" : ""
  }`;
  investigation.textContent = "INV";
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
