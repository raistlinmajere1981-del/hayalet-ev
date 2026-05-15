import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

export function renderTacticalFeedPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";

  const calmLine = documentRef.createElement("div");
  calmLine.className = "repair-feed-calmline";
  calmLine.textContent =
    state.guidance.aiInterruption.shouldSpeak === false
      ? `Quiet unless a meaningful change appears. ${state.guidance.aiInterruption.attentionBudget.remainingAiInterruptions} AI interruptions left.`
      : state.guidance.aiInterruption.toneLine;
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
  composerInput.placeholder = text(["tacticalFeed", "composer"], "Ask AiO...");
  composerInput.dataset["repairInput"] = "feed-composer";
  composer.append(composerInput);
  const composerButton = documentRef.createElement("button");
  composerButton.className = "repair-feed-composer__send";
  composerButton.type = "button";
  composerButton.textContent = "ASK";
  composerButton.dataset["repairAction"] = "send-feed-question";
  composer.append(composerButton);
  body.append(composer);

  const hasRisk = state.tacticalFeed.some((i) => i.severity === "risk");

  return createRepairPanel(documentRef, {
    panelId: "tactical-feed",
    eyebrow: text(["tacticalFeed", "eyebrow"], "TACTICAL"),
    title: text(["tacticalFeed", "title"], "Tactical Feed"),
    statusDot: hasRisk ? "risk" : "live",
    collapsed: state.layout.collapsedPanels["tactical-feed"],
    pinned: state.layout.pinnedPanels["tactical-feed"],
    body,
  });
}
