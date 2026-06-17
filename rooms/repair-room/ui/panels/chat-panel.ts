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

function getChatModeText(state: RepairUiState): string {
  const voice = state.layout.voiceGuidance;
  const settings = state.layout.interactionSettings;
  if (isDictationReviewActive(state)) return "Voice note waiting for confirmation";
  if (state.chat.pendingReplyId !== null) return "Assistant is preparing a reply";
  if (voice.handsBusyMode && voice.ambientListeningState === "listening") {
    return settings.dictationSubmitMode === "send"
      ? "Hands-free mode: say send or clear after dictation"
      : "Hands-free mode: dictated notes stay in the composer";
  }
  return settings.autoReadAiReplies
    ? "Replies can be read aloud from repair controls"
    : "Text replies only";
}

export function renderChatPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body repair-panel__body--column";

  // -- Turns
  const turns = documentRef.createElement("div");
  turns.className = "repair-chat-turns repair-chat-turns--scroll";

  for (const turn of state.chat.turns) {
    const turnEl = documentRef.createElement("div");
    turnEl.className = "repair-chat-turn";

    const header = documentRef.createElement("div");
    header.className = "repair-chat-turn__header";

    const role = documentRef.createElement("span");
    role.className = `repair-chat-turn__role repair-chat-turn__role--${turn.role}`;
    role.textContent = turn.role === "ai" ? "Assistant" : "You";
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

  const mode = documentRef.createElement("div");
  mode.className = "repair-chat-mode";
  mode.textContent = getChatModeText(state);
  body.append(mode);

  // -- Composer
  const composer = documentRef.createElement("div");
  composer.className = "repair-chat-composer";
  composer.dataset["reviewState"] = isDictationReviewActive(state) ? "dictation-review" : "idle";

  if (isDictationReviewActive(state)) {
    const review = documentRef.createElement("div");
    review.className = "repair-chat-composer__review";
    review.textContent = text(
      ["chat", "dictationReview"],
      "Voice note staged. Say send, press Send, or clear and dictate again."
    );
    composer.append(review);
  }

  const input = documentRef.createElement("input");
  input.className = "repair-chat-composer__input";
  input.type = "text";
  input.placeholder = text(["chat", "placeholder"], "Ask or dictate a repair note...");
  input.value = state.chat.composerDraft;
  input.dataset["repairInput"] = "chat-composer";
  composer.append(input);

  const sendBtn = documentRef.createElement("button");
  sendBtn.className = "repair-chat-composer__send";
  sendBtn.textContent =
    state.chat.pendingReplyId === null ? text(["chat", "send"], "Send") : "Waiting";
  sendBtn.disabled = state.chat.pendingReplyId !== null;
  sendBtn.dataset["repairAction"] = "send-chat";
  composer.append(sendBtn);

  if (state.chat.composerDraft.trim() !== "") {
    const clearBtn = documentRef.createElement("button");
    clearBtn.className = "repair-chat-composer__clear";
    clearBtn.type = "button";
    clearBtn.textContent = text(["chat", "clear"], "Discard");
    clearBtn.dataset["repairAction"] = "clear-chat-composer";
    composer.append(clearBtn);
  }

  body.append(composer);

  return createRepairPanel(documentRef, {
    panelId: "chat",
    eyebrow: text(["chat", "eyebrow"], "ASSISTANT"),
    title: text(["chat", "title"], "Repair Chat"),
    statusDot: state.chat.pendingReplyId !== null ? "amber" : "idle",
    collapsed: state.layout.collapsedPanels["chat"],
    body,
  });
}
