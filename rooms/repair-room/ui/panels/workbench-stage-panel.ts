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
          const linked = state.sessions.detail?.events.find((candidate) => candidate.id === eventId);
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
  body.append(liveHeader);

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
