import type {
  RepairAiDispatchChannelState,
  RepairStorageState,
  RepairUiState,
  RepairUiSnapshotMeta,
} from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;
export type RepairRoomSyncRow = [string, string];

const AI_LIFECYCLE_ACTIONS = [
  ["acknowledged", "ACK"],
  ["investigating", "INV"],
  ["resolved", "RES"],
  ["dismissed", "DIS"],
] as const;

function formatTime(iso: string | null): string {
  if (iso === null) return "not started";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return date.toLocaleTimeString("en-GB");
}

export function formatRepairAiDispatchSummary(channel: RepairAiDispatchChannelState): string {
  const slot = channel.targetSlot.toUpperCase();
  if (channel.status === "idle") return `${slot} idle`;
  if (channel.status === "pending") return `${slot} pending since ${formatTime(channel.startedAt)}`;
  if (channel.status === "succeeded") {
    const context = channel.contextRefs.length > 0 ? `, ${channel.contextRefs.length} refs` : "";
    return `${slot} ok at ${formatTime(channel.completedAt)}${context}`;
  }
  return `${slot} failed at ${formatTime(channel.completedAt)}`;
}

export function formatRepairStorageSummary(storage: RepairStorageState): string {
  if (storage.status === "hydrating") return "Room storage loading";
  if (storage.status === "ready") {
    const count = `${storage.sessionCount} session${storage.sessionCount === 1 ? "" : "s"}`;
    return `Room storage ready, ${count}`;
  }
  if (storage.message !== null && storage.message.trim() !== "") {
    return storage.message;
  }
  if (storage.status === "error") return "Room storage error";
  if (storage.status === "fallback") return "In-memory fallback";
  return "In-memory mock";
}

export function getRepairRoomSyncRows(
  state: RepairUiState,
  meta: RepairUiSnapshotMeta,
  text: TextFn
): RepairRoomSyncRow[] {
  const session = state.sessions.detail;
  const slots = [
    state.aiDispatch.chat.targetSlot,
    state.aiDispatch.research.targetSlot,
    state.aiDispatch.tactical.targetSlot,
  ].map((slot) => slot.toUpperCase());
  const firstSlot = slots[0] ?? "AI2";
  const targetSlot = slots.every((slot) => slot === firstSlot) ? firstSlot : slots.join("/");
  return [
    [text(["sync", "storage"], "Storage"), formatRepairStorageSummary(state.storage)],
    [text(["sync", "registry"], "Room Sync"), "Workspace build ready"],
    [text(["sync", "events"], "Events"), `${meta.events.length} records`],
    [text(["sync", "session"], "Session"), session?.title ?? "No active session"],
    [
      text(["sync", "playhead"], "Playhead"),
      `+${Math.round(state.workbench.timeline.playheadMs / 1000)}s`,
    ],
    [text(["sync", "aiTarget"], "AI Target"), targetSlot],
    [
      text(["sync", "chatDispatch"], "Chat AI"),
      formatRepairAiDispatchSummary(state.aiDispatch.chat),
    ],
    [
      text(["sync", "researchDispatch"], "Research AI"),
      formatRepairAiDispatchSummary(state.aiDispatch.research),
    ],
    [
      text(["sync", "tacticalDispatch"], "Tactical AI"),
      formatRepairAiDispatchSummary(state.aiDispatch.tactical),
    ],
  ];
}

export function renderRoomSyncPanel(
  documentRef: Document,
  state: RepairUiState,
  meta: RepairUiSnapshotMeta,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body repair-sync-panel";

  const focused =
    meta.events.find((event) => event.id === state.workbench.focusedEventId) ??
    meta.events.at(-1) ??
    null;
  const rows = getRepairRoomSyncRows(state, meta, text);

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

  const selector = documentRef.createElement("label");
  selector.className = "repair-sync-row repair-sync-row--control";

  const selectorLabel = documentRef.createElement("span");
  selectorLabel.className = "repair-sync-row__label";
  selectorLabel.textContent = text(["sync", "aiSlot"], "AI Slot");
  selector.append(selectorLabel);

  const select = documentRef.createElement("select");
  select.className = "repair-sync-row__select";
  select.dataset["repairAction"] = "set-ai-target-slot";
  const currentTarget = state.aiDispatch.chat.targetSlot;
  (["ai1", "ai2"] as const).forEach((slot) => {
    const option = documentRef.createElement("option");
    option.value = slot;
    option.textContent = slot.toUpperCase();
    option.selected = currentTarget === slot;
    select.append(option);
  });
  selector.append(select);
  body.append(selector);

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
                    : focused.kind === "ai-mark-lifecycle"
                      ? focused.reason
                      : focused.kind === "investigation-region-created"
                        ? focused.label
                        : focused.kind === "investigation-region-updated"
                          ? (focused.label ?? focused.regionId)
                          : focused.title;
  focusCard.append(detail);

  if (focused?.kind === "ai-mark") {
    const actions = documentRef.createElement("div");
    actions.className = "repair-sync-focus__actions";
    AI_LIFECYCLE_ACTIONS.forEach(([stateId, label]) => {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = "repair-sync-focus__action";
      button.textContent = label;
      button.title = `Move AI mark to ${stateId}`;
      button.dataset["repairAction"] = "ai-mark-state";
      button.dataset["eventId"] = focused.id;
      button.dataset["aiState"] = stateId;
      actions.append(button);
    });
    focusCard.append(actions);
  }
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
