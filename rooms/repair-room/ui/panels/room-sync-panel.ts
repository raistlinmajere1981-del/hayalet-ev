import type { RepairUiState, RepairUiSnapshotMeta } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

export function renderRoomSyncPanel(
  documentRef: Document,
  state: RepairUiState,
  meta: RepairUiSnapshotMeta,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body repair-sync-panel";

  const session = state.sessions.detail;
  const focused =
    meta.events.find((event) => event.id === state.workbench.focusedEventId) ??
    meta.events.at(-1) ??
    null;
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

  rows.forEach(([label, value]) => {
    const row = documentRef.createElement("div");
    row.className = "repair-sync-row";

    const labelEl = documentRef.createElement("span");
    labelEl.className = "repair-sync-row__label";
    labelEl.textContent = label;
    row.append(labelEl);

    const valueEl = documentRef.createElement("span");
    valueEl.className = "repair-sync-row__value";
    valueEl.textContent = value;
    row.append(valueEl);

    body.append(row);
  });

  const focusCard = documentRef.createElement("div");
  focusCard.className = "repair-sync-focus";
  const title = documentRef.createElement("div");
  title.className = "repair-sync-focus__title";
  title.textContent = focused === null ? "Live edge" : focused.kind.toUpperCase();
  focusCard.append(title);

  const detail = documentRef.createElement("div");
  detail.className = "repair-sync-focus__detail";
  detail.textContent =
    focused === null
      ? "Awaiting workbench event."
      : focused.kind === "measurement"
        ? `${focused.reference ?? focused.channel} ${focused.rawDisplay} ${focused.unit}`
        : focused.kind === "ai-mark"
          ? focused.rationale
          : focused.kind === "risk-flag"
            ? focused.message
            : focused.kind === "snapshot"
              ? focused.caption
              : focused.kind === "annotation"
                ? focused.label
                : focused.kind === "freeze-frame"
                  ? focused.reason
                  : focused.kind === "note"
                    ? focused.text
                    : focused.title;
  focusCard.append(detail);
  body.append(focusCard);

  return createRepairPanel(documentRef, {
    panelId: "room-sync",
    eyebrow: text(["sync", "eyebrow"], "SYNC"),
    title: text(["sync", "title"], "Room Sync"),
    statusDot: state.phase === "session-active" ? "live" : "idle",
    collapsed: state.layout.collapsedPanels["room-sync"],
    pinned: state.layout.pinnedPanels["room-sync"],
    body,
  });
}
