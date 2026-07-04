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

function hasActiveRepairSession(state: RepairUiState): boolean {
  return state.sessions.activeId !== null && state.sessions.detail !== null;
}

function getChatModeText(state: RepairUiState, text?: TextFn): string {
  if (!hasActiveRepairSession(state)) {
    return text !== undefined
      ? text(["chat", "status", "sessionRequired"], "Önce bir tamir oturumu aç")
      : "Open a repair session first";
  }
  const voice = state.layout.voiceGuidance;
  const settings = state.layout.interactionSettings;
  if (isDictationReviewActive(state))
    return text !== undefined
      ? text(["chat", "status", "dictationReview"], "Sesli not onay bekliyor")
      : "Voice note waiting for confirmation";
  if (state.chat.pendingReplyId !== null)
    return text !== undefined
      ? text(["chat", "status", "assistantPreparing"], "Asistan bir cevap hazırlıyor")
      : "Assistant is preparing a reply";
  if (voice.handsBusyMode && voice.ambientListeningState === "listening") {
    return settings.dictationSubmitMode === "send"
      ? text !== undefined
        ? text(
            ["chat", "status", "handsFreeSend"],
            "Eller serbest: dikte ettikten sonra gönder veya sil de de"
          )
        : "Hands-free mode: say send or clear after dictation"
      : text !== undefined
        ? text(
            ["chat", "status", "handsFreeComposer"],
            "Eller serbest: dikte edilen notlar taslakta kalır"
          )
        : "Hands-free mode: dictated notes stay in the composer";
  }
  return settings.autoReadAiReplies
    ? text !== undefined
      ? text(["chat", "status", "readAloud"], "Cevaplar tamir kontrollerinden sesli okunabilir")
      : "Replies can be read aloud from repair controls"
    : text !== undefined
      ? text(["chat", "status", "textOnly"], "Yazılı cevaplar")
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
    role.textContent =
      turn.role === "ai"
        ? text(["chat", "roles", "assistant"], "Asistan")
        : text(["chat", "roles", "you"], "Sen");
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
  mode.textContent = getChatModeText(state, text);
  body.append(mode);

  // -- Composer
  const hasSession = hasActiveRepairSession(state);
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
  input.placeholder = hasSession
    ? text(["chat", "placeholder"], "Bir onarım notu yaz veya dikte et...")
    : text(["chat", "sessionRequiredPlaceholder"], "Önce bir tamir oturumu aç");
  input.value = state.chat.composerDraft;
  input.dataset["repairInput"] = "chat-composer";
  composer.append(input);

  const sendBtn = documentRef.createElement("button");
  sendBtn.className = "repair-chat-composer__send";
  sendBtn.textContent =
    state.chat.pendingReplyId === null
      ? text(["chat", "send"], "Gönder")
      : text(["chat", "status", "waiting"], "Bekliyor");
  sendBtn.disabled = state.chat.pendingReplyId !== null;
  sendBtn.dataset["repairAction"] = "send-chat";
  composer.append(sendBtn);

  if (state.chat.composerDraft.trim() !== "") {
    const clearBtn = documentRef.createElement("button");
    clearBtn.className = "repair-chat-composer__clear";
    clearBtn.type = "button";
    clearBtn.textContent = text(["chat", "clear"], "Sil");
    clearBtn.dataset["repairAction"] = "clear-chat-composer";
    composer.append(clearBtn);
  }

  body.append(composer);

  return createRepairPanel(documentRef, {
    panelId: "chat",
    eyebrow: text(["chat", "eyebrow"], "OTURUM SOHBET GEÇMİŞİ"),
    title: text(["chat", "title"], "Asistan AI sohbet geçmişi"),
    statusDot: state.chat.pendingReplyId !== null ? "amber" : "idle",
    collapsed: state.layout.collapsedPanels["chat"],
    noPanelControls: true,
    body,
  });
}
