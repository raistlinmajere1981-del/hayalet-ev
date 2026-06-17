import type { RepairEvent, RepairPanelId } from "../../shared/types/index.js";
import type { RepairUiSnapshotMeta, RepairUiState } from "../../shared/ui/state.js";
import { getRepairRoomSyncRows } from "../panels/room-sync-panel.js";
import { setClassNameIfChanged, setDatasetIfChanged, setTextIfChanged } from "./dom-utils.js";

const AI_LIFECYCLE_ACTIONS = [
  ["acknowledged", "Noted"],
  ["investigating", "Checking"],
  ["resolved", "Fixed"],
  ["dismissed", "Ignore"],
] as const;

export function createRepairSyncInspectorDomRuntime(params: {
  documentRef: Document;
  meta: RepairUiSnapshotMeta;
  state: RepairUiState;
  text: (path: string[], fallback: string) => string;
  updatePanelChrome: (panel: HTMLElement, panelId: RepairPanelId) => void;
}) {
  const { documentRef, meta, state, text, updatePanelChrome } = params;

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
        button.title = `Mark observation as ${label.toLowerCase()}`;
      });
      actions.querySelectorAll<HTMLElement>(".repair-sync-focus__action").forEach((button) => {
        const stateId = button.dataset["aiState"];
        if (stateId === undefined || !activeKeys.has(stateId)) button.remove();
      });
    }
  }

  return {
    syncWorkbenchInspector,
    updateRoomSyncPanelDom,
    updateSyncLiveDom,
  };
}
