import type { RepairUiState } from "../../shared/ui/state.js";
import { localizeRepairGuidanceLine } from "../runtime/guidance-text.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (
  path: string[],
  fallback: string,
  params?: Record<string, string | number>
) => string;

function formatAssistantSlot(slot: string, text?: TextFn): string {
  if (text !== undefined) {
    if (slot.toLowerCase() === "ai0")
      return text(["tacticalFeed", "slotLabel"], "Asistan AI {slot}", { slot: "0" });
    if (slot.toLowerCase() === "ai1")
      return text(["tacticalFeed", "slotLabel"], "Asistan AI {slot}", { slot: "1" });
    if (slot.toLowerCase() === "ai2")
      return text(["tacticalFeed", "slotLabel"], "Asistan AI {slot}", { slot: "2" });
    return slot.toUpperCase();
  }
  if (slot.toLowerCase() === "ai0") return "Assistant AI 0";
  if (slot.toLowerCase() === "ai1") return "Assistant AI 1";
  if (slot.toLowerCase() === "ai2") return "Assistant AI 2";
  return slot.toUpperCase();
}

export function formatRepairTacticalFeedStatusLine(state: RepairUiState, text?: TextFn): string {
  const tactical = state.aiDispatch.tactical;
  const tacticalSlot =
    text !== undefined
      ? formatAssistantSlot(tactical.targetSlot, text)
      : formatAssistantSlot(tactical.targetSlot);
  if (tactical.status === "pending") {
    return text !== undefined
      ? text(["tacticalFeed", "statusChecking"], "{slot} son ölçümü kontrol ediyor.", {
          slot: tacticalSlot,
        })
      : `${tacticalSlot} is checking the latest measurement.`;
  }
  if (tactical.status === "succeeded") {
    return (
      tactical.message ??
      (text !== undefined
        ? text(["tacticalFeed", "statusAddedNote"], "{slot} bir onarım notu ekledi.", {
            slot: tacticalSlot,
          })
        : `${tacticalSlot} added a repair note.`)
    );
  }
  if (tactical.status === "failed") {
    return (
      tactical.message ??
      (text !== undefined
        ? text(["tacticalFeed", "statusFailed"], "{slot} bir onarım notu ekleyemedi.", {
            slot: tacticalSlot,
          })
        : `${tacticalSlot} could not add a repair note.`)
    );
  }

  const research = state.aiDispatch.research;
  const researchSlot =
    text !== undefined
      ? formatAssistantSlot(research.targetSlot, text)
      : formatAssistantSlot(research.targetSlot);
  if (research.status === "pending") {
    return text !== undefined
      ? text(["tacticalFeed", "researchGathering"], "{slot} bu cihaz için kanıt topluyor.", {
          slot: researchSlot,
        })
      : `${researchSlot} is gathering evidence for this device.`;
  }
  if (research.status === "succeeded") {
    return (
      research.message ??
      (text !== undefined
        ? text(["tacticalFeed", "researchPrepared"], "{slot} bir kanıt paketi hazırladı.", {
            slot: researchSlot,
          })
        : `${researchSlot} prepared an evidence pack.`)
    );
  }
  if (research.status === "failed") {
    return (
      research.message ??
      (text !== undefined
        ? text(["tacticalFeed", "researchFailed"], "{slot} bir kanıt paketi hazırlayamadı.", {
            slot: researchSlot,
          })
        : `${researchSlot} could not prepare an evidence pack.`)
    );
  }

  const chat = state.aiDispatch.chat;
  const chatSlot =
    text !== undefined
      ? formatAssistantSlot(chat.targetSlot, text)
      : formatAssistantSlot(chat.targetSlot);
  if (chat.status === "pending") {
    return text !== undefined
      ? text(["tacticalFeed", "chatDrafting"], "{slot} bir cevap taslaklıyor.", { slot: chatSlot })
      : `${chatSlot} is drafting a reply.`;
  }
  if (chat.status === "succeeded") {
    return (
      chat.message ??
      (text !== undefined
        ? text(["tacticalFeed", "chatReady"], "{slot} cevap hazır.", { slot: chatSlot })
        : `${chatSlot} reply is ready.`)
    );
  }
  if (chat.status === "failed") {
    return (
      chat.message ??
      (text !== undefined
        ? text(["tacticalFeed", "chatFailed"], "{slot} bir cevap taslaklayamadı.", {
            slot: chatSlot,
          })
        : `${chatSlot} could not draft a reply.`)
    );
  }

  return state.guidance.aiInterruption.shouldSpeak === false
    ? text !== undefined
      ? text(
          ["tacticalFeed", "quietMode"],
          "Sessiz mod: anlamlı bir değişiklik bekleniyor. {remaining} asistan uyarısı kaldı.",
          { remaining: state.guidance.aiInterruption.attentionBudget.remainingAiInterruptions }
        )
      : `Quiet mode: waiting for a meaningful change. ${state.guidance.aiInterruption.attentionBudget.remainingAiInterruptions} assistant prompts left.`
    : text !== undefined
      ? localizeRepairGuidanceLine(state.guidance.aiInterruption.toneLine, text)
      : state.guidance.aiInterruption.toneLine;
}

function hasActiveRepairSession(state: RepairUiState): boolean {
  return state.sessions.activeId !== null && state.sessions.detail !== null;
}

export function renderTacticalFeedPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const hasSession = hasActiveRepairSession(state);
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";

  const calmLine = documentRef.createElement("div");
  calmLine.className = "repair-feed-calmline";
  calmLine.textContent = formatRepairTacticalFeedStatusLine(state, text);
  body.append(calmLine);

  const list = documentRef.createElement("div");
  list.className = "repair-feed-list";

  for (const item of state.tacticalFeed) {
    const entry = documentRef.createElement("div");
    entry.className = `repair-feed-entry repair-feed-entry--${item.severity}${state.workbench.focusedEventId === item.eventId ? " repair-feed-entry--active" : ""}`;
    entry.dataset["repairAction"] = "jump-to-event";
    entry.dataset["eventId"] = item.eventId;

    const header = documentRef.createElement("div");
    header.className = "repair-feed-entry__header";

    const badge = documentRef.createElement("span");
    badge.className = `repair-feed-entry__badge repair-feed-entry__badge--${item.severity}`;
    badge.textContent = item.badge;
    header.append(badge);

    const time = documentRef.createElement("span");
    time.className = "repair-feed-entry__time";
    time.textContent = item.relativeLabel;
    header.append(time);

    entry.append(header);

    const bodyText = documentRef.createElement("div");
    bodyText.className = "repair-feed-entry__body";
    bodyText.textContent = item.body;
    entry.append(bodyText);

    list.append(entry);
  }

  body.append(list);

  const composer = documentRef.createElement("div");
  composer.className = "repair-feed-composer";
  const composerInput = documentRef.createElement("input");
  composerInput.className = "repair-feed-composer__input";
  composerInput.type = "text";
  composerInput.placeholder = hasSession
    ? text(["tacticalFeed", "composer"], "Tamir asistanına sor...")
    : text(["tacticalFeed", "sessionRequiredPlaceholder"], "Önce bir tamir oturumu aç");
  composerInput.dataset["repairInput"] = "feed-composer";
  composer.append(composerInput);
  const composerButton = documentRef.createElement("button");
  composerButton.className = "repair-feed-composer__send";
  composerButton.type = "button";
  composerButton.textContent = text(["tacticalFeed", "send"], "Sor");
  composerButton.dataset["repairAction"] = "send-feed-question";
  composer.append(composerButton);
  body.append(composer);

  const hasRisk = state.tacticalFeed.some((i) => i.severity === "risk");

  return createRepairPanel(documentRef, {
    panelId: "tactical-feed",
    eyebrow: text(["tacticalFeed", "eyebrow"], "ASİSTAN"),
    title: text(["tacticalFeed", "title"], "Tamir Akışı"),
    statusDot: hasRisk ? "risk" : "live",
    collapsed: state.layout.collapsedPanels["tactical-feed"],
    noPanelControls: true,
    body,
  });
}
