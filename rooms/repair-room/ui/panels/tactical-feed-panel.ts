import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

function formatAssistantSlot(slot: string): string {
  if (slot.toLowerCase() === "ai1") return "Assistant 1";
  if (slot.toLowerCase() === "ai2") return "Assistant 2";
  return slot.toUpperCase();
}

export function formatRepairTacticalFeedStatusLine(state: RepairUiState): string {
  const tactical = state.aiDispatch.tactical;
  const tacticalSlot = formatAssistantSlot(tactical.targetSlot);
  if (tactical.status === "pending") {
    return `${tacticalSlot} is checking the latest measurement.`;
  }
  if (tactical.status === "succeeded") {
    return tactical.message ?? `${tacticalSlot} added a repair note.`;
  }
  if (tactical.status === "failed") {
    return tactical.message ?? `${tacticalSlot} could not add a repair note.`;
  }

  const research = state.aiDispatch.research;
  const researchSlot = formatAssistantSlot(research.targetSlot);
  if (research.status === "pending") {
    return `${researchSlot} is gathering evidence for this device.`;
  }
  if (research.status === "succeeded") {
    return research.message ?? `${researchSlot} prepared an evidence pack.`;
  }
  if (research.status === "failed") {
    return research.message ?? `${researchSlot} could not prepare an evidence pack.`;
  }

  const chat = state.aiDispatch.chat;
  const chatSlot = formatAssistantSlot(chat.targetSlot);
  if (chat.status === "pending") {
    return `${chatSlot} is drafting a reply.`;
  }
  if (chat.status === "succeeded") {
    return chat.message ?? `${chatSlot} reply is ready.`;
  }
  if (chat.status === "failed") {
    return chat.message ?? `${chatSlot} could not draft a reply.`;
  }

  return state.guidance.aiInterruption.shouldSpeak === false
    ? `Quiet mode: waiting for a meaningful change. ${state.guidance.aiInterruption.attentionBudget.remainingAiInterruptions} assistant prompts left.`
    : state.guidance.aiInterruption.toneLine;
}

export function renderTacticalFeedPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";

  const calmLine = documentRef.createElement("div");
  calmLine.className = "repair-feed-calmline";
  calmLine.textContent = formatRepairTacticalFeedStatusLine(state);
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
  composerInput.placeholder = text(["tacticalFeed", "composer"], "Ask the repair assistant...");
  composerInput.dataset["repairInput"] = "feed-composer";
  composer.append(composerInput);
  const composerButton = documentRef.createElement("button");
  composerButton.className = "repair-feed-composer__send";
  composerButton.type = "button";
  composerButton.textContent = "Ask";
  composerButton.dataset["repairAction"] = "send-feed-question";
  composer.append(composerButton);
  body.append(composer);

  const hasRisk = state.tacticalFeed.some((i) => i.severity === "risk");

  return createRepairPanel(documentRef, {
    panelId: "tactical-feed",
    eyebrow: text(["tacticalFeed", "eyebrow"], "ASSIST"),
    title: text(["tacticalFeed", "title"], "Repair Feed"),
    statusDot: hasRisk ? "risk" : "live",
    collapsed: state.layout.collapsedPanels["tactical-feed"],
    body,
  });
}
