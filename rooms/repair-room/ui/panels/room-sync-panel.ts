import type {
  RepairAiDispatchChannelState,
  RepairStorageState,
  RepairUiState,
  RepairUiSnapshotMeta,
} from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (
  path: string[],
  fallback: string,
  params?: Record<string, string | number>
) => string;
export type RepairRoomSyncRow = [string, string];

function getAiLifecycleActions(text: TextFn): ReadonlyArray<readonly [string, string]> {
  return [
    ["acknowledged", text(["sync", "lifecycleActions", "acknowledged"], "Kaydedildi")],
    ["investigating", text(["sync", "lifecycleActions", "investigating"], "Kontrol")],
    ["resolved", text(["sync", "lifecycleActions", "resolved"], "Düzeltildi")],
    ["dismissed", text(["sync", "lifecycleActions", "dismissed"], "Yoksay")],
  ] as const;
}

function formatAssistantSlot(slot: string, text?: TextFn): string {
  if (text !== undefined) {
    if (slot.toLowerCase() === "ai0") return text(["tacticalFeed", "slotLabel"], "Asistan {slot}", { slot: "0" });
    if (slot.toLowerCase() === "ai1") return text(["tacticalFeed", "slotLabel"], "Asistan {slot}", { slot: "1" });
    if (slot.toLowerCase() === "ai2") return text(["tacticalFeed", "slotLabel"], "Asistan {slot}", { slot: "2" });
    return slot.toUpperCase();
  }
  if (slot.toLowerCase() === "ai0") return "Assistant 0";
  if (slot.toLowerCase() === "ai1") return "Assistant 1";
  if (slot.toLowerCase() === "ai2") return "Assistant 2";
  return slot.toUpperCase();
}

function formatTime(iso: string | null, text?: TextFn): string {
  if (iso === null) return text !== undefined ? text(["sync", "status", "notStarted"], "başlatılmadı") : "not started";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return text !== undefined ? text(["sync", "status", "unknownTime"], "bilinmeyen zaman") : "unknown time";
  return date.toLocaleTimeString("en-GB");
}

export function formatRepairAiDispatchSummary(channel: RepairAiDispatchChannelState, text?: TextFn): string {
  const slot = formatAssistantSlot(channel.targetSlot, text);
  if (channel.status === "idle") return text !== undefined ? text(["sync", "status", "dispatchIdle"], "{slot} boşta", { slot }) : `${slot} idle`;
  if (channel.status === "pending")
    return text !== undefined ? text(["sync", "status", "dispatchChecking"], "{slot} kontrol ediyor", { slot }) : `${slot} checking since ${formatTime(channel.startedAt, text)}`;
  if (channel.status === "succeeded") {
    const context = channel.contextRefs.length > 0 ? text !== undefined ? text(["sync", "status", "dispatchRefs"], ", {count} başvuru", { count: channel.contextRefs.length }) : `, ${channel.contextRefs.length} refs` : "";
    return text !== undefined ? text(["sync", "status", "dispatchReady"], "{slot} hazır", { slot }) + context : `${slot} ready at ${formatTime(channel.completedAt, text)}${context}`;
  }
  return text !== undefined ? text(["sync", "status", "dispatchFailed"], "{slot} başarısız", { slot }) : `${slot} failed at ${formatTime(channel.completedAt, text)}`;
}

export function formatRepairStorageSummary(storage: RepairStorageState, text?: TextFn): string {
  if (storage.status === "hydrating") return text !== undefined ? text(["sync", "status", "storageLoading"], "Onarım geçmişi yükleniyor") : "Repair history loading";
  if (storage.status === "ready") {
    const count = `${storage.sessionCount}`;
    return text !== undefined ? text(["sync", "status", "storageReady"], "Onarım geçmişi hazır, {count}", { count }) : `Repair history ready, ${storage.sessionCount} session${storage.sessionCount === 1 ? "" : "s"}`;
  }
  if (storage.message !== null && storage.message.trim() !== "") {
    return storage.message;
  }
  if (storage.status === "error") return text !== undefined ? text(["sync", "status", "storageError"], "Onarım geçmişi hatası") : "Repair history error";
  if (storage.status === "fallback") return text !== undefined ? text(["sync", "status", "storageFallback"], "Onarım geçmişi yalnızca mevcut oturumla sınırlı") : "Repair history limited to current session";
  return text !== undefined ? text(["sync", "status", "storageNotConnected"], "Onarım geçmişi bağlı değil") : "Repair history not connected";
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
  ].map((slot) => formatAssistantSlot(slot, text));
  const firstSlot = slots[0] ?? "Assistant 2";
  const targetSlot = slots.every((slot) => slot === firstSlot) ? firstSlot : slots.join("/");
  return [
    [text(["sync", "storage"], "Storage"), formatRepairStorageSummary(state.storage, text)],
    [text(["sync", "registry"], "Eşitleme"), text(["sync", "status", "workspaceReady"], "Çalışma alanı hazır")],
    [text(["sync", "events"], "Olaylar"), `${meta.events.length} ${text(["sync", "status", "repairRecords"], "onarım kaydı")}`],
    [text(["sync", "session"], "Oturum"), session?.title ?? text(["sync", "status", "noRepairOpen"], "Açık onarım yok")],
    [
      text(["sync", "playhead"], "Playhead"),
      `+${Math.round(state.workbench.timeline.playheadMs / 1000)}s`,
    ],
    [text(["sync", "aiTarget"], "Assistant route"), targetSlot],
    [text(["sync", "chatDispatch"], "Sohbet AI"), formatRepairAiDispatchSummary(state.aiDispatch.chat, text)],
    [
      text(["sync", "researchDispatch"], "Araştırma AI"),
      formatRepairAiDispatchSummary(state.aiDispatch.research, text),
    ],
    [
      text(["sync", "tacticalDispatch"], "Taktik AI"),
      formatRepairAiDispatchSummary(state.aiDispatch.tactical, text),
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
  selectorLabel.textContent = text(["sync", "aiSlot"], "Route");
  selector.append(selectorLabel);

  const select = documentRef.createElement("select");
  select.className = "repair-sync-row__select";
  select.dataset["repairAction"] = "set-ai-target-slot";
  const currentTarget = state.aiDispatch.chat.targetSlot;
  (["ai0", "ai1", "ai2"] as const).forEach((slot) => {
    const option = documentRef.createElement("option");
    option.value = slot;
    option.textContent = formatAssistantSlot(slot, text);
    option.selected = currentTarget === slot;
    select.append(option);
  });
  selector.append(select);
  body.append(selector);

  const focusCard = documentRef.createElement("div");
  focusCard.className = "repair-sync-focus";
  const title = documentRef.createElement("div");
  title.className = "repair-sync-focus__title";
  title.textContent = focused === null ? text(["sync", "status", "liveEdge"], "Canlı kenar") : focused.kind.toUpperCase();
  focusCard.append(title);

  const detail = documentRef.createElement("div");
  detail.className = "repair-sync-focus__detail";
  detail.textContent =
    focused === null
      ? text(["sync", "status", "awaitingEvent"], "Tezgah olayı bekleniyor.")
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
    getAiLifecycleActions(text).forEach(([stateId, label]) => {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = "repair-sync-focus__action";
      button.textContent = label;
      button.title = text(["sync", "lifecycleActions", "markTitle"], `Gözlemi işaretle: ${label.toLowerCase()}`);
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
    eyebrow: text(["sync", "eyebrow"], "STATE"),
    title: text(["sync", "title"], "Repair State"),
    statusDot: state.phase === "session-active" ? "live" : "idle",
    collapsed: state.layout.collapsedPanels["room-sync"],
    noPanelControls: true,
    body,
  });
}
