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
    loot: null,
    requestedKey: "",
    draftRecipients: new Map(),
    draftTouched: false,
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

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function createButton(label, onClick, options) {
    const button = createElement("button", "fate-knots-gameplay__button", label);
    button.type = "button";
    if (options && options.secondary)
      button.classList.add("fate-knots-gameplay__button--secondary");
    if (options && options.selected) button.classList.add("is-selected");
    if (options && options.disabled) button.disabled = true;
    if (!button.disabled && typeof onClick === "function") {
      button.addEventListener("click", onClick);
    }
    return button;
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

  function currentRunId() {
    return readString(readRecord(state.gameplay)?.runId);
  }

  function isLoot() {
    return readRecord(state.gameplay)?.phase === "loot";
  }

  function requestLootState(gameplay) {
    if (!gameplay || gameplay.phase !== "loot") return;
    const key = `${readString(gameplay.runId)}:${String(gameplay.revision ?? "")}`;
    if (!key || key === state.requestedKey) return;
    state.requestedKey = key;
    if (!sendCommand("GameRoomFateKnotsGetLootState", { runId: readString(gameplay.runId) })) {
      state.requestedKey = "";
    }
  }

  function seatLabel(seatId) {
    if (seatId === "user") return "Sen";
    if (seatId === "ai2") return "AI2";
    if (seatId === "us1") return "US1";
    return seatId;
  }

  function cardMap() {
    return new Map(
      readArray(readRecord(state.gameplay)?.cards)
        .map(readRecord)
        .filter(Boolean)
        .map(function (card) {
          return [readString(card.cardId), card];
        })
    );
  }

  function partyActors() {
    return readArray(readRecord(state.gameplay)?.partyActors).map(readRecord).filter(Boolean);
  }

  function actorLabel(actorId) {
    const actor = partyActors().find(function (entry) {
      return readString(entry.actorId) === actorId;
    });
    return actor ? readString(actor.name) || seatLabel(readString(actor.seatId)) : actorId;
  }

  function syncDraftFromProposal() {
    if (state.draftTouched) return;
    const loot = readRecord(state.loot);
    const allocations = readArray(loot?.allocations);
    if (allocations.length === 0) return;
    state.draftRecipients.clear();
    allocations.forEach(function (entry) {
      const allocation = readRecord(entry);
      const poolIndex = Number(allocation?.poolIndex);
      if (!Number.isInteger(poolIndex) || poolIndex < 0) return;
      state.draftRecipients.set(
        poolIndex,
        typeof allocation?.recipientActorId === "string" ? allocation.recipientActorId : null
      );
    });
  }

  function draftComplete() {
    const pool = readArray(readRecord(state.loot)?.pool);
    if (pool.length === 0) return false;
    return pool.every(function (entry) {
      const poolIndex = Number(readRecord(entry)?.poolIndex);
      return Number.isInteger(poolIndex) && state.draftRecipients.has(poolIndex);
    });
  }

  function setDraftRecipient(poolIndex, recipientActorId) {
    if (!isLoot()) return;
    state.draftTouched = true;
    state.draftRecipients.set(poolIndex, recipientActorId);
    state.lastMessage = "";
    renderCurrent();
  }

  function proposeLoot() {
    if (!isLoot() || !draftComplete()) return;
    const pool = readArray(readRecord(state.loot)?.pool);
    const allocations = pool.map(function (entry) {
      const item = readRecord(entry);
      const poolIndex = Number(item?.poolIndex);
      return {
        poolIndex: poolIndex,
        recipientActorId: state.draftRecipients.get(poolIndex) ?? null,
      };
    });
    state.lastMessage = "Dağıtım önerisi host tarafından doğrulanıyor…";
    renderCurrent();
    sendCommand("GameRoomFateKnotsProposeLoot", {
      runId: currentRunId(),
      allocations: allocations,
    });
  }

  function approveLoot() {
    if (!isLoot()) return;
    state.lastMessage = "Onayın host tarafından doğrulanıyor…";
    renderCurrent();
    sendCommand("GameRoomFateKnotsApproveLoot", { runId: currentRunId() });
  }

  function renderApprovalState(loot) {
    const row = createElement("div", "fate-knots-gameplay__readiness");
    const approved = new Set(readArray(loot.approvedSeatIds).map(readString));
    readArray(loot.activeSeatIds).forEach(function (entry) {
      const seatId = readString(entry);
      row.append(
        createElement(
          "span",
          approved.has(seatId)
            ? "fate-knots-gameplay__seat-state is-ready"
            : "fate-knots-gameplay__seat-state",
          `${seatLabel(seatId)} · ${approved.has(seatId) ? "onayladı" : "inceliyor"}`
        )
      );
    });
    return row;
  }

  function renderPoolItem(item, cards) {
    const poolIndex = Number(item.poolIndex);
    const cardId = readString(item.cardId);
    const card = cards.get(cardId);
    const section = createElement("div", "fate-knots-gameplay__option-group");
    section.append(
      createElement(
        "div",
        "fate-knots-gameplay__option-title",
        card ? readString(card.name) || cardId : cardId
      )
    );

    const row = createElement("div", "fate-knots-gameplay__option-row");
    const selected = state.draftRecipients.has(poolIndex)
      ? state.draftRecipients.get(poolIndex)
      : undefined;
    row.append(
      createButton(
        "Geride bırak",
        function () {
          setDraftRecipient(poolIndex, null);
        },
        { secondary: true, selected: selected === null }
      )
    );
    partyActors().forEach(function (actor) {
      const actorId = readString(actor.actorId);
      row.append(
        createButton(
          readString(actor.name) || seatLabel(readString(actor.seatId)),
          function () {
            setDraftRecipient(poolIndex, actorId);
          },
          { selected: selected === actorId }
        )
      );
    });
    section.append(row);
    return section;
  }

  function renderCurrentProposal(loot) {
    const allocations = readArray(loot.allocations);
    if (allocations.length === 0) {
      return createElement(
        "div",
        "fate-knots-gameplay__muted",
        "Henüz ortak değerlendirmeye sunulmuş bir dağıtım önerisi yok."
      );
    }

    const summary = createElement("div", "fate-knots-gameplay__messages");
    allocations.forEach(function (entry) {
      const allocation = readRecord(entry);
      if (!allocation) return;
      const cardId = readString(allocation.cardId);
      const card = cardMap().get(cardId);
      const recipientActorId =
        typeof allocation.recipientActorId === "string" ? allocation.recipientActorId : null;
      summary.append(
        createElement(
          "div",
          "fate-knots-gameplay__message-text",
          `${card ? readString(card.name) || cardId : cardId} → ${
            recipientActorId ? actorLabel(recipientActorId) : "geride bırak"
          }`
        )
      );
    });
    return summary;
  }

  function renderLootPanel() {
    const interaction = createElement("div", "fate-knots-gameplay__interaction");
    const loot = readRecord(state.loot);

    const proposal = createElement("section", "fate-knots-gameplay__planning");
    proposal.append(createElement("h3", "fate-knots-gameplay__discussion-title", "Loot dağıtımı"));
    if (!loot) {
      proposal.append(
        createElement("div", "fate-knots-gameplay__muted", "Loot durumu host'tan bekleniyor…")
      );
      interaction.append(proposal);
      return interaction;
    }

    syncDraftFromProposal();
    const cards = cardMap();
    readArray(loot.pool).forEach(function (entry) {
      const item = readRecord(entry);
      if (item) proposal.append(renderPoolItem(item, cards));
    });
    proposal.append(
      createButton("Dağıtımı öner", proposeLoot, {
        disabled: !draftComplete(),
      })
    );

    const approval = createElement("section", "fate-knots-gameplay__discussion");
    approval.append(
      createElement("h3", "fate-knots-gameplay__discussion-title", "Ortak onay"),
      renderCurrentProposal(loot),
      renderApprovalState(loot)
    );
    const approved = readArray(loot.approvedSeatIds).includes("user");
    const hasProposal = readArray(loot.allocations).length > 0;
    if (approved) {
      approval.append(
        createElement(
          "div",
          "fate-knots-gameplay__ready-note",
          "Bu dağıtımı onayladın. Diğer aktif oyuncular bekleniyor."
        )
      );
    } else if (hasProposal) {
      approval.append(createButton("Bu dağıtımı onayla", approveLoot));
    }

    interaction.append(proposal, approval);
    return interaction;
  }

  function render(root) {
    const rendered = typeof original.render === "function" ? original.render(root) : false;
    if (!rendered || !isLoot()) return rendered;
    const shell = root.querySelector(".fate-knots-gameplay");
    if (!shell) return rendered;
    shell.append(renderLootPanel());
    if (state.lastMessage) {
      shell.append(createElement("div", "fate-knots-gameplay__notice", state.lastMessage));
    }
    return rendered;
  }

  function renderCurrent() {
    const root = document.getElementById("app");
    if (root && state.gameplay) render(root);
  }

  function resetLoot() {
    state.loot = null;
    state.requestedKey = "";
    state.draftRecipients.clear();
    state.draftTouched = false;
  }

  function handleState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    const nextState = payload && "state" in payload ? readRecord(payload.state) : null;
    const previousRunId = currentRunId();
    state.gameplay = nextState;

    const handled =
      typeof original.handleState === "function" ? original.handleState(message) : false;

    const nextRunId = readString(nextState?.runId);
    if (previousRunId && nextRunId && previousRunId !== nextRunId) resetLoot();

    if (isLoot()) requestLootState(nextState);
    else resetLoot();
    return handled;
  }

  function handleLootState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    if (!payload || !("state" in payload)) return false;
    state.loot = readRecord(payload.state);
    state.lastMessage = "";
    if (!state.draftTouched) syncDraftFromProposal();
    renderCurrent();
    return true;
  }

  function errorMessage(result) {
    const error = readString(result?.error);
    if (error === "proposal-required") return "Önce tam bir loot dağıtım önerisi gerekiyor.";
    if (error === "loot-proposal-rejected") return "Loot önerisi artık mevcut havuzla uyuşmuyor.";
    if (error === "loot-resolution-rejected") return "Ortak loot dağıtımı canonical engine tarafından reddedildi.";
    if (error === "seat-not-active") return "Bu koltuk aktif partiye bağlı değil.";
    if (error === "persistence-rejected" || error === "save-rejected") {
      return "Loot dağıtımı güvenli biçimde kaydedilemedi.";
    }
    return "Loot işlemi tamamlanamadı.";
  }

  function handleCommandResult(message) {
    const record = readRecord(message);
    const command = readString(record?.command);
    if (!command.startsWith("GameRoomFateKnots") || !command.includes("Loot")) {
      return typeof original.handleCommandResult === "function"
        ? original.handleCommandResult(message)
        : false;
    }

    const result = readRecord(record?.result) || {};
    if (result.ok !== true) {
      state.lastMessage = errorMessage(result);
      if (command === "GameRoomFateKnotsGetLootState") state.requestedKey = "";
      renderCurrent();
      return true;
    }

    const commandState = readRecord(result.state);
    state.lastMessage = "";
    if (commandState?.resolved === true) {
      resetLoot();
    } else {
      state.loot = commandState;
      if (command === "GameRoomFateKnotsProposeLoot") {
        state.draftTouched = false;
        syncDraftFromProposal();
      }
    }
    renderCurrent();
    return true;
  }

  function dispose() {
    state.gameplay = null;
    resetLoot();
    state.lastMessage = "";
    if (typeof original.dispose === "function") original.dispose();
  }

  gameplayUi.dispose = dispose;
  gameplayUi.handleCommandResult = handleCommandResult;
  gameplayUi.handleLootState = handleLootState;
  gameplayUi.handleState = handleState;
  gameplayUi.render = render;
})(window);
