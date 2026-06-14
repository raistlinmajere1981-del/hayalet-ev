import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

function isDictationReviewActive(state: RepairUiState): boolean {
  return (
    state.layout.voiceGuidance.handsBusyMode &&
    state.layout.interactionSettings.dictationSubmitMode === "send" &&
    state.chat.composerDraft.trim() !== ""
  );
}

export function renderChatPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";
  body.style.display = "flex";
  body.style.flexDirection = "column";

  // -- Turns
  const turns = documentRef.createElement("div");
  turns.className = "repair-chat-turns";
  turns.style.flex = "1";
  turns.style.overflowY = "auto";

  for (const turn of state.chat.turns) {
    const turnEl = documentRef.createElement("div");
    turnEl.className = "repair-chat-turn";

    const header = documentRef.createElement("div");
    header.className = "repair-chat-turn__header";

    const role = documentRef.createElement("span");
    role.className = `repair-chat-turn__role repair-chat-turn__role--${turn.role}`;
    role.textContent = turn.role === "ai" ? "AiO" : "Operator";
    header.append(role);

    const time = documentRef.createElement("span");
    time.className = "repair-chat-turn__time";
    time.textContent = new Date(turn.occurredAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    header.append(time);

    turnEl.append(header);

    const bodyText = documentRef.createElement("div");
    bodyText.className = "repair-chat-turn__body";
    bodyText.textContent = turn.text;
    turnEl.append(bodyText);

    turns.append(turnEl);
  }

  body.append(turns);

  // -- Composer
  const composer = documentRef.createElement("div");
  composer.className = "repair-chat-composer";
  composer.dataset["reviewState"] = isDictationReviewActive(state) ? "dictation-review" : "idle";

  if (isDictationReviewActive(state)) {
    const review = documentRef.createElement("div");
    review.className = "repair-chat-composer__review";
    review.textContent = text(
      ["chat", "dictationReview"],
      "Dictation staged for review. Say send, press Send, or clear and dictate again."
    );
    composer.append(review);
  }

  const input = documentRef.createElement("input");
  input.className = "repair-chat-composer__input";
  input.type = "text";
  input.placeholder = text(["chat", "placeholder"], "Type a message...");
  input.value = state.chat.composerDraft;
  input.dataset["repairInput"] = "chat-composer";
  composer.append(input);

  const sendBtn = documentRef.createElement("button");
  sendBtn.className = "repair-chat-composer__send";
  sendBtn.textContent =
    state.chat.pendingReplyId === null ? text(["chat", "send"], "Send") : "Queued";
  sendBtn.disabled = state.chat.pendingReplyId !== null;
  sendBtn.dataset["repairAction"] = "send-chat";
  composer.append(sendBtn);

  if (state.chat.composerDraft.trim() !== "") {
    const clearBtn = documentRef.createElement("button");
    clearBtn.className = "repair-chat-composer__clear";
    clearBtn.type = "button";
    clearBtn.textContent = text(["chat", "clear"], "Clear");
    clearBtn.dataset["repairAction"] = "clear-chat-composer";
    composer.append(clearBtn);
  }

  body.append(composer);

  return createRepairPanel(documentRef, {
    panelId: "chat",
    eyebrow: text(["chat", "eyebrow"], "AiO CHAT"),
    title: text(["chat", "title"], "Session Chat"),
    statusDot: state.chat.pendingReplyId !== null ? "amber" : "idle",
    collapsed: state.layout.collapsedPanels["chat"],
    pinned: state.layout.pinnedPanels["chat"],
    body,
  });
}
