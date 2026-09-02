/* global window, document */

(function (global) {
  const gameplayUi = global.GameRoomFateKnotsGameplayUi;
  if (!gameplayUi) return;

  const original = {
    dispose: gameplayUi.dispose,
    handleCommandResult: gameplayUi.handleCommandResult,
    handleState: gameplayUi.handleState,
    render: gameplayUi.render,
  };

  const state = {
    gameplay: null,
    consensus: null,
    requestedKey: "",
    draftText: "",
    lastMessage: "",
  };

  function readRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function readArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function readString(value) {
    return typeof value === "string" ? value : "";
  }

  function sendCommand(name, payload) {
    const roomApi = global.roomAPI;
    if (!roomApi || typeof roomApi.sendCommand !== "function") {
      state.lastMessage = "Oda bağlantısı hazır değil.";
      renderCurrent();
      return false;
    }
    const sent = roomApi.sendCommand(name, payload || {});
    if (sent !== true) {
      state.lastMessage = "Komut oda host'una gönderilemedi.";
      renderCurrent();
      return false;
    }
    return true;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function createButton(label, onClick, options) {
    const button = createElement("button", "fate-knots-gameplay__button", label);
    button.type = "button";
    if (options && options.secondary) button.classList.add("fate-knots-gameplay__button--secondary");
    if (options && options.selected) button.classList.add("is-selected");
    if (options && options.disabled) button.disabled = true;
    if (!button.disabled && typeof onClick === "function") button.addEventListener("click", onClick);
    return button;
  }

  function currentRunId() {
    return readString(readRecord(state.gameplay)?.runId);
  }

  function isExploration() {
    const gameplay = readRecord(state.gameplay);
    return Boolean(gameplay && gameplay.phase === "exploration" && !readRecord(gameplay.combat));
  }

  function requestKey(gameplay) {
    if (!gameplay || gameplay.phase !== "exploration" || readRecord(gameplay.combat)) return "";
    return `${readString(gameplay.runId)}:${String(gameplay.revision ?? "")}`;
  }

  function requestConsensus(gameplay) {
    const key = requestKey(gameplay);
    if (!key || key === state.requestedKey) return;
    state.requestedKey = key;
    state.consensus = null;
    if (!sendCommand("GameRoomFateKnotsGetExplorationConsensus", { runId: readString(gameplay.runId) })) {
      state.requestedKey = "";
    }
  }

  function seatLabel(seatId) {
    if (seatId === "user") return "Sen";
    if (seatId === "ai2") return "AI2";
    if (seatId === "us1") return "US1";
    return seatId;
  }

  function transitionLabel(transitionId) {
    const consensus = readRecord(state.consensus);
    const transition = readArray(consensus?.availableTransitions).find(function (entry) {
      return readString(readRecord(entry)?.id) === transitionId;
    });
    return readString(readRecord(transition)?.label) || transitionId;
  }

  function localChoiceId() {
    const consensus = readRecord(state.consensus);
    const choice = readArray(consensus?.choices).find(function (entry) {
      return readString(readRecord(entry)?.seatId) === "user";
    });
    const transitionId = readRecord(choice)?.transitionId;
    return typeof transitionId === "string" ? transitionId : null;
  }

  function chooseTransition(transitionId) {
    if (!isExploration()) return;
    state.lastMessage = "";
    sendCommand("GameRoomFateKnotsChooseExploration", {
      runId: currentRunId(),
      transitionId: transitionId,
    });
  }

  function sendMessage() {
    const text = state.draftText.trim();
    if (!text || !isExploration()) return;
    state.lastMessage = "";
    sendCommand("GameRoomFateKnotsSendExplorationMessage", {
      runId: currentRunId(),
      text: text,
    });
  }

  function renderSeatChoices(consensus) {
    const row = createElement("div", "fate-knots-gameplay__readiness");
    readArray(consensus.activeSeatIds).forEach(function (entry) {
      const seatId = readString(entry);
      const choice = readArray(consensus.choices).find(function (candidate) {
        return readString(readRecord(candidate)?.seatId) === seatId;
      });
      const transitionId = readRecord(choice)?.transitionId;
      const hasChoice = typeof transitionId === "string" && transitionId !== "";
      row.append(
        createElement(
          "span",
          hasChoice
            ? "fate-knots-gameplay__seat-state is-ready"
            : "fate-knots-gameplay__seat-state",
          hasChoice
            ? `${seatLabel(seatId)} · ${transitionLabel(transitionId)}`
            : `${seatLabel(seatId)} · düşünüyor`
        )
      );
    });
    return row;
  }

  function renderChoices(consensus) {
    const section = createElement("section", "fate-knots-gameplay__planning");
    section.append(
      createElement("h3", "fate-knots-gameplay__discussion-title", "Ortak karar"),
      renderSeatChoices(consensus)
    );

    const transitions = readArray(consensus.availableTransitions);
    if (transitions.length === 0) {
      section.append(
        createElement(
          "div",
          "fate-knots-gameplay__warning",
          "Bu sahnede şu anda engine tarafından açılmış bir geçiş yok."
        )
      );
      return section;
    }

    const row = createElement("div", "fate-knots-gameplay__option-row");
    const selectedId = localChoiceId();
    transitions.forEach(function (entry) {
      const transition = readRecord(entry);
      if (!transition) return;
      const transitionId = readString(transition.id);
      row.append(
        createButton(
          readString(transition.label) || transitionId,
          function () {
            chooseTransition(transitionId);
          },
          { selected: selectedId === transitionId }
        )
      );
    });
    section.append(row);

    const unanimousId = readString(consensus.unanimousTransitionId);
    if (unanimousId) {
      section.append(
        createElement(
          "div",
          "fate-knots-gameplay__ready-note",
          `Ortak karar: ${transitionLabel(unanimousId)}. Host senaryoyu ilerletiyor…`
        )
      );
    } else {
      section.append(
        createElement(
          "div",
          "fate-knots-gameplay__muted",
          "Senaryo ancak bütün aktif oyuncular aynı seçeneğe geldiğinde ilerler."
        )
      );
    }
    return section;
  }

  function renderDiscussion(consensus) {
    const section = createElement("section", "fate-knots-gameplay__discussion");
    section.append(
      createElement("h3", "fate-knots-gameplay__discussion-title", "Exploration sohbeti")
    );

    const messages = createElement("div", "fate-knots-gameplay__messages");
    const entries = readArray(consensus.messages);
    if (entries.length === 0) {
      messages.append(createElement("div", "fate-knots-gameplay__muted", "Henüz mesaj yok."));
    } else {
      entries.forEach(function (entry) {
        const message = readRecord(entry);
        if (!message) return;
        const row = createElement("div", "fate-knots-gameplay__message");
        row.append(
          createElement(
            "strong",
            "fate-knots-gameplay__message-author",
            seatLabel(readString(message.seatId))
          ),
          createElement("span", "fate-knots-gameplay__message-text", readString(message.text))
        );
        messages.append(row);
      });
    }
    section.append(messages);

    const compose = createElement("div", "fate-knots-gameplay__compose");
    const input = document.createElement("textarea");
    input.className = "fate-knots-gameplay__chat-input";
    input.rows = 2;
    input.maxLength = 2000;
    input.placeholder = "Diğer oyuncularla kararını konuş…";
    input.value = state.draftText;
    input.addEventListener("input", function () {
      state.draftText = input.value;
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        state.draftText = input.value;
        sendMessage();
      }
    });
    compose.append(input, createButton("Gönder", sendMessage, { disabled: false }));
    section.append(compose);
    return section;
  }

  function renderConsensusPanel() {
    const panel = createElement("div", "fate-knots-gameplay__interaction");
    const consensus = readRecord(state.consensus);
    if (!consensus) {
      panel.append(
        createElement(
          "div",
          "fate-knots-gameplay__muted",
          "Ortak karar durumu host'tan bekleniyor…"
        )
      );
      return panel;
    }
    panel.append(renderDiscussion(consensus), renderChoices(consensus));
    return panel;
  }

  function removeOldExplorationPlaceholder(root) {
    const notes = root.querySelectorAll(".fate-knots-gameplay__muted");
    notes.forEach(function (entry) {
      if (readString(entry.textContent).includes("hikâye seçim yüzeyi henüz eklenmedi")) {
        entry.remove();
      }
    });
  }

  function render(root) {
    const rendered = typeof original.render === "function" ? original.render(root) : false;
    if (!rendered || !isExploration()) return rendered;

    removeOldExplorationPlaceholder(root);
    const shell = root.querySelector(".fate-knots-gameplay");
    if (shell) {
      shell.append(renderConsensusPanel());
      if (state.lastMessage) {
        shell.append(createElement("div", "fate-knots-gameplay__notice", state.lastMessage));
      }
    }
    return rendered;
  }

  function renderCurrent() {
    const root = document.getElementById("app");
    if (root && state.gameplay) render(root);
  }

  function handleState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    const nextState = payload && "state" in payload ? readRecord(payload.state) : null;
    state.gameplay = nextState;

    const handled =
      typeof original.handleState === "function" ? original.handleState(message) : false;

    if (isExploration()) {
      requestConsensus(nextState);
    } else {
      state.consensus = null;
      state.requestedKey = "";
      state.draftText = "";
      state.lastMessage = "";
    }
    return handled;
  }

  function handleExplorationConsensusState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    if (!payload || !("state" in payload)) return false;
    state.consensus = readRecord(payload.state);
    state.lastMessage = "";
    renderCurrent();
    return true;
  }

  function explorationErrorMessage(result) {
    const error = readString(result?.error);
    if (error === "exploration-rejected") return "Bu exploration kararı artık geçerli değil.";
    if (error === "story-transition-rejected") return "Seçilen senaryo yolu engine tarafından reddedildi.";
    if (error === "encounter-open-rejected") return "Seçilen yolun savaşı güvenli biçimde açılamadı.";
    if (error === "persistence-rejected" || error === "save-rejected") {
      return "Kayıt durumu güvenli biçimde güncellenemedi.";
    }
    if (error === "run-not-found") return "Aktif koşu bulunamadı.";
    return "Exploration komutu tamamlanamadı.";
  }

  function handleCommandResult(message) {
    const record = readRecord(message);
    const command = readString(record?.command);
    if (!command.startsWith("GameRoomFateKnots") || !command.includes("Exploration")) {
      return typeof original.handleCommandResult === "function"
        ? original.handleCommandResult(message)
        : false;
    }

    const result = readRecord(record?.result) || {};
    if (result.ok !== true) {
      state.lastMessage = explorationErrorMessage(result);
      if (command === "GameRoomFateKnotsGetExplorationConsensus") state.requestedKey = "";
      renderCurrent();
      return true;
    }

    const commandState = readRecord(result.state);
    state.consensus = readRecord(commandState?.consensus);
    state.lastMessage = "";

    if (command === "GameRoomFateKnotsSendExplorationMessage") {
      state.draftText = "";
    }

    if (commandState?.advanced === true) {
      state.consensus = null;
      state.requestedKey = "";
    }

    renderCurrent();
    return true;
  }

  function dispose() {
    state.gameplay = null;
    state.consensus = null;
    state.requestedKey = "";
    state.draftText = "";
    state.lastMessage = "";
    if (typeof original.dispose === "function") original.dispose();
  }

  gameplayUi.dispose = dispose;
  gameplayUi.handleCommandResult = handleCommandResult;
  gameplayUi.handleExplorationConsensusState = handleExplorationConsensusState;
  gameplayUi.handleState = handleState;
  gameplayUi.render = render;
})(window);
