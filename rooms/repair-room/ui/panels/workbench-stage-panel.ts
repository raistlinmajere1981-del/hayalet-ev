import type { RepairEvent, RepairWorkbenchTool } from "../../shared/types/index.js";
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
    const status = event.status ?? "updated";
    return `${time} • ${status.toUpperCase()} • ${event.regionId}`;
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

const REPAIR_TOOL_ICONS: Record<RepairWorkbenchTool, string> = {
  select: "V",
  pan: "+",
  "zoom-in": "+",
  "zoom-out": "-",
  rect: "[]",
  circle: "O",
  freehand: "~",
  text: "T",
  "measurement-link": "L",
  "measurement-pin": "P",
  arrow: ">",
  ruler: "|",
  "freeze-frame": "F",
  snapshot: "S",
};

const REPAIR_TOOLBAR_LAYER_BUTTONS: Array<{
  id: keyof RepairUiState["workbench"]["visibleLayers"];
  label: string;
  title: string;
}> = [
  { id: "grid", label: "Grid", title: "Toggle grid overlay" },
  { id: "ai-marks", label: "AI Marks", title: "Toggle AI mark overlay" },
  { id: "operator-annotations", label: "Operator Notes", title: "Toggle operator annotations" },
  { id: "ai-annotations", label: "AI Notes", title: "Toggle AI annotations" },
  { id: "measurements", label: "Measure", title: "Toggle measurement overlay" },
  { id: "risks", label: "Risks", title: "Toggle risk overlay" },
  { id: "notes", label: "Notes", title: "Toggle repair notes" },
  { id: "knowledge", label: "Evidence", title: "Toggle knowledge evidence" },
];

function appendButtonLabel(
  documentRef: Document,
  button: HTMLElement,
  icon: string,
  label: string
): void {
  const iconEl = documentRef.createElement("span");
  iconEl.className = "repair-toolbar__icon";
  iconEl.textContent = icon;
  button.append(iconEl);

  const labelEl = documentRef.createElement("span");
  labelEl.className = "repair-toolbar__label";
  labelEl.textContent = label;
  button.append(labelEl);
}

function createToolButton(
  documentRef: Document,
  state: RepairUiState,
  tool: (typeof REPAIR_OVERLAY_TOOLS)[number]
): HTMLElement {
  const btn = documentRef.createElement("button");
  btn.type = "button";
  btn.className = `repair-toolbar__btn repair-toolbar__btn--tool repair-toolbar__btn--text${
    state.workbench.activeTool === tool.id ? " repair-toolbar__btn--active" : ""
  }`;
  btn.title = tool.title;
  btn.dataset["repairAction"] = "set-tool";
  btn.dataset["tool"] = tool.id;
  appendButtonLabel(documentRef, btn, REPAIR_TOOL_ICONS[tool.id], tool.label);
  return btn;
}

function createLayerButton(
  documentRef: Document,
  state: RepairUiState,
  layer: (typeof REPAIR_TOOLBAR_LAYER_BUTTONS)[number]
): HTMLElement {
  const btn = documentRef.createElement("button");
  const isVisible = state.workbench.visibleLayers[layer.id];
  btn.type = "button";
  btn.className = `repair-toolbar__btn repair-toolbar__btn--layer repair-toolbar__btn--text${
    isVisible ? " repair-toolbar__btn--active" : ""
  }`;
  btn.title = layer.title;
  btn.dataset["repairAction"] = "toggle-overlay-layer";
  btn.dataset["layerId"] = layer.id;
  btn.dataset["visible"] = String(!isVisible);

  const check = documentRef.createElement("span");
  check.className = "repair-toolbar__check";
  btn.append(check);

  const label = documentRef.createElement("span");
  label.className = "repair-toolbar__label";
  label.textContent = layer.label;
  btn.append(label);
  return btn;
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

export function renderWorkbenchStagePanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body repair-panel__body--no-padding";

  const guidance = documentRef.createElement("div");
  guidance.className = "repair-guidance-strip";
  guidance.dataset["confidence"] = state.guidance.nextBestAction.confidence;
  guidance.dataset["urgency"] = state.guidance.nextBestAction.urgency;
  // Command hints stay hidden unless a room action toggles them.
  guidance.dataset["showSay"] = "false";

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

  // -- Toolbar: viewport chrome
  const toolbar = documentRef.createElement("div");
  toolbar.className = "repair-toolbar";
  toolbar.dataset["repairWorkbenchToolbar"] = "viewport";

  const toolsGroup = documentRef.createElement("div");
  toolsGroup.className = "repair-toolbar-group repair-toolbar-group--tools";
  toolsGroup.dataset["toolbarGroup"] = "tools";

  for (const tool of REPAIR_OVERLAY_TOOLS) {
    if (tool.id === "zoom-in" || tool.id === "zoom-out") continue;
    toolsGroup.append(createToolButton(documentRef, state, tool));

    if (tool.id === "pan" || tool.id === "text" || tool.id === "arrow") {
      const sep = documentRef.createElement("span");
      sep.className = "repair-toolbar__sep";
      toolsGroup.append(sep);
    }
  }

  toolbar.append(toolsGroup);

  const layersGroup = documentRef.createElement("div");
  layersGroup.className = "repair-toolbar-group repair-toolbar-group--layers";
  layersGroup.dataset["toolbarGroup"] = "layers";

  for (const layer of REPAIR_TOOLBAR_LAYER_BUTTONS) {
    layersGroup.append(createLayerButton(documentRef, state, layer));
  }

  const investigation = documentRef.createElement("button");
  investigation.type = "button";
  investigation.className = `repair-toolbar__btn repair-toolbar__btn--layer repair-toolbar__btn--text${
    state.workbench.investigationModeEnabled ? " repair-toolbar__btn--active" : ""
  }`;
  investigation.title = "Toggle investigation mode";
  investigation.dataset["repairAction"] = "toggle-investigation-mode";
  appendButtonLabel(documentRef, investigation, "i", "Inspect");
  layersGroup.append(investigation);

  toolbar.append(layersGroup);

  const zoomGroup = documentRef.createElement("div");
  zoomGroup.className = "repair-toolbar-group repair-toolbar-group--zoom";
  zoomGroup.dataset["toolbarGroup"] = "zoom";
  const zoomOut = REPAIR_OVERLAY_TOOLS.find((tool) => tool.id === "zoom-out");
  const zoomIn = REPAIR_OVERLAY_TOOLS.find((tool) => tool.id === "zoom-in");
  if (zoomOut !== undefined) zoomGroup.append(createToolButton(documentRef, state, zoomOut));
  const zoomValue = documentRef.createElement("span");
  zoomValue.className = "repair-toolbar__zoom-value";
  zoomValue.textContent = `${Math.round(state.workbench.viewport.zoom * 100)}%`;
  zoomGroup.append(zoomValue);
  if (zoomIn !== undefined) zoomGroup.append(createToolButton(documentRef, state, zoomIn));
  toolbar.append(zoomGroup);

  viewport.append(toolbar);
  body.append(viewport);

  return createRepairPanel(documentRef, {
    panelId: "workbench-stage",
    title: text(["workbench", "title"], "WORKBENCH"),
    statusDot: state.workbench.isFrozen ? "amber" : "live",
    collapsed: state.layout.collapsedPanels["workbench-stage"],
    noPanelControls: true,
    body,
  });
}
